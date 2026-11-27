// Loads what the evals read: gold/, curriculum/, prompts/ and the lemma tables.
// Gold files are test data only. Their items go into the user message of a call, as the learner
// input under test, and never into a prompt file.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { candidates, loadLemmaData, tokenize, type LemmaData } from "../../scripts/lib/lemma.mjs";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const LEVELS = ["A1.1", "A1.2", "A2.1", "A2.2", "B1.1", "B1.2", "B2.1", "B2.2", "B2.3", "C1.1", "C1.2"] as const;

const readJsonl = <T>(file: string): T[] =>
  readFileSync(path.join(root, file), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as T);

export interface Explanation {
  en: string;
  es: string;
}
export interface GoldCorrection {
  id: string;
  level: string;
  l1: "en" | "es";
  learnerSentence: string;
  corrected: string;
  errors: Array<{ tag: string; wrong: string; right: string; rule: Explanation }>;
  mustNotFlag?: string[];
}
export interface GoldScenario {
  id: string;
  sublevel: string;
  title: Explanation;
  situation: Explanation;
  learnerRole: string;
  partnerRole: string;
  register: "du" | "Sie";
  partnerOpening: string;
  partnerFacts: string[];
  targetGrammar: string[];
  limits: { maxPartnerWordsPerTurn: number; maxTurns: number };
  script: Array<{ learner: string; expect: string }>;
}
export interface GoldText {
  id: string;
  level: string;
  sublevel?: string;
  textType: string;
  theme: string;
  wordCount: number;
  features: string[];
}
export interface Rubric {
  id: string;
  skill: string;
  bands: Array<{ band: number; label: string; passing: boolean }>;
  criteria: Array<{ id: string; weight: number; descriptors: Array<{ band: number; descriptor: string }> }>;
}
export interface GateTask {
  id: string;
  skill: string;
  format: string;
  instructions: string;
  wordCount?: { min: number; max: number };
  talkScenario?: string;
  rubricId?: string;
  anchors?: Array<{ band: number; samples: Array<{ response: string; criterionBands: Record<string, number>; rationale: string }> }>;
}
export interface Spec {
  id: string;
  cefrLevel: string;
  themes: Array<{ id: string; title: Explanation & { de?: string } }>;
  grammar: Array<{ id: string; title: Explanation & { de?: string } }>;
  vocabulary: Array<{ lemma: string; themes?: string[] }>;
  talkScenarios: Array<{ id: string; situation: Explanation }>;
  gate: { tasks: GateTask[]; rubrics: Rubric[] };
}

export const gold = {
  corrections: () => readJsonl<GoldCorrection>("gold/corrections.jsonl"),
  scenarios: () => readJsonl<GoldScenario>("gold/talk_scenarios.jsonl"),
  texts: () => readJsonl<GoldText>("gold/leveled_texts.jsonl"),
};

export function loadSpecs(): Map<string, Spec> {
  const specs = new Map<string, Spec>();
  for (const f of readdirSync(path.join(root, "curriculum")).filter((x) => x.endsWith(".json"))) {
    const spec = JSON.parse(readFileSync(path.join(root, "curriculum", f), "utf8")) as Spec;
    specs.set(spec.id, spec);
  }
  return specs;
}

/** A prompt file: front matter (role, version) and the system prompt body. */
export interface Prompt {
  role: string;
  version: string;
  system: string;
}
export function loadPrompt(role: string): Prompt {
  const text = readFileSync(path.join(root, "prompts", `${role}.md`), "utf8").replace(/\r\n/g, "\n");
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  if (!m) throw new Error(`prompts/${role}.md has no front matter`);
  const version = /^version:\s*(\S+)/m.exec(m[1]!)?.[1];
  if (!version) throw new Error(`prompts/${role}.md has no version`);
  return { role, version, system: m[2]!.trim() };
}

let lemmaData: LemmaData | undefined;
export const lemmas = (): LemmaData => (lemmaData ??= loadLemmaData());

/**
 * The lemmas a learner knows at the end of a sublevel: every vocabulary item up to it, and the words
 * inside taught phrases. The same rule as scripts/check-coverage.mjs, so the evals and CI agree.
 */
export function knownThrough(sublevel: string, specs: Map<string, Spec>): Set<string> {
  const known = new Set<string>();
  const data = lemmas();
  for (const id of LEVELS) {
    const spec = specs.get(id);
    for (const v of spec?.vocabulary ?? []) {
      if (!/\s/.test(v.lemma)) known.add(v.lemma);
      else for (const s of tokenize(v.lemma)) for (const w of s) for (const c of [w, ...candidates(w, data, { sentenceInitial: true })]) known.add(c);
    }
    if (id === sublevel) break;
  }
  return known;
}

/** Deterministic sample: every k-th item, so a sample run spreads over all levels the way the file does. */
export function sample<T>(items: T[], n: number | undefined): T[] {
  if (!n || n >= items.length) return items;
  const step = items.length / n;
  return Array.from({ length: n }, (_, i) => items[Math.floor(i * step)]!);
}
