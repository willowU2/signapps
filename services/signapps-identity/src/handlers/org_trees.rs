//! Org tree handlers: list, create, full tree.

use crate::AppState;
use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use signapps_common::{Claims, Error, Result};
use signapps_db::models::core_org::{CreateOrgTree, OrgChartNode, OrgTree};
use signapps_db::repositories::{OrgNodeRepository, OrgTreeRepository};
use uuid::Uuid;

// ============================================================================
// Request DTOs
// ============================================================================

/// Request body for creating an org tree.
#[derive(Debug, Deserialize)]
pub struct CreateOrgTreeRequest {
    pub tree_type: String,
    pub name: String,
}

// ============================================================================
// Handlers
// ============================================================================

/// GET /api/v1/org/trees — List all org trees for the authenticated user's tenant.
#[tracing::instrument(skip_all)]
pub async fn list_trees(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<OrgTree>>> {
    let tenant_id = claims
        .tenant_id
        .ok_or_else(|| Error::Forbidden("No tenant context".into()))?;
    let trees = OrgTreeRepository::list_by_tenant(&state.pool, tenant_id).await?;
    Ok(Json(trees))
}

/// POST /api/v1/org/trees — Create a new org tree for the authenticated user's tenant.
#[tracing::instrument(skip_all)]
pub async fn create_tree(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateOrgTreeRequest>,
) -> Result<(StatusCode, Json<OrgTree>)> {
    let tenant_id = claims
        .tenant_id
        .ok_or_else(|| Error::Forbidden("No tenant context".into()))?;
    let input = CreateOrgTree {
        tenant_id,
        tree_type: payload.tree_type,
        name: payload.name,
    };
    let tree = OrgTreeRepository::create(&state.pool, input).await?;
    Ok((StatusCode::CREATED, Json(tree)))
}

/// GET /api/v1/org/trees/:id/full — Return the full nested tree for a given tree ID.
#[tracing::instrument(skip_all)]
pub async fn get_full_tree(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<OrgChartNode>>> {
    // Verify tree exists
    OrgTreeRepository::find_by_id(&state.pool, id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Org tree {id} not found")))?;
    let nodes = OrgNodeRepository::get_full_tree(&state.pool, id).await?;
    Ok(Json(nodes))
}
