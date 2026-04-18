//! Asserts that the identity library router can be constructed and
//! responds to a basic request.

use axum::body::Body;
use axum::http::{Request, StatusCode};
use signapps_service::shared_state::SharedState;
use tower::ServiceExt;

#[tokio::test]
#[ignore = "requires postgres + env; run with `cargo test -- --ignored`"]
async fn identity_router_exposes_health_endpoint() {
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
    let app = signapps_identity::router(shared)
        .await
        .expect("router built");

    let response = app
        .oneshot(
            Request::builder()
                .uri("/health")
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("oneshot response");

    assert_eq!(response.status(), StatusCode::OK);
}
