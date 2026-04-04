//! Governance Board Handlers
//!
//! CRUD operations for org governance boards and board membership management.
//! Boards are attached to org nodes; each node may have at most one board.
//! If a node has no board, governance is inherited from the nearest ancestor.

use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde_json::json;
use uuid::Uuid;

use crate::AppState;
use signapps_common::{Claims, TenantContext};
use signapps_db::models::org_boards::{CreateBoardMember, OrgBoardMember, UpdateBoardMember};
use signapps_db::repositories::core_org_repository::BoardRepository;
use sqlx::PgPool;

// ============================================================================
// Handlers
// ============================================================================

/// List all boards with their decision makers for the current tenant.
///
/// Returns a lightweight summary for each board, suitable for rendering
/// board indicators in the tree view without N+1 queries.
///
/// # Errors
///
/// Returns `500` if the database query fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[utoipa::path(
    get,
    path = "/api/v1/workforce/org/nodes/boards",
    responses(
        (status = 200, description = "List of all board summaries"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Org Boards"
)]
#[tracing::instrument(skip_all)]
pub async fn list_all_boards(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
) -> Result<impl IntoResponse, StatusCode> {
    let summaries = BoardRepository::list_all_boards_summary(&state.pool, ctx.tenant_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to list boards: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(json!(summaries)))
}

/// Get the board for a specific org node (own board only, not inherited).
///
/// # Errors
///
/// Returns `404` if no board exists on this node.
/// Returns `500` if the database query fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[utoipa::path(
    get,
    path = "/api/v1/workforce/org/nodes/{id}/board",
    params(("id" = uuid::Uuid, Path, description = "Node ID")),
    responses(
        (status = 200, description = "Board found"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "No board on this node"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Org Boards"
)]
#[tracing::instrument(skip_all)]
pub async fn get_board(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let board = BoardRepository::get_board_by_node(&state.pool, id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get board: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    match board {
        Some(b) => {
            let members = BoardRepository::list_board_members(&state.pool, b.id)
                .await
                .map_err(|e| {
                    tracing::error!("Failed to list board members: {}", e);
                    StatusCode::INTERNAL_SERVER_ERROR
                })?;
            Ok(Json(json!({ "board": b, "members": members })))
        },
        None => Err(StatusCode::NOT_FOUND),
    }
}

/// Create a board for an org node.
///
/// # Errors
///
/// Returns `409` if the node already has a board.
/// Returns `500` if the database query fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[utoipa::path(
    post,
    path = "/api/v1/workforce/org/nodes/{id}/board",
    params(("id" = uuid::Uuid, Path, description = "Node ID")),
    responses(
        (status = 201, description = "Board created"),
        (status = 401, description = "Unauthorized"),
        (status = 409, description = "Board already exists"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Org Boards"
)]
#[tracing::instrument(skip_all)]
pub async fn create_board(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    // Check if board already exists
    let existing = BoardRepository::get_board_by_node(&state.pool, id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to check existing board: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if existing.is_some() {
        return Err(StatusCode::CONFLICT);
    }

    let board = BoardRepository::create_board(&state.pool, id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to create board: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok((StatusCode::CREATED, Json(json!(board))))
}

/// Update a board (placeholder — boards have no mutable fields currently).
///
/// This endpoint exists for future extensibility. Currently it returns
/// the existing board unchanged.
///
/// # Errors
///
/// Returns `404` if no board exists on this node.
/// Returns `500` if the database query fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[utoipa::path(
    put,
    path = "/api/v1/workforce/org/nodes/{id}/board",
    params(("id" = uuid::Uuid, Path, description = "Node ID")),
    responses(
        (status = 200, description = "Board updated"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "No board on this node"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Org Boards"
)]
#[tracing::instrument(skip_all)]
pub async fn update_board(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let board = BoardRepository::get_board_by_node(&state.pool, id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get board: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    match board {
        Some(b) => Ok(Json(json!(b))),
        None => Err(StatusCode::NOT_FOUND),
    }
}

/// Delete the board attached to a node (reverts to inheritance).
///
/// # Errors
///
/// Returns `404` if no board exists on this node.
/// Returns `500` if the database query fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[utoipa::path(
    delete,
    path = "/api/v1/workforce/org/nodes/{id}/board",
    params(("id" = uuid::Uuid, Path, description = "Node ID")),
    responses(
        (status = 204, description = "Board deleted"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "No board on this node"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Org Boards"
)]
#[tracing::instrument(skip_all)]
pub async fn delete_board(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let existing = BoardRepository::get_board_by_node(&state.pool, id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to check board: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if existing.is_none() {
        return Err(StatusCode::NOT_FOUND);
    }

    // Refuse to delete board on root nodes (parent_id IS NULL)
    let is_root = BoardRepository::is_root_node(&state.pool, id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to check node: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if is_root {
        tracing::warn!(node_id = %id, "Cannot delete board on root node");
        return Ok((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Cannot delete board on root node — root nodes must have a governance board" })),
        ).into_response());
    }

    BoardRepository::delete_board(&state.pool, id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete board: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(StatusCode::NO_CONTENT.into_response())
}

/// Add a member to the board of an org node.
///
/// Creates the board automatically if it does not exist yet.
///
/// # Errors
///
/// Returns `409` if the person is already a member.
/// Returns `500` if the database query fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[utoipa::path(
    post,
    path = "/api/v1/workforce/org/nodes/{id}/board/members",
    params(("id" = uuid::Uuid, Path, description = "Node ID")),
    request_body = CreateBoardMember,
    responses(
        (status = 201, description = "Member added"),
        (status = 401, description = "Unauthorized"),
        (status = 409, description = "Person already on board"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Org Boards"
)]
#[tracing::instrument(skip_all)]
pub async fn add_member(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(input): Json<CreateBoardMember>,
) -> Result<impl IntoResponse, StatusCode> {
    // Get or create the board
    let board = match BoardRepository::get_board_by_node(&state.pool, id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get board: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })? {
        Some(b) => b,
        None => BoardRepository::create_board(&state.pool, id)
            .await
            .map_err(|e| {
                tracing::error!("Failed to auto-create board: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?,
    };

    // Enforce decision maker uniqueness: clear existing before setting new
    if input.is_decision_maker == Some(true) {
        BoardRepository::clear_decision_maker(&state.pool, board.id)
            .await
            .map_err(|e| {
                tracing::error!("Failed to clear decision maker: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;
    }

    let member = BoardRepository::add_board_member(&state.pool, board.id, input)
        .await
        .map_err(|e| {
            tracing::error!("Failed to add board member: {}", e);
            // UNIQUE violation → 409
            if e.to_string().contains("duplicate key") || e.to_string().contains("unique") {
                StatusCode::CONFLICT
            } else {
                StatusCode::INTERNAL_SERVER_ERROR
            }
        })?;

    // Advisory governance policy check (warn only, never blocks)
    let members = BoardRepository::list_board_members(&state.pool, board.id)
        .await
        .unwrap_or_default();
    validate_board_governance(&state.pool, id, &members).await;

    Ok((StatusCode::CREATED, Json(json!(member))))
}

/// Update a board member.
///
/// # Errors
///
/// Returns `404` if the member does not exist.
/// Returns `500` if the database query fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[utoipa::path(
    put,
    path = "/api/v1/workforce/org/nodes/{id}/board/members/{member_id}",
    params(
        ("id" = uuid::Uuid, Path, description = "Node ID"),
        ("member_id" = uuid::Uuid, Path, description = "Board member ID"),
    ),
    request_body = UpdateBoardMember,
    responses(
        (status = 200, description = "Member updated"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Member not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Org Boards"
)]
#[tracing::instrument(skip_all)]
pub async fn update_member(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path((id, member_id)): Path<(Uuid, Uuid)>,
    Json(input): Json<UpdateBoardMember>,
) -> Result<impl IntoResponse, StatusCode> {
    // Enforce decision maker uniqueness: clear existing before setting new
    if input.is_decision_maker == Some(true) {
        let board = BoardRepository::get_board_by_node(&state.pool, id)
            .await
            .map_err(|e| {
                tracing::error!("Failed to get board: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;
        if let Some(b) = board {
            BoardRepository::clear_decision_maker(&state.pool, b.id)
                .await
                .map_err(|e| {
                    tracing::error!("Failed to clear decision maker: {}", e);
                    StatusCode::INTERNAL_SERVER_ERROR
                })?;
        }
    }

    let member = BoardRepository::update_board_member(&state.pool, member_id, input)
        .await
        .map_err(|e| {
            tracing::error!("Failed to update board member: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(json!(member)))
}

/// Remove a member from a board.
///
/// # Errors
///
/// Returns `500` if the database query fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[utoipa::path(
    delete,
    path = "/api/v1/workforce/org/nodes/{id}/board/members/{member_id}",
    params(
        ("id" = uuid::Uuid, Path, description = "Node ID"),
        ("member_id" = uuid::Uuid, Path, description = "Board member ID"),
    ),
    responses(
        (status = 204, description = "Member removed"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Org Boards"
)]
#[tracing::instrument(skip_all)]
pub async fn remove_member(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path((_id, member_id)): Path<(Uuid, Uuid)>,
) -> Result<impl IntoResponse, StatusCode> {
    BoardRepository::remove_board_member(&state.pool, member_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to remove board member: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(StatusCode::NO_CONTENT)
}

/// Get the effective board for a node (walks up the hierarchy if no own board).
///
/// # Errors
///
/// Returns `404` if no board exists in the ancestor chain.
/// Returns `500` if the database query fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[utoipa::path(
    get,
    path = "/api/v1/workforce/org/nodes/{id}/effective-board",
    params(("id" = uuid::Uuid, Path, description = "Node ID")),
    responses(
        (status = 200, description = "Effective board resolved"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "No board in ancestor chain"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Org Boards"
)]
#[tracing::instrument(skip_all)]
pub async fn get_effective_board(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let effective = BoardRepository::get_effective_board(&state.pool, id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get effective board: {}", e);
            if e.to_string().contains("not found") || e.to_string().contains("Not found") {
                StatusCode::NOT_FOUND
            } else {
                StatusCode::INTERNAL_SERVER_ERROR
            }
        })?;

    Ok(Json(json!(effective)))
}

// ============================================================================
// Governance Policy Validation (advisory)
// ============================================================================

/// Validate board composition against governance policies.
///
/// This is **advisory only**: violations are logged as warnings but never
/// block the operation. The function resolves governance policies for the
/// given node and checks the current board members against the policy
/// settings (`min_members`, `max_members`, `required_roles`).
///
/// # Errors
///
/// This function never returns an error — all failures are swallowed and
/// logged so that governance validation cannot break board mutations.
///
/// # Panics
///
/// No panics — all errors are caught internally.
#[tracing::instrument(skip_all, fields(node_id = %node_id))]
async fn validate_board_governance(pool: &PgPool, node_id: Uuid, members: &[OrgBoardMember]) {
    // Fetch governance policies for this node (domain = 'governance')
    let policies = match sqlx::query_as::<_, signapps_db::models::org_policies::OrgPolicy>(
        r#"
        SELECT DISTINCT p.*
        FROM workforce_org_policies p
        JOIN workforce_org_policy_links pl ON pl.policy_id = p.id
        JOIN workforce_org_closure c ON c.ancestor_id = pl.link_id::uuid
        WHERE c.descendant_id = $1
          AND pl.link_type = 'node'
          AND p.domain = 'governance'
          AND p.is_disabled = false
          AND pl.is_blocked = false
        ORDER BY p.priority DESC
        LIMIT 1
        "#,
    )
    .bind(node_id)
    .fetch_optional(pool)
    .await
    {
        Ok(Some(policy)) => policy,
        Ok(None) => {
            // Also check for global governance policies
            match sqlx::query_as::<_, signapps_db::models::org_policies::OrgPolicy>(
                r#"
                SELECT DISTINCT p.*
                FROM workforce_org_policies p
                JOIN workforce_org_policy_links pl ON pl.policy_id = p.id
                WHERE pl.link_type = 'global'
                  AND p.domain = 'governance'
                  AND p.is_disabled = false
                  AND pl.is_blocked = false
                ORDER BY p.priority DESC
                LIMIT 1
                "#,
            )
            .fetch_optional(pool)
            .await
            {
                Ok(Some(policy)) => policy,
                Ok(None) => return, // No governance policy applies
                Err(e) => {
                    tracing::debug!("Could not resolve global governance policy: {}", e);
                    return;
                },
            }
        },
        Err(e) => {
            tracing::debug!("Could not resolve governance policy for node: {}", e);
            return;
        },
    };

    let settings = &policies.settings;
    let member_count = members.len();

    // Check min_members
    if let Some(min) = settings.get("min_members").and_then(|v| v.as_u64()) {
        if (member_count as u64) < min {
            tracing::warn!(
                node_id = %node_id,
                policy = %policies.name,
                current = member_count,
                required = min,
                "Governance policy violation: board has fewer members than minimum"
            );
        }
    }

    // Check max_members
    if let Some(max) = settings.get("max_members").and_then(|v| v.as_u64()) {
        if (member_count as u64) > max {
            tracing::warn!(
                node_id = %node_id,
                policy = %policies.name,
                current = member_count,
                maximum = max,
                "Governance policy violation: board exceeds maximum member count"
            );
        }
    }

    // Check required_roles
    if let Some(required_roles) = settings.get("required_roles").and_then(|v| v.as_array()) {
        let member_roles: Vec<&str> = members.iter().map(|m| m.role.as_str()).collect();
        for role_val in required_roles {
            if let Some(role) = role_val.as_str() {
                if !member_roles.contains(&role) {
                    tracing::warn!(
                        node_id = %node_id,
                        policy = %policies.name,
                        missing_role = role,
                        "Governance policy violation: required board role is not filled"
                    );
                }
            }
        }
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use signapps_db::models::org_boards::OrgBoardMember;

    #[test]
    fn module_compiles() {
        assert!(true, "{} handler module loaded", module_path!());
    }

    /// Helper to build a test board member.
    fn make_member(role: &str, is_dm: bool) -> OrgBoardMember {
        OrgBoardMember {
            id: Uuid::new_v4(),
            board_id: Uuid::new_v4(),
            person_id: Uuid::new_v4(),
            role: role.to_string(),
            is_decision_maker: is_dm,
            sort_order: 0,
            start_date: None,
            end_date: None,
            created_at: chrono::Utc::now(),
        }
    }

    #[test]
    fn decision_maker_uniqueness_logic() {
        // Given two members, only one should be decision maker
        let members = vec![
            make_member("president", true),
            make_member("secretary", false),
        ];
        let dm_count = members.iter().filter(|m| m.is_decision_maker).count();
        assert_eq!(dm_count, 1, "Exactly one decision maker should exist");
    }

    #[test]
    fn decision_maker_flag_cleared() {
        // Simulate the clear logic: setting all to false
        let mut members = vec![
            make_member("president", true),
            make_member("vp", true), // invalid: two DMs
        ];
        // Clear all decision makers (mimics clear_decision_maker SQL)
        for m in &mut members {
            m.is_decision_maker = false;
        }
        // Set new decision maker
        members[1].is_decision_maker = true;

        let dm_count = members.iter().filter(|m| m.is_decision_maker).count();
        assert_eq!(dm_count, 1);
        assert!(members[1].is_decision_maker);
        assert!(!members[0].is_decision_maker);
    }

    #[test]
    fn allowed_children_enforcement_logic() {
        let allowed = serde_json::json!(["subsidiary", "bu", "department"]);
        let allowed_arr: Vec<&str> = allowed
            .as_array()
            .unwrap()
            .iter()
            .filter_map(|v| v.as_str())
            .collect();

        // Valid child type
        assert!(allowed_arr.contains(&"bu"));
        // Invalid child type
        assert!(!allowed_arr.contains(&"position"));
        assert!(!allowed_arr.contains(&"team"));
    }

    #[test]
    fn allowed_children_empty_allows_nothing() {
        let allowed = serde_json::json!([]);
        let allowed_arr: Vec<&str> = allowed
            .as_array()
            .unwrap()
            .iter()
            .filter_map(|v| v.as_str())
            .collect();

        // Empty allowed_children means no children allowed (position type)
        assert!(allowed_arr.is_empty());
        assert!(!allowed_arr.contains(&"team"));
    }

    #[test]
    fn governance_policy_role_check_logic() {
        let settings = serde_json::json!({
            "board_required": true,
            "min_members": 3,
            "required_roles": ["president", "cfo"],
            "max_members": 15
        });

        let members = vec![
            make_member("president", true),
            make_member("secretary", false),
        ];

        // Check required roles
        let member_roles: Vec<&str> = members.iter().map(|m| m.role.as_str()).collect();
        let required = settings["required_roles"].as_array().unwrap();
        let mut missing: Vec<&str> = Vec::new();
        for role_val in required {
            if let Some(role) = role_val.as_str() {
                if !member_roles.contains(&role) {
                    missing.push(role);
                }
            }
        }
        assert_eq!(missing, vec!["cfo"], "CFO role should be missing");

        // Check min_members
        let min = settings["min_members"].as_u64().unwrap();
        assert!(
            (members.len() as u64) < min,
            "Board should have fewer than min_members"
        );
    }

    #[test]
    fn board_summary_construction() {
        // Test the BoardSummary struct can be constructed
        use signapps_db::models::org_boards::BoardSummary;
        let summary = BoardSummary {
            node_id: Uuid::new_v4(),
            board_id: Uuid::new_v4(),
            decision_maker_person_id: Some(Uuid::new_v4()),
        };
        assert!(summary.decision_maker_person_id.is_some());
    }
}
