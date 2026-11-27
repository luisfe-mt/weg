// Generator: share of texts at 95% or more known words, measured by the same coverage code CI uses.
// Requests come from gold/leveled_texts.jsonl: its sublevel, text type, theme, grammar and length,
// never its text. The gateway repairs a failed text once, sending the draft and its unknown words, so a text
// passes if the first or the repaired version reaches 95%. The bar is 90% of texts.
import { LEVELS, gold, knownThrough, lemmas, sample, type GoldText, type Spec } from "../lib/data.ts";
import { coverage } from "../../scripts/lib/lemma.mjs";
import { pct } from "./coach.ts";
import type { RoleContext, RoleResult } from "./types.ts";

export const GENERATOR_MIN_COVERAGE = 0.95;
// The bar: 90% of texts reach 95% known words after the one repair. The app's code check rejects the
// rest, so a learner never sees a text under 95%; the bar measures how often generation succeeds.
export const GENERATOR_BAR = 0.9;
// Above this many lemmas the full list costs more tokens than a free-tier minute allows.
const FULL_LIST_MAX = 900;

/** The sublevel a gold text belongs to: its own, else the latest sublevel that teaches one of its features. */
function sublevelOf(t: GoldText, specs: Map<string, Spec>): string {
  if (t.sublevel) return t.sublevel;
  let best = LEVELS.findIndex((l) => l.startsWith(t.level));
  for (const [i, id] of LEVELS.entries()) {
    if (specs.get(id)?.grammar.some((g) => t.features.includes(g.id)) && i > best) best = i;
  }
  return LEVELS[Math.max(best, 0)]!;
}

export async function runGenerator(ctx: RoleContext): Promise<RoleResult> {
  const items = sample(gold.texts(), ctx.sample);
  const data = lemmas();
  const records: unknown[] = [];
  const failures: string[] = [];
  let passFirst = 0;
  let passAfterRetry = 0;
  let invalid = 0;
  let done = 0;
  const known = new Map<string, Set<string>>();

  await Promise.all(
    items.map(async (t) => {
      const sublevel = sublevelOf(t, ctx.specs);
      const spec = ctx.specs.get(sublevel)!;
      const k = known.get(sublevel) ?? knownThrough(sublevel, ctx.specs);
      known.set(sublevel, k);
      const full = k.size <= FULL_LIST_MAX;
      const allowedWords = full ? [...k] : spec.vocabulary.map((v) => v.lemma);
      const grammar = spec.grammar.filter((g) => t.features.includes(g.id)).map((g) => ({ id: g.id, title: g.title.de ?? g.title.en }));
      const request = { sublevel, textType: t.textType, theme: t.theme, grammar, words: t.wordCount, allowedWordsAre: full ? "every word the learner knows" : "this sublevel's theme words only", allowedWords };

      const attempt = async (repair?: { draft: string; replaceWords: string[] }) => {
        const reply = await ctx.client.chatJson(
          [
            { role: "system", content: ctx.prompt.system },
            { role: "user", content: JSON.stringify(repair ? { ...request, ...repair } : request) },
          ],
          3000,
          (o) => typeof o.text === "string" && o.text.trim() !== "",
        );
        const text = reply?.text;
        if (typeof text !== "string" || !text.trim()) return undefined;
        const c = coverage(text, k, data);
        return { text, share: c.tokens ? c.knownTokens / c.tokens : 0, unknown: [...new Set(c.unknown)] };
      };

      const first = await attempt();
      // The gateway's one repair: the draft goes back with its unknown words, to be replaced in place.
      const second = first && first.share >= GENERATOR_MIN_COVERAGE ? undefined : await attempt(first && { draft: first.text, replaceWords: first.unknown });
      if (!first && !second) invalid++;
      const okFirst = !!first && first.share >= GENERATOR_MIN_COVERAGE;
      const ok = okFirst || (!!second && second.share >= GENERATOR_MIN_COVERAGE);
      if (okFirst) passFirst++;
      if (ok) passAfterRetry++;
      else failures.push(`${t.id} (${sublevel}): ${pct(first?.share ?? 0)} then ${pct(second?.share ?? 0)}; unknown: ${(second ?? first)?.unknown.slice(0, 8).join(", ") ?? "no text"}`);
      records.push({ id: t.id, sublevel, first: first && { share: first.share, unknown: first.unknown, text: first.text }, retry: second && { share: second.share, unknown: second.unknown, text: second.text } });
      if (++done % 10 === 0) ctx.log(`generator ${done}/${items.length}`);
    }),
  );

  const score = items.length ? passAfterRetry / items.length : 0;
  return {
    role: "generator",
    metric: "texts at 95% known (with one retry)",
    score,
    bar: GENERATOR_BAR,
    pass: score >= GENERATOR_BAR,
    items: items.length,
    invalid,
    extra: { "first attempt": pct(passFirst / items.length) },
    failures: failures.sort().slice(0, 10),
    records: records.sort((a, b) => String((a as { id: string }).id).localeCompare(String((b as { id: string }).id))),
  };
}
