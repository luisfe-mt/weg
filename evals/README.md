# Evals

`node evals/run.ts` measures each role prompt in `prompts/` against `gold/` on the models in `models.json`, and writes `scoreboard.md`. A model serves a role in the app only when the scoreboard shows it passing that role's bar with the current prompt version (ADR 0003, north star section 7).

| Role | Input from the gold bank | Metric | Bar |
| --- | --- | --- | --- |
| Coach | `gold/corrections.jsonl`, one learner sentence per call | Precision of flags: a flag is true when it points at a gold error; any flag on a correct sentence or a `mustNotFlag` phrase is false. Recall is reported too. | Precision 75% |
| Generator | `gold/leveled_texts.jsonl`: sublevel, text type, theme, grammar and length of each text, never the text | Share of texts at 95% known words or more, by the same coverage code as CI (`scripts/lib/lemma.mjs`), with one gateway retry that names the unknown words | Every text |
| Examiner | Gate anchors in `curriculum/*.json` (the human-scored sample answers) | Overall band (weighted mean of criterion bands) within one band of the anchor | 80% of samples |
| Partner | `gold/talk_scenarios.jsonl`: the scripted learner lines are played one by one | Share of partner turns that fit: within the word limit, 90% known words, in German, no correction of the learner | 90% of turns |

Gold items are test data. They go into the user message of a call as the input under test, never into a prompt file.

## Running

The key comes from `GROQ_API_KEY`, from the environment or the git-ignored `.env`. It is never printed or written.

```
node evals/run.ts                                    full run: every role on every model; updates results/ and scoreboard.md
node evals/run.ts --role coach --model openai/gpt-oss-20b
node evals/run.ts --role coach,partner --sample 30    quick check while changing a prompt: writes .runs/, not the scoreboard
```

Groq's free tier allows about 8000 tokens a minute and 1000 requests a day per model. The client keeps a one-minute token window, retries 429 and 5xx with backoff, and stops a run on a daily cap. A run that stops part-way is not recorded. A full run of all four roles is about 800 calls per model and takes a few hours.

## Files

- `run.ts`: command line. `roles/`: one file per role. `lib/metrics.ts`: the scoring rules, unit-tested in `lib/metrics.test.ts`.
- `results/<role>__<model>__v<version>.json`: summary and every item's parsed output for one full run. Committed, so a score can be audited.
- `scoreboard.md`: generated from `results/`. Older prompt versions stay as history.
