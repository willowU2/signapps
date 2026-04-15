//! E2E smoke test: spin up the API in-process, hit each read endpoint.
//!
//! Auth layer is bypassed — we build a bare router from the handler modules
//! because the production layer requires a valid JWT. The tests only assert
//! that the plumbing (routes, handlers, state) is wired correctly.

use axum::Router;
use reqwest::StatusCode;
use signapps_cache::CacheService;
use signapps_deploy::api::state::AppState;
use signapps_feature_flags::{cache::FeatureFlagCache, repository::PgFeatureFlagRepository};
use sqlx::PgPool;
use std::{net::SocketAddr, sync::Arc};
use tokio::net::TcpListener;

async fn test_pool() -> PgPool {
    let url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://signapps:signapps_dev@127.0.0.1:5432/signapps".to_string());
    PgPool::connect(&url).await.expect("connect")
}

fn make_test_jwt_config() -> signapps_common::JwtConfig {
    // Integration tests live outside the `signapps-common` crate, so the
    // `#[cfg(test)]`-gated `JwtConfig::for_test` helper is not visible here.
    // `hs256()` is public and accepts any secret — the auth layer is bypassed
    // in these smoke tests anyway, but we still need a valid config to build
    // the `AppState`.
    signapps_common::JwtConfig::hs256("test-secret-at-least-32-chars-ok-12345".to_string())
}

async fn spawn_router_without_auth() -> String {
    let pool = test_pool().await;
    let cache = Arc::new(CacheService::default_config());
    let jwt = make_test_jwt_config();
    let ff_cache = FeatureFlagCache::new(cache.clone());
    let ff_repo = PgFeatureFlagRepository::new(pool.clone(), ff_cache);
    let state = AppState {
        pool,
        cache,
        jwt,
        feature_flags: ff_repo,
    };

    let api = Router::new()
        .merge(signapps_deploy::api::handlers::envs::router())
        .merge(signapps_deploy::api::handlers::versions::router())
        .merge(signapps_deploy::api::handlers::history::router())
        .merge(signapps_deploy::api::handlers::feature_flags::router())
        .with_state(state);

    let app = Router::new().nest("/api/v1/deploy", api);

    let listener = TcpListener::bind("127.0.0.1:0").await.expect("bind");
    let addr: SocketAddr = listener.local_addr().expect("local_addr");
    tokio::spawn(async move {
        axum::serve(listener, app).await.expect("serve");
    });

    format!("http://{addr}")
}

#[tokio::test]
#[ignore = "requires Postgres"]
async fn list_envs_returns_two_entries() {
    let base = spawn_router_without_auth().await;
    let resp = reqwest::get(format!("{base}/api/v1/deploy/envs"))
        .await
        .expect("GET");
    assert_eq!(resp.status(), StatusCode::OK);
    let body: serde_json::Value = resp.json().await.expect("json");
    let arr = body.as_array().expect("array");
    assert_eq!(arr.len(), 2);
    let envs: Vec<&str> = arr
        .iter()
        .map(|e| e["env"].as_str().unwrap_or(""))
        .collect();
    assert!(envs.contains(&"prod"));
    assert!(envs.contains(&"dev"));
}

#[tokio::test]
#[ignore = "requires Postgres"]
async fn list_history_accepts_env_filter() {
    let base = spawn_router_without_auth().await;
    let resp = reqwest::get(format!("{base}/api/v1/deploy/history?env=dev&limit=5"))
        .await
        .expect("GET");
    assert_eq!(resp.status(), StatusCode::OK);
    let body: serde_json::Value = resp.json().await.expect("json");
    assert!(body.is_array());
}

#[tokio::test]
#[ignore = "requires Postgres"]
async fn feature_flag_upsert_get_delete_roundtrip() {
    let base = spawn_router_without_auth().await;
    let client = reqwest::Client::new();
    let key = format!("test-flag-{}", uuid::Uuid::new_v4());

    let resp = client
        .put(format!("{base}/api/v1/deploy/feature-flags/{key}"))
        .json(&serde_json::json!({
            "env": "prod",
            "enabled": true,
            "rollout_percent": 50,
            "target_orgs": [],
            "target_users": [],
            "description": "test"
        }))
        .send()
        .await
        .expect("PUT");
    assert_eq!(resp.status(), StatusCode::OK);

    let resp = client
        .get(format!("{base}/api/v1/deploy/feature-flags/{key}?env=prod"))
        .send()
        .await
        .expect("GET");
    assert_eq!(resp.status(), StatusCode::OK);

    let resp = client
        .delete(format!("{base}/api/v1/deploy/feature-flags/{key}?env=prod"))
        .send()
        .await
        .expect("DELETE");
    assert_eq!(resp.status(), StatusCode::OK);
}
