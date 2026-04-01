//! OpenAPI 3.1 spec — code-first via utoipa.
//!
//! `AiApiDoc` derives `OpenApi` and collects all annotated paths and schemas.
//! The spec is served at `GET /api/v1/openapi.json` and Swagger UI at `/swagger-ui/`.

use utoipa::OpenApi;

/// Top-level OpenAPI document for the AI service.
#[derive(OpenApi)]
#[openapi(
    info(
        title = "SignApps AI Service",
        version = "1.0.0",
        description = "RAG, LLM, vision, image generation, audio, video, and document AI capabilities.",
        license(name = "Apache-2.0", url = "https://www.apache.org/licenses/LICENSE-2.0"),
    ),
    servers(
        (url = "http://localhost:3005", description = "Local development"),
    ),
    paths(
        // Health
        crate::handlers::health::health_check,
        // Chat
        crate::handlers::chat::chat,
        crate::handlers::chat::chat_stream,
        // Search
        crate::handlers::search::search,
        crate::handlers::search_image::search_by_image,
        // Index
        crate::handlers::index::index_document,
        crate::handlers::index::remove_document,
        crate::handlers::index::get_stats,
        crate::handlers::index::reindex_all,
        // Collections
        crate::handlers::collections::list_collections,
        crate::handlers::collections::get_collection,
        crate::handlers::collections::create_collection,
        crate::handlers::collections::delete_collection,
        crate::handlers::collections::get_collection_stats,
        // Models
        crate::handlers::models::list_models,
        // Providers
        crate::handlers::providers::list_providers,
        // Model management
        crate::handlers::model_management::list_local_models,
        crate::handlers::model_management::list_available_models,
        crate::handlers::model_management::download_model,
        crate::handlers::model_management::get_model_status,
        crate::handlers::model_management::delete_model,
        crate::handlers::model_management::get_hardware,
        // Actions
        crate::handlers::action::execute_action,
        // Conversations
        crate::handlers::conversations::list_conversations,
        crate::handlers::conversations::get_conversation,
        crate::handlers::conversations::delete_conversation,
        // Audio
        crate::handlers::audio_gen::generate_music,
        crate::handlers::audio_gen::generate_sfx,
        crate::handlers::audio_gen::list_models,
        crate::handlers::transcription::transcribe_audio,
        // Image
        crate::handlers::image_gen::generate_image,
        crate::handlers::image_gen::inpaint_image,
        crate::handlers::image_gen::img2img,
        crate::handlers::image_gen::upscale_image,
        crate::handlers::image_gen::list_image_models,
        // Video
        crate::handlers::video::generate_video,
        crate::handlers::video::img_to_video,
        crate::handlers::video::analyze_video,
        crate::handlers::video::extract_frames,
        crate::handlers::video::transcribe_video,
        crate::handlers::video::list_models,
        // Vision
        crate::handlers::vision::describe_image,
        crate::handlers::vision::visual_qa,
        crate::handlers::vision::batch_describe,
        // Documents
        crate::handlers::doc_parse::parse_document,
        crate::handlers::doc_parse::extract_tables,
        // GPU
        crate::handlers::gpu_status::get_gpu_status,
        crate::handlers::gpu_status::list_profiles,
        crate::handlers::gpu_status::get_recommended_models,
        // Capabilities
        crate::handlers::capabilities::list_capabilities,
        crate::handlers::capabilities::get_capability_advice,
        // Webhooks
        crate::handlers::webhook::ingest_webhook,
    ),
    components(
        schemas(
            // Health
            crate::handlers::health::HealthResponse,
            crate::handlers::health::ComponentsHealth,
            // Chat
            crate::handlers::chat::ChatRequest,
            crate::handlers::chat::ChatResponse,
            crate::handlers::chat::SourceReference,
            // Search
            crate::handlers::search::SearchResponse,
            crate::handlers::search::SearchResultItem,
            crate::handlers::search_image::ImageSearchResponse,
            crate::handlers::search_image::ImageSearchResultItem,
            // Index
            crate::handlers::index::IndexRequest,
            crate::handlers::index::IndexResponse,
            crate::handlers::index::StatsResponse,
            // Collections
            crate::handlers::collections::CreateCollectionRequest,
            crate::handlers::collections::CollectionListResponse,
            // Models
            crate::handlers::models::ModelInfo,
            crate::handlers::models::ModelsResponse,
            // Providers
            crate::handlers::providers::ProviderInfo,
            crate::handlers::providers::ProvidersResponse,
            // Model management
            crate::handlers::model_management::LocalModelsResponse,
            crate::handlers::model_management::AvailableModelsResponse,
            crate::handlers::model_management::DownloadModelRequest,
            crate::handlers::model_management::DownloadModelResponse,
            crate::handlers::model_management::HardwareResponse,
            // Actions
            crate::handlers::action::ActionRequest,
            crate::handlers::action::ActionResponse,
            // Conversations
            crate::handlers::conversations::ConversationsResponse,
            crate::handlers::conversations::ConversationDetail,
            // Audio
            crate::handlers::audio_gen::AudioGenResponse,
            crate::handlers::audio_gen::AudioModelsResponse,
            crate::handlers::audio_gen::GenerateMusicRequest,
            crate::handlers::audio_gen::GenerateSfxRequest,
            crate::handlers::transcription::TranscriptionResponse,
            crate::handlers::transcription::TranscriptionSource,
            // Image
            crate::handlers::image_gen::ImageGenResponse,
            crate::handlers::image_gen::ImageModelsResponse,
            crate::handlers::image_gen::GenerateRequest,
            // Video
            crate::handlers::video::VideoGenResponse,
            crate::handlers::video::VideoModelsResponse,
            crate::handlers::video::GenerateVideoRequest,
            crate::handlers::video::FrameInfo,
            crate::handlers::video::ExtractFramesResponse,
            // Vision
            crate::handlers::vision::BatchDescribeResponse,
            // Documents
            crate::handlers::doc_parse::ExtractTablesResponse,
            // GPU
            crate::handlers::gpu_status::GpuStatusResponse,
            // Webhooks
            crate::handlers::webhook::WebhookResponse,
        )
    ),
    tags(
        (name = "health", description = "Service health check"),
        (name = "chat", description = "RAG-augmented chat with tool calling"),
        (name = "search", description = "Semantic and multimodal search"),
        (name = "index", description = "Document indexing for RAG"),
        (name = "collections", description = "Knowledge base collection management"),
        (name = "models", description = "LLM model listing and local model management"),
        (name = "providers", description = "LLM provider registry"),
        (name = "actions", description = "Natural language action execution (Autopilot)"),
        (name = "conversations", description = "Conversation history management"),
        (name = "audio", description = "Audio generation and transcription"),
        (name = "image", description = "Image generation, inpainting, and upscaling"),
        (name = "video", description = "Video generation and understanding"),
        (name = "vision", description = "Vision analysis — describe, VQA, batch"),
        (name = "documents", description = "Document parsing and table extraction"),
        (name = "gpu", description = "GPU status and hardware profiles"),
        (name = "capabilities", description = "AI capability registry and quality advisor"),
        (name = "webhooks", description = "Universal webhook ingestion for RAG memory"),
        (name = "admin", description = "Admin-only operations (reindex, etc.)"),
    ),
    modifiers(&SecurityAddon),
)]
pub struct AiApiDoc;

/// Adds the Bearer JWT security scheme to the OpenAPI spec.
struct SecurityAddon;

impl utoipa::Modify for SecurityAddon {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        if let Some(components) = openapi.components.as_mut() {
            use utoipa::openapi::security::{HttpAuthScheme, HttpBuilder, SecurityScheme};
            components.add_security_scheme(
                "bearerAuth",
                SecurityScheme::Http(
                    HttpBuilder::new()
                        .scheme(HttpAuthScheme::Bearer)
                        .bearer_format("JWT")
                        .build(),
                ),
            );
        }
    }
}
