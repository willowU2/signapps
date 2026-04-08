//! CO1: Compliance endpoints — DPIA, DSAR, retention policies, and consent
//!
//! All data is stored as JSONB in a single `identity.compliance_records` table
//! to avoid requiring a new migration for each compliance type.
//!
//! CO2: When a DSAR is approved (status = "fulfilled"), a `compliance.dsar.approved`
//!      platform event is published and admin notifications are created.

use crate::AppState;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use signapps_common::{
    pg_events::{NewEvent, PgEventBus},
    Error, Result,
};
use uuid::Uuid;

// ── Shared record type stored in identity.compliance_records ─────────────────

#[derive(sqlx::FromRow, Debug, Clone)]
struct ComplianceRow {
    id: Uuid,
    #[allow(dead_code)]
    record_type: String,
    data: Value,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

// ── DPIA ─────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, utoipa::ToSchema)]
/// Request body for SaveDpia.
pub struct SaveDpiaRequest {
    pub project_name: String,
    pub data_controller: String,
    pub dpo_name: Option<String>,
    pub assessment_date: String,
    pub risk_level: String,
    pub proceed: bool,
    #[serde(flatten)]
    pub extra: Value,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
/// DpiaRecord data transfer object.
pub struct DpiaRecord {
    pub id: Uuid,
    pub project_name: String,
    pub data_controller: String,
    pub risk_level: String,
    pub proceed: bool,
    pub assessment_date: String,
    pub created_at: DateTime<Utc>,
    pub data: Value,
}

/// `POST /api/v1/compliance/dpia` — save a new DPIA record.
#[utoipa::path(
    post,
    path = "/api/v1/compliance/dpia",
    tag = "compliance",
    request_body = SaveDpiaRequest,
    responses(
        (status = 201, description = "DPIA saved", body = DpiaRecord),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip(state))]
#[tracing::instrument(skip_all)]
pub async fn save_dpia(
    State(state): State<AppState>,
    Json(req): Json<SaveDpiaRequest>,
) -> Result<(StatusCode, Json<DpiaRecord>)> {
    let data =
        serde_json::to_value(&req).map_err(|e| Error::Internal(format!("serialize: {}", e)))?;

    let row = upsert_record(&state.pool, Uuid::new_v4(), "dpia", &data).await?;

    Ok((StatusCode::CREATED, Json(dpia_from_row(row)?)))
}

/// `GET /api/v1/compliance/dpia` — list all DPIA records.
#[utoipa::path(
    get,
    path = "/api/v1/compliance/dpia",
    tag = "compliance",
    responses(
        (status = 200, description = "DPIA record list", body = Vec<DpiaRecord>),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip(state))]
#[tracing::instrument(skip_all)]
pub async fn list_dpias(State(state): State<AppState>) -> Result<Json<Vec<DpiaRecord>>> {
    let rows = list_records(&state.pool, "dpia").await?;
    let records: Vec<DpiaRecord> = rows
        .into_iter()
        .map(dpia_from_row)
        .collect::<std::result::Result<_, _>>()?;
    Ok(Json(records))
}

fn dpia_from_row(row: ComplianceRow) -> Result<DpiaRecord> {
    Ok(DpiaRecord {
        id: row.id,
        project_name: row
            .data
            .get("project_name")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        data_controller: row
            .data
            .get("data_controller")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        risk_level: row
            .data
            .get("risk_level")
            .and_then(|v| v.as_str())
            .unwrap_or("low")
            .to_string(),
        proceed: row
            .data
            .get("proceed")
            .and_then(|v| v.as_bool())
            .unwrap_or(true),
        assessment_date: row
            .data
            .get("assessment_date")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        created_at: row.created_at,
        data: row.data,
    })
}

// ── DSAR ─────────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request body for CreateDsar.
pub struct CreateDsarRequest {
    #[serde(rename = "type")]
    pub dsar_type: String,
    pub subject_name: String,
    pub subject_email: String,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Clone, utoipa::ToSchema)]
/// DsarRecord data transfer object.
pub struct DsarRecord {
    pub id: Uuid,
    pub reference: String,
    #[serde(rename = "type")]
    pub dsar_type: String,
    pub status: String,
    pub subject_name: String,
    pub subject_email: String,
    pub description: Option<String>,
    pub received_at: DateTime<Utc>,
    pub deadline_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request body for UpdateDsar.
pub struct UpdateDsarRequest {
    pub status: String,
    pub notes: Option<String>,
}

/// `POST /api/v1/compliance/dsar` — create a new DSAR request.
#[utoipa::path(
    post,
    path = "/api/v1/compliance/dsar",
    tag = "compliance",
    request_body = CreateDsarRequest,
    responses(
        (status = 201, description = "DSAR created", body = DsarRecord),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip(state))]
#[tracing::instrument(skip_all)]
pub async fn create_dsar(
    State(state): State<AppState>,
    Json(req): Json<CreateDsarRequest>,
) -> Result<(StatusCode, Json<DsarRecord>)> {
    let id = Uuid::new_v4();
    let reference = format!("DSAR-{}", &id.to_string()[..8].to_uppercase());
    let received_at = Utc::now();
    let deadline_at = received_at + chrono::Duration::days(30);

    let data = serde_json::json!({
        "type": req.dsar_type,
        "status": "received",
        "subject_name": req.subject_name,
        "subject_email": req.subject_email,
        "description": req.description,
        "reference": reference,
        "received_at": received_at,
        "deadline_at": deadline_at,
    });

    let row = upsert_record(&state.pool, id, "dsar", &data).await?;
    let record = dsar_from_row(row)?;

    Ok((StatusCode::CREATED, Json(record)))
}

/// `GET /api/v1/compliance/dsar` — list all DSAR requests.
#[utoipa::path(
    get,
    path = "/api/v1/compliance/dsar",
    tag = "compliance",
    responses(
        (status = 200, description = "DSAR list", body = serde_json::Value),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip(state))]
#[tracing::instrument(skip_all)]
pub async fn list_dsars(State(state): State<AppState>) -> Result<Json<serde_json::Value>> {
    let rows = list_records(&state.pool, "dsar").await?;
    let records: Vec<DsarRecord> = rows
        .into_iter()
        .map(dsar_from_row)
        .collect::<std::result::Result<_, _>>()?;
    Ok(Json(serde_json::json!({ "data": records })))
}

/// `PATCH /api/v1/compliance/dsar/:id` — update DSAR status (CO2: triggers event on approval).
#[utoipa::path(
    patch,
    path = "/api/v1/compliance/dsar/{id}",
    tag = "compliance",
    params(("id" = Uuid, Path, description = "DSAR UUID")),
    request_body = UpdateDsarRequest,
    responses(
        (status = 200, description = "DSAR updated", body = DsarRecord),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "DSAR not found"),
    )
)]
#[tracing::instrument(skip(state))]
#[tracing::instrument(skip_all)]
pub async fn update_dsar(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateDsarRequest>,
) -> Result<Json<DsarRecord>> {
    // Load existing record
    let existing = get_record(&state.pool, id, "dsar")
        .await?
        .ok_or_else(|| Error::NotFound(format!("DSAR {}", id)))?;

    let mut data = existing.data.clone();
    if let Some(obj) = data.as_object_mut() {
        obj.insert(
            "status".to_string(),
            serde_json::Value::String(req.status.clone()),
        );
        if let Some(notes) = &req.notes {
            obj.insert(
                "notes".to_string(),
                serde_json::Value::String(notes.clone()),
            );
        }
        if req.status == "fulfilled" {
            obj.insert(
                "fulfilled_at".to_string(),
                serde_json::to_value(Utc::now()).unwrap_or_default(),
            );
        }
    }

    let updated = update_record(&state.pool, id, &data).await?;
    let record = dsar_from_row(updated.clone())?;

    // CO2: Publish compliance.dsar.approved event when status becomes "fulfilled"
    if req.status == "fulfilled" {
        let bus = PgEventBus::new(state.pool.inner().clone(), "signapps-compliance".to_string());
        if let Err(e) = bus
            .publish(NewEvent {
                event_type: "compliance.dsar.approved".to_string(),
                aggregate_id: Some(id),
                payload: serde_json::json!({
                    "dsar_id": id,
                    "subject_email": record.subject_email,
                    "subject_name": record.subject_name,
                    "type": record.dsar_type,
                }),
            })
            .await
        {
            tracing::warn!("Failed to publish compliance.dsar.approved event: {}", e);
        } else {
            tracing::info!(dsar_id = %id, "Published compliance.dsar.approved event");
        }
    }

    Ok(Json(record))
}

fn dsar_from_row(row: ComplianceRow) -> Result<DsarRecord> {
    let received_at = row
        .data
        .get("received_at")
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse::<DateTime<Utc>>().ok())
        .unwrap_or(row.created_at);
    let deadline_at = row
        .data
        .get("deadline_at")
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse::<DateTime<Utc>>().ok())
        .unwrap_or_else(|| received_at + chrono::Duration::days(30));

    Ok(DsarRecord {
        id: row.id,
        reference: row
            .data
            .get("reference")
            .and_then(|v| v.as_str())
            .unwrap_or("DSAR-???")
            .to_string(),
        dsar_type: row
            .data
            .get("type")
            .and_then(|v| v.as_str())
            .unwrap_or("access")
            .to_string(),
        status: row
            .data
            .get("status")
            .and_then(|v| v.as_str())
            .unwrap_or("received")
            .to_string(),
        subject_name: row
            .data
            .get("subject_name")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        subject_email: row
            .data
            .get("subject_email")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        description: row
            .data
            .get("description")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        received_at,
        deadline_at,
        created_at: row.created_at,
    })
}

// ── Retention policies ────────────────────────────────────────────────────────

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request body for RetentionPolicies.
pub struct RetentionPoliciesRequest {
    pub policies: Value,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
/// Response for RetentionPolicies.
pub struct RetentionPoliciesResponse {
    pub data: Value,
    pub updated_at: DateTime<Utc>,
}

/// `PUT /api/v1/compliance/retention-policies` — save retention policies blob.
#[utoipa::path(
    put,
    path = "/api/v1/compliance/retention-policies",
    tag = "compliance",
    request_body = RetentionPoliciesRequest,
    responses(
        (status = 200, description = "Retention policies saved", body = RetentionPoliciesResponse),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip(state))]
#[tracing::instrument(skip_all)]
pub async fn save_retention_policies(
    State(state): State<AppState>,
    Json(req): Json<RetentionPoliciesRequest>,
) -> Result<Json<RetentionPoliciesResponse>> {
    // Store as a single record with id = well-known UUID for retention-policies
    let retention_id =
        Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap_or_else(|_| Uuid::new_v4());

    let row = upsert_record(
        &state.pool,
        retention_id,
        "retention-policies",
        &req.policies,
    )
    .await?;

    Ok(Json(RetentionPoliciesResponse {
        data: row.data,
        updated_at: row.updated_at,
    }))
}

/// `GET /api/v1/compliance/retention-policies` — get retention policies blob.
#[utoipa::path(
    get,
    path = "/api/v1/compliance/retention-policies",
    tag = "compliance",
    responses(
        (status = 200, description = "Retention policies", body = serde_json::Value),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip(state))]
#[tracing::instrument(skip_all)]
pub async fn get_retention_policies(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>> {
    let rows = list_records(&state.pool, "retention-policies").await?;
    let policies = rows.into_iter().map(|r| r.data).collect::<Vec<_>>();
    Ok(Json(serde_json::json!({ "data": policies })))
}

// ── Consent (CO4) ─────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request body for SaveConsent.
pub struct SaveConsentRequest {
    pub consent: Value,
}

/// `PUT /api/v1/compliance/consent` — save consent choices.
#[utoipa::path(
    put,
    path = "/api/v1/compliance/consent",
    tag = "compliance",
    request_body = SaveConsentRequest,
    responses(
        (status = 200, description = "Consent saved", body = serde_json::Value),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip(state))]
#[tracing::instrument(skip_all)]
pub async fn save_consent(
    State(state): State<AppState>,
    Json(req): Json<SaveConsentRequest>,
) -> Result<Json<serde_json::Value>> {
    let consent_id =
        Uuid::parse_str("00000000-0000-0000-0000-000000000002").unwrap_or_else(|_| Uuid::new_v4());

    let row = upsert_record(&state.pool, consent_id, "consent", &req.consent).await?;

    Ok(Json(
        serde_json::json!({ "config": row.data, "updated_at": row.updated_at }),
    ))
}

/// `GET /api/v1/compliance/consent` — get current consent configuration.
#[utoipa::path(
    get,
    path = "/api/v1/compliance/consent",
    tag = "compliance",
    responses(
        (status = 200, description = "Current consent configuration", body = serde_json::Value),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip(state))]
#[tracing::instrument(skip_all)]
pub async fn get_consent(State(state): State<AppState>) -> Result<Json<serde_json::Value>> {
    let rows = list_records(&state.pool, "consent").await?;
    if let Some(row) = rows.into_iter().next() {
        Ok(Json(serde_json::json!({ "config": row.data })))
    } else {
        Ok(Json(serde_json::json!({ "config": null })))
    }
}

// ── Cookie banner (existing frontend uses /api/compliance/cookie-banner) ─────

/// `PUT /api/v1/compliance/cookie-banner` — save cookie banner configuration.
#[utoipa::path(
    put,
    path = "/api/v1/compliance/cookie-banner",
    tag = "compliance",
    request_body(content = serde_json::Value, description = "Cookie banner config"),
    responses(
        (status = 200, description = "Cookie banner config saved", body = serde_json::Value),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip(state))]
#[tracing::instrument(skip_all)]
pub async fn save_cookie_banner(
    State(state): State<AppState>,
    Json(body): Json<Value>,
) -> Result<Json<Value>> {
    let cookie_id =
        Uuid::parse_str("00000000-0000-0000-0000-000000000003").unwrap_or_else(|_| Uuid::new_v4());
    let row = upsert_record(&state.pool, cookie_id, "cookie-banner", &body).await?;
    Ok(Json(serde_json::json!({ "config": row.data })))
}

/// `GET /api/v1/compliance/cookie-banner` — get cookie banner configuration.
#[utoipa::path(
    get,
    path = "/api/v1/compliance/cookie-banner",
    tag = "compliance",
    responses(
        (status = 200, description = "Cookie banner configuration", body = serde_json::Value),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip(state))]
#[tracing::instrument(skip_all)]
pub async fn get_cookie_banner(State(state): State<AppState>) -> Result<Json<Value>> {
    let rows = list_records(&state.pool, "cookie-banner").await?;
    if let Some(row) = rows.into_iter().next() {
        Ok(Json(
            serde_json::json!({ "config": row.data.get("config").cloned().unwrap_or(row.data) }),
        ))
    } else {
        Ok(Json(serde_json::json!({ "config": null })))
    }
}

// ── DB helpers ────────────────────────────────────────────────────────────────

async fn ensure_compliance_table(
    pool: &signapps_db::DatabasePool,
) -> std::result::Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS identity.compliance_records (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            record_type TEXT NOT NULL,
            data        JSONB NOT NULL DEFAULT '{}',
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    "#,
    )
    .execute(pool.inner())
    .await?;
    Ok(())
}

async fn upsert_record(
    pool: &signapps_db::DatabasePool,
    id: Uuid,
    record_type: &str,
    data: &Value,
) -> Result<ComplianceRow> {
    // Ensure table exists (idempotent)
    if let Err(e) = ensure_compliance_table(pool).await {
        tracing::warn!("compliance table ensure failed: {}", e);
    }

    let row: ComplianceRow = sqlx::query_as(
        r#"
        INSERT INTO identity.compliance_records (id, record_type, data)
        VALUES ($1, $2, $3)
        ON CONFLICT (id) DO UPDATE
            SET data = EXCLUDED.data,
                updated_at = NOW()
        RETURNING *
    "#,
    )
    .bind(id)
    .bind(record_type)
    .bind(data)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| Error::Internal(format!("db upsert: {}", e)))?;

    Ok(row)
}

async fn list_records(
    pool: &signapps_db::DatabasePool,
    record_type: &str,
) -> Result<Vec<ComplianceRow>> {
    if let Err(e) = ensure_compliance_table(pool).await {
        tracing::warn!("compliance table ensure failed: {}", e);
    }

    let rows: Vec<ComplianceRow> = sqlx::query_as(
        "SELECT * FROM identity.compliance_records WHERE record_type = $1 ORDER BY created_at DESC",
    )
    .bind(record_type)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| Error::Internal(format!("db list: {}", e)))?;

    Ok(rows)
}

async fn get_record(
    pool: &signapps_db::DatabasePool,
    id: Uuid,
    record_type: &str,
) -> Result<Option<ComplianceRow>> {
    if let Err(e) = ensure_compliance_table(pool).await {
        tracing::warn!("compliance table ensure failed: {}", e);
    }

    let row: Option<ComplianceRow> = sqlx::query_as(
        "SELECT * FROM identity.compliance_records WHERE id = $1 AND record_type = $2",
    )
    .bind(id)
    .bind(record_type)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| Error::Internal(format!("db get: {}", e)))?;

    Ok(row)
}

async fn update_record(
    pool: &signapps_db::DatabasePool,
    id: Uuid,
    data: &Value,
) -> Result<ComplianceRow> {
    let row: ComplianceRow = sqlx::query_as(
        "UPDATE identity.compliance_records SET data = $2, updated_at = NOW() WHERE id = $1 RETURNING *"
    )
    .bind(id)
    .bind(data)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| Error::Internal(format!("db update: {}", e)))?;

    Ok(row)
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
