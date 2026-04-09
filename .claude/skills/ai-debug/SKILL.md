---
name: ai-debug
description: Use when debugging the AI Gateway module. Spec at docs/product-specs/19-ai.md. Backend via signapps-ai (port 3005) — unified gateway for 10 AI capabilities (chat, summarize, translate, classify, extract, generate, embed, search, vision, audio). Multi-provider (Ollama, vLLM, OpenAI, Anthropic, llama.cpp). Frontend AI panel, slash commands, omni-AI bar.
---

# AI Gateway — Debug Skill

## Source of truth
**`docs/product-specs/19-ai.md`**

## Code map
- **Backend**: `services/signapps-ai/` — port **3005** — 10 capability endpoints
- **Frontend**: `client/src/app/ai/`, components `client/src/components/ai/` + omni-AI search bar (used across all modules)
- **E2E**: 0 dedicated tests, 0 data-testids (omni-AI bar may appear in other module tests as overlay blocker)

## Key journeys
1. Open omni-AI bar (`Ctrl+K` or `/`) → type prompt → get response
2. Slash command in Docs editor → AI generates content
3. Summarize a mail thread → summary appears
4. Translate text → result in target language
5. AI settings → select provider/model → test connection

## Common bug patterns (from previous sessions)
1. **Omni-AI overlay blocks clicks** — `.glass-panel` at `fixed bottom-6` intercepts pointer events (documented in spreadsheet-debug and calendar-debug skills)
2. **Model not available** — selected model not downloaded, no clear error
3. **GPU backend mismatch** — `GPU_BACKEND=auto` detection fails
4. **Streaming response cut off** — SSE connection drops on long generation
5. **Context window overflow** — too-long prompt returns 400 without useful message

## Dependencies
- **Ollama** / **vLLM** (Apache-2.0) ✅ — inference server
- **tiktoken** / **tokenizers** — MIT ✅ — token counting
- **ort** (ONNX Runtime) — MIT ✅ — local embedding

### Forbidden
- **OpenAI SDK** itself is MIT ✅ but watch for vendor lock-in
- Any model with restrictive license (check each model's EULA separately)

## Historique
- **2026-04-09** : Skill créé (skeleton). Omni-AI overlay bug documented from spreadsheet/calendar sessions.
