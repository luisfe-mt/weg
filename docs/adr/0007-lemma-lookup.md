# ADR 0007 — Lemma lookup as build-time tables from Wiktionary and Leipzig

Status: proposed · 14 Nov 2026 · awaits LuisFe's approval with the F2 pull request

## Context

Two rules of the north star need to know which base word (lemma) a word form belongs to:

- **The 95% rule (P3).** A generated text is shown only if 95% of its words are known to the learner. The learner knows lemmas (`gehen`); a text contains forms (`ging`, `gegangen`).
- **Vocabulary bands.** Each sublevel teaches words "in frequency order". Published frequency lists count forms, so `ist`, `war` and `sind` are three entries and `sein` has none.

The installed app has no Python (hard rule) and must work offline, so spaCy, a server or a model download are out. ARCHITECTURE section 11 left this as an open question.

## Decision

A Node script, `scripts/build-lemma-data.mjs`, builds two plain tables at build time. They are committed in `data/lemma/` and are the whole lemmatiser: a lookup, no rules engine, no model.

| File | Holds | Size |
| --- | --- | --- |
| `de-forms.tsv` | word form → lemma or lemmas (`ging → gehen`, `gehört → gehören\|hören`) for every form of a ranked lemma | about 94,000 lines, 2 MB |
| `de-frequency.tsv` | rank, lemma, occurrences per million, parts of speech, noun genders, plurals, for the 15,000 most frequent lemmas | 0.5 MB |
| `de-closed-class.tsv` | articles, pronouns and determiners with their forms, written by hand | 35 lines |

**Inputs, pinned by checksum in the script.**

- Forms: the German entries of English Wiktionary as extracted by kaikki.org (wiktextract), CC BY-SA.
- Counts: two Leipzig Corpora Collection corpora of one million sentences each, CC BY: `deu_news_2023_1M` and `deu_mixed-typical_2011_1M`, averaged per million words.

**How a count reaches a lemma.**

1. Tokens are counted from the corpus sentences. The first word of a sentence is shared between its capitalised and lower-case spelling in the proportion the rest of the corpus shows, so sentence-initial `Ich` does not become the noun `das Ich`.
2. A form in the hand-written closed-class table belongs to that lemma only. Wiktionary's pronoun tables link every person to every other, which made `ihr` and `das` absorb most pronouns.
3. A capitalised form that is itself a noun lemma stays that noun (`Essen`). A lower-case form that is itself an uninflected word stays that word (`schon`, not `schonen`).
4. Any other ambiguous form is shared between its lemmas in proportion to their unambiguous evidence (`gehört` between `gehören` and `hören`).

**How the tables are read** (`scripts/lib/lemma.mjs` now; the engine's `coverage` module later, by the same three rules): look the token up in the forms table; if absent, it is its own lemma when the frequency table has it; at the start of a sentence also try the lower-case spelling. A token counts as known if any of its lemmas is known. The lookup is lenient on purpose: a wrong "unknown" costs a regeneration, a wrong "known" costs one tappable word.

**What checks use it today.** `scripts/check-coverage.mjs`, part of `npm run validate` and CI: every vocabulary item's `frequencyRank` equals the table; noun article and plural agree with Wiktionary; no lemma is taught twice; the German text of each sublevel spec is at least 95% words taught so far; and the vocabulary taught by the end of a sublevel holds at least 80% of the most frequent lemmas up to that sublevel's rank (`data/frequency-bands.json`).

## Why

- A lookup table is the only lemmatiser that is trivially the same in Node (build, validation) and in the WebView (engine), needs no native code and no download, and can be unit-tested with a ten-line fixture.
- German inflection is mostly listable: Wiktionary has full tables for the common words, which are the ones a learner up to C1 meets.
- Building our own lemma frequency list removes the need to copy anyone's word list; Goethe and Profile Deutsch lists are not used.
- 2.5 MB of text is small next to the speech models and adds nothing to install time.

## Alternatives rejected

- **spaCy or another Python lemmatiser at run time.** Breaks the no-Python rule. At build time it would only pre-compute a table like this one, with a heavier toolchain.
- **Rule-based stemming** (Snowball, MIT). Conflates different words and cannot map `ging` to `gehen`.
- **Asking the AI provider to lemmatise.** The 95% rule must be code, offline and deterministic.
- **wordfreq's ready lists.** Form counts again, and the data licence mixes sources that need per-source review.
- **One corpus.** News alone ranks `Prozent` and `Polizei` in the top 150 and has little everyday speech. The "typical sentences" corpus alone contains almost no subordinate clauses (`weil` barely occurs). The average of the two is still news-heavy; see consequences.
- **German Wiktionary instead of English Wiktionary.** Comparable coverage; the English edition's extract has cleaner form tables in kaikki.org's output. Can be revisited.

## Consequences

- **Licence.** `de-forms.tsv` and `de-frequency.tsv` are derived from Wiktionary and are CC BY-SA 4.0, with attribution in `data/lemma/README.md`. They stay data files apart from the MIT code and are never inlined into source. The attribution screen must name Wiktionary, kaikki.org and the Leipzig Corpora Collection.
- **No word-class disambiguation.** The lookup works on spelling. `sein` the verb and `sein` the possessive share one rank; a learner who knows either is counted as knowing both. Accepted for a coverage estimate.
- **Ranks lean towards written news language.** Everyday words rank low (`danke` about 3,700, `Brot` about 3,700). A vocabulary band is therefore frequency plus theme words, and the frequency floor is 80%, not 100%. A spoken corpus with an open licence (for example OpenSubtitles-based counts) would improve this and needs a licence check first.
- **Compounds** that Wiktionary lacks have no forms and no rank. A vocabulary item for one gets `frequencyRank` 15001, meaning "outside the list". The coverage check accepts a taught compound with a common ending and reports unknown capitalised words separately, because it cannot tell a name from an untaught compound.
- **Separable verbs** are joined when the prefix stands later in the same sentence (`rufe … an` → `anrufen`). Clause boundaries are not parsed.
- **Accuracy is measured only by hand so far**: spot checks of about 100 frequent forms. The engine ticket for `coverage` should add a gold set of sentences with expected lemmas before the 95% rule gates real texts.
- **Updating** means downloading the three archives into `.cache/`, running `npm run build:lemma`, reviewing the diff of the tables, and updating the checksums. A changed rank changes `frequencyRank` values in `curriculum/`, so an update is its own pull request.
- The engine port that serves these tables to the WebView is a later ticket; the files and the three reading rules above are its contract.
