//! Public library interface for signapps-backup.
//!
//! Exposes [`router`] so the single-binary runtime (`signapps-platform`)
//! can mount the backup management routes (PostgreSQL dump, list backups)
//! without owning its own JWT config.

#![allow(clippy::assertions_on_constants)]

pub mod handlers;

use axum::{
    middleware,
    routing::{get, post},
    Router,
};
use signapps_common::middleware::{auth_middleware, require_admin, AuthState};
use signapps_common::JwtConfig;
use signapps_service::shared_state::SharedState;
use tower_http::{
    cors::{AllowOrigin, CorsLayer},
    trace::TraceLayer,
};

// ---------------------------------------------------------------------------
// Application state
// ---------------------------------------------------------------------------

/// Application state shared across backup handlers.
#[derive(Clone)]
pub struct AppState {
    pub jwt_config: JwtConfig,
    /// Shared RBAC resolver injected by the runtime. `None` in tests.
    pub resolver: Option<
        std::sync::Arc<dyn signapps_common::rbac::resolver::OrgPermissionResolver>,
    >,
}

impl AuthState for AppState {
    fn jwt_config(&self) -> &JwtConfig {
        &self.jwt_config
    }
}

/// Build the backup router using the shared runtime state.
///
/// # Errors
///
/// Returns an error if shared-state cloning fails (none currently, but reserved).
pub async fn router(shared: SharedState) -> anyhow::Result<Router> {
    let state = build_state(&shared).await?;
    Ok(create_router(state))
}

async fn build_state(shared: &SharedState) -> anyhow::Result<AppState> {
    Ok(AppState {
        jwt_config: (*shared.jwt).clone(),
        resolver: shared.resolver.clone(),
    })
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

pub fn create_router(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list([
            "http://localhost:3000".parse().expect("valid CORS origin"),
            "http://127.0.0.1:3000".parse().expect("valid CORS origin"),
        ]))
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::OPTIONS,
        ])
        .allow_headers([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::AUTHORIZATION,
            axum::http::header::ACCEPT,
            axum::http::header::ORIGIN,
            axum::http::HeaderName::from_static("x-workspace-id"),
            axum::http::HeaderName::from_static("x-request-id"),
        ])
        .allow_credentials(true);

    let public_routes = Router::new()
        .route("/health", get(health_check))
        .merge(signapps_common::version::router("signapps-backup"));

    let backup_routes = Router::new()
        .route(
            "/api/v1/admin/backup",
            post(handlers::backup::create_backup),
        )
        .route("/api/v1/admin/backups", get(handlers::backup::list_backups))
        .route_layer(middleware::from_fn(require_admin))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    public_routes
        .merge(backup_routes)
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state)
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

pub async fn health_check() -> axum::Json<serde_json::Value> {
    axum::Json(serde_json::json!({
        "status": "ok",
        "service": "signapps-backup",
        "version": env!("CARGO_PKG_VERSION"),
        "uptime_seconds": signapps_common::healthz::uptime_seconds(),
        "app": {
            "id": "backup",
            "label": "Sauvegardes",
            "description": "Gestion des sauvegardes de la base de données",
            "icon": "Archive",
            "category": "Administration",
            "color": "text-slate-400",
            "href": "/admin/backups",
            "port": 3031
        }
    }))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use tower::ServiceExt;

    fn make_state() -> AppState {
        let jwt_config = JwtConfig::hs256("test-secret-that-is-at-least-32-bytes-long".to_string());
        AppState {
            jwt_config,
            resolver: None,
        }
    }

    #[tokio::test]
    async fn router_builds_successfully() {
        let app = create_router(make_state());
        assert!(std::mem::size_of_val(&app) > 0);
    }

    #[tokio::test]
    async fn health_endpoint_returns_200() {
        let app = create_router(make_state());
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/health")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }
}
