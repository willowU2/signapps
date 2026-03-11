import { aiApiClient } from './core';

// AI API
export const aiApi = {
    chat: (question: string, options?: { model?: string; provider?: string; conversationId?: string; includesSources?: boolean; collections?: string[]; language?: string; systemPrompt?: string; enableTools?: boolean }) =>
        aiApiClient.post<ChatResponse>('/ai/chat', {
            question,
            model: options?.model,
            provider: options?.provider,
            conversation_id: options?.conversationId,
            include_sources: options?.includesSources ?? true,
            collections: options?.collections,
            language: options?.language,
            system_prompt: options?.systemPrompt,
            enable_tools: options?.enableTools ?? true,
        }),
    chatStream: (question: string, options?: { model?: string; provider?: string; conversationId?: string; collections?: string[]; language?: string; systemPrompt?: string; enableTools?: boolean }) =>
        aiApiClient.post('/ai/chat/stream', {
            question,
            model: options?.model,
            provider: options?.provider,
            conversation_id: options?.conversationId,
            collections: options?.collections,
            language: options?.language,
            system_prompt: options?.systemPrompt,
            enable_tools: options?.enableTools ?? true,
        }, {
            responseType: 'stream',
        }),
    search: (query: string, limit?: number, collections?: string[]) =>
        aiApiClient.get<SearchResult[]>('/ai/search', { params: { q: query, limit, collections } }),
    index: (documentId: string, content: string, filename: string, path: string, mimeType?: string, collection?: string) =>
        aiApiClient.post('/ai/index', { document_id: documentId, content, filename, path, mime_type: mimeType, collection }),
    removeDocument: (documentId: string) =>
        aiApiClient.delete(`/ai/index/${documentId}`),
    stats: () => aiApiClient.get<AIStats>('/ai/stats'),
    models: (provider?: string) =>
        aiApiClient.get<ModelsResponse>('/ai/models', {
            params: provider ? { provider } : undefined,
        }),
    providers: () => aiApiClient.get<ProvidersResponse>('/ai/providers'),
    // Model management
    localModels: () => aiApiClient.get<{ models: ModelEntry[] }>('/ai/models/local'),
    availableModels: () => aiApiClient.get<{ models: ModelEntry[] }>('/ai/models/available'),
    searchModels: (query: string) => aiApiClient.get<{ models: ModelEntry[] }>('/ai/models/search', { params: { q: query } }),
    downloadModel: (modelId: string) =>
        aiApiClient.post<{ model_id: string; status: string; path?: string }>('/ai/models/download', { model_id: modelId }),
    deleteModel: (modelId: string) => aiApiClient.delete(`/ai/models/${modelId}`),
    getModelStatus: (modelId: string) => aiApiClient.get<ModelEntry>(`/ai/models/${encodeURIComponent(modelId)}`),
    hardware: () => aiApiClient.get<{ hardware: HardwareProfile }>('/ai/hardware'),

    // Knowledge Bases / Collections
    listCollections: () => aiApiClient.get<CollectionsResponse>('/ai/collections'),
    getCollection: (name: string) => aiApiClient.get<KnowledgeBase>(`/ai/collections/${name}`),
    createCollection: (data: CreateCollectionRequest) =>
        aiApiClient.post<KnowledgeBase>('/ai/collections', data),
    deleteCollection: (name: string) => aiApiClient.delete(`/ai/collections/${name}`),
    getCollectionStats: (name: string) => aiApiClient.get<CollectionStats>(`/ai/collections/${name}/stats`),
};

export interface ChatResponse {
    answer: string;
    sources?: { document_id: string; filename: string; score: number; excerpt: string }[];
    tokens_used?: number;
}

export interface ModelsResponse {
    models: Model[];
}

export interface SearchResult {
    id: string;
    document_id: string;
    content: string;
    filename: string;
    score: number;
}

export interface AIStats {
    documents_count: number;
    chunks_count: number;
    last_indexed?: string;
}

export interface Model {
    id: string;
    object?: string;
    owned_by?: string;
    name?: string;
}

export interface ProvidersResponse {
    providers: ProviderInfo[];
    active_provider: string;
}

export interface ProviderInfo {
    id: string;
    name: string;
    provider_type: 'ollama' | 'vllm' | 'openai' | 'anthropic' | 'llamacpp';
    enabled: boolean;
    default_model: string;
    is_local: boolean;
}

// Knowledge Base / Collections types
export interface KnowledgeBase {
    name: string;
    description?: string;
    documents_count: number;
    chunks_count: number;
    size_bytes: number;
    created_at: string;
    updated_at: string;
}

export interface CollectionsResponse {
    collections: KnowledgeBase[];
}

export interface CollectionStats {
    name: string;
    documents_count: number;
    chunks_count: number;
    size_bytes: number;
    avg_chunk_size: number;
    last_indexed?: string;
}

export interface CreateCollectionRequest {
    name: string;
    description?: string;
}

// Hardware types (aligned with signapps-runtime gpu.rs)
export interface GpuInfo {
    name: string;
    vendor: 'nvidia' | 'amd' | 'intel' | 'apple' | 'unknown';
    vram_mb: number;
}

export interface HardwareProfile {
    gpus: GpuInfo[];
    preferred_backend: InferenceBackend;
    total_vram_mb: number;
    cpu_cores: number;
    system_ram_mb: number;
}

export type InferenceBackend =
    | { type: 'cuda'; version: string }
    | { type: 'rocm'; version: string }
    | { type: 'vulkan' }
    | { type: 'metal' }
    | { type: 'cpu' };

// Model management types (aligned with signapps-runtime models.rs)
export type ModelType = 'stt' | 'tts' | 'ocr' | 'llm' | 'embeddings';

export type ModelStatus =
    | 'available'
    | { downloading: { progress: number } }
    | 'ready'
    | 'loaded'
    | { error: { message: string } };

export interface ModelEntry {
    id: string;
    model_type: ModelType;
    size_bytes: number;
    status: ModelStatus;
    local_path?: string;
    recommended_vram_mb: number;
    description: string;
}
