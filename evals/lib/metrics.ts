// Pure scoring rules for the four roles. No I/O, so every rule here is unit-tested.

// ---- Coach -------------------------------------------------------------------

export interface GoldError {
  wrong: string;
  right: string;
}
export interface Flag {
  wrong: string;
  right: string;
}
export interface CoachItemScore {
  flags: number;
  trueFlags: number;
  falseFlags: number;
  /** Gold errors the Coach should have found (at most 3: the prompt limits it to the 3 that matter most). */
  expected: number;
  found: number;
  mustNotFlagHits: string[];
}

const tokens = (s: string): string[] =>
  s
    .toLocaleLowerCase("de")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

/** Character spans of every occurrence of needle in hay. */
function spans(hay: string, needle: string): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  if (!needle) return out;
  for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + 1)) out.push([i, i + needle.length]);
  return out;
}
const overlaps = (a: Array<[number, number]>, b: Array<[number, number]>): boolean =>
  a.some(([s1, e1]) => b.some(([s2, e2]) => s1 < e2 && s2 < e1));

/**
 * Does a flag point at this gold error? It does when the flagged span overlaps the wrong span in the
 * learner sentence, or, for a missing word (gold wrong is empty), when the flag's fix adds the missing word.
 * Position is what counts, not wording: a hint that finds the right spot is a true flag.
 */
export function flagMatches(sentence: string, flag: Flag, gold: GoldError): boolean {
  const flagSpans = spans(sentence, flag.wrong);
  if (gold.wrong) {
    const fw = new Set(tokens(flag.wrong));
    // A flag that quotes the text slightly differently (no exact substring) still names the same words.
    const samePlace = overlaps(flagSpans, spans(sentence, gold.wrong)) || (!flagSpans.length && tokens(gold.wrong).some((w) => fw.has(w) && w.length > 2));
    return samePlace && fixHolds(flag, gold);
  }
  const added = tokens(gold.right);
  const fixed = new Set(tokens(flag.right));
  const before = new Set(tokens(flag.wrong));
  return added.length > 0 && added.every((w) => fixed.has(w) && !before.has(w));
}

/**
 * The flag's fix carries the gold fix: every word of the gold replacement is in it, or, for a word that
 * must go, the fix drops it. A hint at the right spot with a wrong fix teaches the wrong German.
 */
function fixHolds(flag: Flag, gold: GoldError): boolean {
  const fixed = tokens(flag.right);
  if (gold.right) return tokens(gold.right).every((w) => fixed.includes(w));
  const count = (list: string[], w: string) => list.filter((x) => x === w).length;
  return tokens(gold.wrong).some((w) => count(fixed, w) < count(tokens(flag.wrong), w));
}

/**
 * A flag is false when it matches no gold error, and always when it touches a mustNotFlag span:
 * those are the correct-but-odd-looking phrases the gold bank put in to catch over-correction.
 */
export function scoreCoachItem(sentence: string, gold: GoldError[], mustNotFlag: string[], flags: Flag[]): CoachItemScore {
  const found = new Set<number>();
  let trueFlags = 0;
  const mustNotFlagHits: string[] = [];
  for (const flag of flags) {
    // The gold bank decides: a flag on a gold error is true even if it also brushes a protected phrase.
    const hits = gold.flatMap((g, i) => (flagMatches(sentence, flag, g) ? [i] : []));
    if (hits.length) {
      trueFlags++;
      // One flag may fix two neighbouring errors ("habe 24 Jahre" → "bin 24 Jahre alt"); both are found.
      for (const i of hits) found.add(i);
      continue;
    }
    const flagSpans = spans(sentence, flag.wrong);
    mustNotFlagHits.push(...mustNotFlag.filter((m) => overlaps(flagSpans, spans(sentence, m))));
  }
  return {
    flags: flags.length,
    trueFlags,
    falseFlags: flags.length - trueFlags,
    expected: Math.min(gold.length, 3),
    found: Math.min(found.size, 3),
    mustNotFlagHits,
  };
}

export function coachTotals(items: CoachItemScore[]) {
  const flags = items.reduce((s, i) => s + i.flags, 0);
  const trueFlags = items.reduce((s, i) => s + i.trueFlags, 0);
  const expected = items.reduce((s, i) => s + i.expected, 0);
  const found = items.reduce((s, i) => s + i.found, 0);
  return {
    // No flags at all is not precise, it is silent: count it as 0 so a model cannot pass by saying nothing.
    precision: flags ? trueFlags / flags : 0,
    recall: expected ? found / expected : 1,
    flags,
    falseFlags: flags - trueFlags,
    mustNotFlagHits: items.reduce((s, i) => s + i.mustNotFlagHits.length, 0),
  };
}

// ---- Examiner ----------------------------------------------------------------

/** The overall band of an answer: the weighted mean of its criterion bands, rounded half up. */
export function overallBand(criterionBands: Record<string, number>, weights: Record<string, number>): number {
  let sum = 0;
  let total = 0;
  for (const [id, w] of Object.entries(weights)) {
    const b = criterionBands[id];
    if (b === undefined) continue;
    sum += b * w;
    total += w;
  }
  return total ? Math.floor(sum / total + 0.5) : 0;
}

export const EXAMINER_MAX_FALSE_PASS = 0.05;

/**
 * Share of failing anchors the Examiner passes with high confidence. A low-confidence score never
 * passes a gate on its own (a person checks it), so it is not a false pass: marking doubt is the
 * right answer when unsure. An invalid reply gives no score and so no pass.
 */
export function falsePassRate(scored: Array<{ anchor: number; overall: number | undefined; low: boolean }>, passing: Set<number>) {
  const failing = scored.filter((s) => !passing.has(s.anchor));
  const falsePasses = failing.filter((s) => s.overall !== undefined && passing.has(s.overall) && !s.low).length;
  return { failingAnchors: failing.length, falsePasses, rate: failing.length ? falsePasses / failing.length : 0 };
}

// ---- Partner -----------------------------------------------------------------

// Words that are English and never German, so a German turn cannot contain them by accident.
const ENGLISH = new Set([
  "the", "you", "your", "is", "are", "please", "what", "can", "do", "does", "how", "this", "that", "with",
  "it", "of", "to", "and", "for", "my", "me", "have", "yes", "no", "sure", "okay", "sorry", "would", "like",
  "here", "there", "we", "they", "be", "will", "just", "card", "need",
]);
const SPANISH = new Set(["el", "la", "los", "las", "que", "por", "favor", "gracias", "usted", "tú", "eres", "es", "sí", "pero", "muy", "para", "con", "hola"]);

/** Share of words in a turn that are English or Spanish function words. */
export function foreignShare(turn: string): number {
  const w = tokens(turn);
  if (!w.length) return 0;
  return w.filter((x) => ENGLISH.has(x) || SPANISH.has(x)).length / w.length;
}

// Phrases a partner uses when it corrects instead of answering. The Coach gives feedback later.
const CORRECTION = /\b(man sagt|sagt man|heißt es|richtig (?:ist|heißt|wäre)|korrekt (?:ist|wäre)|(?:kleiner|ein) (?:fehler|tipp)|du meinst wohl|sie meinen wohl|nicht .{1,30}, sondern .{1,30} heißt)\b/i;

export function correctsLearner(turn: string): boolean {
  return CORRECTION.test(turn);
}

export function wordCount(turn: string): number {
  return turn.split(/\s+/).filter((w) => /\p{L}|\p{N}/u.test(w)).length;
}

export interface TurnCheck {
  words: number;
  maxWords: number;
  coverage: number;
  foreign: number;
  corrects: boolean;
}
export const PARTNER_MIN_COVERAGE = 0.9;
export const PARTNER_MAX_FOREIGN = 0.15;

/** The reasons a partner turn does not fit the learner's level; empty when it fits. */
export function turnProblems(c: TurnCheck): string[] {
  const out: string[] = [];
  if (c.words > c.maxWords) out.push(`too-long (${c.words}/${c.maxWords})`);
  if (c.coverage < PARTNER_MIN_COVERAGE) out.push(`above-level (${Math.round(c.coverage * 100)}% known)`);
  if (c.foreign > PARTNER_MAX_FOREIGN) out.push("switched-language");
  if (c.corrects) out.push("corrected-learner");
  return out;
}
