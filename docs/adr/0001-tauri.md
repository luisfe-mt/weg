# ADR 0001 — Tauri 2 as the desktop shell

Status: accepted · 14 Nov 2026

## Context

Weg must install on a fresh Windows 11 laptop without admin rights and reach a first session in under five minutes (north star P8). It needs a rich UI, a local database, a microphone, native speech libraries and the OS credential store. It is written almost entirely by AI agents, so the stack should be mainstream and well documented.

## Decision

Tauri 2 with a React + TypeScript front end, started from the official `create-tauri-app` React-TS template. The UI runs in the system WebView2; a small Rust core holds what the WebView must not: database access, keys, provider calls, speech.

## Why

- Small installer: the WebView is part of Windows 11, so the app ships without a browser engine.
- A real security boundary: capabilities list exactly which native commands the WebView may call.
- Rust gives direct access to sherpa-onnx and the Windows Credential Manager without a side process.
- MIT / Apache-2.0.

## Alternatives rejected

- **Electron.** Mature, but ships Chromium and Node (an installer several times larger) and leaves the security boundary to discipline.
- **A web app.** No offline speech, no local-only data without extra work, and "web app" is a v1 non-goal.
- **Native (WinUI, Qt).** Far less UI code available for agents to build on; slower to change.

## Consequences

- Two languages. Rust stays thin: I/O and native libraries only, no learning logic (see ARCHITECTURE section 2).
- WebView2 behaviour is what Windows provides; the app is tested on Windows 11 first. macOS and Linux builds are not a v1 goal, though CI builds the front end on Linux.
- Per-user NSIS installer, so no admin prompt.
