// Word form -> base word lookup over the tables in data/lemma/ (ADR 0007).
// Pure functions over loaded tables, so the app's coverage engine can follow
// the same rules in TypeScript: the tables are the contract, not this file.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "lemma");

/** A lemma the frequency list does not hold gets this rank in a vocabulary item. */
export const UNRANKED = 15001;

// Prefixes a separable verb leaves at the end of the clause: "Ich rufe dich an."
const SEPARABLE_PREFIXES = new Set([
  "ab", "an", "auf", "aus", "bei", "ein", "fest", "her", "hin", "los", "mit", "nach", "statt", "teil",
  "um", "vor", "weg", "weiter", "zu", "zurück", "zusammen", "vorbei", "heraus", "herein", "hinaus",
  "hinein", "herunter", "hinunter", "kennen", "spazieren", "statt", "fern", "frei", "hoch", "rein", "raus",
]);
// Endings tried on a taught word Wiktionary has no table for (a new compound).
const ENDINGS = ["ern", "en", "es", "er", "se", "e", "n", "s"];

const lower = (w) => w.toLocaleLowerCase("de");
const isCapitalised = (w) => w[0] !== lower(w[0]);

export function parseFrequency(tsv) {
  const lemmas = new Map();
  for (const line of tsv.split(/\r?\n/).slice(1)) {
    if (!line) continue;
    const [rank, lemma, perMillion, pos, genders, plurals] = line.split("\t");
    lemmas.set(lemma, {
      rank: Number(rank),
      perMillion: Number(perMillion),
      pos: pos.split(","),
      genders: genders ? genders.split(",") : [],
      plurals: plurals ? plurals.split(",") : [],
    });
  }
  return lemmas;
}

export function parseForms(tsv) {
  const forms = new Map();
  for (const line of tsv.split(/\r?\n/).slice(1)) {
    if (!line) continue;
    const [form, lemmas] = line.split("\t");
    forms.set(form, lemmas.split("|"));
  }
  return forms;
}

export function loadLemmaData(dir = dataDir) {
  return {
    lemmas: parseFrequency(readFileSync(path.join(dir, "de-frequency.tsv"), "utf8")),
    forms: parseForms(readFileSync(path.join(dir, "de-forms.tsv"), "utf8")),
  };
}

/** Splits German text into sentences of word tokens. Digits and punctuation are dropped. */
export function tokenize(text) {
  return text
    .split(/[.!?:;…\n]+|_{2,}/u)
    .map((s) => s.match(/\p{L}+(?:-\p{L}+)*/gu) ?? [])
    .filter((s) => s.length > 0);
}

/**
 * Base words a token may belong to. The forms table lists a form's lemmas in
 * full (itself included when it is one); a word absent from it is a lemma or unknown.
 * At the start of a sentence the capital tells nothing, so both spellings count.
 */
export function candidates(token, data, { sentenceInitial = false } = {}) {
  const exact = data.forms.get(token) ?? (data.lemmas.has(token) ? [token] : []);
  if (!isCapitalised(token)) return exact;
  if (exact.length > 0 && !sentenceInitial) return exact;
  const low = lower(token);
  const down = data.forms.get(low) ?? (data.lemmas.has(low) ? [low] : []);
  return [...new Set([...exact, ...down])];
}

/** Rank of a vocabulary lemma, or UNRANKED. "Sie" falls back to "sie". */
export function rankOf(lemma, data) {
  return (data.lemmas.get(lemma) ?? data.lemmas.get(lower(lemma)))?.rank ?? UNRANKED;
}

/**
 * Share of the word tokens of `text` whose base word is in `known` (a Set of lemmas).
 * Returns the unknown words too. A capitalised word no table knows is taken
 * for a name and left out of the count, unless it ends in a known noun
 * (Semesterticket), which makes it an untaught compound.
 */
export function coverage(text, known, data) {
  const result = { tokens: 0, knownTokens: 0, unknown: [], names: [] };
  for (const sentence of tokenize(text)) {
    sentence.forEach((token, i) => {
      const cands = candidates(token, data, { sentenceInitial: i === 0 });
      const low = lower(token);
      const isKnown =
        known.has(token) ||
        known.has(low) ||
        cands.some((c) => known.has(c)) ||
        // "rufe ... an" -> anrufen
        sentence.slice(i + 1).some((p) => SEPARABLE_PREFIXES.has(p) && cands.some((c) => known.has(p + c))) ||
        ENDINGS.some((e) => token.endsWith(e) && known.has(token.slice(0, -e.length)));
      if (!isKnown && cands.length === 0 && isCapitalised(token) && !endsInNoun(token, data)) {
        result.names.push(token);
        return;
      }
      result.tokens++;
      if (isKnown) result.knownTokens++;
      else result.unknown.push(cands[0] ?? token);
    });
  }
  return result;
}

function endsInNoun(token, data) {
  for (let cut = 3; cut <= token.length - 5; cut++) {
    const tail = token[cut].toLocaleUpperCase("de") + token.slice(cut + 1);
    if (data.lemmas.get(tail)?.pos.includes("noun")) return true;
  }
  return false;
}
