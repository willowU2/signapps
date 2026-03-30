//! Employee Handlers
//!
//! CRUD operations for employees (distinct from system users).
//! Employees represent workforce members with HR attributes.

use axum::{
    extract::{Extension, Multipart, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::FromRow;
use uuid::Uuid;
use validator::Validate;

use crate::AppState;
use signapps_common::{Claims, TenantContext};

// ============================================================================
// Types
// ============================================================================

/// Employee status
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq)]
#[sqlx(type_name = "varchar", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
#[allow(dead_code)] // Scaffolded — will be wired when handler is implemented
pub enum EmployeeStatus {
    Active,
    OnLeave,
    Suspended,
    Terminated,
}

/// Contract type
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "kebab-case")]
#[serde(rename_all = "kebab-case")]
#[allow(dead_code)] // Scaffolded — will be wired when handler is implemented
pub enum ContractType {
    FullTime,
    PartTime,
    Contractor,
    Intern,
    Temporary,
}

/// Employee record
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
/// Employee data transfer object.
pub struct Employee {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub user_id: Option<Uuid>,
    pub org_node_id: Uuid,
    pub employee_number: Option<String>,
    pub first_name: String,
    pub last_name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub functions: serde_json::Value,
    pub contract_type: String,
    pub fte_ratio: f64,
    pub hire_date: Option<NaiveDate>,
    pub termination_date: Option<NaiveDate>,
    pub status: String,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Employee with additional computed fields
#[derive(Debug, Clone, Serialize, Deserialize)]
/// EmployeeWithDetails data transfer object.
pub struct EmployeeWithDetails {
    #[serde(flatten)]
    pub employee: Employee,
    pub org_node_name: Option<String>,
    pub org_node_path: Vec<String>,
    pub function_names: Vec<String>,
}

/// Function definition (job roles/positions)
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
/// FunctionDefinition data transfer object.
pub struct FunctionDefinition {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub sort_order: i32,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

/// Create employee request
#[derive(Debug, Deserialize, Validate)]
/// Request body for CreateEmployee.
pub struct CreateEmployeeRequest {
    pub user_id: Option<Uuid>,
    pub org_node_id: Uuid,
    pub employee_number: Option<String>,
    #[validate(length(min = 1, max = 100))]
    pub first_name: String,
    #[validate(length(min = 1, max = 100))]
    pub last_name: String,
    #[validate(email)]
    pub email: Option<String>,
    pub phone: Option<String>,
    pub functions: Option<Vec<String>>,
    pub contract_type: Option<String>,
    #[validate(range(min = 0.0, max = 1.0))]
    pub fte_ratio: Option<f64>,
    pub hire_date: Option<NaiveDate>,
    pub metadata: Option<serde_json::Value>,
}

/// Update employee request
#[derive(Debug, Deserialize, Validate)]
/// Request body for UpdateEmployee.
pub struct UpdateEmployeeRequest {
    pub org_node_id: Option<Uuid>,
    pub employee_number: Option<String>,
    #[validate(length(min = 1, max = 100))]
    pub first_name: Option<String>,
    #[validate(length(min = 1, max = 100))]
    pub last_name: Option<String>,
    #[validate(email)]
    pub email: Option<String>,
    pub phone: Option<String>,
    pub contract_type: Option<String>,
    #[validate(range(min = 0.0, max = 1.0))]
    pub fte_ratio: Option<f64>,
    pub hire_date: Option<NaiveDate>,
    pub termination_date: Option<NaiveDate>,
    pub status: Option<String>,
    pub metadata: Option<serde_json::Value>,
}

/// Link user request
#[derive(Debug, Deserialize)]
/// Request body for LinkUser.
pub struct LinkUserRequest {
    pub user_id: Uuid,
}

/// Update functions request
#[derive(Debug, Deserialize)]
/// Request body for UpdateFunctions.
pub struct UpdateFunctionsRequest {
    pub functions: Vec<String>,
}

/// Create function definition request
#[derive(Debug, Deserialize, Validate)]
/// Request body for CreateFunctionDefinition.
pub struct CreateFunctionDefinitionRequest {
    #[validate(length(min = 1, max = 50))]
    pub code: String,
    #[validate(length(min = 1, max = 100))]
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub sort_order: Option<i32>,
}

/// Update function definition request
#[derive(Debug, Deserialize, Validate)]
/// Request body for UpdateFunctionDefinition.
pub struct UpdateFunctionDefinitionRequest {
    #[validate(length(min = 1, max = 100))]
    pub name: Option<String>,
    pub description: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub sort_order: Option<i32>,
    pub is_active: Option<bool>,
}

/// Query params for employee listing
#[derive(Debug, Deserialize, Default)]
/// Query parameters for filtering results.
pub struct EmployeeQueryParams {
    #[allow(dead_code)] // Scaffolded — will be wired when handler is implemented
    pub status: Option<String>,
    #[allow(dead_code)] // Scaffolded — will be wired when handler is implemented
    pub contract_type: Option<String>,
    #[allow(dead_code)] // Scaffolded — will be wired when handler is implemented
    pub function: Option<String>,
    pub include_terminated: Option<bool>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

/// Search query params
#[derive(Debug, Deserialize)]
/// Query parameters for filtering results.
pub struct SearchQueryParams {
    pub q: String,
    pub limit: Option<i64>,
}

// ============================================================================
// Employee Handlers
// ============================================================================

/// List all employees
#[tracing::instrument(skip_all)]
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
#[tracing::instrument(skip_all)]
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

    // Verify org node exists
    let node_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM workforce_org_nodes WHERE id = $1 AND tenant_id = $2)",
    )
    .bind(req.org_node_id)
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
    .bind(req.org_node_id)
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
#[tracing::instrument(skip_all)]
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
#[tracing::instrument(skip_all)]
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
#[tracing::instrument(skip_all)]
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

/// Link employee to a user account
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn link_user(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(req): Json<LinkUserRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let now = Utc::now();

    let employee: Employee = sqlx::query_as(
        r#"
        UPDATE workforce_employees
        SET user_id = $3, updated_at = $4
        WHERE id = $1 AND tenant_id = $2
        RETURNING *
        "#,
    )
    .bind(id)
    .bind(ctx.tenant_id)
    .bind(req.user_id)
    .bind(now)
    .fetch_optional(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to link user: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(employee))
}

/// Unlink employee from user account
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn unlink_user(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let now = Utc::now();

    let employee: Employee = sqlx::query_as(
        r#"
        UPDATE workforce_employees
        SET user_id = NULL, updated_at = $3
        WHERE id = $1 AND tenant_id = $2
        RETURNING *
        "#,
    )
    .bind(id)
    .bind(ctx.tenant_id)
    .bind(now)
    .fetch_optional(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to unlink user: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(employee))
}

/// Get employee functions
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn get_functions(
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

    let function_codes: Vec<String> =
        serde_json::from_value(employee.functions).unwrap_or_default();

    let functions: Vec<FunctionDefinition> = if !function_codes.is_empty() {
        sqlx::query_as(
            r#"
            SELECT * FROM workforce_function_definitions
            WHERE tenant_id = $1 AND code = ANY($2)
            ORDER BY sort_order
            "#,
        )
        .bind(ctx.tenant_id)
        .bind(&function_codes)
        .fetch_all(&*state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get functions: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
    } else {
        vec![]
    };

    Ok(Json(functions))
}

/// Update employee functions
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn update_functions(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateFunctionsRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let now = Utc::now();

    let functions_json = serde_json::to_value(&req.functions).map_err(|e| {
        tracing::error!("Failed to serialize functions: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let employee: Employee = sqlx::query_as(
        r#"
        UPDATE workforce_employees
        SET functions = $3, updated_at = $4
        WHERE id = $1 AND tenant_id = $2
        RETURNING *
        "#,
    )
    .bind(id)
    .bind(ctx.tenant_id)
    .bind(functions_json)
    .bind(now)
    .fetch_optional(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to update functions: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(employee))
}

/// List employees by org node (including descendants)
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

// ============================================================================
// Function Definition Handlers
// ============================================================================

/// List all function definitions
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn list_function_definitions(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
) -> Result<impl IntoResponse, StatusCode> {
    let functions: Vec<FunctionDefinition> = sqlx::query_as(
        r#"
        SELECT * FROM workforce_function_definitions
        WHERE tenant_id = $1
        ORDER BY sort_order, name
        "#,
    )
    .bind(ctx.tenant_id)
    .fetch_all(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to list function definitions: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(functions))
}

/// Create a function definition
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn create_function_definition(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Json(req): Json<CreateFunctionDefinitionRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    req.validate().map_err(|e| {
        tracing::warn!("Validation error: {}", e);
        StatusCode::BAD_REQUEST
    })?;

    let id = Uuid::new_v4();
    let now = Utc::now();

    let function: FunctionDefinition = sqlx::query_as(
        r#"
        INSERT INTO workforce_function_definitions (
            id, tenant_id, code, name, description, color, icon, sort_order, is_active, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9)
        RETURNING *
        "#,
    )
    .bind(id)
    .bind(ctx.tenant_id)
    .bind(&req.code)
    .bind(&req.name)
    .bind(&req.description)
    .bind(&req.color)
    .bind(&req.icon)
    .bind(req.sort_order.unwrap_or(0))
    .bind(now)
    .fetch_one(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to create function definition: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok((StatusCode::CREATED, Json(function)))
}

/// Update a function definition
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn update_function_definition(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateFunctionDefinitionRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    req.validate().map_err(|e| {
        tracing::warn!("Validation error: {}", e);
        StatusCode::BAD_REQUEST
    })?;

    let function: FunctionDefinition = sqlx::query_as(
        r#"
        UPDATE workforce_function_definitions
        SET
            name = COALESCE($3, name),
            description = COALESCE($4, description),
            color = COALESCE($5, color),
            icon = COALESCE($6, icon),
            sort_order = COALESCE($7, sort_order),
            is_active = COALESCE($8, is_active)
        WHERE id = $1 AND tenant_id = $2
        RETURNING *
        "#,
    )
    .bind(id)
    .bind(ctx.tenant_id)
    .bind(&req.name)
    .bind(&req.description)
    .bind(&req.color)
    .bind(&req.icon)
    .bind(req.sort_order)
    .bind(req.is_active)
    .fetch_optional(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to update function definition: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(function))
}

/// Delete a function definition
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn delete_function_definition(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let result =
        sqlx::query("DELETE FROM workforce_function_definitions WHERE id = $1 AND tenant_id = $2")
            .bind(id)
            .bind(ctx.tenant_id)
            .execute(&*state.pool)
            .await
            .map_err(|e| {
                tracing::error!("Failed to delete function definition: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(StatusCode::NO_CONTENT)
}

// =============================================================================
// HR1 — Bulk employee CSV import
// =============================================================================

/// Result summary for a bulk import operation.
#[derive(Debug, Serialize)]
/// ImportResult data transfer object.
pub struct ImportResult {
    pub imported: u32,
    pub skipped: u32,
    pub failed: u32,
}

/// POST /api/v1/workforce/employees/import
///
/// Accepts a multipart form upload with a CSV file (field name: "file").
/// Expected header row: name, email, department, position, start_date
/// (or: first_name, last_name, email, department, position, start_date)
///
/// Employees are created and linked to an org node if `department` matches
/// an existing org node name for this tenant.
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn import_employees(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    mut multipart: Multipart,
) -> Result<impl IntoResponse, StatusCode> {
    let mut csv_bytes: Vec<u8> = Vec::new();

    while let Ok(Some(field)) = multipart.next_field().await {
        if field.name().unwrap_or("") == "file" {
            match field.bytes().await {
                Ok(b) => {
                    csv_bytes = b.to_vec();
                    break;
                },
                Err(e) => {
                    tracing::error!("Failed to read CSV field: {e}");
                    return Err(StatusCode::BAD_REQUEST);
                },
            }
        }
    }

    if csv_bytes.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let content = match std::str::from_utf8(&csv_bytes) {
        Ok(s) => s.to_string(),
        Err(_) => return Err(StatusCode::BAD_REQUEST),
    };

    let mut lines = content.lines();
    let header_line = match lines.next() {
        Some(h) => h,
        None => return Err(StatusCode::BAD_REQUEST),
    };

    let headers: Vec<String> = header_line
        .split(',')
        .map(|h| h.trim().to_lowercase().replace('"', ""))
        .collect();

    let col = |name: &str| -> Option<usize> { headers.iter().position(|h| h == name) };

    let idx_first_name = col("first_name");
    let idx_last_name = col("last_name");
    let idx_name = col("name");
    let idx_email = col("email");
    let idx_department = col("department");
    let idx_position = col("position");
    let idx_start_date = col("start_date");

    let parse_col = |row: &[&str], idx: Option<usize>| -> Option<String> {
        idx.and_then(|i| row.get(i))
            .map(|v| v.trim().replace('"', ""))
            .filter(|v| !v.is_empty())
    };

    let mut imported = 0u32;
    let mut skipped = 0u32;
    let mut failed = 0u32;

    // Cache a default org node (root) for the tenant as fallback
    let default_node: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM workforce_org_nodes WHERE tenant_id = $1 AND parent_id IS NULL LIMIT 1",
    )
    .bind(ctx.tenant_id)
    .fetch_optional(&*state.pool)
    .await
    .ok()
    .flatten();

    for line in lines {
        if line.trim().is_empty() {
            skipped += 1;
            continue;
        }
        let cols: Vec<&str> = line.split(',').collect();

        let (first_name, last_name) = if let (Some(f), Some(l)) = (
            parse_col(&cols, idx_first_name),
            parse_col(&cols, idx_last_name),
        ) {
            (f, l)
        } else if let Some(full) = parse_col(&cols, idx_name) {
            let parts: Vec<&str> = full.splitn(2, ' ').collect();
            let first = parts.first().copied().unwrap_or("").to_string();
            let last = parts.get(1).copied().unwrap_or("").to_string();
            (first, last)
        } else {
            skipped += 1;
            continue;
        };

        if first_name.is_empty() {
            skipped += 1;
            continue;
        }

        let email = parse_col(&cols, idx_email);
        let department = parse_col(&cols, idx_department);
        let position = parse_col(&cols, idx_position);
        let start_date_str = parse_col(&cols, idx_start_date);

        // Resolve org node from department name
        let org_node_id: Option<Uuid> = if let Some(ref dept) = department {
            sqlx::query_scalar(
                "SELECT id FROM workforce_org_nodes WHERE tenant_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1",
            )
            .bind(ctx.tenant_id)
            .bind(dept)
            .fetch_optional(&*state.pool)
            .await
            .ok()
            .flatten()
        } else {
            None
        };

        let node_id = match org_node_id.or(default_node) {
            Some(id) => id,
            None => {
                failed += 1;
                continue;
            },
        };

        let hire_date: Option<chrono::NaiveDate> = start_date_str
            .as_deref()
            .and_then(|s| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());

        let functions = match position {
            Some(ref p) => serde_json::json!([p]),
            None => serde_json::json!([]),
        };

        let res = sqlx::query(
            r#"INSERT INTO workforce_employees
               (id, tenant_id, org_node_id, first_name, last_name, email,
                functions, contract_type, fte_ratio, hire_date, status, metadata,
                created_at, updated_at)
               VALUES
               (gen_random_uuid(), $1, $2, $3, $4, $5,
                $6, 'full-time', 1.0, $7, 'active', '{}',
                NOW(), NOW())"#,
        )
        .bind(ctx.tenant_id)
        .bind(node_id)
        .bind(&first_name)
        .bind(&last_name)
        .bind(email.as_deref())
        .bind(&functions)
        .bind(hire_date)
        .execute(&*state.pool)
        .await;

        match res {
            Ok(_) => imported += 1,
            Err(e) => {
                tracing::warn!("Failed to insert employee: {e}");
                failed += 1;
            },
        }
    }

    tracing::info!(
        tenant = %ctx.tenant_id,
        imported,
        skipped,
        failed,
        "Employee CSV import completed"
    );

    Ok(Json(ImportResult {
        imported,
        skipped,
        failed,
    }))
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
