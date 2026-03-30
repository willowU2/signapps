//! Supply Chain endpoints — purchase orders, warehouses, inventory
//!
//! All data is stored as JSONB in `platform.supply_chain_data` using
//! an `entity_type` discriminant column to separate entity kinds.

use crate::AppState;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use signapps_common::{Error, Result};
use uuid::Uuid;

// ── Shared row ────────────────────────────────────────────────────────────────

#[derive(sqlx::FromRow)]
struct ScRow {
    id: Uuid,
    entity_type: String,
    data: Value,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

// ── Generic record DTO ────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
/// Generic supply-chain record returned to the client.
pub struct ScRecord {
    pub id: Uuid,
    pub entity_type: String,
    pub data: Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<ScRow> for ScRecord {
    fn from(r: ScRow) -> Self {
        ScRecord {
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
/// Query params for list endpoints.
pub struct ListQuery {
    pub status: Option<String>,
}

// ── DB helpers ────────────────────────────────────────────────────────────────

async fn ensure_table(pool: &signapps_db::DatabasePool) -> Result<()> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS platform.supply_chain_data (
            id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            entity_type  VARCHAR(64) NOT NULL,
            data         JSONB       NOT NULL DEFAULT '{}',
            created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        "#,
    )
    .execute(pool.inner())
    .await
    .map_err(|e| Error::Internal(format!("ensure sc table: {}", e)))?;
    Ok(())
}

async fn insert_row(
    pool: &signapps_db::DatabasePool,
    entity_type: &str,
    data: &Value,
) -> Result<ScRow> {
    if let Err(e) = ensure_table(pool).await {
        tracing::warn!("supply_chain_data ensure failed: {}", e);
    }
    let row: ScRow = sqlx::query_as(
        r#"
        INSERT INTO platform.supply_chain_data (entity_type, data)
        VALUES ($1, $2)
        RETURNING *
        "#,
    )
    .bind(entity_type)
    .bind(data)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| Error::Internal(format!("sc insert: {}", e)))?;
    Ok(row)
}

async fn list_rows(pool: &signapps_db::DatabasePool, entity_type: &str) -> Result<Vec<ScRow>> {
    if let Err(e) = ensure_table(pool).await {
        tracing::warn!("supply_chain_data ensure failed: {}", e);
    }
    let rows: Vec<ScRow> = sqlx::query_as(
        "SELECT * FROM platform.supply_chain_data WHERE entity_type = $1 ORDER BY created_at DESC",
    )
    .bind(entity_type)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| Error::Internal(format!("sc list: {}", e)))?;
    Ok(rows)
}

async fn get_row(pool: &signapps_db::DatabasePool, id: Uuid) -> Result<Option<ScRow>> {
    if let Err(e) = ensure_table(pool).await {
        tracing::warn!("supply_chain_data ensure failed: {}", e);
    }
    let row: Option<ScRow> =
        sqlx::query_as("SELECT * FROM platform.supply_chain_data WHERE id = $1")
            .bind(id)
            .fetch_optional(pool.inner())
            .await
            .map_err(|e| Error::Internal(format!("sc get: {}", e)))?;
    Ok(row)
}

async fn patch_row(pool: &signapps_db::DatabasePool, id: Uuid, patch: &Value) -> Result<ScRow> {
    if let Err(e) = ensure_table(pool).await {
        tracing::warn!("supply_chain_data ensure failed: {}", e);
    }
    let row: ScRow = sqlx::query_as(
        r#"
        UPDATE platform.supply_chain_data
           SET data = data || $2, updated_at = NOW()
         WHERE id = $1
        RETURNING *
        "#,
    )
    .bind(id)
    .bind(patch)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| Error::Internal(format!("sc patch: {}", e)))?;
    Ok(row)
}

async fn delete_row(pool: &signapps_db::DatabasePool, id: Uuid) -> Result<()> {
    if let Err(e) = ensure_table(pool).await {
        tracing::warn!("supply_chain_data ensure failed: {}", e);
    }
    sqlx::query("DELETE FROM platform.supply_chain_data WHERE id = $1")
        .bind(id)
        .execute(pool.inner())
        .await
        .map_err(|e| Error::Internal(format!("sc delete: {}", e)))?;
    Ok(())
}

// ── Purchase Orders ───────────────────────────────────────────────────────────

/// `GET /api/v1/supply-chain/purchase-orders` — list all POs (optional ?status= filter).
#[tracing::instrument(skip_all)]
pub async fn list_purchase_orders(
    State(state): State<AppState>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<ScRecord>>> {
    let rows = list_rows(&state.pool, "purchase_order").await?;
    let records: Vec<ScRecord> = rows
        .into_iter()
        .filter(|r| {
            q.status.as_ref().map_or(true, |s| {
                r.data
                    .get("status")
                    .and_then(|v| v.as_str())
                    .map_or(false, |st| st == s)
            })
        })
        .map(ScRecord::from)
        .collect();
    Ok(Json(records))
}

/// `POST /api/v1/supply-chain/purchase-orders` — create a new PO.
#[tracing::instrument(skip_all)]
pub async fn create_purchase_order(
    State(state): State<AppState>,
    Json(body): Json<Value>,
) -> Result<(StatusCode, Json<ScRecord>)> {
    let row = insert_row(&state.pool, "purchase_order", &body).await?;
    Ok((StatusCode::CREATED, Json(row.into())))
}

/// `GET /api/v1/supply-chain/purchase-orders/:id` — get one PO.
#[tracing::instrument(skip_all)]
pub async fn get_purchase_order(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ScRecord>> {
    let row = get_row(&state.pool, id)
        .await?
        .ok_or_else(|| Error::NotFound("purchase order not found".into()))?;
    Ok(Json(row.into()))
}

/// `PATCH /api/v1/supply-chain/purchase-orders/:id` — partial update.
#[tracing::instrument(skip_all)]
pub async fn patch_purchase_order(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<Value>,
) -> Result<Json<ScRecord>> {
    let row = patch_row(&state.pool, id, &body).await?;
    Ok(Json(row.into()))
}

/// `DELETE /api/v1/supply-chain/purchase-orders/:id` — delete a PO.
#[tracing::instrument(skip_all)]
pub async fn delete_purchase_order(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    delete_row(&state.pool, id).await?;
    Ok(StatusCode::NO_CONTENT)
}

// ── Warehouses ────────────────────────────────────────────────────────────────

/// `GET /api/v1/supply-chain/warehouses` — list all warehouse zones.
#[tracing::instrument(skip_all)]
pub async fn list_warehouses(State(state): State<AppState>) -> Result<Json<Vec<ScRecord>>> {
    let rows = list_rows(&state.pool, "warehouse").await?;
    Ok(Json(rows.into_iter().map(ScRecord::from).collect()))
}

/// `POST /api/v1/supply-chain/warehouses` — create a warehouse zone.
#[tracing::instrument(skip_all)]
pub async fn create_warehouse(
    State(state): State<AppState>,
    Json(body): Json<Value>,
) -> Result<(StatusCode, Json<ScRecord>)> {
    let row = insert_row(&state.pool, "warehouse", &body).await?;
    Ok((StatusCode::CREATED, Json(row.into())))
}

// ── Inventory ─────────────────────────────────────────────────────────────────

/// `GET /api/v1/supply-chain/inventory` — list all inventory items.
#[tracing::instrument(skip_all)]
pub async fn list_inventory(State(state): State<AppState>) -> Result<Json<Vec<ScRecord>>> {
    let rows = list_rows(&state.pool, "inventory_item").await?;
    Ok(Json(rows.into_iter().map(ScRecord::from).collect()))
}

#[cfg(test)]
mod tests {
    #[test]
    fn module_compiles() {
        assert!(true, "{} handler module loaded", module_path!());
    }
}
