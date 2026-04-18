//! Upstream switcher: picks the active backend cluster Color from the DB.
//!
//! Reads `active_stack` via `signapps_common::active_stack::get_active`
//! with a 5-second in-process cache to avoid hammering the DB on every
//! request. Injects the current `Color` into request extensions so
//! downstream proxy logic can route to the correct upstream host.

use crate::app_middleware::hostname_router::BackendCluster;
use axum::{
    extract::{Request, State},
    middleware::Next,
    response::Response,
};
use signapps_common::active_stack::{self, Color};
use sqlx::PgPool;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

const CACHE_TTL: Duration = Duration::from_secs(5);

/// Axum state for [`upstream_switcher_middleware`].
#[derive(Clone)]
pub struct UpstreamSwitcherState {
    /// Shared PG pool used to read the `active_stack` row.
    pub pool: PgPool,
    cache: Arc<Mutex<Option<(Instant, Color)>>>,
}

impl UpstreamSwitcherState {
    /// Build a new switcher state backed by the given PG pool.
    pub fn new(pool: PgPool) -> Self {
        Self {
            pool,
            cache: Arc::new(Mutex::new(None)),
        }
    }

    async fn get_color(&self, env: &str) -> Color {
        {
            // Recover from poisoning — this is hot-path middleware and a
            // prior panic on another thread must not cascade into every
            // subsequent request crashing the proxy tier.
            let guard = match self.cache.lock() {
                Ok(g) => g,
                Err(poisoned) => poisoned.into_inner(),
            };
            if let Some((when, color)) = *guard {
                if when.elapsed() < CACHE_TTL {
                    return color;
                }
            }
        }
        let color = active_stack::get_active(&self.pool, env)
            .await
            .unwrap_or(Color::Blue);
        if let Ok(mut guard) = self.cache.lock() {
            *guard = Some((Instant::now(), color));
        }
        color
    }
}

/// Reads `active_stack` and injects the current [`Color`] into request
/// extensions. Downstream middleware / handlers can pick it up via
/// `req.extensions().get::<Color>()`.
pub async fn upstream_switcher_middleware(
    State(state): State<UpstreamSwitcherState>,
    mut req: Request,
    next: Next,
) -> Response {
    let env = req
        .extensions()
        .get::<BackendCluster>()
        .map(|c| c.env_name().to_string())
        .unwrap_or_else(|| "prod".to_string());

    let color = state.get_color(&env).await;
    req.extensions_mut().insert(color);
    next.run(req).await
}

#[cfg(test)]
mod tests {
    //! Regression tests for the Phase A P0 fix (commit 32219f6f).
    //!
    //! Before the fix, `get_color` used `self.cache.lock().unwrap()` on
    //! a hot path. Any prior thread panic while holding the mutex would
    //! poison it and every subsequent proxy request would crash. The
    //! fix replaced `.unwrap()` with a `match` that recovers via
    //! `PoisonError::into_inner()`.
    //!
    //! These tests verify the recovery pattern directly (without
    //! instantiating `UpstreamSwitcherState` — that would require a
    //! PgPool). The pattern mirrors the production code.
    use std::sync::{Arc, Mutex};
    use std::thread;

    /// Baseline — an un-poisoned mutex yields a readable guard.
    #[test]
    fn test_mutex_non_poisoned_access() {
        let m: Arc<Mutex<Option<u32>>> = Arc::new(Mutex::new(Some(42)));
        let guard = match m.lock() {
            Ok(g) => g,
            Err(poisoned) => poisoned.into_inner(),
        };
        assert_eq!(*guard, Some(42));
    }

    /// Core regression — a mutex poisoned by a panic on another thread
    /// must still be accessible via `PoisonError::into_inner()`. This
    /// is the behaviour that protects the proxy tier from cascading
    /// crashes.
    #[test]
    fn test_mutex_recovers_from_poisoning() {
        let m: Arc<Mutex<Option<u32>>> = Arc::new(Mutex::new(Some(7)));

        // Panic while holding the lock — poisons the mutex.
        let m_clone = Arc::clone(&m);
        let _ = thread::spawn(move || {
            let _g = m_clone.lock().unwrap();
            panic!("intentional panic to poison the mutex");
        })
        .join();

        // Lock now returns Err(PoisonError) — but the pattern used in
        // upstream_switcher must still extract the inner value.
        let res = m.lock();
        assert!(
            res.is_err(),
            "mutex must be poisoned after panicking holder"
        );
        let guard = match res {
            Ok(g) => g,
            Err(poisoned) => poisoned.into_inner(),
        };
        assert_eq!(
            *guard,
            Some(7),
            "recovered guard must expose the pre-panic value",
        );
    }

    /// Mutation test — the bug variant (`.unwrap()`) must panic on a
    /// poisoned mutex, proving the production `match` is actually what
    /// saves us.
    #[test]
    #[should_panic]
    fn test_unwrap_panics_on_poisoned_mutex() {
        let m: Arc<Mutex<Option<u32>>> = Arc::new(Mutex::new(Some(7)));
        let m_clone = Arc::clone(&m);
        let _ = thread::spawn(move || {
            let _g = m_clone.lock().unwrap();
            panic!("intentional panic to poison the mutex");
        })
        .join();
        // This is the pre-fix pattern — must panic.
        let _guard = m.lock().unwrap();
    }
}
