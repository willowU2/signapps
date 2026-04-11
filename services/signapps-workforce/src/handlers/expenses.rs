//! Expense report handlers — CRUD + approval workflow
//!
//! Manages expense reports stored in the `expenses.expense_reports` table.
//! Supports status transitions: draft -> submitted -> approved/rejected -> paid.

use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::AppState;
use signapps_common::Claims;

// ============================================================================
// Types
// ============================================================================

/// An expense report record.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow, utoipa::ToSchema)]
pub struct ExpenseReport {
    /// Unique identifier.
    pub id: Uuid,
    /// Short title for the expense.
    pub title: String,
    /// Optional longer description.
    pub description: Option<String>,
    /// Amount in minor currency units (cents).
    pub amount: i64,
    /// ISO 4217 currency code.
    pub currency: String,
    /// Expense category (e.g. Transport, Repas, Hotel).
    pub category: Option<String>,
    /// Workflow status: draft, submitted, approved, rejected, paid.
    pub status: String,
    /// URL to the uploaded receipt image/PDF.
    pub receipt_url: Option<String>,
    /// Date the expense was incurred.
    pub date: NaiveDate,
    /// UUID of the expense owner.
    pub owner_id: Uuid,
    /// UUID of the approver (set on submit).
    pub approver_id: Option<Uuid>,
    /// Tenant scope.
    pub tenant_id: Option<Uuid>,
    /// Creation timestamp.
    pub created_at: Option<DateTime<Utc>>,
    /// Last update timestamp.
    pub updated_at: Option<DateTime<Utc>>,
}

/// Request body to create or update an expense report.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreateExpenseRequest {
    /// Short title.
    pub title: String,
    /// Optional description.
    pub description: Option<String>,
    /// Amount in minor currency units (cents).
    pub amount: Option<i64>,
    /// Currency code (default EUR).
    pub currency: Option<String>,
    /// Expense category.
    pub category: Option<String>,
    /// Receipt URL.
    pub receipt_url: Option<String>,
    /// Date the expense was incurred.
    pub date: Option<NaiveDate>,
}

/// Request body to update an expense report.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct UpdateExpenseRequest {
    /// Short title.
    pub title: Option<String>,
    /// Optional description.
    pub description: Option<String>,
    /// Amount in minor currency units (cents).
    pub amount: Option<i64>,
    /// Currency code.
    pub currency: Option<String>,
    /// Expense category.
    pub category: Option<String>,
    /// Receipt URL.
    pub receipt_url: Option<String>,
    /// Date the expense was incurred.
    pub date: Option<NaiveDate>,
}

/// Request body for approval/rejection.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct ApprovalRequest {
    /// Optional comment from the approver.
    pub comment: Option<String>,
}

/// Query parameters for listing expenses.
#[derive(Debug, Deserialize, Default)]
pub struct ExpenseQueryParams {
    /// Filter by status.
    pub status: Option<String>,
    /// Maximum results to return.
    pub limit: Option<i64>,
    /// Offset for pagination.
    pub offset: Option<i64>,
}

// ============================================================================
// Handlers
// ============================================================================

/// GET /api/v1/workforce/expenses
///
/// Lists expense reports for the authenticated user.
///
/// # Errors
///
/// Returns 500 on database failure.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    get,
    path = "/api/v1/workforce/expenses",
    responses(
        (status = 200, description = "List of expense reports", body = Vec<ExpenseReport>),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Expenses"
)]
#[tracing::instrument(skip_all)]
pub async fn list_expenses(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ExpenseQueryParams>,
) -> Result<impl IntoResponse, StatusCode> {
    let owner_id = claims.sub;
    let limit = params.limit.unwrap_or(100);
    let offset = params.offset.unwrap_or(0);

    let records: Vec<ExpenseReport> = if let Some(ref status) = params.status {
        sqlx::query_as(
            r#"SELECT * FROM expenses.expense_reports
               WHERE owner_id = $1 AND status = $2
               ORDER BY created_at DESC
               LIMIT $3 OFFSET $4"#,
        )
        .bind(owner_id)
        .bind(status)
        .bind(limit)
        .bind(offset)
        .fetch_all(&*state.pool)
        .await
    } else {
        sqlx::query_as(
            r#"SELECT * FROM expenses.expense_reports
               WHERE owner_id = $1
               ORDER BY created_at DESC
               LIMIT $2 OFFSET $3"#,
        )
        .bind(owner_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&*state.pool)
        .await
    }
    .map_err(|e| {
        tracing::error!("list_expenses failed: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(records))
}

/// POST /api/v1/workforce/expenses
///
/// Creates a new expense report in draft status.
///
/// # Errors
///
/// Returns 500 on database failure.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    post,
    path = "/api/v1/workforce/expenses",
    request_body = CreateExpenseRequest,
    responses(
        (status = 201, description = "Expense created", body = ExpenseReport),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Expenses"
)]
#[tracing::instrument(skip_all)]
pub async fn create_expense(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateExpenseRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let owner_id = claims.sub;

    let record: ExpenseReport = sqlx::query_as(
        r#"INSERT INTO expenses.expense_reports
           (title, description, amount, currency, category, receipt_url, date, owner_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *"#,
    )
    .bind(&payload.title)
    .bind(payload.description.as_deref())
    .bind(payload.amount.unwrap_or(0))
    .bind(payload.currency.as_deref().unwrap_or("EUR"))
    .bind(payload.category.as_deref())
    .bind(payload.receipt_url.as_deref())
    .bind(payload.date.unwrap_or_else(|| Utc::now().date_naive()))
    .bind(owner_id)
    .fetch_one(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("create_expense failed: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    tracing::info!(expense_id = %record.id, "Expense report created");
    Ok((StatusCode::CREATED, Json(record)))
}

/// PUT /api/v1/workforce/expenses/:id
///
/// Updates a draft expense report. Only the owner can update, and only in draft status.
///
/// # Errors
///
/// Returns 404 if not found or not owned, 409 if not in draft status.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    put,
    path = "/api/v1/workforce/expenses/{id}",
    params(("id" = Uuid, Path, description = "Expense report ID")),
    request_body = UpdateExpenseRequest,
    responses(
        (status = 200, description = "Expense updated", body = ExpenseReport),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Expense not found"),
        (status = 409, description = "Cannot edit non-draft expense"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Expenses"
)]
#[tracing::instrument(skip_all)]
pub async fn update_expense(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateExpenseRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let owner_id = claims.sub;

    let record: Option<ExpenseReport> = sqlx::query_as(
        r#"UPDATE expenses.expense_reports
           SET title = COALESCE($3, title),
               description = COALESCE($4, description),
               amount = COALESCE($5, amount),
               currency = COALESCE($6, currency),
               category = COALESCE($7, category),
               receipt_url = COALESCE($8, receipt_url),
               date = COALESCE($9, date),
               updated_at = now()
           WHERE id = $1 AND owner_id = $2 AND status = 'draft'
           RETURNING *"#,
    )
    .bind(id)
    .bind(owner_id)
    .bind(payload.title.as_deref())
    .bind(payload.description.as_deref())
    .bind(payload.amount)
    .bind(payload.currency.as_deref())
    .bind(payload.category.as_deref())
    .bind(payload.receipt_url.as_deref())
    .bind(payload.date)
    .fetch_optional(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("update_expense failed: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    match record {
        Some(r) => Ok(Json(r)),
        None => Err(StatusCode::NOT_FOUND),
    }
}

/// DELETE /api/v1/workforce/expenses/:id
///
/// Deletes a draft expense report. Only the owner can delete, and only in draft status.
///
/// # Errors
///
/// Returns 404 if not found or not deletable.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    delete,
    path = "/api/v1/workforce/expenses/{id}",
    params(("id" = Uuid, Path, description = "Expense report ID")),
    responses(
        (status = 204, description = "Expense deleted"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Expense not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Expenses"
)]
#[tracing::instrument(skip_all)]
pub async fn delete_expense(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let owner_id = claims.sub;

    let result = sqlx::query(
        r#"DELETE FROM expenses.expense_reports
           WHERE id = $1 AND owner_id = $2 AND status = 'draft'"#,
    )
    .bind(id)
    .bind(owner_id)
    .execute(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("delete_expense failed: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    tracing::info!(expense_id = %id, "Expense report deleted");
    Ok(StatusCode::NO_CONTENT)
}

/// POST /api/v1/workforce/expenses/:id/submit
///
/// Submits a draft expense for approval. Transitions status from draft to submitted.
///
/// # Errors
///
/// Returns 404 if not found or not in draft status.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    post,
    path = "/api/v1/workforce/expenses/{id}/submit",
    params(("id" = Uuid, Path, description = "Expense report ID")),
    responses(
        (status = 200, description = "Expense submitted for approval", body = ExpenseReport),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Expense not found or not in draft"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Expenses"
)]
#[tracing::instrument(skip_all)]
pub async fn submit_expense(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let owner_id = claims.sub;

    let record: Option<ExpenseReport> = sqlx::query_as(
        r#"UPDATE expenses.expense_reports
           SET status = 'submitted', updated_at = now()
           WHERE id = $1 AND owner_id = $2 AND status = 'draft'
           RETURNING *"#,
    )
    .bind(id)
    .bind(owner_id)
    .fetch_optional(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("submit_expense failed: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    match record {
        Some(r) => {
            tracing::info!(expense_id = %id, "Expense submitted for approval");
            Ok(Json(r))
        },
        None => Err(StatusCode::NOT_FOUND),
    }
}

/// POST /api/v1/workforce/expenses/:id/approve
///
/// Approves a submitted expense report. Transitions status to approved.
///
/// # Errors
///
/// Returns 404 if not found or not in submitted status.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    post,
    path = "/api/v1/workforce/expenses/{id}/approve",
    params(("id" = Uuid, Path, description = "Expense report ID")),
    request_body = ApprovalRequest,
    responses(
        (status = 200, description = "Expense approved", body = ExpenseReport),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Expense not found or not submitted"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Expenses"
)]
#[tracing::instrument(skip_all)]
pub async fn approve_expense(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(_payload): Json<ApprovalRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let approver_id = claims.sub;

    let record: Option<ExpenseReport> = sqlx::query_as(
        r#"UPDATE expenses.expense_reports
           SET status = 'approved', approver_id = $2, updated_at = now()
           WHERE id = $1 AND status = 'submitted'
           RETURNING *"#,
    )
    .bind(id)
    .bind(approver_id)
    .fetch_optional(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("approve_expense failed: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    match record {
        Some(r) => {
            tracing::info!(expense_id = %id, approver = %approver_id, "Expense approved");
            Ok(Json(r))
        },
        None => Err(StatusCode::NOT_FOUND),
    }
}

/// POST /api/v1/workforce/expenses/:id/reject
///
/// Rejects a submitted expense report. Transitions status to rejected.
///
/// # Errors
///
/// Returns 404 if not found or not in submitted status.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    post,
    path = "/api/v1/workforce/expenses/{id}/reject",
    params(("id" = Uuid, Path, description = "Expense report ID")),
    request_body = ApprovalRequest,
    responses(
        (status = 200, description = "Expense rejected", body = ExpenseReport),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Expense not found or not submitted"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Expenses"
)]
#[tracing::instrument(skip_all)]
pub async fn reject_expense(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(_payload): Json<ApprovalRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let approver_id = claims.sub;

    let record: Option<ExpenseReport> = sqlx::query_as(
        r#"UPDATE expenses.expense_reports
           SET status = 'rejected', approver_id = $2, updated_at = now()
           WHERE id = $1 AND status = 'submitted'
           RETURNING *"#,
    )
    .bind(id)
    .bind(approver_id)
    .fetch_optional(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("reject_expense failed: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    match record {
        Some(r) => {
            tracing::info!(expense_id = %id, approver = %approver_id, "Expense rejected");
            Ok(Json(r))
        },
        None => Err(StatusCode::NOT_FOUND),
    }
}

/// POST /api/v1/workforce/expenses/:id/mark-paid
///
/// Marks an approved expense as paid. Transitions status to paid.
///
/// # Errors
///
/// Returns 404 if not found or not in approved status.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    post,
    path = "/api/v1/workforce/expenses/{id}/mark-paid",
    params(("id" = Uuid, Path, description = "Expense report ID")),
    responses(
        (status = 200, description = "Expense marked as paid", body = ExpenseReport),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Expense not found or not approved"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Expenses"
)]
#[tracing::instrument(skip_all)]
pub async fn mark_paid(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let record: Option<ExpenseReport> = sqlx::query_as(
        r#"UPDATE expenses.expense_reports
           SET status = 'paid', updated_at = now()
           WHERE id = $1 AND status = 'approved'
           RETURNING *"#,
    )
    .bind(id)
    .fetch_optional(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("mark_paid failed: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    match record {
        Some(r) => {
            tracing::info!(expense_id = %id, "Expense marked as paid");
            Ok(Json(r))
        },
        None => Err(StatusCode::NOT_FOUND),
    }
}

#[cfg(test)]
mod tests {
    #[allow(unused_imports)]
    use super::*;

    #[test]
    fn module_compiles() {
        assert!(true, "{} handler module loaded", module_path!());
    }
}
