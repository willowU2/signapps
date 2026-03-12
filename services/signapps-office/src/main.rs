//! SignApps Office Service
//!
//! Document conversion and export service for SignApps Office Suite.
//! Supports export to DOCX, PDF, Markdown, HTML, and plain text.
//! Supports import from DOCX, Markdown, HTML, and plain text.

mod converter;
mod handlers;
mod importer;
mod pdf;
mod presentation;
mod spreadsheet;

use axum::{
    middleware,
    routing::{get, post},
    Router,
};
use signapps_common::middleware::{
    auth_middleware, logging_middleware, request_id_middleware, AuthState,
};
use signapps_common::JwtConfig;
use std::net::SocketAddr;
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use converter::DocumentConverter;
use importer::DocumentImporter;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,signapps=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!(
        "Starting SignApps Office Service v{}",
        env!("CARGO_PKG_VERSION")
    );

    // Load configuration
    dotenvy::dotenv().ok();
    let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| {
        tracing::warn!("JWT_SECRET not set, using insecure default");
        "dev_secret_change_in_production_32chars".to_string()
    });

    // Create JWT config
    let jwt_config = JwtConfig {
        secret: jwt_secret,
        issuer: "signapps".to_string(),
        audience: "signapps".to_string(),
        access_expiration: 900,
        refresh_expiration: 604800,
    };

    // Create document converter and importer
    let converter = DocumentConverter::new();
    let importer = DocumentImporter::new();

    // Create application state
    let state = AppState {
        jwt_config,
        converter,
        importer,
    };

    // Build router
    let app = create_router(state);

    // Start server
    let host = std::env::var("SERVER_HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    let port: u16 = std::env::var("SERVER_PORT")
        .unwrap_or_else(|_| "3010".to_string())
        .parse()
        .expect("Invalid SERVER_PORT");

    let addr: SocketAddr = format!("{}:{}", host, port).parse()?;
    tracing::info!("Listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

/// Application state shared across handlers.
#[derive(Clone)]
pub struct AppState {
    pub jwt_config: JwtConfig,
    pub converter: DocumentConverter,
    pub importer: DocumentImporter,
}

impl AuthState for AppState {
    fn jwt_config(&self) -> &JwtConfig {
        &self.jwt_config
    }
}

/// Create the main router with all routes.
fn create_router(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Public routes (no auth required)
    let public_routes = Router::new()
        .route("/health", get(handlers::health::health_check))
        .route("/api/v1/convert/info", get(handlers::conversion::info))
        .route("/api/v1/import/info", get(handlers::import::info))
        .route(
            "/api/v1/spreadsheet/info",
            get(handlers::spreadsheet::spreadsheet_info),
        )
        .route(
            "/api/v1/presentation/info",
            get(handlers::presentation::presentation_info),
        )
        .route("/api/v1/pdf/info", get(handlers::pdf::pdf_info));

    // Protected routes (auth required)
    let protected_routes = Router::new()
        // Conversion routes
        .route("/api/v1/convert", post(handlers::conversion::convert_json))
        .route(
            "/api/v1/convert/upload",
            post(handlers::conversion::convert_upload),
        )
        .route(
            "/api/v1/convert/batch",
            post(handlers::conversion::convert_batch),
        )
        // Import routes
        .route("/api/v1/import", post(handlers::import::import_json))
        .route(
            "/api/v1/import/upload",
            post(handlers::import::import_upload),
        )
        // Spreadsheet routes
        .route(
            "/api/v1/spreadsheet/export",
            post(handlers::spreadsheet::export_xlsx),
        )
        .route(
            "/api/v1/spreadsheet/import",
            post(handlers::spreadsheet::import_xlsx),
        )
        // Presentation routes
        .route(
            "/api/v1/presentation/export",
            post(handlers::presentation::export_pptx),
        )
        // PDF operations routes
        .route(
            "/api/v1/pdf/extract-text",
            post(handlers::pdf::extract_pdf_text),
        )
        .route(
            "/api/v1/pdf/document-info",
            post(handlers::pdf::get_pdf_document_info),
        )
        .route("/api/v1/pdf/pages", post(handlers::pdf::get_pdf_pages))
        .route("/api/v1/pdf/merge", post(handlers::pdf::merge_pdf_files))
        .route("/api/v1/pdf/split", post(handlers::pdf::split_pdf_file))
        .layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    // Combine all routes
    Router::new()
        .merge(public_routes)
        .merge(protected_routes)
        .layer(middleware::from_fn(logging_middleware))
        .layer(middleware::from_fn(request_id_middleware))
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state)
}
