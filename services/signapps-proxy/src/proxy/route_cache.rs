//! In-memory route cache with periodic DB refresh.

use arc_swap::ArcSwap;
use signapps_db::models::{HeadersConfig, Route, ShieldConfig};
use signapps_db::repositories::RouteRepository;
use signapps_db::DatabasePool;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
use std::sync::Arc;
use tokio::sync::Notify;
use uuid::Uuid;

/// Cached route with pre-parsed configs.
#[derive(Debug, Clone)]
pub struct CachedRoute {
    pub id: Uuid,
    pub name: String,
    pub host: String,
    pub target: String,
    pub mode: String,
    pub tls_enabled: bool,
    pub force_https: bool,
    pub auth_required: bool,
    pub shield_config: Option<ShieldConfig>,
    pub headers_config: Option<HeadersConfig>,
    /// Additional targets for load balancer mode.
    pub targets: Vec<String>,
    /// Round-robin counter for load balancing.
    pub lb_counter: Arc<AtomicUsize>,
}

impl CachedRoute {
    fn from_route(route: &Route) -> Self {
        let shield_config = route.get_shield_config();
        let headers_config = route.get_headers_config();

        // Parse targets from tls_config JSON (targets field) or use main target
        let targets = route
            .tls_config
            .as_ref()
            .and_then(|v| v.get("targets"))
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(String::from))
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();

        let force_https = route
            .tls_config
            .as_ref()
            .and_then(|v| v.get("force_https"))
            .and_then(|v| v.as_bool())
            .unwrap_or(true);

        Self {
            id: route.id,
            name: route.name.clone(),
            host: route.host.clone(),
            target: route.target.clone(),
            mode: route.mode.clone(),
            tls_enabled: route.tls_enabled,
            force_https,
            auth_required: route.auth_required,
            shield_config,
            headers_config,
            targets,
            lb_counter: Arc::new(AtomicUsize::new(0)),
        }
    }

    /// Get next target for load balancing (round-robin).
    pub fn next_target(&self) -> &str {
        if self.targets.is_empty() {
            return &self.target;
        }
        let idx = self.lb_counter.fetch_add(1, Ordering::Relaxed) % self.targets.len();
        &self.targets[idx]
    }
}

/// Thread-safe route cache with ArcSwap for lock-free reads.
#[derive(Clone)]
pub struct RouteCache {
    inner: Arc<ArcSwap<HashMap<String, CachedRoute>>>,
    /// Wildcard routes: stored as suffix → route (e.g. ".example.com" → route)
    wildcards: Arc<ArcSwap<Vec<(String, CachedRoute)>>>,
    pool: DatabasePool,
    notify: Arc<Notify>,
    /// Total requests counter (atomic for proxy status).
    pub requests_total: Arc<AtomicU64>,
}

impl RouteCache {
    /// Create a new route cache.
    pub fn new(pool: DatabasePool) -> Self {
        Self {
            inner: Arc::new(ArcSwap::from_pointee(HashMap::new())),
            wildcards: Arc::new(ArcSwap::from_pointee(Vec::new())),
            pool,
            notify: Arc::new(Notify::new()),
            requests_total: Arc::new(AtomicU64::new(0)),
        }
    }

    /// Lookup a route by host header (exact match first, then wildcard).
    pub fn lookup(&self, host: &str) -> Option<CachedRoute> {
        // Strip port from host if present
        let host_only = host.split(':').next().unwrap_or(host);

        // Exact match
        let routes = self.inner.load();
        if let Some(route) = routes.get(host_only) {
            return Some(route.clone());
        }

        // Wildcard match: check if host matches *.example.com patterns
        let wildcards = self.wildcards.load();
        for (suffix, route) in wildcards.iter() {
            if host_only.ends_with(suffix) {
                return Some(route.clone());
            }
        }

        None
    }

    /// Number of cached routes.
    pub fn route_count(&self) -> usize {
        self.inner.load().len()
    }

    /// Force an immediate cache refresh.
    pub fn force_refresh(&self) {
        self.notify.notify_one();
    }

    /// Start background refresh loop.
    pub async fn start_refresh_loop(self, interval_secs: u64) {
        tracing::info!(
            interval_secs,
            "Starting route cache refresh loop"
        );

        // Initial load
        if let Err(e) = self.refresh().await {
            tracing::error!(error = %e, "Initial route cache load failed");
        }

        loop {
            tokio::select! {
                _ = tokio::time::sleep(std::time::Duration::from_secs(interval_secs)) => {},
                _ = self.notify.notified() => {
                    tracing::debug!("Force refresh triggered");
                },
            }

            if let Err(e) = self.refresh().await {
                tracing::error!(error = %e, "Route cache refresh failed");
            }
        }
    }

    /// Refresh cache from database.
    async fn refresh(&self) -> signapps_common::Result<()> {
        let repo = RouteRepository::new(&self.pool);
        let routes = repo.list_enabled().await?;

        let mut exact_map = HashMap::with_capacity(routes.len());
        let mut wildcard_list = Vec::new();

        for route in &routes {
            let cached = CachedRoute::from_route(route);
            if route.host.starts_with("*.") {
                // Convert *.example.com to .example.com for suffix matching
                let suffix = route.host[1..].to_string();
                wildcard_list.push((suffix, cached));
            } else {
                exact_map.insert(route.host.clone(), cached);
            }
        }

        self.inner.store(Arc::new(exact_map));
        self.wildcards.store(Arc::new(wildcard_list));

        tracing::debug!(
            routes = routes.len(),
            "Route cache refreshed"
        );

        Ok(())
    }
}
