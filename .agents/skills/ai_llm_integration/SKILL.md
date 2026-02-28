---
name: ai_llm_integration
description: Understanding the AI LLM and Media integrations in this project
---
# AI & Local LLM Integration Workflow

1. **Multi-Backend Design**: The AI service (`signapps-ai`) supports Ollama, vLLM, OpenAI, Anthropic, and native GGUF inferencing. 
2. **Agnostic Logic**: When adding features to the AI pipeline, rely on the unified `LanguageModel` traits and structs inside the project, rather than hardcoding HTTP calls to a specific provider.
3. **Vector Database**: For Retrieval-Augmented Generation (RAG), the project uses `pgvector` inside PostgreSQL. Do not invent a new database layer (like Pinecone or Qdrant); strictly use `crates/signapps-db` models.
4. **Media Processing**: `signapps-media` uses native bindings to Whisper.cpp and Piper for STT/TTS. Modifications here might require Native hardware flags (CPU, CUDA, Metal).
5. **No Vibe Coding**: Document how your changes will behave across multiple providers, or if they are explicitly restricted to one provider.
