//! Toggle the maintenance flag in the shared cache.
//!
//! The cache key `deploy:maintenance:{env}` is consumed by the proxy's
//! maintenance middleware (see `services/signapps-proxy/src/app_middleware/maintenance.rs`).
//! A value of `"1"` means maintenance is ON; absence means OFF.
//!
//! A safety TTL of 30 minutes is applied so the flag self-clears if the
//! deploy process is killed before it reaches the disable step.

use anyhow::Result;
use signapps_cache::CacheService;
use std::sync::Arc;
use std::time::Duration;

const MAINTENANCE_TTL: Duration = Duration::from_secs(30 * 60);
const MAINTENANCE_KEY_PREFIX: &str = "deploy:maintenance:";

fn key(env: &str) -> String {
    format!("{MAINTENANCE_KEY_PREFIX}{env}")
}

/// Enable maintenance mode for the given env. Idempotent.
pub async fn enable(cache: &Arc<CacheService>, env: &str) -> Result<()> {
    cache.set(&key(env), "1", MAINTENANCE_TTL).await;
    tracing::warn!(%env, "maintenance mode ENABLED");
    Ok(())
}

/// Disable maintenance mode for the given env. Idempotent.
pub async fn disable(cache: &Arc<CacheService>, env: &str) -> Result<()> {
    cache.delete(&key(env)).await;
    tracing::info!(%env, "maintenance mode disabled");
    Ok(())
}

/// Check whether maintenance mode is currently enabled for the given env.
pub async fn is_enabled(cache: &Arc<CacheService>, env: &str) -> bool {
    cache.get(&key(env)).await.as_deref() == Some("1")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn enable_then_disable_clears_the_key() {
        let cache = Arc::new(CacheService::default_config());

        enable(&cache, "test").await.unwrap();
        assert_eq!(cache.get(&key("test")).await.as_deref(), Some("1"));

        disable(&cache, "test").await.unwrap();
        assert_eq!(cache.get(&key("test")).await, None);
    }

    #[tokio::test]
    async fn enable_is_idempotent() {
        let cache = Arc::new(CacheService::default_config());
        enable(&cache, "test").await.unwrap();
        enable(&cache, "test").await.unwrap();
        assert_eq!(cache.get(&key("test")).await.as_deref(), Some("1"));
    }

    #[tokio::test]
    async fn is_enabled_matches_state() {
        let cache = Arc::new(CacheService::default_config());
        assert!(!is_enabled(&cache, "test").await);
        enable(&cache, "test").await.unwrap();
        assert!(is_enabled(&cache, "test").await);
        disable(&cache, "test").await.unwrap();
        assert!(!is_enabled(&cache, "test").await);
    }
}
