//! Verifies the single-binary AI router builds in < 500 ms and defers
//! hardware detection / model manager construction until the first
//! handler that needs them.
//!
//! Run with:
//!
//! ```bash
//! cargo test -p signapps-ai --test lazy_init -- --ignored --nocapture
//! ```
//!
//! The test requires a live Postgres on the DATABASE_URL set in env
//! (or falls back to the dev defaults used by the rest of the suite).

use std::time::{Duration, Instant};

use signapps_service::shared_state::SharedState;

/// Set up the minimal env the shared state initializer needs. Callers
/// already in CI may have these set — `set_var` is a no-op if the
/// value matches.
fn prime_env() {
    std::env::set_var(
        "DATABASE_URL",
        "postgres://signapps:signapps_dev@localhost:5432/signapps",
    );
    std::env::set_var("JWT_SECRET", "x".repeat(32));
    std::env::set_var(
        "KEYSTORE_MASTER_KEY",
        "0000000000000000000000000000000000000000000000000000000000000000",
    );
}

#[tokio::test]
#[ignore = "requires postgres + env; run with `cargo test -- --ignored`"]
async fn ai_router_boots_in_under_500ms() {
    prime_env();

    let shared = SharedState::init_once().await.expect("shared state");

    let start = Instant::now();
    let _router = signapps_ai::router(shared).await.expect("router build");
    let elapsed = start.elapsed();

    assert!(
        elapsed < Duration::from_millis(500),
        "router build must not touch providers or GPUs: {elapsed:?}"
    );
    eprintln!("signapps-ai router built in {elapsed:?}");
}

#[tokio::test]
#[ignore = "requires postgres + env; run with `cargo test -- --ignored`"]
async fn ai_lazy_init_is_idempotent_and_fast_on_second_call() {
    prime_env();

    // First call pays the cost of GPU detection (nvidia-smi,
    // rocm-smi, Windows WMI) — can take several seconds.
    let first = Instant::now();
    signapps_ai::providers_lazy::ensure_initialized()
        .await
        .expect("first lazy init");
    let t1 = first.elapsed();

    // Second call must be a near-zero-cost cache read.
    let second = Instant::now();
    signapps_ai::providers_lazy::ensure_initialized()
        .await
        .expect("second lazy init");
    let t2 = second.elapsed();

    assert!(
        t2 < Duration::from_millis(50),
        "second call must reuse the OnceCell cache: {t2:?}"
    );
    eprintln!("lazy init first={t1:?} second={t2:?}");
}
