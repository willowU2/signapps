//! Employee CRUD handlers.

use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::Utc;
use serde_json::json;
use uuid::Uuid;
use validator::Validate;

use crate::AppState;
use signapps_common::{Claims, TenantContext};

use super::types::{
    CreateEmployeeRequest, Employee, EmployeeQueryParams, EmployeeWithDetails,
    UpdateEmployeeRequest,
};

/// List all employees
#[utoipa::path(
    get,
    path = "/api/v1/workforce/employees",
    responses(
        (status = 200, description = "List of employees"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Employees"
)]
#[tracing::instrument(skip_all)]
pub async fn list_employees(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Query(params): Query<EmployeeQueryParams>,
) -> Result<impl IntoResponse, StatusCode> {
    let include_terminated = params.include_terminated.unwrap_or(false);
    let limit = params.limit.unwrap_or(100);
    let offset = params.offset.unwrap_or(0);

    let employees: Vec<Employee> = if include_terminated {
        sqlx::query_as(
            r#"
            SELECT * FROM workforce_employees
            WHERE tenant_id = $1
            ORDER BY last_name, first_name
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(ctx.tenant_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&*state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to list employees: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
    } else {
        sqlx::query_as(
            r#"
            SELECT * FROM workforce_employees
            WHERE tenant_id = $1 AND status != 'terminated'
            ORDER BY last_name, first_name
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(ctx.tenant_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&*state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to list employees: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
    };

    Ok(Json(employees))
}

/// Create a new employee
#[utoipa::path(
    post,
    path = "/api/v1/workforce/employees",
    request_body = CreateEmployeeRequest,
    responses(
        (status = 201, description = "Employee created", body = Employee),
        (status = 400, description = "Invalid input"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Organization node not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Employees"
)]
#[tracing::instrument(skip_all)]
pub async fn create_employee(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Json(req): Json<CreateEmployeeRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    req.validate().map_err(|e| {
        tracing::warn!("Validation error: {}", e);
        StatusCode::BAD_REQUEST
    })?;

    // Resolve org_node_id: use provided value or fall back to (creating) a default root node
    let org_node_id = if let Some(node_id) = req.org_node_id {
        // Verify org node exists
        let node_exists: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM workforce_org_nodes WHERE id = $1 AND tenant_id = $2)",
        )
        .bind(node_id)
        .bind(ctx.tenant_id)
        .fetch_one(&*state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to check org node: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

        if !node_exists {
            return Err(StatusCode::NOT_FOUND);
        }
        node_id
    } else {
        // Get or create a default root org node for this tenant
        let maybe_root: Option<Uuid> = sqlx::query_scalar(
            "SELECT id FROM workforce_org_nodes WHERE tenant_id = $1 AND parent_id IS NULL ORDER BY created_at LIMIT 1",
        )
        .bind(ctx.tenant_id)
        .fetch_optional(&*state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to find default org node: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

        match maybe_root {
            Some(root_id) => root_id,
            None => {
                // Create a default root org node
                let root_id = Uuid::new_v4();
                sqlx::query(
                    r#"INSERT INTO workforce_org_nodes (id, tenant_id, parent_id, name, node_type, sort_order, created_at, updated_at)
                       VALUES ($1, $2, NULL, 'Organisation', 'root', 0, NOW(), NOW())"#,
                )
                .bind(root_id)
                .bind(ctx.tenant_id)
                .execute(&*state.pool)
                .await
                .map_err(|e| {
                    tracing::error!("Failed to create default org node: {}", e);
                    StatusCode::INTERNAL_SERVER_ERROR
                })?;
                tracing::info!(tenant_id = %ctx.tenant_id, node_id = %root_id, "Created default root org node");
                root_id
            },
        }
    };

    let id = Uuid::new_v4();
    let now = Utc::now();

    let functions_json = serde_json::to_value(req.functions.unwrap_or_default()).map_err(|e| {
        tracing::error!("Failed to serialize functions: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let employee: Employee = sqlx::query_as(
        r#"
        INSERT INTO workforce_employees (
            id, tenant_id, user_id, org_node_id, employee_number,
            first_name, last_name, email, phone, functions,
            contract_type, fte_ratio, hire_date, status, metadata,
            created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'active', $14, $15, $15)
        RETURNING *
        "#,
    )
    .bind(id)
    .bind(ctx.tenant_id)
    .bind(req.user_id)
    .bind(org_node_id)
    .bind(&req.employee_number)
    .bind(&req.first_name)
    .bind(&req.last_name)
    .bind(&req.email)
    .bind(&req.phone)
    .bind(functions_json)
    .bind(req.contract_type.as_deref().unwrap_or("full-time"))
    .bind(req.fte_ratio.unwrap_or(1.0))
    .bind(req.hire_date)
    .bind(req.metadata.unwrap_or(json!({})))
    .bind(now)
    .fetch_one(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to create employee: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok((StatusCode::CREATED, Json(employee)))
}

/// Get a single employee
#[utoipa::path(
    get,
    path = "/api/v1/workforce/employees/{id}",
    params(("id" = uuid::Uuid, Path, description = "Employee ID")),
    responses(
        (status = 200, description = "Employee found", body = Employee),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Employee not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Employees"
)]
#[tracing::instrument(skip_all)]
pub async fn get_employee(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let employee: Employee =
        sqlx::query_as("SELECT * FROM workforce_employees WHERE id = $1 AND tenant_id = $2")
            .bind(id)
            .bind(ctx.tenant_id)
            .fetch_optional(&*state.pool)
            .await
            .map_err(|e| {
                tracing::error!("Failed to get employee: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?
            .ok_or(StatusCode::NOT_FOUND)?;

    // Get org node name
    let org_node_name: Option<String> =
        sqlx::query_scalar("SELECT name FROM workforce_org_nodes WHERE id = $1")
            .bind(employee.org_node_id)
            .fetch_optional(&*state.pool)
            .await
            .map_err(|e| {
                tracing::error!("Failed to get org node: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

    // Get org node path (ancestors)
    let org_node_path: Vec<String> = sqlx::query_scalar(
        r#"
        SELECT n.name FROM workforce_org_nodes n
        INNER JOIN workforce_org_closure c ON c.ancestor_id = n.id
        WHERE c.descendant_id = $1
        ORDER BY c.depth DESC
        "#,
    )
    .bind(employee.org_node_id)
    .fetch_all(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to get org path: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Get function names
    let function_codes: Vec<String> =
        serde_json::from_value(employee.functions.clone()).unwrap_or_default();

    let function_names: Vec<String> = if !function_codes.is_empty() {
        sqlx::query_scalar(
            r#"
            SELECT name FROM workforce_function_definitions
            WHERE tenant_id = $1 AND code = ANY($2)
            ORDER BY sort_order
            "#,
        )
        .bind(ctx.tenant_id)
        .bind(&function_codes)
        .fetch_all(&*state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get function names: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
    } else {
        vec![]
    };

    Ok(Json(EmployeeWithDetails {
        employee,
        org_node_name,
        org_node_path,
        function_names,
    }))
}

/// Update an employee
#[utoipa::path(
    put,
    path = "/api/v1/workforce/employees/{id}",
    params(("id" = uuid::Uuid, Path, description = "Employee ID")),
    request_body = UpdateEmployeeRequest,
    responses(
        (status = 200, description = "Employee updated", body = Employee),
        (status = 400, description = "Invalid input"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Employee not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Employees"
)]
#[tracing::instrument(skip_all)]
pub async fn update_employee(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateEmployeeRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    req.validate().map_err(|e| {
        tracing::warn!("Validation error: {}", e);
        StatusCode::BAD_REQUEST
    })?;

    let now = Utc::now();

    let employee: Employee = sqlx::query_as(
        r#"
        UPDATE workforce_employees
        SET
            org_node_id = COALESCE($3, org_node_id),
            employee_number = COALESCE($4, employee_number),
            first_name = COALESCE($5, first_name),
            last_name = COALESCE($6, last_name),
            email = COALESCE($7, email),
            phone = COALESCE($8, phone),
            contract_type = COALESCE($9, contract_type),
            fte_ratio = COALESCE($10, fte_ratio),
            hire_date = COALESCE($11, hire_date),
            termination_date = COALESCE($12, termination_date),
            status = COALESCE($13, status),
            metadata = COALESCE($14, metadata),
            updated_at = $15
        WHERE id = $1 AND tenant_id = $2
        RETURNING *
        "#,
    )
    .bind(id)
    .bind(ctx.tenant_id)
    .bind(req.org_node_id)
    .bind(&req.employee_number)
    .bind(&req.first_name)
    .bind(&req.last_name)
    .bind(&req.email)
    .bind(&req.phone)
    .bind(&req.contract_type)
    .bind(req.fte_ratio)
    .bind(req.hire_date)
    .bind(req.termination_date)
    .bind(&req.status)
    .bind(&req.metadata)
    .bind(now)
    .fetch_optional(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to update employee: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(employee))
}

/// Delete an employee (soft delete by setting status to terminated)
#[utoipa::path(
    delete,
    path = "/api/v1/workforce/employees/{id}",
    params(("id" = uuid::Uuid, Path, description = "Employee ID")),
    responses(
        (status = 204, description = "Employee terminated"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Employee not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Employees"
)]
#[tracing::instrument(skip_all)]
pub async fn delete_employee(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let now = Utc::now();

    let result = sqlx::query(
        r#"
        UPDATE workforce_employees
        SET status = 'terminated', termination_date = $3, updated_at = $4
        WHERE id = $1 AND tenant_id = $2
        "#,
    )
    .bind(id)
    .bind(ctx.tenant_id)
    .bind(now.date_naive())
    .bind(now)
    .execute(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to delete employee: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(StatusCode::NO_CONTENT)
}
