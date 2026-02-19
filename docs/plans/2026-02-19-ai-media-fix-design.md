# Design: Fix AI Chat (VLLM + all providers) & Media (native TTS/STT/OCR)

**Date:** 2026-02-19
**Status:** Approved

## Problem

1. AI chat has no working LLM provider - all 5 providers (VLLM, Ollama, OpenAI, Anthropic, LlamaCpp) are implemented in backend but none configured/tested
2. Media service (TTS, STT, OCR) returns "not configured" - compiled without native feature flags, no external URLs set
3. Frontend STT streaming route mismatch: calls `/stt/stream` but backend exposes `/stt/transcribe/stream`

## Solution: Approach 1 - Configuration + Frontend Fix

All backend code exists. Fix is configuration, compilation flags, and frontend bug fixes.

### Part 1: AI Service (port 3005)

- All 5 LLM providers already implemented in `services/signapps-ai/src/llm/providers.rs`
- Provider registration is conditional on env vars in `main.rs` (lines 110-200)
- Frontend provider selector loads from `GET /ai/providers` and works
- Need: proper `.env` documentation, verify all providers register correctly

### Part 2: Media Service (port 3009)

- Native backends exist behind feature flags: `native-stt`, `native-tts`, `native-ocr`
- Compile with: `cargo build -p signapps-media --features native-stt,native-tts,native-ocr`
- Models auto-download via `ModelManager` on first use
- Need: fix workspace Cargo.toml if needed for native deps

### Part 3: Frontend Fixes

- Fix STT streaming route: `/stt/stream` -> `/stt/transcribe/stream` in `api.ts`
- Verify provider selector dropdown works with backend response
- No changes needed to ai-chat-bar.tsx (already calls correct endpoints)

## Out of Scope

- Tool calling integration (scaffolded but not wired)
- Batch OCR job system (stub)
- Auto-install Ollama script
