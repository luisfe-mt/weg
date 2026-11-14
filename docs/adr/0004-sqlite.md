# ADR 0004 — SQLite for learner state

Status: accepted · 14 Nov 2026

## Context

Progress and recordings stay on the laptop (hard rule 3). The app keeps card states, a review log, time on task, an error log, cached texts and gate results. One learner at B1 has a few thousand cards and tens of thousands of reviews. The learner must be able to export everything and delete everything.

## Decision

One SQLite file, `weg.db`, in the app's data folder, accessed through `tauri-plugin-sql`. Schema changes are numbered, append-only migrations in `src-tauri/migrations/`, registered in `src-tauri/src/lib.rs` and applied when the database is opened. Tables use `STRICT`. The review log and the hours ledger are append-only.

All SQL lives in the `Store` adapter. Screens and the engine see typed functions, never SQL.

## Why

- Queries the app needs every day ("cards due now", "hours per skill this week", "most frequent error tags") are one line of SQL and awkward over flat files.
- One file is easy to back up, export and delete.
- Transactions protect the review log if the app is closed mid-session.
- Public domain engine; the plugin is MIT / Apache-2.0.

## Alternatives rejected

- **JSON files.** Fine for content (ADR 0006), fragile for state that changes on every answer.
- **IndexedDB in the WebView.** Tied to the WebView profile, harder to export or inspect, and can be cleared with browser data.
- **SQL written in Rust commands with `rusqlite`.** More control, but every query would need a Rust command and a TypeScript binding. Worth revisiting only if a query proves too slow or needs a transaction that spans several statements with logic between them.

## Consequences

- The capability file grants the WebView `sql:allow-execute`. That is acceptable because the WebView runs only our bundled code under a strict CSP, and no text from an AI or a learner is ever concatenated into SQL: parameters are always bound.
- A shipped migration is never edited. A mistake is fixed by the next migration.
- Content is not copied into the database. Rows refer to curriculum ids; the sublevel's `specVersion` tells the app when to reconcile.
- No encryption at rest in v1. The file is protected by the Windows user account, and Settings says so.
