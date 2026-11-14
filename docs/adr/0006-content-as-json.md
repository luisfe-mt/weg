# ADR 0006 — Content as schema-validated JSON in the repository

Status: accepted · 14 Nov 2026

## Context

The curriculum (11 sublevels), the gold test bank and the prompts are the parts of Weg that must be right and keep their value. They are written by one model, checked by another agent and spot-checked by a German teacher. Free models then produce volume that is graded against them. Every piece needs a known source and licence.

## Decision

- **Curriculum:** one JSON file per sublevel, `curriculum/<id>.json`, valid against `schemas/sublevel.schema.json`. The file contains everything about the sublevel: can-do statements, themes, grammar points in order, the vocabulary band, talk scenarios and the gate.
- **Gold bank:** JSON Lines in `gold/` (`corrections.jsonl`, `leveled_texts.jsonl`, `talk_scenarios.jsonl`), one item per line, each line valid against its schema.
- **Prompts:** one Markdown file per role in `prompts/`, with a version in the front matter.
- **Schemas** are JSON Schema 2020-12 in `schemas/`, with fixtures in `schemas/examples/`. `npm run validate` checks schemas, fixtures and all content, and runs in CI.
- The app bundles `curriculum/` and `prompts/` read-only. The gold bank is for evals and is not shipped.

## Why

- Plain text diffs: a reviewer and a teacher can read a change to one grammar point in a pull request.
- A schema turns "every sublevel complete" (P1) into a CI check.
- Agents write JSON reliably when a schema tells them what is required.
- Stable ids (`v-…`, `g-…`, `ts-…`, `gate-…`) let the database refer to content without copying it.
- Each item can carry its source and licence, which the attribution screen and the licence check read.

## Alternatives rejected

- **Content in the database.** No review, no diff, no validation before it ships.
- **Markdown with front matter for the curriculum.** Pleasant to read, but nested structure (rubrics, anchors, verb forms) is error-prone to parse.
- **A CMS.** A server and accounts; both are non-goals.
- **TypeScript modules.** Type-checked, but then content is code, and non-developers and free models cannot safely edit it.

## Consequences

- JSON Schema cannot express every rule. The cross-reference checks (ids resolve, weights sum to 1, anchors cover every band before a spec is `validated`) are code in `scripts/validate-content.mjs`. Checks that need judgment (no structure used before it is taught, vocabulary matches the frequency band, natural German) belong to the content-validator agent.
- Explanations are plain text in English and Spanish. No Markdown or HTML inside content strings, so nothing in content can become markup on screen.
- A sublevel file may grow to several thousand lines once the full vocabulary band is in. If that hurts review, the vocabulary moves to `curriculum/<id>.vocabulary.jsonl` under the same item schema.
- A change to what is taught or tested raises `specVersion`.
