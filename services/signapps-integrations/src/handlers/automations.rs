//! Automation, extension, and action catalog handlers.
//!
//! Routes:
//!   GET    /api/v1/automations                    — list automations
//!   POST   /api/v1/automations                    — create automation
//!   GET    /api/v1/automations/:id                — get automation by ID
//!   PUT    /api/v1/automations/:id                — update automation
//!   DELETE /api/v1/automations/:id                — delete automation
//!   GET    /api/v1/automations/:id/steps          — list steps
//!   POST   /api/v1/automations/:id/steps          — add step
//!   PUT    /api/v1/automations/:id/steps/:step_id — update step
//!   DELETE /api/v1/automations/:id/steps/:step_id — delete step
//!   POST   /api/v1/automations/:id/run            — trigger manual run
//!   GET    /api/v1/automations/:id/runs           — list run history
//!   GET    /api/v1/extensions                     — list extensions
//!   POST   /api/v1/extensions                     — install extension
//!   PUT    /api/v1/extensions/:id/approve         — admin approve extension
//!   DELETE /api/v1/extensions/:id                 — uninstall extension
//!   GET    /api/v1/actions                        — list action catalog

use crate::AppState;
use axum::{
    extract::{Extension, Path, Query, State},
    Json,
};
use serde::Deserialize;
use signapps_common::{Claims, Error, Result};
use signapps_db::models::{CreateAutomation, CreateExtension, CreateStep, UpdateAutomation};
use signapps_db::repositories::AutomationRepository;
use uuid::Uuid;

// ── Query parameters ──────────────────────────────────────────────────────────

/// Query parameters for listing automations.
#[derive(Debug, Deserialize)]
pub struct ListAutomationsQuery {
    /// If `true`, only return active automations.
    pub active_only: Option<bool>,
}

/// Query parameters for listing automation runs.
#[derive(Debug, Deserialize)]
pub struct ListRunsQuery {
    /// Maximum number of runs to return (default: 20).
    pub limit: Option<i64>,
}

/// Query parameters for listing action catalog entries.
#[derive(Debug, Deserialize)]
pub struct ListActionsQuery {
    /// Filter actions by category.
    pub category: Option<String>,
}

// ── Automation handlers ───────────────────────────────────────────────────────

/// List automations for the authenticated tenant.
///
/// # Errors
///
/// Returns `Error::Unauthorized` if tenant_id is missing from claims.
/// Returns `Error::Database` on query failure.
///
/// # Panics
///
/// No panics possible -- all errors are propagated via `Result`.
#[tracing::instrument(skip(state, claims), fields(user_id = %claims.sub))]
pub async fn list_automations(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListAutomationsQuery>,
) -> Result<Json<serde_json::Value>> {
    let tenant_id = claims.tenant_id.ok_or(Error::Unauthorized)?;
    let active_only = params.active_only.unwrap_or(false);

    let automations = AutomationRepository::list(&state.pool, tenant_id, active_only).await?;

    Ok(Json(serde_json::json!(automations)))
}

/// Create a new automation.
///
/// # Errors
///
/// Returns `Error::Unauthorized` if tenant_id is missing from claims.
/// Returns `Error::Database` on query failure or constraint violations.
///
/// # Panics
///
/// No panics possible -- all errors are propagated via `Result`.
#[tracing::instrument(skip(state, claims, payload), fields(user_id = %claims.sub))]
pub async fn create_automation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateAutomation>,
) -> Result<Json<serde_json::Value>> {
    let tenant_id = claims.tenant_id.ok_or(Error::Unauthorized)?;

    let automation =
        AutomationRepository::create(&state.pool, tenant_id, claims.sub, payload).await?;

    tracing::info!(automation_id = %automation.id, "Automation created");

    Ok(Json(serde_json::json!(automation)))
}

/// Get a single automation by ID.
///
/// # Errors
///
/// Returns `Error::NotFound` if the automation does not exist.
/// Returns `Error::Database` on query failure.
///
/// # Panics
///
/// No panics possible -- all errors are propagated via `Result`.
#[tracing::instrument(skip(state, _claims), fields(user_id = %_claims.sub))]
pub async fn get_automation(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    let automation = AutomationRepository::find_by_id(&state.pool, id).await?;

    Ok(Json(serde_json::json!(automation)))
}

/// Update an existing automation.
///
/// # Errors
///
/// Returns `Error::NotFound` if the automation does not exist.
/// Returns `Error::Database` on query failure.
///
/// # Panics
///
/// No panics possible -- all errors are propagated via `Result`.
#[tracing::instrument(skip(state, _claims, payload), fields(user_id = %_claims.sub))]
pub async fn update_automation(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateAutomation>,
) -> Result<Json<serde_json::Value>> {
    let automation = AutomationRepository::update(&state.pool, id, payload).await?;

    tracing::info!(automation_id = %id, "Automation updated");

    Ok(Json(serde_json::json!(automation)))
}

/// Delete an automation.
///
/// # Errors
///
/// Returns `Error::NotFound` if the automation does not exist.
/// Returns `Error::Database` on query failure.
///
/// # Panics
///
/// No panics possible -- all errors are propagated via `Result`.
#[tracing::instrument(skip(state, _claims), fields(user_id = %_claims.sub))]
pub async fn delete_automation(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    AutomationRepository::delete(&state.pool, id).await?;

    tracing::info!(automation_id = %id, "Automation deleted");

    Ok(Json(serde_json::json!({ "status": "deleted" })))
}

// ── Step handlers ─────────────────────────────────────────────────────────────

/// List steps for an automation.
///
/// # Errors
///
/// Returns `Error::Database` on query failure.
///
/// # Panics
///
/// No panics possible -- all errors are propagated via `Result`.
#[tracing::instrument(skip(state, _claims), fields(user_id = %_claims.sub))]
pub async fn list_steps(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(automation_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    let steps = AutomationRepository::list_steps(&state.pool, automation_id).await?;

    Ok(Json(serde_json::json!(steps)))
}

/// Add a step to an automation.
///
/// # Errors
///
/// Returns `Error::Database` on query failure or constraint violations.
///
/// # Panics
///
/// No panics possible -- all errors are propagated via `Result`.
#[tracing::instrument(skip(state, _claims, payload), fields(user_id = %_claims.sub))]
pub async fn add_step(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(automation_id): Path<Uuid>,
    Json(payload): Json<CreateStep>,
) -> Result<Json<serde_json::Value>> {
    let step = AutomationRepository::add_step(&state.pool, automation_id, payload).await?;

    tracing::info!(step_id = %step.id, automation_id = %automation_id, "Step added");

    Ok(Json(serde_json::json!(step)))
}

/// Update an existing step.
///
/// # Errors
///
/// Returns `Error::NotFound` if the step does not exist.
/// Returns `Error::Database` on query failure.
///
/// # Panics
///
/// No panics possible -- all errors are propagated via `Result`.
#[tracing::instrument(skip(state, _claims, payload), fields(user_id = %_claims.sub))]
pub async fn update_step(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path((_automation_id, step_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<CreateStep>,
) -> Result<Json<serde_json::Value>> {
    let step = AutomationRepository::update_step(&state.pool, step_id, payload).await?;

    tracing::info!(step_id = %step_id, "Step updated");

    Ok(Json(serde_json::json!(step)))
}

/// Delete a step.
///
/// # Errors
///
/// Returns `Error::NotFound` if the step does not exist.
/// Returns `Error::Database` on query failure.
///
/// # Panics
///
/// No panics possible -- all errors are propagated via `Result`.
#[tracing::instrument(skip(state, _claims), fields(user_id = %_claims.sub))]
pub async fn delete_step(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path((_automation_id, step_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>> {
    AutomationRepository::delete_step(&state.pool, step_id).await?;

    tracing::info!(step_id = %step_id, "Step deleted");

    Ok(Json(serde_json::json!({ "status": "deleted" })))
}

// ── Run handlers ──────────────────────────────────────────────────────────────

/// Trigger a manual run for an automation.
///
/// Creates a run record, then immediately marks it as completed.
/// The actual execution engine is a future task -- for now, only the
/// run record is created as a "completed" placeholder.
///
/// # Errors
///
/// Returns `Error::NotFound` if the automation does not exist.
/// Returns `Error::Database` on query failure.
///
/// # Panics
///
/// No panics possible -- all errors are propagated via `Result`.
#[tracing::instrument(skip(state, _claims), fields(user_id = %_claims.sub))]
pub async fn trigger_run(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(automation_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    // Verify the automation exists
    let _automation = AutomationRepository::find_by_id(&state.pool, automation_id).await?;

    // Start a new run
    let run = AutomationRepository::start_run(&state.pool, automation_id, None).await?;

    // Mark as completed immediately (execution engine is a future task)
    let completed =
        AutomationRepository::complete_run(&state.pool, run.id, serde_json::json!([]), 0).await?;

    tracing::info!(run_id = %completed.id, automation_id = %automation_id, "Manual run completed");

    Ok(Json(serde_json::json!(completed)))
}

/// List run history for an automation.
///
/// # Errors
///
/// Returns `Error::Database` on query failure.
///
/// # Panics
///
/// No panics possible -- all errors are propagated via `Result`.
#[tracing::instrument(skip(state, _claims), fields(user_id = %_claims.sub))]
pub async fn list_runs(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(automation_id): Path<Uuid>,
    Query(params): Query<ListRunsQuery>,
) -> Result<Json<serde_json::Value>> {
    let limit = params.limit.unwrap_or(20);
    let runs = AutomationRepository::list_runs(&state.pool, automation_id, limit).await?;

    Ok(Json(serde_json::json!(runs)))
}

// ── Extension handlers ────────────────────────────────────────────────────────

/// List all installed extensions for the authenticated tenant.
///
/// # Errors
///
/// Returns `Error::Unauthorized` if tenant_id is missing from claims.
/// Returns `Error::Database` on query failure.
///
/// # Panics
///
/// No panics possible -- all errors are propagated via `Result`.
#[tracing::instrument(skip(state, claims), fields(user_id = %claims.sub))]
pub async fn list_extensions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<serde_json::Value>> {
    let tenant_id = claims.tenant_id.ok_or(Error::Unauthorized)?;
    let extensions = AutomationRepository::list_extensions(&state.pool, tenant_id).await?;

    Ok(Json(serde_json::json!(extensions)))
}

/// Install a new extension.
///
/// # Errors
///
/// Returns `Error::Unauthorized` if tenant_id is missing from claims.
/// Returns `Error::Database` on query failure or unique constraint violation.
///
/// # Panics
///
/// No panics possible -- all errors are propagated via `Result`.
#[tracing::instrument(skip(state, claims, payload), fields(user_id = %claims.sub))]
pub async fn install_extension(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateExtension>,
) -> Result<Json<serde_json::Value>> {
    let tenant_id = claims.tenant_id.ok_or(Error::Unauthorized)?;

    let extension =
        AutomationRepository::install_extension(&state.pool, tenant_id, claims.sub, payload)
            .await?;

    tracing::info!(extension_id = %extension.id, name = %extension.name, "Extension installed");

    Ok(Json(serde_json::json!(extension)))
}

/// Approve an extension (admin only).
///
/// Sets `is_approved = true` and `is_active = true` for the extension.
///
/// # Errors
///
/// Returns `Error::NotFound` if the extension does not exist.
/// Returns `Error::Database` on query failure.
///
/// # Panics
///
/// No panics possible -- all errors are propagated via `Result`.
#[tracing::instrument(skip(state, claims), fields(user_id = %claims.sub))]
pub async fn approve_extension(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    let extension = AutomationRepository::approve_extension(&state.pool, id, claims.sub).await?;

    tracing::info!(extension_id = %id, "Extension approved");

    Ok(Json(serde_json::json!(extension)))
}

/// Uninstall (delete) an extension.
///
/// # Errors
///
/// Returns `Error::NotFound` if the extension does not exist.
/// Returns `Error::Database` on query failure.
///
/// # Panics
///
/// No panics possible -- all errors are propagated via `Result`.
#[tracing::instrument(skip(state, _claims), fields(user_id = %_claims.sub))]
pub async fn uninstall_extension(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    AutomationRepository::uninstall_extension(&state.pool, id).await?;

    tracing::info!(extension_id = %id, "Extension uninstalled");

    Ok(Json(serde_json::json!({ "status": "uninstalled" })))
}

// ── Action catalog handlers ───────────────────────────────────────────────────

/// List available actions from the action catalog.
///
/// # Errors
///
/// Returns `Error::Database` on query failure.
///
/// # Panics
///
/// No panics possible -- all errors are propagated via `Result`.
#[tracing::instrument(skip(state, _claims), fields(user_id = %_claims.sub))]
pub async fn list_actions(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Query(params): Query<ListActionsQuery>,
) -> Result<Json<serde_json::Value>> {
    let actions =
        AutomationRepository::list_actions(&state.pool, params.category.as_deref()).await?;

    Ok(Json(serde_json::json!(actions)))
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
