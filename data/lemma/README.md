# data/lemma — word form to base word, and how frequent each base word is

Built by `scripts/build-lemma-data.mjs` (`npm run build:lemma`). Do not edit `de-forms.tsv` or `de-frequency.tsv` by hand; edit the script or `de-closed-class.tsv` and rebuild. The decision and its limits are in `docs/adr/0007-lemma-lookup.md`.

| File | Content | Licence |
| --- | --- | --- |
| `de-forms.tsv` | word form → lemma(s), separated by `\|`, most frequent first | CC BY-SA 4.0 |
| `de-frequency.tsv` | rank, lemma, per million words, parts of speech, noun genders (m, f, n), nominative plurals | CC BY-SA 4.0 |
| `de-closed-class.tsv` | articles, pronouns and determiners with their forms; written for Weg | MIT, like the code |

A lemma that is not in `de-frequency.tsv` has rank 15001 in `curriculum/` ("outside the list").

Look a word up: `npm run lemma -- Wohnung ging`. List a rank window: `npm run lemma -- --band 201 400`.

## Attribution

- **Wiktionary** contributors, German entries of the English Wiktionary, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), as machine-readable data from [kaikki.org](https://kaikki.org/dictionary/German/) (Tatu Ylonen: Wiktextract: Wiktionary as Machine-Readable Structured Data, LREC 2022). Extract of 30 Oct 2026.
- **Leipzig Corpora Collection**, corpora `deu_news_2023_1M` and `deu_mixed-typical_2011_1M`, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). D. Goldhahn, T. Eckart and U. Quasthoff: Building Large Monolingual Dictionaries at the Leipzig Corpora Collection: From 100 to 200 Languages, LREC 2012. https://wortschatz.uni-leipzig.de

The two derived tables combine both sources and are shared under CC BY-SA 4.0. They are data files, kept apart from the MIT-licensed code.
