// Frequency and coverage checks on curriculum/ (ADR 0007). Part of `npm run validate`.
//
// For each sublevel, in path order, with the vocabulary of all earlier ones:
//   1. frequencyRank of every item matches data/lemma/de-frequency.tsv
//   2. noun article and plural agree with Wiktionary where it has them
//   3. no lemma + part of speech is taught twice on the path
//   4. the German text of the spec uses taught words: 95% of tokens or more
//   5. the vocabulary so far holds the required share of the most frequent lemmas
//
//   node scripts/check-coverage.mjs            all files, short report
//   node scripts/check-coverage.mjs A2.2 -v    one sublevel's detail: unknown words, missing band lemmas
//   --assume-below 700                         for a writer whose earlier sublevels are not written yet:
//                                              count every lemma ranked above 700 as already taught
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { candidates, coverage, loadLemmaData, rankOf, tokenize, UNRANKED } from "./lib/lemma.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LEVELS = ["A1.1", "A1.2", "A2.1", "A2.2", "B1.1", "B1.2", "B2.1", "B2.2", "B2.3", "C1.1", "C1.2"];
const ARTICLE = { m: "der", f: "die", n: "das" };

const args = process.argv.slice(2);
const verbose = args.includes("-v");
const only = args.find((a) => LEVELS.includes(a));

const data = loadLemmaData();
const bands = JSON.parse(readFileSync(path.join(root, "data", "frequency-bands.json"), "utf8"));
const errors = [];
const fail = (id, message) => errors.push(`curriculum/${id}.json: ${message}`);

/** The German a learner reads or hears in a spec. Learner turns and anchors are left out: they contain errors on purpose. */
function germanStrings(spec) {
  const out = [];
  const add = (where, text) => text && out.push({ where, text });
  for (const g of spec.grammar) {
    for (const e of g.examples) add(g.id, e.de);
    for (const e of g.typicalErrors) add(g.id, e.correct);
    for (const d of g.drills ?? []) {
      add(g.id, d.prompt);
      for (const a of d.answers) add(g.id, a);
    }
  }
  for (const v of spec.vocabulary) add(v.id, v.example.de);
  for (const s of spec.talkScenarios) {
    add(s.id, s.partnerOpening);
    for (const p of s.usefulPhrases ?? []) add(s.id, p.de);
  }
  for (const t of spec.gate.tasks) {
    add(t.id, t.material?.text);
    for (const i of t.items ?? []) {
      add(t.id, i.question);
      for (const o of i.options ?? []) add(t.id, o);
    }
  }
  return out;
}

const known = new Set(); // lemmas taught so far, plus the words inside taught phrases
const assume = args.indexOf("--assume-below");
if (assume >= 0) for (const [lemma, e] of data.lemmas) if (e.rank < Number(args[assume + 1])) known.add(lemma);
const taught = new Map(); // "lemma|pos" -> sublevel
let printed = false;

for (const id of LEVELS) {
  const file = path.join(root, "curriculum", `${id}.json`);
  if (!existsSync(file)) continue;
  const spec = JSON.parse(readFileSync(file, "utf8"));
  const show = !only || only === id;

  for (const v of spec.vocabulary) {
    const key = `${v.lemma}|${v.pos}`;
    if (taught.has(key)) fail(id, `${v.id}: ${v.lemma} (${v.pos}) is already taught in ${taught.get(key)}`);
    else taught.set(key, id);

    const words = v.lemma.split(/\s+/);
    if (words.length === 1) {
      known.add(v.lemma);
      const rank = rankOf(v.lemma, data);
      if (v.frequencyRank !== rank) fail(id, `${v.id}: frequencyRank is ${v.frequencyRank}, the list says ${rank}`);
    } else {
      // A phrase teaches its words in that phrase; rank is not checked.
      for (const sentence of tokenize(v.lemma)) for (const w of sentence) for (const c of [w, ...candidates(w, data, { sentenceInitial: true })]) known.add(c);
    }
    if (v.pos === "noun" && !v.pluralOnly) {
      const entry = data.lemmas.get(v.lemma);
      const articles = (entry?.genders ?? []).map((g) => ARTICLE[g]);
      if (articles.length && !articles.includes(v.article)) fail(id, `${v.id}: article ${v.article}, Wiktionary has ${articles.join("/")}`);
      if (entry?.plurals.length && v.plural !== null && !entry.plurals.includes(v.plural)) {
        fail(id, `${v.id}: plural ${v.plural}, Wiktionary has ${entry.plurals.join("/")}`);
      }
    }
  }

  // 4. Text coverage.
  let tokens = 0;
  let knownTokens = 0;
  const unknown = new Map();
  const names = new Set();
  for (const { where, text } of germanStrings(spec)) {
    const c = coverage(text, known, data);
    tokens += c.tokens;
    knownTokens += c.knownTokens;
    for (const u of c.unknown) unknown.set(u, [...(unknown.get(u) ?? []), where]);
    for (const n of c.names) names.add(n);
  }
  const share = tokens ? knownTokens / tokens : 1;
  if (share < bands.minTextCoverage) {
    fail(id, `text coverage ${(share * 100).toFixed(1)}% is under ${bands.minTextCoverage * 100}% (run: node scripts/check-coverage.mjs ${id} -v)`);
  }

  // 5. Frequency floor.
  const top = bands.topRank[id];
  const missing = [];
  if (top) for (const [lemma, e] of data.lemmas) if (e.rank <= top && !known.has(lemma)) missing.push(lemma);
  const bandShare = top ? 1 - missing.length / top : 1;
  if (bandShare < bands.minShare) {
    fail(id, `only ${(bandShare * 100).toFixed(1)}% of the top ${top} lemmas are taught by the end of ${id}; ${bands.minShare * 100}% required`);
  }

  if (show) {
    printed = true;
    console.log(
      `${id}: ${spec.vocabulary.length} words (${taught.size} so far) · text coverage ${(share * 100).toFixed(1)}% of ${tokens} tokens` +
        (top ? ` · top ${top}: ${(bandShare * 100).toFixed(1)}%` : ""),
    );
    if (verbose) {
      const list = [...unknown.entries()].sort((a, b) => b[1].length - a[1].length);
      console.log(`  Untaught words (${list.length}):`);
      for (const [word, where] of list) console.log(`    ${word}  ×${where.length}  ${[...new Set(where)].slice(0, 3).join(", ")}`);
      console.log(`  Taken for names, not counted (check for untaught compounds): ${[...names].sort().join(", ") || "none"}`);
      console.log(`  Top-${top} lemmas not taught yet (${missing.length}): ${missing.join(", ")}`);
      console.log(`  Unranked items (rank ${UNRANKED}): ${spec.vocabulary.filter((v) => v.frequencyRank === UNRANKED).map((v) => v.lemma).join(", ") || "none"}`);
    }
  }
}

if (!printed) console.log("Coverage: no curriculum files to check.");
if (errors.length) {
  console.error(`\n${errors.length} coverage problem(s):`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}
console.log("Coverage checks passed.");
