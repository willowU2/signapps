//! Public library interface for signapps-vault.
//!
//! Exposes [`router`] so the single-binary runtime (`signapps-platform`)
//! can mount the encrypted secrets vault routes without owning its own
//! pool or JWT config.

#![allow(clippy::assertions_on_constants)]

pub mod handlers;
pub mod vault_crypto;

use axum::{
    middleware,
    routing::{delete, get, post, put},
    Router,
};
use signapps_common::middleware::{auth_middleware, tenant_context_middleware, AuthState};
use signapps_common::JwtConfig;
use signapps_service::shared_state::SharedState;
use tower_http::{
    cors::{AllowOrigin, CorsLayer},
    trace::TraceLayer,
};

// ---------------------------------------------------------------------------
// Application state
// ---------------------------------------------------------------------------

/// Application state shared across vault handlers.
#[derive(Clone)]
pub struct AppState {
    pub pool: sqlx::PgPool,
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

/// Build the vault router using the shared runtime state.
///
/// # Errors
///
/// Returns an error if shared-state cloning fails (none currently, but reserved).
pub async fn router(shared: SharedState) -> anyhow::Result<Router> {
    let state = build_state(&shared).await?;
    Ok(create_router(state))
}

async fn build_state(shared: &SharedState) -> anyhow::Result<AppState> {
    // NOTE: vault does not currently use signapps_keystore; it has its own
    // vault_crypto module. The shared keystore (`shared.keystore.clone()`)
    // is therefore intentionally NOT re-unlocked here — the platform
    // already unlocked it once in SharedState::init_once and any future
    // wiring must reuse that Arc rather than calling Keystore::init again.
    Ok(AppState {
        pool: shared.pool.inner().clone(),
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
        ])
        .allow_credentials(true);

    let public_routes = Router::new()
        .route("/health", get(health_check))
        .merge(signapps_common::version::router("signapps-vault"));

    let vault_routes = Router::new()
        // Keys (3)
        .route("/api/v1/vault/keys", post(handlers::vault::init_keys))
        .route("/api/v1/vault/keys", get(handlers::vault::get_keys))
        .route("/api/v1/vault/keys", put(handlers::vault::update_keys))
        // Items (4)
        .route("/api/v1/vault/items", get(handlers::vault::list_items))
        .route("/api/v1/vault/items", post(handlers::vault::create_item))
        .route("/api/v1/vault/items/:id", put(handlers::vault::update_item))
        .route("/api/v1/vault/items/:id", delete(handlers::vault::delete_item))
        // Folders (4)
        .route("/api/v1/vault/folders", get(handlers::vault::list_folders))
        .route("/api/v1/vault/folders", post(handlers::vault::create_folder))
        .route("/api/v1/vault/folders/:id", put(handlers::vault::update_folder))
        .route("/api/v1/vault/folders/:id", delete(handlers::vault::delete_folder))
        // Shares (3)
        .route("/api/v1/vault/shares", post(handlers::vault::create_share))
        .route("/api/v1/vault/shares/:id", delete(handlers::vault::delete_share))
        .route("/api/v1/vault/shared-with-me", get(handlers::vault::shared_with_me))
        // TOTP (1)
        .route("/api/v1/vault/items/:id/totp", post(handlers::vault::get_totp_code))
        // Password generator (1)
        .route("/api/v1/vault/generate-password", get(handlers::vault::generate_password))
        // Org keys (2)
        .route("/api/v1/vault/org-keys", put(handlers::vault::upsert_org_key))
        .route("/api/v1/vault/org-keys/:group_id", get(handlers::vault::get_org_key))
        // Audit (1)
        .route("/api/v1/vault/audit", get(handlers::vault::list_audit))
        // Settings (2)
        .route("/api/v1/vault/settings", get(handlers::vault::get_vault_settings))
        .route("/api/v1/vault/settings", put(handlers::vault::update_vault_settings))
        // Browse sessions (2)
        .route("/api/v1/vault/browse/start", post(handlers::vault::start_browse))
        .route("/api/v1/vault/browse/:token", delete(handlers::vault::end_browse))
        .route_layer(middleware::from_fn(tenant_context_middleware))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    public_routes
        .merge(vault_routes)
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
        "service": "signapps-vault",
        "version": env!("CARGO_PKG_VERSION"),
        "uptime_seconds": signapps_common::healthz::uptime_seconds(),
        "app": {
            "id": "vault",
            "label": "Coffre-fort",
            "description": "Stockage sécurisé de secrets et mots de passe",
            "icon": "Lock",
            "category": "Productivité",
            "color": "text-slate-600",
            "href": "/vault",
            "port": 3025
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
        let pool = sqlx::PgPool::connect_lazy("postgres://fake:fake@localhost/fake")
            .expect("connect_lazy never fails");
        let jwt_config = JwtConfig::hs256("test-secret-that-is-at-least-32-bytes-long".to_string());
        AppState {
            pool,
            jwt_config,
            resolver: None,
        }
    }

    /// Verify the router can be constructed without panicking.
    /// Catches regressions like duplicate route registration or handler signature mismatches.
    #[tokio::test]
    async fn router_builds_successfully() {
        let app = create_router(make_state());
        assert!(std::mem::size_of_val(&app) > 0);
    }

    /// Verify the health endpoint exists and returns 200.
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
