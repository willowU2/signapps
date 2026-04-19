//! SO2 board decisions + votes handlers.
//!
//! Endpoints :
//! - `GET    /api/v1/org/boards/:board_id/decisions` → list
//! - `POST   /api/v1/org/boards/:board_id/decisions` → create
//! - `PUT    /api/v1/org/boards/:board_id/decisions/:id/status`
//! - `DELETE /api/v1/org/boards/:board_id/decisions/:id`
//! - `GET    /api/v1/org/decisions/:id/votes` → list
//! - `POST   /api/v1/org/decisions/:id/votes` → upsert
//! - `DELETE /api/v1/org/decisions/:id/votes/:vote_id`

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{delete, get, put},
    Json, Router,
};
use serde::Deserialize;
use signapps_common::{Error, Result};
use signapps_db::models::org::{BoardDecision, BoardVote, DecisionStatus, VoteKind};
use signapps_db::repositories::org::BoardDecisionRepository;
use uuid::Uuid;

use crate::AppState;

/// Build the decisions-under-board router (nested at `/api/v1/org/boards/:board_id/decisions`).
pub fn board_decisions_routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list_by_board).post(create))
        .route("/:id", delete(delete_decision))
        .route("/:id/status", put(update_status))
}

/// Build the decision-level votes router (nested at `/api/v1/org/decisions/:decision_id`).
pub fn decision_votes_routes() -> Router<AppState> {
    Router::new()
        .route("/votes", get(list_votes).post(upsert_vote))
        .route("/votes/:vote_id", delete(delete_vote))
}

// ─── DTOs ─────────────────────────────────────────────────────────────

/// Query for `GET /api/v1/org/boards/:board_id/decisions`.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct ListDecisionsQuery {
    /// Filtre par statut (optionnel).
    pub status: Option<DecisionStatus>,
}

/// Request body for `POST /api/v1/org/boards/:board_id/decisions`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreateDecisionBody {
    /// Tenant propriétaire.
    pub tenant_id: Uuid,
    /// Titre court.
    pub title: String,
    /// Description markdown (optionnelle).
    pub description: Option<String>,
    /// Métadonnées libres.
    #[serde(default)]
    pub attributes: serde_json::Value,
}

/// Request body for `PUT /api/v1/org/boards/:board_id/decisions/:id/status`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct UpdateStatusBody {
    /// Nouveau statut.
    pub status: DecisionStatus,
    /// Qui clôture la décision (optionnel, utile si ≠ user courant).
    pub decided_by_person_id: Option<Uuid>,
}

/// Request body for `POST /api/v1/org/decisions/:decision_id/votes`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct UpsertVoteBody {
    /// Tenant propriétaire.
    pub tenant_id: Uuid,
    /// Personne qui vote.
    pub person_id: Uuid,
    /// Sens du vote.
    pub vote: VoteKind,
    /// Justification libre.
    pub rationale: Option<String>,
}

// ─── Handlers — decisions ────────────────────────────────────────────

/// `GET /api/v1/org/boards/:board_id/decisions` — list decisions.
#[utoipa::path(
    get,
    path = "/api/v1/org/boards/{board_id}/decisions",
    tag = "Org",
    params(
        ("board_id" = Uuid, Path, description = "Board UUID"),
        ListDecisionsQuery,
    ),
    responses(
        (status = 200, description = "Decisions list", body = Vec<BoardDecision>),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn list_by_board(
    State(st): State<AppState>,
    Path(board_id): Path<Uuid>,
    Query(q): Query<ListDecisionsQuery>,
) -> Result<Json<Vec<BoardDecision>>> {
    let rows = BoardDecisionRepository::new(st.pool.inner())
        .list_by_board(board_id, q.status)
        .await
        .map_err(|e| Error::Database(format!("list decisions: {e}")))?;
    Ok(Json(rows))
}

/// `POST /api/v1/org/boards/:board_id/decisions` — create.
#[utoipa::path(
    post,
    path = "/api/v1/org/boards/{board_id}/decisions",
    tag = "Org",
    params(("board_id" = Uuid, Path, description = "Board UUID")),
    request_body = CreateDecisionBody,
    responses(
        (status = 201, description = "Decision created", body = BoardDecision),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st, body))]
pub async fn create(
    State(st): State<AppState>,
    Path(board_id): Path<Uuid>,
    Json(body): Json<CreateDecisionBody>,
) -> Result<(StatusCode, Json<BoardDecision>)> {
    if body.title.trim().is_empty() {
        return Err(Error::BadRequest("title must not be empty".into()));
    }
    let row = BoardDecisionRepository::new(st.pool.inner())
        .create(
            body.tenant_id,
            board_id,
            body.title.trim(),
            body.description.as_deref(),
            body.attributes,
        )
        .await
        .map_err(|e| Error::Database(format!("create decision: {e}")))?;
    Ok((StatusCode::CREATED, Json(row)))
}

/// `PUT /api/v1/org/boards/:board_id/decisions/:id/status` — update status.
#[utoipa::path(
    put,
    path = "/api/v1/org/boards/{board_id}/decisions/{id}/status",
    tag = "Org",
    params(
        ("board_id" = Uuid, Path, description = "Board UUID"),
        ("id" = Uuid, Path, description = "Decision UUID"),
    ),
    request_body = UpdateStatusBody,
    responses(
        (status = 200, description = "Status updated", body = BoardDecision),
        (status = 404, description = "Decision not found"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st, body))]
pub async fn update_status(
    State(st): State<AppState>,
    Path((_board_id, id)): Path<(Uuid, Uuid)>,
    Json(body): Json<UpdateStatusBody>,
) -> Result<Json<BoardDecision>> {
    let row = BoardDecisionRepository::new(st.pool.inner())
        .update_status(id, body.status, body.decided_by_person_id)
        .await
        .map_err(|e| Error::Database(format!("update status: {e}")))?
        .ok_or_else(|| Error::NotFound(format!("decision {id}")))?;
    Ok(Json(row))
}

/// `DELETE /api/v1/org/boards/:board_id/decisions/:id` — delete.
#[utoipa::path(
    delete,
    path = "/api/v1/org/boards/{board_id}/decisions/{id}",
    tag = "Org",
    params(
        ("board_id" = Uuid, Path, description = "Board UUID"),
        ("id" = Uuid, Path, description = "Decision UUID"),
    ),
    responses(
        (status = 204, description = "Deleted"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn delete_decision(
    State(st): State<AppState>,
    Path((_board_id, id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode> {
    BoardDecisionRepository::new(st.pool.inner())
        .delete(id)
        .await
        .map_err(|e| Error::Database(format!("delete decision: {e}")))?;
    Ok(StatusCode::NO_CONTENT)
}

// ─── Handlers — votes ────────────────────────────────────────────────

/// `GET /api/v1/org/decisions/:decision_id/votes` — list votes.
#[utoipa::path(
    get,
    path = "/api/v1/org/decisions/{decision_id}/votes",
    tag = "Org",
    params(("decision_id" = Uuid, Path, description = "Decision UUID")),
    responses(
        (status = 200, description = "Votes list", body = Vec<BoardVote>),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn list_votes(
    State(st): State<AppState>,
    Path(decision_id): Path<Uuid>,
) -> Result<Json<Vec<BoardVote>>> {
    let rows = BoardDecisionRepository::new(st.pool.inner())
        .list_votes(decision_id)
        .await
        .map_err(|e| Error::Database(format!("list votes: {e}")))?;
    Ok(Json(rows))
}

/// `POST /api/v1/org/decisions/:decision_id/votes` — upsert vote.
#[utoipa::path(
    post,
    path = "/api/v1/org/decisions/{decision_id}/votes",
    tag = "Org",
    params(("decision_id" = Uuid, Path, description = "Decision UUID")),
    request_body = UpsertVoteBody,
    responses(
        (status = 200, description = "Vote recorded", body = BoardVote),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st, body))]
pub async fn upsert_vote(
    State(st): State<AppState>,
    Path(decision_id): Path<Uuid>,
    Json(body): Json<UpsertVoteBody>,
) -> Result<Json<BoardVote>> {
    let row = BoardDecisionRepository::new(st.pool.inner())
        .upsert_vote(
            body.tenant_id,
            decision_id,
            body.person_id,
            body.vote,
            body.rationale.as_deref(),
        )
        .await
        .map_err(|e| Error::Database(format!("upsert vote: {e}")))?;
    Ok(Json(row))
}

/// `DELETE /api/v1/org/decisions/:decision_id/votes/:vote_id` — delete vote.
#[utoipa::path(
    delete,
    path = "/api/v1/org/decisions/{decision_id}/votes/{vote_id}",
    tag = "Org",
    params(
        ("decision_id" = Uuid, Path, description = "Decision UUID"),
        ("vote_id" = Uuid, Path, description = "Vote UUID"),
    ),
    responses(
        (status = 204, description = "Deleted"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn delete_vote(
    State(st): State<AppState>,
    Path((_decision_id, vote_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode> {
    BoardDecisionRepository::new(st.pool.inner())
        .delete_vote(vote_id)
        .await
        .map_err(|e| Error::Database(format!("delete vote: {e}")))?;
    Ok(StatusCode::NO_CONTENT)
}
