---
name: voice-audio-debug
description: Debug skill for the Voice & Audio module (STT/TTS). Backend on signapps-media port 3009. Covers speech-to-text, text-to-speech, audio recording, transcription, and voice commands.
---

# Voice & Audio — Debug Skill

## Source of truth

**`docs/product-specs/26-voice-audio.md`** — read spec first.

## Code map

### Backend (Rust)
- **Service**: `services/signapps-media/` — port **3009**
- **Handlers**: `services/signapps-media/src/handlers/` (STT, TTS endpoints)
- **DB models**: `crates/signapps-db/src/models/media*.rs`
- **AI integration**: may delegate to `signapps-ai` port 3005 for model inference

### Frontend (Next.js)
- **Pages**: `client/src/app/voice/` or embedded in other modules
- **Components**: `client/src/components/voice/` (recorder, player, transcription viewer)
- **API client**: `client/src/lib/api/media.ts`

## Key data-testids (to add)

| data-testid | Element |
|---|---|
| `voice-record-btn` | Start/stop recording |
| `voice-player` | Audio playback widget |
| `voice-transcription` | Transcription text display |
| `voice-tts-input` | TTS text input |
| `voice-tts-play` | TTS play button |
| `voice-language-select` | Language selector |

## Key E2E journeys

1. **Record & transcribe** — record audio, submit for STT, verify transcription text
2. **TTS playback** — enter text, generate speech, verify audio plays
3. **Language switch** — change STT language, verify transcription adapts
4. **Transcription in docs** — record voice note in a document, verify text inserted

## Common bug patterns

1. **Microphone permissions** — browser denies access silently; must handle NotAllowedError gracefully
2. **Audio format mismatch** — WAV vs WebM vs OGG; backend may reject unsupported codecs
3. **Long audio timeout** — transcription of 10min+ audio may exceed request timeout

## Dependencies (license check)

- **Backend**: whisper/vosk models — check license per model
- **Frontend**: MediaRecorder API (browser-native), Web Audio API
- Verify: `just deny-licenses && cd client && npm run license-check:strict`
