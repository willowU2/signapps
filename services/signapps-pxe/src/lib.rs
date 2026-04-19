//! Public library interface for signapps-pxe.
//!
//! Exposes [`router`] so the single-binary runtime can mount the PXE +
//! Domain Controller HTTP routes (admin/infrastructure API on :3016)
//! without owning its own pool. Spawns the TFTP UDP listener, ProxyDHCP
//! listener, and DC protocol listeners (LDAP, Kerberos KDC, NTP, AD sync)
//! as detached tokio tasks tied to the service factory scope.
//!
//! All side-channel listeners (UDP :69, UDP :67, LDAP, KDC) are gated on
//! env flags and are best-effort: they log a warning and continue if
//! they fail (typically because they require privileged ports and the
//! dev box runs as an unprivileged user). The supervisor only treats
//! a failure of the :3016 HTTP listener as a crash.

// Pre-existing test scaffolding patterns inherited from when this crate
// was bin-only.
#![allow(clippy::assertions_on_constants)]

pub mod auto_enroll;
pub mod catalog;
pub mod dc;
pub mod dhcp_proxy;
pub mod handlers;
pub mod images;
pub mod models;
pub mod openapi;
pub mod sse;
pub mod tftp;

use axum::{
    routing::{delete, get, post},
    Router,
};
use signapps_common::auth::JwtConfig;
use signapps_common::bootstrap::env_or;
use signapps_common::middleware::{
    logging_middleware, optional_auth_middleware, request_id_middleware,
};
use signapps_db::DatabasePool;
use signapps_service::shared_state::SharedState;
use tokio::sync::watch;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::services::ServeDir;
use tower_http::trace::TraceLayer;

/// Application state for PXE + DC infrastructure service.
#[derive(Clone)]
pub struct AppState {
    pub db: DatabasePool,
    pub jwt_config: JwtConfig,
    /// Shared RBAC resolver injected by the runtime. `None` in tests.
    pub resolver: Option<
        std::sync::Arc<dyn signapps_common::rbac::resolver::OrgPermissionResolver>,
    >,
}

impl signapps_common::middleware::AuthState for AppState {
    fn jwt_config(&self) -> &JwtConfig {
        &self.jwt_config
    }
}

/// Resolve the TFTP UDP port for this process.
///
/// Resolution order:
/// 1. If `PXE_TFTP_PORT` is set and parses as `u16`, use it.
/// 2. If `PXE_MODE=root`, return `69` (standard TFTP, requires root).
/// 3. Otherwise (default "user" mode), return `6969` (non-privileged).
pub fn resolve_tftp_port() -> u16 {
    if let Ok(explicit) = std::env::var("PXE_TFTP_PORT") {
        if let Ok(p) = explicit.parse::<u16>() {
            return p;
        }
    }
    match std::env::var("PXE_MODE").as_deref() {
        Ok("root") => 69,
        _ => 6969,
    }
}

/// Resolve the ProxyDHCP UDP port for this process.
///
/// Resolution order:
/// 1. If `PXE_DHCP_PORT` is set and parses as `u16`, use it.
/// 2. If `PXE_MODE=root`, return `67` (standard DHCP, requires root AND
///    conflicts with any LAN DHCP server).
/// 3. Otherwise (default "user" mode), return `4011` (standard ProxyDHCP
///    port — non-privileged, does not conflict with regular DHCP).
pub fn resolve_dhcp_port() -> u16 {
    if let Ok(explicit) = std::env::var("PXE_DHCP_PORT") {
        if let Ok(p) = explicit.parse::<u16>() {
            return p;
        }
    }
    match std::env::var("PXE_MODE").as_deref() {
        Ok("root") => 67,
        _ => 4011,
    }
}

/// Health endpoint for the PXE service itself.
pub async fn health_check() -> axum::Json<serde_json::Value> {
    axum::Json(serde_json::json!({
        "status": "ok",
        "service": "signapps-pxe",
        "version": env!("CARGO_PKG_VERSION"),
        "uptime_seconds": signapps_common::healthz::uptime_seconds(),
        "app": {
            "id": "pxe",
            "label": "PXE Deploy",
            "description": "Déploiement réseau PXE + Domain Controller",
            "icon": "Server",
            "category": "Infrastructure",
            "color": "text-orange-600",
            "href": "/pxe",
            "port": 3016
        }
    }))
}

/// Health endpoint for the Domain Controller subsystem.
pub async fn dc_health_check() -> axum::Json<serde_json::Value> {
    axum::Json(serde_json::json!({
        "status": "ok",
        "service": "signapps-dc",
        "subsystem": "domain-controller",
        "version": env!("CARGO_PKG_VERSION"),
    }))
}

/// Build the PXE router using the shared runtime state. Also spawns the
/// TFTP UDP listener, ProxyDHCP listener, and DC protocol listeners as
/// detached tokio tasks inside the factory scope.
///
/// Listener gating:
///
/// * `PXE_ENABLE_TFTP` (default `false` in single-binary mode) — binds
///   UDP :69 for TFTP image serving. Requires root/Administrator on
///   the default port; log-and-skip on bind failure.
/// * `PXE_ENABLE_PROXY_DHCP` (default `false`) — binds UDP :4011 / :67
///   for ProxyDHCP. Log-and-skip on bind failure.
/// * `PXE_ENABLE_DC` (default `false`) — spawns DC protocol listeners
///   (LDAP :389, LDAPS :636, Kerberos KDC :88). Individual listeners
///   log-and-skip on failure.
///
/// Default is **all disabled** so the single-binary boots cleanly on a
/// dev machine without root. Production enables whichever it needs via
/// env.
///
/// # Errors
///
/// Returns an error if the boot directories cannot be created on disk.
pub async fn router(shared: SharedState) -> anyhow::Result<Router> {
    let state = build_state(&shared).await?;

    // Ensure HTTP boot / TFTP boot directories exist. Failure here is
    // fatal for the service — we can't serve PXE without them.
    let http_boot_dir = "data/pxe/httpboot";
    tokio::fs::create_dir_all(http_boot_dir).await?;
    tokio::fs::create_dir_all("data/pxe/tftpboot/images").await?;

    // TFTP UDP listener — gated on PXE_ENABLE_TFTP env flag. Default
    // enabled: with `PXE_MODE=user` (the default), TFTP binds to the
    // non-privileged port 6969, which a dev box can bind without root.
    let tftp_enabled: bool = env_or("PXE_ENABLE_TFTP", "true").parse().unwrap_or(true);
    if tftp_enabled {
        let tftp_port = resolve_tftp_port();
        tokio::spawn(async move {
            if let Err(e) = tftp::start_tftp_server("data/pxe/tftpboot", tftp_port).await {
                tracing::error!("TFTP Server failed (non-fatal — :3016 still serves): {}", e);
            }
        });
        tracing::info!("TFTP UDP :{} listener enabled", tftp_port);
    } else {
        tracing::info!("TFTP UDP listener disabled (set PXE_ENABLE_TFTP=true to enable)");
    }

    // ProxyDHCP listener — gated on PXE_ENABLE_PROXY_DHCP (default on,
    // uses port 4011 in user mode which is non-privileged).
    let proxy_dhcp_enabled: bool = env_or("PXE_ENABLE_PROXY_DHCP", "true")
        .parse()
        .unwrap_or(true);
    if proxy_dhcp_enabled {
        let db_for_auto_enroll = state.db.clone();
        let auto_enroll: bool = env_or("PXE_AUTO_ENROLL", "true").parse().unwrap_or(true);
        let proxy_config = dhcp_proxy::ProxyDhcpConfig {
            db: Some(db_for_auto_enroll),
            auto_enroll,
            ..dhcp_proxy::ProxyDhcpConfig::default()
        };
        let dhcp_port = resolve_dhcp_port();
        tokio::spawn(async move {
            if let Err(e) = dhcp_proxy::start_proxy_dhcp(proxy_config).await {
                tracing::warn!(
                    "ProxyDHCP server not started (may need elevated privileges): {}",
                    e
                );
            }
        });
        tracing::info!(
            "ProxyDHCP listener enabled on :{} (auto_enroll={})",
            dhcp_port,
            auto_enroll
        );
    } else {
        tracing::info!("ProxyDHCP listener disabled (set PXE_ENABLE_PROXY_DHCP=true to enable)");
    }

    // DC protocol listeners — gated on PXE_ENABLE_DC (default off in
    // single-binary mode). We use a channel local to this factory scope:
    // when the supervisor restarts the service, the sender is dropped
    // with the router and the DC listeners see `shutdown=true`.
    let dc_enabled: bool = env_or("PXE_ENABLE_DC", "false").parse().unwrap_or(false);
    if dc_enabled {
        let (_shutdown_tx, shutdown_rx) = watch::channel(false);
        if let Err(e) = dc::spawn_dc_listeners(state.db.clone(), shutdown_rx).await {
            tracing::warn!(
                "DC listeners could not be started (non-fatal — :3016 still serves): {}",
                e
            );
        }
        // Keep the sender alive for the lifetime of the tokio runtime.
        // `leak` is acceptable here because the sender only lives as long
        // as the runtime that owns the DC listener tasks.
        std::mem::forget(_shutdown_tx);
        tracing::info!("DC protocol listeners enabled");
    } else {
        tracing::info!("DC protocol listeners disabled (set PXE_ENABLE_DC=true to enable)");
    }

    Ok(create_router(state, http_boot_dir))
}

async fn build_state(shared: &SharedState) -> anyhow::Result<AppState> {
    Ok(AppState {
        db: shared.pool.clone(),
        jwt_config: (*shared.jwt).clone(),
        resolver: shared.resolver.clone(),
    })
}

/// Test-only routes mounted in debug builds. Returns an empty router in
/// release builds so the endpoints never ship to production.
#[cfg(debug_assertions)]
fn test_routes() -> Router<AppState> {
    Router::new().route(
        "/api/v1/pxe/_test/simulate-dhcp",
        post(handlers::test_simulate_dhcp),
    )
}

#[cfg(not(debug_assertions))]
fn test_routes() -> Router<AppState> {
    Router::new()
}

fn create_router(app_state: AppState, http_boot_dir: &str) -> Router {
    Router::new()
        .route("/health", get(health_check))
        .route("/dc/health", get(dc_health_check))
        .merge(signapps_common::version::router("signapps-pxe"))
        .nest_service("/boot", ServeDir::new(http_boot_dir))
        .route("/api/v1/pxe/health", get(health_check))
        .route("/api/v1/dc/health", get(dc_health_check))
        // Profiles
        .route(
            "/api/v1/pxe/profiles",
            get(handlers::list_profiles).post(handlers::create_profile),
        )
        .route(
            "/api/v1/pxe/profiles/:id",
            get(handlers::get_profile)
                .put(handlers::update_profile)
                .delete(handlers::delete_profile),
        )
        // PX5: Profile post-deploy hooks
        .route(
            "/api/v1/pxe/profiles/:id/hooks",
            get(images::get_profile_hooks).put(images::update_profile_hooks),
        )
        // Assets
        .route(
            "/api/v1/pxe/assets",
            get(handlers::list_assets).post(handlers::register_asset),
        )
        // S2.T4: auto-discovery surface (must be mounted BEFORE :id so the
        // literal `discovered` path wins over the `:id` extractor).
        .route(
            "/api/v1/pxe/assets/discovered",
            get(handlers::list_discovered),
        )
        .route(
            "/api/v1/pxe/assets/:mac/enroll",
            post(handlers::enroll_asset),
        )
        .route(
            "/api/v1/pxe/assets/:id",
            get(handlers::get_asset)
                .put(handlers::update_asset)
                .delete(handlers::delete_asset),
        )
        // S2.T5: DHCP debug surface
        .route(
            "/api/v1/pxe/dhcp/recent",
            get(handlers::list_recent_dhcp),
        )
        // Boot script
        .route("/api/v1/pxe/boot.ipxe", get(handlers::generate_ipxe_script))
        // PX2: Image management
        .route(
            "/api/v1/pxe/images",
            get(images::list_images).post(images::upload_image),
        )
        .route("/api/v1/pxe/images/:id", delete(images::delete_image))
        // PX3: Template generation
        .route(
            "/api/v1/pxe/templates/generate",
            post(images::generate_template),
        )
        // PX4: Deployment progress
        .route("/api/v1/pxe/deployments", get(images::list_deployments))
        .route(
            "/api/v1/pxe/deployments/:mac/progress",
            post(images::update_deployment_progress),
        )
        // S2.T7: SSE live progress stream
        .route(
            "/api/v1/pxe/deployments/:mac/stream",
            get(sse::stream_deployment),
        )
        // PX6: Golden image capture
        .route(
            "/api/v1/pxe/images/capture",
            post(images::capture_golden_image),
        )
        // Catalog: list and download OS images
        .route("/api/v1/pxe/catalog", get(catalog::list_catalog))
        .route(
            "/api/v1/pxe/catalog/:index/download",
            post(catalog::download_catalog_image),
        )
        // S2.T5: catalog sha256 verification
        .route("/api/v1/pxe/catalog/refresh", post(catalog::refresh_catalog))
        // S2.T11: test-only simulate-DHCP (debug builds only)
        .merge(test_routes())
        .merge(openapi::swagger_router())
        .layer(axum::middleware::from_fn_with_state(
            app_state.clone(),
            optional_auth_middleware::<AppState>,
        ))
        .layer({
            let allowed_origins: Vec<axum::http::HeaderValue> =
                std::env::var("CORS_ALLOWED_ORIGINS")
                    .unwrap_or_else(|_| "http://localhost:3000,http://127.0.0.1:3000".to_string())
                    .split(',')
                    .filter_map(|s| s.trim().parse().ok())
                    .collect();
            CorsLayer::new()
                .allow_origin(AllowOrigin::list(allowed_origins))
                .allow_methods([
                    axum::http::Method::GET,
                    axum::http::Method::POST,
                    axum::http::Method::PUT,
                    axum::http::Method::DELETE,
                    axum::http::Method::PATCH,
                    axum::http::Method::OPTIONS,
                ])
                .allow_headers([
                    axum::http::header::CONTENT_TYPE,
                    axum::http::header::AUTHORIZATION,
                    axum::http::HeaderName::from_static("x-request-id"),
                    axum::http::HeaderName::from_static("x-workspace-id"),
                ])
                .allow_credentials(true)
        })
        .layer(TraceLayer::new_for_http())
        .layer(axum::middleware::from_fn(logging_middleware))
        .layer(axum::middleware::from_fn(request_id_middleware))
        .with_state(app_state)
}

#[cfg(test)]
mod mode_tests {
    //! Tests for PXE port resolution via `PXE_MODE` / `PXE_TFTP_PORT` /
    //! `PXE_DHCP_PORT`. Env var tests are sequenced with a mutex because
    //! the process-global env is shared across tests when cargo runs
    //! them on multiple threads.
    use super::*;
    use std::sync::Mutex;

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn test_pxe_mode_user_gives_non_privileged_ports() {
        let _g = ENV_LOCK.lock().expect("env lock poisoned");
        std::env::set_var("PXE_MODE", "user");
        std::env::remove_var("PXE_TFTP_PORT");
        std::env::remove_var("PXE_DHCP_PORT");

        assert_eq!(resolve_tftp_port(), 6969);
        assert_eq!(resolve_dhcp_port(), 4011);
    }

    #[test]
    fn test_pxe_mode_root_gives_privileged_ports() {
        let _g = ENV_LOCK.lock().expect("env lock poisoned");
        std::env::set_var("PXE_MODE", "root");
        std::env::remove_var("PXE_TFTP_PORT");
        std::env::remove_var("PXE_DHCP_PORT");

        assert_eq!(resolve_tftp_port(), 69);
        assert_eq!(resolve_dhcp_port(), 67);
    }

    #[test]
    fn test_explicit_port_override_wins() {
        let _g = ENV_LOCK.lock().expect("env lock poisoned");
        std::env::set_var("PXE_MODE", "user");
        std::env::set_var("PXE_TFTP_PORT", "8080");
        std::env::set_var("PXE_DHCP_PORT", "9090");

        assert_eq!(resolve_tftp_port(), 8080);
        assert_eq!(resolve_dhcp_port(), 9090);

        std::env::remove_var("PXE_TFTP_PORT");
        std::env::remove_var("PXE_DHCP_PORT");
    }

    #[test]
    fn test_default_mode_gives_non_privileged_ports() {
        let _g = ENV_LOCK.lock().expect("env lock poisoned");
        std::env::remove_var("PXE_MODE");
        std::env::remove_var("PXE_TFTP_PORT");
        std::env::remove_var("PXE_DHCP_PORT");

        assert_eq!(resolve_tftp_port(), 6969);
        assert_eq!(resolve_dhcp_port(), 4011);
    }
}
