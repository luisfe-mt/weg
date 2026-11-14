# ADR 0005 — ts-fsrs for spaced repetition

Status: accepted · 14 Nov 2026 · not yet implemented

## Context

Wortschatz is 15 to 20 minutes of every session and rests on spaced retrieval. The scheduler decides when each card returns. It must be an algorithm with published evidence, run offline, and let the learner take their cards to Anki.

## Decision

Use `ts-fsrs` (MIT), the TypeScript implementation of FSRS, inside the engine's `scheduler` module. Start with the library's default parameters and a target retention of 0.9. Store each card's FSRS state and the full review log in SQLite.

## Why

- FSRS is the scheduler Anki now ships, with open benchmarks against SM-2.
- Pure TypeScript: runs in the engine, deterministic under test when given a fixed clock.
- Keeping the full review log means parameters can be fitted to the learner later without losing history.

## Alternatives rejected

- **SM-2.** Simpler, but schedules more reviews for the same retention.
- **Writing our own.** The build plan's first rule: if it exists with a permissive licence, use it.
- **Leitner boxes.** No model of forgetting; cannot target a retention.

## Consequences

- `scheduler` is a thin wrapper, so the rules that are Weg's own stay in our code: about 10 new cards a day, frequency order within the sublevel, both directions as separate cards, typed or spoken production on the German side, and a lapse written to the error log.
- How a typed answer maps to an FSRS rating (Again, Hard, Good, Easy) is our decision, not the library's. The first version: wrong = Again; right after a hint or with a wrong article = Hard; right = Good. Easy is not offered. This mapping is a labelled assumption to revisit with real review data.
- Fitting parameters per learner is deferred until there is enough data and a TypeScript optimiser without a Python step.
- Anki export writes notes and, where the format allows, scheduling state.
