//! Spreadsheet persistence endpoints — cell formats and sheet metadata.
//!
//! Routes:
//! - `GET    /api/v1/sheets/:doc_id/formats`           — list cell formats
//! - `PUT    /api/v1/sheets/:doc_id/formats/:cell_ref`  — upsert cell format
//! - `DELETE /api/v1/sheets/:doc_id/formats/:cell_ref`  — delete cell format
//! - `POST   /api/v1/sheets/:doc_id/formats/batch`      — batch upsert
//! - `GET    /api/v1/sheets/:doc_id/metadata`           — get sheet metadata
//! - `PUT    /api/v1/sheets/:doc_id/metadata`           — upsert sheet metadata

use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::AppState;
use signapps_common::Claims;
use signapps_db::models::{CellFormat, SheetMetadata, UpsertCellFormat, UpsertSheetMetadata};
use signapps_db::repositories::CellFormatRepository;

// ============================================================================
// Query parameters
// ============================================================================

/// Query parameters for sheet-scoped endpoints.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct SheetQuery {
    /// Sheet index (0-based). Defaults to 0.
    #[serde(default)]
    pub sheet: i32,
}

// ============================================================================
// Request bodies
// ============================================================================

/// Request body for upserting a single cell format via the PUT endpoint.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct UpsertFormatRequest {
    /// Optional reference to a shared style definition.
    pub style_id: Option<Uuid>,
    /// Inline format overrides.
    pub format_override: Option<serde_json::Value>,
    /// Conditional formatting rules.
    pub conditional_rules: Option<serde_json::Value>,
}

/// Request body for batch-upserting cell formats.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct BatchUpsertRequest {
    /// List of cell formats to upsert.
    pub formats: Vec<UpsertCellFormat>,
}

/// Request body for upserting sheet metadata.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct UpsertMetadataRequest {
    /// Display name of the sheet tab.
    pub sheet_name: Option<String>,
    /// Number of frozen rows at the top.
    pub frozen_rows: Option<i32>,
    /// Number of frozen columns on the left.
    pub frozen_cols: Option<i32>,
    /// Column width overrides.
    pub col_widths: Option<serde_json::Value>,
    /// Row height overrides.
    pub row_heights: Option<serde_json::Value>,
    /// Sort configuration.
    pub sort_config: Option<serde_json::Value>,
    /// Filter configuration.
    pub filter_config: Option<serde_json::Value>,
}

// ============================================================================
// Handlers
// ============================================================================

/// GET /api/v1/sheets/:doc_id/formats — list cell formats for a sheet
#[utoipa::path(
    get,
    path = "/api/v1/sheets/{doc_id}/formats",
    params(
        ("doc_id" = Uuid, Path, description = "Document ID"),
        SheetQuery,
    ),
    responses(
        (status = 200, description = "List of cell formats", body = Vec<CellFormat>),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Sheet Formats"
)]
#[tracing::instrument(skip_all, fields(doc_id = %doc_id, sheet = %query.sheet))]
pub async fn list_formats(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(doc_id): Path<Uuid>,
    Query(query): Query<SheetQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let formats = CellFormatRepository::get_formats(state.pool.inner(), doc_id, query.sheet)
        .await
        .map_err(|e| {
            tracing::error!(?e, "Failed to list cell formats");
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(serde_json::json!({ "data": formats })))
}

/// PUT /api/v1/sheets/:doc_id/formats/:cell_ref — upsert a cell format
#[utoipa::path(
    put,
    path = "/api/v1/sheets/{doc_id}/formats/{cell_ref}",
    params(
        ("doc_id" = Uuid, Path, description = "Document ID"),
        ("cell_ref" = String, Path, description = "Cell reference (e.g. A1, B5)"),
        SheetQuery,
    ),
    request_body = UpsertFormatRequest,
    responses(
        (status = 200, description = "Cell format upserted", body = CellFormat),
        (status = 400, description = "Bad request"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Sheet Formats"
)]
#[tracing::instrument(skip_all, fields(doc_id = %doc_id, cell_ref = %cell_ref))]
pub async fn upsert_format(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path((doc_id, cell_ref)): Path<(Uuid, String)>,
    Query(query): Query<SheetQuery>,
    Json(payload): Json<UpsertFormatRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    if cell_ref.trim().is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let input = UpsertCellFormat {
        cell_ref,
        style_id: payload.style_id,
        format_override: payload.format_override,
        conditional_rules: payload.conditional_rules,
    };

    let format =
        CellFormatRepository::upsert_format(state.pool.inner(), doc_id, query.sheet, input)
            .await
            .map_err(|e| {
                tracing::error!(?e, "Failed to upsert cell format");
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

    Ok(Json(serde_json::json!({ "data": format })))
}

/// DELETE /api/v1/sheets/:doc_id/formats/:cell_ref — delete a cell format
#[utoipa::path(
    delete,
    path = "/api/v1/sheets/{doc_id}/formats/{cell_ref}",
    params(
        ("doc_id" = Uuid, Path, description = "Document ID"),
        ("cell_ref" = String, Path, description = "Cell reference (e.g. A1, B5)"),
        SheetQuery,
    ),
    responses(
        (status = 204, description = "Cell format deleted"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Cell format not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Sheet Formats"
)]
#[tracing::instrument(skip_all, fields(doc_id = %doc_id, cell_ref = %cell_ref))]
pub async fn delete_format(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path((doc_id, cell_ref)): Path<(Uuid, String)>,
    Query(query): Query<SheetQuery>,
) -> Result<StatusCode, StatusCode> {
    CellFormatRepository::delete_format(state.pool.inner(), doc_id, query.sheet, &cell_ref)
        .await
        .map_err(|e| {
            tracing::error!(?e, "Failed to delete cell format");
            match e {
                signapps_common::Error::NotFound(_) => StatusCode::NOT_FOUND,
                _ => StatusCode::INTERNAL_SERVER_ERROR,
            }
        })?;

    Ok(StatusCode::NO_CONTENT)
}

/// POST /api/v1/sheets/:doc_id/formats/batch — batch upsert cell formats
#[utoipa::path(
    post,
    path = "/api/v1/sheets/{doc_id}/formats/batch",
    params(
        ("doc_id" = Uuid, Path, description = "Document ID"),
        SheetQuery,
    ),
    request_body = BatchUpsertRequest,
    responses(
        (status = 200, description = "Batch upsert results", body = Vec<CellFormat>),
        (status = 400, description = "Bad request"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Sheet Formats"
)]
#[tracing::instrument(skip_all, fields(doc_id = %doc_id, count = payload.formats.len()))]
pub async fn batch_upsert_formats(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(doc_id): Path<Uuid>,
    Query(query): Query<SheetQuery>,
    Json(payload): Json<BatchUpsertRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    if payload.formats.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let mut results = Vec::with_capacity(payload.formats.len());
    for input in payload.formats {
        let format =
            CellFormatRepository::upsert_format(state.pool.inner(), doc_id, query.sheet, input)
                .await
                .map_err(|e| {
                    tracing::error!(?e, "Failed to batch upsert cell format");
                    StatusCode::INTERNAL_SERVER_ERROR
                })?;
        results.push(format);
    }

    Ok(Json(serde_json::json!({ "data": results })))
}

/// GET /api/v1/sheets/:doc_id/metadata — get sheet metadata
#[utoipa::path(
    get,
    path = "/api/v1/sheets/{doc_id}/metadata",
    params(
        ("doc_id" = Uuid, Path, description = "Document ID"),
        SheetQuery,
    ),
    responses(
        (status = 200, description = "Sheet metadata", body = SheetMetadata),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Sheet Formats"
)]
#[tracing::instrument(skip_all, fields(doc_id = %doc_id, sheet = %query.sheet))]
pub async fn get_metadata(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(doc_id): Path<Uuid>,
    Query(query): Query<SheetQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let metadata =
        CellFormatRepository::get_sheet_metadata(state.pool.inner(), doc_id, query.sheet)
            .await
            .map_err(|e| {
                tracing::error!(?e, "Failed to get sheet metadata");
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

    Ok(Json(serde_json::json!({ "data": metadata })))
}

/// PUT /api/v1/sheets/:doc_id/metadata — upsert sheet metadata
#[utoipa::path(
    put,
    path = "/api/v1/sheets/{doc_id}/metadata",
    params(
        ("doc_id" = Uuid, Path, description = "Document ID"),
        SheetQuery,
    ),
    request_body = UpsertMetadataRequest,
    responses(
        (status = 200, description = "Sheet metadata upserted", body = SheetMetadata),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Sheet Formats"
)]
#[tracing::instrument(skip_all, fields(doc_id = %doc_id, sheet = %query.sheet))]
pub async fn upsert_metadata(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(doc_id): Path<Uuid>,
    Query(query): Query<SheetQuery>,
    Json(payload): Json<UpsertMetadataRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let input = UpsertSheetMetadata {
        sheet_name: payload.sheet_name,
        frozen_rows: payload.frozen_rows,
        frozen_cols: payload.frozen_cols,
        col_widths: payload.col_widths,
        row_heights: payload.row_heights,
        sort_config: payload.sort_config,
        filter_config: payload.filter_config,
    };

    let metadata =
        CellFormatRepository::upsert_sheet_metadata(state.pool.inner(), doc_id, query.sheet, input)
            .await
            .map_err(|e| {
                tracing::error!(?e, "Failed to upsert sheet metadata");
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

    Ok(Json(serde_json::json!({ "data": metadata })))
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
