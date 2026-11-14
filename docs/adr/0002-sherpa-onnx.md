# ADR 0002 — sherpa-onnx for offline speech

Status: accepted · 14 Nov 2026 · not yet implemented

## Context

Shadowing, timed retell and Talk need voice activity detection, German speech-to-text and German text-to-speech. Local TTS and the transcript must work offline, recordings must stay on the laptop (P7), and the installer may contain neither Python nor heavy models.

## Decision

Use sherpa-onnx (Apache-2.0) from the Rust core for VAD, ASR and TTS, with a German Piper voice for TTS. Models are downloaded on first use into the app's data folder, with a checksum, and are never part of the installer. Online, Groq Whisper is the faster and more accurate transcriber and goes through the AI gateway; sherpa-onnx is the offline path and the fallback.

## Why

- One native library covers all three speech jobs, with Tauri 2 example apps to start from.
- Runs on CPU on a student laptop; no Python, no GPU.
- Permissive licence for the code. Each model and voice has its own licence and is checked separately.

## Alternatives rejected

- **whisper.cpp plus a separate TTS engine.** Two native integrations instead of one.
- **Cloud speech only.** Breaks offline use and sends every recording off the laptop.
- **XTTS-v2.** Non-commercial licence; excluded by hard rule 2.
- **Web Speech API in the WebView.** Not reliably available in WebView2 and sends audio to a vendor the learner did not choose.

## Consequences

- Every voice and ASR model needs an entry in the licence allow-list before it can be offered for download. Some Piper voices are trained on data with non-commercial terms; only voices whose model card states a permissive licence qualify.
- Pronunciation scoring is not part of this: it comes from Azure Pronunciation Assessment with the learner's own key, and is shown as hints about sounds, never as numbers per sound.
- Risk: the native library adds to installer size and must load on a clean machine without admin rights. This is unverified until the first speech ticket, which must test it on a clean Windows 11 install.
