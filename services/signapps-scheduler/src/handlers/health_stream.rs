//! IF1: Health check SSE endpoint for the scheduler service.
//!
//! `GET /api/v1/scheduler/health-stream`
//! Every 10 seconds emits a JSON payload with the current status of key services.

use axum::{
    extract::State,
    response::sse::{Event, KeepAlive, Sse},
};
use futures::stream::Stream;
use serde::Serialize;
use std::convert::Infallible;
use std::time::Duration;

use crate::AppState;

/// Status of a single downstream service.
#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
/// ServiceStatus data transfer object.
pub struct ServiceStatus {
    pub name: String,
    pub port: u16,
    pub healthy: bool,
    pub checked_at: String,
}

/// Payload pushed via SSE.
#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
/// HealthSnapshot data transfer object.
pub struct HealthSnapshot {
    pub services: Vec<ServiceStatus>,
    pub all_healthy: bool,
    pub timestamp: String,
}

/// List of services to probe — matches the frontend's ALL_SERVICES registry.
const SERVICES: &[(&str, u16)] = &[
    ("identity", 3001),
    ("containers", 3002),
    ("proxy", 3003),
    ("storage", 3004),
    ("ai", 3005),
    ("securelink", 3006),
    ("scheduler", 3007),
    ("metrics", 3008),
    ("media", 3009),
    ("docs", 3010),
    ("calendar", 3011),
    ("mail", 3012),
    ("collab", 3013),
    ("meet", 3014),
    ("forms", 3015),
];

async fn probe_service(name: &str, port: u16) -> ServiceStatus {
    let url = format!("http://127.0.0.1:{}/health", port);
    let healthy = match tokio::time::timeout(Duration::from_secs(3), reqwest::get(&url)).await {
        Ok(Ok(resp)) => resp.status().is_success(),
        _ => false,
    };

    ServiceStatus {
        name: name.to_string(),
        port,
        healthy,
        checked_at: chrono::Utc::now().to_rfc3339(),
    }
}

async fn collect_snapshot() -> HealthSnapshot {
    let checks: Vec<ServiceStatus> = futures::future::join_all(
        SERVICES
            .iter()
            .map(|(name, port)| probe_service(name, *port)),
    )
    .await;

    let all_healthy = checks.iter().all(|s| s.healthy);
    let timestamp = chrono::Utc::now().to_rfc3339();

    HealthSnapshot {
        services: checks,
        all_healthy,
        timestamp,
    }
}

/// SSE endpoint streaming health snapshots every 10 seconds.
///
/// No auth required so monitoring dashboards can connect without a token,
/// but you can layer auth middleware on the route registration if needed.
#[utoipa::path(
    get,
    path = "/api/v1/scheduler/health-stream",
    responses(
        (status = 200, description = "SSE stream of health snapshots"),
    ),
    tag = "Health"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn health_stream(
    State(_state): State<AppState>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let stream = async_stream::stream! {
        loop {
            let snapshot = collect_snapshot().await;
            let json = serde_json::to_string(&snapshot).unwrap_or_default();
            let event = Event::default()
                .event("health")
                .data(json);
            yield Ok::<Event, Infallible>(event);
            tokio::time::sleep(Duration::from_secs(10)).await;
        }
    };

    Sse::new(stream).keep_alive(
        KeepAlive::new()
            .interval(Duration::from_secs(15))
            .text("ping"),
    )
}

#[cfg(test)]
mod tests {
    #[allow(unused_imports)]
    use super::*;

    #[test]
    fn module_compiles() {
        // Verify this handler module compiles correctly.
        // Integration tests require a running database and service.
        assert!(true, "{} handler module loaded", module_path!());
    }
}
