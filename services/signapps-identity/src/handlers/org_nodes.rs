//! Org node handlers: CRUD, move, children/descendants/ancestors,
//! node assignments, permission profiles, and orgchart.

use crate::AppState;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use signapps_common::{Error, Result};
use signapps_db::models::core_org::{
    Assignment, CreateOrgNode, EffectivePermissions, OrgNode, OrgTree, PermissionProfile,
    UpdateOrgNode, UpsertPermissionProfile,
};
use signapps_db::repositories::{
    AssignmentRepository, OrgNodeRepository, OrgTreeRepository, PermissionProfileRepository,
    PersonRepository,
};
use uuid::Uuid;

// ============================================================================
// Request DTOs
// ============================================================================

/// Request body for creating an org node.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreateOrgNodeRequest {
    pub tree_id: Uuid,
    pub parent_id: Option<Uuid>,
    pub node_type: String,
    pub name: String,
    pub code: Option<String>,
    pub description: Option<String>,
    pub config: Option<serde_json::Value>,
    pub sort_order: Option<i32>,
}

/// Request body for updating an org node.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct UpdateOrgNodeRequest {
    pub name: Option<String>,
    pub code: Option<String>,
    pub description: Option<String>,
    pub config: Option<serde_json::Value>,
    pub sort_order: Option<i32>,
    pub is_active: Option<bool>,
}

/// Request body for moving a node to a new parent.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct MoveNodeRequest {
    pub parent_id: Option<Uuid>,
}

/// Request body for setting node permissions.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct SetPermissionsRequest {
    pub inherit: Option<bool>,
    pub modules: Option<serde_json::Value>,
    pub max_role: Option<String>,
    pub custom_permissions: Option<serde_json::Value>,
}

// ============================================================================
// Handlers
// ============================================================================

/// GET /api/v1/org/nodes/:id — Retrieve a single org node by ID.
#[utoipa::path(
    get,
    path = "/api/v1/org/nodes/{id}",
    tag = "org",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Org node UUID")),
    responses(
        (status = 200, description = "Org node detail", body = OrgNode),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Org node not found"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn get_node(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<OrgNode>> {
    let node = OrgNodeRepository::find(&state.pool, id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Org node {id} not found")))?;
    Ok(Json(node))
}

/// POST /api/v1/org/nodes — Create a new org node.
#[utoipa::path(
    post,
    path = "/api/v1/org/nodes",
    tag = "org",
    security(("bearerAuth" = [])),
    request_body = CreateOrgNodeRequest,
    responses(
        (status = 201, description = "Org node created", body = OrgNode),
        (status = 400, description = "Validation error"),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn create_node(
    State(state): State<AppState>,
    Json(payload): Json<CreateOrgNodeRequest>,
) -> Result<(StatusCode, Json<OrgNode>)> {
    let input = CreateOrgNode {
        tree_id: payload.tree_id,
        parent_id: payload.parent_id,
        node_type: payload.node_type,
        name: payload.name,
        code: payload.code,
        description: payload.description,
        config: payload.config,
        sort_order: payload.sort_order,
    };
    let node = OrgNodeRepository::create(&state.pool, input).await?;
    Ok((StatusCode::CREATED, Json(node)))
}

/// PUT /api/v1/org/nodes/:id — Update mutable fields of an org node.
#[utoipa::path(
    put,
    path = "/api/v1/org/nodes/{id}",
    tag = "org",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Org node UUID")),
    request_body = UpdateOrgNodeRequest,
    responses(
        (status = 200, description = "Org node updated", body = OrgNode),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Org node not found"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn update_node(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateOrgNodeRequest>,
) -> Result<Json<OrgNode>> {
    let input = UpdateOrgNode {
        name: payload.name,
        code: payload.code,
        description: payload.description,
        config: payload.config,
        sort_order: payload.sort_order,
        is_active: payload.is_active,
    };
    let node = OrgNodeRepository::update(&state.pool, id, input).await?;
    Ok(Json(node))
}

/// DELETE /api/v1/org/nodes/:id — Delete an org node (cascades to closure rows).
#[utoipa::path(
    delete,
    path = "/api/v1/org/nodes/{id}",
    tag = "org",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Org node UUID")),
    responses(
        (status = 204, description = "Org node deleted"),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Org node not found"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn delete_node(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    // Verify exists first
    OrgNodeRepository::find(&state.pool, id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Org node {id} not found")))?;
    OrgNodeRepository::delete(&state.pool, id).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// POST /api/v1/org/nodes/:id/move — Move a node to a new parent.
#[utoipa::path(
    post,
    path = "/api/v1/org/nodes/{id}/move",
    tag = "org",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Org node UUID")),
    request_body = MoveNodeRequest,
    responses(
        (status = 204, description = "Node moved"),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Org node not found"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn move_node(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<MoveNodeRequest>,
) -> Result<StatusCode> {
    OrgNodeRepository::move_node(&state.pool, id, payload.parent_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// GET /api/v1/org/nodes/:id/children — List direct children of a node.
#[utoipa::path(
    get,
    path = "/api/v1/org/nodes/{id}/children",
    tag = "org",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Org node UUID")),
    responses(
        (status = 200, description = "Direct children", body = Vec<OrgNode>),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn get_children(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<OrgNode>>> {
    let children = OrgNodeRepository::get_children(&state.pool, id).await?;
    Ok(Json(children))
}

/// GET /api/v1/org/nodes/:id/descendants — List all descendants via closure table.
#[utoipa::path(
    get,
    path = "/api/v1/org/nodes/{id}/descendants",
    tag = "org",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Org node UUID")),
    responses(
        (status = 200, description = "All descendants (flat list)", body = Vec<OrgNode>),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn get_descendants(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<OrgNode>>> {
    let descendants = OrgNodeRepository::get_descendants(&state.pool, id).await?;
    Ok(Json(descendants))
}

/// GET /api/v1/org/nodes/:id/ancestors — List all ancestors via closure table (root first).
#[utoipa::path(
    get,
    path = "/api/v1/org/nodes/{id}/ancestors",
    tag = "org",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Org node UUID")),
    responses(
        (status = 200, description = "Ancestor chain from root to node", body = Vec<OrgNode>),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn get_ancestors(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<OrgNode>>> {
    let ancestors = OrgNodeRepository::get_ancestors(&state.pool, id).await?;
    Ok(Json(ancestors))
}

/// GET /api/v1/org/nodes/:id/assignments — List all assignments for this node.
#[utoipa::path(
    get,
    path = "/api/v1/org/nodes/{id}/assignments",
    tag = "org",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Org node UUID")),
    responses(
        (status = 200, description = "Node assignments", body = Vec<Assignment>),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn get_node_assignments(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<Assignment>>> {
    let assignments = AssignmentRepository::list_by_node(&state.pool, id).await?;
    Ok(Json(assignments))
}

/// GET /api/v1/org/nodes/:id/permissions — Get permission profile for a node.
#[utoipa::path(
    get,
    path = "/api/v1/org/nodes/{id}/permissions",
    tag = "org",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Org node UUID")),
    responses(
        (status = 200, description = "Effective permissions (merged from ancestors)", body = EffectivePermissions),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn get_node_permissions(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<EffectivePermissions>> {
    let perms = PermissionProfileRepository::get_effective(&state.pool, id).await?;
    Ok(Json(perms))
}

/// PUT /api/v1/org/nodes/:id/permissions — Create or replace the permission profile for a node.
#[utoipa::path(
    put,
    path = "/api/v1/org/nodes/{id}/permissions",
    tag = "org",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Org node UUID")),
    request_body = SetPermissionsRequest,
    responses(
        (status = 200, description = "Permission profile set", body = PermissionProfile),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn set_node_permissions(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<SetPermissionsRequest>,
) -> Result<Json<PermissionProfile>> {
    let input = UpsertPermissionProfile {
        inherit: payload.inherit,
        modules: payload.modules,
        max_role: payload.max_role,
        custom_permissions: payload.custom_permissions,
    };
    let profile = PermissionProfileRepository::upsert(&state.pool, id, input).await?;
    Ok(Json(profile))
}

// ============================================================================
// Orgchart
// ============================================================================

/// Query parameters for the orgchart endpoint.
#[derive(Debug, Deserialize)]
pub struct OrgchartQuery {
    /// Optional tree UUID; if omitted the first tree for the tenant is used.
    pub tree_id: Option<Uuid>,
    /// Optional historical date (`YYYY-MM-DD`); if omitted only active assignments are shown.
    pub date: Option<NaiveDate>,
}

/// One person appearing in the orgchart, augmented with assignment details.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct OrgchartPerson {
    /// Assignment primary key.
    pub assignment_id: Uuid,
    pub person_id: Uuid,
    pub first_name: String,
    pub last_name: String,
    pub email: Option<String>,
    pub avatar_url: Option<String>,
    pub assignment_type: String,
    pub responsibility_type: String,
    pub is_primary: bool,
}

/// One node in the orgchart response, with its persons and nested children.
#[derive(Debug, Serialize)]
pub struct OrgchartNodeResponse {
    #[serde(flatten)]
    pub node: OrgNode,
    /// People currently assigned (or assigned on `?date=`) to this node.
    pub assignments: Vec<OrgchartPerson>,
    /// Recursively nested child nodes.
    pub children: Vec<OrgchartNodeResponse>,
}

/// Top-level orgchart response.
#[derive(Debug, Serialize)]
pub struct OrgchartResponse {
    pub tree: OrgTree,
    pub nodes: Vec<OrgchartNodeResponse>,
}

/// GET /api/v1/org/orgchart — Full tree with persons assigned to each node.
///
/// Optional query parameters:
/// - `?tree_id=UUID`    — select a specific org tree (defaults to the first one found).
/// - `?date=YYYY-MM-DD` — historical snapshot; returns assignments active on that date.
#[utoipa::path(
    get,
    path = "/api/v1/org/orgchart",
    tag = "org",
    security(("bearerAuth" = [])),
    params(
        ("tree_id" = Option<Uuid>, Query, description = "Org tree UUID (defaults to first tree for tenant)"),
        ("date" = Option<String>, Query, description = "Historical snapshot date (YYYY-MM-DD)"),
    ),
    responses(
        (status = 200, description = "Full orgchart with nested nodes and assignments", body = serde_json::Value),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "No org tree found for tenant"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn get_orgchart(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<signapps_common::Claims>,
    Query(query): Query<OrgchartQuery>,
) -> Result<Json<OrgchartResponse>> {
    let tenant_id = claims
        .tenant_id
        .ok_or_else(|| Error::Forbidden("No tenant context".to_string()))?;

    // Resolve the org tree
    let tree = if let Some(tid) = query.tree_id {
        OrgTreeRepository::find_by_id(&state.pool, tid)
            .await?
            .ok_or_else(|| Error::NotFound(format!("Org tree {tid} not found")))?
    } else {
        OrgTreeRepository::list_by_tenant(&state.pool, tenant_id)
            .await?
            .into_iter()
            .next()
            .ok_or_else(|| Error::NotFound("No org trees found for tenant".to_string()))?
    };

    // Load all nodes for the tree
    let nodes = OrgNodeRepository::get_full_tree(&state.pool, tree.id).await?;

    // Load assignments for the tree, filtered by date if provided
    let assignments: Vec<(Assignment, OrgchartPerson)> = {
        // Build a flat list of (Assignment, enriched person info)
        #[derive(sqlx::FromRow)]
        struct AssignmentPersonRow {
            assignment_id: Uuid,
            person_id: Uuid,
            node_id: Uuid,
            first_name: String,
            last_name: String,
            email: Option<String>,
            avatar_url: Option<String>,
            assignment_type: String,
            responsibility_type: String,
            is_primary: bool,
        }

        let date_filter = query.date;
        let rows: Vec<AssignmentPersonRow> = if let Some(d) = date_filter {
            sqlx::query_as::<_, AssignmentPersonRow>(
                "SELECT
                     a.id             AS assignment_id,
                     a.person_id,
                     a.node_id,
                     p.first_name,
                     p.last_name,
                     p.email,
                     p.avatar_url,
                     a.assignment_type::text,
                     a.responsibility_type::text,
                     a.is_primary
                 FROM core.assignments a
                 JOIN core.persons p ON p.id = a.person_id
                 JOIN core.org_nodes n ON n.id = a.node_id
                 WHERE n.tree_id = $1
                   AND a.start_date <= $2
                   AND (a.end_date IS NULL OR a.end_date >= $2)
                 ORDER BY a.is_primary DESC, p.last_name, p.first_name",
            )
            .bind(tree.id)
            .bind(d)
            .fetch_all(&*state.pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?
        } else {
            sqlx::query_as::<_, AssignmentPersonRow>(
                "SELECT
                     a.id             AS assignment_id,
                     a.person_id,
                     a.node_id,
                     p.first_name,
                     p.last_name,
                     p.email,
                     p.avatar_url,
                     a.assignment_type::text,
                     a.responsibility_type::text,
                     a.is_primary
                 FROM core.assignments a
                 JOIN core.persons p ON p.id = a.person_id
                 JOIN core.org_nodes n ON n.id = a.node_id
                 WHERE n.tree_id = $1
                   AND a.end_date IS NULL
                 ORDER BY a.is_primary DESC, p.last_name, p.first_name",
            )
            .bind(tree.id)
            .fetch_all(&*state.pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?
        };

        rows.into_iter()
            .map(|r| {
                let person = OrgchartPerson {
                    assignment_id: r.assignment_id,
                    person_id: r.person_id,
                    first_name: r.first_name,
                    last_name: r.last_name,
                    email: r.email,
                    avatar_url: r.avatar_url,
                    assignment_type: r.assignment_type,
                    responsibility_type: r.responsibility_type,
                    is_primary: r.is_primary,
                };
                // Dummy Assignment just to carry node_id for grouping
                let dummy = Assignment {
                    id: r.assignment_id,
                    person_id: r.person_id,
                    node_id: r.node_id,
                    assignment_type: person.assignment_type.clone(),
                    responsibility_type: person.responsibility_type.clone(),
                    start_date: chrono::NaiveDate::from_ymd_opt(1970, 1, 1).unwrap(),
                    end_date: None,
                    fte_ratio: 1.0,
                    is_primary: r.is_primary,
                    created_at: chrono::Utc::now(),
                    updated_at: chrono::Utc::now(),
                };
                (dummy, person)
            })
            .collect()
    };

    // Group persons by node_id for quick lookup
    use std::collections::HashMap;
    let mut persons_by_node: HashMap<Uuid, Vec<OrgchartPerson>> = HashMap::new();
    for (a, p) in assignments {
        persons_by_node.entry(a.node_id).or_default().push(p);
    }

    // Convert the nested OrgChartNode tree to OrgchartNodeResponse
    fn convert(
        node: signapps_db::models::core_org::OrgChartNode,
        persons_by_node: &mut HashMap<Uuid, Vec<OrgchartPerson>>,
    ) -> OrgchartNodeResponse {
        let node_id = node.node.id;
        let assignments = persons_by_node.remove(&node_id).unwrap_or_default();
        let children = node
            .children
            .into_iter()
            .map(|child| convert(child, persons_by_node))
            .collect();
        OrgchartNodeResponse {
            node: node.node,
            assignments,
            children,
        }
    }

    let chart_nodes: Vec<OrgchartNodeResponse> = nodes
        .into_iter()
        .map(|n| convert(n, &mut persons_by_node))
        .collect();

    Ok(Json(OrgchartResponse {
        tree,
        nodes: chart_nodes,
    }))
}
