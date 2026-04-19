//! CRUD handlers for `/api/v1/org/boards` — canonical surface (S1 W2).
//!
//! Backed by [`BoardRepository`]. One board per node (enforced by the
//! UNIQUE constraint) + members with the **at most one decision maker**
//! invariant enforced in a single transaction.
//!
//! Events emitted:
//! - `org.board.changed` on upsert + any member mutation.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::post,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use signapps_common::pg_events::NewEvent;
use signapps_common::{Error, Result};
use signapps_db::models::org::{Board, BoardMember};
use signapps_db::repositories::org::BoardRepository;
use uuid::Uuid;

use crate::AppState;

// ============================================================================
// Router
// ============================================================================

/// Build the boards router nested at `/api/v1/org/boards`.
pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", post(upsert))
        .route("/by-node/:node_id", axum::routing::get(by_node))
        .route("/:board_id/members", post(add_member))
        .route(
            "/members/:member_id",
            axum::routing::patch(update_member).delete(remove_member),
        )
}

// ============================================================================
// Request / response DTOs
// ============================================================================

/// Request body for `POST /api/v1/org/boards`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct UpsertBoardBody {
    /// Node to attach the board to (UNIQUE).
    pub node_id: Uuid,
}

/// Response body for `GET /api/v1/org/boards/by-node/:node_id`.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct BoardWithMembers {
    /// Board row.
    pub board: Board,
    /// Ordered list of members.
    pub members: Vec<BoardMember>,
}

/// Request body for `POST /api/v1/org/boards/:board_id/members`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct AddMemberBody {
    /// Person to add.
    pub person_id: Uuid,
    /// Role label (chair, secretary, member, ...).
    pub role: String,
    /// `true` = decision maker (at most one per board, enforced server-side).
    pub is_decision_maker: Option<bool>,
    /// Display order, lower first.
    pub sort_order: Option<i32>,
}

/// Request body for `PATCH /api/v1/org/boards/members/:member_id`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct UpdateMemberBody {
    /// New role label (optional).
    pub role: Option<String>,
    /// Promote/demote decision maker (optional).
    pub is_decision_maker: Option<bool>,
    /// New sort order (optional).
    pub sort_order: Option<i32>,
}

// ============================================================================
// Handlers
// ============================================================================

/// POST /api/v1/org/boards — idempotent create: returns the existing
/// board if one already exists for the node.
#[utoipa::path(
    post,
    path = "/api/v1/org/boards",
    tag = "Org",
    request_body = UpsertBoardBody,
    responses(
        (status = 201, description = "Board upserted", body = Board),
        (status = 401, description = "Not authenticated"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn upsert(
    State(st): State<AppState>,
    Json(body): Json<UpsertBoardBody>,
) -> Result<(StatusCode, Json<Board>)> {
    let repo = BoardRepository::new(st.pool.inner());
    let board = repo
        .upsert_board(body.node_id)
        .await
        .map_err(|e| Error::Database(format!("upsert board: {e}")))?;

    if let Ok(payload) = serde_json::to_value(&board) {
        let _ = st
            .event_bus
            .publish(NewEvent {
                event_type: "org.board.changed".to_string(),
                aggregate_id: Some(board.id),
                payload,
            })
            .await;
    }
    Ok((StatusCode::CREATED, Json(board)))
}

/// GET /api/v1/org/boards/by-node/:node_id — fetch the node's board +
/// members, or 404 if absent.
#[utoipa::path(
    get,
    path = "/api/v1/org/boards/by-node/{node_id}",
    tag = "Org",
    params(("node_id" = Uuid, Path, description = "Node UUID")),
    responses(
        (status = 200, description = "Board + members", body = BoardWithMembers),
        (status = 404, description = "No board for this node"),
        (status = 401, description = "Not authenticated"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn by_node(
    State(st): State<AppState>,
    Path(node_id): Path<Uuid>,
) -> Result<Json<BoardWithMembers>> {
    let repo = BoardRepository::new(st.pool.inner());
    let (board, members) = repo
        .get_by_node(node_id)
        .await
        .map_err(|e| Error::Database(format!("get_by_node: {e}")))?
        .ok_or_else(|| Error::NotFound(format!("board for node {node_id}")))?;
    Ok(Json(BoardWithMembers { board, members }))
}

/// POST /api/v1/org/boards/:board_id/members — add a member, enforcing
/// the "at most one decision maker" invariant inside a transaction.
#[utoipa::path(
    post,
    path = "/api/v1/org/boards/{board_id}/members",
    tag = "Org",
    params(("board_id" = Uuid, Path, description = "Board UUID")),
    request_body = AddMemberBody,
    responses(
        (status = 201, description = "Member added", body = BoardMember),
        (status = 401, description = "Not authenticated"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn add_member(
    State(st): State<AppState>,
    Path(board_id): Path<Uuid>,
    Json(body): Json<AddMemberBody>,
) -> Result<(StatusCode, Json<BoardMember>)> {
    let is_decision_maker = body.is_decision_maker.unwrap_or(false);
    let sort_order = body.sort_order.unwrap_or(0);

    let mut tx = st
        .pool
        .inner()
        .begin()
        .await
        .map_err(|e| Error::Database(format!("begin tx: {e}")))?;

    // If we are promoting this member to decision maker, demote everyone
    // else on the board first (still inside the tx).
    if is_decision_maker {
        sqlx::query(
            "UPDATE org_board_members
                SET is_decision_maker = false
              WHERE board_id = $1
                AND is_decision_maker = true",
        )
        .bind(board_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| Error::Database(format!("demote existing: {e}")))?;
    }

    let member = sqlx::query_as::<_, BoardMember>(
        "INSERT INTO org_board_members
            (board_id, person_id, role, is_decision_maker, sort_order)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *",
    )
    .bind(board_id)
    .bind(body.person_id)
    .bind(&body.role)
    .bind(is_decision_maker)
    .bind(sort_order)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| Error::Database(format!("insert member: {e}")))?;

    tx.commit()
        .await
        .map_err(|e| Error::Database(format!("commit: {e}")))?;

    if let Ok(payload) = serde_json::to_value(&member) {
        let _ = st
            .event_bus
            .publish(NewEvent {
                event_type: "org.board.changed".to_string(),
                aggregate_id: Some(board_id),
                payload,
            })
            .await;
    }
    Ok((StatusCode::CREATED, Json(member)))
}

/// PATCH /api/v1/org/boards/members/:member_id — update role / decision
/// maker flag / sort order. Promotions to decision maker demote the
/// existing one atomically in the same transaction.
#[utoipa::path(
    patch,
    path = "/api/v1/org/boards/members/{member_id}",
    tag = "Org",
    params(("member_id" = Uuid, Path, description = "Member UUID")),
    request_body = UpdateMemberBody,
    responses(
        (status = 200, description = "Member updated", body = BoardMember),
        (status = 404, description = "Member not found"),
        (status = 401, description = "Not authenticated"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn update_member(
    State(st): State<AppState>,
    Path(member_id): Path<Uuid>,
    Json(body): Json<UpdateMemberBody>,
) -> Result<Json<BoardMember>> {
    let mut tx = st
        .pool
        .inner()
        .begin()
        .await
        .map_err(|e| Error::Database(format!("begin tx: {e}")))?;

    // Look up the board first — we need it both for invariant enforcement
    // and for event publication.
    let existing = sqlx::query_as::<_, BoardMember>(
        "SELECT * FROM org_board_members WHERE id = $1 FOR UPDATE",
    )
    .bind(member_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| Error::Database(format!("select for update: {e}")))?
    .ok_or_else(|| Error::NotFound(format!("board member {member_id}")))?;

    if body.is_decision_maker == Some(true) {
        sqlx::query(
            "UPDATE org_board_members
                SET is_decision_maker = false
              WHERE board_id = $1 AND id <> $2 AND is_decision_maker = true",
        )
        .bind(existing.board_id)
        .bind(member_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| Error::Database(format!("demote others: {e}")))?;
    }

    let member = sqlx::query_as::<_, BoardMember>(
        "UPDATE org_board_members SET
            role              = COALESCE($2, role),
            is_decision_maker = COALESCE($3, is_decision_maker),
            sort_order        = COALESCE($4, sort_order)
         WHERE id = $1
         RETURNING *",
    )
    .bind(member_id)
    .bind(body.role)
    .bind(body.is_decision_maker)
    .bind(body.sort_order)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| Error::Database(format!("update member: {e}")))?;

    tx.commit()
        .await
        .map_err(|e| Error::Database(format!("commit: {e}")))?;

    if let Ok(payload) = serde_json::to_value(&member) {
        let _ = st
            .event_bus
            .publish(NewEvent {
                event_type: "org.board.changed".to_string(),
                aggregate_id: Some(member.board_id),
                payload,
            })
            .await;
    }
    Ok(Json(member))
}

/// DELETE /api/v1/org/boards/members/:member_id — remove a member.
#[utoipa::path(
    delete,
    path = "/api/v1/org/boards/members/{member_id}",
    tag = "Org",
    params(("member_id" = Uuid, Path, description = "Member UUID")),
    responses(
        (status = 204, description = "Member removed"),
        (status = 401, description = "Not authenticated"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn remove_member(
    State(st): State<AppState>,
    Path(member_id): Path<Uuid>,
) -> Result<StatusCode> {
    let repo = BoardRepository::new(st.pool.inner());
    repo.remove_member(member_id)
        .await
        .map_err(|e| Error::Database(format!("remove member: {e}")))?;
    let _ = st
        .event_bus
        .publish(NewEvent {
            event_type: "org.board.changed".to_string(),
            aggregate_id: Some(member_id),
            payload: serde_json::json!({ "member_id": member_id, "removed": true }),
        })
        .await;
    Ok(StatusCode::NO_CONTENT)
}
