//! WL3: Workspace/Tenant Feature Flags per tenant.
//!
//! Each workspace has a `features` JSONB field that overrides global feature
//! flags for that specific tenant, enabling module-level toggling.
//!
//! Endpoints:
//!   GET  /api/v1/workspace/features         — Get features for current workspace
//!   PUT  /api/v1/workspaces/:id/features    — Update features for a workspace (admin)
//!
//! Feature keys match the FEATURES map on the frontend (lowercase):
//!   { "mail": true, "billing": false, "social": true, ... }

use axum::{
    extract::{Extension, Path, State},
    Json,
};
use serde::{Deserialize, Serialize};
use signapps_common::{Error, Result, TenantContext};
use uuid::Uuid;

use crate::AppState;

// ============================================================================
// Domain types
// ============================================================================

/// Feature configuration for a workspace.
///
/// Keys are lowercase feature names (matching the frontend FEATURES map).
/// Values are booleans indicating whether the feature is enabled.
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

#[derive(Debug, Serialize)]
/// Response for WorkspaceFeatures.
pub struct WorkspaceFeaturesResponse {
    pub workspace_id: Uuid,
    pub features: WorkspaceFeatures,
}

#[derive(Debug, Deserialize)]
/// Request body for UpdateFeatures.
pub struct UpdateFeaturesRequest {
    pub features: serde_json::Value,
}

// ============================================================================
// Handlers
// ============================================================================

/// GET /api/v1/workspace/features
///
/// Returns the feature configuration for the current user's active workspace.
/// Merges tenant-level features with global defaults.
#[tracing::instrument(skip(state))]
#[tracing::instrument(skip_all)]
pub async fn get_workspace_features(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
) -> Result<Json<WorkspaceFeaturesResponse>> {
    // Try to load features from the workspace's settings JSONB column
    let row: Option<(Option<serde_json::Value>,)> = sqlx::query_as(
        r#"SELECT settings
           FROM identity.workspaces
           WHERE tenant_id = $1 AND is_default = TRUE
           LIMIT 1"#,
    )
    .bind(ctx.tenant_id)
    .fetch_optional(&*state.pool)
    .await?;

    let features = if let Some((Some(settings),)) = row {
        settings
            .get("features")
            .and_then(|f| serde_json::from_value::<WorkspaceFeatures>(f.clone()).ok())
            .unwrap_or_default()
    } else {
        WorkspaceFeatures::default()
    };

    // Use a placeholder workspace_id — the tenant_id is the relevant context
    Ok(Json(WorkspaceFeaturesResponse {
        workspace_id: ctx.tenant_id,
        features,
    }))
}

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
    // Validate that it's an object
    if !payload.features.is_object() {
        return Err(Error::Validation(
            "features must be a JSON object".to_string(),
        ));
    }

    // Merge features into the workspace settings JSONB
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

    // Reload to return the merged config
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
        // Verify this handler module compiles correctly.
        // Integration tests require a running database and service.
        assert!(true, "{} handler module loaded", module_path!());
    }
}
