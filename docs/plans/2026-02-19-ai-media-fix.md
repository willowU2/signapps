# AI Chat + Media Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make AI chat work with all 5 LLM providers (VLLM, Ollama, OpenAI, Anthropic, LlamaCpp) and enable native media backends (STT/TTS/OCR) so the platform's AI and media features are fully functional.

**Architecture:** All backend code is already implemented. The fix is: (1) correct the `.env` configuration so providers register and media uses native backends, (2) fix the frontend STT streaming route mismatch, (3) compile media service with native feature flags.

**Tech Stack:** Rust (Axum), Next.js (React 19), whisper-rs, piper-rs, ocrs, llama-cpp-2

---

## Task 1: Fix `.env` for native media backends

**Files:**
- Modify: `.env` (lines 29-31)

**Context:** Currently `.env` has `STT_URL=http://localhost:9000` and `TTS_URL=http://localhost:5002`, which forces the media service to use HTTP backends pointing at non-existent Docker containers. For native backends, these must be EMPTY so the `main.rs` selection logic falls through to the `#[cfg(feature = "native-stt")]` branch.

**Step 1: Clear STT_URL and TTS_URL in `.env`**

Change:
```
STT_URL=http://localhost:9000
TTS_URL=http://localhost:5002
OCR_URL=
```
To:
```
# Media Service - Native backends (leave empty for native engines)
# Set URL only if using external HTTP service
STT_URL=
TTS_URL=
OCR_URL=
STT_MODEL=medium
TTS_VOICE=fr_FR-siwis-medium
MODELS_DIR=./data/models
GPU_BACKEND=auto
AI_URL=http://localhost:3005/api/v1
```

**Step 2: Verify `.env` looks correct**

Run: `grep -E "STT_URL|TTS_URL|OCR_URL|STT_MODEL|TTS_VOICE" .env`
Expected: All *_URL values are empty, STT_MODEL=medium, TTS_VOICE set.

**Step 3: Commit**

```bash
git add .env
git commit -m "fix: Clear media HTTP URLs for native backend selection"
```

---

## Task 2: Fix frontend STT streaming route

**Files:**
- Modify: `client/src/lib/api.ts` (line 1906)

**Context:** Frontend calls `mediaApiClient.post('/stt/stream', ...)` but backend route is `/api/v1/stt/transcribe/stream` (mediaApiClient already has baseURL `/api/v1`). The correct relative path is `/stt/transcribe/stream`.

**Step 1: Fix the route**

In `client/src/lib/api.ts` line 1906, change:
```typescript
return mediaApiClient.post('/stt/stream', formData, {
```
To:
```typescript
return mediaApiClient.post('/stt/transcribe/stream', formData, {
```

**Step 2: Verify no other mismatched routes**

Run: `grep -n "stt/" client/src/lib/api.ts`
Expected: All STT routes match backend:
- `/stt/transcribe` ✓ (line ~1897)
- `/stt/transcribe/stream` ✓ (line ~1906, just fixed)
- `/stt/models` ✓ (line ~1911)

**Step 3: Commit**

```bash
git add client/src/lib/api.ts
git commit -m "fix: Correct STT streaming route /stt/stream -> /stt/transcribe/stream"
```

---

## Task 3: Compile media service with native features

**Files:**
- No file changes needed — compilation flag only

**Context:** `services/signapps-media/Cargo.toml` has `default = []` so native backends are compiled out. Must explicitly enable `native-stt`, `native-tts`, `native-ocr` feature flags.

**Step 1: Check build with native features**

Run:
```bash
cargo check -p signapps-media --features native-stt,native-tts,native-ocr
```
Expected: Compiles successfully (or reveals missing native deps that need to be installed).

**Step 2: If compilation fails — resolve native dependencies**

Common issues:
- `whisper-rs` needs `cmake` + C compiler for whisper.cpp
- `piper-rs` needs ONNX runtime
- `ocrs`/`rten` needs ONNX runtime

On Windows, if native deps are too complex:
- Fall back to compiling only what works (e.g., `--features native-ocr` alone)
- Or skip native features and use stub backends with a clear error message

**Step 3: Build in release mode (if check passes)**

Run:
```bash
cargo build -p signapps-media --features native-stt,native-tts,native-ocr
```

**Step 4: Commit any workspace changes if Cargo.toml was modified**

Only if changes were needed to resolve compilation:
```bash
git add Cargo.toml services/signapps-media/Cargo.toml
git commit -m "fix: Enable native media features for STT/TTS/OCR"
```

---

## Task 4: Verify AI service provider configuration

**Files:**
- No changes needed — verification only

**Context:** `.env` already has `VLLM_URL`, `OLLAMA_URL`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` configured. The AI service `main.rs` (lines 110-268) conditionally registers each provider based on env vars being non-empty. Frontend `aiApi.providers()` calls `GET /ai/providers` which returns the list.

**Step 1: Verify all providers would register**

Check that `.env` has valid values:
```bash
grep -E "VLLM_URL|OLLAMA_URL|OPENAI_API_KEY|ANTHROPIC_API_KEY|LLAMACPP_MODEL|LLM_PROVIDER" .env
```
Expected:
- `VLLM_URL=http://localhost:8000` → registers vllm
- `OLLAMA_URL=http://localhost:11434` → registers ollama
- `OPENAI_API_KEY=sk-...` → registers openai
- `ANTHROPIC_API_KEY=sk-ant-...` → registers anthropic
- `LLM_PROVIDER=vllm` → sets default

**Step 2: Verify AI service compiles**

Run:
```bash
cargo check -p signapps-ai
```
Expected: No errors.

**Step 3: Verify frontend provider selector exists**

Run: `grep -n "providers" client/src/lib/api.ts | head -5`
Expected: `providers: () => aiApiClient.get<ProvidersResponse>('/ai/providers')` exists.

---

## Task 5: Integration test — start services and verify endpoints

**Files:**
- No changes

**Context:** Final verification that everything works end-to-end.

**Step 1: Start AI service**

```bash
SERVER_PORT=3005 cargo run -p signapps-ai
```
Expected: Logs show provider registration:
```
Registered vLLM provider
Registered Ollama provider
Registered OpenAI provider
Registered Anthropic provider
Provider registry ready: 4 provider(s), default='vllm'
```

**Step 2: Test providers endpoint**

```bash
curl http://localhost:3005/api/v1/ai/providers
```
Expected: JSON array with 4 providers.

**Step 3: Start media service with native features**

```bash
SERVER_PORT=3009 cargo run -p signapps-media --features native-stt,native-tts,native-ocr
```
Expected: Logs show native backends:
```
STT: using native whisper-rs backend (model: medium)
TTS: using native piper-rs backend (voice: fr_FR-siwis-medium)
OCR: using native ocrs backend
```

**Step 4: Test media health**

```bash
curl http://localhost:3009/api/v1/health
```
Expected: `200 OK` with status.

**Step 5: Start frontend and test in browser**

```bash
cd client && npm run dev
```
- Open http://localhost:3000
- Navigate to AI Chat → verify provider dropdown shows all 4 providers
- Try sending a message (with VLLM or Ollama running, should get response)
- Navigate to Media tab → verify STT/TTS/OCR tabs appear without "not configured" error

---

## Summary

| Task | Type | Effort |
|------|------|--------|
| 1. Fix `.env` media URLs | Config | 2 min |
| 2. Fix STT streaming route | Bug fix | 2 min |
| 3. Compile with native features | Build | 5-15 min |
| 4. Verify AI provider config | Verification | 3 min |
| 5. Integration test | Testing | 10 min |
