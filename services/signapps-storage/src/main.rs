//! SignApps Storage Service - Documents and RAID management

use axum::{
    middleware,
    routing::{delete, get, post, put},
    Router,
};
use signapps_common::middleware::{
    auth_middleware, logging_middleware, request_id_middleware, require_admin,
};
use signapps_common::{AuthState, JwtConfig};
use signapps_db::DatabasePool;
use std::net::SocketAddr;
use tower::ServiceBuilder;
use tower_http::cors::{Any, CorsLayer};

mod handlers;
mod minio;

use handlers::{buckets, files, health, raid};
use minio::MinioClient;

/// Application state shared across handlers.
#[derive(Clone)]
pub struct AppState {
    pub pool: DatabasePool,
    pub minio: MinioClient,
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

    tracing::info!("Starting SignApps Storage Service v{}", env!("CARGO_PKG_VERSION"));

    // Load configuration
    let database_url =
        std::env::var("DATABASE_URL").unwrap_or_else(|_| "postgres://localhost/signapps".into());
    let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "dev-secret-change-me".into());
    let minio_endpoint =
        std::env::var("MINIO_ENDPOINT").unwrap_or_else(|_| "http://localhost:9000".into());
    let minio_access_key =
        std::env::var("MINIO_ACCESS_KEY").unwrap_or_else(|_| "minioadmin".into());
    let minio_secret_key =
        std::env::var("MINIO_SECRET_KEY").unwrap_or_else(|_| "minioadmin".into());
    let minio_region = std::env::var("MINIO_REGION").unwrap_or_else(|_| "us-east-1".into());

    // Initialize database pool
    let pool = signapps_db::create_pool(&database_url).await?;
    tracing::info!("Database connection established");

    // Run migrations
    signapps_db::run_migrations(&pool).await?;
    tracing::info!("Database migrations completed");

    // Initialize MinIO client
    let minio = MinioClient::new(&minio_endpoint, &minio_access_key, &minio_secret_key, &minio_region).await?;
    tracing::info!("MinIO client initialized");

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
        minio,
        jwt_config,
    };

    // Build router
    let app = create_router(state);

    // Start server
    let port: u16 = std::env::var("PORT")
        .unwrap_or_else(|_| "3003".into())
        .parse()
        .unwrap_or(3003);
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
    let file_routes = Router::new()
        .route("/files/:bucket", get(files::list))
        .route("/files/:bucket", post(files::upload))
        .route("/files/:bucket/*key", get(files::download))
        .route("/files/:bucket/*key", put(files::upload_with_key))
        .route("/files/:bucket/*key", delete(files::delete))
        .route("/files/:bucket/*key/info", get(files::get_info))
        .route("/files/:bucket/batch", delete(files::delete_many))
        .route("/files/copy", post(files::copy))
        .route("/files/move", post(files::move_file));

    // Protected bucket routes
    let bucket_routes = Router::new()
        .route("/buckets", get(buckets::list))
        .route("/buckets", post(buckets::create))
        .route("/buckets/:name", get(buckets::get))
        .route("/buckets/:name", delete(buckets::delete));

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

    // Combine protected routes
    let protected_routes = Router::new()
        .merge(file_routes)
        .merge(bucket_routes)
        .merge(raid_array_routes)
        .merge(raid_disk_routes)
        .merge(raid_other_routes)
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    // Admin routes (require admin role)
    let admin_routes = Router::new()
        // Admin-only RAID operations could go here
        .route_layer(middleware::from_fn(require_admin))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    // CORS configuration
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Combine all routes
    Router::new()
        .nest("/api/v1", public_routes)
        .nest("/api/v1", protected_routes)
        .nest("/api/v1/admin", admin_routes)
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
