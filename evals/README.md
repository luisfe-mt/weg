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
node evals/run.ts --role coach,partner --sample 30    quick check while changing a prompt: shown as a sample, never admits a model
```

Groq's free tier allows, per model, about 8000 tokens a minute, 1000 requests a day and **200,000 tokens a day**. The daily tokens are the real limit: a full run of the gold bank is roughly 300k tokens for the Coach, 1.4M for the Examiner, 0.5M for the Generator and 0.3M for the Partner, so a full run of one role on one model takes one to seven days of free quota.

So every reply is cached in `evals/.cache/` (git-ignored) under a hash of the exact request. When the daily cap stops a run, the run is not recorded; run the same command the next day and it continues from the cache. A prompt change changes the hash, so everything is asked again. The client also keeps a one-minute token window and retries 429 and 5xx with backoff. An invalid reply is retried once, as the gateway does; a second invalid reply counts against the score.

## Files

- `run.ts`: command line. `roles/`: one file per role. `lib/metrics.ts`: the scoring rules, unit-tested in `lib/metrics.test.ts`.
- `results/<role>__<model>__v<version>.json`: summary and every item's parsed output for one full run. Committed, so a score can be audited. Only a full run admits a model to a role.
- `results/samples/…__n<N>.json`: sample runs, shown on the scoreboard for direction only.
- `scoreboard.md`: generated from `results/`. Older prompt versions stay as history.

## Nightly runs

`.github/workflows/nightly-evals.yml` runs every night at 02:17 UTC, and can also be started by hand from the Actions tab. It starts from `main` and restores earlier progress: results from the `eval-scoreboard` branch, and the reply cache from the `eval-cache` branch. It then runs `node evals/run.ts --role partner,generator,coach,examiner --in-order`, so each model spends its daily tokens on those roles in that order and skips the rest once its cap is hit.

Each night it force-pushes two branches:

- `eval-scoreboard`: main plus one commit with `results/` and `scoreboard.md`. It keeps one open pull request, "Eval scoreboard", up to date.
- `eval-cache`: a single commit holding only the cache. It never reaches main.

Nothing is pushed to `main`. A person merges the scoreboard pull request.
