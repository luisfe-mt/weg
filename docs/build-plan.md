# Weg — Build plan (AI-first)

Nov 12, 2026 · @Luis Felipe

## 1. Who does what

You decide and test; AI writes everything else. Fable 5.2 works only on what has to be right and lasts after 16 Nov (curriculum, gold test bank, specs). Opus and Sonnet agents write the code. Free models run inside the app and mass-produce content that is then checked against Fable's tests.

| Who | Does | Your time |
| --- | --- | --- |
| **You** | Approve specs, answer one question at a time, try each build, use the app daily as learner #1, find one German teacher to spot-check | Setup day \~3 h, then 30–45 min a day |
| **Fable 5.2** (until 16 Nov) | Curriculum spine, gold test bank, prompt library + evals, architecture spec, repo CLAUDE.md, agent definitions, ticket backlog | You start each session and approve its output |
| **Opus 5.5 / Sonnet 5.5 in Claude Code** (from 17 Nov) | Build tickets in parallel, one git worktree and one PR each; a separate reviewer agent checks every PR | Read the PR summary, run the build, merge |
| **Claude Code in GitHub Actions** | Runs the reviewer on every PR and answers @claude on issues while you're away | None |
| **Free models in the app** (Groq) | Generate graded texts, drills and sentences in bulk; the eval agent grades them against the gold bank | None |
| **Existing open-source** (section 2) | Everything that already exists: scheduler, speech, grammar check, UI kit, content | None: we wire it in, we don't write it |

**Rule of thumb:** if it exists with a permissive licence, use it; if it must be correct and keep its value, Fable writes it; if it is code, agents write it; if it is volume, free models write it and the gold bank grades it.

## 2. Reuse, don't build

About two-thirds of the app already exists as open-source or free services; we build only the learning engine, the screens and the glue. The biggest finds are sherpa-onnx (offline speech with ready Tauri examples), an open CC BY German course, and Azure's free pronunciation scoring for German.

| Need | Use instead of building | Licence / cost | What we still build |
| --- | --- | --- | --- |
| Offline speech-to-text, voice detection, German TTS | [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx): ships Tauri v2 example apps for offline ASR + VAD from microphone, a German Piper TTS demo, and German ASR models | Apache-2.0, free | Wire its Tauri example into the Talk and Shadowing screens |
| Online speech-to-text (fast, accurate) | Groq Whisper large-v3-turbo via the OpenAI-compatible API | Free tier with daily caps | Nothing: same client as the LLM |
| Pronunciation scoring | [Azure Pronunciation Assessment](https://learn.microsoft.com/azure/ai-services/speech-service/language-support) supports de-DE, scores from phoneme to sentence, on the [free F0 tier of 5 audio hours/month](https://azure.microsoft.com/de-de/pricing/details/speech/) | Free tier; user brings own key | Replaces the experimental wav2vec2 plan; we only show its results |
| Spaced repetition | [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) (FSRS-6) | MIT | Card UI only |
| Grammar checking | [LanguageTool](https://github.com/languagetool-org/languagetool) public API first, local server later | LGPL-2.1+ | The "unsure" comparison with the AI coach |
| A1–A2 course content to adapt | [Deutsch im Blick](https://coerll.utexas.edu/dib/) (UT Austin): 10-chapter first-year German textbook and multimedia program, [CC BY 4.0](https://open.umn.edu/opentextbooks/textbooks/249); plus Boise State's [CC BY grammar companion](https://boisestate.pressbooks.pub/grammardeutschimblickgerm101) | CC BY 4.0, attribution | Fable maps chapters to our sublevels; agents adapt texts and exercises. Check each video's licence before reuse |
| Word frequency | [Leipzig Corpora Collection](https://en.wiktionary.org/wiki/Wiktionary:Frequency_lists) (CC BY 4.0) and [wordfreq](https://github.com/dragon788/wordfreq) (MIT code, CC BY-SA data) | Open | Vocabulary bands per sublevel |
| Dictionary: gender, plural, IPA, inflection | Wiktionary via [wiktextract / kaikki.org](https://github.com/tatuylonen/wiktextract) JSON or [wiktionary-de-parser](https://pypi.org/project/wiktionary-de-parser/) (MIT) | Wiktionary content CC BY-SA | A build-time script to slice what we need |
| Example sentences + some audio | Tatoeba | Text CC BY; audio licence per clip | Filter by licence and level |
| Reading-assistant design | [LinguaCafe](https://www.github.com/simjanos-dev/LinguaCafe) (GPL-3.0) and Lute: proven "click unknown word → card" reading tools | Study them, don't copy code (GPL) | Our own reader, same idea |
| Desktop shell, UI kit | Tauri 2 official template + shadcn/ui components | MIT/Apache | Screens |
| AI client | The `openai` npm package pointed at Groq or any compatible endpoint | Apache-2.0 | The gateway with fallbacks |
| Code review and @claude automation | [Claude Code GitHub Action](https://code.claude.com/docs/en/github-actions), installed with `/install-github-app` | Uses your Claude subscription token | Workflow files (agents write them) |

**Not reused on purpose.** Goethe word lists and Profile Deutsch are copyrighted (use only to cross-check, never ship). DW Nicos Weg is linked, not embedded. XTTS-v2 stays out (non-commercial licence).

## 3. The agent setup

One orchestrator in Claude Code plans each piece of work and hands it to five specialised subagents defined in the repo; every change lands as a pull request that CI and a separate reviewer must pass. Fable is the orchestrator until 16 Nov, Opus 5.5 after.

&#91;embedded content: agent setup · orchestrator, 5 agents, GitHub\]

- **`CLAUDE.md`** at the repo root holds the rules every agent follows: stack, folders, tests, licence allow-list, security.
- **`.claude/agents/`** holds the five agent definitions; **`.claude/commands/next-sprint.md`** starts each week.
- **`docs/north-star.md`** and **`docs/build-plan.md`** are the agents' source of truth; when they disagree with the code, the docs win until you change them.

## 4. Fable sprint, 13–16 Nov

Six Fable sessions in priority order, so that if your Fable usage runs out early, the most valuable assets already exist. Each session runs in Claude Code inside the repo with Fable selected as the model, so everything it writes is committed and survives the 16th. If Claude Code doesn't offer Fable on your plan, run the same prompts in claude.ai and paste the files into the repo.

| # | When | Session | Fable produces (in the repo) | Done when | Your part |
| --- | --- | --- | --- | --- | --- |
| 0 | Fri morning | **Setup** (you + Claude, no Fable needed) | Tools installed, GitHub repo, keys, Claude GitHub App | `npm run tauri dev` opens the template window | \~2–3 h following section 6 |
| F1 | Fri | **Architecture + repo rules** | `docs/ARCHITECTURE.md`, decision records, `CLAUDE.md`, JSON schemas for curriculum and gold bank, `.claude/agents/*.md` (5 agents), scaffold with Tauri + shadcn/ui | Schemas validate; app opens; agents listed by `/agents` | Approve the architecture in one read |
| F2 | Fri–Sat | **Curriculum spine A1.1→B1.2** | One spec file per sublevel, built from the Deutsch im Blick chapter map, Leipzig frequency bands and CEFR can-dos; Fable runs one subagent per sublevel in parallel, a validator checks each | 6 sublevel files pass schema + coverage checks | Read A2.2 closely (it's yours next) |
| F3 | Sat | **Gold test bank** | \~300 learner sentences with corrections and error tags; \~100 level-tagged texts; gate rubrics with 3 anchored samples per band; 20 Talk scenarios | Files validate; counts met | Send 30 sentences to a German teacher or tutor for a spot-check |
| F4 | Sun | **Prompts + evals** | Prompt files for Partner, Coach, Generator, Examiner; an eval script that runs each prompt on Groq models against the gold bank and writes a scoreboard | Scoreboard shows the cheapest model that passes each role | Paste your Groq key once |
| F5 | Sun–Mon | **Backlog + rest of the spine** | \~40 GitHub issues with acceptance tests, labelled by milestone and agent; sublevels B2.1→C1.2 | Issues exist; all 11 sublevels validate | Skim the issue list |
| F6 | Mon | **Vertical slice + handoff** | A2.2 lesson 1 working end to end; `docs/AFTER_FABLE.md` telling Opus/Sonnet exactly how to continue | You complete one real session | Do the session; note what felt wrong |

**How Fable works inside each session.** Fable is the orchestrator: it plans, writes the hard parts itself and fans out routine parts to parallel subagents (each in its own git worktree), then reviews their output against the schemas and tests before committing. You only answer its questions and approve at the end.

## 5. After Fable: the weekly agent loop

From 17 Nov the same machine keeps running with Opus 5.5 as orchestrator and Sonnet 5.5 for routine tickets; your job shrinks to one start, one review and daily use. Every week follows the same rhythm.

1. **Monday, 15 min.** In Claude Code, run the saved command `/next-sprint`: the orchestrator picks the next 5–8 issues from the backlog for the current milestone and posts the plan as a comment. You reply "go" or move one issue.
2. **Monday to Thursday, no time.** Builder agents work the issues in parallel, each in its own worktree, each opening one pull request with tests. The reviewer runs automatically on every PR through the GitHub Action and requests changes when tests, evals, security or licence checks fail.
3. **Daily, 75 min (that's your German).** Use the latest build as learner #1. Anything odd → one line in an issue with `@claude`; the Action turns it into a fix PR.
4. **Friday, 30 min.** Merge the green PRs, run the installer once, and approve the eval scoreboard. The orchestrator updates `docs/STATUS.md` and the milestone.

| Weeks | Milestone | Agents build | Gate (from the North Star) |
| --- | --- | --- | --- |
| 1–2 (17–30 Nov) | Core loop | Session planner, FSRS cards, hours ledger, grammar drills, reader with tap-to-card, Piper TTS via sherpa-onnx, A2.2 content generated + validated | You do an A2.2 session every day |
| 3–4 (1–14 Dec) | Speak + write | Talk screen (Groq Whisper + Partner prompt), shadowing with Azure pronunciation hints, Write screen with Coach + LanguageTool, gate v1 | First A2.2 gate, also rated by a human |
| 5–8 (15 Dec–11 Jan) | Full path + release | Placement test, content for all sublevels, Progress screen, Anki export, Windows installer, offline mode | v1.0 public on GitHub, P1–P8 pass |

**Cost.** Agents run on your Claude subscription through Claude Code and the GitHub Action's subscription token; the app's own AI runs on free tiers. No API bill is needed unless you choose one.

## 6. Your checklist

These are the only things that need your hands, because they involve your accounts, your judgment or your German. Everything else is an agent's job. If a step blocks you, open Claude Code and paste the step: it can walk you through it or do it.

**Setup (Friday morning, about 2–3 hours).**

- [ ] Install on Windows: Git, Node.js 20+, Rust (rustup) and the Visual Studio C++ build tools that Tauri needs, Claude Code.
- [ ] Create the public GitHub repo `weg` (empty, MIT licence) and clone it next to `preis-radar-bremen` on your desktop.
- [ ] In the repo, start Claude Code, switch the model to Fable, run `/install-github-app`, and choose the subscription token (`claude setup-token`) so the GitHub Action runs on your plan.
- [ ] Create a free Groq account and an API key; store it as a GitHub secret and in your local `.env` (never committed).
- [ ] Optional now, needed by week 3: a free Azure account with a Speech resource on the F0 tier.

**During the Fable sprint.**

- [ ] Start each session F1–F6 with its prompt from section 7.
- [ ] Approve the architecture (F1) and read the A2.2 spec closely (F2).
- [ ] Ask one German teacher or tutor to check 30 gold sentences (F3); a Constructor University German lecturer or a tandem partner is fine.

**Every week after.**

- [ ] Monday: `/next-sprint`, then "go".
- [ ] Daily: one real session as learner #1; log oddities as issues.
- [ ] Friday: merge green PRs, run the installer, approve the scoreboard.
- [ ] Once a month: record a mock speaking sample and get a human rating.

**Rule.** If building time in a week exceeds your German study time, the plan is off track: cut scope, not study.

## 7. Ready-to-paste prompts

Paste each prompt as the first message of its session in Claude Code, with Fable selected and the repo open. Before F1, save the North Star doc and this build plan as `docs/north-star.md` and `docs/build-plan.md` in the repo (export each as Markdown), because every prompt points to them.

**F1 — Architecture and repo rules**

```text
Read docs/north-star.md and docs/build-plan.md. You are the lead architect of Weg, a Tauri 2 + React + TypeScript desktop app (Windows first) that teaches German A1.1 to C1.2.
Produce, then commit:
1) docs/ARCHITECTURE.md and docs/adr/*.md (one decision per file: Tauri, sherpa-onnx, AI gateway, SQLite, ts-fsrs, content-as-JSON).
2) CLAUDE.md for this repo: stack, folder layout, commands, coding rules, test rules, licence allow-list, security rules (sanitize all AI output), and "never add a Python runtime or bundled LLM to the installer".
3) JSON Schemas in schemas/ for: sublevel spec, vocabulary item, grammar point, gate test, gold correction item, level-tagged text, talk scenario.
4) Subagents in .claude/agents/: curriculum-writer, content-validator, builder, eval-runner, reviewer (reviewer never edits code, only reports).
5) Scaffold the app from the official Tauri 2 React-TS template with shadcn/ui, SQLite plugin, a test runner, lint, and a GitHub Actions CI (build + test + schema validation) plus the Claude review workflow.
Ask me at most 3 questions, one at a time. Stop when `npm run tauri dev` opens and CI passes.
```

**F2 — Curriculum spine A1.1 to B1.2**

```text
Using schemas/sublevel.schema.json, write curriculum/A1.1.json … curriculum/B1.2.json (6 files).
Sources you may use: CEFR can-do descriptors (paraphrased), Deutsch im Blick (CC BY 4.0, cite chapters), Leipzig Corpora frequency lists (CC BY 4.0) for vocabulary bands. Never copy Goethe or Profile Deutsch lists.
Each sublevel: hours budget, 8–15 can-do statements for international students in Germany, ordered grammar points with explanation, examples and typical Spanish/English-speaker errors, vocabulary band (lemma, article, plural, frequency rank), 6–10 themes, talk scenarios, and a gate test with rubric and 3 anchored samples per band.
Run one curriculum-writer subagent per sublevel in parallel; then have content-validator check schema, frequency coverage and progression (no structure used before it is taught). Fix and commit. Report gaps you could not fill.
```

**F3 — Gold test bank**

```text
Build gold/ following the schemas:
- corrections.jsonl: 300 realistic learner sentences (A1–B2, written as Spanish and English speakers err), each with a minimal correct version, error tags and a one-line rule.
- leveled_texts.jsonl: 100 original texts, 20 per level A1–C1, with level and reasoning.
- gate anchors for every sublevel already in curriculum/.
- talk_scenarios.jsonl: 20 scenarios with expected partner behaviour and failure examples.
All content original. Mark 30 corrections as `needs_human_check` for a teacher.
```

**F4 — Prompts and evals**

```text
Write prompts/partner.md, coach.md, generator.md, examiner.md following the AI behaviour rules in docs/north-star.md section 7.
Write evals/run.ts: runs each prompt against gold/ on the models in evals/models.json (Groq free models; read GROQ_API_KEY from env), computes precision for coach, coverage for generator, band agreement for examiner, level-fit for partner, and writes evals/scoreboard.md.
Run it, iterate on the prompts until each role passes its bar on at least one free model, commit the scoreboard.
```

**F5 — Backlog and rest of the spine**

```text
1) Write curriculum/B2.1.json … C1.2.json the same way as F2.
2) Create ~40 GitHub issues (gh CLI) for milestones Core loop, Speak + write, Full path + release, each with: goal, acceptance tests, files touched, agent label (builder/content), and links to the North Star. Order them so each week's set can run in parallel without conflicts.
3) Create the saved command .claude/commands/next-sprint.md that picks the next 5–8 open issues of the current milestone and posts the plan.
```

**F6 — Vertical slice and handoff**

```text
Implement A2.2 lesson 1 end to end (SRS 10 cards, today's grammar, a generated text at ≥95% coverage, shadowing with sherpa-onnx Piper TTS, a short write task with coach + LanguageTool), using only the backlog's architecture. Then write docs/AFTER_FABLE.md: current state, how to run the weekly loop with Opus/Sonnet, known gaps, and the next 3 issues.
```

## 8. Risks and fallbacks

The two risks that matter most are running out of Fable before the spine and gold bank exist, and building eating your study time; the plan's order and the weekly rule handle both.

| Risk | Fallback |
| --- | --- |
| Fable usage runs out early | Sessions are in priority order; F5 and F6 move to Opus 5.5 with the same prompts |
| Fable not selectable in Claude Code on your plan | Run F1–F5 prompts in claude.ai with Fable, paste output files into the repo, let Opus in Claude Code commit and validate |
| Preis-Radar also needs the Fable window | Your decision; if split, keep F2 + F3 for Weg (they can't be redone cheaply) |
| GitHub Action subscription token fails (known auth issues reported) | Use Claude Code locally for reviews; or a small API key for the Action only |
| Subscription token used for anything other than your own dev work | Never: the app's users run on free tiers or their own keys, never on your Claude token |
| Groq free limits change | Gateway switches to another OpenAI-compatible provider or the user's own key; sherpa-onnx covers speech offline |
| Azure free tier not available to you | Skip pronunciation scores; keep shadowing with TTS model audio and ASR transcript |
| Agents produce code nobody can follow | Small PRs, reviewer agent, tests required, `CLAUDE.md` rules; Opus explains any file on request |
| Content licence mistake | Licence allow-list in `CLAUDE.md`; reviewer checks every new asset's source |
| Residence status | Free and unpaid only; before any income the Migrationsamt must change the self-employment condition |

## 9. Sources

- [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) and its [Tauri examples overview](https://docsearch.algolia.com/mcp/docs/repo/k2-fsa/sherpa-onnx)
- [Azure Speech language support (pronunciation assessment, de-DE)](https://learn.microsoft.com/azure/ai-services/speech-service/language-support) · [Azure Speech pricing, free F0 tier](https://azure.microsoft.com/de-de/pricing/details/speech/)
- [Deutsch im Blick, Open Textbook Library (CC BY)](https://open.umn.edu/opentextbooks/textbooks/249) · [Deutsch im Blick site](https://coerll.utexas.edu/dib/) · [Grammar to Accompany Deutsch im Blick (CC BY 4.0)](https://boisestate.pressbooks.pub/grammardeutschimblickgerm101)
- [Wiktionary frequency lists (Leipzig CC BY 4.0)](https://en.wiktionary.org/wiki/Wiktionary:Frequency_lists) · [wordfreq](https://github.com/dragon788/wordfreq)
- [wiktextract / kaikki.org](https://github.com/tatuylonen/wiktextract) · [wiktionary-de-parser](https://pypi.org/project/wiktionary-de-parser/)
- [LinguaCafe](https://www.github.com/simjanos-dev/LinguaCafe)
- [Claude Code GitHub Actions docs](https://code.claude.com/docs/en/github-actions) · [reported subscription-token auth issue](https://github.com/anthropics/claude-code-action/issues/1281)
- Licences and figures for ts-fsrs, LanguageTool, Groq limits, Piper and XTTS: see the verified Storm Research briefing.
