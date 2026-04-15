//! Maintenance mode middleware.
//!
//! Reads the `deploy:maintenance:{env}` cache key. When the stored value is
//! `"1"`, returns the static maintenance HTML page with HTTP 503. Otherwise
//! forwards the request to the next layer.

use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::{Html, IntoResponse, Response},
};
use signapps_cache::CacheService;
use std::sync::Arc;

const MAINTENANCE_HTML: &str = include_str!("../../static/maintenance.html");

/// Maintenance key prefix. The env component is taken from `MaintenanceState.env`.
const MAINTENANCE_KEY_PREFIX: &str = "deploy:maintenance:";

/// State passed to [`maintenance_middleware`] via axum's extractors.
#[derive(Clone)]
pub struct MaintenanceState {
    pub cache: Arc<CacheService>,
    pub env: String,
}

/// Axum middleware that intercepts traffic when maintenance mode is active.
pub async fn maintenance_middleware(
    State(state): State<MaintenanceState>,
    req: Request,
    next: Next,
) -> Response {
    let key = format!("{MAINTENANCE_KEY_PREFIX}{}", state.env);
    let is_on = state.cache.get(&key).await.as_deref() == Some("1");
    if is_on {
        return (StatusCode::SERVICE_UNAVAILABLE, Html(MAINTENANCE_HTML)).into_response();
    }
    next.run(req).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{body::Body, http::Request, middleware, routing::get, Router};
    use std::time::Duration;
    use tower::ServiceExt;

    fn make_app(cache: Arc<CacheService>, env: &str) -> Router {
        let state = MaintenanceState {
            cache,
            env: env.to_string(),
        };
        Router::new()
            .route("/test", get(|| async { "ok" }))
            .layer(middleware::from_fn_with_state(
                state,
                maintenance_middleware,
            ))
    }

    #[tokio::test]
    async fn returns_503_when_maintenance_on() {
        let cache = Arc::new(CacheService::default_config());
        cache
            .set("deploy:maintenance:prod", "1", Duration::from_secs(60))
            .await;
        let app = make_app(cache, "prod");

        let resp = app
            .oneshot(Request::builder().uri("/test").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::SERVICE_UNAVAILABLE);
    }

    #[tokio::test]
    async fn passes_through_when_maintenance_off() {
        let cache = Arc::new(CacheService::default_config());
        let app = make_app(cache, "prod");

        let resp = app
            .oneshot(Request::builder().uri("/test").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn passes_through_when_value_not_one() {
        let cache = Arc::new(CacheService::default_config());
        cache
            .set("deploy:maintenance:prod", "0", Duration::from_secs(60))
            .await;
        let app = make_app(cache, "prod");

        let resp = app
            .oneshot(Request::builder().uri("/test").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
    }
}
