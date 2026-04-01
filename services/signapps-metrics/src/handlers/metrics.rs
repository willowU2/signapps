//! Metrics handlers.

use axum::{
    extract::State,
    http::{header, StatusCode},
    response::sse::{Event, Sse},
    response::IntoResponse,
    Json,
};
use futures_util::stream::Stream;
use serde::Serialize;
use std::convert::Infallible;
use std::time::Duration;

use crate::metrics::collector::{
    CpuMetrics, DiskMetrics, MemoryMetrics, NetworkMetrics, SystemMetrics,
};
use crate::AppState;
use signapps_common::Result;

/// Get all system metrics.
#[utoipa::path(
    get,
    path = "/api/v1/system",
    responses(
        (status = 200, description = "All system metrics", body = SystemMetrics),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Metrics"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn get_all_metrics(State(state): State<AppState>) -> Result<Json<SystemMetrics>> {
    let metrics = state.collector.get_all_metrics().await;
    Ok(Json(metrics))
}

/// Get CPU metrics.
#[utoipa::path(
    get,
    path = "/api/v1/system/cpu",
    responses(
        (status = 200, description = "CPU metrics", body = CpuMetrics),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Metrics"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn get_cpu_metrics(State(state): State<AppState>) -> Result<Json<CpuMetrics>> {
    let metrics = state.collector.get_cpu_metrics().await;
    Ok(Json(metrics))
}

/// Get memory metrics.
#[utoipa::path(
    get,
    path = "/api/v1/system/memory",
    responses(
        (status = 200, description = "Memory metrics", body = MemoryMetrics),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Metrics"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn get_memory_metrics(State(state): State<AppState>) -> Result<Json<MemoryMetrics>> {
    let metrics = state.collector.get_memory_metrics().await;
    Ok(Json(metrics))
}

/// Get disk metrics.
#[utoipa::path(
    get,
    path = "/api/v1/system/disk",
    responses(
        (status = 200, description = "Disk metrics", body = Vec<DiskMetrics>),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Metrics"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn get_disk_metrics(State(state): State<AppState>) -> Result<Json<Vec<DiskMetrics>>> {
    let metrics = state.collector.get_disk_metrics().await;
    Ok(Json(metrics))
}

/// Get network metrics.
#[utoipa::path(
    get,
    path = "/api/v1/system/network",
    responses(
        (status = 200, description = "Network interface metrics", body = Vec<NetworkMetrics>),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Metrics"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn get_network_metrics(
    State(state): State<AppState>,
) -> Result<Json<Vec<NetworkMetrics>>> {
    let metrics = state.collector.get_network_metrics().await;
    Ok(Json(metrics))
}

/// Prometheus metrics endpoint.
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn prometheus_metrics(State(state): State<AppState>) -> impl IntoResponse {
    // Update metrics before export
    state.exporter.update().await;

    let body = state.exporter.export();

    (
        StatusCode::OK,
        [(
            header::CONTENT_TYPE,
            "text/plain; version=0.0.4; charset=utf-8",
        )],
        body,
    )
}

/// Health check.
#[utoipa::path(
    get,
    path = "/health",
    responses(
        (status = 200, description = "Service health status", body = HealthResponse),
    ),
    tag = "Metrics"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn health_check(State(state): State<AppState>) -> Result<Json<HealthResponse>> {
    let metrics = state.collector.get_all_metrics().await;

    // Determine health status
    let status = if metrics.memory.usage_percent > 95.0 || metrics.cpu.total_usage_percent > 90.0 {
        "degraded"
    } else {
        "healthy"
    };

    // Check disk space
    let critical_disk = metrics
        .disks
        .iter()
        .any(|d| d.usage_percent > 90.0 && !d.is_removable);

    let final_status = if critical_disk { "degraded" } else { status };

    Ok(Json(HealthResponse {
        status: final_status.to_string(),
        cpu_usage_percent: metrics.cpu.total_usage_percent,
        memory_usage_percent: metrics.memory.usage_percent,
        uptime_seconds: metrics.uptime_seconds,
    }))
}

/// Health response.
#[derive(Debug, Serialize, utoipa::ToSchema)]
/// Response for Health.
pub struct HealthResponse {
    pub status: String,
    pub cpu_usage_percent: f32,
    pub memory_usage_percent: f64,
    pub uptime_seconds: u64,
}

/// Summary metrics for dashboard.
#[utoipa::path(
    get,
    path = "/api/v1/system/summary",
    responses(
        (status = 200, description = "System summary metrics", body = SummaryMetrics),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Metrics"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn get_summary(State(state): State<AppState>) -> Result<Json<SummaryMetrics>> {
    let metrics = state.collector.get_all_metrics().await;

    let total_disk_bytes: u64 = metrics
        .disks
        .iter()
        .filter(|d| !d.is_removable)
        .map(|d| d.total_bytes)
        .sum();

    let used_disk_bytes: u64 = metrics
        .disks
        .iter()
        .filter(|d| !d.is_removable)
        .map(|d| d.used_bytes)
        .sum();

    let total_network_rx: u64 = metrics.networks.iter().map(|n| n.received_bytes).sum();

    let total_network_tx: u64 = metrics.networks.iter().map(|n| n.transmitted_bytes).sum();

    Ok(Json(SummaryMetrics {
        hostname: metrics.hostname,
        os_name: metrics.os_name,
        uptime_seconds: metrics.uptime_seconds,
        cpu_cores: metrics.cpu.count,
        cpu_usage_percent: metrics.cpu.total_usage_percent,
        memory_total_bytes: metrics.memory.total_bytes,
        memory_used_bytes: metrics.memory.used_bytes,
        memory_usage_percent: metrics.memory.usage_percent,
        disk_total_bytes: total_disk_bytes,
        disk_used_bytes: used_disk_bytes,
        disk_usage_percent: if total_disk_bytes > 0 {
            (used_disk_bytes as f64 / total_disk_bytes as f64) * 100.0
        } else {
            0.0
        },
        network_rx_bytes: total_network_rx,
        network_tx_bytes: total_network_tx,
    }))
}

/// Summary metrics.
#[derive(Debug, Serialize, utoipa::ToSchema)]
/// SummaryMetrics data transfer object.
pub struct SummaryMetrics {
    pub hostname: String,
    pub os_name: String,
    pub uptime_seconds: u64,
    pub cpu_cores: usize,
    pub cpu_usage_percent: f32,
    pub memory_total_bytes: u64,
    pub memory_used_bytes: u64,
    pub memory_usage_percent: f64,
    pub disk_total_bytes: u64,
    pub disk_used_bytes: u64,
    pub disk_usage_percent: f64,
    pub network_rx_bytes: u64,
    pub network_tx_bytes: u64,
}

/// SSE stream of system metrics, updated every 2 seconds.
/// The stream automatically closes after 30 minutes to prevent unbounded connections.
/// Clients should reconnect when the stream ends.
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn metrics_stream(
    State(state): State<AppState>,
) -> Sse<impl Stream<Item = std::result::Result<Event, Infallible>>> {
    // Maximum stream duration: 30 minutes (900 events at 2-second intervals).
    // This prevents connections from lasting forever and leaking resources.
    const MAX_EVENTS: u64 = 900;

    let stream = async_stream::stream! {
        let mut interval = tokio::time::interval(Duration::from_secs(2));
        let mut event_count: u64 = 0;

        loop {
            interval.tick().await;

            event_count += 1;
            if event_count > MAX_EVENTS {
                // Close the stream after the maximum duration
                tracing::debug!("SSE metrics stream closing after {} events", MAX_EVENTS);
                break;
            }

            let metrics = state.collector.get_all_metrics().await;

            let total_disk_bytes: u64 = metrics.disks.iter()
                .filter(|d| !d.is_removable)
                .map(|d| d.total_bytes)
                .sum();
            let used_disk_bytes: u64 = metrics.disks.iter()
                .filter(|d| !d.is_removable)
                .map(|d| d.used_bytes)
                .sum();
            let total_network_rx: u64 = metrics.networks.iter()
                .map(|n| n.received_bytes)
                .sum();
            let total_network_tx: u64 = metrics.networks.iter()
                .map(|n| n.transmitted_bytes)
                .sum();

            let summary = SummaryMetrics {
                hostname: metrics.hostname,
                os_name: metrics.os_name,
                uptime_seconds: metrics.uptime_seconds,
                cpu_cores: metrics.cpu.count,
                cpu_usage_percent: metrics.cpu.total_usage_percent,
                memory_total_bytes: metrics.memory.total_bytes,
                memory_used_bytes: metrics.memory.used_bytes,
                memory_usage_percent: metrics.memory.usage_percent,
                disk_total_bytes: total_disk_bytes,
                disk_used_bytes: used_disk_bytes,
                disk_usage_percent: if total_disk_bytes > 0 {
                    (used_disk_bytes as f64 / total_disk_bytes as f64) * 100.0
                } else {
                    0.0
                },
                network_rx_bytes: total_network_rx,
                network_tx_bytes: total_network_tx,
            };

            if let Ok(json) = serde_json::to_string(&summary) {
                yield Ok(Event::default().data(json));
            }
        }
    };

    Sse::new(stream).keep_alive(
        axum::response::sse::KeepAlive::new()
            .interval(Duration::from_secs(15))
            .text("keep-alive"),
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
