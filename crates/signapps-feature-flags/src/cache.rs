//! Local TTL cache for feature-flag lookups.
//!
//! Caches `FeatureFlag` rows by `(key, env)` for 60 seconds. Invalidations
//! are signaled via [`signapps_cache::CacheService`] delete operations that
//! the admin API issues after mutations.

use crate::types::FeatureFlag;
use signapps_cache::CacheService;
use std::sync::Arc;
use std::time::Duration;

const CACHE_TTL: Duration = Duration::from_secs(60);

fn cache_key(key: &str, env: &str) -> String {
    format!("ff:{key}:{env}")
}

/// Read-through cache wrapper for feature flags.
#[derive(Clone)]
pub struct FeatureFlagCache {
    inner: Arc<CacheService>,
}

impl FeatureFlagCache {
    /// Create a new cache backed by the given [`CacheService`].
    pub fn new(cache: Arc<CacheService>) -> Self {
        Self { inner: cache }
    }

    /// Look up a flag by key + env. Returns `None` on miss.
    pub async fn get(&self, key: &str, env: &str) -> Option<FeatureFlag> {
        let raw = self.inner.get(&cache_key(key, env)).await?;
        serde_json::from_str(&raw).ok()
    }

    /// Insert a flag into the cache with the default TTL.
    ///
    /// # Errors
    ///
    /// Returns an error if JSON serialization fails (should not happen for
    /// well-formed `FeatureFlag` rows).
    pub async fn put(&self, flag: &FeatureFlag) -> anyhow::Result<()> {
        let raw = serde_json::to_string(flag)?;
        self.inner
            .set(&cache_key(&flag.key, &flag.env), &raw, CACHE_TTL)
            .await;
        Ok(())
    }

    /// Remove the cache entry for a (key, env) pair. Safe to call on misses.
    pub async fn invalidate(&self, key: &str, env: &str) {
        self.inner.delete(&cache_key(key, env)).await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use uuid::Uuid;

    fn sample_flag(key: &str, env: &str) -> FeatureFlag {
        FeatureFlag {
            id: Uuid::new_v4(),
            key: key.to_string(),
            env: env.to_string(),
            enabled: true,
            rollout_percent: 100,
            target_orgs: vec![],
            target_users: vec![],
            description: Some("test".into()),
            created_by: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    #[tokio::test]
    async fn put_then_get_round_trip() {
        let cache = FeatureFlagCache::new(Arc::new(CacheService::default_config()));
        let flag = sample_flag("k1", "prod");
        cache.put(&flag).await.unwrap();
        let got = cache.get("k1", "prod").await.expect("hit");
        assert_eq!(got.id, flag.id);
    }

    #[tokio::test]
    async fn invalidate_clears_the_entry() {
        let cache = FeatureFlagCache::new(Arc::new(CacheService::default_config()));
        let flag = sample_flag("k2", "prod");
        cache.put(&flag).await.unwrap();
        cache.invalidate("k2", "prod").await;
        assert!(cache.get("k2", "prod").await.is_none());
    }
}
