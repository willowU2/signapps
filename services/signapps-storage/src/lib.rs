//! Public library interface for signapps-storage.
//!
//! Exposes [`router`] so the single-binary runtime can mount the
//! storage routes without owning its own pool.

pub mod handlers;
pub mod jobs;
pub mod middleware;
pub mod services;
pub mod storage;

use axum::{
    middleware as axum_mw,
    routing::{any, delete, get, post, put},
    Router,
};
use signapps_common::bootstrap::env_or;
use signapps_common::middleware::{
    auth_middleware, logging_middleware, request_id_middleware, require_admin,
    tenant_context_middleware,
};
use signapps_common::pg_events::PgEventBus;
use signapps_common::{AiIndexerClient, AuthState, JwtConfig};
use signapps_db::DatabasePool;
use signapps_service::shared_state::SharedState;
use signapps_sharing::{
    engine::SharingEngine,
    routes::{sharing_global_routes, sharing_routes},
    types::ResourceType,
};
use tower::ServiceBuilder;
use tower_http::cors::{AllowOrigin, CorsLayer};
use utoipa::OpenApi as _;
use utoipa_swagger_ui::SwaggerUi;

use handlers::openapi::StorageApiDoc;
use handlers::{
    acl, audit, backups, buckets, drive, external, favorites, files, health, mounts, permissions,
    preview, quotas, raid, search, shares, stats, storage_settings, trash, webdav,
};
use storage::StorageBackend;

/// Application state shared across handlers.
#[derive(Clone)]
pub struct AppState {
    pub pool: DatabasePool,
    pub storage: StorageBackend,
    pub jwt_config: JwtConfig,
    pub indexer: AiIndexerClient,
    pub cache: signapps_cache::CacheService,
    pub event_bus: PgEventBus,
    pub sharing: SharingEngine,
}

impl AuthState for AppState {
    fn jwt_config(&self) -> &JwtConfig {
        &self.jwt_config
    }
}

/// Build the storage router using the shared runtime state.
///
/// # Errors
///
/// Returns an error if the storage backend cannot be initialized or if
/// the cron scheduler fails to start.
pub async fn router(shared: SharedState) -> anyhow::Result<Router> {
    let state = build_state(&shared).await?;

    // Start background jobs.
    jobs::start_cron_scheduler(state.clone())
        .await
        .map_err(|e| anyhow::anyhow!("Failed to start cron: {}", e))?;

    // Spawn drive audit alert worker (checks every 60 seconds).
    let alert_pool = state.pool.inner().clone();
    tokio::spawn(async move {
        services::alert_worker::run(alert_pool).await;
    });

    // Spawn drive backup worker (checks every 60 seconds).
    let backup_pool = state.pool.clone();
    tokio::spawn(async move {
        services::backup_worker::run(backup_pool).await;
    });

    let sharing_engine = state.sharing.clone();
    Ok(create_router(state, sharing_engine))
}

async fn build_state(shared: &SharedState) -> anyhow::Result<AppState> {
    let storage_mode = env_or("STORAGE_MODE", "fs");
    let storage = match storage_mode.as_str() {
        "s3" => {
            let endpoint = env_or("STORAGE_S3_ENDPOINT", "http://localhost:9000");
            let access_key = env_or("STORAGE_S3_ACCESS_KEY", "minioadmin");
            let secret_key = env_or("STORAGE_S3_SECRET_KEY", "minioadmin");
            let region = env_or("STORAGE_S3_REGION", "us-east-1");
            let bucket = env_or("STORAGE_S3_BUCKET", "signapps");
            StorageBackend::new_s3(&endpoint, &access_key, &secret_key, &region, &bucket)?
        },
        _ => {
            let root = env_or("STORAGE_FS_ROOT", "./data/storage");
            std::fs::create_dir_all(&root).ok();
            StorageBackend::new_fs(&root)?
        },
    };
    tracing::info!("Storage backend initialized");

    let cache = (*shared.cache).clone();
    let sharing = SharingEngine::new(shared.pool.inner().clone(), cache.clone());
    tracing::info!("Sharing engine initialized");

    Ok(AppState {
        pool: shared.pool.clone(),
        storage,
        jwt_config: (*shared.jwt).clone(),
        indexer: AiIndexerClient::from_env(),
        cache,
        event_bus: (*shared.event_bus).clone(),
        sharing,
    })
}

/// Create the application router with all routes.
fn create_router(state: AppState, sharing_engine: SharingEngine) -> Router {
    // Public routes (health check)
    let public_routes = Router::new().route("/health", get(health::health_check));

    // Protected file routes (require authentication)
    // Note: Route order matters - specific routes before wildcards
    let file_routes = Router::new()
        .route("/files/copy", post(files::copy))
        .route("/files/move", post(files::move_file))
        .route("/files/:bucket/batch", delete(files::delete_many))
        .route("/files/:bucket/info/*key", get(files::get_info))
        .route("/files/:bucket", get(files::list))
        .route("/files/:bucket", post(files::upload))
        .route("/files/:bucket/*key", get(files::download))
        .route("/files/:bucket/*key", put(files::upload_with_key))
        .route("/files/:bucket/*key", delete(files::delete));

    let bucket_routes = Router::new()
        .route("/buckets", get(buckets::list))
        .route("/buckets", post(buckets::create))
        .route("/buckets/:name", get(buckets::get))
        .route("/buckets/:name", delete(buckets::delete));

    let drive_routes = Router::new()
        .route(
            "/drive/nodes",
            post(drive::create_node).get(drive::list_nodes),
        )
        .route("/drive/nodes/root", get(drive::list_nodes))
        .route("/drive/nodes/:id/children", get(drive::list_nodes))
        .route("/drive/nodes/:id/download", get(drive::download_node))
        .route("/drive/nodes/:id/share", post(drive::create_node_share))
        .route("/drive/nodes/:id", put(drive::update_node))
        .route("/drive/nodes/:id", delete(drive::delete_node));

    let acl_routes = Router::new()
        .route("/drive/nodes/:id/acl", get(acl::list_acl))
        .route("/drive/nodes/:id/acl", post(acl::create_acl))
        .route("/drive/nodes/:id/acl/:acl_id", put(acl::update_acl))
        .route("/drive/nodes/:id/acl/:acl_id", delete(acl::delete_acl))
        .route("/drive/nodes/:id/acl/break", post(acl::break_inheritance))
        .route(
            "/drive/nodes/:id/acl/restore",
            post(acl::restore_inheritance),
        )
        .route("/drive/nodes/:id/effective-acl", get(acl::effective_acl))
        .route_layer(axum_mw::from_fn_with_state(
            state.clone(),
            crate::middleware::acl_check::acl_check_middleware,
        ));

    let raid_array_routes = Router::new()
        .route("/raid/arrays", get(raid::list_arrays))
        .route("/raid/arrays/:id", get(raid::get_array))
        .route("/raid/arrays/name/:name", get(raid::get_array_by_name))
        .route("/raid/arrays/:id", delete(raid::delete_array))
        .route("/raid/arrays/:id/rebuild", post(raid::rebuild_array))
        .route("/raid/arrays/:id/disks", post(raid::add_disk_to_array))
        .route(
            "/raid/arrays/:array_id/disks/:disk_id",
            delete(raid::remove_disk_from_array),
        )
        .route("/raid/arrays/:id/events", get(raid::get_array_events));

    let raid_disk_routes = Router::new()
        .route("/raid/disks", get(raid::list_disks))
        .route("/raid/disks/:id", get(raid::get_disk))
        .route("/raid/disks/scan", post(raid::scan_disks));

    let raid_other_routes = Router::new()
        .route("/raid/events", get(raid::list_events))
        .route("/raid/health", get(raid::get_health));

    let share_routes = Router::new()
        .route("/shares", get(shares::list_shares))
        .route("/shares", post(shares::create_share))
        .route("/shares/:id", get(shares::get_share))
        .route("/shares/:id", put(shares::update_share))
        .route("/shares/:id", delete(shares::delete_share));

    let public_share_routes = Router::new()
        .route("/shares/:token/access", post(shares::access_share))
        .route("/shares/:token/download", get(shares::download_shared));

    let trash_routes = Router::new()
        .route("/trash", get(trash::list_trash))
        .route("/trash", post(trash::move_to_trash))
        .route("/trash", delete(trash::empty_trash))
        .route("/trash/stats", get(trash::get_trash_stats))
        .route("/trash/:id", get(trash::get_trash_item))
        .route("/trash/:id", delete(trash::delete_trash_item_handler))
        .route("/trash/restore", post(trash::restore_from_trash));

    let favorites_routes = Router::new()
        .route("/favorites", get(favorites::list_favorites))
        .route("/favorites", post(favorites::add_favorite))
        .route("/favorites/reorder", post(favorites::reorder_favorites))
        .route("/favorites/:id", get(favorites::get_favorite))
        .route("/favorites/:id", put(favorites::update_favorite))
        .route("/favorites/:id", delete(favorites::remove_favorite))
        .route(
            "/favorites/check/:bucket/*key",
            get(favorites::check_favorite),
        )
        .route(
            "/favorites/path/:bucket/*key",
            delete(favorites::remove_favorite_by_path),
        );

    let search_routes = Router::new()
        .route("/search", get(search::search))
        .route("/search/quick", get(search::quick_search))
        .route("/search/recent", get(search::recent_files))
        .route("/search/suggest", get(search::suggest))
        .route("/search/omni", get(search::omni_search))
        .route("/search/content", get(search::search_content));

    let user_quota_routes = Router::new()
        .route("/quotas/me", get(quotas::get_my_quota))
        .route("/quotas/me/alerts", get(quotas::get_quota_alerts));

    let admin_quota_routes = Router::new()
        .route("/quotas/users/:user_id", get(quotas::get_user_quota))
        .route("/quotas/users/:user_id", put(quotas::set_user_quota))
        .route("/quotas/users/:user_id", delete(quotas::delete_user_quota))
        .route(
            "/quotas/users/:user_id/recalculate",
            post(quotas::recalculate_usage),
        )
        .route("/quotas/over-limit", get(quotas::get_users_over_quota));

    let preview_routes = Router::new()
        .route("/preview/view/:bucket/*key", get(preview::get_preview))
        .route("/preview/info/:bucket/*key", get(preview::get_preview_info))
        .route(
            "/preview/generate/:bucket/*key",
            post(preview::generate_preview),
        )
        .route(
            "/preview/thumbnail/:bucket/*key",
            get(preview::get_thumbnail),
        )
        .route(
            "/preview/archive/:bucket/*key",
            get(preview::get_archive_listing),
        )
        .route(
            "/preview/document-metadata/:bucket/*key",
            get(preview::get_document_metadata),
        );

    let permissions_routes = Router::new()
        .route(
            "/permissions/:bucket/*key",
            get(permissions::get_permissions),
        )
        .route(
            "/permissions/:bucket/*key",
            put(permissions::set_permissions),
        )
        .route(
            "/permissions/:bucket/*key",
            delete(permissions::reset_permissions),
        );

    let tags_routes = Router::new()
        .route("/tags", get(handlers::tags::list_tags))
        .route("/tags", post(handlers::tags::create_tag))
        .route("/tags/:tag_id", put(handlers::tags::update_tag))
        .route("/tags/:tag_id", delete(handlers::tags::delete_tag))
        .route("/files/:file_id/tags", get(handlers::tags::list_file_tags))
        .route(
            "/files/:file_id/tags/:tag_id",
            post(handlers::tags::add_file_tag),
        )
        .route(
            "/files/:file_id/tags/:tag_id",
            delete(handlers::tags::remove_file_tag),
        );

    let versions_routes = Router::new()
        .route(
            "/files/:file_id/versions",
            get(handlers::versions::list_versions),
        )
        .route(
            "/files/:file_id/versions/:version_id/restore",
            post(handlers::versions::restore_version),
        )
        .route(
            "/files/:file_id/versions/:version_id/download",
            get(handlers::versions::download_version),
        );

    let mount_routes = Router::new()
        .route("/mounts", get(mounts::list_mounts))
        .route("/mounts", post(mounts::mount))
        .route("/mounts/*path", delete(mounts::unmount));

    let external_routes = Router::new()
        .route("/external", get(external::list_external))
        .route("/external", post(external::connect_external))
        .route("/external/:id", delete(external::disconnect_external));

    let stats_routes = Router::new().route("/stats", get(stats::get_stats));

    let audit_routes = Router::new()
        .route("/drive/audit", get(audit::list_audit))
        .route("/drive/audit/verify", get(audit::verify_chain))
        .route("/drive/audit/export", post(audit::export_audit))
        .route("/drive/audit/alerts", get(audit::list_alerts))
        .route("/drive/audit/alerts/config", get(audit::get_alert_config))
        .route(
            "/drive/audit/alerts/config",
            put(audit::update_alert_config),
        );

    let storage_settings_routes = Router::new()
        .route("/storage_rules", get(storage_settings::list_storage_rules))
        .route(
            "/storage_rules",
            post(storage_settings::create_storage_rule),
        )
        .route(
            "/storage_rules/:id",
            put(storage_settings::update_storage_rule),
        )
        .route(
            "/storage_rules/:id",
            delete(storage_settings::delete_storage_rule),
        )
        .route(
            "/indexing_rules",
            get(storage_settings::list_indexing_rules),
        )
        .route(
            "/indexing_rules",
            post(storage_settings::create_indexing_rule),
        )
        .route(
            "/indexing_rules/:id",
            put(storage_settings::update_indexing_rule),
        )
        .route(
            "/indexing_rules/:id",
            delete(storage_settings::delete_indexing_rule),
        )
        .route("/settings/:key", get(storage_settings::get_system_setting))
        .route(
            "/settings/:key",
            put(storage_settings::update_system_setting),
        );

    let backup_routes = Router::new()
        .route("/backups/plans", get(backups::list_plans))
        .route("/backups/plans", post(backups::create_plan))
        .route("/backups/plans/:id", put(backups::update_plan))
        .route("/backups/plans/:id", delete(backups::delete_plan))
        .route("/backups/plans/:id/run", post(backups::run_plan))
        .route("/backups/snapshots", get(backups::list_snapshots))
        .route("/backups/snapshots/:id", get(backups::get_snapshot))
        .route("/backups/snapshots/:id", delete(backups::delete_snapshot))
        .route("/backups/restore", post(backups::restore));

    let admin_routes = Router::new()
        .merge(admin_quota_routes)
        .merge(storage_settings_routes)
        .merge(mount_routes)
        .merge(external_routes)
        .merge(audit_routes)
        .merge(backup_routes)
        .route_layer(axum_mw::from_fn(require_admin))
        .route_layer(axum_mw::from_fn(tenant_context_middleware))
        .route_layer(axum_mw::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    let protected_routes = Router::new()
        .merge(file_routes)
        .merge(bucket_routes)
        .merge(drive_routes)
        .merge(acl_routes)
        .merge(raid_array_routes)
        .merge(raid_disk_routes)
        .merge(raid_other_routes)
        .merge(share_routes)
        .merge(trash_routes)
        .merge(favorites_routes)
        .merge(search_routes)
        .merge(user_quota_routes)
        .merge(preview_routes)
        .merge(permissions_routes)
        .merge(tags_routes)
        .merge(versions_routes)
        .merge(stats_routes)
        .route_layer(axum_mw::from_fn(tenant_context_middleware))
        .route_layer(axum_mw::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    let cors = CorsLayer::new()
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
            "x-workspace-id"
                .parse()
                .expect("x-workspace-id is a valid header name"),
        ]);

    let webdav_admin_routes = Router::new()
        .route("/webdav/config", get(webdav::get_webdav_config))
        .route("/webdav/config", put(webdav::update_webdav_config))
        .route_layer(axum_mw::from_fn(require_admin))
        .route_layer(axum_mw::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    let public_files_routes =
        Router::new().route("/files/system-fonts/*key", get(files::download_public));

    let v1_routes = public_routes
        .merge(public_files_routes)
        .merge(public_share_routes)
        .merge(admin_routes)
        .merge(protected_routes)
        .merge(webdav_admin_routes);

    let webdav_routes = Router::new()
        .route("/webdav", any(webdav::webdav_dispatch))
        .route("/webdav/", any(webdav::webdav_dispatch))
        .route("/webdav/*path", any(webdav::webdav_dispatch))
        .route_layer(axum_mw::from_fn_with_state(
            state.clone(),
            webdav::webdav_auth,
        ));

    let root_health = Router::new().route("/health", get(health::health_check));

    let openapi_routes =
        SwaggerUi::new("/swagger-ui").url("/api/v1/openapi.json", StorageApiDoc::openapi());

    let files_sharing =
        sharing_routes("files", ResourceType::File).with_state(sharing_engine.clone());
    let folders_sharing =
        sharing_routes("folders", ResourceType::Folder).with_state(sharing_engine.clone());
    let global_sharing = sharing_global_routes().with_state(sharing_engine);

    Router::new()
        .merge(root_health)
        .merge(signapps_common::version::router("signapps-storage"))
        .merge(webdav_routes)
        .merge(openapi_routes)
        .merge(files_sharing)
        .merge(folders_sharing)
        .merge(global_sharing)
        .nest("/api/v1", v1_routes)
        .layer(
            ServiceBuilder::new()
                .layer(axum_mw::from_fn(request_id_middleware))
                .layer(axum_mw::from_fn(logging_middleware))
                .layer(cors),
        )
        .layer(axum::extract::DefaultBodyLimit::max(100 * 1024 * 1024))
        .with_state(state)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_app_state_clone() {
        fn assert_clone<T: Clone>() {}
        assert_clone::<AppState>();
    }
}
