// Validates the JSON Schemas in schemas/, their fixtures, and every content
// file in curriculum/ and gold/. Run with `npm run validate`; CI runs it too.
//
// Beyond the schemas it checks the references a schema cannot express
// (see checkSublevel, checkGate, checkCorrection, checkLeveledText).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schemaDir = path.join(root, "schemas");
const ID_BASE = "https://github.com/luisfe-mt/weg/schemas/";

const errors = [];
let checked = 0;
const fail = (file, message) => errors.push(`${path.relative(root, file)}: ${message}`);

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const readJsonl = (file) =>
  readFileSync(file, "utf8")
    .split(/\r?\n/)
    .map((line, i) => ({ line: i + 1, text: line.trim() }))
    .filter((l) => l.text !== "")
    .map((l) => {
      try {
        return { line: l.line, data: JSON.parse(l.text) };
      } catch (e) {
        fail(file, `line ${l.line}: not valid JSON (${e.message})`);
        return null;
      }
    })
    .filter(Boolean);
const list = (dir, ext) =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith(ext))
        .sort()
        .map((f) => path.join(dir, f))
    : [];

// ---- 1. Schemas compile under strict mode --------------------------------
const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false, strictTypes: false });
addFormats(ajv);

const schemaFiles = list(schemaDir, ".schema.json");
for (const file of schemaFiles) {
  const schema = readJson(file);
  const expectedId = ID_BASE + path.basename(file);
  if (schema.$id !== expectedId) fail(file, `$id must be ${expectedId}`);
  ajv.addSchema(schema);
}
const validators = {};
for (const file of schemaFiles) {
  const name = path.basename(file, ".schema.json");
  try {
    validators[name] = ajv.getSchema(ID_BASE + path.basename(file));
    checked++;
  } catch (e) {
    fail(file, `does not compile: ${e.message}`);
  }
}

function validate(name, data, file, where = "") {
  const v = validators[name];
  if (!v) return fail(file, `no schema named ${name}`), false;
  checked++;
  if (v(data)) return true;
  for (const e of v.errors.slice(0, 10)) {
    fail(file, `${where}${e.instancePath || "/"} ${e.message}${e.params ? " " + JSON.stringify(e.params) : ""}`);
  }
  return false;
}

// ---- 2. Checks a schema cannot express ------------------------------------
function duplicates(ids) {
  const seen = new Set();
  return [...new Set(ids.filter((id) => seen.has(id) || !seen.add(id)))];
}

function checkGate(gate, file) {
  const rubrics = new Map(gate.rubrics.map((r) => [r.id, r]));
  for (const dup of duplicates(gate.tasks.map((t) => t.id))) fail(file, `gate: duplicate task id ${dup}`);
  for (const r of gate.rubrics) {
    const sum = r.criteria.reduce((s, c) => s + c.weight, 0);
    if (Math.abs(sum - 1) > 1e-9) fail(file, `gate: weights of rubric ${r.id} sum to ${sum}, not 1`);
    const bands = r.bands.map((b) => b.band);
    for (const c of r.criteria) {
      const have = c.descriptors.map((d) => d.band);
      if (bands.join() !== have.join()) {
        fail(file, `gate: rubric ${r.id}, criterion ${c.id}: descriptors must cover bands ${bands.join(", ")} in order`);
      }
    }
  }
  const points = gate.tasks.reduce((s, t) => s + t.points, 0);
  if (points !== 100) fail(file, `gate: task points sum to ${points}, not 100`);
  for (const t of gate.tasks) {
    if (!t.rubricId) continue;
    const rubric = rubrics.get(t.rubricId);
    if (!rubric) {
      fail(file, `gate: task ${t.id} names unknown rubric ${t.rubricId}`);
      continue;
    }
    if (rubric.skill !== t.skill) fail(file, `gate: task ${t.id} is ${t.skill} but rubric ${rubric.id} is ${rubric.skill}`);
    const criteria = rubric.criteria.map((c) => c.id).sort();
    const bands = new Set(rubric.bands.map((b) => b.band));
    for (const a of t.anchors ?? []) {
      if (!bands.has(a.band)) fail(file, `gate: task ${t.id} has anchors for band ${a.band}, which rubric ${rubric.id} lacks`);
      a.samples.forEach((s, i) => {
        if (Object.keys(s.criterionBands).sort().join() !== criteria.join()) {
          fail(file, `gate: task ${t.id}, band ${a.band}, sample ${i + 1}: criterionBands must be exactly ${criteria.join(", ")}`);
        }
      });
    }
    for (const dup of duplicates((t.anchors ?? []).map((a) => a.band))) fail(file, `gate: task ${t.id} lists band ${dup} twice`);
  }
  return { anchorsComplete: gate.tasks.every((t) => {
    if (!t.rubricId) return true;
    const rubric = rubrics.get(t.rubricId);
    return rubric && rubric.bands.every((b) => (t.anchors ?? []).some((a) => a.band === b.band));
  }) };
}

function checkSublevel(spec, file, { isFixture }) {
  if (!isFixture && path.basename(file) !== `${spec.id}.json`) fail(file, `file must be named ${spec.id}.json`);
  const levels = ["A1.1", "A1.2", "A2.1", "A2.2", "B1.1", "B1.2", "B2.1", "B2.2", "B2.3", "C1.1", "C1.2"];
  if (levels[spec.order - 1] !== spec.id) fail(file, `order ${spec.order} does not match id ${spec.id}`);
  if (!spec.id.startsWith(spec.cefrLevel)) fail(file, `cefrLevel ${spec.cefrLevel} does not match id ${spec.id}`);

  const groups = {
    canDo: spec.canDo,
    themes: spec.themes,
    grammar: spec.grammar,
    vocabulary: spec.vocabulary,
    talkScenarios: spec.talkScenarios,
  };
  for (const [name, items] of Object.entries(groups)) {
    for (const dup of duplicates(items.map((x) => x.id))) fail(file, `${name}: duplicate id ${dup}`);
    for (const x of items) {
      if (x.sublevel && x.sublevel !== spec.id) fail(file, `${name}: ${x.id} says sublevel ${x.sublevel}`);
    }
  }
  spec.grammar.forEach((g, i) => {
    if (g.order !== i + 1) fail(file, `grammar: ${g.id} has order ${g.order} at position ${i + 1}`);
  });

  const themes = new Set(spec.themes.map((t) => t.id));
  for (const v of spec.vocabulary) {
    for (const t of v.themes ?? []) if (!themes.has(t)) fail(file, `vocabulary: ${v.id} names unknown theme ${t}`);
  }
  const scenarios = new Set(spec.talkScenarios.map((s) => s.id));
  for (const s of spec.talkScenarios) {
    if (s.theme && !themes.has(s.theme)) fail(file, `talkScenarios: ${s.id} names unknown theme ${s.theme}`);
  }
  if (spec.gate.sublevel !== spec.id) fail(file, `gate: says sublevel ${spec.gate.sublevel}`);
  for (const t of spec.gate.tasks) {
    if (t.talkScenario && !scenarios.has(t.talkScenario)) fail(file, `gate: task ${t.id} names unknown scenario ${t.talkScenario}`);
  }
  const { anchorsComplete } = checkGate(spec.gate, file);
  if (spec.status === "validated" && !anchorsComplete) {
    fail(file, "status is validated but a speaking or writing task lacks anchors for some band");
  }
}

function checkCorrection(item, file, where) {
  const same = item.learnerSentence === item.corrected;
  if (same !== (item.errors.length === 0)) {
    fail(file, `${where}errors must be empty exactly when corrected equals learnerSentence`);
  }
  for (const e of item.errors) {
    if (e.wrong && !item.learnerSentence.includes(e.wrong)) fail(file, `${where}"${e.wrong}" is not in learnerSentence`);
    if (e.right && !item.corrected.includes(e.right)) fail(file, `${where}"${e.right}" is not in corrected`);
    if (!e.wrong && !e.right) fail(file, `${where}an error needs wrong or right`);
  }
  for (const m of item.mustNotFlag ?? []) {
    if (!item.learnerSentence.includes(m)) fail(file, `${where}mustNotFlag "${m}" is not in learnerSentence`);
  }
}

function checkLeveledText(item, file, where) {
  const words = item.text.split(/\s+/).filter((w) => /\p{L}|\p{N}/u.test(w)).length;
  if (words !== item.wordCount) fail(file, `${where}wordCount is ${item.wordCount} but the text has ${words} words`);
  if (!item.id.startsWith(`lt-${item.level.toLowerCase()}-`)) fail(file, `${where}id does not match level ${item.level}`);
  if (item.sublevel && !item.sublevel.startsWith(item.level)) fail(file, `${where}sublevel ${item.sublevel} is not in ${item.level}`);
}

function validateJsonl(name, file, check) {
  const rows = readJsonl(file);
  for (const { line, data } of rows) {
    const where = `line ${line}: `;
    if (validate(name, data, file, where)) check?.(data, file, where);
  }
  for (const dup of duplicates(rows.map((r) => r.data.id))) fail(file, `duplicate id ${dup}`);
  return rows.length;
}

// ---- 3. Fixtures: valid ones pass, invalid ones fail ----------------------
const exampleDir = path.join(schemaDir, "examples");
for (const file of list(exampleDir, ".valid.json")) {
  const name = path.basename(file, ".valid.json");
  const data = readJson(file);
  if (validate(name, data, file) && name === "sublevel") checkSublevel(data, file, { isFixture: true });
}
for (const file of list(exampleDir, ".valid.jsonl")) {
  const name = path.basename(file, ".valid.jsonl");
  validateJsonl(name, file, { "gold-correction": checkCorrection, "leveled-text": checkLeveledText }[name]);
}
for (const file of list(path.join(exampleDir, "invalid"), ".json")) {
  const { schema, why, data } = readJson(file);
  const v = validators[schema];
  checked++;
  if (!v) fail(file, `no schema named ${schema}`);
  else if (v(data)) fail(file, `should be rejected (${why}) but validates`);
}

// ---- 4. Real content, where it exists yet ---------------------------------
const counts = {};
const curriculum = list(path.join(root, "curriculum"), ".json");
for (const file of curriculum) {
  const data = readJson(file);
  if (validate("sublevel", data, file)) checkSublevel(data, file, { isFixture: false });
}
counts.curriculum = curriculum.length;

const gold = path.join(root, "gold");
const goldFiles = [
  ["corrections.jsonl", "gold-correction", checkCorrection],
  ["leveled_texts.jsonl", "leveled-text", checkLeveledText],
  ["talk_scenarios.jsonl", "talk-scenario", undefined],
];
for (const [fileName, name, check] of goldFiles) {
  const file = path.join(gold, fileName);
  counts[fileName] = existsSync(file) ? validateJsonl(name, file, check) : 0;
}
const gates = list(path.join(gold, "gates"), ".json");
for (const file of gates) {
  const data = readJson(file);
  if (validate("gate-test", data, file)) checkGate(data, file);
}
counts["gold/gates"] = gates.length;

// ---- Report ----------------------------------------------------------------
console.log(`Schemas: ${schemaFiles.length}. Checks run: ${checked}.`);
console.log(
  `Content: ${counts.curriculum} sublevel specs, ${counts["corrections.jsonl"]} corrections, ` +
    `${counts["leveled_texts.jsonl"]} leveled texts, ${counts["talk_scenarios.jsonl"]} talk scenarios, ` +
    `${counts["gold/gates"]} standalone gates.`,
);
if (errors.length) {
  console.error(`\n${errors.length} problem(s):`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}
console.log("All valid.");
