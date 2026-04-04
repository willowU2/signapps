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
use signapps_db::models::org_boards::{CreateBoardMember, UpdateBoardMember};
use signapps_db::repositories::core_org_repository::BoardRepository;

// ============================================================================
// Handlers
// ============================================================================

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
        }
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

    BoardRepository::delete_board(&state.pool, id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete board: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(StatusCode::NO_CONTENT)
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
    Path((_id, member_id)): Path<(Uuid, Uuid)>,
    Json(input): Json<UpdateBoardMember>,
) -> Result<impl IntoResponse, StatusCode> {
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
