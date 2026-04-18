use std::sync::Arc;

use signapps_service::shared_state::SharedState;

#[tokio::test]
#[ignore = "requires postgres running locally; run with `cargo test -- --ignored`"]
async fn shared_state_init_once_populates_all_fields() {
    std::env::set_var(
        "DATABASE_URL",
        "postgres://signapps:signapps_dev@localhost:5432/signapps",
    );
    std::env::set_var("JWT_SECRET", "x".repeat(32));
    std::env::set_var(
        "KEYSTORE_MASTER_KEY",
        "0000000000000000000000000000000000000000000000000000000000000000",
    );

    let shared = SharedState::init_once()
        .await
        .expect("SharedState::init_once should succeed with env set");

    assert!(shared.pool.inner().size() > 0, "pg pool must be open");
    assert!(Arc::strong_count(&shared.keystore) >= 1);
    assert!(Arc::strong_count(&shared.cache) >= 1);
    assert!(Arc::strong_count(&shared.event_bus) >= 1);
    // jwt is Arc<JwtConfig>
    assert!(Arc::strong_count(&shared.jwt) >= 1);
}
