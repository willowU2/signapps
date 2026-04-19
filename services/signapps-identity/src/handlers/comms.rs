//! Internal Communications endpoints — announcements, polls, news feed.
//!
//! Announcements and polls are stored in the `comms` schema using dedicated
//! tables with proper foreign keys. The news feed remains in the generic
//! `platform.comms_data` table for backwards compatibility.
//!
//! # Endpoints
//!
//! - `GET  /api/v1/comms/announcements`          — list (with read status)
//! - `POST /api/v1/comms/announcements`           — create
//! - `POST /api/v1/comms/announcements/:id/read`  — mark as read
//! - `POST /api/v1/comms/announcements/:id/acknowledge` — acknowledge
//! - `GET  /api/v1/comms/polls`                   — list polls
//! - `POST /api/v1/comms/polls`                   — create poll
//! - `POST /api/v1/comms/polls/:id/vote`          — cast vote
//! - `GET  /api/v1/comms/polls/:id/results`       — get results
//! - `GET  /api/v1/comms/news-feed`               — list news (legacy)
//! - `POST /api/v1/comms/news-feed`               — create news (legacy)

use crate::AppState;
use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use signapps_common::{Claims, Error, Result};
use uuid::Uuid;

// ── Announcement types ───────────────────────────────────────────────────────

/// Announcement returned to the client.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct AnnouncementResponse {
    /// Unique identifier.
    pub id: Uuid,
    /// Title of the announcement.
    pub title: String,
    /// Body content (markdown/HTML).
    pub content: String,
    /// UUID of the author.
    pub author_id: Uuid,
    /// Whether pinned to top.
    pub pinned: bool,
    /// Whether published (visible to audience).
    pub published: bool,
    /// Target audience — "all", group UUID, or department name.
    pub target_audience: String,
    /// Whether acknowledgement is required.
    pub requires_ack: bool,
    /// Scheduled publication time.
    pub publish_at: Option<DateTime<Utc>>,
    /// Expiration time.
    pub expires_at: Option<DateTime<Utc>>,
    /// Whether the current user has read this announcement.
    pub is_read: bool,
    /// Whether the current user has acknowledged this announcement.
    pub is_acknowledged: bool,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Last update timestamp.
    pub updated_at: DateTime<Utc>,
}

/// Request body for creating an announcement.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreateAnnouncementRequest {
    /// Title of the announcement.
    pub title: String,
    /// Body content (markdown/HTML).
    pub content: String,
    /// Pin to top of the list.
    #[serde(default)]
    pub pinned: bool,
    /// Publish immediately (default true).
    #[serde(default = "default_true")]
    pub published: bool,
    /// Target audience filter.
    #[serde(default = "default_audience")]
    pub target_audience: String,
    /// Whether acknowledgement is required.
    #[serde(default)]
    pub requires_ack: bool,
    /// Scheduled publication time.
    pub publish_at: Option<DateTime<Utc>>,
    /// Expiration time.
    pub expires_at: Option<DateTime<Utc>>,
}

fn default_true() -> bool {
    true
}
fn default_audience() -> String {
    "all".to_string()
}

// ── Poll types ───────────────────────────────────────────────────────────────

/// Poll returned to the client.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct PollResponse {
    /// Unique identifier.
    pub id: Uuid,
    /// Poll question.
    pub question: String,
    /// Options as JSON array of `{id, text}`.
    pub options: Value,
    /// Whether multiple choices are allowed.
    pub multiple_choice: bool,
    /// Whether votes are anonymous.
    pub anonymous: bool,
    /// UUID of the author.
    pub author_id: Uuid,
    /// Voting deadline.
    pub deadline: Option<DateTime<Utc>>,
    /// Status: "active" or "closed".
    pub status: String,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
}

/// Request body for creating a poll.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreatePollRequest {
    /// Poll question.
    pub question: String,
    /// Options as JSON array of `{id, text}`.
    pub options: Value,
    /// Allow multiple choices.
    #[serde(default)]
    pub multiple_choice: bool,
    /// Anonymous voting.
    #[serde(default)]
    pub anonymous: bool,
    /// Voting deadline.
    pub deadline: Option<DateTime<Utc>>,
}

/// Request body for casting a vote.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CastVoteRequest {
    /// Option UUID(s) to vote for.
    pub option_ids: Vec<Uuid>,
}

/// Poll results returned to the client.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct PollResultsResponse {
    /// Poll metadata.
    pub poll: PollResponse,
    /// Vote tallies per option.
    pub tallies: Vec<PollOptionTally>,
    /// Total number of voters.
    pub total_voters: i64,
}

/// Vote count for a single option.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct PollOptionTally {
    /// Option UUID.
    pub option_id: Uuid,
    /// Number of votes.
    pub count: i64,
}

// ── Legacy news-feed types ───────────────────────────────────────────────────

/// Generic comms record returned to the client (news feed).
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct CommsRecord {
    /// Unique identifier.
    pub id: Uuid,
    /// Entity type discriminant.
    pub entity_type: String,
    /// JSON payload.
    pub data: Value,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Last update timestamp.
    pub updated_at: DateTime<Utc>,
}

#[derive(sqlx::FromRow)]
struct CommsRow {
    id: Uuid,
    entity_type: String,
    data: Value,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl From<CommsRow> for CommsRecord {
    fn from(r: CommsRow) -> Self {
        CommsRecord {
            id: r.id,
            entity_type: r.entity_type,
            data: r.data,
            created_at: r.created_at,
            updated_at: r.updated_at,
        }
    }
}

// ── Legacy DB helpers ────────────────────────────────────────────────────────

async fn ensure_table(pool: &signapps_db::DatabasePool) -> Result<()> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS platform.comms_data (
            id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            entity_type  VARCHAR(64) NOT NULL,
            data         JSONB       NOT NULL DEFAULT '{}',
            created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        "#,
    )
    .execute(pool.inner())
    .await
    .map_err(|e| Error::Internal(format!("ensure comms table: {}", e)))?;
    Ok(())
}

async fn insert_row(
    pool: &signapps_db::DatabasePool,
    entity_type: &str,
    data: &Value,
) -> Result<CommsRow> {
    if let Err(e) = ensure_table(pool).await {
        tracing::warn!("comms_data ensure failed: {}", e);
    }
    let row: CommsRow = sqlx::query_as(
        r#"
        INSERT INTO platform.comms_data (entity_type, data)
        VALUES ($1, $2)
        RETURNING *
        "#,
    )
    .bind(entity_type)
    .bind(data)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| Error::Internal(format!("comms insert: {}", e)))?;
    Ok(row)
}

async fn list_rows(pool: &signapps_db::DatabasePool, entity_type: &str) -> Result<Vec<CommsRow>> {
    if let Err(e) = ensure_table(pool).await {
        tracing::warn!("comms_data ensure failed: {}", e);
    }
    let rows: Vec<CommsRow> = sqlx::query_as(
        "SELECT * FROM platform.comms_data WHERE entity_type = $1 ORDER BY created_at DESC",
    )
    .bind(entity_type)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| Error::Internal(format!("comms list: {}", e)))?;
    Ok(rows)
}

// ── Announcement handlers ────────────────────────────────────────────────────

/// `GET /api/v1/comms/announcements` — list announcements with read status.
///
/// Returns all published announcements ordered by pinned status then recency,
/// with `is_read` and `is_acknowledged` flags for the authenticated user.
///
/// # Errors
///
/// Returns `Error::Internal` if the database query fails.
#[utoipa::path(
    get,
    path = "/api/v1/comms/announcements",
    tag = "comms",
    security(("bearerAuth" = [])),
    responses(
        (status = 200, description = "List of announcements", body = Vec<AnnouncementResponse>),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all, fields(user_id))]
pub async fn list_announcements(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<AnnouncementResponse>>> {
    tracing::Span::current().record("user_id", tracing::field::display(claims.sub));

    let rows = sqlx::query_as::<
        _,
        (
            Uuid,
            String,
            String,
            Uuid,
            bool,
            bool,
            String,
            bool,
            Option<DateTime<Utc>>,
            Option<DateTime<Utc>>,
            DateTime<Utc>,
            DateTime<Utc>,
            Option<DateTime<Utc>>,
            Option<bool>,
        ),
    >(
        r#"SELECT
            a.id, a.title, a.content, a.author_id, a.pinned, a.published,
            a.target_audience, a.requires_ack, a.publish_at, a.expires_at,
            a.created_at, a.updated_at,
            ar.read_at, ar.acknowledged
        FROM comms.announcements a
        LEFT JOIN comms.announcement_reads ar
            ON ar.announcement_id = a.id AND ar.user_id = $1
        WHERE a.published = true
        ORDER BY a.pinned DESC, a.created_at DESC"#,
    )
    .bind(claims.sub)
    .fetch_all(&*state.pool)
    .await
    .map_err(|e| Error::Internal(format!("list announcements: {e}")))?;

    let items = rows
        .into_iter()
        .map(|r| AnnouncementResponse {
            id: r.0,
            title: r.1,
            content: r.2,
            author_id: r.3,
            pinned: r.4,
            published: r.5,
            target_audience: r.6,
            requires_ack: r.7,
            publish_at: r.8,
            expires_at: r.9,
            created_at: r.10,
            updated_at: r.11,
            is_read: r.12.is_some(),
            is_acknowledged: r.13.unwrap_or(false),
        })
        .collect();

    Ok(Json(items))
}

/// `POST /api/v1/comms/announcements` — create a new announcement.
///
/// The `author_id` is set from the authenticated user's claims.
///
/// # Errors
///
/// Returns `Error::Internal` if the database insert fails.
#[utoipa::path(
    post,
    path = "/api/v1/comms/announcements",
    tag = "comms",
    security(("bearerAuth" = [])),
    request_body = CreateAnnouncementRequest,
    responses(
        (status = 201, description = "Announcement created", body = AnnouncementResponse),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all, fields(user_id))]
pub async fn create_announcement(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateAnnouncementRequest>,
) -> Result<(StatusCode, Json<AnnouncementResponse>)> {
    tracing::Span::current().record("user_id", tracing::field::display(claims.sub));

    let row = sqlx::query_as::<
        _,
        (
            Uuid,
            String,
            String,
            Uuid,
            bool,
            bool,
            String,
            bool,
            Option<DateTime<Utc>>,
            Option<DateTime<Utc>>,
            DateTime<Utc>,
            DateTime<Utc>,
        ),
    >(
        r#"INSERT INTO comms.announcements
            (title, content, author_id, pinned, published, target_audience,
             requires_ack, publish_at, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, title, content, author_id, pinned, published,
                  target_audience, requires_ack, publish_at, expires_at,
                  created_at, updated_at"#,
    )
    .bind(&body.title)
    .bind(&body.content)
    .bind(claims.sub)
    .bind(body.pinned)
    .bind(body.published)
    .bind(&body.target_audience)
    .bind(body.requires_ack)
    .bind(body.publish_at)
    .bind(body.expires_at)
    .fetch_one(&*state.pool)
    .await
    .map_err(|e| Error::Internal(format!("create announcement: {e}")))?;

    tracing::info!(announcement_id = %row.0, "announcement created");

    Ok((
        StatusCode::CREATED,
        Json(AnnouncementResponse {
            id: row.0,
            title: row.1,
            content: row.2,
            author_id: row.3,
            pinned: row.4,
            published: row.5,
            target_audience: row.6,
            requires_ack: row.7,
            publish_at: row.8,
            expires_at: row.9,
            created_at: row.10,
            updated_at: row.11,
            is_read: false,
            is_acknowledged: false,
        }),
    ))
}

/// `POST /api/v1/comms/announcements/:id/read` — mark announcement as read.
///
/// Upserts a read record for the current user. Idempotent.
///
/// # Errors
///
/// Returns `Error::Internal` if the database upsert fails.
#[utoipa::path(
    post,
    path = "/api/v1/comms/announcements/{id}/read",
    tag = "comms",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Announcement UUID")),
    responses(
        (status = 204, description = "Marked as read"),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Announcement not found"),
    )
)]
#[tracing::instrument(skip_all, fields(user_id, announcement_id = %id))]
pub async fn mark_read(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    tracing::Span::current().record("user_id", tracing::field::display(claims.sub));

    // Verify announcement exists
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM comms.announcements WHERE id = $1)",
    )
    .bind(id)
    .fetch_one(&*state.pool)
    .await
    .map_err(|e| Error::Internal(format!("check announcement: {e}")))?;

    if !exists {
        return Err(Error::NotFound("Announcement not found".to_string()));
    }

    sqlx::query(
        r#"INSERT INTO comms.announcement_reads (announcement_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT (announcement_id, user_id) DO UPDATE SET read_at = NOW()"#,
    )
    .bind(id)
    .bind(claims.sub)
    .execute(&*state.pool)
    .await
    .map_err(|e| Error::Internal(format!("mark read: {e}")))?;

    Ok(StatusCode::NO_CONTENT)
}

/// `POST /api/v1/comms/announcements/:id/acknowledge` — acknowledge announcement.
///
/// Sets `acknowledged = true` for the current user's read record.
/// Creates the read record if it does not exist yet.
///
/// # Errors
///
/// Returns `Error::NotFound` if the announcement does not exist.
/// Returns `Error::Internal` on database failure.
#[utoipa::path(
    post,
    path = "/api/v1/comms/announcements/{id}/acknowledge",
    tag = "comms",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Announcement UUID")),
    responses(
        (status = 204, description = "Acknowledged"),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Announcement not found"),
    )
)]
#[tracing::instrument(skip_all, fields(user_id, announcement_id = %id))]
pub async fn acknowledge(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    tracing::Span::current().record("user_id", tracing::field::display(claims.sub));

    // Verify announcement exists
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM comms.announcements WHERE id = $1)",
    )
    .bind(id)
    .fetch_one(&*state.pool)
    .await
    .map_err(|e| Error::Internal(format!("check announcement: {e}")))?;

    if !exists {
        return Err(Error::NotFound("Announcement not found".to_string()));
    }

    sqlx::query(
        r#"INSERT INTO comms.announcement_reads (announcement_id, user_id, acknowledged)
        VALUES ($1, $2, true)
        ON CONFLICT (announcement_id, user_id)
        DO UPDATE SET acknowledged = true, read_at = NOW()"#,
    )
    .bind(id)
    .bind(claims.sub)
    .execute(&*state.pool)
    .await
    .map_err(|e| Error::Internal(format!("acknowledge: {e}")))?;

    tracing::info!("announcement acknowledged");
    Ok(StatusCode::NO_CONTENT)
}

// ── Poll handlers ────────────────────────────────────────────────────────────

/// `GET /api/v1/comms/polls` — list all polls.
///
/// Returns polls ordered by creation date (newest first).
///
/// # Errors
///
/// Returns `Error::Internal` if the database query fails.
#[utoipa::path(
    get,
    path = "/api/v1/comms/polls",
    tag = "comms",
    security(("bearerAuth" = [])),
    responses(
        (status = 200, description = "List of polls", body = Vec<PollResponse>),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn list_polls(State(state): State<AppState>) -> Result<Json<Vec<PollResponse>>> {
    let rows = sqlx::query_as::<
        _,
        (
            Uuid,
            String,
            Value,
            bool,
            bool,
            Uuid,
            Option<DateTime<Utc>>,
            String,
            DateTime<Utc>,
        ),
    >(
        r#"SELECT id, question, options, multiple_choice, anonymous,
                  author_id, deadline, status, created_at
           FROM comms.polls
           ORDER BY created_at DESC"#,
    )
    .fetch_all(&*state.pool)
    .await
    .map_err(|e| Error::Internal(format!("list polls: {e}")))?;

    let items = rows
        .into_iter()
        .map(|r| PollResponse {
            id: r.0,
            question: r.1,
            options: r.2,
            multiple_choice: r.3,
            anonymous: r.4,
            author_id: r.5,
            deadline: r.6,
            status: r.7,
            created_at: r.8,
        })
        .collect();

    Ok(Json(items))
}

/// `POST /api/v1/comms/polls` — create a new poll.
///
/// The `author_id` is set from the authenticated user's claims.
///
/// # Errors
///
/// Returns `Error::Internal` if the database insert fails.
#[utoipa::path(
    post,
    path = "/api/v1/comms/polls",
    tag = "comms",
    security(("bearerAuth" = [])),
    request_body = CreatePollRequest,
    responses(
        (status = 201, description = "Poll created", body = PollResponse),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all, fields(user_id))]
pub async fn create_poll(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreatePollRequest>,
) -> Result<(StatusCode, Json<PollResponse>)> {
    tracing::Span::current().record("user_id", tracing::field::display(claims.sub));

    let row = sqlx::query_as::<
        _,
        (
            Uuid,
            String,
            Value,
            bool,
            bool,
            Uuid,
            Option<DateTime<Utc>>,
            String,
            DateTime<Utc>,
        ),
    >(
        r#"INSERT INTO comms.polls
            (question, options, multiple_choice, anonymous, author_id, deadline)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, question, options, multiple_choice, anonymous,
                  author_id, deadline, status, created_at"#,
    )
    .bind(&body.question)
    .bind(&body.options)
    .bind(body.multiple_choice)
    .bind(body.anonymous)
    .bind(claims.sub)
    .bind(body.deadline)
    .fetch_one(&*state.pool)
    .await
    .map_err(|e| Error::Internal(format!("create poll: {e}")))?;

    tracing::info!(poll_id = %row.0, "poll created");

    Ok((
        StatusCode::CREATED,
        Json(PollResponse {
            id: row.0,
            question: row.1,
            options: row.2,
            multiple_choice: row.3,
            anonymous: row.4,
            author_id: row.5,
            deadline: row.6,
            status: row.7,
            created_at: row.8,
        }),
    ))
}

/// `POST /api/v1/comms/polls/:id/vote` — cast a vote on a poll.
///
/// For single-choice polls, existing votes are replaced. For multiple-choice
/// polls, each option is inserted (duplicates are ignored).
///
/// # Errors
///
/// Returns `Error::NotFound` if the poll does not exist.
/// Returns `Error::BadRequest` if the poll is closed.
/// Returns `Error::Internal` on database failure.
#[utoipa::path(
    post,
    path = "/api/v1/comms/polls/{id}/vote",
    tag = "comms",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Poll UUID")),
    request_body = CastVoteRequest,
    responses(
        (status = 204, description = "Vote recorded"),
        (status = 400, description = "Poll is closed or invalid options"),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Poll not found"),
    )
)]
#[tracing::instrument(skip_all, fields(user_id, poll_id = %id))]
pub async fn cast_vote(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CastVoteRequest>,
) -> Result<StatusCode> {
    tracing::Span::current().record("user_id", tracing::field::display(claims.sub));

    // Verify poll exists and is active
    let poll = sqlx::query_as::<_, (String, bool)>(
        "SELECT status, multiple_choice FROM comms.polls WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&*state.pool)
    .await
    .map_err(|e| Error::Internal(format!("check poll: {e}")))?;

    let (status, multiple_choice) = match poll {
        Some(p) => p,
        None => return Err(Error::NotFound("Poll not found".to_string())),
    };

    if status != "active" {
        return Err(Error::BadRequest("Poll is closed".to_string()));
    }

    if !multiple_choice && body.option_ids.len() > 1 {
        return Err(Error::BadRequest(
            "Single-choice poll: only one option allowed".to_string(),
        ));
    }

    // For single-choice: remove previous votes first
    if !multiple_choice {
        sqlx::query("DELETE FROM comms.poll_votes WHERE poll_id = $1 AND user_id = $2")
            .bind(id)
            .bind(claims.sub)
            .execute(&*state.pool)
            .await
            .map_err(|e| Error::Internal(format!("clear votes: {e}")))?;
    }

    // Insert each vote (ON CONFLICT ignore for idempotency)
    for option_id in &body.option_ids {
        sqlx::query(
            r#"INSERT INTO comms.poll_votes (poll_id, user_id, option_id)
            VALUES ($1, $2, $3)
            ON CONFLICT (poll_id, user_id, option_id) DO NOTHING"#,
        )
        .bind(id)
        .bind(claims.sub)
        .bind(option_id)
        .execute(&*state.pool)
        .await
        .map_err(|e| Error::Internal(format!("insert vote: {e}")))?;
    }

    tracing::info!(options = ?body.option_ids, "vote cast");
    Ok(StatusCode::NO_CONTENT)
}

/// `GET /api/v1/comms/polls/:id/results` — get poll results.
///
/// Returns the poll metadata along with vote tallies per option.
///
/// # Errors
///
/// Returns `Error::NotFound` if the poll does not exist.
/// Returns `Error::Internal` on database failure.
#[utoipa::path(
    get,
    path = "/api/v1/comms/polls/{id}/results",
    tag = "comms",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Poll UUID")),
    responses(
        (status = 200, description = "Poll results", body = PollResultsResponse),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Poll not found"),
    )
)]
#[tracing::instrument(skip_all, fields(poll_id = %id))]
pub async fn poll_results(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<PollResultsResponse>> {
    // Fetch the poll
    let poll_row = sqlx::query_as::<
        _,
        (
            Uuid,
            String,
            Value,
            bool,
            bool,
            Uuid,
            Option<DateTime<Utc>>,
            String,
            DateTime<Utc>,
        ),
    >(
        r#"SELECT id, question, options, multiple_choice, anonymous,
                  author_id, deadline, status, created_at
           FROM comms.polls WHERE id = $1"#,
    )
    .bind(id)
    .fetch_optional(&*state.pool)
    .await
    .map_err(|e| Error::Internal(format!("fetch poll: {e}")))?;

    let poll_row = match poll_row {
        Some(r) => r,
        None => return Err(Error::NotFound("Poll not found".to_string())),
    };

    let poll = PollResponse {
        id: poll_row.0,
        question: poll_row.1,
        options: poll_row.2,
        multiple_choice: poll_row.3,
        anonymous: poll_row.4,
        author_id: poll_row.5,
        deadline: poll_row.6,
        status: poll_row.7,
        created_at: poll_row.8,
    };

    // Fetch tallies
    let tallies = sqlx::query_as::<_, (Uuid, i64)>(
        r#"SELECT option_id, COUNT(*) as count
           FROM comms.poll_votes WHERE poll_id = $1
           GROUP BY option_id"#,
    )
    .bind(id)
    .fetch_all(&*state.pool)
    .await
    .map_err(|e| Error::Internal(format!("poll tallies: {e}")))?
    .into_iter()
    .map(|(option_id, count)| PollOptionTally { option_id, count })
    .collect();

    // Total unique voters
    let total_voters = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(DISTINCT user_id) FROM comms.poll_votes WHERE poll_id = $1",
    )
    .bind(id)
    .fetch_one(&*state.pool)
    .await
    .map_err(|e| Error::Internal(format!("total voters: {e}")))?;

    Ok(Json(PollResultsResponse {
        poll,
        tallies,
        total_voters,
    }))
}

// ── Legacy news feed (kept for backwards compat) ─────────────────────────────

/// `GET /api/v1/comms/news-feed` — list news posts.
///
/// # Errors
///
/// Returns `Error::Internal` if the database query fails.
#[utoipa::path(
    get,
    path = "/api/v1/comms/news-feed",
    tag = "comms",
    security(("bearerAuth" = [])),
    responses(
        (status = 200, description = "List of news posts", body = Vec<CommsRecord>),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn list_news(State(state): State<AppState>) -> Result<Json<Vec<CommsRecord>>> {
    let rows = list_rows(&state.pool, "news_post").await?;
    Ok(Json(rows.into_iter().map(CommsRecord::from).collect()))
}

/// `POST /api/v1/comms/news-feed` — create news post.
///
/// # Errors
///
/// Returns `Error::Internal` if the database insert fails.
#[utoipa::path(
    post,
    path = "/api/v1/comms/news-feed",
    tag = "comms",
    security(("bearerAuth" = [])),
    request_body(content = serde_json::Value, description = "News post data"),
    responses(
        (status = 201, description = "News post created", body = CommsRecord),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn create_news(
    State(state): State<AppState>,
    Json(body): Json<Value>,
) -> Result<(StatusCode, Json<CommsRecord>)> {
    let row = insert_row(&state.pool, "news_post", &body).await?;
    Ok((StatusCode::CREATED, Json(row.into())))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn module_compiles() {
        // Placeholder: ensures the module compiles.
        let _ = module_path!();
    }

    #[test]
    fn default_audience_is_all() {
        assert_eq!(default_audience(), "all");
    }

    #[test]
    fn default_true_returns_true() {
        assert!(default_true());
    }
}
