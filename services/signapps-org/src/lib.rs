//! Public library interface for `signapps-org`.
//!
//! Exposes [`router`] so the single-binary runtime (`signapps-platform`)
//! can mount the organizational structure routes without owning its own
//! pool, keystore or JWT config.
//!
//! As of the S1 org+RBAC refonte this service carries:
//! - the pre-existing org-chart / tree / assignment endpoints used by
//!   the admin UI,
//! - the new canonical `/api/v1/org/*` surface consolidating nodes,
//!   persons, assignments, policies, boards, grants, AD and
//!   provisioning,
//! - the public `/g/:token` grant-redirect route.

#![allow(clippy::assertions_on_constants)]

pub mod ad;
pub mod event_publisher;
pub mod events;
pub mod grants;
pub mod handlers;
pub mod middleware;
pub mod rbac_client;

use std::sync::Arc;

use axum::{
    middleware as axum_middleware,
    routing::{get, post, put},
    Router,
};
use signapps_common::middleware::{auth_middleware, AuthState};
use signapps_common::pg_events::PgEventBus;
use signapps_common::JwtConfig;
use signapps_db::DatabasePool;
use signapps_keystore::Keystore;
use signapps_service::shared_state::SharedState;
use tower_http::{
    cors::{AllowOrigin, CorsLayer},
    trace::TraceLayer,
};

// ---------------------------------------------------------------------------
// Application state
// ---------------------------------------------------------------------------

/// Application state shared across org handlers.
///
/// `keystore` and `event_bus` are propagated from the runtime so that the
/// W3 AD-sync workers and the W5 provisioning dispatcher can read the
/// encrypted `org_ad_config.bind_password` and publish canonical events
/// without spinning up their own subsystems.
#[derive(Clone)]
pub struct AppState {
    /// Shared database pool.
    pub pool: DatabasePool,
    /// JWT verification config.
    pub jwt_config: JwtConfig,
    /// Shared keystore for AES-256-GCM decryption of AD bind passwords
    /// and other sensitive fields.
    pub keystore: Arc<Keystore>,
    /// Shared PostgreSQL-backed event bus (`platform.events` table +
    /// LISTEN/NOTIFY), used to publish `org.*` domain events.
    pub event_bus: Arc<PgEventBus>,
}

impl AuthState for AppState {
    fn jwt_config(&self) -> &JwtConfig {
        &self.jwt_config
    }
}

/// Build the org router using the shared runtime state.
///
/// # Errors
///
/// Returns an error if shared-state cloning fails (none currently, but
/// reserved for future fallible initialization).
pub async fn router(shared: SharedState) -> anyhow::Result<Router> {
    let state = build_state(&shared).await?;
    spawn_ad_sync_workers(&state);
    spawn_provisioning_dispatcher(&state);
    spawn_delegation_expire_worker(&state);
    Ok(create_router(state))
}

async fn build_state(shared: &SharedState) -> anyhow::Result<AppState> {
    Ok(AppState {
        pool: shared.pool.clone(),
        jwt_config: (*shared.jwt).clone(),
        keystore: shared.keystore.clone(),
        event_bus: shared.event_bus.clone(),
    })
}

// ---------------------------------------------------------------------------
// Background workers (W3 / W5 placeholders)
// ---------------------------------------------------------------------------

/// Spawn the AD / LDAP bidirectional sync workers.
///
/// Runs one supervisor task that polls every 60 s the list of tenants
/// whose `org_ad_config.mode != 'off'`, loads the per-tenant
/// [`ad::config::AdSyncConfig`] (with keystore-decrypted bind
/// password) and drives [`ad::sync::run_cycle`] in a non-dry-run
/// pass. Errors are logged but never crash the supervisor — the next
/// tick retries.
pub fn spawn_ad_sync_workers(state: &AppState) {
    let pool = state.pool.clone();
    let keystore = state.keystore.clone();
    let event_bus = state.event_bus.clone();
    tokio::spawn(async move {
        tracing::info!("org AD sync supervisor started");
        loop {
            let tenants: Vec<uuid::Uuid> =
                sqlx::query_scalar("SELECT tenant_id FROM org_ad_config WHERE mode != 'off'")
                    .fetch_all(pool.inner())
                    .await
                    .unwrap_or_default();
            for tenant_id in tenants {
                match ad::config::AdSyncConfig::load(pool.inner(), &keystore, tenant_id).await {
                    Ok(Some(cfg)) => {
                        if let Err(e) =
                            ad::sync::run_cycle(pool.inner(), &cfg, false, Some(&event_bus)).await
                        {
                            tracing::warn!(tenant_id=%tenant_id, ?e, "ad sync cycle failed");
                        }
                    }
                    Ok(None) => {}
                    Err(e) => tracing::warn!(tenant_id=%tenant_id, ?e, "ad config load failed"),
                }
            }
            tokio::time::sleep(std::time::Duration::from_secs(60)).await;
        }
    });
}

/// Spawn the canonical provisioning dispatcher.
///
/// **Placeholder** — the real implementation arrives in W5 (Tasks 30-34).
pub fn spawn_provisioning_dispatcher(_state: &AppState) {
    tokio::spawn(async move {
        tracing::info!("org provisioning dispatcher: placeholder, no-op until W5");
        std::future::pending::<()>().await;
    });
}

/// Spawn the SO1 delegation expiration cron (tick = 15 minutes).
///
/// À chaque tick :
/// 1. [`DelegationRepository::expire_due`] flip `active = false` sur
///    toutes les délégations dont `end_at < NOW()`.
/// 2. Pour chaque id flipé, publie un event `org.delegation.expired`
///    sur le [`PgEventBus`] (consumers : RBAC cache invalidation,
///    notifications).
///
/// Tolérant aux erreurs — un échec DB log un warning sans crasher le
/// superviseur, le tick suivant retentera.
pub fn spawn_delegation_expire_worker(state: &AppState) {
    use signapps_common::pg_events::NewEvent;
    use signapps_db::repositories::org::DelegationRepository;

    let pool = state.pool.clone();
    let event_bus = state.event_bus.clone();
    tokio::spawn(async move {
        tracing::info!("org delegation expire worker started (tick = 15 min)");
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(15 * 60));
        // First tick fires immediately — on veut un skip pour éviter de
        // lancer pendant le boot et alourdir le budget de démarrage.
        interval.tick().await;
        loop {
            interval.tick().await;
            let repo = DelegationRepository::new(pool.inner());
            match repo.expire_due(chrono::Utc::now()).await {
                Ok(ids) => {
                    if ids.is_empty() {
                        tracing::debug!("delegation expire worker: no expired delegations");
                        continue;
                    }
                    tracing::info!(count = ids.len(), "delegation expire worker: expired");
                    for id in ids {
                        let _ = event_bus
                            .publish(NewEvent {
                                event_type: "org.delegation.expired".to_string(),
                                aggregate_id: Some(id),
                                payload: serde_json::json!({ "id": id }),
                            })
                            .await;
                    }
                },
                Err(e) => {
                    tracing::warn!(?e, "delegation expire worker: query failed");
                },
            }
        }
    });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

/// Assemble the full org router from CORS, pre-existing legacy endpoints
/// and the new canonical `/api/v1/org/*` surface introduced in S1 W2.
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
        .merge(signapps_common::version::router("signapps-org"))
        // Public grant redirect — no auth, validates via HMAC + DB check.
        .nest("/g", grants::redirect::routes());

    // Pre-existing org endpoints (admin UI). Preserved under
    // `/api/v1/admin/org/*` to avoid clashing with the new canonical
    // `/api/v1/org/*` surface registered below. These handlers read
    // the legacy `core.*` tables through `signapps-db-identity`.
    let legacy_routes = Router::new()
        // Org structure — trees
        .route(
            "/api/v1/admin/org/trees",
            get(handlers::org_trees::list_trees).post(handlers::org_trees::create_tree),
        )
        .route(
            "/api/v1/admin/org/trees/:id/full",
            get(handlers::org_trees::get_full_tree),
        )
        // Org structure — nodes (admin UI)
        .route(
            "/api/v1/admin/org/nodes/:id",
            get(handlers::org_nodes::get_node)
                .put(handlers::org_nodes::update_node)
                .delete(handlers::org_nodes::delete_node),
        )
        .route(
            "/api/v1/admin/org/nodes/:id/move",
            post(handlers::org_nodes::move_node),
        )
        .route(
            "/api/v1/admin/org/nodes/:id/children",
            get(handlers::org_nodes::get_children),
        )
        .route(
            "/api/v1/admin/org/nodes/:id/descendants",
            get(handlers::org_nodes::get_descendants),
        )
        .route(
            "/api/v1/admin/org/nodes/:id/ancestors",
            get(handlers::org_nodes::get_ancestors),
        )
        .route(
            "/api/v1/admin/org/nodes/:id/assignments",
            get(handlers::org_nodes::get_node_assignments),
        )
        .route(
            "/api/v1/admin/org/nodes/:id/permissions",
            get(handlers::org_nodes::get_node_permissions)
                .put(handlers::org_nodes::set_node_permissions),
        )
        // Orgchart
        .route(
            "/api/v1/admin/org/orgchart",
            get(handlers::org_nodes::get_orgchart),
        )
        // Org context (authenticated user's position in the org)
        .route(
            "/api/v1/admin/org/context",
            get(handlers::org_context::get_context),
        )
        // Legacy assignments surface (`/api/v1/assignments`).
        .route(
            "/api/v1/assignments",
            post(handlers::assignments::create_assignment),
        )
        .route(
            "/api/v1/assignments/history",
            get(handlers::assignments::list_history),
        )
        .route(
            "/api/v1/assignments/:id",
            put(handlers::assignments::update_assignment)
                .delete(handlers::assignments::end_assignment),
        )
        .route_layer(axum_middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    // Canonical S1 surface — nested routers, each auth-guarded.
    let canonical_routes = Router::new()
        .nest("/api/v1/org/nodes", handlers::nodes::routes())
        .nest("/api/v1/org/persons", handlers::persons::routes())
        .nest(
            "/api/v1/org/assignments",
            handlers::canonical_assignments::routes(),
        )
        .nest("/api/v1/org/policies", handlers::policies::routes())
        .nest("/api/v1/org/boards", handlers::boards::routes())
        .nest("/api/v1/org/grants", handlers::grants::routes())
        .nest("/api/v1/org/ad", handlers::ad::routes())
        .nest(
            "/api/v1/org/ad/sync-log",
            handlers::provisioning::ad_sync_log_routes(),
        )
        .nest("/api/v1/org/provisioning", handlers::provisioning::routes())
        // SO1 foundations — positions + history + delegations.
        .nest("/api/v1/org/positions", handlers::positions::routes())
        .nest("/api/v1/org/history", handlers::history::routes())
        .nest("/api/v1/org/delegations", handlers::delegations::routes())
        // SO2 governance — rbac visualizer + raci + board decisions/votes.
        .nest("/api/v1/org/rbac", handlers::rbac::routes())
        .nest("/api/v1/org/raci", handlers::raci::routes())
        .nest(
            "/api/v1/org/boards/:board_id/decisions",
            handlers::decisions::board_decisions_routes(),
        )
        .nest(
            "/api/v1/org/decisions/:decision_id",
            handlers::decisions::decision_votes_routes(),
        )
        // SO3 scale & power — templates, headcount, skills, search, bulk.
        .nest("/api/v1/org/templates", handlers::templates::routes())
        .nest("/api/v1/org/headcount", handlers::headcount::routes())
        .nest("/api/v1/org/skills", handlers::skills::routes_catalog())
        .nest(
            "/api/v1/org/persons/:person_id/skills",
            handlers::skills::routes_person(),
        )
        .nest("/api/v1/org/search", handlers::search::routes())
        .nest("/api/v1/org/bulk", handlers::bulk::routes())
        .route_layer(axum_middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    public_routes
        .merge(legacy_routes)
        .merge(canonical_routes)
        .merge(handlers::openapi::swagger_router())
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state)
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

/// Service health endpoint — also advertises the org app metadata for the
/// platform launcher.
pub async fn health_check() -> axum::Json<serde_json::Value> {
    axum::Json(serde_json::json!({
        "status": "ok",
        "service": "signapps-org",
        "version": env!("CARGO_PKG_VERSION"),
        "uptime_seconds": signapps_common::healthz::uptime_seconds(),
        "app": {
            "id": "org",
            "label": "Organisation",
            "description": "Structure organisationnelle — noeuds, arbres, affectations, organigramme",
            "icon": "Network",
            "category": "Administration",
            "color": "text-indigo-600",
            "href": "/admin/org-structure",
            "port": 3026
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

    async fn make_state() -> AppState {
        let pg_pool = sqlx::PgPool::connect_lazy("postgres://fake:fake@localhost/fake")
            .expect("connect_lazy never fails");
        let pool = signapps_db::DatabasePool::new(pg_pool);
        let jwt_config = JwtConfig::hs256("test-secret-that-is-at-least-32-bytes-long".to_string());
        // Use an env-var-named backend so parallel tests do not clobber
        // each other — seed the var with a stable 64-char hex key.
        let var_name = "SIGNAPPS_ORG_TEST_MASTER_KEY";
        std::env::set_var(var_name, "0".repeat(64));
        let keystore = Arc::new(
            Keystore::init(signapps_keystore::KeystoreBackend::EnvVarNamed(
                var_name.to_string(),
            ))
            .await
            .expect("keystore init in test"),
        );
        let event_bus = Arc::new(PgEventBus::new(
            pool.inner().clone(),
            "signapps-org-test".to_string(),
        ));
        AppState {
            pool,
            jwt_config,
            keystore,
            event_bus,
        }
    }

    /// Verify the router can be constructed without panicking.
    /// Catches regressions like duplicate route registration or handler signature mismatches.
    #[tokio::test]
    async fn router_builds_successfully() {
        let app = create_router(make_state().await);
        assert!(std::mem::size_of_val(&app) > 0);
    }

    /// Verify the health endpoint exists and returns 200.
    #[tokio::test]
    async fn health_endpoint_returns_200() {
        let app = create_router(make_state().await);
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
