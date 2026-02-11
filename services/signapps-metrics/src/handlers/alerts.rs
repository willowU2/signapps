//! Alert management handlers.
//!
//! Provides endpoints to manage alerts, view active alerts, and acknowledge them.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use signapps_common::{Error, Result};
use std::collections::HashMap;
use std::sync::RwLock;
use uuid::Uuid;

use crate::AppState;

/// Alert severity level.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AlertSeverity {
    Info,
    Warning,
    Critical,
}

impl std::fmt::Display for AlertSeverity {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AlertSeverity::Info => write!(f, "info"),
            AlertSeverity::Warning => write!(f, "warning"),
            AlertSeverity::Critical => write!(f, "critical"),
        }
    }
}

/// Alert status.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AlertStatus {
    Active,
    Acknowledged,
    Resolved,
}

/// Type of metric to monitor.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MetricType {
    CpuUsage,
    MemoryUsage,
    DiskUsage,
    DiskIo,
    NetworkIn,
    NetworkOut,
    Custom,
}

/// Comparison operator for alert conditions.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Operator {
    GreaterThan,
    GreaterThanOrEqual,
    LessThan,
    LessThanOrEqual,
    Equal,
    NotEqual,
}

impl Operator {
    pub fn evaluate(&self, value: f64, threshold: f64) -> bool {
        match self {
            Operator::GreaterThan => value > threshold,
            Operator::GreaterThanOrEqual => value >= threshold,
            Operator::LessThan => value < threshold,
            Operator::LessThanOrEqual => value <= threshold,
            Operator::Equal => (value - threshold).abs() < f64::EPSILON,
            Operator::NotEqual => (value - threshold).abs() >= f64::EPSILON,
        }
    }
}

/// Alert configuration defining when an alert should trigger.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertConfig {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub metric_type: MetricType,
    /// For disk/network, specify which one (e.g., "sda", "eth0")
    pub metric_target: Option<String>,
    pub operator: Operator,
    pub threshold: f64,
    pub severity: AlertSeverity,
    /// Duration in seconds the condition must be true before alerting
    pub duration_seconds: u32,
    pub enabled: bool,
    /// Notification channels (e.g., ["email", "webhook"])
    pub notify_channels: Vec<String>,
    /// Webhook URL for notifications
    pub webhook_url: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

/// An alert event that was triggered.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertEvent {
    pub id: Uuid,
    pub config_id: Uuid,
    pub config_name: String,
    pub status: AlertStatus,
    pub severity: AlertSeverity,
    pub metric_type: MetricType,
    pub metric_value: f64,
    pub threshold: f64,
    pub message: String,
    pub triggered_at: chrono::DateTime<chrono::Utc>,
    pub acknowledged_at: Option<chrono::DateTime<chrono::Utc>>,
    pub acknowledged_by: Option<String>,
    pub resolved_at: Option<chrono::DateTime<chrono::Utc>>,
}

/// Request to create an alert configuration.
#[derive(Debug, Deserialize)]
pub struct CreateAlertRequest {
    pub name: String,
    pub description: Option<String>,
    pub metric_type: MetricType,
    pub metric_target: Option<String>,
    pub operator: Operator,
    pub threshold: f64,
    pub severity: AlertSeverity,
    #[serde(default = "default_duration")]
    pub duration_seconds: u32,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    #[serde(default)]
    pub notify_channels: Vec<String>,
    pub webhook_url: Option<String>,
}

fn default_duration() -> u32 {
    60
}

fn default_enabled() -> bool {
    true
}

/// Request to update an alert configuration.
#[derive(Debug, Deserialize)]
pub struct UpdateAlertRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub metric_type: Option<MetricType>,
    pub metric_target: Option<String>,
    pub operator: Option<Operator>,
    pub threshold: Option<f64>,
    pub severity: Option<AlertSeverity>,
    pub duration_seconds: Option<u32>,
    pub enabled: Option<bool>,
    pub notify_channels: Option<Vec<String>>,
    pub webhook_url: Option<String>,
}

/// Request to acknowledge an alert.
#[derive(Debug, Deserialize)]
pub struct AcknowledgeRequest {
    pub acknowledged_by: String,
    #[allow(dead_code)]
    pub comment: Option<String>,
}

/// Query parameters for listing alerts.
#[derive(Debug, Deserialize)]
pub struct ListAlertsQuery {
    pub severity: Option<AlertSeverity>,
    pub enabled: Option<bool>,
    pub limit: Option<usize>,
}

/// Query parameters for listing alert events.
#[derive(Debug, Deserialize)]
pub struct ListEventsQuery {
    pub status: Option<AlertStatus>,
    pub severity: Option<AlertSeverity>,
    pub limit: Option<usize>,
}

// In-memory storage (in production, use database)
static ALERT_CONFIGS: Lazy<RwLock<HashMap<Uuid, AlertConfig>>> =
    Lazy::new(|| RwLock::new(HashMap::new()));
static ALERT_EVENTS: Lazy<RwLock<Vec<AlertEvent>>> = Lazy::new(|| RwLock::new(Vec::new()));

/// List all alert configurations.
#[tracing::instrument(skip(_state))]
pub async fn list_alerts(
    State(_state): State<AppState>,
    Query(query): Query<ListAlertsQuery>,
) -> Result<Json<Vec<AlertConfig>>> {
    let guard = ALERT_CONFIGS
        .read()
        .map_err(|_| Error::Internal("Failed to read alerts".to_string()))?;

    let mut alerts: Vec<AlertConfig> = guard.values().cloned().collect();

    // Filter by severity
    if let Some(severity) = query.severity {
        alerts.retain(|a| a.severity == severity);
    }

    // Filter by enabled status
    if let Some(enabled) = query.enabled {
        alerts.retain(|a| a.enabled == enabled);
    }

    // Sort by created_at descending
    alerts.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    // Apply limit
    if let Some(limit) = query.limit {
        alerts.truncate(limit);
    }

    Ok(Json(alerts))
}

/// Get a single alert configuration.
#[tracing::instrument(skip(_state))]
pub async fn get_alert(
    State(_state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<AlertConfig>> {
    let guard = ALERT_CONFIGS
        .read()
        .map_err(|_| Error::Internal("Failed to read alerts".to_string()))?;

    let alert = guard
        .get(&id)
        .cloned()
        .ok_or_else(|| Error::NotFound(format!("Alert configuration {}", id)))?;

    Ok(Json(alert))
}

/// Create a new alert configuration.
#[tracing::instrument(skip(_state))]
pub async fn create_alert(
    State(_state): State<AppState>,
    Json(payload): Json<CreateAlertRequest>,
) -> Result<Json<AlertConfig>> {
    // Validate name
    if payload.name.trim().is_empty() {
        return Err(Error::Validation("Alert name cannot be empty".to_string()));
    }

    // Validate threshold
    if payload.threshold.is_nan() || payload.threshold.is_infinite() {
        return Err(Error::Validation("Invalid threshold value".to_string()));
    }

    let now = chrono::Utc::now();
    let alert = AlertConfig {
        id: Uuid::new_v4(),
        name: payload.name,
        description: payload.description,
        metric_type: payload.metric_type,
        metric_target: payload.metric_target,
        operator: payload.operator,
        threshold: payload.threshold,
        severity: payload.severity,
        duration_seconds: payload.duration_seconds,
        enabled: payload.enabled,
        notify_channels: payload.notify_channels,
        webhook_url: payload.webhook_url,
        created_at: now,
        updated_at: now,
    };

    let mut guard = ALERT_CONFIGS
        .write()
        .map_err(|_| Error::Internal("Failed to write alerts".to_string()))?;

    guard.insert(alert.id, alert.clone());

    tracing::info!(alert_id = %alert.id, name = %alert.name, "Alert configuration created");

    Ok(Json(alert))
}

/// Update an alert configuration.
#[tracing::instrument(skip(_state))]
pub async fn update_alert(
    State(_state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateAlertRequest>,
) -> Result<Json<AlertConfig>> {
    let mut guard = ALERT_CONFIGS
        .write()
        .map_err(|_| Error::Internal("Failed to write alerts".to_string()))?;

    let alert = guard
        .get_mut(&id)
        .ok_or_else(|| Error::NotFound(format!("Alert configuration {}", id)))?;

    // Validate name if provided
    if let Some(ref name) = payload.name {
        if name.trim().is_empty() {
            return Err(Error::Validation("Alert name cannot be empty".to_string()));
        }
        alert.name = name.clone();
    }

    // Validate threshold if provided
    if let Some(threshold) = payload.threshold {
        if threshold.is_nan() || threshold.is_infinite() {
            return Err(Error::Validation("Invalid threshold value".to_string()));
        }
        alert.threshold = threshold;
    }

    // Update other fields
    if let Some(description) = payload.description {
        alert.description = Some(description);
    }
    if let Some(metric_type) = payload.metric_type {
        alert.metric_type = metric_type;
    }
    if let Some(metric_target) = payload.metric_target {
        alert.metric_target = Some(metric_target);
    }
    if let Some(operator) = payload.operator {
        alert.operator = operator;
    }
    if let Some(severity) = payload.severity {
        alert.severity = severity;
    }
    if let Some(duration_seconds) = payload.duration_seconds {
        alert.duration_seconds = duration_seconds;
    }
    if let Some(enabled) = payload.enabled {
        alert.enabled = enabled;
    }
    if let Some(notify_channels) = payload.notify_channels {
        alert.notify_channels = notify_channels;
    }
    if let Some(webhook_url) = payload.webhook_url {
        alert.webhook_url = Some(webhook_url);
    }

    alert.updated_at = chrono::Utc::now();

    let updated = alert.clone();

    tracing::info!(alert_id = %id, "Alert configuration updated");

    Ok(Json(updated))
}

/// Delete an alert configuration.
#[tracing::instrument(skip(_state))]
pub async fn delete_alert(
    State(_state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    let mut guard = ALERT_CONFIGS
        .write()
        .map_err(|_| Error::Internal("Failed to write alerts".to_string()))?;

    if guard.remove(&id).is_none() {
        return Err(Error::NotFound(format!("Alert configuration {}", id)));
    }

    tracing::info!(alert_id = %id, "Alert configuration deleted");

    Ok(StatusCode::NO_CONTENT)
}

/// Get active alerts (alerts that are currently firing).
#[tracing::instrument(skip(state))]
pub async fn get_active_alerts(
    State(state): State<AppState>,
    Query(query): Query<ListEventsQuery>,
) -> Result<Json<Vec<AlertEvent>>> {
    // Check current metrics against alert configs and return active ones
    let metrics = state.collector.get_all_metrics().await;

    let configs_guard = ALERT_CONFIGS
        .read()
        .map_err(|_| Error::Internal("Failed to read alerts".to_string()))?;

    let mut events_guard = ALERT_EVENTS
        .write()
        .map_err(|_| Error::Internal("Failed to write alert events".to_string()))?;

    let now = chrono::Utc::now();

    // Check each enabled alert config
    for config in configs_guard.values().filter(|c| c.enabled) {
        let metric_value = match config.metric_type {
            MetricType::CpuUsage => Some(metrics.cpu.total_usage_percent as f64),
            MetricType::MemoryUsage => Some(metrics.memory.usage_percent),
            MetricType::DiskUsage => {
                if let Some(ref target) = config.metric_target {
                    metrics
                        .disks
                        .iter()
                        .find(|d| d.name == *target || d.mount_point == *target)
                        .map(|d| d.usage_percent)
                } else {
                    // Use overall disk usage
                    let total: u64 = metrics.disks.iter().map(|d| d.total_bytes).sum();
                    let used: u64 = metrics.disks.iter().map(|d| d.used_bytes).sum();
                    if total > 0 {
                        Some((used as f64 / total as f64) * 100.0)
                    } else {
                        None
                    }
                }
            },
            MetricType::NetworkIn => {
                if let Some(ref target) = config.metric_target {
                    metrics
                        .networks
                        .iter()
                        .find(|n| n.name == *target)
                        .map(|n| n.received_bytes as f64)
                } else {
                    Some(
                        metrics
                            .networks
                            .iter()
                            .map(|n| n.received_bytes)
                            .sum::<u64>() as f64,
                    )
                }
            },
            MetricType::NetworkOut => {
                if let Some(ref target) = config.metric_target {
                    metrics
                        .networks
                        .iter()
                        .find(|n| n.name == *target)
                        .map(|n| n.transmitted_bytes as f64)
                } else {
                    Some(
                        metrics
                            .networks
                            .iter()
                            .map(|n| n.transmitted_bytes)
                            .sum::<u64>() as f64,
                    )
                }
            },
            _ => None,
        };

        if let Some(value) = metric_value {
            let condition_met = config.operator.evaluate(value, config.threshold);

            if condition_met {
                // Check if we already have an active event for this config
                let existing = events_guard
                    .iter_mut()
                    .find(|e| e.config_id == config.id && e.status == AlertStatus::Active);

                if existing.is_none() {
                    // Create new alert event
                    let event = AlertEvent {
                        id: Uuid::new_v4(),
                        config_id: config.id,
                        config_name: config.name.clone(),
                        status: AlertStatus::Active,
                        severity: config.severity,
                        metric_type: config.metric_type,
                        metric_value: value,
                        threshold: config.threshold,
                        message: format!(
                            "{}: {} is {:.2} (threshold: {:.2})",
                            config.name,
                            format!("{:?}", config.metric_type).to_lowercase(),
                            value,
                            config.threshold
                        ),
                        triggered_at: now,
                        acknowledged_at: None,
                        acknowledged_by: None,
                        resolved_at: None,
                    };

                    tracing::warn!(
                        alert_id = %event.id,
                        config_name = %config.name,
                        severity = %config.severity,
                        metric_value = value,
                        threshold = config.threshold,
                        "Alert triggered"
                    );

                    events_guard.push(event);
                }
            } else {
                // Resolve any active events for this config
                for event in events_guard.iter_mut() {
                    if event.config_id == config.id && event.status == AlertStatus::Active {
                        event.status = AlertStatus::Resolved;
                        event.resolved_at = Some(now);

                        tracing::info!(
                            alert_id = %event.id,
                            config_name = %config.name,
                            "Alert resolved"
                        );
                    }
                }
            }
        }
    }

    // Return active events
    let mut active: Vec<AlertEvent> = events_guard
        .iter()
        .filter(|e| e.status == AlertStatus::Active)
        .cloned()
        .collect();

    // Apply filters
    if let Some(severity) = query.severity {
        active.retain(|e| e.severity == severity);
    }

    // Sort by triggered_at descending
    active.sort_by(|a, b| b.triggered_at.cmp(&a.triggered_at));

    // Apply limit
    if let Some(limit) = query.limit {
        active.truncate(limit);
    }

    Ok(Json(active))
}

/// List all alert events (history).
#[tracing::instrument(skip(_state))]
pub async fn list_alert_events(
    State(_state): State<AppState>,
    Query(query): Query<ListEventsQuery>,
) -> Result<Json<Vec<AlertEvent>>> {
    let guard = ALERT_EVENTS
        .read()
        .map_err(|_| Error::Internal("Failed to read alert events".to_string()))?;

    let mut events: Vec<AlertEvent> = guard.iter().cloned().collect();

    // Filter by status
    if let Some(status) = query.status {
        events.retain(|e| e.status == status);
    }

    // Filter by severity
    if let Some(severity) = query.severity {
        events.retain(|e| e.severity == severity);
    }

    // Sort by triggered_at descending
    events.sort_by(|a, b| b.triggered_at.cmp(&a.triggered_at));

    // Apply limit
    if let Some(limit) = query.limit {
        events.truncate(limit);
    }

    Ok(Json(events))
}

/// Acknowledge an alert.
#[tracing::instrument(skip(_state))]
pub async fn acknowledge_alert(
    State(_state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<AcknowledgeRequest>,
) -> Result<Json<AlertEvent>> {
    let mut guard = ALERT_EVENTS
        .write()
        .map_err(|_| Error::Internal("Failed to write alert events".to_string()))?;

    let event = guard
        .iter_mut()
        .find(|e| e.id == id)
        .ok_or_else(|| Error::NotFound(format!("Alert event {}", id)))?;

    if event.status != AlertStatus::Active {
        return Err(Error::BadRequest(format!(
            "Cannot acknowledge alert with status '{:?}'",
            event.status
        )));
    }

    event.status = AlertStatus::Acknowledged;
    event.acknowledged_at = Some(chrono::Utc::now());
    event.acknowledged_by = Some(payload.acknowledged_by.clone());

    tracing::info!(
        alert_id = %id,
        acknowledged_by = %payload.acknowledged_by,
        "Alert acknowledged"
    );

    Ok(Json(event.clone()))
}
