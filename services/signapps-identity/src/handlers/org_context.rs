//! Org context handler: returns the calling user's org position, groups, and permissions.

use crate::middleware::org_context::{get_org_context, OrgContext};
use crate::AppState;
use axum::{extract::Extension, extract::State, Json};
use signapps_common::{Claims, Result};

/// GET /api/v1/org/context — Return the org context for the currently authenticated user.
///
/// Includes:
/// - linked person record (if any)
/// - all active org assignments with node details
/// - org auto-group UUIDs the user belongs to
/// - effective module permissions merged across all assigned positions
/// - highest `max_role` from any relevant permission profile
#[tracing::instrument(skip_all)]
pub async fn get_context(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<OrgContext>> {
    let ctx = get_org_context(&state.pool, claims.sub).await;
    Ok(Json(ctx))
}
