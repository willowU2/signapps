use axum::{
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use signapps_common::{AuthState, JwtConfig};
use sqlx::PgPool;
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use tracing::{info, Level};

mod handlers;
mod ocr;
mod stt;
mod tts;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub config: MediaConfig,
    pub ocr_client: ocr::OcrClient,
    pub tts_client: tts::TtsClient,
    pub stt_client: stt::SttClient,
}

#[derive(Clone, Debug)]
pub struct MediaConfig {
    // OCR service (Surya or PaddleOCR)
    pub ocr_url: String,
    pub ocr_provider: OcrProvider,

    // TTS service (Piper)
    pub tts_url: String,
    pub tts_default_voice: String,

    // STT service (Faster-Whisper)
    pub stt_url: String,
    pub stt_model: String,
    pub stt_language: Option<String>,
}

#[derive(Clone, Debug, Default)]
pub enum OcrProvider {
    #[default]
    Surya,
    PaddleOCR,
}

impl MediaConfig {
    pub fn from_env() -> Self {
        Self {
            ocr_url: std::env::var("OCR_URL").unwrap_or_else(|_| "http://ocr:8000".to_string()),
            ocr_provider: match std::env::var("OCR_PROVIDER").unwrap_or_default().as_str() {
                "paddle" | "paddleocr" => OcrProvider::PaddleOCR,
                _ => OcrProvider::Surya,
            },
            tts_url: std::env::var("TTS_URL").unwrap_or_else(|_| "http://piper:5000".to_string()),
            tts_default_voice: std::env::var("TTS_VOICE")
                .unwrap_or_else(|_| "en_US-lessac-medium".to_string()),
            stt_url: std::env::var("STT_URL").unwrap_or_else(|_| "http://whisper:8000".to_string()),
            stt_model: std::env::var("STT_MODEL").unwrap_or_else(|_| "large-v3".to_string()),
            stt_language: std::env::var("STT_LANGUAGE").ok(),
        }
    }
}

impl AuthState for AppState {
    fn jwt_config(&self) -> &JwtConfig {
        // For simplicity, we use a static config. In production, load from DB/env
        static JWT_CONFIG: std::sync::OnceLock<JwtConfig> = std::sync::OnceLock::new();
        JWT_CONFIG.get_or_init(|| JwtConfig {
            secret: std::env::var("JWT_SECRET")
                .unwrap_or_else(|_| "dev-secret-change-in-production".to_string()),
            issuer: "signapps".to_string(),
            audience: "signapps".to_string(),
            access_expiration: 3600,
            refresh_expiration: 86400 * 7,
        })
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::fmt().with_max_level(Level::INFO).init();

    // Load environment variables
    dotenvy::dotenv().ok();

    // Database connection
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://signapps:signapps@localhost:5432/signapps".to_string());

    let pool = sqlx::postgres::PgPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await?;

    info!("Connected to database");

    // Initialize media config
    let config = MediaConfig::from_env();

    // Initialize clients
    let ocr_client = ocr::OcrClient::new(&config.ocr_url, config.ocr_provider.clone());
    let tts_client = tts::TtsClient::new(&config.tts_url, &config.tts_default_voice);
    let stt_client = stt::SttClient::new(
        &config.stt_url,
        &config.stt_model,
        config.stt_language.clone(),
    );

    let state = Arc::new(AppState {
        pool,
        config,
        ocr_client,
        tts_client,
        stt_client,
    });

    // Build router
    let app = Router::new()
        // Health check
        .route("/health", get(health_check))
        // OCR endpoints
        .route("/api/v1/ocr", post(handlers::ocr::extract_text))
        .route("/api/v1/ocr/document", post(handlers::ocr::process_document))
        .route("/api/v1/ocr/batch", post(handlers::ocr::batch_process))
        // TTS endpoints
        .route("/api/v1/tts/synthesize", post(handlers::tts::synthesize))
        .route("/api/v1/tts/voices", get(handlers::tts::list_voices))
        .route("/api/v1/tts/stream", post(handlers::tts::synthesize_stream))
        // STT endpoints
        .route("/api/v1/stt/transcribe", post(handlers::stt::transcribe))
        .route("/api/v1/stt/transcribe/stream", post(handlers::stt::transcribe_stream))
        .route("/api/v1/stt/models", get(handlers::stt::list_models))
        // Jobs/Status
        .route("/api/v1/jobs/:id", get(handlers::jobs::get_job_status))
        .layer(CorsLayer::permissive())
        .with_state(state);

    // Start server
    let host = std::env::var("SERVER_HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    let port = std::env::var("SERVER_PORT").unwrap_or_else(|_| "3009".to_string());
    let addr = format!("{}:{}", host, port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    info!("signapps-media listening on {}", addr);

    axum::serve(listener, app).await?;
    Ok(())
}

async fn health_check() -> impl IntoResponse {
    Json(serde_json::json!({
        "status": "healthy",
        "service": "signapps-media",
        "version": env!("CARGO_PKG_VERSION")
    }))
}
