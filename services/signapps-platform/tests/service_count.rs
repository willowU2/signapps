//! Asserts that `declare()` returns all 34 service specs wired into the
//! single-binary runtime.

use signapps_platform::services;
use signapps_service::shared_state::SharedState;

const EXPECTED_SERVICE_COUNT: usize = 34;

#[tokio::test]
#[ignore = "requires postgres + env; run with `cargo test -- --ignored`"]
async fn declare_returns_expected_service_count() {
    std::env::set_var(
        "DATABASE_URL",
        "postgres://signapps:signapps_dev@localhost:5432/signapps",
    );
    std::env::set_var("JWT_SECRET", "x".repeat(32));
    std::env::set_var(
        "KEYSTORE_MASTER_KEY",
        "0000000000000000000000000000000000000000000000000000000000000000",
    );

    let shared = SharedState::init_once().await.expect("shared state");
    let specs = services::declare(shared);

    assert_eq!(
        specs.len(),
        EXPECTED_SERVICE_COUNT,
        "expected {EXPECTED_SERVICE_COUNT} service specs, got {}",
        specs.len()
    );

    // Names must be unique; ports must be unique.
    let mut names: Vec<&str> = specs.iter().map(|s| s.name.as_str()).collect();
    names.sort_unstable();
    names.dedup();
    assert_eq!(
        names.len(),
        specs.len(),
        "duplicate service names in declare()"
    );

    let mut ports: Vec<u16> = specs.iter().map(|s| s.port).collect();
    ports.sort_unstable();
    ports.dedup();
    assert_eq!(
        ports.len(),
        specs.len(),
        "duplicate service ports in declare()"
    );
}
