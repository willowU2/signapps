//! Employee search and listing-by-org-node handlers.

use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use uuid::Uuid;

use crate::AppState;
use signapps_common::{Claims, TenantContext};

use super::types::{Employee, EmployeeQueryParams, SearchQueryParams};

/// List employees by org node (including descendants)
#[utoipa::path(
    get,
    path = "/api/v1/workforce/employees/by-node/{node_id}",
    params(("node_id" = uuid::Uuid, Path, description = "Organization node ID")),
    responses(
        (status = 200, description = "Employees in the org node subtree"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Employees"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn list_by_org_node(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(node_id): Path<Uuid>,
    Query(params): Query<EmployeeQueryParams>,
) -> Result<impl IntoResponse, StatusCode> {
    let include_terminated = params.include_terminated.unwrap_or(false);

    let employees: Vec<Employee> = if include_terminated {
        sqlx::query_as(
            r#"
            SELECT e.* FROM workforce_employees e
            INNER JOIN workforce_org_closure c ON c.descendant_id = e.org_node_id
            WHERE c.ancestor_id = $1 AND e.tenant_id = $2
            ORDER BY e.last_name, e.first_name
            "#,
        )
        .bind(node_id)
        .bind(ctx.tenant_id)
        .fetch_all(&*state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to list employees by node: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
    } else {
        sqlx::query_as(
            r#"
            SELECT e.* FROM workforce_employees e
            INNER JOIN workforce_org_closure c ON c.descendant_id = e.org_node_id
            WHERE c.ancestor_id = $1 AND e.tenant_id = $2 AND e.status != 'terminated'
            ORDER BY e.last_name, e.first_name
            "#,
        )
        .bind(node_id)
        .bind(ctx.tenant_id)
        .fetch_all(&*state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to list employees by node: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
    };

    Ok(Json(employees))
}

/// Search employees by name or employee number
#[utoipa::path(
    get,
    path = "/api/v1/workforce/employees/search",
    responses(
        (status = 200, description = "Matching employees"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Employees"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn search_employees(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Query(params): Query<SearchQueryParams>,
) -> Result<impl IntoResponse, StatusCode> {
    let limit = params.limit.unwrap_or(20);
    let search_term = format!("%{}%", params.q.to_lowercase());

    let employees: Vec<Employee> = sqlx::query_as(
        r#"
        SELECT * FROM workforce_employees
        WHERE tenant_id = $1
        AND status != 'terminated'
        AND (
            LOWER(first_name) LIKE $2
            OR LOWER(last_name) LIKE $2
            OR LOWER(CONCAT(first_name, ' ', last_name)) LIKE $2
            OR LOWER(employee_number) LIKE $2
            OR LOWER(email) LIKE $2
        )
        ORDER BY last_name, first_name
        LIMIT $3
        "#,
    )
    .bind(ctx.tenant_id)
    .bind(&search_term)
    .bind(limit)
    .fetch_all(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to search employees: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(employees))
}
