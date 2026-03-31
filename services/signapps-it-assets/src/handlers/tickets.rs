// PSA/Ticketing system — ConnectWise/Autotask style (idea #51)
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

// ─── Types ────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Ticket {
    pub id: Uuid,
    pub number: i32,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub priority: String,
    pub category: Option<String>,
    pub hardware_id: Option<Uuid>,
    pub requester_id: Option<Uuid>,
    pub requester_name: Option<String>,
    pub requester_email: Option<String>,
    pub assigned_to: Option<Uuid>,
    pub assigned_group: Option<Uuid>,
    pub sla_response_due: Option<DateTime<Utc>>,
    pub sla_resolution_due: Option<DateTime<Utc>>,
    pub first_response_at: Option<DateTime<Utc>>,
    pub resolved_at: Option<DateTime<Utc>>,
    pub closed_at: Option<DateTime<Utc>>,
    pub tags: Vec<String>,
    pub metadata: Option<Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TicketComment {
    pub id: Uuid,
    pub ticket_id: Uuid,
    pub author_id: Option<Uuid>,
    pub author_name: Option<String>,
    pub content: String,
    pub is_internal: Option<bool>,
    pub attachments: Option<Value>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TicketTimeEntry {
    pub id: Uuid,
    pub ticket_id: Uuid,
    pub user_id: Option<Uuid>,
    pub duration_minutes: i32,
    pub description: Option<String>,
    pub billable: Option<bool>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct TicketDetail {
    pub ticket: Ticket,
    pub comments: Vec<TicketComment>,
    pub time_entries: Vec<TicketTimeEntry>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTicketReq {
    pub title: String,
    pub description: Option<String>,
    pub priority: Option<String>,
    pub category: Option<String>,
    pub hardware_id: Option<Uuid>,
    pub requester_id: Option<Uuid>,
    pub requester_name: Option<String>,
    pub requester_email: Option<String>,
    pub assigned_to: Option<Uuid>,
    pub assigned_group: Option<Uuid>,
    pub tags: Option<Vec<String>>,
    pub metadata: Option<Value>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTicketReq {
    pub title: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub category: Option<String>,
    pub assigned_to: Option<Uuid>,
    pub assigned_group: Option<Uuid>,
    pub tags: Option<Vec<String>>,
    pub metadata: Option<Value>,
}

#[derive(Debug, Deserialize)]
pub struct TicketListQuery {
    pub status: Option<String>,
    pub priority: Option<String>,
    pub assigned_to: Option<Uuid>,
    pub hardware_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct AddCommentReq {
    pub content: String,
    pub author_id: Option<Uuid>,
    pub author_name: Option<String>,
    pub is_internal: Option<bool>,
    pub attachments: Option<Value>,
}

#[derive(Debug, Deserialize)]
pub struct AddTimeEntryReq {
    pub duration_minutes: i32,
    pub description: Option<String>,
    pub user_id: Option<Uuid>,
    pub billable: Option<bool>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
struct SlaPolicy {
    response_hours: i32,
    resolution_hours: i32,
}

// ─── Stats types ─────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct TicketStats {
    pub total_open: i64,
    pub by_priority: Vec<PriorityCount>,
    pub avg_resolution_minutes: Option<f64>,
    pub sla_compliance_pct: f64,
    pub overdue_count: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PriorityCount {
    pub priority: String,
    pub count: i64,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

fn valid_status(s: &str) -> bool {
    matches!(
        s,
        "open" | "in_progress" | "waiting" | "resolved" | "closed"
    )
}

fn valid_priority(p: &str) -> bool {
    matches!(p, "critical" | "high" | "medium" | "low")
}

// ─── POST /tickets — create ticket ────────────────────────────────────────────

#[tracing::instrument(skip_all)]
pub async fn create_ticket(
    State(pool): State<DatabasePool>,
    Json(payload): Json<CreateTicketReq>,
) -> Result<(StatusCode, Json<Ticket>), (StatusCode, String)> {
    if payload.title.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Title cannot be empty".to_string()));
    }

    let priority = payload.priority.as_deref().unwrap_or("medium");
    if !valid_priority(priority) {
        return Err((
            StatusCode::BAD_REQUEST,
            format!("Invalid priority: {}", priority),
        ));
    }

    // Look up SLA policy for this priority
    let sla: Option<SlaPolicy> = sqlx::query_as::<_, SlaPolicy>(
        "SELECT response_hours, resolution_hours FROM it.sla_policies WHERE priority = $1 LIMIT 1",
    )
    .bind(priority)
    .fetch_optional(pool.inner())
    .await
    .map_err(internal_err)?;

    let now = Utc::now();
    let (sla_response_due, sla_resolution_due) = if let Some(s) = &sla {
        let resp = now + chrono::Duration::hours(s.response_hours as i64);
        let res = now + chrono::Duration::hours(s.resolution_hours as i64);
        (Some(resp), Some(res))
    } else {
        (None, None)
    };

    let tags = payload.tags.unwrap_or_default();

    let ticket = sqlx::query_as::<_, Ticket>(
        r#"
        INSERT INTO it.tickets
            (title, description, priority, category, hardware_id, requester_id,
             requester_name, requester_email, assigned_to, assigned_group,
             sla_response_due, sla_resolution_due, tags, metadata)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        RETURNING id, number, title, description, status, priority, category,
                  hardware_id, requester_id, requester_name, requester_email,
                  assigned_to, assigned_group, sla_response_due, sla_resolution_due,
                  first_response_at, resolved_at, closed_at, tags, metadata,
                  created_at, updated_at
        "#,
    )
    .bind(&payload.title)
    .bind(&payload.description)
    .bind(priority)
    .bind(&payload.category)
    .bind(payload.hardware_id)
    .bind(payload.requester_id)
    .bind(&payload.requester_name)
    .bind(&payload.requester_email)
    .bind(payload.assigned_to)
    .bind(payload.assigned_group)
    .bind(sla_response_due)
    .bind(sla_resolution_due)
    .bind(&tags)
    .bind(&payload.metadata)
    .fetch_one(pool.inner())
    .await
    .map_err(internal_err)?;

    Ok((StatusCode::CREATED, Json(ticket)))
}

// ─── GET /tickets — list with filters ─────────────────────────────────────────

#[tracing::instrument(skip_all)]
pub async fn list_tickets(
    State(pool): State<DatabasePool>,
    Query(q): Query<TicketListQuery>,
) -> Result<Json<Vec<Ticket>>, (StatusCode, String)> {
    // Build dynamic query with optional filters
    let mut conditions = vec!["1=1".to_string()];
    if let Some(ref s) = q.status {
        conditions.push(format!("status = '{}'", s.replace('\'', "")));
    }
    if let Some(ref p) = q.priority {
        conditions.push(format!("priority = '{}'", p.replace('\'', "")));
    }
    if let Some(at) = q.assigned_to {
        conditions.push(format!("assigned_to = '{}'", at));
    }
    if let Some(hw) = q.hardware_id {
        conditions.push(format!("hardware_id = '{}'", hw));
    }

    let where_clause = conditions.join(" AND ");
    let sql = format!(
        r#"SELECT id, number, title, description, status, priority, category,
                  hardware_id, requester_id, requester_name, requester_email,
                  assigned_to, assigned_group, sla_response_due, sla_resolution_due,
                  first_response_at, resolved_at, closed_at, tags, metadata,
                  created_at, updated_at
           FROM it.tickets WHERE {} ORDER BY created_at DESC"#,
        where_clause
    );

    let tickets = sqlx::query_as::<_, Ticket>(&sql)
        .fetch_all(pool.inner())
        .await
        .map_err(internal_err)?;

    Ok(Json(tickets))
}

// ─── GET /tickets/stats — dashboard stats ─────────────────────────────────────

#[tracing::instrument(skip_all)]
pub async fn ticket_stats(
    State(pool): State<DatabasePool>,
) -> Result<Json<TicketStats>, (StatusCode, String)> {
    let total_open: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM it.tickets WHERE status NOT IN ('resolved','closed')")
            .fetch_one(pool.inner())
            .await
            .map_err(internal_err)?;

    let by_priority = sqlx::query_as::<_, PriorityCount>(
        r#"SELECT priority, COUNT(*) as count FROM it.tickets
           WHERE status NOT IN ('resolved','closed')
           GROUP BY priority ORDER BY priority"#,
    )
    .fetch_all(pool.inner())
    .await
    .map_err(internal_err)?;

    let avg_res: (Option<f64>,) = sqlx::query_as(
        r#"SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/60)
           FROM it.tickets WHERE resolved_at IS NOT NULL"#,
    )
    .fetch_one(pool.inner())
    .await
    .map_err(internal_err)?;

    // SLA compliance: % of resolved tickets that were resolved before SLA due
    let sla_total: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM it.tickets WHERE resolved_at IS NOT NULL AND sla_resolution_due IS NOT NULL",
    )
    .fetch_one(pool.inner())
    .await
    .map_err(internal_err)?;

    let sla_met: (i64,) = sqlx::query_as(
        r#"SELECT COUNT(*) FROM it.tickets
           WHERE resolved_at IS NOT NULL AND sla_resolution_due IS NOT NULL
             AND resolved_at <= sla_resolution_due"#,
    )
    .fetch_one(pool.inner())
    .await
    .map_err(internal_err)?;

    let sla_compliance_pct = if sla_total.0 > 0 {
        (sla_met.0 as f64 / sla_total.0 as f64) * 100.0
    } else {
        100.0
    };

    let overdue: (i64,) = sqlx::query_as(
        r#"SELECT COUNT(*) FROM it.tickets
           WHERE status NOT IN ('resolved','closed')
             AND sla_resolution_due IS NOT NULL
             AND sla_resolution_due < now()"#,
    )
    .fetch_one(pool.inner())
    .await
    .map_err(internal_err)?;

    Ok(Json(TicketStats {
        total_open: total_open.0,
        by_priority,
        avg_resolution_minutes: avg_res.0,
        sla_compliance_pct,
        overdue_count: overdue.0,
    }))
}

// ─── GET /tickets/:id — get with comments + time entries ─────────────────────

#[tracing::instrument(skip_all)]
pub async fn get_ticket(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
) -> Result<Json<TicketDetail>, (StatusCode, String)> {
    let ticket = sqlx::query_as::<_, Ticket>(
        r#"SELECT id, number, title, description, status, priority, category,
                  hardware_id, requester_id, requester_name, requester_email,
                  assigned_to, assigned_group, sla_response_due, sla_resolution_due,
                  first_response_at, resolved_at, closed_at, tags, metadata,
                  created_at, updated_at
           FROM it.tickets WHERE id = $1"#,
    )
    .bind(id)
    .fetch_optional(pool.inner())
    .await
    .map_err(internal_err)?
    .ok_or((StatusCode::NOT_FOUND, "Ticket not found".to_string()))?;

    let comments = sqlx::query_as::<_, TicketComment>(
        r#"SELECT id, ticket_id, author_id, author_name, content, is_internal, attachments, created_at
           FROM it.ticket_comments WHERE ticket_id = $1 ORDER BY created_at ASC"#,
    )
    .bind(id)
    .fetch_all(pool.inner())
    .await
    .map_err(internal_err)?;

    let time_entries = sqlx::query_as::<_, TicketTimeEntry>(
        r#"SELECT id, ticket_id, user_id, duration_minutes, description, billable, created_at
           FROM it.ticket_time_entries WHERE ticket_id = $1 ORDER BY created_at ASC"#,
    )
    .bind(id)
    .fetch_all(pool.inner())
    .await
    .map_err(internal_err)?;

    Ok(Json(TicketDetail {
        ticket,
        comments,
        time_entries,
    }))
}

// ─── PATCH /tickets/:id — update ──────────────────────────────────────────────

#[tracing::instrument(skip_all)]
pub async fn update_ticket(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateTicketReq>,
) -> Result<Json<Ticket>, (StatusCode, String)> {
    if let Some(ref s) = payload.status {
        if !valid_status(s) {
            return Err((StatusCode::BAD_REQUEST, format!("Invalid status: {}", s)));
        }
    }
    if let Some(ref p) = payload.priority {
        if !valid_priority(p) {
            return Err((StatusCode::BAD_REQUEST, format!("Invalid priority: {}", p)));
        }
    }

    // Determine resolved_at / closed_at based on status transition
    let status_clause = match payload.status.as_deref() {
        Some("resolved") => ", resolved_at = COALESCE(resolved_at, now())",
        Some("closed") => ", closed_at = COALESCE(closed_at, now())",
        _ => "",
    };

    let sql = format!(
        r#"UPDATE it.tickets SET
            title = COALESCE($2, title),
            description = COALESCE($3, description),
            status = COALESCE($4, status),
            priority = COALESCE($5, priority),
            category = COALESCE($6, category),
            assigned_to = COALESCE($7, assigned_to),
            assigned_group = COALESCE($8, assigned_group),
            tags = COALESCE($9, tags),
            metadata = COALESCE($10, metadata),
            updated_at = now()
            {}
           WHERE id = $1
           RETURNING id, number, title, description, status, priority, category,
                     hardware_id, requester_id, requester_name, requester_email,
                     assigned_to, assigned_group, sla_response_due, sla_resolution_due,
                     first_response_at, resolved_at, closed_at, tags, metadata,
                     created_at, updated_at"#,
        status_clause
    );

    let ticket = sqlx::query_as::<_, Ticket>(&sql)
        .bind(id)
        .bind(&payload.title)
        .bind(&payload.description)
        .bind(&payload.status)
        .bind(&payload.priority)
        .bind(&payload.category)
        .bind(payload.assigned_to)
        .bind(payload.assigned_group)
        .bind(payload.tags.as_deref())
        .bind(&payload.metadata)
        .fetch_optional(pool.inner())
        .await
        .map_err(internal_err)?
        .ok_or((StatusCode::NOT_FOUND, "Ticket not found".to_string()))?;

    Ok(Json(ticket))
}

// ─── POST /tickets/:id/comments — add comment ─────────────────────────────────

#[tracing::instrument(skip_all)]
pub async fn add_comment(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
    Json(payload): Json<AddCommentReq>,
) -> Result<(StatusCode, Json<TicketComment>), (StatusCode, String)> {
    if payload.content.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "Comment content cannot be empty".to_string(),
        ));
    }

    // Set first_response_at on ticket if this is the first non-internal comment
    if !payload.is_internal.unwrap_or(false) {
        sqlx::query(
            "UPDATE it.tickets SET first_response_at = COALESCE(first_response_at, now()), updated_at = now() WHERE id = $1",
        )
        .bind(id)
        .execute(pool.inner())
        .await
        .map_err(internal_err)?;
    }

    let comment = sqlx::query_as::<_, TicketComment>(
        r#"INSERT INTO it.ticket_comments (ticket_id, author_id, author_name, content, is_internal, attachments)
           VALUES ($1,$2,$3,$4,$5,$6)
           RETURNING id, ticket_id, author_id, author_name, content, is_internal, attachments, created_at"#,
    )
    .bind(id)
    .bind(payload.author_id)
    .bind(&payload.author_name)
    .bind(&payload.content)
    .bind(payload.is_internal.unwrap_or(false))
    .bind(payload.attachments.as_ref().unwrap_or(&serde_json::json!([])))
    .fetch_one(pool.inner())
    .await
    .map_err(internal_err)?;

    Ok((StatusCode::CREATED, Json(comment)))
}

// ─── POST /tickets/:id/time — log time entry ──────────────────────────────────

#[tracing::instrument(skip_all)]
pub async fn log_time_entry(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
    Json(payload): Json<AddTimeEntryReq>,
) -> Result<(StatusCode, Json<TicketTimeEntry>), (StatusCode, String)> {
    if payload.duration_minutes <= 0 {
        return Err((
            StatusCode::BAD_REQUEST,
            "Duration must be > 0 minutes".to_string(),
        ));
    }

    let entry = sqlx::query_as::<_, TicketTimeEntry>(
        r#"INSERT INTO it.ticket_time_entries (ticket_id, user_id, duration_minutes, description, billable)
           VALUES ($1,$2,$3,$4,$5)
           RETURNING id, ticket_id, user_id, duration_minutes, description, billable, created_at"#,
    )
    .bind(id)
    .bind(payload.user_id)
    .bind(payload.duration_minutes)
    .bind(&payload.description)
    .bind(payload.billable.unwrap_or(false))
    .fetch_one(pool.inner())
    .await
    .map_err(internal_err)?;

    Ok((StatusCode::CREATED, Json(entry)))
}

// ═══════════════════════════════════════════════════════════════════════════════
// PSA / Webhook Integration (Feature #29)
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Types ───────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PsaIntegrationRow {
    pub id: Uuid,
    pub name: String,
    #[sqlx(rename = "type")]
    pub integration_type: String,
    pub webhook_url: String,
    pub api_key: Option<String>,
    pub mapping_config: Value,
    pub enabled: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePsaIntegrationReq {
    pub name: String,
    #[serde(rename = "type")]
    pub integration_type: String,
    pub webhook_url: String,
    pub api_key: Option<String>,
    pub mapping_config: Option<Value>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePsaIntegrationReq {
    pub name: Option<String>,
    pub webhook_url: Option<String>,
    pub api_key: Option<String>,
    pub mapping_config: Option<Value>,
    pub enabled: Option<bool>,
}

/// Minimal ticket event payload forwarded to PSA webhooks.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TicketEventPayload {
    pub event_type: String, // "created" | "updated"
    pub ticket_id: Option<Uuid>,
    pub hardware_id: Option<Uuid>,
    pub title: String,
    pub description: Option<String>,
    pub priority: Option<String>,
    pub status: Option<String>,
}

// ─── TK-PSA-1: List PSA integrations ─────────────────────────────────────────

#[tracing::instrument(skip_all)]
pub async fn list_psa_integrations(
    State(pool): State<DatabasePool>,
) -> Result<Json<Vec<PsaIntegrationRow>>, (StatusCode, String)> {
    let rows = sqlx::query_as::<_, PsaIntegrationRow>(
        r#"SELECT id, name, "type", webhook_url, api_key, mapping_config, enabled, created_at, updated_at
           FROM it.psa_integrations ORDER BY name ASC"#,
    )
    .fetch_all(pool.inner())
    .await
    .map_err(internal_err)?;
    Ok(Json(rows))
}

// ─── TK-PSA-2: Create PSA integration ────────────────────────────────────────

#[tracing::instrument(skip_all)]
pub async fn create_psa_integration(
    State(pool): State<DatabasePool>,
    Json(payload): Json<CreatePsaIntegrationReq>,
) -> Result<(StatusCode, Json<PsaIntegrationRow>), (StatusCode, String)> {
    let row = sqlx::query_as::<_, PsaIntegrationRow>(
        r#"INSERT INTO it.psa_integrations (name, "type", webhook_url, api_key, mapping_config)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, name, "type", webhook_url, api_key, mapping_config, enabled, created_at, updated_at"#,
    )
    .bind(&payload.name)
    .bind(&payload.integration_type)
    .bind(&payload.webhook_url)
    .bind(payload.api_key)
    .bind(payload.mapping_config.unwrap_or_else(|| serde_json::json!({})))
    .fetch_one(pool.inner())
    .await
    .map_err(internal_err)?;
    Ok((StatusCode::CREATED, Json(row)))
}

// ─── TK-PSA-3: Update PSA integration ────────────────────────────────────────

#[tracing::instrument(skip_all)]
pub async fn update_psa_integration(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdatePsaIntegrationReq>,
) -> Result<Json<PsaIntegrationRow>, (StatusCode, String)> {
    let row = sqlx::query_as::<_, PsaIntegrationRow>(
        r#"UPDATE it.psa_integrations SET
               name           = COALESCE($2, name),
               webhook_url    = COALESCE($3, webhook_url),
               api_key        = COALESCE($4, api_key),
               mapping_config = COALESCE($5, mapping_config),
               enabled        = COALESCE($6, enabled),
               updated_at     = now()
           WHERE id = $1
           RETURNING id, name, "type", webhook_url, api_key, mapping_config, enabled, created_at, updated_at"#,
    )
    .bind(id)
    .bind(payload.name)
    .bind(payload.webhook_url)
    .bind(payload.api_key)
    .bind(payload.mapping_config)
    .bind(payload.enabled)
    .fetch_optional(pool.inner())
    .await
    .map_err(internal_err)?
    .ok_or((StatusCode::NOT_FOUND, "PSA integration not found".to_string()))?;
    Ok(Json(row))
}

// ─── TK-PSA-4: Delete PSA integration ────────────────────────────────────────

#[tracing::instrument(skip_all)]
pub async fn delete_psa_integration(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    let result = sqlx::query("DELETE FROM it.psa_integrations WHERE id = $1")
        .bind(id)
        .execute(pool.inner())
        .await
        .map_err(internal_err)?;
    if result.rows_affected() == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            "PSA integration not found".to_string(),
        ));
    }
    Ok(StatusCode::NO_CONTENT)
}

// ─── Internal: forward_ticket_event ──────────────────────────────────────────
//
// Called after create_ticket / update_ticket to fan-out to all enabled PSA webhooks.

pub async fn forward_ticket_event(pool: &DatabasePool, event: &TicketEventPayload) {
    let integrations = match sqlx::query_as::<_, PsaIntegrationRow>(
        r#"SELECT id, name, "type", webhook_url, api_key, mapping_config, enabled, created_at, updated_at
           FROM it.psa_integrations WHERE enabled = true"#,
    )
    .fetch_all(pool.inner())
    .await
    {
        Ok(rows) => rows,
        Err(e) => {
            tracing::warn!("Failed to fetch PSA integrations for webhook dispatch: {}", e);
            return;
        },
    };

    if integrations.is_empty() {
        return;
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .unwrap_or_default();

    for integration in integrations {
        let mapping = &integration.mapping_config;
        let mut payload = serde_json::json!({
            "event": event.event_type,
            "id": event.ticket_id,
            "hardware_id": event.hardware_id,
            "title": event.title,
            "description": event.description,
            "priority": event.priority,
            "status": event.status,
            "source": "signapps",
        });

        // Apply field_map remapping if configured
        if let Some(field_map) = mapping.get("field_map").and_then(|v| v.as_object()) {
            for (src, dst) in field_map {
                if let (Some(val), Some(dst_str)) = (payload.get(src).cloned(), dst.as_str()) {
                    payload[dst_str] = val;
                }
            }
        }

        let mut req = client
            .post(&integration.webhook_url)
            .header("Content-Type", "application/json")
            .header("X-SignApps-Event", &event.event_type)
            .header("X-SignApps-Integration-Type", &integration.integration_type);

        if let Some(ref key) = integration.api_key {
            req = req.header("Authorization", format!("Bearer {}", key));
        }

        match req.json(&payload).send().await {
            Ok(resp) => tracing::info!(
                "PSA webhook '{}' dispatched → {} (status {})",
                integration.name,
                integration.webhook_url,
                resp.status()
            ),
            Err(e) => tracing::warn!("PSA webhook '{}' delivery failed: {}", integration.name, e),
        }
    }
}
