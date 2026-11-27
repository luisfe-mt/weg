// Coach: precision (bar 75%) and recall on gold/corrections.jsonl. Correct sentences and mustNotFlag
// phrases are the false-flag tests: any flag on them lowers precision.
import { gold, sample } from "../lib/data.ts";
import { coachTotals, scoreCoachItem, type CoachItemScore, type Flag } from "../lib/metrics.ts";
import type { RoleContext, RoleResult } from "./types.ts";

export const COACH_BAR = 0.75;

function flagsOf(reply: Record<string, unknown> | undefined): Flag[] | undefined {
  const errors = reply?.errors;
  if (!Array.isArray(errors)) return undefined;
  return errors
    .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
    .map((e) => ({ wrong: typeof e.wrong === "string" ? e.wrong : "", right: typeof e.right === "string" ? e.right : "" }));
}

export async function runCoach(ctx: RoleContext): Promise<RoleResult> {
  const items = sample(gold.corrections(), ctx.sample);
  const scores: CoachItemScore[] = [];
  const failures: string[] = [];
  const records: unknown[] = [];
  let invalid = 0;

  await Promise.all(
    items.map(async (item, i) => {
      const input = { level: item.level, l1: item.l1, lang: item.l1, text: item.learnerSentence };
      let flags: Flag[] | undefined;
      try {
        const reply = await ctx.client.chatJson(
          [
            { role: "system", content: ctx.prompt.system },
            { role: "user", content: JSON.stringify(input) },
          ],
          1200,
          (o) => flagsOf(o) !== undefined,
        );
        flags = flagsOf(reply);
      } catch (e) {
        ctx.log(`coach ${item.id}: ${(e as Error).message}`);
        throw e;
      }
      if (!flags) {
        invalid++;
        flags = [];
        // An invalid reply flags nothing; on an item with errors that costs recall, which is fair.
      }
      const capped = flags.slice(0, 3);
      const s = scoreCoachItem(item.learnerSentence, item.errors, item.mustNotFlag ?? [], capped);
      scores[i] = s;
      records[i] = { id: item.id, flags: capped, trueFlags: s.trueFlags, falseFlags: s.falseFlags, found: s.found, expected: s.expected };
      if (s.falseFlags > 0) {
        const bad = capped.map((f) => `"${f.wrong}"→"${f.right}"`).join(", ");
        failures.push(`${item.id} false flag: ${bad} in "${item.learnerSentence}"${s.mustNotFlagHits.length ? " (mustNotFlag)" : ""}`);
      } else if (s.found < s.expected) {
        failures.push(`${item.id} missed: ${item.errors.map((e) => `"${e.wrong}"→"${e.right}"`).join(", ")} in "${item.learnerSentence}"`);
      }
      if ((i + 1) % 25 === 0) ctx.log(`coach ${i + 1}/${items.length}`);
    }),
  );

  const t = coachTotals(scores);
  const correctItems = items.filter((x) => x.errors.length === 0).length;
  const falseOnCorrect = items.filter((x, i) => x.errors.length === 0 && scores[i]!.flags > 0).length;
  return {
    role: "coach",
    metric: "precision",
    score: t.precision,
    bar: COACH_BAR,
    pass: t.precision >= COACH_BAR,
    items: items.length,
    invalid,
    extra: {
      recall: pct(t.recall),
      flags: String(t.flags),
      "false flags": String(t.falseFlags),
      "mustNotFlag hit": String(t.mustNotFlagHits),
      "correct sentences flagged": `${falseOnCorrect}/${correctItems}`,
    },
    failures: failures.sort().slice(0, 10),
    records,
  };
}

export const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
