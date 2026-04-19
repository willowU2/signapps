//! Decision cache backed by `moka`.
//!
//! The cache is keyed by `(person_id, resource_kind, resource_id,
//! action)` and stores only the boolean allow/deny outcome — the
//! resolver rebuilds the [`super::types::DecisionSource`] or
//! [`super::types::DenyReason`] when serving a hit.  This keeps the
//! cache entry cheap (< 40 bytes) and guarantees that stale
//! provenance cannot leak across `org.policy.updated` events (the
//! resolver invalidates per-resource on bus notifications).

use std::time::Duration;

use moka::future::Cache;
use uuid::Uuid;

use super::types::{Action, PersonRef, ResourceRef};

/// Cache key — `Copy` + `Eq` + `Hash` so moka can store it cheaply.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct CacheKey {
    /// Person making the request.
    pub who: Uuid,
    /// Resource kind label (`"document"`, `"folder"` …).
    pub res_kind: &'static str,
    /// Resource UUID.
    pub res_id: Uuid,
    /// Requested action.
    pub action: Action,
}

/// Cached decision — allow/deny only, so the resolver rebuilds the
/// `Decision::Allow { source }` / `Decision::Deny { reason }` on lookup.
#[derive(Debug, Clone, Copy)]
pub struct CachedDecision {
    /// True if the previous check returned `Decision::Allow`.
    pub allow: bool,
}

/// Thin wrapper around a moka `Cache` keyed by [`CacheKey`].
pub struct DecisionCache {
    inner: Cache<CacheKey, CachedDecision>,
}

impl DecisionCache {
    /// Build a new cache with a fixed TTL.
    ///
    /// Capacity is 50 000 entries — matches the default tenant sizing
    /// of the global in-process cache.  Exceeding the cap triggers a
    /// tiny-LFU eviction — cold entries go first.
    pub fn new(ttl_sec: u64) -> Self {
        Self {
            inner: Cache::builder()
                .max_capacity(50_000)
                .time_to_live(Duration::from_secs(ttl_sec))
                .build(),
        }
    }

    /// Look up a cached decision, if any.
    pub async fn get(
        &self,
        who: PersonRef,
        res: &ResourceRef,
        action: Action,
    ) -> Option<CachedDecision> {
        self.inner.get(&to_key(who, res, action)).await
    }

    /// Insert a decision.
    pub async fn put(
        &self,
        who: PersonRef,
        res: &ResourceRef,
        action: Action,
        d: CachedDecision,
    ) {
        self.inner.insert(to_key(who, res, action), d).await;
    }

    /// Invalidate every entry that targets a given resource, regardless
    /// of the person or action.  Used from the `org.grant.*` event
    /// listener.
    pub async fn invalidate_resource(&self, kind: &'static str, id: Uuid) {
        // `invalidate_entries_if` returns an error if the predicate
        // registry is disabled — it's enabled by default in moka 0.12,
        // so we pragma-log the rare case instead of panicking.
        if let Err(e) = self
            .inner
            .invalidate_entries_if(move |k, _| k.res_kind == kind && k.res_id == id)
        {
            tracing::warn!(?e, kind, %id, "decision cache invalidate_resource failed");
        }
    }

    /// Drop every cached decision.  Used on `org.policy.updated` and
    /// `org.assignment.changed` — changes there can affect arbitrarily
    /// many resources, so a targeted invalidation is not worth the
    /// bookkeeping.
    pub async fn invalidate_all(&self) {
        self.inner.invalidate_all();
    }

    /// Current number of cached entries (for tests + metrics).
    pub fn entry_count(&self) -> u64 {
        self.inner.entry_count()
    }
}

fn to_key(who: PersonRef, res: &ResourceRef, action: Action) -> CacheKey {
    CacheKey {
        who: who.id,
        res_kind: res.kind(),
        res_id: res.id(),
        action,
    }
}
