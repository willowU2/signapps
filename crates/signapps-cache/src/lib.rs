//! In-process cache service for SignApps Platform.
#![warn(missing_docs)]
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

/// In-process binary cache for heavy objects like PDFs and documents.
#[derive(Clone)]
pub struct BinaryCacheService {
    cache: Cache<String, Vec<u8>>,
}

impl BinaryCacheService {
    /// Create a new binary cache with the given capacity and default TTL.
    pub fn new(max_capacity: u64, default_ttl: Duration) -> Self {
        let cache = Cache::builder()
            .max_capacity(max_capacity)
            .time_to_live(default_ttl)
            .build();
        Self { cache }
    }

    /// Create a binary cache with sensible defaults (1 000 items, 1 hour TTL).
    pub fn default_config() -> Self {
        // Cache up to 1000 items, default 1 hour TTL
        Self::new(1000, Duration::from_secs(3600))
    }

    /// Get a cached binary value by key.
    pub async fn get(&self, key: &str) -> Option<Vec<u8>> {
        self.cache.get(key).await
    }

    /// Insert with the cache's default TTL.
    pub async fn set(&self, key: &str, value: Vec<u8>) {
        self.cache.insert(key.to_string(), value).await;
    }

    /// Insert with a custom TTL using moka's per-entry expiry policy.
    ///
    /// Because moka 0.12 `Cache` applies a single global TTL at build-time,
    /// we encode the expiry timestamp as the first 8 bytes of the stored value
    /// (big-endian u64 Unix seconds) and honour it on retrieval.
    /// This avoids the overhead of a second Cache instance while keeping the
    /// API simple.
    pub async fn set_with_ttl(&self, key: &str, value: Vec<u8>, ttl: Duration) {
        let expires_at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs()
            .saturating_add(ttl.as_secs());

        // Layout: [8 bytes big-endian expiry] ++ [payload]
        let mut entry = Vec::with_capacity(8 + value.len());
        entry.extend_from_slice(&expires_at.to_be_bytes());
        entry.extend_from_slice(&value);
        self.cache.insert(key.to_string(), entry).await;
    }

    /// Retrieve an entry stored with [`set_with_ttl`], respecting the embedded
    /// expiry.  Entries stored with plain [`set`] are returned as-is (their
    /// first 8 bytes would be interpreted as a timestamp, which may cause a
    /// false expiry — callers must use matching set/get pairs).
    pub async fn get_with_ttl(&self, key: &str) -> Option<Vec<u8>> {
        let entry = self.cache.get(key).await?;

        if entry.len() < 8 {
            return Some(entry);
        }

        let expires_at = u64::from_be_bytes(entry[..8].try_into().ok()?);
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        if now >= expires_at {
            self.cache.invalidate(key).await;
            return None;
        }

        Some(entry[8..].to_vec())
    }
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
    ///
    /// Delegates to [`get_checked`] so that TTL-encoded entries are properly
    /// decoded and expired entries are pruned. Callers always receive the
    /// plain value, never the internal `"timestamp:value"` representation.
    pub async fn get(&self, key: &str) -> Option<String> {
        self.get_checked(key).await
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
            .expect("system clock is after UNIX_EPOCH")
            .as_secs()
            + ttl.as_secs();
        let entry = format!("{}:{}", expires_at, value);
        self.cache.insert(key.to_string(), entry).await;
    }

    /// Set a value using the default TTL.
    pub async fn set_default(&self, key: &str, value: &str) {
        self.cache.insert(key.to_string(), value.to_string()).await;
    }

    /// Get a value by key, checking custom expiry for TTL-encoded entries.
    pub async fn get_checked(&self, key: &str) -> Option<String> {
        let raw = self.cache.get(key).await?;

        // Check if this is a TTL-encoded entry (timestamp:value)
        if let Some(colon_pos) = raw.find(':') {
            if let Ok(expires_at) = raw[..colon_pos].parse::<u64>() {
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .expect("system clock is after UNIX_EPOCH")
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
    ///
    /// Includes a safety valve: if the counter map exceeds 100 000 entries
    /// (e.g. from unbounded rate-limit keys), all counters are cleared to
    /// prevent memory exhaustion. Callers should also invoke
    /// [`cleanup_stale_counters`] periodically from a background task.
    pub fn incr(&self, key: &str) -> i64 {
        // Prevent unbounded growth of the counter map
        if self.counters.len() > 100_000 {
            tracing::warn!("Counter map exceeded 100 000 entries — clearing all counters");
            self.counters.clear();
        }

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

    /// Remove counter entries whose value has dropped to zero.
    ///
    /// Call this periodically (e.g. every 60 seconds from a background task)
    /// to reclaim memory from expired rate-limit windows.
    pub fn cleanup_stale_counters(&self) {
        let before = self.counters.len();
        self.counters.retain(|_, v| v.load(Ordering::Relaxed) > 0);
        let removed = before - self.counters.len();
        if removed > 0 {
            tracing::debug!(
                "Cleaned up {removed} stale counters ({} remaining)",
                self.counters.len()
            );
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
