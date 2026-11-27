// Examiner: share of gate anchor samples scored within one band of the human anchor (bar 80%).
// The anchors live in each sublevel's gate in curriculum/; every sample's band is the human score.
import { sample, type GateTask, type Rubric } from "../lib/data.ts";
import { overallBand } from "../lib/metrics.ts";
import { pct } from "./coach.ts";
import type { RoleContext, RoleResult } from "./types.ts";

export const EXAMINER_BAR = 0.8;

interface AnchorItem {
  id: string;
  sublevel: string;
  task: GateTask;
  rubric: Rubric;
  scenario?: string;
  band: number;
  criterionBands: Record<string, number>;
  response: string;
}

function anchorItems(ctx: RoleContext): AnchorItem[] {
  const out: AnchorItem[] = [];
  for (const spec of ctx.specs.values()) {
    for (const task of spec.gate.tasks) {
      const rubric = spec.gate.rubrics.find((r) => r.id === task.rubricId);
      if (!rubric) continue;
      const scenario = spec.talkScenarios.find((s) => s.id === task.talkScenario)?.situation.en;
      for (const a of task.anchors ?? []) {
        a.samples.forEach((s, i) =>
          out.push({ id: `${spec.id}/${task.id}/b${a.band}s${i + 1}`, sublevel: spec.id, task, rubric, scenario, band: a.band, criterionBands: s.criterionBands, response: s.response }),
        );
      }
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id, "en"));
}

function bandsOf(reply: Record<string, unknown> | undefined, rubric: Rubric): { bands: Record<string, number>; low: boolean } | undefined {
  const criteria = reply?.criteria;
  if (!Array.isArray(criteria)) return undefined;
  const valid = new Set(rubric.bands.map((b) => b.band));
  const bands: Record<string, number> = {};
  for (const c of criteria) {
    if (!c || typeof c !== "object") continue;
    const { id, band } = c as Record<string, unknown>;
    if (typeof id === "string" && typeof band === "number" && valid.has(band)) bands[id] = band;
  }
  // Every criterion needs its own score: a missing one makes the reply invalid, not partial.
  if (!rubric.criteria.every((c) => c.id in bands)) return undefined;
  return { bands, low: reply?.confidence === "low" };
}

export async function runExaminer(ctx: RoleContext): Promise<RoleResult> {
  const items = sample(anchorItems(ctx), ctx.sample);
  const records: unknown[] = [];
  const failures: string[] = [];
  let within = 0;
  let exact = 0;
  let criteriaWithin = 0;
  let criteriaTotal = 0;
  let passAgree = 0;
  let falsePass = 0;
  let low = 0;
  let invalid = 0;
  let done = 0;

  await Promise.all(
    items.map(async (item) => {
      const input = {
        sublevel: item.sublevel,
        skill: item.task.skill,
        task: { format: item.task.format, instructions: item.task.instructions, wordCount: item.task.wordCount, scenario: item.scenario },
        rubric: {
          bands: item.rubric.bands,
          criteria: item.rubric.criteria.map((c) => ({ id: c.id, weight: c.weight, descriptors: c.descriptors })),
        },
        response: item.response,
      };
      const reply = await ctx.client.chatJson(
        [
          { role: "system", content: ctx.prompt.system },
          { role: "user", content: JSON.stringify(input) },
        ],
        3000,
        (o) => bandsOf(o, item.rubric) !== undefined,
      );
      const parsed = bandsOf(reply, item.rubric);
      const weights = Object.fromEntries(item.rubric.criteria.map((c) => [c.id, c.weight]));
      const passing = new Set(item.rubric.bands.filter((b) => b.passing).map((b) => b.band));
      if (!parsed) {
        invalid++;
        failures.push(`${item.id}: invalid reply`);
        records.push({ id: item.id, anchor: item.band, invalid: true });
      } else {
        const overall = overallBand(parsed.bands, weights);
        const diff = Math.abs(overall - item.band);
        if (diff <= 1) within++;
        else failures.push(`${item.id}: scored ${overall}, anchor ${item.band} (${JSON.stringify(parsed.bands)})`);
        if (diff === 0) exact++;
        if (passing.has(overall) === passing.has(item.band)) passAgree++;
        // A pass the human did not give, without a low-confidence mark, is the failure the north star forbids.
        if (passing.has(overall) && !passing.has(item.band) && !parsed.low) falsePass++;
        if (parsed.low) low++;
        for (const c of item.rubric.criteria) {
          criteriaTotal++;
          if (Math.abs((parsed.bands[c.id] ?? -9) - (item.criterionBands[c.id] ?? 9)) <= 1) criteriaWithin++;
        }
        records.push({ id: item.id, anchor: item.band, overall, bands: parsed.bands, low: parsed.low });
      }
      if (++done % 20 === 0) ctx.log(`examiner ${done}/${items.length}`);
    }),
  );

  const score = items.length ? within / items.length : 0;
  return {
    role: "examiner",
    metric: "within one band",
    score,
    bar: EXAMINER_BAR,
    pass: score >= EXAMINER_BAR,
    items: items.length,
    invalid,
    extra: {
      exact: pct(exact / items.length),
      "criteria within one": pct(criteriaTotal ? criteriaWithin / criteriaTotal : 0),
      "pass/fail agree": pct(passAgree / items.length),
      "unflagged false passes": String(falsePass),
      "low confidence": String(low),
    },
    failures: failures.sort().slice(0, 10),
    records: records.sort((a, b) => String((a as { id: string }).id).localeCompare(String((b as { id: string }).id))),
  };
}
