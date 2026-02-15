use axum::{
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use signapps_common::{AuthState, JwtConfig};
use signapps_runtime::ModelManager;
use sqlx::PgPool;
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use tracing::{info, Level};

mod audio;
mod handlers;
mod ocr;
mod stt;
mod tts;

use ocr::OcrBackend;
use stt::SttBackend;
use tts::TtsBackend;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub config: MediaConfig,
    pub ocr: Arc<dyn OcrBackend>,
    pub tts: Arc<dyn TtsBackend>,
    pub stt: Arc<dyn SttBackend>,
    pub model_manager: Arc<ModelManager>,
}

#[derive(Clone, Debug)]
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
    tracing_subscriber::fmt().with_max_level(Level::INFO).init();

    dotenvy::dotenv().ok();

    // Database
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://signapps:signapps@localhost:5432/signapps".to_string());

    let pool = sqlx::postgres::PgPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await?;

    info!("Connected to database");

    // Config
    let config = MediaConfig::from_env();

    // Hardware detection + model manager
    let hardware = signapps_runtime::HardwareProfile::detect().await;
    info!(
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
            info!("STT: using HTTP backend at {}", config.stt_url);
            Arc::new(stt::HttpSttBackend::new(
                &config.stt_url,
                &config.stt_model,
                config.stt_language.clone(),
            ))
        } else {
            #[cfg(feature = "native-stt")]
            {
                info!(
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
            info!("TTS: using HTTP backend at {}", config.tts_url);
            Arc::new(tts::HttpTtsBackend::new(
                &config.tts_url,
                &config.tts_default_voice,
            ))
        } else {
            #[cfg(feature = "native-tts")]
            {
                info!(
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
            info!("OCR: using HTTP backend at {}", config.ocr_url);
            Arc::new(ocr::HttpOcrBackend::new(
                &config.ocr_url,
                ocr::http::OcrProvider::default(),
            ))
        } else {
            #[cfg(feature = "native-ocr")]
            {
                info!("OCR: using native ocrs backend");
                Arc::new(ocr::NativeOcrBackend::new(model_manager.clone()).await?)
            }
            #[cfg(not(feature = "native-ocr"))]
            {
                tracing::warn!("OCR: no backend available (set OCR_URL or enable native-ocr)");
                Arc::new(ocr::StubOcrBackend)
            }
        };

    let state = Arc::new(AppState {
        pool,
        config,
        ocr,
        tts,
        stt,
        model_manager,
    });

    // Build router
    let app = Router::new()
        // Health check
        .route("/health", get(health_check))
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
        // Voice pipeline (WebSocket)
        .route("/api/v1/voice", get(handlers::voice::voice_ws))
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
