# ADR 0003 — One AI gateway, addressed by role

Status: accepted · 14 Nov 2026 · not yet implemented

## Context

Weg uses AI in four roles (Partner, Coach, Generator, Examiner), each with written rules and an eval bar. It runs on free tiers that can change or vanish, on a learner's own key, or on a local server. A session must cost nothing on free tiers and under 0.10 EUR on a paid key (P6). Keys must never be stored in files.

## Decision

1. **One port.** All AI calls go through `AiGateway` (`complete(role, input)` and `transcribe(audio)`). No screen or engine module names a provider or a model.
2. **One client.** The `openai` npm package, pointed at any OpenAI-compatible base URL. Groq's free tier is the default. A provider is configuration.
3. **Keys stay in Rust.** The client gets a custom `fetch` that forwards the request to the Rust command `ai_request`. Rust reads the key from the Windows Credential Manager, adds the authorisation header, and calls only the base URL saved in settings. The WebView never holds a key and its CSP allows no outbound connections.
4. **Models are admitted by eval.** `evals/scoreboard.md` records, per role, which model and prompt version meet the bar. The gateway serves a role only with an admitted pair, cheapest first.
5. **Structured output, validated.** Each role returns JSON checked against a schema, then sanitised. Invalid output is retried once and otherwise reported as a failure.
6. **Fallbacks and budget.** On rate limit or outage: next admitted model, then next provider, then an explicit offline state. A per-day token cap stops runaway cost.

## Why

- A free tier that disappears costs a settings change, not a rewrite.
- "A cheaper model replaces a better one only if it passes the same test" becomes a mechanism instead of a promise.
- Keeping the key out of the WebView means an injection bug in rendered AI text cannot read it.

## Alternatives rejected

- **Calling the provider from the WebView.** Simplest, but puts the key in JavaScript and forces the CSP open to arbitrary hosts.
- **A provider SDK per vendor.** More code for no gain while every target speaks the OpenAI wire format.
- **A hosted proxy of our own.** Needs accounts and a server, and would put the author's key or money between the learner and the provider. Excluded by hard rules 1 and 3.
- **A bundled local LLM.** A v1 non-goal. A local OpenAI-compatible server the learner runs themselves is just another base URL.

## Consequences

- Rust carries a small HTTP forwarder. Streaming through it (Tauri channels) is unproven and is the first thing the gateway ticket must settle.
- Azure pronunciation assessment and LanguageTool are not OpenAI-compatible; they get their own small ports (`Speech`, `GrammarCheck`) under the same key and sanitising rules.
- The author's Claude subscription is for building Weg only. Nothing in the app ever calls it.
