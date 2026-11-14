# Weg — Architecture

Status: accepted for v1 · 14 Nov 2026 · decisions are recorded one per file in [adr/](adr/)

Weg is one Tauri 2 desktop program for Windows. The learning logic, the curriculum and the learner's data all live on the laptop; the only thing that leaves it is the text or audio of a single AI request, sent to the provider the learner chose. This document says where each part lives and which rules hold between the parts. Where it disagrees with [north-star.md](north-star.md), the north star wins.

## 1. The shape

```
┌──────────────────────────── Weg.exe (Tauri 2) ─────────────────────────────┐
│                                                                            │
│  WebView2 — React + TypeScript                                             │
│  ┌──────────┐   ┌───────────────┐   ┌───────────────────────────────────┐  │
│  │ screens/ │──▶│ engine/       │──▶│ ports (interfaces)                │  │
│  │ 7 screens│   │ pure TS, no   │   │ Store · AiGateway · Speech ·      │  │
│  │ shadcn/ui│   │ I/O, no React │   │ GrammarCheck · Clock              │  │
│  └──────────┘   └───────────────┘   └───────────────┬───────────────────┘  │
│                                                     │ adapters/            │
│ ───────────────────────── Tauri IPC (capabilities) ─┼───────────────────── │
│                                                     ▼                      │
│  Rust core (src-tauri)                                                     │
│  SQLite (plugin-sql) · key store (Windows Credential Manager) ·            │
│  ai_request (adds the key, calls the provider) · sherpa-onnx (ASR/VAD/TTS) │
│  · recordings and model files on disk                                      │
└───────────────┬──────────────────────────────────────┬─────────────────────┘
                │ HTTPS, only when the learner is online│
                ▼                                      ▼
   OpenAI-compatible provider (Groq free tier,   LanguageTool public API ·
   own key, or a local server)                   Azure pronunciation (own key)
```

Bundled read-only with the installer: `curriculum/*.json` and `prompts/*.md`. Never bundled: speech models, any LLM, any Python.

## 2. Layers and the rule between them

| Layer | Folder | May import | Must not |
| --- | --- | --- | --- |
| Screens | `src/screens/`, `src/components/` | engine, ports (through hooks) | Call `invoke`, SQL or `fetch` directly |
| Engine | `src/engine/` | Only its own files, `ts-fsrs`, types from `src/content/` | Import React, Tauri, adapters, `Date.now()` or `Math.random()` (it takes a `Clock` and a seed) |
| Ports | `src/ports/` | Types only | Contain logic |
| Adapters | `src/adapters/` | Tauri APIs, `openai`, ports | Be imported by the engine |
| Content | `src/content/` | Generated types and loaders for `curriculum/` | Hold content of its own |
| Rust core | `src-tauri/src/` | Tauri plugins, sherpa-onnx, keyring | Hold learning logic |

The dependency direction is one way: screens → engine → ports ← adapters. Because the engine does no I/O and reads time through a port, every rule of the app (what is due, what today's session is, whether a text has 95% coverage, whether a gate is unlocked) is a plain function that a unit test can call.

## 3. The engine

| Module | Responsibility | Key rule from the north star |
| --- | --- | --- |
| `scheduler` | Wraps ts-fsrs. Turns a review answer into the card's next state. | About 10 new cards a day, in frequency order for the sublevel; both directions; a lapse writes to the error log |
| `planner` | Builds today's session: five blocks with minutes each. | One session, one Start button; the learner chooses nothing |
| `ledger` | Counts time on task per skill, per day. Append-only. | "42 of 100 hours"; a gate unlocks at 90% of the budget |
| `coverage` | Lemmatises a German text against the learner's known lemmas. | A generated text is shown only at 95% or more known words; this check is code, not a prompt |
| `errorlog` | Stores tagged errors from SRS lapses, drills, Coach and LanguageTool. | Feeds the remedial week after a failed gate |
| `gate` | Unlocking, timing, scoring from Examiner output, pass rule. | A sublevel ends only when its gate is passed; never skipped |
| `path` | Current sublevel, placement, next step, hours left. | One direction, 11 sublevels |
| `correction` | Merges Coach edits with LanguageTool matches. | Disagreement = "unsure", shown grey; at most three errors shown |

## 4. Data

**Content is data, not code** ([ADR 0006](adr/0006-content-as-json.md)). A sublevel is one JSON file in `curriculum/` that validates against `schemas/sublevel.schema.json`. The gold test bank is JSON Lines in `gold/`. Prompts are Markdown files in `prompts/`, each with a version in its front matter. All three are plain text under version control, reviewed in pull requests and validated in CI.

**Learner state is SQLite** ([ADR 0004](adr/0004-sqlite.md)), one file, `weg.db`, in the app's data folder (`%APPDATA%\io.github.luisfe-mt.weg\`). Tables arrive with the tickets that need them, each as one append-only migration in `src-tauri/migrations/`. The planned set:

| Table | Holds |
| --- | --- |
| `app_meta` | Key-value: install date, placement result, current sublevel, settings that are not secrets |
| `cards` | One row per vocabulary item and direction: FSRS state (due, stability, difficulty, reps, lapses) |
| `reviews` | Append-only log of every answer: card, rating, time, typed or spoken |
| `ledger` | Append-only time on task: day, sublevel, skill, seconds |
| `known_lemmas` | Lemma → status, derived from cards; the coverage checker reads it |
| `error_log` | Tagged errors: source, tag, grammar point, wrong, right, time |
| `texts` | Generated texts with their coverage result, prompt version and model, cached for offline reading |
| `attempts` | Writing and speaking attempts with feedback; path of the audio file, never the audio itself |
| `gate_results` | Per attempt: task scores per criterion, Examiner model and prompt version, low-confidence marks, optional human rating |
| `ai_calls` | One row per provider call: role, model, prompt version, tokens, cost estimate, latency. No request or response bodies |

Ids in content files (`v-…`, `g-…`, `ts-…`, `gate-…`) are stable and are the foreign keys from the database into the curriculum. A content change that alters what is taught raises the sublevel's `specVersion`; the app reconciles stored state against it on start.

**Files on disk.** Recordings (`recordings/`), optional speech models (`models/`) and exports sit next to the database. "Delete all data" removes that folder and the stored keys.

## 5. AI gateway

Every AI capability goes through one port ([ADR 0003](adr/0003-ai-gateway.md)):

```ts
interface AiGateway {
  complete(role: Role, input: RoleInput, opts?: { signal?: AbortSignal }): Promise<RoleOutput>;
  transcribe(audio: Blob, opts: { language: "de" }): Promise<Transcript>;
}
type Role = "partner" | "coach" | "generator" | "examiner";
```

- **One client, any provider.** The `openai` npm package talks to any OpenAI-compatible base URL. A provider is a settings row (base URL, model per role), not code.
- **The key never enters the WebView.** The client is given a custom `fetch` that hands the request to the Rust command `ai_request`; Rust reads the key from the Windows Credential Manager, adds the header, and calls only the base URL saved in settings. The production CSP therefore allows no outbound connection from the WebView at all.
- **Roles, not models.** Callers ask for a role. The gateway picks the model that the eval scoreboard allows in that role, loads the role's prompt by version, and asks for JSON that it validates before returning. Output that fails validation is retried once, then reported as a failure, never shown.
- **Fallback chain.** Rate limit or outage → next allowed model for the role → next provider → a clear "needs a connection" state. The session continues with the blocks that work offline.
- **Budget.** The gateway counts tokens per session and refuses calls beyond the daily cap, so cost per session stays under the north star's bar.
- **Sanitised on the way in.** Every string from a provider passes `sanitizeAiText` in the adapter, before the engine or the database sees it.

Each role has a hard check outside the model:

| Role | The model proposes | Code decides |
| --- | --- | --- |
| Generator | A text on a theme with today's grammar | `coverage` measures known-word share; under 95% → regenerate with the offending words listed, at most three tries, else a cached text |
| Coach | Up to three errors, hint first | `correction` compares with LanguageTool; disagreement → "unsure" |
| Examiner | A band per criterion with a reason and a confidence | `gate` applies weights and the pass rule; low confidence is shown, and a borderline result is never rounded up |
| Partner | The next turn in role | Turn length cap; a level check on the turn's vocabulary before it is spoken |

## 6. Speech

Offline speech runs in the Rust core through sherpa-onnx ([ADR 0002](adr/0002-sherpa-onnx.md)): voice activity detection, German speech-to-text, and German text-to-speech with a Piper voice. Models are downloaded on first use into `models/`, with a checksum, and are never in the installer. Online, Groq Whisper goes through the gateway's `transcribe`. Pronunciation hints come from Azure Pronunciation Assessment when the learner has added their own key; without it, shadowing still works with model audio and the transcript.

Two rules from the north star are enforced in the UI layer: the transcript of what the app heard is always shown before any feedback on it, and pronunciation feedback is a hint about a sound, never a number per sound.

## 7. Security and privacy

| Rule | How it is enforced |
| --- | --- |
| AI output cannot inject markup or script | Plain text only, through `sanitizeAiText`; React text nodes; lint forbids `dangerouslySetInnerHTML` and `innerHTML`; strict CSP with no inline script |
| Keys never in files or in the WebView | Windows Credential Manager through the Rust core; `.env` is for development and evals only and is git-ignored |
| Local data | No telemetry, no accounts, no sync. The only network calls are to the chosen AI provider, LanguageTool, Azure (own key) and model downloads |
| Least privilege | Tauri capabilities list each allowed command; no shell, no general file-system or HTTP access from the WebView |
| The learner sees what is sent | Settings shows, per provider, what a request contains (text or audio of that one task) |
| Practice scores, not certificates | Gate results are always labelled as practice; no screen or export states an official CEFR level |

LanguageTool's public API receives the learner's text. That is disclosed in Settings next to the AI provider, and the offline mode turns it off.

## 8. Quality gates

1. **Unit tests** for every engine module, run on every pull request.
2. **Schema validation** of `curriculum/` and `gold/`, plus the cross-reference checks in `scripts/validate-content.mjs`.
3. **Evals** of the four roles against the gold bank, per model and prompt version, written to `evals/scoreboard.md`. A model may serve a role only if it meets that role's bar; a release that lowers a score below its bar is blocked.
4. **Review** by an agent that did not write the change and cannot edit it.
5. **Licence check** of every new dependency, voice, model and dataset against the allow-list in `CLAUDE.md`.

## 9. Repository layout

```
curriculum/        one JSON file per sublevel (from session F2)
gold/              gold test bank, JSON Lines (F3)
prompts/           one Markdown file per AI role, versioned (F4)
evals/             eval runner, model list, scoreboard (F4)
schemas/           JSON Schemas and their fixtures
scripts/           build-time and validation scripts (Node, no Python)
src/               React app: screens/, components/, engine/, ports/, adapters/, content/, lib/
src-tauri/         Rust core, migrations/, capabilities/
docs/              north star, build plan, this file, adr/
.claude/agents/    the five subagents
.github/workflows/ CI and the Claude workflows
```

## 10. What is built today

The scaffold: the Tauri 2 shell with React, Tailwind and shadcn/ui; SQLite with its first migration; `sanitizeAiText`; the schemas and their validator; tests, lint and CI. Everything in sections 3, 5 and 6 is specified here and not yet written. The folders `src/engine/`, `src/ports/`, `src/adapters/` and `src/content/` are created by the first ticket that needs them.

## 11. Open questions

- **Lemmatiser for the coverage check.** The 95% rule needs German lemmatisation in TypeScript without Python. The plan is a lookup table sliced at build time from Wiktionary data (kaikki.org, CC BY-SA), which must be attributed and kept separable from the MIT code. Its size and accuracy are untested.
- **Streaming through `ai_request`.** Partner turns should start speaking before the full reply arrives. Tauri channels can carry a stream; whether the `openai` client's custom `fetch` can consume it cleanly is untested.
- **sherpa-onnx on a clean Windows machine.** The Rust crate links a prebuilt native library. Installer size and the "no admin, under five minutes" check are unverified until the first speech ticket.
- **Bundle identifier.** `io.github.luisfe-mt.weg` decides the data folder. Changing it after learners have data would orphan that data, so it should be settled before the first public build.
