//! SignApps Storage Service - Documents and RAID management

use axum::{
    middleware,
    routing::{delete, get, post, put},
    Router,
};
use signapps_common::middleware::{auth_middleware, logging_middleware, request_id_middleware};
use signapps_common::{AuthState, JwtConfig};
use signapps_db::DatabasePool;
use std::net::SocketAddr;
use tower::ServiceBuilder;
use tower_http::cors::{Any, CorsLayer};

mod handlers;
mod jobs;
mod storage;

use handlers::{
    buckets, drive, external, favorites, files, health, mounts, permissions, preview, quotas, raid,
    search, shares, stats, storage_settings, trash,
};
use storage::StorageBackend;

/// Application state shared across handlers.
#[derive(Clone)]
pub struct AppState {
    pub pool: DatabasePool,
    pub storage: StorageBackend,
    pub jwt_config: JwtConfig,
}

impl AuthState for AppState {
    fn jwt_config(&self) -> &JwtConfig {
        &self.jwt_config
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "signapps_storage=debug,tower_http=debug,info".into()),
        )
        .init();

    tracing::info!(
        "Starting SignApps Storage Service v{}",
        env!("CARGO_PKG_VERSION")
    );

    // Load .env file
    dotenvy::dotenv().ok();

    // Load configuration
    let database_url =
        std::env::var("DATABASE_URL").unwrap_or_else(|_| "postgres://localhost/signapps".into());
    let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "dev-secret-change-me".into());
    let storage_mode = std::env::var("STORAGE_MODE").unwrap_or_else(|_| "fs".into());

    // Initialize database pool
    let pool = signapps_db::create_pool(&database_url).await?;
    tracing::info!("Database connection established");

    // Run migrations
    signapps_db::run_migrations(&pool).await?;
    tracing::info!("Database migrations completed");

    // Initialize storage backend
    let storage = match storage_mode.as_str() {
        "s3" => {
            let endpoint = std::env::var("STORAGE_S3_ENDPOINT")
                .unwrap_or_else(|_| "http://localhost:9000".into());
            let access_key =
                std::env::var("STORAGE_S3_ACCESS_KEY").unwrap_or_else(|_| "minioadmin".into());
            let secret_key =
                std::env::var("STORAGE_S3_SECRET_KEY").unwrap_or_else(|_| "minioadmin".into());
            let region = std::env::var("STORAGE_S3_REGION").unwrap_or_else(|_| "us-east-1".into());
            let bucket = std::env::var("STORAGE_S3_BUCKET").unwrap_or_else(|_| "signapps".into());

            StorageBackend::new_s3(&endpoint, &access_key, &secret_key, &region, &bucket)?
        },
        _ => {
            let root = std::env::var("STORAGE_FS_ROOT").unwrap_or_else(|_| "./data/storage".into());
            // Ensure root directory exists
            std::fs::create_dir_all(&root).ok();
            StorageBackend::new_fs(&root)?
        },
    };
    tracing::info!("Storage backend initialized");

    // JWT configuration
    let jwt_config = JwtConfig {
        secret: jwt_secret,
        issuer: "signapps".to_string(),
        audience: "signapps-storage".to_string(),
        access_expiration: 900,
        refresh_expiration: 604800,
    };

    // Create application state
    let state = AppState {
        pool,
        storage,
        jwt_config,
    };

    // Start background jobs
    jobs::start_cron_scheduler(state.clone())
        .await
        .map_err(|e| anyhow::anyhow!("Failed to start cron: {}", e))?;

    // Build router
    let app = create_router(state);

    // Start server
    let port: u16 = std::env::var("SERVER_PORT")
        .unwrap_or_else(|_| "3004".into())
        .parse()
        .unwrap_or(3004);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));

    tracing::info!("Listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

/// Create the application router with all routes.
fn create_router(state: AppState) -> Router {
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

    // Protected bucket routes
    let bucket_routes = Router::new()
        .route("/buckets", get(buckets::list))
        .route("/buckets", post(buckets::create))
        .route("/buckets/:name", get(buckets::get))
        .route("/buckets/:name", delete(buckets::delete));

    // Protected Drive VFS routes
    let drive_routes = Router::new()
        .route(
            "/drive/nodes",
            post(drive::create_node).get(drive::list_nodes),
        )
        .route("/drive/nodes/root", get(drive::list_nodes))
        .route("/drive/nodes/:id/children", get(drive::list_nodes))
        .route("/drive/nodes/:id", put(drive::update_node))
        .route("/drive/nodes/:id", delete(drive::delete_node));

    // Protected RAID routes (arrays)
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

    // Protected RAID routes (disks)
    let raid_disk_routes = Router::new()
        .route("/raid/disks", get(raid::list_disks))
        .route("/raid/disks/:id", get(raid::get_disk))
        .route("/raid/disks/scan", post(raid::scan_disks));

    // Protected RAID routes (events and health)
    let raid_other_routes = Router::new()
        .route("/raid/events", get(raid::list_events))
        .route("/raid/health", get(raid::get_health));

    // === NAS Features ===

    // Sharing routes
    let share_routes = Router::new()
        .route("/shares", get(shares::list_shares))
        .route("/shares", post(shares::create_share))
        .route("/shares/:id", get(shares::get_share))
        .route("/shares/:id", put(shares::update_share))
        .route("/shares/:id", delete(shares::delete_share));

    // Public share access (no auth required)
    let public_share_routes = Router::new()
        .route("/shares/:token/access", post(shares::access_share))
        .route("/shares/:token/download", get(shares::download_shared));

    // Trash/Recycle bin routes
    let trash_routes = Router::new()
        .route("/trash", get(trash::list_trash))
        .route("/trash", post(trash::move_to_trash))
        .route("/trash", delete(trash::empty_trash))
        .route("/trash/stats", get(trash::get_trash_stats))
        .route("/trash/:id", get(trash::get_trash_item))
        .route("/trash/:id", delete(trash::delete_trash_item_handler))
        .route("/trash/restore", post(trash::restore_from_trash));

    // Favorites routes
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

    // Search routes
    let search_routes = Router::new()
        .route("/search", get(search::search))
        .route("/search/quick", get(search::quick_search))
        .route("/search/recent", get(search::recent_files))
        .route("/search/suggest", get(search::suggest));

    // Quota routes
    let quota_routes = Router::new()
        .route("/quotas/me", get(quotas::get_my_quota))
        .route("/quotas/me/alerts", get(quotas::get_quota_alerts))
        .route("/quotas/users/:user_id", get(quotas::get_user_quota))
        .route("/quotas/users/:user_id", put(quotas::set_user_quota))
        .route("/quotas/users/:user_id", delete(quotas::delete_user_quota))
        .route(
            "/quotas/users/:user_id/recalculate",
            post(quotas::recalculate_usage),
        )
        .route("/quotas/over-limit", get(quotas::get_users_over_quota));

    // Preview routes (action before bucket to avoid wildcard conflicts)
    let preview_routes = Router::new()
        .route("/preview/view/:bucket/*key", get(preview::get_preview))
        .route("/preview/info/:bucket/*key", get(preview::get_preview_info))
        .route(
            "/preview/thumbnail/:bucket/*key",
            get(preview::get_thumbnail),
        );

    // Permissions routes
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

    // Tags routes
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

    // Versions routes
    let versions_routes = Router::new()
        .route(
            "/files/:file_id/versions",
            get(handlers::versions::list_versions),
        )
        .route(
            "/files/:file_id/versions/:version_id/restore",
            post(handlers::versions::restore_version),
        );

    // Mount management routes
    let mount_routes = Router::new()
        .route("/mounts", get(mounts::list_mounts))
        .route("/mounts", post(mounts::mount))
        .route("/mounts/*path", delete(mounts::unmount));

    // External storage routes
    let external_routes = Router::new()
        .route("/external", get(external::list_external))
        .route("/external", post(external::connect_external))
        .route("/external/:id", delete(external::disconnect_external));

    // Stats route
    let stats_routes = Router::new().route("/stats", get(stats::get_stats));

    // Admin Storage Settings routes
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

    // Combine protected routes
    let protected_routes = Router::new()
        .merge(file_routes)
        .merge(bucket_routes)
        .merge(drive_routes)
        .merge(raid_array_routes)
        .merge(raid_disk_routes)
        .merge(raid_other_routes)
        .merge(share_routes)
        .merge(trash_routes)
        .merge(favorites_routes)
        .merge(search_routes)
        .merge(quota_routes)
        .merge(preview_routes)
        .merge(permissions_routes)
        .merge(tags_routes)
        .merge(versions_routes)
        .merge(mount_routes)
        .merge(external_routes)
        .merge(stats_routes)
        .merge(storage_settings_routes)
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    // CORS configuration
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Combine all routes into a single v1 router to prevent path shadowing
    let v1_routes = public_routes
        .merge(public_share_routes)
        .merge(protected_routes);

    Router::new()
        .nest("/api/v1", v1_routes)
        .layer(
            ServiceBuilder::new()
                .layer(middleware::from_fn(request_id_middleware))
                .layer(middleware::from_fn(logging_middleware))
                .layer(cors),
        )
        .with_state(state)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_app_state_clone() {
        // Verify AppState is Clone
        fn assert_clone<T: Clone>() {}
        assert_clone::<AppState>();
    }
}
