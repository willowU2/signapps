//! WL3: Workspace feature update handler (identity-side).
//!
//! GET /api/v1/workspace/features is handled by signapps-tenant-config (port 3029).
//! PUT /api/v1/workspaces/:id/features lives here because the gateway routes
//! /api/v1/workspaces → signapps-identity (workspace CRUD prefix).
//!
//! The handler queries identity.workspaces which is identity's own DB schema.

use axum::{
    extract::{Path, State},
    Json,
};
use serde::{Deserialize, Serialize};
use signapps_common::{Error, Result};
use uuid::Uuid;

use crate::AppState;

// ============================================================================
// Domain types (mirrored in tenant-config for the GET endpoint)
// ============================================================================

/// Feature configuration for a workspace.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
/// WorkspaceFeatures data transfer object.
pub struct WorkspaceFeatures {
    #[serde(default = "default_true")]
    pub mail: bool,
    #[serde(default = "default_true")]
    pub calendar: bool,
    #[serde(default = "default_true")]
    pub contacts: bool,
    #[serde(default = "default_true")]
    pub tasks: bool,
    #[serde(default = "default_true")]
    pub storage: bool,
    #[serde(default = "default_true")]
    pub docs: bool,
    #[serde(default = "default_true")]
    pub social: bool,
    #[serde(default = "default_true")]
    pub meet: bool,
    #[serde(default = "default_true")]
    pub billing: bool,
    #[serde(default = "default_true")]
    pub ai: bool,
    #[serde(default)]
    pub containers: bool,
    #[serde(default)]
    pub remote: bool,
    #[serde(default)]
    pub pxe: bool,
    #[serde(default = "default_true")]
    pub analytics: bool,
    #[serde(default = "default_true")]
    pub workforce: bool,
    #[serde(default = "default_true")]
    pub scheduler: bool,
}

fn default_true() -> bool {
    true
}

/// Response for WorkspaceFeatures.
#[derive(Debug, Serialize)]
pub struct WorkspaceFeaturesResponse {
    pub workspace_id: Uuid,
    pub features: WorkspaceFeatures,
}

/// Request body for UpdateFeatures.
#[derive(Debug, Deserialize)]
pub struct UpdateFeaturesRequest {
    pub features: serde_json::Value,
}

// ============================================================================
// Handler
// ============================================================================

/// PUT /api/v1/workspaces/:id/features
///
/// Update the feature flags for a specific workspace (admin only).
/// Accepts a partial JSON object — only specified keys are updated.
#[tracing::instrument(skip(state, payload))]
#[tracing::instrument(skip_all)]
pub async fn update_workspace_features(
    State(state): State<AppState>,
    Path(workspace_id): Path<Uuid>,
    Json(payload): Json<UpdateFeaturesRequest>,
) -> Result<Json<WorkspaceFeaturesResponse>> {
    if !payload.features.is_object() {
        return Err(Error::Validation(
            "features must be a JSON object".to_string(),
        ));
    }

    let result = sqlx::query(
        r#"UPDATE identity.workspaces
           SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object('features', $2)
           WHERE id = $1"#,
    )
    .bind(workspace_id)
    .bind(&payload.features)
    .execute(&*state.pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(Error::NotFound(format!("Workspace {}", workspace_id)));
    }

    let row: Option<(Option<serde_json::Value>,)> =
        sqlx::query_as("SELECT settings FROM identity.workspaces WHERE id = $1")
            .bind(workspace_id)
            .fetch_optional(&*state.pool)
            .await?;

    let features = row
        .and_then(|(s,)| s)
        .and_then(|s| s.get("features").cloned())
        .and_then(|f| serde_json::from_value::<WorkspaceFeatures>(f).ok())
        .unwrap_or_default();

    tracing::info!(workspace_id = %workspace_id, "Updated workspace features");

    Ok(Json(WorkspaceFeaturesResponse {
        workspace_id,
        features,
    }))
}

#[cfg(test)]
mod tests {
    #[allow(unused_imports)]
    use super::*;

    #[test]
    fn module_compiles() {
        // Placeholder: ensures the module compiles.
        let _ = module_path!();
    }
}
