use axum::{
    middleware,
    routing::{delete, get, post, put},
    Router,
};
use office::OfficeState;

/// Build the office sub-router (all stateless document-conversion routes).
/// Originally served from `signapps-office` on port 3018.
fn office_router() -> Router<OfficeState> {
    use office::handlers;
    Router::new()
        // Conversion routes
        .route("/api/v1/convert/info", get(handlers::conversion::info))
        .route("/api/v1/convert", post(handlers::conversion::convert_json))
        .route("/api/v1/convert/upload", post(handlers::conversion::convert_upload))
        .route("/api/v1/convert/batch", post(handlers::conversion::convert_batch))
        .route("/api/v1/convert/legacy", post(office::api::convert::handle_convert))
        // Import routes
        .route("/api/v1/import/info", get(handlers::import::info))
        .route("/api/v1/import", post(handlers::import::import_json))
        .route("/api/v1/import/upload", post(handlers::import::import_upload))
        // Spreadsheet routes
        .route("/api/v1/spreadsheet/info", get(handlers::spreadsheet::spreadsheet_info))
        .route("/api/v1/spreadsheet/export", post(handlers::spreadsheet::export_spreadsheet))
        .route("/api/v1/spreadsheet/export/csv", post(handlers::spreadsheet::export_csv_handler))
        .route("/api/v1/spreadsheet/export/ods", post(handlers::spreadsheet::export_ods_handler))
        .route("/api/v1/spreadsheet/import", post(handlers::spreadsheet::import_spreadsheet))
        .route("/api/v1/spreadsheet/import/csv", post(handlers::spreadsheet::import_csv_text))
        // PDF routes
        .route("/api/v1/pdf/info", get(handlers::pdf::pdf_info))
        .route("/api/v1/pdf/extract-text", post(handlers::pdf::extract_pdf_text))
        .route("/api/v1/pdf/document-info", post(handlers::pdf::get_pdf_document_info))
        .route("/api/v1/pdf/pages", post(handlers::pdf::get_pdf_pages))
        .route("/api/v1/pdf/merge", post(handlers::pdf::merge_pdf_files))
        .route("/api/v1/pdf/split", post(handlers::pdf::split_pdf_file))
        // Presentation routes
        .route("/api/v1/presentation/info", get(handlers::presentation::presentation_info))
        .route("/api/v1/presentation/export/pptx", post(handlers::presentation::export_pptx))
        .route("/api/v1/presentation/export/pdf", post(handlers::presentation::export_slides_pdf))
        .route("/api/v1/presentation/export/png", post(handlers::presentation::export_slide_png))
        .route("/api/v1/presentation/export/svg", post(handlers::presentation::export_slide_svg))
        .route("/api/v1/presentation/export/all/png", post(handlers::presentation::export_all_slides_png))
        .route("/api/v1/presentation/export/all/svg", post(handlers::presentation::export_all_slides_svg))
        // Data import/export routes
        .route("/api/v1/data/import/info", get(handlers::data_import::import_info))
        .route("/api/v1/data/import", post(handlers::data_import::import_data))
        .route("/api/v1/data/export/info", get(handlers::data_export::export_info))
        .route("/api/v1/data/export", post(handlers::data_export::export_data))
        // Reports routes
        .route("/api/v1/reports/info", get(handlers::report::report_info))
        .route("/api/v1/reports/generate", post(handlers::report::generate_report))
        // Async job queue routes
        .route("/api/v1/office/jobs/convert", post(handlers::jobs::submit_convert_job))
        .route("/api/v1/office/jobs/:id", get(handlers::jobs::get_job_status))
}
use signapps_cache::CacheService;
use signapps_common::bootstrap::{init_tracing, load_env, ServiceConfig};
use signapps_common::middleware::{auth_middleware, tenant_context_middleware};
use signapps_common::{AuthState, JwtConfig};
use signapps_sharing::routes::sharing_routes;
use signapps_sharing::{ResourceType, SharingEngine};
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

mod handlers;
mod models;
mod office;
mod utils;

use handlers::classify::classify_document;
use handlers::designs::{create_design, delete_design, get_design, list_designs, update_design};
use handlers::health::health_handler;
use handlers::macros::{create_macro, delete_macro, list_macros, update_macro};
use handlers::notes::{create_note, delete_note, list_notes, update_note};
use handlers::templates::{create_template, delete_template, get_template, list_templates};
use handlers::types::{board, chat, sheet, slide, text};
use handlers::websocket::websocket_handler;
use signapps_common::AiIndexerClient;

#[derive(Clone)]
/// Application state for the docs service.
pub struct AppState {
    pub pool: signapps_db::DatabasePool,
    pub cache: Arc<CacheService>,
    pub docs: Arc<dashmap::DashMap<String, yrs::Doc>>,
    pub broadcasts: Arc<dashmap::DashMap<String, tokio::sync::broadcast::Sender<Vec<u8>>>>,
    pub indexer: AiIndexerClient,
    pub jwt_config: JwtConfig,
    pub sharing: SharingEngine,
}

impl AuthState for AppState {
    fn jwt_config(&self) -> &JwtConfig {
        &self.jwt_config
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize using bootstrap helpers
    init_tracing("signapps_docs");
    load_env();

    let config = ServiceConfig::from_env("signapps-docs", 3010);
    config.log_startup();

    // Initialize database
    let pool = signapps_db::create_pool(&config.database_url).await?;

    // Initialize cache
    let cache = Arc::new(CacheService::new(1000, Duration::from_secs(3600)));

    // Initialize JWT config
    let jwt_config = config.jwt_config();

    // Initialize sharing engine (replaces legacy document_permissions)
    let sharing_engine = SharingEngine::new(pool.inner().clone(), CacheService::default_config());

    // Initialize app state
    let app_state = AppState {
        pool: pool.clone(),
        cache,
        docs: Arc::new(dashmap::DashMap::new()),
        broadcasts: Arc::new(dashmap::DashMap::new()),
        indexer: AiIndexerClient::from_env(),
        jwt_config,
        sharing: sharing_engine.clone(),
    };

    // Build router with document type endpoints
    // Public routes (no auth required)
    let public_routes = Router::new().route("/health", get(health_handler));

    // Protected routes (auth required)
    let protected_routes = Router::new()
        // WebSocket endpoint for real-time collaboration
        .route("/api/v1/docs/:doc_type/:doc_id/ws", get(websocket_handler))
        // y-websocket sends connections to /{base}/{roomname} without /ws suffix
        .route("/api/v1/docs/:doc_type/:doc_id", get(websocket_handler))

        // Document creation endpoints
        .route("/api/v1/docs/text", post(text::create_document))
        .route("/api/v1/docs/sheet", post(sheet::create_sheet))
        .route("/api/v1/docs/sheet/:doc_id/rows", get(sheet::get_rows))
        .route("/api/v1/docs/slide", post(slide::create_presentation))
        .route("/api/v1/docs/slide/:doc_id/slides", get(slide::get_slides))
        .route("/api/v1/docs/board", post(board::create_board))
        .route("/api/v1/docs/board/:doc_id/columns", get(board::get_columns))
        // Chat channels
        .route("/api/v1/docs/chat", post(chat::create_channel))
        .route("/api/v1/channels", get(chat::get_channels))
        .route("/api/v1/channels/:channel_id", get(chat::get_channel))
        .route("/api/v1/channels/:channel_id", put(chat::update_channel))
        .route("/api/v1/channels/:channel_id", delete(chat::delete_channel))
        // Channel members
        .route("/api/v1/channels/:channel_id/members", get(chat::get_channel_members))
        .route("/api/v1/channels/:channel_id/members", post(chat::add_channel_member))
        .route("/api/v1/channels/:channel_id/members/:user_id", delete(chat::remove_channel_member))
        // Direct messages
        .route("/api/v1/dms", get(chat::get_direct_messages))
        .route("/api/v1/dms", post(chat::create_direct_message))
        .route("/api/v1/dms/:id", delete(chat::delete_direct_message))
        // Channel read status (unread counts)
        .route("/api/v1/channels/:channel_id/read-status", get(chat::get_channel_read_status))
        .route("/api/v1/channels/:channel_id/read-status", post(chat::mark_channel_read))
        .route("/api/v1/channels/:channel_id/increment-unread", post(chat::increment_unread_count))
        .route("/api/v1/unread-counts", get(chat::get_all_unread_counts))

        // Document templates
        .route("/api/v1/docs/templates", get(list_templates))
        .route("/api/v1/docs/templates", post(create_template))
        .route("/api/v1/docs/templates/:id", get(get_template))
        .route("/api/v1/docs/templates/:id", delete(delete_template))
        // Sheet macros
        .route("/api/v1/docs/:doc_id/macros", get(list_macros))
        .route("/api/v1/docs/:doc_id/macros", post(create_macro))
        .route("/api/v1/docs/:doc_id/macros/:macro_id", put(update_macro))
        .route("/api/v1/docs/:doc_id/macros/:macro_id", delete(delete_macro))
        // Design files
        .route("/api/v1/designs", get(list_designs))
        .route("/api/v1/designs", post(create_design))
        .route("/api/v1/designs/:id", get(get_design))
        .route("/api/v1/designs/:id", put(update_design))
        .route("/api/v1/designs/:id", delete(delete_design))
        // Document classification (IDEA-106)
        .route("/api/v1/docs/classify", post(classify_document))
        // Quick notes (Drive sidebar)
        .route("/api/v1/keep/notes", get(list_notes))
        .route("/api/v1/keep/notes", post(create_note))
        .route("/api/v1/keep/notes/:id", put(update_note))
        .route("/api/v1/keep/notes/:id", delete(delete_note))
        // Collab WebSocket alias — originally signapps-collab (port 3013), now served from port 3010
        // Old URL: ws://localhost:3013/api/v1/collab/ws/:doc_id
        // New URL: ws://localhost:3010/api/v1/collab/ws/:doc_id
        .route("/api/v1/collab/ws/:doc_id", get(handlers::collab::collab_websocket_handler))
        .route_layer(middleware::from_fn(tenant_context_middleware))
        .route_layer(middleware::from_fn_with_state(
            app_state.clone(),
            auth_middleware::<AppState>,
        ));

    // Sharing sub-router: State<SharingEngine> — uses the same engine as AppState.
    let sharing_sub = sharing_routes("documents", ResourceType::Document)
        .with_state(app_state.sharing.clone());

    // Office sub-router: stateless document conversion/import/export (formerly signapps-office, port 3018).
    // Routes preserved: /api/v1/convert, /api/v1/import, /api/v1/spreadsheet,
    //   /api/v1/pdf, /api/v1/presentation, /api/v1/data, /api/v1/reports, /api/v1/office/jobs
    let office_state = OfficeState::new();
    let office_sub = office_router().with_state(office_state);

    let app = public_routes
        .merge(protected_routes)
        .merge(sharing_sub)
        .merge(office_sub)
        .merge(
            SwaggerUi::new("/swagger-ui")
                .url("/api-docs/openapi.json", handlers::openapi::DocsApiDoc::openapi()),
        )
        // Global middleware
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::new()
            .allow_origin(AllowOrigin::list([
                "http://localhost:3000".parse().expect("valid origin"),
                "http://127.0.0.1:3000".parse().expect("valid origin"),
            ]))
            .allow_credentials(true)
            .allow_methods([axum::http::Method::GET, axum::http::Method::POST, axum::http::Method::PUT, axum::http::Method::PATCH, axum::http::Method::DELETE, axum::http::Method::OPTIONS])
            .allow_headers([axum::http::header::CONTENT_TYPE, axum::http::header::AUTHORIZATION, axum::http::header::ACCEPT, axum::http::header::ORIGIN, axum::http::HeaderName::from_static("x-workspace-id"), axum::http::HeaderName::from_static("x-request-id")]))
        .layer(axum::extract::DefaultBodyLimit::max(100 * 1024 * 1024)) // 100MB for large docs
        // State
        .with_state(app_state);

    // Run server
    tracing::info!("🎨 signapps-docs ready (Text, Sheet, Slide, Board)");

    let addr: std::net::SocketAddr = format!("{}:{}", config.host, config.port)
        .parse()
        .expect("server address is valid");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    tracing::info!(
        "✅ signapps-docs listening at http://localhost:{}",
        config.port
    );
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(signapps_common::graceful_shutdown())
    .await?;
    Ok(())
}
