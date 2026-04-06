//! TTL-based cache layer for the sharing engine.
//!
//! [`SharingCache`] wraps [`CacheService`] and provides two logical layers:
//!
//! - **L1 — user context** (group memberships, org ancestors): invalidated when
//!   group membership or org structure changes.
//! - **L2 — effective permissions** (resolved role per user × resource): invalided
//!   when a grant on the resource is created or revoked.
//!
//! Keys are namespaced with `sharing:` to avoid collisions with other services
//! sharing the same `CacheService` instance.

use std::time::Duration;

use signapps_cache::CacheService;
use tracing::instrument;
use uuid::Uuid;

/// Default TTL for L1 user-context entries (group IDs, org ancestors).
const L1_TTL: Duration = Duration::from_secs(300); // 5 minutes

/// Default TTL for L2 effective-permission entries.
const L2_TTL: Duration = Duration::from_secs(60); // 1 minute

// ─── SharingCache ─────────────────────────────────────────────────────────────

/// Cache service wrapper for sharing permission data.
///
/// Wraps a shared [`CacheService`] and manages two namespaced cache layers:
/// user-context (L1) and effective-permission (L2).
#[derive(Clone)]
pub struct SharingCache {
    inner: CacheService,
}

impl SharingCache {
    /// Create a new `SharingCache` around an existing [`CacheService`].
    pub fn new(cache: CacheService) -> Self {
        Self { inner: cache }
    }

    // ─── L1: User context ─────────────────────────────────────────────────

    /// Retrieve cached group IDs for a user.
    ///
    /// Returns `None` on cache miss or deserialization failure.
    ///
    /// # Panics
    ///
    /// No panics — errors are logged and `None` is returned.
    pub async fn get_group_ids(&self, user_id: Uuid) -> Option<Vec<Uuid>> {
        let key = l1_group_key(user_id);
        let raw = self.inner.get(&key).await?;
        match serde_json::from_str::<Vec<Uuid>>(&raw) {
            Ok(ids) => Some(ids),
            Err(e) => {
                tracing::warn!(user_id = %user_id, error = %e, "failed to deserialize cached group_ids");
                None
            },
        }
    }

    /// Store group IDs for a user with L1 TTL.
    ///
    /// # Panics
    ///
    /// No panics — serialization failures are logged and the entry is skipped.
    #[instrument(skip(self, ids), fields(user_id = %user_id))]
    pub async fn set_group_ids(&self, user_id: Uuid, ids: &[Uuid]) {
        match serde_json::to_string(ids) {
            Ok(json) => {
                self.inner.set(&l1_group_key(user_id), &json, L1_TTL).await;
            },
            Err(e) => {
                tracing::warn!(user_id = %user_id, error = %e, "failed to serialize group_ids for cache");
            },
        }
    }

    /// Retrieve cached org-node ancestors for a user.
    ///
    /// Returns `None` on cache miss or deserialization failure.
    ///
    /// # Panics
    ///
    /// No panics — errors are logged and `None` is returned.
    pub async fn get_org_ancestors(&self, user_id: Uuid) -> Option<Vec<Uuid>> {
        let key = l1_org_key(user_id);
        let raw = self.inner.get(&key).await?;
        match serde_json::from_str::<Vec<Uuid>>(&raw) {
            Ok(ids) => Some(ids),
            Err(e) => {
                tracing::warn!(user_id = %user_id, error = %e, "failed to deserialize cached org_ancestors");
                None
            },
        }
    }

    /// Store org-node ancestors for a user with L1 TTL.
    ///
    /// # Panics
    ///
    /// No panics — serialization failures are logged and the entry is skipped.
    #[instrument(skip(self, ids), fields(user_id = %user_id))]
    pub async fn set_org_ancestors(&self, user_id: Uuid, ids: &[Uuid]) {
        match serde_json::to_string(ids) {
            Ok(json) => {
                self.inner.set(&l1_org_key(user_id), &json, L1_TTL).await;
            },
            Err(e) => {
                tracing::warn!(user_id = %user_id, error = %e, "failed to serialize org_ancestors for cache");
            },
        }
    }

    // ─── L2: Effective permissions ────────────────────────────────────────

    /// Retrieve the cached effective role string for a (user, resource) pair.
    ///
    /// Returns `None` on cache miss.
    ///
    /// # Panics
    ///
    /// No panics.
    pub async fn get_effective_role(
        &self,
        user_id: Uuid,
        resource_type: &str,
        resource_id: Uuid,
    ) -> Option<String> {
        let key = l2_role_key(user_id, resource_type, resource_id);
        self.inner.get(&key).await
    }

    /// Store the effective role string for a (user, resource) pair with L2 TTL.
    ///
    /// # Panics
    ///
    /// No panics.
    #[instrument(skip(self), fields(user_id = %user_id, resource_type, resource_id = %resource_id))]
    pub async fn set_effective_role(
        &self,
        user_id: Uuid,
        resource_type: &str,
        resource_id: Uuid,
        role: &str,
    ) {
        let key = l2_role_key(user_id, resource_type, resource_id);
        self.inner.set(&key, role, L2_TTL).await;
    }

    // ─── Invalidation ─────────────────────────────────────────────────────

    /// Log that a resource's permission cache will expire via TTL.
    ///
    /// Because all L2 entries are keyed by (user, resource_type, resource_id)
    /// and we cannot enumerate all users, we rely on the moka TTL to expire
    /// stale entries automatically. This method exists for observability —
    /// callers should invoke it after any grant mutation so the log shows intent.
    ///
    /// # Panics
    ///
    /// No panics.
    #[instrument(skip(self), fields(resource_type, resource_id = %resource_id))]
    pub fn invalidate_resource(&self, resource_type: &str, resource_id: Uuid) {
        tracing::debug!(
            resource_type,
            resource_id = %resource_id,
            "resource permission cache will expire via TTL (L2 TTL = {}s)",
            L2_TTL.as_secs()
        );
    }

    /// Invalidate all L1 cache entries for a user (group_ids and org_ancestors).
    ///
    /// Call this when group membership or org-node assignments change for the user.
    ///
    /// # Panics
    ///
    /// No panics.
    #[instrument(skip(self), fields(user_id = %user_id))]
    pub async fn invalidate_user_context(&self, user_id: Uuid) {
        self.inner.del(&l1_group_key(user_id)).await;
        self.inner.del(&l1_org_key(user_id)).await;
        tracing::debug!(user_id = %user_id, "invalidated L1 user context cache");
    }
}

// ─── Key helpers ─────────────────────────────────────────────────────────────

fn l1_group_key(user_id: Uuid) -> String {
    format!("sharing:l1:groups:{user_id}")
}

fn l1_org_key(user_id: Uuid) -> String {
    format!("sharing:l1:org_ancestors:{user_id}")
}

fn l2_role_key(user_id: Uuid, resource_type: &str, resource_id: Uuid) -> String {
    format!("sharing:l2:role:{user_id}:{resource_type}:{resource_id}")
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use signapps_cache::CacheService;

    fn make_cache() -> SharingCache {
        SharingCache::new(CacheService::default_config())
    }

    #[tokio::test]
    async fn group_ids_roundtrip() {
        let cache = make_cache();
        let user_id = Uuid::new_v4();
        let ids = vec![Uuid::new_v4(), Uuid::new_v4()];

        assert!(cache.get_group_ids(user_id).await.is_none());
        cache.set_group_ids(user_id, &ids).await;
        let got = cache.get_group_ids(user_id).await.expect("should be cached");
        assert_eq!(got, ids);
    }

    #[tokio::test]
    async fn org_ancestors_roundtrip() {
        let cache = make_cache();
        let user_id = Uuid::new_v4();
        let ids = vec![Uuid::new_v4()];

        assert!(cache.get_org_ancestors(user_id).await.is_none());
        cache.set_org_ancestors(user_id, &ids).await;
        let got = cache.get_org_ancestors(user_id).await.expect("should be cached");
        assert_eq!(got, ids);
    }

    #[tokio::test]
    async fn effective_role_roundtrip() {
        let cache = make_cache();
        let user_id = Uuid::new_v4();
        let resource_id = Uuid::new_v4();

        assert!(cache.get_effective_role(user_id, "file", resource_id).await.is_none());
        cache.set_effective_role(user_id, "file", resource_id, "editor").await;
        let got = cache
            .get_effective_role(user_id, "file", resource_id)
            .await
            .expect("should be cached");
        assert_eq!(got, "editor");
    }

    #[tokio::test]
    async fn invalidate_user_context_clears_l1() {
        let cache = make_cache();
        let user_id = Uuid::new_v4();

        cache.set_group_ids(user_id, &[Uuid::new_v4()]).await;
        cache.set_org_ancestors(user_id, &[Uuid::new_v4()]).await;

        cache.invalidate_user_context(user_id).await;

        assert!(cache.get_group_ids(user_id).await.is_none());
        assert!(cache.get_org_ancestors(user_id).await.is_none());
    }

    #[test]
    fn invalidate_resource_does_not_panic() {
        let cache = make_cache();
        // Just checking it doesn't panic — no return value to assert.
        cache.invalidate_resource("file", Uuid::new_v4());
    }

    #[test]
    fn key_helpers_are_distinct() {
        let u = Uuid::new_v4();
        let r = Uuid::new_v4();
        assert_ne!(l1_group_key(u), l1_org_key(u));
        assert_ne!(l2_role_key(u, "file", r), l2_role_key(u, "folder", r));
        assert_ne!(l2_role_key(u, "file", r), l2_role_key(u, "file", Uuid::new_v4()));
    }
}
