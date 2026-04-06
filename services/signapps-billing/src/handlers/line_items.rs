//! Invoice line item handlers — AQ-BILLDB.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::{AppState, LineItem};

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

/// Request payload for CreateLineItem operation.
#[derive(Debug, Deserialize)]
pub struct CreateLineItemRequest {
    pub description: String,
    pub quantity: Option<i32>,
    pub unit_price_cents: i32,
    pub sort_order: Option<i32>,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// List all line items for a given invoice.
pub async fn list_line_items(
    State(state): State<AppState>,
    Path(invoice_id): Path<Uuid>,
) -> Result<Json<Vec<LineItem>>, (StatusCode, String)> {
    let items = sqlx::query_as::<_, LineItem>(
        "SELECT * FROM billing.line_items WHERE invoice_id = $1 ORDER BY sort_order, created_at",
    )
    .bind(invoice_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(items))
}

/// Add a line item to an invoice.
pub async fn create_line_item(
    State(state): State<AppState>,
    Path(invoice_id): Path<Uuid>,
    Json(payload): Json<CreateLineItemRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let qty = payload.quantity.unwrap_or(1);
    let total = qty * payload.unit_price_cents;
    let item = sqlx::query_as::<_, LineItem>(
        r#"INSERT INTO billing.line_items (invoice_id, description, quantity, unit_price_cents, total_cents, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING *"#,
    )
    .bind(invoice_id)
    .bind(&payload.description)
    .bind(qty)
    .bind(payload.unit_price_cents)
    .bind(total)
    .bind(payload.sort_order.unwrap_or(0))
    .fetch_one(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok((StatusCode::CREATED, Json(item)))
}

/// Remove a line item from an invoice.
/// Scoped to ensure the line item belongs to the specified invoice.
pub async fn delete_line_item(
    State(state): State<AppState>,
    Path((invoice_id, item_id)): Path<(Uuid, Uuid)>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let r = sqlx::query("DELETE FROM billing.line_items WHERE id = $1 AND invoice_id = $2")
        .bind(item_id)
        .bind(invoice_id)
        .execute(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    if r.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Line item not found".to_string()));
    }
    Ok(StatusCode::NO_CONTENT)
}
