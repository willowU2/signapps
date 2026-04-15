use axum::{
    middleware,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use dashmap::DashMap;
use signapps_common::bootstrap::{env_or, init_tracing, load_env};
use signapps_common::middleware::{auth_middleware, tenant_context_middleware};
use signapps_common::{AuthState, JwtConfig};
use signapps_runtime::ModelManager;
use sqlx::PgPool;
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use uuid::Uuid;

mod audio;
mod handlers;
mod ocr;
mod stt;
mod tts;

use ocr::OcrBackend;
use stt::SttBackend;
use tts::TtsBackend;

/// In-memory job store: job_id → serialized JobStatus fields
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct JobEntry {
    pub status: String,
    pub progress: f32,
    pub total_items: u32,
    pub completed_items: u32,
    pub failed_items: u32,
    pub created_at: String,
    pub updated_at: String,
    pub result: Option<serde_json::Value>,
    pub error: Option<String>,
}

pub type JobStore = Arc<DashMap<Uuid, JobEntry>>;

#[derive(Clone)]
/// Application state for  service.
pub struct AppState {
    pub pool: PgPool,
    pub config: MediaConfig,
    pub jwt_config: JwtConfig,
    pub ocr: Arc<dyn OcrBackend>,
    pub tts: Arc<dyn TtsBackend>,
    pub stt: Arc<dyn SttBackend>,
    pub model_manager: Arc<ModelManager>,
    pub job_store: JobStore,
}

#[derive(Clone, Debug)]
/// Configuration for Media.
pub struct MediaConfig {
    // OCR
    pub ocr_url: String,

    // TTS
    pub tts_url: String,
    pub tts_default_voice: String,

    // STT
    pub stt_url: String,
    pub stt_model: String,
    pub stt_language: Option<String>,

    // Voice pipeline
    pub ai_url: String,
}

impl MediaConfig {
    pub fn from_env() -> Self {
        Self {
            ocr_url: std::env::var("OCR_URL").unwrap_or_default(),
            tts_url: std::env::var("TTS_URL").unwrap_or_default(),
            tts_default_voice: std::env::var("TTS_VOICE")
                .unwrap_or_else(|_| "fr_FR-siwis-medium".to_string()),
            stt_url: std::env::var("STT_URL").unwrap_or_default(),
            stt_model: std::env::var("STT_MODEL").unwrap_or_else(|_| "medium".to_string()),
            stt_language: std::env::var("STT_LANGUAGE").ok(),
            ai_url: std::env::var("AI_URL")
                .unwrap_or_else(|_| "http://localhost:3005/api/v1".to_string()),
        }
    }
}

impl AuthState for AppState {
    fn jwt_config(&self) -> &JwtConfig {
        &self.jwt_config
    }
}

#[global_allocator]
static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize using bootstrap helpers
    init_tracing("signapps_media");
    load_env();

    let port: u16 = env_or("SERVER_PORT", "3009").parse().unwrap_or(3009);
    tracing::info!("🚀 Starting signapps-media on port {}", port);

    // Database
    let database_url = env_or(
        "DATABASE_URL",
        "postgres://signapps:signapps@localhost:5432/signapps",
    );
    let pool = sqlx::postgres::PgPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await?;
    tracing::info!("Connected to database");

    // Config
    let config = MediaConfig::from_env();

    // Hardware detection + model manager
    let hardware = signapps_runtime::HardwareProfile::detect().await;
    tracing::info!(
        "Hardware: {} (VRAM: {} MB, CPU: {} cores, RAM: {} MB)",
        hardware.preferred_backend,
        hardware.total_vram_mb,
        hardware.cpu_cores,
        hardware.system_ram_mb
    );

    let model_manager = Arc::new(ModelManager::new(None));

    // Initialize STT backend
    let stt: Arc<dyn SttBackend> =
        if !config.stt_url.is_empty() && config.stt_url.starts_with("http") {
            tracing::info!("STT: using HTTP backend at {}", config.stt_url);
            Arc::new(stt::HttpSttBackend::new(
                &config.stt_url,
                &config.stt_model,
                config.stt_language.clone(),
            ))
        } else {
            #[cfg(feature = "native-stt")]
            {
                tracing::info!(
                    "STT: using native whisper-rs backend (model: {})",
                    config.stt_model
                );
                Arc::new(
                    stt::NativeSttBackend::new(&config.stt_model, model_manager.clone(), &hardware)
                        .await?,
                )
            }
            #[cfg(not(feature = "native-stt"))]
            {
                tracing::warn!("STT: no backend available (set STT_URL or enable native-stt)");
                Arc::new(stt::StubSttBackend)
            }
        };

    // Initialize TTS backend
    let tts: Arc<dyn TtsBackend> =
        if !config.tts_url.is_empty() && config.tts_url.starts_with("http") {
            tracing::info!("TTS: using HTTP backend at {}", config.tts_url);
            Arc::new(tts::HttpTtsBackend::new(
                &config.tts_url,
                &config.tts_default_voice,
            ))
        } else {
            #[cfg(feature = "native-tts")]
            {
                tracing::info!(
                    "TTS: using native piper-rs backend (voice: {})",
                    config.tts_default_voice
                );
                Arc::new(
                    tts::NativeTtsBackend::new(&config.tts_default_voice, model_manager.clone())
                        .await?,
                )
            }
            #[cfg(not(feature = "native-tts"))]
            {
                tracing::warn!("TTS: no backend available (set TTS_URL or enable native-tts)");
                Arc::new(tts::StubTtsBackend)
            }
        };

    // Initialize OCR backend
    let ocr: Arc<dyn OcrBackend> =
        if !config.ocr_url.is_empty() && config.ocr_url.starts_with("http") {
            tracing::info!("OCR: using HTTP backend at {}", config.ocr_url);

            let provider = if config.ocr_url.contains("chat/completions") {
                ocr::http::OcrProvider::OpenAIVision
            } else {
                ocr::http::OcrProvider::default()
            };

            Arc::new(ocr::HttpOcrBackend::new(&config.ocr_url, provider))
        } else {
            #[cfg(feature = "native-ocr")]
            {
                tracing::info!("OCR: using native ocrs backend");
                Arc::new(ocr::NativeOcrBackend::new(model_manager.clone()).await?)
            }
            #[cfg(not(feature = "native-ocr"))]
            {
                tracing::warn!("OCR: no backend available (set OCR_URL or enable native-ocr)");
                Arc::new(ocr::StubOcrBackend)
            }
        };

    let jwt_config = JwtConfig::from_env();

    let state = Arc::new(AppState {
        pool,
        config,
        jwt_config,
        ocr,
        tts,
        stt,
        model_manager,
        job_store: Arc::new(DashMap::new()),
    });

    // Build router

    // Public routes (no auth required)
    let public_routes = Router::new()
        .route("/health", get(health_check))
        .merge(signapps_common::version::router("signapps-media"));

    // Protected routes (auth required)
    let protected_routes = Router::new()
        // OCR endpoints
        .route("/api/v1/ocr", post(handlers::ocr::extract_text))
        .route(
            "/api/v1/ocr/document",
            post(handlers::ocr::process_document),
        )
        .route("/api/v1/ocr/batch", post(handlers::ocr::batch_process))
        // TTS endpoints
        .route("/api/v1/tts/synthesize", post(handlers::tts::synthesize))
        .route("/api/v1/tts/voices", get(handlers::tts::list_voices))
        .route(
            "/api/v1/tts/stream",
            post(handlers::tts::synthesize_stream),
        )
        // STT endpoints
        .route("/api/v1/stt/transcribe", post(handlers::stt::transcribe))
        .route(
            "/api/v1/stt/transcribe/stream",
            post(handlers::stt::transcribe_stream),
        )
        .route("/api/v1/stt/models", get(handlers::stt::list_models))
        .route(
            "/api/v1/stt/transcription-result",
            post(handlers::transcription_result::ingest_transcription_result),
        )
        // Voice pipeline (WebSocket)
        .route("/api/v1/voice", get(handlers::voice::voice_ws))
        // Jobs/Status
        .route("/api/v1/jobs/:id", get(handlers::jobs::get_job_status))
        .route_layer(middleware::from_fn(tenant_context_middleware))
        .route_layer(middleware::from_fn_with_state(
            (*state).clone(),
            auth_middleware::<AppState>,
        ));

    let cors = CorsLayer::new()
        .allow_origin(tower_http::cors::Any)
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PUT,
            axum::http::Method::DELETE,
            axum::http::Method::PATCH,
            axum::http::Method::OPTIONS,
        ])
        .allow_headers([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::AUTHORIZATION,
            axum::http::HeaderName::from_static("x-request-id"),
            axum::http::HeaderName::from_static("x-workspace-id"),
        ]);

    let app = Router::new()
        .merge(public_routes)
        .merge(protected_routes)
        .merge(handlers::openapi::swagger_router())
        .layer(cors)
        .layer(axum::extract::DefaultBodyLimit::max(10 * 1024 * 1024))
        .with_state(state);

    // Start server
    let addr: std::net::SocketAddr = format!("0.0.0.0:{}", port)
        .parse()
        .expect("server address is valid");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    tracing::info!("✅ signapps-media ready at http://localhost:{}", port);
    axum::serve(listener, app)
        .with_graceful_shutdown(signapps_common::graceful_shutdown())
        .await?;
    Ok(())
}

async fn health_check() -> impl IntoResponse {
    Json(serde_json::json!({
        "status": "healthy",
        "service": "signapps-media",
        "version": env!("CARGO_PKG_VERSION"),
        "app": {
            "id": "media",
            "label": "Media",
            "description": "Audio, vidéo et médias",
            "icon": "Mic",
            "category": "Infrastructure",
            "color": "text-purple-500",
            "href": "/media",
            "port": 3009
        }
    }))
}
