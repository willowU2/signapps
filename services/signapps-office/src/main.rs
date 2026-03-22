use axum::{
    routing::{get, post},
    Router,
};
use signapps_common::bootstrap::{env_or, init_tracing, load_env};
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

mod api;
mod converter;
mod handlers;
mod importer;
mod pdf;
mod presentation;
mod spreadsheet;

use converter::DocumentConverter;
use handlers::jobs::JobStore;
use importer::DocumentImporter;

/// Application state shared across handlers
#[derive(Clone)]
pub struct AppState {
    pub converter: DocumentConverter,
    pub importer: DocumentImporter,
    pub cache: signapps_cache::BinaryCacheService,
    /// In-memory async job queue for heavy document exports (MT-02)
    pub jobs: JobStore,
}

#[tokio::main]
async fn main() {
    // Initialize using bootstrap helpers
    init_tracing("signapps_office");
    load_env();

    let port: u16 = env_or("SERVER_PORT", "3018").parse().unwrap_or(3018);
    tracing::info!("🚀 Starting signapps-office on port {}", port);

    // Create shared state
    let state = AppState {
        converter: DocumentConverter::new(),
        importer: DocumentImporter::new(),
        cache: signapps_cache::BinaryCacheService::default_config(),
        jobs: handlers::jobs::new_job_store(),
    };

    let app = Router::new()
        // Health check
        .route("/health", get(|| async { "OK" }))

        // ═══════════════════════════════════════════════════════════════════════
        // CONVERSION ROUTES - Tiptap/HTML/Markdown → DOCX/PDF/MD/HTML/TXT
        // ═══════════════════════════════════════════════════════════════════════
        .route("/api/v1/convert/info", get(handlers::conversion::info))
        .route("/api/v1/convert", post(handlers::conversion::convert_json))
        .route("/api/v1/convert/upload", post(handlers::conversion::convert_upload))
        .route("/api/v1/convert/batch", post(handlers::conversion::convert_batch))

        // Legacy route (keep for backwards compatibility)
        .route("/api/v1/convert/legacy", post(api::convert::handle_convert))

        // ═══════════════════════════════════════════════════════════════════════
        // IMPORT ROUTES - DOCX/Markdown/HTML/TXT → Tiptap JSON
        // ═══════════════════════════════════════════════════════════════════════
        .route("/api/v1/import/info", get(handlers::import::info))
        .route("/api/v1/import", post(handlers::import::import_json))
        .route("/api/v1/import/upload", post(handlers::import::import_upload))

        // ═══════════════════════════════════════════════════════════════════════
        // SPREADSHEET ROUTES - XLSX/CSV/ODS ↔ JSON
        // ═══════════════════════════════════════════════════════════════════════
        .route("/api/v1/spreadsheet/info", get(handlers::spreadsheet::spreadsheet_info))
        .route("/api/v1/spreadsheet/export", post(handlers::spreadsheet::export_spreadsheet))
        .route("/api/v1/spreadsheet/export/csv", post(handlers::spreadsheet::export_csv_handler))
        .route("/api/v1/spreadsheet/export/ods", post(handlers::spreadsheet::export_ods_handler))
        .route("/api/v1/spreadsheet/import", post(handlers::spreadsheet::import_spreadsheet))
        .route("/api/v1/spreadsheet/import/csv", post(handlers::spreadsheet::import_csv_text))

        // ═══════════════════════════════════════════════════════════════════════
        // PDF OPERATIONS ROUTES - Extract, Merge, Split, Info
        // ═══════════════════════════════════════════════════════════════════════
        .route("/api/v1/pdf/info", get(handlers::pdf::pdf_info))
        .route("/api/v1/pdf/extract-text", post(handlers::pdf::extract_pdf_text))
        .route("/api/v1/pdf/document-info", post(handlers::pdf::get_pdf_document_info))
        .route("/api/v1/pdf/pages", post(handlers::pdf::get_pdf_pages))
        .route("/api/v1/pdf/merge", post(handlers::pdf::merge_pdf_files))
        .route("/api/v1/pdf/split", post(handlers::pdf::split_pdf_file))

        // ═══════════════════════════════════════════════════════════════════════
        // PRESENTATION ROUTES - Slides JSON → PPTX/PDF
        // ═══════════════════════════════════════════════════════════════════════
        .route("/api/v1/presentation/info", get(handlers::presentation::presentation_info))
        .route("/api/v1/presentation/export/pptx", post(handlers::presentation::export_pptx))
        .route("/api/v1/presentation/export/pdf", post(handlers::presentation::export_slides_pdf))
        .route("/api/v1/presentation/export/png", post(handlers::presentation::export_slide_png))
        .route("/api/v1/presentation/export/svg", post(handlers::presentation::export_slide_svg))
        .route("/api/v1/presentation/export/all/png", post(handlers::presentation::export_all_slides_png))
        .route("/api/v1/presentation/export/all/svg", post(handlers::presentation::export_all_slides_svg))

        // ═══════════════════════════════════════════════════════════════════════
        // ASYNC JOB QUEUE ROUTES - MT-02: heavy document exports
        // ═══════════════════════════════════════════════════════════════════════
        .route("/api/v1/office/jobs/convert", post(handlers::jobs::submit_convert_job))
        .route("/api/v1/office/jobs/:id", get(handlers::jobs::get_job_status))

        // Middleware
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive())
        .with_state(state);

    // Start server
    let addr: std::net::SocketAddr = format!("0.0.0.0:{}", port).parse().unwrap();
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    tracing::info!("✅ signapps-office ready at http://localhost:{}", port);
    tracing::info!("📚 API endpoints:");
    tracing::info!("   - GET  /api/v1/convert/info");
    tracing::info!("   - POST /api/v1/convert");
    tracing::info!("   - POST /api/v1/convert/upload");
    tracing::info!("   - POST /api/v1/convert/batch");
    tracing::info!("   - GET  /api/v1/import/info");
    tracing::info!("   - POST /api/v1/import");
    tracing::info!("   - POST /api/v1/import/upload");
    tracing::info!("   - GET  /api/v1/spreadsheet/info");
    tracing::info!("   - POST /api/v1/spreadsheet/export");
    tracing::info!("   - POST /api/v1/spreadsheet/export/csv");
    tracing::info!("   - POST /api/v1/spreadsheet/export/ods");
    tracing::info!("   - POST /api/v1/spreadsheet/import");
    tracing::info!("   - POST /api/v1/spreadsheet/import/csv");
    tracing::info!("   - GET  /api/v1/pdf/info");
    tracing::info!("   - POST /api/v1/pdf/extract-text");
    tracing::info!("   - POST /api/v1/pdf/document-info");
    tracing::info!("   - POST /api/v1/pdf/pages");
    tracing::info!("   - POST /api/v1/pdf/merge");
    tracing::info!("   - POST /api/v1/pdf/split");
    tracing::info!("   - GET  /api/v1/presentation/info");
    tracing::info!("   - POST /api/v1/presentation/export/pptx");
    tracing::info!("   - POST /api/v1/presentation/export/pdf");
    tracing::info!("   - POST /api/v1/presentation/export/png");
    tracing::info!("   - POST /api/v1/presentation/export/svg");
    tracing::info!("   - POST /api/v1/presentation/export/all/png");
    tracing::info!("   - POST /api/v1/presentation/export/all/svg");
    tracing::info!("   - POST /api/v1/office/jobs/convert  [async queue]");
    tracing::info!("   - GET  /api/v1/office/jobs/:id      [job status]");
    axum::serve(listener, app).await.unwrap();
}
