//! Public library interface for signapps-docs.
//!
//! Exposes [`router`] so the single-binary runtime (`signapps-platform`)
//! can mount the document collaboration / Tiptap / Y-CRDT routes
//! (text/sheet/slide/board/chat) plus the merged `office` (port 3018,
//! conversion/import/export) and `collab` (port 3013) routes without
//! owning its own pool, cache or JWT config.
//!
//! The Y-CRDT room registry (`Arc<DashMap<String, yrs::Doc>>`) and the
//! per-room broadcast channels live inside [`AppState`] so all
//! WebSocket upgrade handlers (`/api/v1/docs/:doc_type/:doc_id/ws`,
//! `/api/v1/collab/ws/:doc_id`) reference them through the shared
//! Axum state without changes.

#![allow(
    clippy::assertions_on_constants,
    clippy::should_implement_trait,
    clippy::approx_constant,
    clippy::redundant_closure
)]

pub mod handlers;
pub mod models;
pub mod office;
pub mod utils;

use axum::{
    middleware,
    routing::{delete, get, post, put},
    Router,
};
use office::OfficeState;
use signapps_cache::CacheService;
use signapps_common::middleware::{auth_middleware, tenant_context_middleware};
use signapps_common::rbac::{
    document_from_path, rbac_layer, resolver::OrgPermissionResolver, types::Action,
};
use signapps_common::{AiIndexerClient, AuthState, JwtConfig};
use signapps_service::shared_state::SharedState;
use signapps_sharing::routes::sharing_routes;
use signapps_sharing::{ResourceType, SharingEngine};
use std::sync::Arc;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use handlers::classify::classify_document;
use handlers::designs::{create_design, delete_design, get_design, list_designs, update_design};
use handlers::health::health_handler;
use handlers::macros::{create_macro, delete_macro, list_macros, update_macro};
use handlers::notes::{create_note, delete_note, list_notes, update_note};
use handlers::sheet_formats::{
    batch_upsert_formats, delete_format, get_metadata, list_formats, upsert_format, upsert_metadata,
};
use handlers::templates::{create_template, delete_template, get_template, list_templates};
use handlers::types::{board, chat, sheet, slide, text};
use handlers::websocket::websocket_handler;

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
    /// Shared RBAC resolver injected by the runtime. `None` in tests.
    pub resolver: Option<Arc<dyn OrgPermissionResolver>>,
}

impl AuthState for AppState {
    fn jwt_config(&self) -> &JwtConfig {
        &self.jwt_config
    }
}

/// Build the docs router using the shared runtime state.
///
/// # Errors
///
/// Returns an error if shared-state cloning fails (none currently, but reserved).
pub async fn router(shared: SharedState) -> anyhow::Result<Router> {
    let state = build_state(&shared).await?;
    Ok(create_router(state))
}

async fn build_state(shared: &SharedState) -> anyhow::Result<AppState> {
    let pool = shared.pool.clone();
    let sharing_engine = SharingEngine::new(pool.inner().clone(), CacheService::default_config());

    Ok(AppState {
        pool,
        cache: shared.cache.clone(),
        docs: Arc::new(dashmap::DashMap::new()),
        broadcasts: Arc::new(dashmap::DashMap::new()),
        indexer: AiIndexerClient::from_env(),
        jwt_config: (*shared.jwt).clone(),
        sharing: sharing_engine,
        resolver: shared.resolver.clone(),
    })
}

/// Build the office sub-router (all stateless document-conversion routes).
fn office_router() -> Router<OfficeState> {
    use office::handlers;
    Router::new()
        .route("/api/v1/convert/info", get(handlers::conversion::info))
        .route("/api/v1/convert", post(handlers::conversion::convert_json))
        .route(
            "/api/v1/convert/upload",
            post(handlers::conversion::convert_upload),
        )
        .route(
            "/api/v1/convert/batch",
            post(handlers::conversion::convert_batch),
        )
        .route(
            "/api/v1/convert/legacy",
            post(office::api::convert::handle_convert),
        )
        .route("/api/v1/import/info", get(handlers::import::info))
        .route("/api/v1/import", post(handlers::import::import_json))
        .route(
            "/api/v1/import/upload",
            post(handlers::import::import_upload),
        )
        .route(
            "/api/v1/spreadsheet/info",
            get(handlers::spreadsheet::spreadsheet_info),
        )
        .route(
            "/api/v1/spreadsheet/export",
            post(handlers::spreadsheet::export_spreadsheet),
        )
        .route(
            "/api/v1/spreadsheet/export/csv",
            post(handlers::spreadsheet::export_csv_handler),
        )
        .route(
            "/api/v1/spreadsheet/export/ods",
            post(handlers::spreadsheet::export_ods_handler),
        )
        .route(
            "/api/v1/spreadsheet/import",
            post(handlers::spreadsheet::import_spreadsheet),
        )
        .route(
            "/api/v1/spreadsheet/import/csv",
            post(handlers::spreadsheet::import_csv_text),
        )
        .route("/api/v1/pdf/info", get(handlers::pdf::pdf_info))
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
        .route(
            "/api/v1/presentation/info",
            get(handlers::presentation::presentation_info),
        )
        .route(
            "/api/v1/presentation/export/pptx",
            post(handlers::presentation::export_pptx),
        )
        .route(
            "/api/v1/presentation/export/pdf",
            post(handlers::presentation::export_slides_pdf),
        )
        .route(
            "/api/v1/presentation/export/png",
            post(handlers::presentation::export_slide_png),
        )
        .route(
            "/api/v1/presentation/export/svg",
            post(handlers::presentation::export_slide_svg),
        )
        .route(
            "/api/v1/presentation/export/all/png",
            post(handlers::presentation::export_all_slides_png),
        )
        .route(
            "/api/v1/presentation/export/all/svg",
            post(handlers::presentation::export_all_slides_svg),
        )
        .route(
            "/api/v1/data/import/info",
            get(handlers::data_import::import_info),
        )
        .route(
            "/api/v1/data/import",
            post(handlers::data_import::import_data),
        )
        .route(
            "/api/v1/data/export/info",
            get(handlers::data_export::export_info),
        )
        .route(
            "/api/v1/data/export",
            post(handlers::data_export::export_data),
        )
        .route("/api/v1/reports/info", get(handlers::report::report_info))
        .route(
            "/api/v1/reports/generate",
            post(handlers::report::generate_report),
        )
        .route(
            "/api/v1/office/jobs/convert",
            post(handlers::jobs::submit_convert_job),
        )
        .route(
            "/api/v1/office/jobs/:id",
            get(handlers::jobs::get_job_status),
        )
        .route(
            "/api/v1/filters/formats",
            get(handlers::filters::list_formats),
        )
        .route(
            "/api/v1/filters/import",
            post(handlers::filters::import_file),
        )
        .route(
            "/api/v1/filters/export",
            post(handlers::filters::export_file),
        )
        .route(
            "/api/v1/filters/convert",
            post(handlers::filters::convert_file),
        )
}

pub fn create_router(app_state: AppState) -> Router {
    let public_routes = Router::new()
        .route("/health", get(health_handler))
        .merge(signapps_common::version::router("signapps-docs"))
        .route("/api/v1/fonts/manifest", get(handlers::fonts::get_manifest))
        .route(
            "/api/v1/fonts/files/:family/:variant",
            get(handlers::fonts::get_font_file),
        )
        .route(
            "/api/v1/drawing/render/svg",
            post(handlers::drawing::render_svg),
        )
        .route(
            "/api/v1/drawing/render/png",
            post(handlers::drawing::render_png),
        )
        .route(
            "/api/v1/drawing/charts",
            post(handlers::drawing::generate_chart),
        )
        .route(
            "/api/v1/render/document",
            post(handlers::server_render::render_document),
        )
        .route(
            "/api/v1/render/slide",
            post(handlers::server_render::render_slide),
        )
        .route(
            "/api/v1/render/thumbnail",
            post(handlers::server_render::render_thumbnail),
        )
        .route(
            "/api/v1/render/template",
            post(handlers::server_render::render_template),
        );

    // W4 unified RBAC — a narrow subset of routes with UUID in path get
    // the resolver guard alongside the existing auth middleware. The
    // resolver is optional so tests that build AppState directly don't
    // need a live pool-backed resolver.
    let rbac_guard = app_state.resolver.clone().map(|resolver| {
        axum::middleware::from_fn(rbac_layer(resolver, Action::Read, document_from_path))
    });

    let protected_routes = Router::new()
        .route("/api/v1/docs/:doc_type/:doc_id/ws", get(websocket_handler))
        .route("/api/v1/docs/:doc_type/:doc_id", get(websocket_handler))
        .route("/api/v1/docs/text", post(text::create_document))
        .route("/api/v1/docs/sheet", post(sheet::create_sheet))
        .route("/api/v1/docs/sheet/:doc_id/rows", get(sheet::get_rows))
        .route("/api/v1/docs/slide", post(slide::create_presentation))
        .route("/api/v1/docs/slide/:doc_id/slides", get(slide::get_slides))
        .route("/api/v1/docs/board", post(board::create_board))
        .route(
            "/api/v1/docs/board/:doc_id/columns",
            get(board::get_columns),
        )
        .route("/api/v1/docs/chat", post(chat::create_channel))
        .route("/api/v1/channels", get(chat::get_channels))
        .route("/api/v1/channels/:channel_id", get(chat::get_channel))
        .route("/api/v1/channels/:channel_id", put(chat::update_channel))
        .route("/api/v1/channels/:channel_id", delete(chat::delete_channel))
        .route(
            "/api/v1/channels/:channel_id/members",
            get(chat::get_channel_members),
        )
        .route(
            "/api/v1/channels/:channel_id/members",
            post(chat::add_channel_member),
        )
        .route(
            "/api/v1/channels/:channel_id/members/:user_id",
            delete(chat::remove_channel_member),
        )
        .route("/api/v1/dms", get(chat::get_direct_messages))
        .route("/api/v1/dms", post(chat::create_direct_message))
        .route("/api/v1/dms/:id", delete(chat::delete_direct_message))
        .route(
            "/api/v1/channels/:channel_id/read-status",
            get(chat::get_channel_read_status),
        )
        .route(
            "/api/v1/channels/:channel_id/read-status",
            post(chat::mark_channel_read),
        )
        .route(
            "/api/v1/channels/:channel_id/increment-unread",
            post(chat::increment_unread_count),
        )
        .route("/api/v1/unread-counts", get(chat::get_all_unread_counts))
        .route("/api/v1/docs/templates", get(list_templates))
        .route("/api/v1/docs/templates", post(create_template))
        .route("/api/v1/docs/templates/:id", get(get_template))
        .route("/api/v1/docs/templates/:id", delete(delete_template))
        .route("/api/v1/docs/:doc_id/macros", get(list_macros))
        .route("/api/v1/docs/:doc_id/macros", post(create_macro))
        .route("/api/v1/docs/:doc_id/macros/:macro_id", put(update_macro))
        .route(
            "/api/v1/docs/:doc_id/macros/:macro_id",
            delete(delete_macro),
        )
        .route("/api/v1/designs", get(list_designs))
        .route("/api/v1/designs", post(create_design))
        .route("/api/v1/designs/:id", get(get_design))
        .route("/api/v1/designs/:id", put(update_design))
        .route("/api/v1/designs/:id", delete(delete_design))
        .route("/api/v1/docs/classify", post(classify_document))
        .route("/api/v1/keep/notes", get(list_notes))
        .route("/api/v1/keep/notes", post(create_note))
        .route("/api/v1/keep/notes/:id", put(update_note))
        .route("/api/v1/keep/notes/:id", delete(delete_note))
        .route(
            "/api/v1/styles",
            get(handlers::styles::list_styles).post(handlers::styles::create_style),
        )
        .route(
            "/api/v1/styles/templates/:template_id",
            get(handlers::styles::list_template_styles),
        )
        .route(
            "/api/v1/styles/:id",
            get(handlers::styles::get_style)
                .put(handlers::styles::update_style)
                .delete(handlers::styles::delete_style),
        )
        .route(
            "/api/v1/styles/:id/resolved",
            get(handlers::styles::get_resolved_style),
        )
        .route(
            "/api/v1/presentations",
            post(handlers::presentations::create_presentation),
        )
        .route(
            "/api/v1/presentations/:doc_id",
            get(handlers::presentations::get_presentation)
                .put(handlers::presentations::update_presentation),
        )
        .route(
            "/api/v1/presentations/:doc_id/layouts",
            get(handlers::presentations::list_layouts),
        )
        .route(
            "/api/v1/presentations/:doc_id/slides",
            get(handlers::presentations::list_slides).post(handlers::presentations::create_slide),
        )
        .route(
            "/api/v1/presentations/:doc_id/slides/reorder",
            put(handlers::presentations::reorder_slides),
        )
        .route(
            "/api/v1/presentations/:doc_id/slides/:slide_id",
            put(handlers::presentations::update_slide)
                .delete(handlers::presentations::delete_slide),
        )
        .route("/api/v1/sheets/:doc_id/formats", get(list_formats))
        .route(
            "/api/v1/sheets/:doc_id/formats/batch",
            post(batch_upsert_formats),
        )
        .route(
            "/api/v1/sheets/:doc_id/formats/:cell_ref",
            put(upsert_format),
        )
        .route(
            "/api/v1/sheets/:doc_id/formats/:cell_ref",
            delete(delete_format),
        )
        .route("/api/v1/sheets/:doc_id/metadata", get(get_metadata))
        .route("/api/v1/sheets/:doc_id/metadata", put(upsert_metadata))
        .route(
            "/api/v1/versions/:doc_id/commands",
            post(handlers::versions::append_command).get(handlers::versions::list_commands),
        )
        .route(
            "/api/v1/versions/:doc_id/undo",
            post(handlers::versions::undo_last_command),
        )
        .route(
            "/api/v1/versions/:doc_id/snapshots",
            post(handlers::versions::create_snapshot).get(handlers::versions::list_snapshots),
        )
        .route(
            "/api/v1/versions/:doc_id/snapshots/diff",
            post(handlers::versions::diff_snapshots),
        )
        .route(
            "/api/v1/versions/:doc_id/snapshots/:id",
            get(handlers::versions::get_snapshot),
        )
        .route(
            "/api/v1/versions/:doc_id/snapshots/:id/restore",
            post(handlers::versions::restore_snapshot),
        )
        .route(
            "/api/v1/templates/:id/variables",
            get(handlers::template_vars::list_variables)
                .post(handlers::template_vars::create_variable),
        )
        .route(
            "/api/v1/templates/:id/variables/:var_id",
            delete(handlers::template_vars::delete_variable),
        )
        .route(
            "/api/v1/templates/:id/resolve",
            post(handlers::template_vars::resolve_variables),
        )
        .route(
            "/api/v1/templates/:id/batch-export",
            post(handlers::template_vars::batch_export),
        )
        .route(
            "/api/v1/social-presets",
            get(handlers::template_vars::list_social_presets),
        )
        .route(
            "/api/v1/social-presets/:platform",
            get(handlers::template_vars::list_social_presets_by_platform),
        )
        .route(
            "/api/v1/validation/rules",
            get(handlers::validation::list_rules).post(handlers::validation::create_rule),
        )
        .route(
            "/api/v1/validation/rules/:id",
            put(handlers::validation::update_rule).delete(handlers::validation::delete_rule),
        )
        .route(
            "/api/v1/validation/check",
            post(handlers::validation::check_document),
        )
        .route(
            "/api/v1/collab/ws/:doc_id",
            get(handlers::collab::collab_websocket_handler),
        )
        .route_layer(middleware::from_fn(tenant_context_middleware))
        .route_layer(middleware::from_fn_with_state(
            app_state.clone(),
            auth_middleware::<AppState>,
        ));

    let protected_routes = if let Some(guard) = rbac_guard {
        protected_routes.route_layer(guard)
    } else {
        protected_routes
    };

    let sharing_sub =
        sharing_routes("documents", ResourceType::Document).with_state(app_state.sharing.clone());

    let office_state = OfficeState::new();
    let office_sub = office_router().with_state(office_state);

    public_routes
        .merge(protected_routes)
        .merge(sharing_sub)
        .merge(office_sub)
        .merge(SwaggerUi::new("/swagger-ui").url(
            "/api-docs/openapi.json",
            handlers::openapi::DocsApiDoc::openapi(),
        ))
        .layer(TraceLayer::new_for_http())
        .layer(
            CorsLayer::new()
                .allow_origin(AllowOrigin::list([
                    "http://localhost:3000".parse().expect("valid origin"),
                    "http://127.0.0.1:3000".parse().expect("valid origin"),
                ]))
                .allow_credentials(true)
                .allow_methods([
                    axum::http::Method::GET,
                    axum::http::Method::POST,
                    axum::http::Method::PUT,
                    axum::http::Method::PATCH,
                    axum::http::Method::DELETE,
                    axum::http::Method::OPTIONS,
                ])
                .allow_headers([
                    axum::http::header::CONTENT_TYPE,
                    axum::http::header::AUTHORIZATION,
                    axum::http::header::ACCEPT,
                    axum::http::header::ORIGIN,
                    axum::http::HeaderName::from_static("x-workspace-id"),
                    axum::http::HeaderName::from_static("x-request-id"),
                ]),
        )
        .layer(axum::extract::DefaultBodyLimit::max(100 * 1024 * 1024))
        .with_state(app_state)
}
