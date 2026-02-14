//! In-process cache service for SignApps Platform.
//!
//! Replaces Redis with moka (TTL cache) and dashmap (atomic counters).
//! Suitable for rate-limiting, token blacklisting, and general caching.

use dashmap::DashMap;
use moka::future::Cache;
use std::sync::atomic::{AtomicI64, Ordering};
use std::sync::Arc;
use std::time::Duration;

/// In-process cache service backed by moka and dashmap.
#[derive(Clone)]
pub struct CacheService {
    /// TTL-based cache for key-value pairs.
    cache: Cache<String, String>,
    /// Atomic counters for stats.
    counters: Arc<DashMap<String, AtomicI64>>,
}

impl CacheService {
    /// Create a new cache service.
    ///
    /// `max_capacity` sets the maximum number of entries.
    /// `default_ttl` sets the default time-to-live for entries
    /// when no explicit TTL is provided.
    pub fn new(max_capacity: u64, default_ttl: Duration) -> Self {
        let cache = Cache::builder()
            .max_capacity(max_capacity)
            .time_to_live(default_ttl)
            .build();

        Self {
            cache,
            counters: Arc::new(DashMap::new()),
        }
    }

    /// Create a cache service with sensible defaults for general use.
    pub fn default_config() -> Self {
        Self::new(100_000, Duration::from_secs(3600))
    }

    /// Get a value by key.
    pub async fn get(&self, key: &str) -> Option<String> {
        self.cache.get(key).await
    }

    /// Set a value with an explicit TTL.
    pub async fn set(&self, key: &str, value: &str, ttl: Duration) {
        // Use policy-level per-entry TTL via insert_with_expiry workaround:
        // moka doesn't support per-entry TTL directly in 0.12,
        // so we use a separate cache or the policy approach.
        // Actually, moka 0.12 supports per-entry expiry via
        // `policy_weight` but the simplest approach is to use
        // the cache's `insert` and rely on the global TTL, or
        // create short-lived entries by leveraging entry API.
        //
        // For simplicity and correctness, we create a temporary cache
        // for different TTLs. But a better approach: use the global
        // cache with insert and track expiry ourselves.
        //
        // The cleanest moka approach: use `entry` API with custom expiry.
        // Since moka 0.12 doesn't easily support per-entry TTL,
        // we'll store the expiry timestamp alongside the value and
        // check it on retrieval.

        // Store value with expiry metadata
        let expires_at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs()
            + ttl.as_secs();
        let entry = format!("{}:{}", expires_at, value);
        self.cache.insert(key.to_string(), entry).await;
    }

    /// Set a value using the default TTL.
    pub async fn set_default(&self, key: &str, value: &str) {
        self.cache.insert(key.to_string(), value.to_string()).await;
    }

    /// Internal: get raw value checking custom expiry.
    async fn get_checked(&self, key: &str) -> Option<String> {
        let raw = self.cache.get(key).await?;

        // Check if this is a TTL-encoded entry (timestamp:value)
        if let Some(colon_pos) = raw.find(':') {
            if let Ok(expires_at) = raw[..colon_pos].parse::<u64>() {
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs();
                if now >= expires_at {
                    // Expired, remove and return None
                    self.cache.invalidate(key).await;
                    return None;
                }
                return Some(raw[colon_pos + 1..].to_string());
            }
        }

        // Not TTL-encoded, return as-is
        Some(raw)
    }

    /// Delete a key.
    pub async fn del(&self, key: &str) {
        self.cache.invalidate(key).await;
    }

    /// Check if a key exists (and is not expired).
    pub async fn exists(&self, key: &str) -> bool {
        self.get_checked(key).await.is_some()
    }

    /// Increment an atomic counter. Returns the new value.
    pub fn incr(&self, key: &str) -> i64 {
        self.counters
            .entry(key.to_string())
            .or_insert_with(|| AtomicI64::new(0))
            .fetch_add(1, Ordering::Relaxed)
            + 1
    }

    /// Decrement an atomic counter. Returns the new value.
    pub fn decr(&self, key: &str) -> i64 {
        self.counters
            .entry(key.to_string())
            .or_insert_with(|| AtomicI64::new(0))
            .fetch_sub(1, Ordering::Relaxed)
            - 1
    }

    /// Get current counter value.
    pub fn get_counter(&self, key: &str) -> i64 {
        self.counters
            .get(key)
            .map(|v| v.load(Ordering::Relaxed))
            .unwrap_or(0)
    }

    /// Reset a counter to zero.
    pub fn reset_counter(&self, key: &str) {
        if let Some(entry) = self.counters.get(key) {
            entry.store(0, Ordering::Relaxed);
        }
    }

    /// Health check - always returns Ok for in-process cache.
    pub fn health_check(&self) -> bool {
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_set_and_get() {
        let cache = CacheService::default_config();
        cache.set("key1", "value1", Duration::from_secs(60)).await;
        let val = cache.get_checked("key1").await;
        assert_eq!(val, Some("value1".to_string()));
    }

    #[tokio::test]
    async fn test_del() {
        let cache = CacheService::default_config();
        cache.set("key1", "value1", Duration::from_secs(60)).await;
        cache.del("key1").await;
        let val = cache.get_checked("key1").await;
        assert_eq!(val, None);
    }

    #[tokio::test]
    async fn test_exists() {
        let cache = CacheService::default_config();
        assert!(!cache.exists("key1").await);
        cache.set("key1", "value1", Duration::from_secs(60)).await;
        assert!(cache.exists("key1").await);
    }

    #[tokio::test]
    async fn test_counters() {
        let cache = CacheService::default_config();
        assert_eq!(cache.get_counter("hits"), 0);
        assert_eq!(cache.incr("hits"), 1);
        assert_eq!(cache.incr("hits"), 2);
        assert_eq!(cache.incr("hits"), 3);
        assert_eq!(cache.get_counter("hits"), 3);
        assert_eq!(cache.decr("hits"), 2);
        assert_eq!(cache.get_counter("hits"), 2);
    }

    #[tokio::test]
    async fn test_reset_counter() {
        let cache = CacheService::default_config();
        cache.incr("test");
        cache.incr("test");
        cache.reset_counter("test");
        assert_eq!(cache.get_counter("test"), 0);
    }

    #[tokio::test]
    async fn test_expired_entry() {
        let cache = CacheService::default_config();
        // Set with 0-second TTL (already expired)
        cache.set("expired", "val", Duration::from_secs(0)).await;
        // Should be expired
        tokio::time::sleep(Duration::from_millis(10)).await;
        let val = cache.get_checked("expired").await;
        assert_eq!(val, None);
    }

    #[test]
    fn test_health_check() {
        let cache = CacheService::default_config();
        assert!(cache.health_check());
    }
}
