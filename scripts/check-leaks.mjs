// Leak checks on curriculum/ (CLAUDE.md test rules). Part of `npm run validate`, so CI fails on a leak.
//
//   1. No gold sentence in curriculum/: no sentence of 5 words or more from gold/corrections.jsonl,
//      gold/leveled_texts.jsonl or gold/talk_scenarios.jsonl appears whole in any curriculum string.
//      A drill gap is filled with its answers first, so a drill that completes to a gold sentence counts.
//   2. No gate anchor copies a practice script: an anchor sample shares no run of 6 or more words with a
//      learner line or useful phrase of a talk scenario that a session practises (one no gate task uses).
//
//   node scripts/check-leaks.mjs
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { drillSentences, goldCopies, goldIndex, longestSharedRun } from "./lib/leaks.mjs";

export const GOLD_MIN_WORDS = 5;
export const SCRIPT_MAX_RUN = 5;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJsonl = (file) =>
  readFileSync(path.join(root, file), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));

const gold = [];
for (const c of readJsonl("gold/corrections.jsonl")) {
  gold.push({ id: c.id, text: c.learnerSentence }, { id: c.id, text: c.corrected });
}
for (const t of readJsonl("gold/leveled_texts.jsonl")) gold.push({ id: t.id, text: t.text });
for (const s of readJsonl("gold/talk_scenarios.jsonl")) {
  gold.push({ id: s.id, text: s.partnerOpening });
  for (const line of s.script) gold.push({ id: s.id, text: line.learner });
}
const index = goldIndex(gold, GOLD_MIN_WORDS);

const files = readdirSync(path.join(root, "curriculum"))
  .filter((f) => f.endsWith(".json"))
  .sort();
const specs = files.map((f) => ({ file: `curriculum/${f}`, spec: JSON.parse(readFileSync(path.join(root, "curriculum", f), "utf8")) }));
const errors = [];

// ---- 1. Gold sentences ----------------------------------------------------
/** Every string in the spec with its JSON path; drills add their completed sentences. */
function* strings(node, where) {
  if (typeof node === "string") {
    yield { where, text: node };
  } else if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) yield* strings(node[i], `${where}/${i}`);
  } else if (node && typeof node === "object") {
    if (typeof node.prompt === "string" && Array.isArray(node.answers)) {
      for (const text of drillSentences(node)) yield { where, text };
    }
    for (const [k, v] of Object.entries(node)) yield* strings(v, `${where}/${node.id && k !== "id" ? node.id + ":" : ""}${k}`);
  }
}
for (const { file, spec } of specs) {
  const seen = new Set();
  for (const { where, text } of strings(spec, "")) {
    for (const hit of goldCopies(text, index)) {
      const key = `${where} ${hit.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      errors.push(`${file}: ${where} uses gold ${hit.id}: "${hit.sentence}"`);
    }
  }
}

// ---- 2. Anchors against practice scripts ----------------------------------
const gateScenarios = new Set(specs.flatMap(({ spec }) => spec.gate.tasks.map((t) => t.talkScenario).filter(Boolean)));
const practiceLines = specs.flatMap(({ spec }) =>
  spec.talkScenarios
    .filter((s) => !gateScenarios.has(s.id))
    .flatMap((s) => [...s.script.map((l) => l.learner), ...(s.usefulPhrases ?? []).map((p) => p.de)].map((text) => ({ id: s.id, text }))),
);
for (const { file, spec } of specs) {
  for (const t of spec.gate.tasks) {
    for (const a of t.anchors ?? []) {
      a.samples.forEach((sample, i) => {
        for (const line of practiceLines) {
          const run = longestSharedRun(sample.response, line.text);
          if (run > SCRIPT_MAX_RUN) {
            errors.push(`${file}: gate task ${t.id}, band ${a.band}, sample ${i + 1} shares ${run} words with practice scenario ${line.id}: "${line.text}"`);
          }
        }
      });
    }
  }
}

console.log(`Leak check: ${index.size} gold sentences against ${files.length} specs; ${practiceLines.length} practice lines against gate anchors.`);
if (errors.length) {
  console.error(`\n${errors.length} leak(s):`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}
console.log("No leaks.");
