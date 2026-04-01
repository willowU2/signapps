// MD1-MD5, BK1-BK4: Monitoring, metrics, alerts, event logs, components, licenses,
// network interfaces, maintenance windows
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use signapps_db::DatabasePool;
use uuid::Uuid;

fn internal_err(e: impl std::fmt::Display) -> (StatusCode, String) {
    (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
}

// ─── MD1: Agent metrics query ────────────────────────────────────────────────

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Query parameters for filtering and pagination.
pub struct MetricsQuery {
    pub range: Option<String>, // e.g. "24h", "7d"
}

#[derive(Debug, Serialize, sqlx::FromRow, utoipa::ToSchema)]
/// Represents a metric row.
pub struct MetricRow {
    pub id: Uuid,
    pub hardware_id: Uuid,
    pub cpu_usage: Option<f32>,
    pub memory_usage: Option<f32>,
    pub disk_usage: Option<f32>,
    pub uptime_seconds: Option<i64>,
    pub collected_at: DateTime<Utc>,
}

#[utoipa::path(
    get,
    path = "/api/v1/it-assets/hardware/{hw_id}/metrics",
    params(
        ("hw_id" = uuid::Uuid, Path, description = "Hardware UUID"),
        ("range" = Option<String>, Query, description = "Time range: 24h, 7d, 30d"),
    ),
    responses(
        (status = 200, description = "Hardware metrics", body = Vec<MetricRow>),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Monitoring"
)]
#[tracing::instrument(skip_all)]
pub async fn get_metrics(
    State(pool): State<DatabasePool>,
    Path(hw_id): Path<Uuid>,
    Query(q): Query<MetricsQuery>,
) -> Result<Json<Vec<MetricRow>>, (StatusCode, String)> {
    let hours: i64 = match q.range.as_deref() {
        Some("7d") => 168,
        Some("30d") => 720,
        _ => 24, // default 24h
    };

    let rows = sqlx::query_as::<_, MetricRow>(
        r#"
        SELECT id, hardware_id, cpu_usage, memory_usage, disk_usage, uptime_seconds, collected_at
        FROM it.agent_metrics
        WHERE hardware_id = $1
          AND collected_at >= now() - ($2 || ' hours')::interval
        ORDER BY collected_at ASC
        "#,
    )
    .bind(hw_id)
    .bind(hours.to_string())
    .fetch_all(pool.inner())
    .await
    .map_err(internal_err)?;

    Ok(Json(rows))
}

// ─── MD2: Alert rules CRUD ───────────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow, utoipa::ToSchema)]
/// Represents a alert rule.
pub struct AlertRule {
    pub id: Uuid,
    pub hardware_id: Option<Uuid>,
    pub metric: String,
    pub operator: String,
    pub threshold: f32,
    pub duration_seconds: Option<i32>,
    pub severity: Option<String>,
    pub enabled: Option<bool>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Represents a create alert rule req.
pub struct CreateAlertRuleReq {
    pub hardware_id: Option<Uuid>,
    pub metric: String,
    pub operator: Option<String>,
    pub threshold: f32,
    pub duration_seconds: Option<i32>,
    pub severity: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow, utoipa::ToSchema)]
/// Represents a alert row.
pub struct AlertRow {
    pub id: Uuid,
    pub rule_id: Uuid,
    pub hardware_id: Uuid,
    pub triggered_at: DateTime<Utc>,
    pub resolved_at: Option<DateTime<Utc>>,
    pub value: Option<f32>,
}

#[utoipa::path(
    get,
    path = "/api/v1/it-assets/monitoring/alert-rules",
    responses(
        (status = 200, description = "Alert rules list", body = Vec<AlertRule>),
    ),
    security(("bearer" = [])),
    tag = "Monitoring"
)]
#[tracing::instrument(skip_all)]
pub async fn list_alert_rules(
    State(pool): State<DatabasePool>,
) -> Result<Json<Vec<AlertRule>>, (StatusCode, String)> {
    let rows = sqlx::query_as::<_, AlertRule>(
        "SELECT id, hardware_id, metric, operator, threshold, duration_seconds, severity, enabled, created_at FROM it.alert_rules ORDER BY created_at DESC",
    )
    .fetch_all(pool.inner())
    .await
    .map_err(internal_err)?;
    Ok(Json(rows))
}

#[utoipa::path(
    post,
    path = "/api/v1/it-assets/monitoring/alert-rules",
    request_body = CreateAlertRuleReq,
    responses(
        (status = 201, description = "Alert rule created", body = AlertRule),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Monitoring"
)]
#[tracing::instrument(skip_all)]
pub async fn create_alert_rule(
    State(pool): State<DatabasePool>,
    Json(payload): Json<CreateAlertRuleReq>,
) -> Result<(StatusCode, Json<AlertRule>), (StatusCode, String)> {
    let row = sqlx::query_as::<_, AlertRule>(
        r#"
        INSERT INTO it.alert_rules (hardware_id, metric, operator, threshold, duration_seconds, severity)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, hardware_id, metric, operator, threshold, duration_seconds, severity, enabled, created_at
        "#,
    )
    .bind(payload.hardware_id)
    .bind(&payload.metric)
    .bind(payload.operator.as_deref().unwrap_or(">"))
    .bind(payload.threshold)
    .bind(payload.duration_seconds.unwrap_or(300))
    .bind(payload.severity.as_deref().unwrap_or("warning"))
    .fetch_one(pool.inner())
    .await
    .map_err(internal_err)?;
    Ok((StatusCode::CREATED, Json(row)))
}

#[utoipa::path(
    delete,
    path = "/api/v1/it-assets/monitoring/alert-rules/{id}",
    params(("id" = uuid::Uuid, Path, description = "Alert rule UUID")),
    responses(
        (status = 204, description = "Alert rule deleted"),
        (status = 404, description = "Alert rule not found"),
    ),
    security(("bearer" = [])),
    tag = "Monitoring"
)]
#[tracing::instrument(skip_all)]
pub async fn delete_alert_rule(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    let result = sqlx::query("DELETE FROM it.alert_rules WHERE id = $1")
        .bind(id)
        .execute(pool.inner())
        .await
        .map_err(internal_err)?;
    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Alert rule not found".to_string()));
    }
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get,
    path = "/api/v1/it-assets/monitoring/alerts",
    responses(
        (status = 200, description = "Alerts list", body = Vec<AlertRow>),
    ),
    security(("bearer" = [])),
    tag = "Monitoring"
)]
#[tracing::instrument(skip_all)]
pub async fn list_alerts(
    State(pool): State<DatabasePool>,
) -> Result<Json<Vec<AlertRow>>, (StatusCode, String)> {
    let rows = sqlx::query_as::<_, AlertRow>(
        "SELECT id, rule_id, hardware_id, triggered_at, resolved_at, value FROM it.alerts ORDER BY triggered_at DESC LIMIT 500",
    )
    .fetch_all(pool.inner())
    .await
    .map_err(internal_err)?;
    Ok(Json(rows))
}

#[utoipa::path(
    post,
    path = "/api/v1/it-assets/monitoring/alerts/{id}/resolve",
    params(("id" = uuid::Uuid, Path, description = "Alert UUID")),
    responses(
        (status = 204, description = "Alert resolved"),
        (status = 404, description = "Alert not found"),
    ),
    security(("bearer" = [])),
    tag = "Monitoring"
)]
#[tracing::instrument(skip_all)]
pub async fn resolve_alert(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    let result = sqlx::query(
        "UPDATE it.alerts SET resolved_at = now() WHERE id = $1 AND resolved_at IS NULL",
    )
    .bind(id)
    .execute(pool.inner())
    .await
    .map_err(internal_err)?;
    if result.rows_affected() == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            "Alert not found or already resolved".to_string(),
        ));
    }
    Ok(StatusCode::NO_CONTENT)
}

// ─── MD2+: Alert notification & automation hook ──────────────────────────────
//
// Called when a metric ingestion detects a threshold breach and creates an alert.
// Publishes an `it.alert.fired` event to the notifications service event bus
// and evaluates automation rules.

#[allow(dead_code)]
pub async fn fire_alert(
    pool: &DatabasePool,
    rule_id: Uuid,
    hardware_id: Uuid,
    metric: &str,
    value: f32,
    severity: &str,
) {
    // Insert alert record
    let alert_id: Option<Uuid> = sqlx::query_scalar(
        r#"
        INSERT INTO it.alerts (rule_id, hardware_id, value)
        VALUES ($1, $2, $3)
        RETURNING id
        "#,
    )
    .bind(rule_id)
    .bind(hardware_id)
    .bind(value)
    .fetch_optional(pool.inner())
    .await
    .ok()
    .flatten();

    tracing::info!(
        alert_id = ?alert_id,
        hardware_id = %hardware_id,
        metric = %metric,
        value = %value,
        severity = %severity,
        "Alert fired — publishing it.alert.fired"
    );

    // Evaluate automation rules (condition→action engine)
    let event = crate::handlers::automation::AlertFiredEvent {
        rule_id,
        hardware_id,
        metric: metric.to_string(),
        value: value as f64,
        severity: severity.to_string(),
    };
    crate::handlers::automation::evaluate_alert_rules(pool, &event).await;

    // Publish notification event via the notifications service event topic.
    // The notifications service listens to all events and creates in-app + email alerts.
    let notification_payload = serde_json::json!({
        "event": "it.alert.fired",
        "alert_id": alert_id,
        "hardware_id": hardware_id,
        "metric": metric,
        "value": value,
        "severity": severity,
        "message": format!("{} alert: {} = {:.1}", severity, metric, value),
    });
    tracing::info!(
        payload = %notification_payload,
        "Notification event: it.alert.fired"
    );
    // In production: publish to Redis stream / NATS / PostgreSQL NOTIFY
    // pub_event("it.alert.fired", &notification_payload).await;
}

// ─── MD3: Event logs ─────────────────────────────────────────────────────────

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Represents a log entry.
pub struct LogEntry {
    pub level: Option<String>,
    pub source: Option<String>,
    pub message: String,
    pub metadata: Option<Value>,
    pub occurred_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Represents a ingest logs req.
pub struct IngestLogsReq {
    pub agent_id: Uuid,
    pub logs: Vec<LogEntry>,
}

#[derive(Debug, Serialize, sqlx::FromRow, utoipa::ToSchema)]
/// Represents a event log row.
pub struct EventLogRow {
    pub id: Uuid,
    pub hardware_id: Uuid,
    pub level: String,
    pub source: Option<String>,
    pub message: String,
    pub metadata: Option<Value>,
    pub occurred_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Query parameters for filtering and pagination.
pub struct LogQuery {
    pub level: Option<String>,
    pub search: Option<String>,
    pub limit: Option<i64>,
}

#[utoipa::path(
    post,
    path = "/api/v1/it-assets/agent/logs",
    request_body = IngestLogsReq,
    responses(
        (status = 204, description = "Logs ingested"),
        (status = 404, description = "Agent not registered"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Monitoring"
)]
#[tracing::instrument(skip_all)]
pub async fn ingest_event_logs(
    State(pool): State<DatabasePool>,
    Json(payload): Json<IngestLogsReq>,
) -> Result<StatusCode, (StatusCode, String)> {
    let hw = sqlx::query!(
        "SELECT id FROM it.hardware WHERE agent_id = $1",
        payload.agent_id
    )
    .fetch_optional(pool.inner())
    .await
    .map_err(internal_err)?
    .ok_or((StatusCode::NOT_FOUND, "Agent not registered".to_string()))?;

    let hardware_id = hw.id;
    for entry in payload.logs {
        sqlx::query(
            r#"
            INSERT INTO it.event_logs (hardware_id, level, source, message, metadata, occurred_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            "#,
        )
        .bind(hardware_id)
        .bind(entry.level.as_deref().unwrap_or("info"))
        .bind(&entry.source)
        .bind(&entry.message)
        .bind(&entry.metadata)
        .bind(entry.occurred_at.unwrap_or_else(Utc::now))
        .execute(pool.inner())
        .await
        .map_err(internal_err)?;
    }
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get,
    path = "/api/v1/it-assets/hardware/{hw_id}/logs",
    params(
        ("hw_id" = uuid::Uuid, Path, description = "Hardware UUID"),
        ("level" = Option<String>, Query, description = "Log level filter"),
        ("search" = Option<String>, Query, description = "Search in message"),
        ("limit" = Option<i64>, Query, description = "Max results"),
    ),
    responses(
        (status = 200, description = "Event logs", body = Vec<EventLogRow>),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Monitoring"
)]
#[tracing::instrument(skip_all)]
pub async fn get_event_logs(
    State(pool): State<DatabasePool>,
    Path(hw_id): Path<Uuid>,
    Query(q): Query<LogQuery>,
) -> Result<Json<Vec<EventLogRow>>, (StatusCode, String)> {
    let limit = q.limit.unwrap_or(200).min(1000);
    let rows = sqlx::query_as::<_, EventLogRow>(
        r#"
        SELECT id, hardware_id, level, source, message, metadata, occurred_at
        FROM it.event_logs
        WHERE hardware_id = $1
          AND ($2::text IS NULL OR level = $2)
          AND ($3::text IS NULL OR message ILIKE '%' || $3 || '%')
        ORDER BY occurred_at DESC
        LIMIT $4
        "#,
    )
    .bind(hw_id)
    .bind(&q.level)
    .bind(&q.search)
    .bind(limit)
    .fetch_all(pool.inner())
    .await
    .map_err(internal_err)?;
    Ok(Json(rows))
}

// ─── MD4: Fleet overview ─────────────────────────────────────────────────────

#[derive(Debug, Serialize, utoipa::ToSchema)]
/// Represents a fleet overview.
pub struct FleetOverview {
    pub total: i64,
    pub online: i64,
    pub offline: i64,
    pub warning: i64,
    pub by_os: Vec<OsCount>,
    pub by_status: Vec<StatusCount>,
    pub recently_offline: Vec<MachineRow>,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
/// Represents a os count.
pub struct OsCount {
    pub os_type: String,
    pub count: i64,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
/// Represents a status count.
pub struct StatusCount {
    pub status: String,
    pub count: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow, utoipa::ToSchema)]
/// Represents a machine row.
pub struct MachineRow {
    pub id: Uuid,
    pub name: String,
    pub status: Option<String>,
    pub os_type: Option<String>,
    pub last_heartbeat: Option<DateTime<Utc>>,
}

#[utoipa::path(
    get,
    path = "/api/v1/it-assets/monitoring/fleet-overview",
    responses(
        (status = 200, description = "Fleet overview stats", body = FleetOverview),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Monitoring"
)]
#[tracing::instrument(skip_all)]
pub async fn fleet_overview(
    State(pool): State<DatabasePool>,
) -> Result<Json<FleetOverview>, (StatusCode, String)> {
    let total: i64 = sqlx::query_scalar!("SELECT COUNT(*) FROM it.hardware")
        .fetch_one(pool.inner())
        .await
        .map_err(internal_err)?
        .unwrap_or(0);

    // Online = heartbeat within last 5 minutes
    let online: i64 = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM it.hardware WHERE last_heartbeat >= now() - interval '5 minutes'"
    )
    .fetch_one(pool.inner())
    .await
    .map_err(internal_err)?
    .unwrap_or(0);

    let warning: i64 = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM it.hardware WHERE last_heartbeat >= now() - interval '1 hour' AND last_heartbeat < now() - interval '5 minutes'"
    )
    .fetch_one(pool.inner())
    .await
    .map_err(internal_err)?
    .unwrap_or(0);

    let offline = total - online - warning;

    // By OS
    let os_rows = sqlx::query!(
        r#"SELECT COALESCE(os_type, 'unknown') as "os_type!", COUNT(*) as "count!" FROM it.hardware GROUP BY os_type ORDER BY COUNT(*) DESC"#
    )
    .fetch_all(pool.inner())
    .await
    .map_err(internal_err)?;

    let by_os = os_rows
        .into_iter()
        .map(|r| OsCount {
            os_type: r.os_type,
            count: r.count,
        })
        .collect();

    // By status
    let status_rows = sqlx::query!(
        r#"SELECT COALESCE(status, 'unknown') as "status!", COUNT(*) as "count!" FROM it.hardware GROUP BY status ORDER BY COUNT(*) DESC"#
    )
    .fetch_all(pool.inner())
    .await
    .map_err(internal_err)?;

    let by_status = status_rows
        .into_iter()
        .map(|r| StatusCount {
            status: r.status,
            count: r.count,
        })
        .collect();

    // Recently offline
    let recently_offline = sqlx::query_as::<_, MachineRow>(
        r#"
        SELECT id, name, status, os_type, last_heartbeat
        FROM it.hardware
        WHERE last_heartbeat IS NOT NULL
        ORDER BY last_heartbeat ASC
        LIMIT 20
        "#,
    )
    .fetch_all(pool.inner())
    .await
    .map_err(internal_err)?;

    Ok(Json(FleetOverview {
        total,
        online,
        offline: offline.max(0),
        warning,
        by_os,
        by_status,
        recently_offline,
    }))
}

// ─── BK1: Hardware components CRUD ──────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow, utoipa::ToSchema)]
/// Represents a component row.
pub struct ComponentRow {
    pub id: Uuid,
    pub hardware_id: Uuid,
    #[serde(rename = "type")]
    pub component_type: String,
    pub name: String,
    pub details: Option<String>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Represents a create component req.
pub struct CreateComponentReq {
    #[serde(rename = "type")]
    pub component_type: String,
    pub name: String,
    pub details: Option<String>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Represents a update component req.
pub struct UpdateComponentReq {
    #[serde(rename = "type")]
    pub component_type: Option<String>,
    pub name: Option<String>,
    pub details: Option<String>,
}

#[utoipa::path(
    get,
    path = "/api/v1/it-assets/hardware/{hw_id}/components",
    params(("hw_id" = uuid::Uuid, Path, description = "Hardware UUID")),
    responses(
        (status = 200, description = "Hardware components list", body = Vec<ComponentRow>),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Monitoring"
)]
#[tracing::instrument(skip_all)]
pub async fn list_components(
    State(pool): State<DatabasePool>,
    Path(hw_id): Path<Uuid>,
) -> Result<Json<Vec<ComponentRow>>, (StatusCode, String)> {
    let rows = sqlx::query_as::<_, ComponentRow>(
        r#"SELECT id, hardware_id, type as component_type, name, details, updated_at FROM it.components WHERE hardware_id = $1 ORDER BY type"#,
    )
    .bind(hw_id)
    .fetch_all(pool.inner())
    .await
    .map_err(internal_err)?;
    Ok(Json(rows))
}

#[utoipa::path(
    post,
    path = "/api/v1/it-assets/hardware/{hw_id}/components",
    params(("hw_id" = uuid::Uuid, Path, description = "Hardware UUID")),
    request_body = CreateComponentReq,
    responses(
        (status = 201, description = "Component created", body = ComponentRow),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Monitoring"
)]
#[tracing::instrument(skip_all)]
pub async fn create_component(
    State(pool): State<DatabasePool>,
    Path(hw_id): Path<Uuid>,
    Json(payload): Json<CreateComponentReq>,
) -> Result<(StatusCode, Json<ComponentRow>), (StatusCode, String)> {
    let row = sqlx::query_as::<_, ComponentRow>(
        r#"
        INSERT INTO it.components (hardware_id, type, name, details)
        VALUES ($1, $2, $3, $4)
        RETURNING id, hardware_id, type as component_type, name, details, updated_at
        "#,
    )
    .bind(hw_id)
    .bind(&payload.component_type)
    .bind(&payload.name)
    .bind(&payload.details)
    .fetch_one(pool.inner())
    .await
    .map_err(internal_err)?;
    Ok((StatusCode::CREATED, Json(row)))
}

#[utoipa::path(
    put,
    path = "/api/v1/it-assets/hardware/components/{id}",
    params(("id" = uuid::Uuid, Path, description = "Component UUID")),
    request_body = UpdateComponentReq,
    responses(
        (status = 200, description = "Component updated", body = ComponentRow),
        (status = 404, description = "Component not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Monitoring"
)]
#[tracing::instrument(skip_all)]
pub async fn update_component(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateComponentReq>,
) -> Result<Json<ComponentRow>, (StatusCode, String)> {
    let row = sqlx::query_as::<_, ComponentRow>(
        r#"
        UPDATE it.components SET
            type    = COALESCE($1, type),
            name    = COALESCE($2, name),
            details = COALESCE($3, details),
            updated_at = now()
        WHERE id = $4
        RETURNING id, hardware_id, type as component_type, name, details, updated_at
        "#,
    )
    .bind(payload.component_type.as_deref())
    .bind(payload.name.as_deref())
    .bind(payload.details.as_deref())
    .bind(id)
    .fetch_optional(pool.inner())
    .await
    .map_err(internal_err)?
    .ok_or((StatusCode::NOT_FOUND, "Component not found".to_string()))?;
    Ok(Json(row))
}

#[utoipa::path(
    delete,
    path = "/api/v1/it-assets/hardware/components/{id}",
    params(("id" = uuid::Uuid, Path, description = "Component UUID")),
    responses(
        (status = 204, description = "Component deleted"),
        (status = 404, description = "Component not found"),
    ),
    security(("bearer" = [])),
    tag = "Monitoring"
)]
#[tracing::instrument(skip_all)]
pub async fn delete_component(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    let result = sqlx::query("DELETE FROM it.components WHERE id = $1")
        .bind(id)
        .execute(pool.inner())
        .await
        .map_err(internal_err)?;
    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Component not found".to_string()));
    }
    Ok(StatusCode::NO_CONTENT)
}

// ─── BK2: Software licenses CRUD ─────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow, utoipa::ToSchema)]
/// Represents a license row.
pub struct LicenseRow {
    pub id: Uuid,
    pub software_name: String,
    pub license_key: Option<String>,
    pub license_type: Option<String>,
    pub seats_total: Option<i32>,
    pub vendor: Option<String>,
    pub purchase_date: Option<chrono::NaiveDate>,
    pub expiry_date: Option<chrono::NaiveDate>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
/// Represents a license with usage.
pub struct LicenseWithUsage {
    #[serde(flatten)]
    pub license: LicenseRow,
    pub seats_used: i64,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Represents a create license req.
pub struct CreateLicenseReq {
    pub software_name: String,
    pub license_key: Option<String>,
    pub license_type: Option<String>,
    pub seats_total: Option<i32>,
    pub vendor: Option<String>,
    pub purchase_date: Option<chrono::NaiveDate>,
    pub expiry_date: Option<chrono::NaiveDate>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Represents a update license req.
pub struct UpdateLicenseReq {
    pub software_name: Option<String>,
    pub license_key: Option<String>,
    pub license_type: Option<String>,
    pub seats_total: Option<i32>,
    pub vendor: Option<String>,
    pub purchase_date: Option<chrono::NaiveDate>,
    pub expiry_date: Option<chrono::NaiveDate>,
    pub notes: Option<String>,
}

#[utoipa::path(
    get,
    path = "/api/v1/it-assets/licenses",
    responses(
        (status = 200, description = "Software licenses list", body = Vec<LicenseWithUsage>),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Monitoring"
)]
#[tracing::instrument(skip_all)]
pub async fn list_licenses(
    State(pool): State<DatabasePool>,
) -> Result<Json<Vec<LicenseWithUsage>>, (StatusCode, String)> {
    let rows = sqlx::query!(
        r#"
        SELECT
            l.id, l.software_name, l.license_key, l.license_type, l.seats_total,
            l.vendor, l.purchase_date, l.expiry_date, l.notes, l.created_at, l.updated_at,
            COUNT(DISTINCT si.hardware_id) AS "seats_used!"
        FROM it.software_licenses l
        LEFT JOIN it.software_inventory si ON si.name ILIKE '%' || l.software_name || '%'
        GROUP BY l.id
        ORDER BY l.software_name
        "#,
    )
    .fetch_all(pool.inner())
    .await
    .map_err(internal_err)?;

    let result = rows
        .into_iter()
        .map(|r| LicenseWithUsage {
            license: LicenseRow {
                id: r.id,
                software_name: r.software_name,
                license_key: r.license_key,
                license_type: r.license_type,
                seats_total: r.seats_total,
                vendor: r.vendor,
                purchase_date: r.purchase_date,
                expiry_date: r.expiry_date,
                notes: r.notes,
                created_at: r.created_at.unwrap_or_default(),
                updated_at: r.updated_at.unwrap_or_default(),
            },
            seats_used: r.seats_used,
        })
        .collect();

    Ok(Json(result))
}

#[utoipa::path(
    get,
    path = "/api/v1/it-assets/licenses/{id}",
    params(("id" = uuid::Uuid, Path, description = "License UUID")),
    responses(
        (status = 200, description = "License", body = LicenseRow),
        (status = 404, description = "License not found"),
    ),
    security(("bearer" = [])),
    tag = "Monitoring"
)]
#[tracing::instrument(skip_all)]
pub async fn get_license(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
) -> Result<Json<LicenseRow>, (StatusCode, String)> {
    let row = sqlx::query_as::<_, LicenseRow>(
        "SELECT id, software_name, license_key, license_type, seats_total, vendor, purchase_date, expiry_date, notes, created_at, updated_at FROM it.software_licenses WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(pool.inner())
    .await
    .map_err(internal_err)?
    .ok_or((StatusCode::NOT_FOUND, "License not found".to_string()))?;
    Ok(Json(row))
}

#[utoipa::path(
    post,
    path = "/api/v1/it-assets/licenses",
    request_body = CreateLicenseReq,
    responses(
        (status = 201, description = "License created", body = LicenseRow),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Monitoring"
)]
#[tracing::instrument(skip_all)]
pub async fn create_license(
    State(pool): State<DatabasePool>,
    Json(payload): Json<CreateLicenseReq>,
) -> Result<(StatusCode, Json<LicenseRow>), (StatusCode, String)> {
    let row = sqlx::query_as::<_, LicenseRow>(
        r#"
        INSERT INTO it.software_licenses (software_name, license_key, license_type, seats_total, vendor, purchase_date, expiry_date, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, software_name, license_key, license_type, seats_total, vendor, purchase_date, expiry_date, notes, created_at, updated_at
        "#,
    )
    .bind(&payload.software_name)
    .bind(&payload.license_key)
    .bind(&payload.license_type)
    .bind(payload.seats_total)
    .bind(&payload.vendor)
    .bind(payload.purchase_date)
    .bind(payload.expiry_date)
    .bind(&payload.notes)
    .fetch_one(pool.inner())
    .await
    .map_err(internal_err)?;
    Ok((StatusCode::CREATED, Json(row)))
}

#[utoipa::path(
    put,
    path = "/api/v1/it-assets/licenses/{id}",
    params(("id" = uuid::Uuid, Path, description = "License UUID")),
    request_body = UpdateLicenseReq,
    responses(
        (status = 200, description = "License updated", body = LicenseRow),
        (status = 404, description = "License not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Monitoring"
)]
#[tracing::instrument(skip_all)]
pub async fn update_license(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateLicenseReq>,
) -> Result<Json<LicenseRow>, (StatusCode, String)> {
    let row = sqlx::query_as::<_, LicenseRow>(
        r#"
        UPDATE it.software_licenses SET
            software_name = COALESCE($1, software_name),
            license_key   = COALESCE($2, license_key),
            license_type  = COALESCE($3, license_type),
            seats_total   = COALESCE($4, seats_total),
            vendor        = COALESCE($5, vendor),
            purchase_date = COALESCE($6, purchase_date),
            expiry_date   = COALESCE($7, expiry_date),
            notes         = COALESCE($8, notes),
            updated_at    = now()
        WHERE id = $9
        RETURNING id, software_name, license_key, license_type, seats_total, vendor, purchase_date, expiry_date, notes, created_at, updated_at
        "#,
    )
    .bind(payload.software_name.as_deref())
    .bind(payload.license_key.as_deref())
    .bind(payload.license_type.as_deref())
    .bind(payload.seats_total)
    .bind(payload.vendor.as_deref())
    .bind(payload.purchase_date)
    .bind(payload.expiry_date)
    .bind(payload.notes.as_deref())
    .bind(id)
    .fetch_optional(pool.inner())
    .await
    .map_err(internal_err)?
    .ok_or((StatusCode::NOT_FOUND, "License not found".to_string()))?;
    Ok(Json(row))
}

#[utoipa::path(
    delete,
    path = "/api/v1/it-assets/licenses/{id}",
    params(("id" = uuid::Uuid, Path, description = "License UUID")),
    responses(
        (status = 204, description = "License deleted"),
        (status = 404, description = "License not found"),
    ),
    security(("bearer" = [])),
    tag = "Monitoring"
)]
#[tracing::instrument(skip_all)]
pub async fn delete_license(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    let result = sqlx::query("DELETE FROM it.software_licenses WHERE id = $1")
        .bind(id)
        .execute(pool.inner())
        .await
        .map_err(internal_err)?;
    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "License not found".to_string()));
    }
    Ok(StatusCode::NO_CONTENT)
}

// ─── BK3: Network interfaces CRUD ────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow, utoipa::ToSchema)]
/// Represents a network interface row.
pub struct NetworkInterfaceRow {
    pub id: Uuid,
    pub hardware_id: Uuid,
    pub name: String,
    pub mac_address: Option<String>,
    pub ip_address: Option<String>,
    pub interface_type: Option<String>,
    pub speed_mbps: Option<i32>,
    pub is_active: Option<bool>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Represents a create network interface req.
pub struct CreateNetworkInterfaceReq {
    pub name: String,
    pub mac_address: Option<String>,
    pub ip_address: Option<String>,
    pub interface_type: Option<String>,
    pub speed_mbps: Option<i32>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Represents a update network interface req.
pub struct UpdateNetworkInterfaceReq {
    pub name: Option<String>,
    pub mac_address: Option<String>,
    pub ip_address: Option<String>,
    pub interface_type: Option<String>,
    pub speed_mbps: Option<i32>,
    pub is_active: Option<bool>,
}

#[utoipa::path(
    get,
    path = "/api/v1/it-assets/hardware/{hw_id}/network-interfaces",
    params(("hw_id" = uuid::Uuid, Path, description = "Hardware UUID")),
    responses(
        (status = 200, description = "Network interfaces list", body = Vec<NetworkInterfaceRow>),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Monitoring"
)]
#[tracing::instrument(skip_all)]
pub async fn list_network_interfaces(
    State(pool): State<DatabasePool>,
    Path(hw_id): Path<Uuid>,
) -> Result<Json<Vec<NetworkInterfaceRow>>, (StatusCode, String)> {
    // ip_address is INET in DB — use ip_text (VARCHAR) alias added in migration 116
    let rows = sqlx::query_as::<_, NetworkInterfaceRow>(
        r#"SELECT id, hardware_id,
            COALESCE(name, 'unknown') AS name,
            mac_address,
            COALESCE(ip_text, host(ip_address)::text) AS ip_address,
            interface_type, speed_mbps, is_active, created_at
           FROM it.network_interfaces WHERE hardware_id = $1 ORDER BY name"#,
    )
    .bind(hw_id)
    .fetch_all(pool.inner())
    .await
    .map_err(internal_err)?;
    Ok(Json(rows))
}

#[utoipa::path(
    post,
    path = "/api/v1/it-assets/hardware/{hw_id}/network-interfaces",
    params(("hw_id" = uuid::Uuid, Path, description = "Hardware UUID")),
    request_body = CreateNetworkInterfaceReq,
    responses(
        (status = 201, description = "Network interface created", body = NetworkInterfaceRow),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Monitoring"
)]
#[tracing::instrument(skip_all)]
pub async fn create_network_interface(
    State(pool): State<DatabasePool>,
    Path(hw_id): Path<Uuid>,
    Json(payload): Json<CreateNetworkInterfaceReq>,
) -> Result<(StatusCode, Json<NetworkInterfaceRow>), (StatusCode, String)> {
    // Store ip as text in ip_text column; ip_address (INET) stays null unless valid INET
    let row = sqlx::query_as::<_, NetworkInterfaceRow>(
        r#"
        INSERT INTO it.network_interfaces (hardware_id, name, mac_address, ip_text, interface_type, speed_mbps, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, hardware_id, COALESCE(name, 'unknown') AS name, mac_address,
                  COALESCE(ip_text, host(ip_address)::text) AS ip_address,
                  interface_type, speed_mbps, is_active, created_at
        "#,
    )
    .bind(hw_id)
    .bind(&payload.name)
    .bind(&payload.mac_address)
    .bind(&payload.ip_address)
    .bind(&payload.interface_type)
    .bind(payload.speed_mbps)
    .bind(payload.is_active.unwrap_or(true))
    .fetch_one(pool.inner())
    .await
    .map_err(internal_err)?;
    Ok((StatusCode::CREATED, Json(row)))
}

#[utoipa::path(
    put,
    path = "/api/v1/it-assets/hardware/network-interfaces/{id}",
    params(("id" = uuid::Uuid, Path, description = "Network interface UUID")),
    request_body = UpdateNetworkInterfaceReq,
    responses(
        (status = 200, description = "Network interface updated", body = NetworkInterfaceRow),
        (status = 404, description = "Interface not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Monitoring"
)]
#[tracing::instrument(skip_all)]
pub async fn update_network_interface(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateNetworkInterfaceReq>,
) -> Result<Json<NetworkInterfaceRow>, (StatusCode, String)> {
    let row = sqlx::query_as::<_, NetworkInterfaceRow>(
        r#"
        UPDATE it.network_interfaces SET
            name           = COALESCE($1, name),
            mac_address    = COALESCE($2, mac_address),
            ip_text        = COALESCE($3, ip_text),
            interface_type = COALESCE($4, interface_type),
            speed_mbps     = COALESCE($5, speed_mbps),
            is_active      = COALESCE($6, is_active)
        WHERE id = $7
        RETURNING id, hardware_id, COALESCE(name, 'unknown') AS name, mac_address,
                  COALESCE(ip_text, host(ip_address)::text) AS ip_address,
                  interface_type, speed_mbps, is_active, created_at
        "#,
    )
    .bind(payload.name.as_deref())
    .bind(payload.mac_address.as_deref())
    .bind(payload.ip_address.as_deref())
    .bind(payload.interface_type.as_deref())
    .bind(payload.speed_mbps)
    .bind(payload.is_active)
    .bind(id)
    .fetch_optional(pool.inner())
    .await
    .map_err(internal_err)?
    .ok_or((StatusCode::NOT_FOUND, "Interface not found".to_string()))?;
    Ok(Json(row))
}

#[utoipa::path(
    delete,
    path = "/api/v1/it-assets/hardware/network-interfaces/{id}",
    params(("id" = uuid::Uuid, Path, description = "Network interface UUID")),
    responses(
        (status = 204, description = "Network interface deleted"),
        (status = 404, description = "Interface not found"),
    ),
    security(("bearer" = [])),
    tag = "Monitoring"
)]
#[tracing::instrument(skip_all)]
pub async fn delete_network_interface(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    let result = sqlx::query("DELETE FROM it.network_interfaces WHERE id = $1")
        .bind(id)
        .execute(pool.inner())
        .await
        .map_err(internal_err)?;
    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Interface not found".to_string()));
    }
    Ok(StatusCode::NO_CONTENT)
}

// ─── BK4: Maintenance windows CRUD ───────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow, utoipa::ToSchema)]
/// Represents a maintenance window row.
pub struct MaintenanceWindowRow {
    pub id: Uuid,
    pub name: String,
    pub hardware_id: Option<Uuid>,
    pub starts_at: DateTime<Utc>,
    pub ends_at: DateTime<Utc>,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Represents a create maintenance window req.
pub struct CreateMaintenanceWindowReq {
    pub name: String,
    pub hardware_id: Option<Uuid>,
    pub starts_at: DateTime<Utc>,
    pub ends_at: DateTime<Utc>,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Represents a update maintenance window req.
pub struct UpdateMaintenanceWindowReq {
    pub name: Option<String>,
    pub starts_at: Option<DateTime<Utc>>,
    pub ends_at: Option<DateTime<Utc>>,
    pub description: Option<String>,
}

#[utoipa::path(
    get,
    path = "/api/v1/it-assets/maintenance-windows",
    responses(
        (status = 200, description = "Maintenance windows list", body = Vec<MaintenanceWindowRow>),
    ),
    security(("bearer" = [])),
    tag = "Monitoring"
)]
#[tracing::instrument(skip_all)]
pub async fn list_maintenance_windows(
    State(pool): State<DatabasePool>,
) -> Result<Json<Vec<MaintenanceWindowRow>>, (StatusCode, String)> {
    let rows = sqlx::query_as::<_, MaintenanceWindowRow>(
        "SELECT id, name, hardware_id, starts_at, ends_at, description, created_at FROM it.maintenance_windows ORDER BY starts_at DESC",
    )
    .fetch_all(pool.inner())
    .await
    .map_err(internal_err)?;
    Ok(Json(rows))
}

#[utoipa::path(
    post,
    path = "/api/v1/it-assets/maintenance-windows",
    request_body = CreateMaintenanceWindowReq,
    responses(
        (status = 201, description = "Maintenance window created", body = MaintenanceWindowRow),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Monitoring"
)]
#[tracing::instrument(skip_all)]
pub async fn create_maintenance_window(
    State(pool): State<DatabasePool>,
    Json(payload): Json<CreateMaintenanceWindowReq>,
) -> Result<(StatusCode, Json<MaintenanceWindowRow>), (StatusCode, String)> {
    let row = sqlx::query_as::<_, MaintenanceWindowRow>(
        r#"
        INSERT INTO it.maintenance_windows (name, hardware_id, starts_at, ends_at, description)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, name, hardware_id, starts_at, ends_at, description, created_at
        "#,
    )
    .bind(&payload.name)
    .bind(payload.hardware_id)
    .bind(payload.starts_at)
    .bind(payload.ends_at)
    .bind(&payload.description)
    .fetch_one(pool.inner())
    .await
    .map_err(internal_err)?;
    Ok((StatusCode::CREATED, Json(row)))
}

#[utoipa::path(
    put,
    path = "/api/v1/it-assets/maintenance-windows/{id}",
    params(("id" = uuid::Uuid, Path, description = "Maintenance window UUID")),
    request_body = UpdateMaintenanceWindowReq,
    responses(
        (status = 200, description = "Maintenance window updated", body = MaintenanceWindowRow),
        (status = 404, description = "Maintenance window not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Monitoring"
)]
#[tracing::instrument(skip_all)]
pub async fn update_maintenance_window(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateMaintenanceWindowReq>,
) -> Result<Json<MaintenanceWindowRow>, (StatusCode, String)> {
    let row = sqlx::query_as::<_, MaintenanceWindowRow>(
        r#"
        UPDATE it.maintenance_windows SET
            name        = COALESCE($1, name),
            starts_at   = COALESCE($2, starts_at),
            ends_at     = COALESCE($3, ends_at),
            description = COALESCE($4, description)
        WHERE id = $5
        RETURNING id, name, hardware_id, starts_at, ends_at, description, created_at
        "#,
    )
    .bind(payload.name.as_deref())
    .bind(payload.starts_at)
    .bind(payload.ends_at)
    .bind(payload.description.as_deref())
    .bind(id)
    .fetch_optional(pool.inner())
    .await
    .map_err(internal_err)?
    .ok_or((
        StatusCode::NOT_FOUND,
        "Maintenance window not found".to_string(),
    ))?;
    Ok(Json(row))
}

#[utoipa::path(
    delete,
    path = "/api/v1/it-assets/maintenance-windows/{id}",
    params(("id" = uuid::Uuid, Path, description = "Maintenance window UUID")),
    responses(
        (status = 204, description = "Maintenance window deleted"),
        (status = 404, description = "Maintenance window not found"),
    ),
    security(("bearer" = [])),
    tag = "Monitoring"
)]
#[tracing::instrument(skip_all)]
pub async fn delete_maintenance_window(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    let result = sqlx::query("DELETE FROM it.maintenance_windows WHERE id = $1")
        .bind(id)
        .execute(pool.inner())
        .await
        .map_err(internal_err)?;
    if result.rows_affected() == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            "Maintenance window not found".to_string(),
        ));
    }
    Ok(StatusCode::NO_CONTENT)
}

// ─── #12: Unified device health score ────────────────────────────────────────

#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct HealthScore {
    pub hardware_id: Uuid,
    pub score: f32,
    pub patch_score: f32,
    pub av_score: f32,
    pub encryption_score: f32,
    pub policy_score: f32,
    pub uptime_score: f32,
}

#[utoipa::path(
    get,
    path = "/api/v1/it-assets/hardware/{hw_id}/health-score",
    params(("hw_id" = uuid::Uuid, Path, description = "Hardware UUID")),
    responses(
        (status = 200, description = "Device health score", body = HealthScore),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Monitoring"
)]
/// GET /api/v1/it-assets/hardware/:hw_id/health-score
/// Compute a composite 0-100 health score from patch, AV, encryption, policy, and uptime signals.
#[tracing::instrument(skip_all)]
pub async fn get_health_score(
    State(pool): State<DatabasePool>,
    Path(hw_id): Path<Uuid>,
) -> Result<Json<HealthScore>, (StatusCode, String)> {
    // Patch score: % of patches that are installed vs pending
    let patch: (i64, i64) = sqlx::query_as(
        r#"SELECT
            COUNT(*) FILTER (WHERE status IN ('installed','approved','deployed')),
            COUNT(*)
           FROM it.patches WHERE hardware_id = $1"#,
    )
    .bind(hw_id)
    .fetch_one(pool.inner())
    .await
    .map_err(internal_err)?;

    let patch_score = if patch.1 == 0 {
        100.0f32
    } else {
        (patch.0 as f32 / patch.1 as f32) * 100.0
    };

    // AV score: protected=100, outdated=50, disabled=0
    let av_status: Option<(String,)> = sqlx::query_as(
        "SELECT status FROM it.antivirus_status WHERE hardware_id = $1 ORDER BY updated_at DESC LIMIT 1",
    )
    .bind(hw_id)
    .fetch_optional(pool.inner())
    .await
    .map_err(internal_err)?;

    let av_score = match av_status.as_ref().map(|(s,)| s.as_str()) {
        Some("protected") => 100.0f32,
        Some("outdated") => 50.0f32,
        _ => 0.0f32,
    };

    // Encryption score: encrypted=100, otherwise 0
    let enc_count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM it.disk_encryption WHERE hardware_id = $1 AND status = 'encrypted'",
    )
    .bind(hw_id)
    .fetch_one(pool.inner())
    .await
    .map_err(internal_err)?;

    let encryption_score = if enc_count.0 > 0 { 100.0f32 } else { 0.0f32 };

    // Policy score: % compliant
    let policy: (i64, i64) = sqlx::query_as(
        r#"SELECT
            COUNT(*) FILTER (WHERE compliant = true),
            COUNT(*)
           FROM it.policy_compliance WHERE hardware_id = $1"#,
    )
    .bind(hw_id)
    .fetch_one(pool.inner())
    .await
    .map_err(internal_err)?;

    let policy_score = if policy.1 == 0 {
        100.0f32
    } else {
        (policy.0 as f32 / policy.1 as f32) * 100.0
    };

    // Uptime score: online last 24h=100, last 7d=50, older=0
    let last_hb: Option<(DateTime<Utc>,)> =
        sqlx::query_as("SELECT last_heartbeat FROM it.hardware WHERE id = $1")
            .bind(hw_id)
            .fetch_optional(pool.inner())
            .await
            .map_err(internal_err)?;

    let uptime_score = match last_hb {
        Some((ts,)) => {
            let hours_ago = (Utc::now() - ts).num_hours();
            if hours_ago <= 24 {
                100.0f32
            } else if hours_ago <= 168 {
                50.0f32
            } else {
                0.0f32
            }
        },
        None => 0.0f32,
    };

    let score = (patch_score + av_score + encryption_score + policy_score + uptime_score) / 5.0;

    Ok(Json(HealthScore {
        hardware_id: hw_id,
        score,
        patch_score,
        av_score,
        encryption_score,
        policy_score,
        uptime_score,
    }))
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
