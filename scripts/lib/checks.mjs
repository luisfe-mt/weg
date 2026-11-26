// Small pure rules of check-coverage.mjs, split out so they can be unit-tested.

/** The share of the top-N lemmas a sublevel must hold: its own floor if it has one, else the default. */
export function bandFloor(bands, id) {
  return bands.minShareBySublevel?.[id] ?? bands.minShare;
}

/**
 * A plural is accepted if Wiktionary lists it or data/plural-variants.json lists it for this lemma.
 * The slice is incomplete (it lacks the unchanged plural Rettungswagen), so reviewed additions live in Weg's own file.
 */
export function pluralAccepted(plural, lemma, entry, variants) {
  if (entry?.plurals.includes(plural)) return true;
  return variants.some((v) => v.lemma === lemma && v.plurals.includes(plural));
}
