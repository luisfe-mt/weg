// Types for lemma.mjs, so TypeScript callers (evals/) can use it without @ts-expect-error.
export interface LemmaEntry {
  rank: number;
  perMillion: number;
  pos: string[];
  genders: string[];
  plurals: string[];
}
export interface LemmaData {
  lemmas: Map<string, LemmaEntry>;
  forms: Map<string, string[]>;
}
export interface Coverage {
  tokens: number;
  knownTokens: number;
  unknown: string[];
  names: string[];
}
export const UNRANKED: number;
export function loadLemmaData(dir?: string): LemmaData;
export function tokenize(text: string): string[][];
export function candidates(token: string, data: LemmaData, options?: { sentenceInitial?: boolean }): string[];
export function rankOf(lemma: string, data: LemmaData): number;
export function coverage(text: string, known: Set<string>, data: LemmaData): Coverage;
