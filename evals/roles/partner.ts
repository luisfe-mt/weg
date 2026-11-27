// Partner: level-fit rate over every partner turn in the scripted dialogues of gold/talk_scenarios.jsonl.
// A turn fits when it is within the scenario's word limit, at least 90% of its words are known at the
// sublevel, it stays in German and it does not correct the learner. The bar is 90% of turns.
import type { Message } from "../lib/client.ts";
import { gold, knownThrough, lemmas, sample, type GoldScenario } from "../lib/data.ts";
import { correctsLearner, foreignShare, turnProblems, wordCount } from "../lib/metrics.ts";
import { coverage, tokenize, candidates } from "../../scripts/lib/lemma.mjs";
import type { RoleContext, RoleResult } from "./types.ts";

export const PARTNER_BAR = 0.9;
const FULL_LIST_MAX = 900;

/** Words the partner may use beyond the learner's vocabulary: the card's own German and the learner's words. */
function scenarioWords(s: GoldScenario, learnerSoFar: string[]): string[] {
  const data = lemmas();
  const text = [s.partnerOpening, s.partnerRole, s.learnerRole, ...s.partnerFacts, ...learnerSoFar].join(" ");
  return tokenize(text).flatMap((sent) => sent.flatMap((w) => [w, ...candidates(w, data, { sentenceInitial: true })]));
}

export async function runPartner(ctx: RoleContext): Promise<RoleResult> {
  const scenarios = sample(gold.scenarios(), ctx.sample);
  const data = lemmas();
  const records: unknown[] = [];
  const failures: string[] = [];
  let turns = 0;
  let fit = 0;
  let invalid = 0;
  const problemCounts: Record<string, number> = {};

  await Promise.all(
    scenarios.map(async (s) => {
      const known = knownThrough(s.sublevel, ctx.specs);
      const card = {
        sublevel: s.sublevel,
        register: s.register,
        partnerRole: s.partnerRole,
        learnerRole: s.learnerRole,
        situation: s.situation.en,
        partnerFacts: s.partnerFacts,
        targetGrammar: s.targetGrammar,
        maxWordsPerTurn: s.limits.maxPartnerWordsPerTurn,
        knownWords: known.size <= FULL_LIST_MAX ? [...known] : "too many to list: use common everyday words of this sublevel",
      };
      const messages: Message[] = [
        { role: "system", content: ctx.prompt.system },
        { role: "user", content: `Scenario card: ${JSON.stringify(card)}\nStart the conversation.` },
        { role: "assistant", content: JSON.stringify({ say: s.partnerOpening }) },
      ];
      const learnerSoFar: string[] = [];
      const log: unknown[] = [];
      // Turns depend on the conversation so far, so a scenario runs in order.
      for (const [i, line] of s.script.entries()) {
        messages.push({ role: "user", content: line.learner });
        learnerSoFar.push(line.learner);
        const reply = await ctx.client.chatJson(messages, 1200, (o) => typeof o.say === "string" && o.say.trim() !== "");
        const say = reply?.say;
        turns++;
        if (typeof say !== "string" || !say.trim()) {
          invalid++;
          problemCounts.invalid = (problemCounts.invalid ?? 0) + 1;
          failures.push(`${s.id} turn ${i + 1}: invalid reply`);
          log.push({ learner: line.learner, partner: null, problems: ["invalid"] });
          messages.push({ role: "assistant", content: JSON.stringify({ say: "…" }) });
          continue;
        }
        const k = new Set([...known, ...scenarioWords(s, learnerSoFar)]);
        const c = coverage(say, k, data);
        const problems = turnProblems({
          words: wordCount(say),
          maxWords: s.limits.maxPartnerWordsPerTurn,
          coverage: c.tokens ? c.knownTokens / c.tokens : 1,
          foreign: foreignShare(say),
          corrects: correctsLearner(say),
        });
        if (!problems.length) fit++;
        for (const p of problems) {
          const key = p.replace(/ \(.*/, "");
          problemCounts[key] = (problemCounts[key] ?? 0) + 1;
        }
        if (problems.length) failures.push(`${s.id} turn ${i + 1}: ${problems.join(", ")}${c.unknown.length ? ` [${c.unknown.slice(0, 5).join(", ")}]` : ""}: "${say}"`);
        log.push({ learner: line.learner, expect: line.expect, partner: say, problems, unknown: c.unknown });
        messages.push({ role: "assistant", content: JSON.stringify({ say }) });
      }
      records.push({ id: s.id, sublevel: s.sublevel, turns: log });
      ctx.log(`partner ${s.id} done`);
    }),
  );

  const score = turns ? fit / turns : 0;
  return {
    role: "partner",
    metric: "level-fit turns",
    score,
    bar: PARTNER_BAR,
    pass: score >= PARTNER_BAR,
    items: turns,
    invalid,
    extra: { scenarios: String(scenarios.length), ...Object.fromEntries(Object.entries(problemCounts).map(([k, v]) => [k, String(v)])) },
    failures: failures.sort().slice(0, 10),
    records: records.sort((a, b) => String((a as { id: string }).id).localeCompare(String((b as { id: string }).id))),
  };
}

