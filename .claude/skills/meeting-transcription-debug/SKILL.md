---
name: meeting-transcription-debug
description: Use when debugging or verifying the Meeting Transcription module of SignApps Platform. This skill references the product spec at docs/product-specs/63-meeting-transcription.md as the source of truth for expected behavior. It provides a complete debug checklist (code paths, data-testids, E2E tests, OSS dependencies, common pitfalls) to systematically investigate issues with Meeting Transcription.
---

# Meeting Transcription — Debug Skill

This skill is the **dedicated debugging companion** for the `Meeting Transcription` module of SignApps Platform. It is paired with the product spec `docs/product-specs/63-meeting-transcription.md` which defines the expected behavior.

## Source of truth

**`docs/product-specs/63-meeting-transcription.md`**

Always read the spec first before starting to debug.

## Code map

### Backend (Rust)
- **Service (Meet)**: `services/signapps-meet/` — port 3014
- **Service (Media)**: `services/signapps-media/` — port 3009
- **Crate (types)**: `crates/signapps-transcription/` — Segment, Speaker, SessionMeta, TranscriptionResult, tiptap conversion
- **Crate (capture)**: `crates/signapps-audio-capture/` — AudioCaptureBackend, VAD, WASAPI/CoreAudio/PulseAudio
- **Meet handlers**: `services/signapps-meet/src/handlers/transcription.rs` — MeetPipeline (5-step)
- **Media handlers**: `services/signapps-media/src/handlers/transcription_result.rs` — CapturePipeline ingestion
- **Media STT**: `services/signapps-media/src/stt/` — SttBackend trait, Whisper HTTP/native
- **DB migration**: `migrations/300_transcription_jobs.sql`
- **Pyannote sidecar**: `scripts/pyannote-sidecar/diarize.py`

### Desktop (Tauri)
- **Capture commands**: `src-tauri/src/capture.rs` — list_audio_sources, start_capture, stop_capture
- **Transcription command**: `src-tauri/src/transcribe.rs` — transcribe_captured_audio
- **Dependencies**: signapps-audio-capture, signapps-transcription, reqwest

### Frontend (Next.js + React)
- **Tiptap extensions**: `client/src/components/docs/extensions/transcript-meta.ts`, `transcript-segment.ts`
- **React views**: `client/src/components/docs/transcript-meta-view.tsx`, `transcript-segment-view.tsx`
- **Docs extensions index**: `client/src/components/docs/extensions/index.ts`

### E2E tests
- `client/e2e/meet-*.spec.ts` (meet-related)
- `crates/signapps-transcription/tests/integration.rs` (Rust integration)

## Feature categories (from the spec)

1. Pipeline de transcription
2. Capture audio externe
3. Diarization et identification des speakers
4. Document de transcription
5. Recherche et navigation
6. Edition et correction post-transcription
7. IA integree
8. Export et partage
9. Administration et quotas
10. Integrations cross-modules
11. Mobile et accessibilite
12. V2 prep — Streaming live

## Key data-testids

- `data-testid="transcript-meta"` — metadata banner in Tiptap doc
- `data-testid="transcript-segment"` — individual speaker segment
- `data-testid="transcript-speaker-label"` — speaker name in segment
- `data-testid="transcript-timestamp"` — clickable timestamp
- `data-testid="capture-overlay"` — Tauri capture window
- `data-testid="capture-start-btn"` — start recording button
- `data-testid="capture-stop-btn"` — stop recording button
- `data-testid="capture-waveform"` — audio waveform display

## Key E2E tests

- `crates/signapps-transcription/tests/integration.rs` — Rust: TranscriptionResult to Tiptap JSON
- `crates/signapps-audio-capture/src/vad.rs` — VAD unit tests (silence/speech detection)
- `crates/signapps-transcription/src/tiptap.rs` — Tiptap conversion unit tests

### Running tests

```bash
# Rust tests for transcription crates
cargo nextest run -p signapps-transcription -p signapps-audio-capture

# Check compilation of meet pipeline
cargo check -p signapps-meet

# Check compilation of media ingestion endpoint
cargo check -p signapps-media

# Check Tauri app
cargo check -p signapps-tauri

# Frontend type-check
cd client && npx tsc --noEmit
```

## Debug workflow

### Step 1: Reproduce
- What triggered the transcription? (meet.session.ended event? Manual capture?)
- Check backend logs: `RUST_LOG=debug` on signapps-meet (port 3014) and signapps-media (port 3009)
- Check if Whisper/Faster-Whisper service is running

### Step 2: Classify the bug

| Symptom | Likely cause | Where to look |
|---------|-------------|---------------|
| Transcription never starts | Event bus not firing | `signapps-meet/handlers/transcription.rs` handle_session_ended |
| "storage fetch failed" | Recording path missing or storage service down | Check `meet.recordings.storage_path`, curl storage API |
| "STT request failed" | Whisper service not running | Check `MEDIA_URL`, `STT_URL` env vars |
| Empty segments | Audio too short or silent | Check audio bytes length, VAD threshold |
| No speakers identified | Diarization skipped | Check pyannote sidecar availability |
| Doc not created | Docs service down | Check `DOCS_URL`, curl docs API |
| Tauri capture fails | Platform-specific audio issue | Check AudioCaptureBackend impl for current OS |

### Step 3: Narrow down with tests
Write a minimal failing test in `crates/signapps-transcription/tests/`.

### Step 4: Fix + regression test

## Common bug patterns

1. **Whisper timeout on long recordings**: Whisper can take 2-5x real-time on CPU. Set `reqwest` timeout to at least `duration_seconds * 5`.
2. **WASAPI loopback requires exclusive mode**: On some Windows configurations, loopback capture fails if another app has exclusive audio access.
3. **pyannote model download on first run**: First diarization takes 5-10 minutes to download the model. Show progress UI.
4. **LiveKit egress format**: Recording may be in WebM/Opus, not WAV. Ensure symphonia decoding handles the format.
5. **Empty storage_path**: If recording stops abruptly, `storage_path` may be null. Pipeline should handle gracefully.

## Dependencies check (license compliance)

| Dependency | License | Status |
|---|---|---|
| whisper-rs | MIT | OK |
| cpal | Apache-2.0 | OK |
| pyannote.audio | MIT | OK |
| torch (PyTorch) | BSD-3-Clause | OK |
| symphonia | MPL-2.0 | OK (consumer) |
| reqwest | MIT/Apache-2.0 | OK |

Run before committing:
```bash
just deny-licenses
cd client && npm run license-check:strict
```

## Cross-module interactions

- **signapps-meet** — triggers MeetPipeline via `meet.session.ended`
- **signapps-storage** — fetches recording audio bytes
- **signapps-media** — STT transcription, CapturePipeline ingestion
- **signapps-docs** — creates Tiptap transcript documents
- **signapps-calendar** — links transcription to calendar event
- **signapps-drive** — stores transcript in "Transcriptions" folder
- **global_search_index** — full-text search across transcriptions

## Spec coverage checklist

- [ ] MeetPipeline 5 steps all implemented
- [ ] CapturePipeline Tauri commands functional
- [ ] Tiptap extensions render correctly in docs editor
- [ ] VAD silence detection works
- [ ] pyannote sidecar produces valid JSON
- [ ] TranscriptionResult to Tiptap JSON roundtrip valid
- [ ] DB migration applied and indexed
- [ ] No forbidden license dependencies
