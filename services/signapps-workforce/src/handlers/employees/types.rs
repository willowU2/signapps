//! Shared types for the employees handler module.

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use validator::Validate;

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
#[derive(Debug, Clone, Serialize, Deserialize, FromRow, utoipa::ToSchema)]
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
#[derive(Debug, Clone, Serialize, Deserialize, FromRow, utoipa::ToSchema)]
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
#[derive(Debug, Deserialize, Validate, utoipa::ToSchema)]
/// Request body for CreateEmployee.
pub struct CreateEmployeeRequest {
    pub user_id: Option<Uuid>,
    pub org_node_id: Option<Uuid>,
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
#[derive(Debug, Deserialize, Validate, utoipa::ToSchema)]
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
#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request body for LinkUser.
pub struct LinkUserRequest {
    pub user_id: Uuid,
}

/// Update functions request
#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request body for UpdateFunctions.
pub struct UpdateFunctionsRequest {
    pub functions: Vec<String>,
}

/// Create function definition request
#[derive(Debug, Deserialize, Validate, utoipa::ToSchema)]
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
#[derive(Debug, Deserialize, Validate, utoipa::ToSchema)]
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

/// Result summary for a bulk import operation.
#[derive(Debug, Serialize, utoipa::ToSchema)]
/// ImportResult data transfer object.
pub struct ImportResult {
    pub imported: u32,
    pub skipped: u32,
    pub failed: u32,
}
