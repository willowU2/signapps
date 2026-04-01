//! CRM handlers — Deals and Leads full CRUD + pipeline summary.
//!
//! Routes:
//!   Deals:    GET /api/v1/crm/deals, GET /api/v1/crm/deals/:id,
//!             POST /api/v1/crm/deals, PUT /api/v1/crm/deals/:id,
//!             DELETE /api/v1/crm/deals/:id
//!   Leads:    GET /api/v1/crm/leads, GET /api/v1/crm/leads/:id,
//!             POST /api/v1/crm/leads, PUT /api/v1/crm/leads/:id,
//!             DELETE /api/v1/crm/leads/:id
//!   Pipeline: GET /api/v1/crm/pipeline

use crate::AppState;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Extension, Json,
};
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use signapps_common::{Claims, Error, Result};
use uuid::Uuid;

// ── Deal types ────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Deal {
    pub id: Uuid,
    pub title: String,
    pub stage: String,
    pub amount: i64,
    pub currency: String,
    pub contact_id: Option<Uuid>,
    pub contact_name: Option<String>,
    pub contact_email: Option<String>,
    pub owner_id: Uuid,
    pub tenant_id: Option<Uuid>,
    pub close_date: Option<NaiveDate>,
    pub probability: i32,
    pub notes: Option<String>,
    pub metadata: Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateDealRequest {
    pub title: String,
    pub stage: Option<String>,
    pub amount: Option<i64>,
    pub currency: Option<String>,
    pub contact_id: Option<Uuid>,
    pub contact_name: Option<String>,
    pub contact_email: Option<String>,
    pub tenant_id: Option<Uuid>,
    pub close_date: Option<NaiveDate>,
    pub probability: Option<i32>,
    pub notes: Option<String>,
    pub metadata: Option<Value>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateDealRequest {
    pub title: Option<String>,
    pub stage: Option<String>,
    pub amount: Option<i64>,
    pub currency: Option<String>,
    pub contact_id: Option<Uuid>,
    pub contact_name: Option<String>,
    pub contact_email: Option<String>,
    pub close_date: Option<NaiveDate>,
    pub probability: Option<i32>,
    pub notes: Option<String>,
    pub metadata: Option<Value>,
}

#[derive(Debug, Deserialize)]
pub struct DealListQuery {
    pub stage: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

// ── Lead types ────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Lead {
    pub id: Uuid,
    pub name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub company: Option<String>,
    pub source: Option<String>,
    pub status: String,
    pub score: i32,
    pub owner_id: Uuid,
    pub tenant_id: Option<Uuid>,
    pub notes: Option<String>,
    pub metadata: Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateLeadRequest {
    pub name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub company: Option<String>,
    pub source: Option<String>,
    pub status: Option<String>,
    pub score: Option<i32>,
    pub tenant_id: Option<Uuid>,
    pub notes: Option<String>,
    pub metadata: Option<Value>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateLeadRequest {
    pub name: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub company: Option<String>,
    pub source: Option<String>,
    pub status: Option<String>,
    pub score: Option<i32>,
    pub notes: Option<String>,
    pub metadata: Option<Value>,
}

#[derive(Debug, Deserialize)]
pub struct LeadListQuery {
    pub status: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

// ── Pipeline summary ──────────────────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PipelineStage {
    pub stage: String,
    pub count: i64,
    pub total_amount: i64,
}

// ── Ensure schema/tables exist (auto-create on first use) ─────────────────────

async fn ensure_tables(pool: &signapps_db::DatabasePool) -> Result<()> {
    sqlx::query(
        r#"
        CREATE SCHEMA IF NOT EXISTS crm;
        CREATE TABLE IF NOT EXISTS crm.deals (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            title VARCHAR(500) NOT NULL,
            stage VARCHAR(50) NOT NULL DEFAULT 'prospect',
            amount BIGINT DEFAULT 0,
            currency VARCHAR(10) DEFAULT 'EUR',
            contact_id UUID,
            contact_name VARCHAR(200),
            contact_email VARCHAR(200),
            owner_id UUID NOT NULL,
            tenant_id UUID,
            close_date DATE,
            probability INTEGER DEFAULT 10,
            notes TEXT,
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_deals_owner ON crm.deals(owner_id);
        CREATE INDEX IF NOT EXISTS idx_deals_stage ON crm.deals(stage);
        CREATE TABLE IF NOT EXISTS crm.leads (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(200) NOT NULL,
            email VARCHAR(200),
            phone VARCHAR(50),
            company VARCHAR(200),
            source VARCHAR(50),
            status VARCHAR(30) DEFAULT 'new',
            score INTEGER DEFAULT 0,
            owner_id UUID NOT NULL,
            tenant_id UUID,
            notes TEXT,
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_leads_owner ON crm.leads(owner_id);
        "#,
    )
    .execute(pool.inner())
    .await
    .map_err(|e| Error::Internal(format!("ensure crm tables: {e}")))?;
    Ok(())
}

// ── Deal handlers ─────────────────────────────────────────────────────────────

/// `GET /api/v1/crm/deals` — list deals owned by caller, optional stage filter.
#[tracing::instrument(skip(state, q), fields(user_id = %claims.sub))]
pub async fn list_deals(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<DealListQuery>,
) -> Result<Json<Vec<Deal>>> {
    ensure_tables(&state.pool).await?;
    let limit = q.limit.unwrap_or(100).min(500);
    let offset = q.offset.unwrap_or(0);

    let deals = if let Some(stage) = &q.stage {
        sqlx::query_as::<_, Deal>(
            r#"SELECT * FROM crm.deals
               WHERE owner_id = $1 AND stage = $2
               ORDER BY created_at DESC LIMIT $3 OFFSET $4"#,
        )
        .bind(claims.sub)
        .bind(stage)
        .bind(limit)
        .bind(offset)
        .fetch_all(state.pool.inner())
        .await
    } else {
        sqlx::query_as::<_, Deal>(
            r#"SELECT * FROM crm.deals
               WHERE owner_id = $1
               ORDER BY created_at DESC LIMIT $2 OFFSET $3"#,
        )
        .bind(claims.sub)
        .bind(limit)
        .bind(offset)
        .fetch_all(state.pool.inner())
        .await
    }
    .map_err(|e| Error::Internal(format!("list deals: {e}")))?;

    Ok(Json(deals))
}

/// `GET /api/v1/crm/deals/:id` — get a single deal.
#[tracing::instrument(skip(state), fields(user_id = %claims.sub, deal_id = %id))]
pub async fn get_deal(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Deal>> {
    ensure_tables(&state.pool).await?;
    let deal = sqlx::query_as::<_, Deal>("SELECT * FROM crm.deals WHERE id = $1 AND owner_id = $2")
        .bind(id)
        .bind(claims.sub)
        .fetch_optional(state.pool.inner())
        .await
        .map_err(|e| Error::Internal(format!("get deal: {e}")))?
        .ok_or_else(|| Error::NotFound("Deal not found".to_string()))?;

    Ok(Json(deal))
}

/// `POST /api/v1/crm/deals` — create a deal.
#[tracing::instrument(skip(state, body), fields(user_id = %claims.sub))]
pub async fn create_deal(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateDealRequest>,
) -> Result<(StatusCode, Json<Deal>)> {
    ensure_tables(&state.pool).await?;
    let deal = sqlx::query_as::<_, Deal>(
        r#"INSERT INTO crm.deals
           (title, stage, amount, currency, contact_id, contact_name, contact_email,
            owner_id, tenant_id, close_date, probability, notes, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           RETURNING *"#,
    )
    .bind(&body.title)
    .bind(body.stage.as_deref().unwrap_or("prospect"))
    .bind(body.amount.unwrap_or(0))
    .bind(body.currency.as_deref().unwrap_or("EUR"))
    .bind(body.contact_id)
    .bind(&body.contact_name)
    .bind(&body.contact_email)
    .bind(claims.sub)
    .bind(body.tenant_id)
    .bind(body.close_date)
    .bind(body.probability.unwrap_or(10))
    .bind(&body.notes)
    .bind(body.metadata.unwrap_or_else(|| serde_json::json!({})))
    .fetch_one(state.pool.inner())
    .await
    .map_err(|e| Error::Internal(format!("create deal: {e}")))?;

    Ok((StatusCode::CREATED, Json(deal)))
}

/// `PUT /api/v1/crm/deals/:id` — update a deal.
#[tracing::instrument(skip(state, body), fields(user_id = %claims.sub, deal_id = %id))]
pub async fn update_deal(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateDealRequest>,
) -> Result<Json<Deal>> {
    ensure_tables(&state.pool).await?;
    // Verify ownership first.
    let existing =
        sqlx::query_as::<_, Deal>("SELECT * FROM crm.deals WHERE id = $1 AND owner_id = $2")
            .bind(id)
            .bind(claims.sub)
            .fetch_optional(state.pool.inner())
            .await
            .map_err(|e| Error::Internal(format!("update deal fetch: {e}")))?
            .ok_or_else(|| Error::NotFound("Deal not found".to_string()))?;

    let deal = sqlx::query_as::<_, Deal>(
        r#"UPDATE crm.deals SET
           title        = COALESCE($1, title),
           stage        = COALESCE($2, stage),
           amount       = COALESCE($3, amount),
           currency     = COALESCE($4, currency),
           contact_id   = COALESCE($5, contact_id),
           contact_name = COALESCE($6, contact_name),
           contact_email= COALESCE($7, contact_email),
           close_date   = COALESCE($8, close_date),
           probability  = COALESCE($9, probability),
           notes        = COALESCE($10, notes),
           metadata     = COALESCE($11, metadata),
           updated_at   = now()
           WHERE id = $12 AND owner_id = $13
           RETURNING *"#,
    )
    .bind(&body.title)
    .bind(&body.stage)
    .bind(body.amount)
    .bind(&body.currency)
    .bind(body.contact_id)
    .bind(&body.contact_name)
    .bind(&body.contact_email)
    .bind(body.close_date)
    .bind(body.probability)
    .bind(&body.notes)
    .bind(&body.metadata)
    .bind(id)
    .bind(existing.owner_id)
    .fetch_one(state.pool.inner())
    .await
    .map_err(|e| Error::Internal(format!("update deal: {e}")))?;

    Ok(Json(deal))
}

/// `DELETE /api/v1/crm/deals/:id` — delete a deal.
#[tracing::instrument(skip(state), fields(user_id = %claims.sub, deal_id = %id))]
pub async fn delete_deal(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    ensure_tables(&state.pool).await?;
    let rows = sqlx::query("DELETE FROM crm.deals WHERE id = $1 AND owner_id = $2")
        .bind(id)
        .bind(claims.sub)
        .execute(state.pool.inner())
        .await
        .map_err(|e| Error::Internal(format!("delete deal: {e}")))?
        .rows_affected();

    if rows == 0 {
        return Err(Error::NotFound("Deal not found".to_string()));
    }
    Ok(StatusCode::NO_CONTENT)
}

// ── Lead handlers ─────────────────────────────────────────────────────────────

/// `GET /api/v1/crm/leads` — list leads owned by caller.
#[tracing::instrument(skip(state, q), fields(user_id = %claims.sub))]
pub async fn list_leads(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<LeadListQuery>,
) -> Result<Json<Vec<Lead>>> {
    ensure_tables(&state.pool).await?;
    let limit = q.limit.unwrap_or(100).min(500);
    let offset = q.offset.unwrap_or(0);

    let leads = if let Some(status) = &q.status {
        sqlx::query_as::<_, Lead>(
            r#"SELECT * FROM crm.leads
               WHERE owner_id = $1 AND status = $2
               ORDER BY created_at DESC LIMIT $3 OFFSET $4"#,
        )
        .bind(claims.sub)
        .bind(status)
        .bind(limit)
        .bind(offset)
        .fetch_all(state.pool.inner())
        .await
    } else {
        sqlx::query_as::<_, Lead>(
            r#"SELECT * FROM crm.leads
               WHERE owner_id = $1
               ORDER BY created_at DESC LIMIT $2 OFFSET $3"#,
        )
        .bind(claims.sub)
        .bind(limit)
        .bind(offset)
        .fetch_all(state.pool.inner())
        .await
    }
    .map_err(|e| Error::Internal(format!("list leads: {e}")))?;

    Ok(Json(leads))
}

/// `GET /api/v1/crm/leads/:id` — get a single lead.
#[tracing::instrument(skip(state), fields(user_id = %claims.sub, lead_id = %id))]
pub async fn get_lead(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Lead>> {
    ensure_tables(&state.pool).await?;
    let lead = sqlx::query_as::<_, Lead>("SELECT * FROM crm.leads WHERE id = $1 AND owner_id = $2")
        .bind(id)
        .bind(claims.sub)
        .fetch_optional(state.pool.inner())
        .await
        .map_err(|e| Error::Internal(format!("get lead: {e}")))?
        .ok_or_else(|| Error::NotFound("Lead not found".to_string()))?;

    Ok(Json(lead))
}

/// `POST /api/v1/crm/leads` — create a lead.
#[tracing::instrument(skip(state, body), fields(user_id = %claims.sub))]
pub async fn create_lead(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateLeadRequest>,
) -> Result<(StatusCode, Json<Lead>)> {
    ensure_tables(&state.pool).await?;
    let lead = sqlx::query_as::<_, Lead>(
        r#"INSERT INTO crm.leads
           (name, email, phone, company, source, status, score,
            owner_id, tenant_id, notes, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING *"#,
    )
    .bind(&body.name)
    .bind(&body.email)
    .bind(&body.phone)
    .bind(&body.company)
    .bind(&body.source)
    .bind(body.status.as_deref().unwrap_or("new"))
    .bind(body.score.unwrap_or(0))
    .bind(claims.sub)
    .bind(body.tenant_id)
    .bind(&body.notes)
    .bind(body.metadata.unwrap_or_else(|| serde_json::json!({})))
    .fetch_one(state.pool.inner())
    .await
    .map_err(|e| Error::Internal(format!("create lead: {e}")))?;

    Ok((StatusCode::CREATED, Json(lead)))
}

/// `PUT /api/v1/crm/leads/:id` — update a lead.
#[tracing::instrument(skip(state, body), fields(user_id = %claims.sub, lead_id = %id))]
pub async fn update_lead(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateLeadRequest>,
) -> Result<Json<Lead>> {
    ensure_tables(&state.pool).await?;
    let existing =
        sqlx::query_as::<_, Lead>("SELECT * FROM crm.leads WHERE id = $1 AND owner_id = $2")
            .bind(id)
            .bind(claims.sub)
            .fetch_optional(state.pool.inner())
            .await
            .map_err(|e| Error::Internal(format!("update lead fetch: {e}")))?
            .ok_or_else(|| Error::NotFound("Lead not found".to_string()))?;

    let lead = sqlx::query_as::<_, Lead>(
        r#"UPDATE crm.leads SET
           name     = COALESCE($1, name),
           email    = COALESCE($2, email),
           phone    = COALESCE($3, phone),
           company  = COALESCE($4, company),
           source   = COALESCE($5, source),
           status   = COALESCE($6, status),
           score    = COALESCE($7, score),
           notes    = COALESCE($8, notes),
           metadata = COALESCE($9, metadata),
           updated_at = now()
           WHERE id = $10 AND owner_id = $11
           RETURNING *"#,
    )
    .bind(&body.name)
    .bind(&body.email)
    .bind(&body.phone)
    .bind(&body.company)
    .bind(&body.source)
    .bind(&body.status)
    .bind(body.score)
    .bind(&body.notes)
    .bind(&body.metadata)
    .bind(id)
    .bind(existing.owner_id)
    .fetch_one(state.pool.inner())
    .await
    .map_err(|e| Error::Internal(format!("update lead: {e}")))?;

    Ok(Json(lead))
}

/// `DELETE /api/v1/crm/leads/:id` — delete a lead.
#[tracing::instrument(skip(state), fields(user_id = %claims.sub, lead_id = %id))]
pub async fn delete_lead(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    ensure_tables(&state.pool).await?;
    let rows = sqlx::query("DELETE FROM crm.leads WHERE id = $1 AND owner_id = $2")
        .bind(id)
        .bind(claims.sub)
        .execute(state.pool.inner())
        .await
        .map_err(|e| Error::Internal(format!("delete lead: {e}")))?
        .rows_affected();

    if rows == 0 {
        return Err(Error::NotFound("Lead not found".to_string()));
    }
    Ok(StatusCode::NO_CONTENT)
}

// ── Pipeline summary ──────────────────────────────────────────────────────────

/// `GET /api/v1/crm/pipeline` — count + total amount per stage for the caller.
#[tracing::instrument(skip(state), fields(user_id = %claims.sub))]
pub async fn get_pipeline(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<PipelineStage>>> {
    ensure_tables(&state.pool).await?;
    let stages = sqlx::query_as::<_, PipelineStage>(
        r#"SELECT stage,
                  COUNT(*)::BIGINT AS count,
                  COALESCE(SUM(amount), 0)::BIGINT AS total_amount
           FROM crm.deals
           WHERE owner_id = $1
           GROUP BY stage
           ORDER BY stage"#,
    )
    .bind(claims.sub)
    .fetch_all(state.pool.inner())
    .await
    .map_err(|e| Error::Internal(format!("get pipeline: {e}")))?;

    Ok(Json(stages))
}
