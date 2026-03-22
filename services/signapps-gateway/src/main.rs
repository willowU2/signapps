//! SignApps Gateway - Single-Binary Deployment POC (LT-05)
//!
//! This proof-of-concept demonstrates the pattern for running multiple
//! SignApps services within a single binary using tokio tasks.
//!
//! In the full implementation, each service would expose a library interface:
//!   - `pub fn create_router(state: AppState) -> Router`
//!   - `pub async fn init_state(pool: DatabasePool, jwt: JwtConfig) -> Result<AppState>`
//!
//! The gateway would then call these functions and spawn each router on its
//! designated port as a tokio task.
//!
//! For this POC, we use stub routers that simulate the real services.

use axum::{routing::get, Json, Router};
use signapps_common::bootstrap::{env_or, init_tracing, load_env};
use signapps_common::JwtConfig;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::watch;
use tokio::task::JoinHandle;

/// Shared resources that would be passed to all services.
#[derive(Clone)]
struct SharedResources {
    /// Single database pool shared across all services.
    /// In the full implementation: `pool: signapps_db::DatabasePool`
    db_url: String,

    /// JWT configuration (identical for all services).
    jwt_config: JwtConfig,
}

/// Tracks the health status of each spawned service.
#[derive(Clone)]
struct ServiceHealth {
    statuses: Arc<tokio::sync::RwLock<HashMap<String, ServiceStatus>>>,
}

#[derive(Clone, serde::Serialize)]
struct ServiceStatus {
    name: String,
    port: u16,
    healthy: bool,
    started_at: chrono::DateTime<chrono::Utc>,
}

impl ServiceHealth {
    fn new() -> Self {
        Self {
            statuses: Arc::new(tokio::sync::RwLock::new(HashMap::new())),
        }
    }

    async fn register(&self, name: &str, port: u16) {
        let mut statuses = self.statuses.write().await;
        statuses.insert(
            name.to_string(),
            ServiceStatus {
                name: name.to_string(),
                port,
                healthy: true,
                started_at: chrono::Utc::now(),
            },
        );
    }

    async fn mark_unhealthy(&self, name: &str) {
        let mut statuses = self.statuses.write().await;
        if let Some(status) = statuses.get_mut(name) {
            status.healthy = false;
        }
    }

    async fn all_statuses(&self) -> Vec<ServiceStatus> {
        let statuses = self.statuses.read().await;
        statuses.values().cloned().collect()
    }
}

/// Spawns an Axum router as a tokio task on the given port.
///
/// This is the core pattern: take a ready-made Router and bind it to a port.
/// In the full implementation, the router comes from `service::create_router(state)`.
async fn spawn_service(
    name: &str,
    port: u16,
    router: Router,
    health: ServiceHealth,
    mut shutdown_rx: watch::Receiver<bool>,
) -> JoinHandle<()> {
    let name = name.to_string();
    let addr = format!("0.0.0.0:{}", port);

    health.register(&name, port).await;

    tokio::spawn(async move {
        let listener = match tokio::net::TcpListener::bind(&addr).await {
            Ok(l) => {
                tracing::info!("[{}] listening on port {}", name, port);
                l
            }
            Err(e) => {
                tracing::error!("[{}] failed to bind port {}: {}", name, port, e);
                health.mark_unhealthy(&name).await;
                return;
            }
        };

        let name_for_shutdown = name.clone();
        let shutdown_signal = async move {
            // Wait until the shutdown channel signals true
            loop {
                shutdown_rx.changed().await.ok();
                if *shutdown_rx.borrow() {
                    break;
                }
            }
            tracing::info!("[{}] shutting down...", name_for_shutdown);
        };

        if let Err(e) = axum::serve(listener, router)
            .with_graceful_shutdown(shutdown_signal)
            .await
        {
            tracing::error!("[{}] server error: {}", name, e);
            health.mark_unhealthy(&name).await;
        }

        tracing::info!("[{}] stopped", name);
    })
}

// ---------------------------------------------------------------------------
// Stub routers simulating the real services.
//
// In the full implementation, these would be replaced by:
//   let state = signapps_identity::init_state(pool.clone(), jwt.clone()).await?;
//   let router = signapps_identity::create_router(state);
// ---------------------------------------------------------------------------

/// Stub router for the identity service.
/// Demonstrates the pattern - the real service has ~60 routes.
fn stub_identity_router(_resources: &SharedResources) -> Router {
    Router::new()
        .route("/health", get(identity_health))
        .route("/api/v1/auth/login", get(identity_stub))
        .route("/api/v1/auth/me", get(identity_stub))
}

async fn identity_health() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "service": "signapps-identity",
        "status": "healthy",
        "mode": "gateway-embedded",
        "note": "POC stub - real service has full auth/RBAC/LDAP"
    }))
}

async fn identity_stub() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "error": "POC stub - not implemented in gateway prototype",
        "hint": "This route would be served by the real signapps-identity library"
    }))
}

/// Stub router for the storage service.
/// Demonstrates the pattern - the real service has ~80 routes.
fn stub_storage_router(_resources: &SharedResources) -> Router {
    Router::new()
        .route("/health", get(storage_health))
        .route("/api/v1/files", get(storage_stub))
        .route("/api/v1/buckets", get(storage_stub))
}

async fn storage_health() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "service": "signapps-storage",
        "status": "healthy",
        "mode": "gateway-embedded",
        "note": "POC stub - real service has Drive VFS, RAID, NAS features"
    }))
}

async fn storage_stub() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "error": "POC stub - not implemented in gateway prototype",
        "hint": "This route would be served by the real signapps-storage library"
    }))
}

/// Stub router for the proxy management API.
fn stub_proxy_router(_resources: &SharedResources) -> Router {
    Router::new().route("/health", get(proxy_health))
}

async fn proxy_health() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "service": "signapps-proxy",
        "status": "healthy",
        "mode": "gateway-embedded",
        "note": "POC stub - real service has reverse proxy, TLS, ACME, WAF"
    }))
}

// ---------------------------------------------------------------------------
// Gateway health endpoint - aggregates all service statuses
// ---------------------------------------------------------------------------

async fn gateway_health(
    axum::extract::State(health): axum::extract::State<ServiceHealth>,
) -> Json<serde_json::Value> {
    let statuses = health.all_statuses().await;
    let all_healthy = statuses.iter().all(|s| s.healthy);

    Json(serde_json::json!({
        "gateway": "signapps-gateway",
        "status": if all_healthy { "healthy" } else { "degraded" },
        "version": env!("CARGO_PKG_VERSION"),
        "services": statuses,
        "total_services": statuses.len(),
        "healthy_services": statuses.iter().filter(|s| s.healthy).count(),
    }))
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // === Step 1: Initialize shared infrastructure (ONCE) ===
    init_tracing("signapps_gateway");
    load_env();

    tracing::info!("=== SignApps Gateway - Single Binary Deployment POC ===");
    tracing::info!("This is a prototype demonstrating the single-binary pattern.");
    tracing::info!("Services are stub routers - not the real implementations.");

    // In the full implementation, this creates the real DB pool:
    //   let pool = signapps_db::create_pool(&database_url).await?;
    //   signapps_db::run_migrations(&pool).await?;
    let database_url = env_or("DATABASE_URL", "postgresql://localhost/signapps");

    let jwt_config = JwtConfig {
        secret: env_or("JWT_SECRET", "gateway-dev-secret-change-in-production"),
        issuer: "signapps".to_string(),
        audience: "signapps".to_string(),
        access_expiration: 900,
        refresh_expiration: 604800,
    };

    let resources = SharedResources {
        db_url: database_url,
        jwt_config,
    };

    tracing::info!("Shared resources initialized (DB URL, JWT config)");

    // === Step 2: Create shutdown coordination ===
    let (shutdown_tx, shutdown_rx) = watch::channel(false);
    let health = ServiceHealth::new();

    // === Step 3: Spawn services as tokio tasks ===
    let mut handles: Vec<JoinHandle<()>> = Vec::new();

    // Identity service on port 3001
    let identity_router = stub_identity_router(&resources);
    handles.push(
        spawn_service(
            "signapps-identity",
            3001,
            identity_router,
            health.clone(),
            shutdown_rx.clone(),
        )
        .await,
    );

    // Storage service on port 3004
    let storage_router = stub_storage_router(&resources);
    handles.push(
        spawn_service(
            "signapps-storage",
            3004,
            storage_router,
            health.clone(),
            shutdown_rx.clone(),
        )
        .await,
    );

    // Proxy management API on port 3003
    let proxy_router = stub_proxy_router(&resources);
    handles.push(
        spawn_service(
            "signapps-proxy",
            3003,
            proxy_router,
            health.clone(),
            shutdown_rx.clone(),
        )
        .await,
    );

    // === Step 4: Gateway management API on port 3099 ===
    let gateway_port: u16 = env_or("GATEWAY_PORT", "3099").parse().unwrap_or(3099);
    let gateway_router = Router::new()
        .route("/health", get(gateway_health))
        .route("/gateway/health", get(gateway_health))
        .with_state(health.clone());

    handles.push(
        spawn_service(
            "gateway-api",
            gateway_port,
            gateway_router,
            health.clone(),
            shutdown_rx.clone(),
        )
        .await,
    );

    // Give services a moment to bind their ports
    tokio::time::sleep(Duration::from_millis(100)).await;

    tracing::info!("=== All services started ===");
    tracing::info!("Gateway health: http://localhost:{}/health", gateway_port);
    tracing::info!("Identity stub:  http://localhost:3001/health");
    tracing::info!("Storage stub:   http://localhost:3004/health");
    tracing::info!("Proxy stub:     http://localhost:3003/health");

    // === Step 5: Wait for shutdown signal ===
    // Ctrl+C or SIGTERM triggers graceful shutdown of all services
    tokio::signal::ctrl_c().await?;
    tracing::info!("Shutdown signal received, stopping all services...");

    // Signal all services to shut down
    shutdown_tx.send(true)?;

    // Wait for all tasks to complete (with timeout)
    let shutdown_timeout = Duration::from_secs(10);
    match tokio::time::timeout(shutdown_timeout, async {
        for handle in handles {
            let _ = handle.await;
        }
    })
    .await
    {
        Ok(()) => tracing::info!("All services stopped gracefully"),
        Err(_) => tracing::warn!("Shutdown timed out after {:?}", shutdown_timeout),
    }

    tracing::info!("=== SignApps Gateway stopped ===");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_service_health_creation() {
        let health = ServiceHealth::new();
        assert!(Arc::strong_count(&health.statuses) == 1);
    }

    #[test]
    fn test_shared_resources_clone() {
        fn assert_clone<T: Clone>() {}
        assert_clone::<SharedResources>();
    }

    #[tokio::test]
    async fn test_health_registration() {
        let health = ServiceHealth::new();
        health.register("test-service", 9999).await;

        let statuses = health.all_statuses().await;
        assert_eq!(statuses.len(), 1);
        assert_eq!(statuses[0].name, "test-service");
        assert_eq!(statuses[0].port, 9999);
        assert!(statuses[0].healthy);
    }

    #[tokio::test]
    async fn test_health_mark_unhealthy() {
        let health = ServiceHealth::new();
        health.register("failing-service", 8888).await;
        health.mark_unhealthy("failing-service").await;

        let statuses = health.all_statuses().await;
        assert!(!statuses[0].healthy);
    }
}
