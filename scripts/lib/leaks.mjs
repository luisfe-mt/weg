// Pure rules of check-leaks.mjs, split out so they can be unit-tested.
//
// Two leaks make a measurement worthless:
//   1. A gold sentence used as curriculum material. gold/ is the yardstick the evals measure
//      against, so a learner who drilled it, or a model tuned on a spec that holds it, scores high
//      for the wrong reason.
//   2. A gate anchor that copies a practice script. The anchor then rewards reciting the script.

/** Lower-case words without punctuation, so "Ich fahre morgen …" and "ich fahre morgen" compare equal. */
export function words(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Sentences of a text, split after . ! ? and at line breaks; dialogue dashes are dropped by words(). */
export function sentences(text) {
  return text
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * The sentences a drill makes the learner read or produce. A gap ("___") is filled with each
 * answer, because the completed sentence is what the learner rehearses.
 */
export function drillSentences(drill) {
  const out = [drill.prompt, ...drill.answers];
  if (drill.prompt.includes("___")) {
    const stem = drill.prompt.replace(/\s*\([^)]*\)\s*$/, "");
    for (const a of drill.answers) out.push(stem.replace(/_{3,}/, a));
  }
  return out;
}

/**
 * Index gold sentences of at least minWords words by their normalised form.
 * Shorter sentences ("Ich habe eine Frage.") are stock phrases every course uses; matching them would
 * forbid ordinary German rather than catch a copy.
 */
export function goldIndex(goldSentences, minWords) {
  const index = new Map();
  for (const { id, text } of goldSentences) {
    for (const s of sentences(text)) {
      const w = words(s);
      if (w.length >= minWords) index.set(w.join(" "), id);
    }
  }
  return index;
}

/** Gold ids whose sentence appears whole in text (as one of its sentences). */
export function goldCopies(text, index) {
  const hits = [];
  for (const s of sentences(text)) {
    const id = index.get(words(s).join(" "));
    if (id) hits.push({ id, sentence: s });
  }
  return hits;
}

/**
 * The text as runs of words with each allowed phrase cut out, so a reviewed formula
 * ("vielen dank für die einladung") cannot make up part of a shared run.
 */
export function cutPhrases(text, phrases) {
  let parts = [words(text)];
  for (const phrase of phrases.map(words)) {
    parts = parts.flatMap((p) => {
      const out = [];
      let start = 0;
      for (let i = 0; i + phrase.length <= p.length; i++) {
        if (phrase.every((w, k) => p[i + k] === w)) {
          out.push(p.slice(start, i));
          start = i + phrase.length;
          i = start - 1;
        }
      }
      out.push(p.slice(start));
      return out.filter((x) => x.length);
    });
  }
  return parts;
}

/** Length of the longest run of consecutive words two texts share, never across an allowed phrase. */
export function longestSharedRun(a, b, allowed = []) {
  let best = 0;
  for (const x of cutPhrases(a, allowed)) for (const y of cutPhrases(b, allowed)) best = Math.max(best, sharedRun(x, y));
  return best;
}

function sharedRun(x, y) {
  let best = 0;
  let prev = new Array(y.length + 1).fill(0);
  for (let i = 1; i <= x.length; i++) {
    const cur = new Array(y.length + 1).fill(0);
    for (let j = 1; j <= y.length; j++) {
      if (x[i - 1] === y[j - 1]) {
        cur[j] = prev[j - 1] + 1;
        if (cur[j] > best) best = cur[j];
      }
    }
    prev = cur;
  }
  return best;
}
