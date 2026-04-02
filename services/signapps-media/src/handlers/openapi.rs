//! OpenAPI 3.1 spec — code-first via utoipa.
//!
//! `MediaApiDoc` derives `OpenApi` and collects all annotated paths and schemas.
//! The spec is served at `GET /api-docs/openapi.json` and Swagger UI at `/swagger-ui/`.

use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

/// Top-level OpenAPI document for the Media service.
#[derive(OpenApi)]
#[openapi(
    info(
        title = "SignApps Media Service",
        version = "1.0.0",
        description = "Native OCR, Text-to-Speech, Speech-to-Text, and voice pipeline capabilities.",
        license(name = "Apache-2.0", url = "https://www.apache.org/licenses/LICENSE-2.0"),
    ),
    servers(
        (url = "http://localhost:3009", description = "Local development"),
    ),
    paths(
        // OCR
        crate::handlers::ocr::extract_text,
        crate::handlers::ocr::process_document,
        crate::handlers::ocr::batch_process,
        // TTS
        crate::handlers::tts::synthesize,
        crate::handlers::tts::synthesize_stream,
        crate::handlers::tts::list_voices,
        // STT
        crate::handlers::stt::transcribe,
        crate::handlers::stt::transcribe_stream,
        crate::handlers::stt::list_models,
        // Voice
        crate::handlers::voice::voice_ws,
        // Jobs
        crate::handlers::jobs::get_job_status,
    ),
    components(
        schemas(
            // OCR
            crate::handlers::ocr::OcrResponse,
            crate::handlers::ocr::PageResponse,
            crate::handlers::ocr::MetadataResponse,
            crate::handlers::ocr::BatchOcrRequest,
            crate::handlers::ocr::BatchOcrResponse,
            // STT
            crate::handlers::stt::TranscribeResponse,
            crate::handlers::stt::SegmentResponse,
            crate::handlers::stt::WordResponse,
            crate::handlers::stt::SpeakerResponse,
            // TTS
            crate::handlers::tts::SynthesizeRequest,
            // Jobs
            crate::handlers::jobs::JobStatus,
        )
    ),
    tags(
        (name = "OCR", description = "Optical Character Recognition — extract text from images and documents"),
        (name = "TTS", description = "Text-to-Speech — synthesize speech from text"),
        (name = "STT", description = "Speech-to-Text — transcribe audio files"),
        (name = "Voice", description = "Full-duplex voice pipeline (STT → LLM → TTS) over WebSocket"),
        (name = "Jobs", description = "Async job status tracking"),
    ),
    modifiers(&SecurityAddon),
)]
pub struct MediaApiDoc;

/// Adds the Bearer JWT security scheme to the OpenAPI spec.
struct SecurityAddon;

impl utoipa::Modify for SecurityAddon {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        if let Some(components) = openapi.components.as_mut() {
            use utoipa::openapi::security::{HttpAuthScheme, HttpBuilder, SecurityScheme};
            components.add_security_scheme(
                "bearer",
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

/// Returns a `SwaggerUi` router serving the OpenAPI spec and Swagger UI.
pub fn swagger_router() -> SwaggerUi {
    SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", MediaApiDoc::openapi())
}
