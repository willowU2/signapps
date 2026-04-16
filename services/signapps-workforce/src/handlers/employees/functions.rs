//! Employee function-definition and per-employee functions handlers.

use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::Utc;
use uuid::Uuid;
use validator::Validate;

use crate::AppState;
use signapps_common::{Claims, TenantContext};

use super::types::{
    CreateFunctionDefinitionRequest, Employee, FunctionDefinition, UpdateFunctionDefinitionRequest,
    UpdateFunctionsRequest,
};

/// Get employee functions
#[utoipa::path(
    get,
    path = "/api/v1/workforce/employees/{id}/functions",
    params(("id" = uuid::Uuid, Path, description = "Employee ID")),
    responses(
        (status = 200, description = "Employee function definitions"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Employee not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Employees"
)]
#[tracing::instrument(skip_all)]
pub async fn get_functions(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let employee: super::types::Employee =
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
#[utoipa::path(
    put,
    path = "/api/v1/workforce/employees/{id}/functions",
    params(("id" = uuid::Uuid, Path, description = "Employee ID")),
    request_body = UpdateFunctionsRequest,
    responses(
        (status = 200, description = "Employee functions updated", body = Employee),
        (status = 400, description = "Invalid input"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Employee not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Employees"
)]
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

/// List all function definitions
#[utoipa::path(
    get,
    path = "/api/v1/workforce/functions",
    responses(
        (status = 200, description = "List of function definitions"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Functions"
)]
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
#[utoipa::path(
    post,
    path = "/api/v1/workforce/functions",
    request_body = CreateFunctionDefinitionRequest,
    responses(
        (status = 201, description = "Function definition created", body = FunctionDefinition),
        (status = 400, description = "Invalid input"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Functions"
)]
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
#[utoipa::path(
    put,
    path = "/api/v1/workforce/functions/{id}",
    params(("id" = uuid::Uuid, Path, description = "Function definition ID")),
    request_body = UpdateFunctionDefinitionRequest,
    responses(
        (status = 200, description = "Function definition updated", body = FunctionDefinition),
        (status = 400, description = "Invalid input"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Function definition not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Functions"
)]
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
#[utoipa::path(
    delete,
    path = "/api/v1/workforce/functions/{id}",
    params(("id" = uuid::Uuid, Path, description = "Function definition ID")),
    responses(
        (status = 204, description = "Function definition deleted"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Function definition not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Functions"
)]
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
