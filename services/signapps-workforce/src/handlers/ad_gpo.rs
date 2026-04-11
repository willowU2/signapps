//! AD GPO resolution handlers.
//!
//! Provides endpoints for computing the effective policy at a given org node,
//! inspecting the full GPO inheritance chain, and toggling no-inherit flags.

use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use crate::AppState;
use signapps_common::{middleware::TenantContext, Claims};

// ─────────────────────────────────────────────────────────────────────────────
// Handler 1: effective_gpo
// ─────────────────────────────────────────────────────────────────────────────

/// Compute the effective GPO for an org node by merging policies from all three
/// levels (domain → OU → node), ordered by priority descending.
///
/// Policies at deeper levels (lower `depth` in `org_closure`) override ancestor
/// policies when `no_inherit = false`.
///
/// # Errors
///
/// - `404` if the node does not exist in the tenant.
/// - `500` on database failure.
///
/// # Panics
///
/// No panics — all errors propagated via `Result`.
#[utoipa::path(
    get,
    path = "/api/v1/workforce/ad/gpo/{node_id}",
    params(("node_id" = Uuid, Path, description = "Org node UUID")),
    responses(
        (status = 200, description = "Effective GPO for the node"),
        (status = 404, description = "Node not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "AD GPO"
)]
#[tracing::instrument(skip_all, fields(node_id = %node_id))]
pub async fn effective_gpo(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(node_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let pool = &state.pool;

    // Verify node belongs to this tenant
    verify_node_tenant(pool, node_id, ctx.tenant_id).await?;

    // Collect all policies from node + ancestors, respecting no_inherit flags.
    // Rows: (policy_id, policy_name, domain, settings, priority, depth, no_inherit)
    let rows: Vec<(Uuid, String, String, Option<serde_json::Value>, i32, i32, bool)> =
        sqlx::query_as(
            r#"
            SELECT p.id, p.name, p.domain, p.settings, p.priority, oc.depth, n.no_inherit
            FROM workforce_org_policies p
            JOIN workforce_org_nodes n ON n.id = p.node_id
            JOIN core.org_closure oc ON oc.ancestor_id = p.node_id
            WHERE oc.descendant_id = $1
            ORDER BY oc.depth ASC, p.priority DESC
            "#,
        )
        .bind(node_id)
        .fetch_all(&**pool)
        .await
        .map_err(|e| {
            tracing::error!(?e, "DB error fetching effective GPO");
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // Merge by domain+name: closest node (lowest depth) wins.
    // If a no_inherit node is encountered, stop inheriting from higher ancestors.
    let mut merged: std::collections::HashMap<String, serde_json::Value> =
        std::collections::HashMap::new();
    let mut blocked_at_depth: Option<i32> = None;

    for (id, name, domain, settings, priority, depth, no_inherit) in rows {
        if let Some(blocked) = blocked_at_depth {
            if depth > blocked {
                continue;
            }
        }
        let key = format!("{}/{}", domain, name);
        merged.entry(key).or_insert_with(|| {
            json!({
                "id": id,
                "name": name,
                "domain": domain,
                "settings": settings,
                "priority": priority,
                "source_depth": depth,
            })
        });
        if no_inherit && blocked_at_depth.is_none() {
            blocked_at_depth = Some(depth);
        }
    }

    let policies: Vec<_> = merged.into_values().collect();

    Ok(Json(json!({
        "node_id": node_id,
        "effective_policies": policies,
        "blocked_at_depth": blocked_at_depth,
    })))
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler 2: gpo_hierarchy
// ─────────────────────────────────────────────────────────────────────────────

/// Return the full GPO inheritance chain for an org node.
///
/// Returns a list of `{level, node_id, node_name, depth, no_inherit, policies}` from
/// the node itself up to the root.
///
/// # Errors
///
/// - `404` if the node does not exist in the tenant.
/// - `500` on database failure.
///
/// # Panics
///
/// No panics — all errors propagated via `Result`.
#[utoipa::path(
    get,
    path = "/api/v1/workforce/ad/gpo/hierarchy/{node_id}",
    params(("node_id" = Uuid, Path, description = "Org node UUID")),
    responses(
        (status = 200, description = "Full GPO inheritance chain"),
        (status = 404, description = "Node not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "AD GPO"
)]
#[tracing::instrument(skip_all, fields(node_id = %node_id))]
pub async fn gpo_hierarchy(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(node_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let pool = &state.pool;

    verify_node_tenant(pool, node_id, ctx.tenant_id).await?;

    // Get ancestor chain with node metadata
    let ancestors: Vec<(Uuid, String, i32, bool)> = sqlx::query_as(
        r#"
        SELECT n.id, n.name, oc.depth, n.no_inherit
        FROM core.org_closure oc
        JOIN workforce_org_nodes n ON n.id = oc.ancestor_id
        WHERE oc.descendant_id = $1
        ORDER BY oc.depth ASC
        "#,
    )
    .bind(node_id)
    .fetch_all(&**pool)
    .await
    .map_err(|e| {
        tracing::error!(?e, "DB error fetching ancestor chain");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let mut levels: Vec<serde_json::Value> = Vec::new();

    for (ancestor_id, ancestor_name, depth, no_inherit) in ancestors {
        let policies: Vec<(Uuid, String, String, Option<serde_json::Value>, i32)> =
            sqlx::query_as(
                r#"
                SELECT id, name, domain, settings, priority
                FROM workforce_org_policies
                WHERE node_id = $1
                ORDER BY priority DESC, name
                "#,
            )
            .bind(ancestor_id)
            .fetch_all(&**pool)
            .await
            .map_err(|e| {
                tracing::error!(?e, "DB error fetching policies for node");
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

        let policies_json: Vec<_> = policies
            .into_iter()
            .map(|(id, name, domain, settings, priority)| {
                json!({ "id": id, "name": name, "domain": domain, "settings": settings, "priority": priority })
            })
            .collect();

        levels.push(json!({
            "level": depth,
            "node_id": ancestor_id,
            "node_name": ancestor_name,
            "no_inherit": no_inherit,
            "policies": policies_json,
        }));
    }

    Ok(Json(json!({
        "node_id": node_id,
        "hierarchy": levels,
    })))
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler 3: toggle_no_inherit
// ─────────────────────────────────────────────────────────────────────────────

/// Toggle the `no_inherit` flag on an org node.
///
/// When `no_inherit = true`, policies from ancestor nodes are not inherited at
/// this node or its descendants.
///
/// # Errors
///
/// - `404` if the node does not exist in the tenant.
/// - `500` on database failure.
///
/// # Panics
///
/// No panics — all errors propagated via `Result`.
#[utoipa::path(
    put,
    path = "/api/v1/workforce/ad/gpo/no-inherit/{node_id}",
    params(("node_id" = Uuid, Path, description = "Org node UUID")),
    request_body(content = NoInheritBody, description = "no_inherit flag value"),
    responses(
        (status = 200, description = "no_inherit flag updated"),
        (status = 404, description = "Node not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "AD GPO"
)]
#[tracing::instrument(skip_all, fields(node_id = %node_id))]
pub async fn toggle_no_inherit(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(node_id): Path<Uuid>,
    Json(body): Json<NoInheritBody>,
) -> Result<impl IntoResponse, StatusCode> {
    let pool = &state.pool;

    verify_node_tenant(pool, node_id, ctx.tenant_id).await?;

    let rows_affected = sqlx::query(
        "UPDATE workforce_org_nodes SET no_inherit = $1, updated_at = NOW() WHERE id = $2",
    )
    .bind(body.no_inherit)
    .bind(node_id)
    .execute(&**pool)
    .await
    .map_err(|e| {
        tracing::error!(?e, "DB error updating no_inherit");
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .rows_affected();

    if rows_affected == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    tracing::info!(node_id = %node_id, no_inherit = body.no_inherit, "no_inherit flag updated");
    Ok(Json(json!({ "node_id": node_id, "no_inherit": body.no_inherit })))
}

/// Request body for toggling the no-inherit flag on an org node.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct NoInheritBody {
    /// Whether to block GPO inheritance from ancestor nodes.
    pub no_inherit: bool,
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helper
// ─────────────────────────────────────────────────────────────────────────────

/// Verify that `node_id` exists in `workforce_org_nodes` for the given tenant.
async fn verify_node_tenant(
    pool: &signapps_db::DatabasePool,
    node_id: Uuid,
    tenant_id: Uuid,
) -> Result<(), StatusCode> {
    use sqlx::Row as _;

    let row = sqlx::query(
        "SELECT EXISTS(SELECT 1 FROM workforce_org_nodes WHERE id = $1 AND tenant_id = $2) AS ok",
    )
    .bind(node_id)
    .bind(tenant_id)
    .fetch_one(&**pool)
    .await
    .map_err(|e| {
        tracing::error!(?e, "DB error verifying node tenant");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if !row.get::<bool, _>("ok") {
        return Err(StatusCode::NOT_FOUND);
    }
    Ok(())
}
