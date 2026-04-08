//! Accounting endpoints — journal entries, chart of accounts, reports
//!
//! All data is stored as JSONB in `platform.accounting_data` using
//! an `entity_type` discriminant column.

use crate::AppState;
use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use signapps_common::{Error, Result};
use sqlx::{Pool, Postgres};
use uuid::Uuid;

// ── Shared row ────────────────────────────────────────────────────────────────

#[derive(sqlx::FromRow)]
struct AccRow {
    id: Uuid,
    entity_type: String,
    data: Value,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

// ── DTO ───────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, utoipa::ToSchema)]
/// Generic accounting record returned to the client.
pub struct AccRecord {
    pub id: Uuid,
    pub entity_type: String,
    pub data: Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<AccRow> for AccRecord {
    fn from(r: AccRow) -> Self {
        AccRecord {
            id: r.id,
            entity_type: r.entity_type,
            data: r.data,
            created_at: r.created_at,
            updated_at: r.updated_at,
        }
    }
}

// ── Query params ──────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
/// Query params for reports endpoint.
pub struct ReportQuery {
    pub report_type: Option<String>, // 'pl' | 'balance_sheet'
}

// ── DB helpers ────────────────────────────────────────────────────────────────

async fn ensure_table(pool: &Pool<Postgres>) -> Result<()> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS platform.accounting_data (
            id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            entity_type  VARCHAR(64) NOT NULL,
            data         JSONB       NOT NULL DEFAULT '{}',
            created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| Error::Internal(format!("ensure accounting table: {}", e)))?;
    Ok(())
}

async fn insert_row(pool: &Pool<Postgres>, entity_type: &str, data: &Value) -> Result<AccRow> {
    if let Err(e) = ensure_table(pool).await {
        tracing::warn!("accounting_data ensure failed: {}", e);
    }
    let row: AccRow = sqlx::query_as(
        r#"
        INSERT INTO platform.accounting_data (entity_type, data)
        VALUES ($1, $2)
        RETURNING *
        "#,
    )
    .bind(entity_type)
    .bind(data)
    .fetch_one(pool)
    .await
    .map_err(|e| Error::Internal(format!("accounting insert: {}", e)))?;
    Ok(row)
}

async fn list_rows(pool: &Pool<Postgres>, entity_type: &str) -> Result<Vec<AccRow>> {
    if let Err(e) = ensure_table(pool).await {
        tracing::warn!("accounting_data ensure failed: {}", e);
    }
    let rows: Vec<AccRow> = sqlx::query_as(
        "SELECT * FROM platform.accounting_data WHERE entity_type = $1 ORDER BY created_at DESC",
    )
    .bind(entity_type)
    .fetch_all(pool)
    .await
    .map_err(|e| Error::Internal(format!("accounting list: {}", e)))?;
    Ok(rows)
}

// ── Journal Entries ───────────────────────────────────────────────────────────

/// `GET /api/v1/accounting/entries` — list journal entries.
#[utoipa::path(
    get,
    path = "/api/v1/accounting/entries",
    tag = "accounting",
    security(("bearerAuth" = [])),
    responses(
        (status = 200, description = "List of journal entries", body = Vec<AccRecord>),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn list_entries(State(state): State<AppState>) -> Result<Json<Vec<AccRecord>>> {
    let rows = list_rows(&state.pool, "journal_entry").await?;
    Ok(Json(rows.into_iter().map(AccRecord::from).collect()))
}

/// `POST /api/v1/accounting/entries` — create journal entry.
#[utoipa::path(
    post,
    path = "/api/v1/accounting/entries",
    tag = "accounting",
    security(("bearerAuth" = [])),
    request_body(content = serde_json::Value, description = "Journal entry data"),
    responses(
        (status = 201, description = "Journal entry created", body = AccRecord),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn create_entry(
    State(state): State<AppState>,
    Json(body): Json<Value>,
) -> Result<(StatusCode, Json<AccRecord>)> {
    let row = insert_row(&state.pool, "journal_entry", &body).await?;
    Ok((StatusCode::CREATED, Json(row.into())))
}

// ── Chart of Accounts ─────────────────────────────────────────────────────────

/// `GET /api/v1/accounting/accounts` — list accounts.
#[utoipa::path(
    get,
    path = "/api/v1/accounting/accounts",
    tag = "accounting",
    security(("bearerAuth" = [])),
    responses(
        (status = 200, description = "List of accounts", body = Vec<AccRecord>),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn list_accounts(State(state): State<AppState>) -> Result<Json<Vec<AccRecord>>> {
    let rows = list_rows(&state.pool, "account").await?;
    Ok(Json(rows.into_iter().map(AccRecord::from).collect()))
}

/// `POST /api/v1/accounting/accounts` — create account.
#[utoipa::path(
    post,
    path = "/api/v1/accounting/accounts",
    tag = "accounting",
    security(("bearerAuth" = [])),
    request_body(content = serde_json::Value, description = "Account data"),
    responses(
        (status = 201, description = "Account created", body = AccRecord),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn create_account(
    State(state): State<AppState>,
    Json(body): Json<Value>,
) -> Result<(StatusCode, Json<AccRecord>)> {
    let row = insert_row(&state.pool, "account", &body).await?;
    Ok((StatusCode::CREATED, Json(row.into())))
}

// ── Reports ───────────────────────────────────────────────────────────────────

/// `GET /api/v1/accounting/reports` — generate P&L or balance sheet.
///
/// Query `?report_type=pl` or `?report_type=balance_sheet`.
/// Returns computed summary built from journal entries in the DB.
#[utoipa::path(
    get,
    path = "/api/v1/accounting/reports",
    tag = "accounting",
    security(("bearerAuth" = [])),
    params(
        ("report_type" = Option<String>, Query, description = "Report type: 'pl' or 'balance_sheet'"),
    ),
    responses(
        (status = 200, description = "Generated report", body = serde_json::Value),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn get_reports(
    State(state): State<AppState>,
    Query(q): Query<ReportQuery>,
) -> Result<Json<Value>> {
    if let Err(e) = ensure_table(&state.pool).await {
        tracing::warn!("accounting_data ensure failed: {}", e);
    }

    // Fetch all journal entries to compute report totals
    let entries = list_rows(&state.pool, "journal_entry").await?;

    let report_type = q.report_type.as_deref().unwrap_or("pl");

    let mut total_debit = 0.0_f64;
    let mut total_credit = 0.0_f64;
    for e in &entries {
        total_debit += e.data.get("debit").and_then(|v| v.as_f64()).unwrap_or(0.0);
        total_credit += e.data.get("credit").and_then(|v| v.as_f64()).unwrap_or(0.0);
    }

    let report = match report_type {
        "balance_sheet" => serde_json::json!({
            "report_type": "balance_sheet",
            "total_entries": entries.len(),
            "total_debit": total_debit,
            "total_credit": total_credit,
            "net": total_debit - total_credit,
            "generated_at": Utc::now().to_rfc3339(),
        }),
        _ => serde_json::json!({
            "report_type": "pl",
            "total_entries": entries.len(),
            "revenue": total_credit,
            "expenses": total_debit,
            "net_profit": total_credit - total_debit,
            "generated_at": Utc::now().to_rfc3339(),
        }),
    };

    Ok(Json(report))
}

#[cfg(test)]
mod tests {
    #[test]
    fn module_compiles() {
        assert!(true, "{} handler module loaded", module_path!());
    }
}
