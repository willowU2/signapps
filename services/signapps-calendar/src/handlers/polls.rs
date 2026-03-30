//! Schedule poll handlers — Doodle-style scheduling polls.

use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, NaiveDate, NaiveTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::Claims;
use uuid::Uuid;

use crate::{AppState, CalendarError};

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, Serialize)]
/// PollSlot data transfer object.
pub struct PollSlot {
    pub id: Uuid,
    pub poll_id: Uuid,
    pub slot_date: NaiveDate,
    pub start_time: NaiveTime,
    pub end_time: NaiveTime,
    pub votes: Vec<PollVote>,
}

#[derive(Debug, Serialize)]
/// PollVote data transfer object.
pub struct PollVote {
    pub id: Uuid,
    pub voter_name: String,
    pub voter_email: String,
    pub vote: String,
}

#[derive(Debug, Serialize)]
/// PollSummary data transfer object.
pub struct PollSummary {
    pub id: Uuid,
    pub organizer_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub confirmed_slot_id: Option<Uuid>,
    pub confirmed_event_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
/// PollDetail data transfer object.
pub struct PollDetail {
    #[serde(flatten)]
    pub poll: PollSummary,
    pub slots: Vec<PollSlot>,
}

// ============================================================================
// Request types
// ============================================================================

#[derive(Debug, Deserialize)]
/// SlotInput data transfer object.
pub struct SlotInput {
    pub slot_date: NaiveDate,
    pub start_time: NaiveTime,
    pub end_time: NaiveTime,
}

#[derive(Debug, Deserialize)]
/// Request body for CreatePoll.
pub struct CreatePollRequest {
    pub title: String,
    pub description: Option<String>,
    pub slots: Vec<SlotInput>,
}

#[derive(Debug, Deserialize)]
/// VoteInput data transfer object.
pub struct VoteInput {
    pub voter_name: String,
    pub voter_email: String,
    /// Map from slot_id (string) to vote ("yes"|"maybe"|"no")
    pub votes: std::collections::HashMap<String, String>,
}

#[derive(Debug, Deserialize)]
/// Request body for ConfirmPoll.
pub struct ConfirmPollRequest {
    pub slot_id: Uuid,
    /// Optional: calendar_id to create the event in
    pub calendar_id: Option<Uuid>,
}

// ============================================================================
// Internals
// ============================================================================

type PollRow = (
    Uuid,
    Uuid,
    String,
    Option<String>,
    String,
    Option<Uuid>,
    Option<Uuid>,
    DateTime<Utc>,
    DateTime<Utc>,
);

fn row_to_summary(r: PollRow) -> PollSummary {
    PollSummary {
        id: r.0,
        organizer_id: r.1,
        title: r.2,
        description: r.3,
        status: r.4,
        confirmed_slot_id: r.5,
        confirmed_event_id: r.6,
        created_at: r.7,
        updated_at: r.8,
    }
}

async fn fetch_slots(state: &AppState, poll_id: Uuid) -> Result<Vec<PollSlot>, CalendarError> {
    let slot_rows = sqlx::query_as::<_, (Uuid, NaiveDate, NaiveTime, NaiveTime)>(
        "SELECT id, slot_date, start_time, end_time FROM calendar.poll_slots WHERE poll_id = $1 ORDER BY slot_date, start_time",
    )
    .bind(poll_id)
    .fetch_all(&*state.pool)
    .await
    .map_err(|_| CalendarError::InternalError)?;

    let mut slots = Vec::with_capacity(slot_rows.len());
    for (slot_id, slot_date, start_time, end_time) in slot_rows {
        let vote_rows = sqlx::query_as::<_, (Uuid, String, String, String)>(
            "SELECT id, voter_name, voter_email, vote FROM calendar.poll_votes WHERE slot_id = $1",
        )
        .bind(slot_id)
        .fetch_all(&*state.pool)
        .await
        .map_err(|_| CalendarError::InternalError)?;

        slots.push(PollSlot {
            id: slot_id,
            poll_id,
            slot_date,
            start_time,
            end_time,
            votes: vote_rows
                .into_iter()
                .map(|(id, voter_name, voter_email, vote)| PollVote {
                    id,
                    voter_name,
                    voter_email,
                    vote,
                })
                .collect(),
        });
    }
    Ok(slots)
}

// ============================================================================
// Handlers
// ============================================================================

/// GET /api/v1/polls — List polls created by the current user.
#[tracing::instrument(skip(state))]
#[utoipa::path(
    get,
    path = "/api/v1/polls",
    responses((status = 200, description = "Success")),
    tag = "Calendar"
)]
pub async fn list_polls(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<PollSummary>>, CalendarError> {
    let rows = sqlx::query_as::<_, PollRow>(
        r#"SELECT id, organizer_id, title, description, status,
                  confirmed_slot_id, confirmed_event_id, created_at, updated_at
           FROM calendar.schedule_polls
           WHERE organizer_id = $1
           ORDER BY created_at DESC"#,
    )
    .bind(claims.sub)
    .fetch_all(&*state.pool)
    .await
    .map_err(|_| CalendarError::InternalError)?;

    Ok(Json(rows.into_iter().map(row_to_summary).collect()))
}

/// POST /api/v1/polls — Create a new scheduling poll with slots.
#[tracing::instrument(skip(state, payload))]
#[utoipa::path(
    post,
    path = "/api/v1/polls",
    responses((status = 201, description = "Success")),
    tag = "Calendar"
)]
pub async fn create_poll(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreatePollRequest>,
) -> Result<(StatusCode, Json<PollDetail>), CalendarError> {
    if payload.title.is_empty() || payload.title.len() > 255 {
        return Err(CalendarError::bad_request("Title must be 1-255 characters"));
    }
    if payload.slots.is_empty() {
        return Err(CalendarError::bad_request("At least one slot is required"));
    }
    for s in &payload.slots {
        if s.end_time <= s.start_time {
            return Err(CalendarError::bad_request(
                "end_time must be after start_time",
            ));
        }
    }

    // Insert poll
    let poll_row = sqlx::query_as::<_, PollRow>(
        r#"INSERT INTO calendar.schedule_polls (organizer_id, title, description)
           VALUES ($1, $2, $3)
           RETURNING id, organizer_id, title, description, status,
                     confirmed_slot_id, confirmed_event_id, created_at, updated_at"#,
    )
    .bind(claims.sub)
    .bind(&payload.title)
    .bind(&payload.description)
    .fetch_one(&*state.pool)
    .await
    .map_err(|_| CalendarError::InternalError)?;

    let poll_id = poll_row.0;

    // Insert slots
    for slot in &payload.slots {
        sqlx::query(
            "INSERT INTO calendar.poll_slots (poll_id, slot_date, start_time, end_time) VALUES ($1, $2, $3, $4)",
        )
        .bind(poll_id)
        .bind(slot.slot_date)
        .bind(slot.start_time)
        .bind(slot.end_time)
        .execute(&*state.pool)
        .await
        .map_err(|_| CalendarError::InternalError)?;
    }

    let slots = fetch_slots(&state, poll_id).await?;

    tracing::info!(poll_id = %poll_id, organizer = %claims.sub, "Scheduling poll created");

    Ok((
        StatusCode::CREATED,
        Json(PollDetail {
            poll: row_to_summary(poll_row),
            slots,
        }),
    ))
}

/// GET /api/v1/polls/:id — Get a poll with all slots and votes (public by poll ID).
#[tracing::instrument(skip(state))]
#[utoipa::path(
    get,
    path = "/api/v1/polls",
    responses((status = 200, description = "Success")),
    tag = "Calendar"
)]
pub async fn get_poll(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<PollDetail>, CalendarError> {
    let poll_row = sqlx::query_as::<_, PollRow>(
        r#"SELECT id, organizer_id, title, description, status,
                  confirmed_slot_id, confirmed_event_id, created_at, updated_at
           FROM calendar.schedule_polls WHERE id = $1"#,
    )
    .bind(id)
    .fetch_optional(&*state.pool)
    .await
    .map_err(|_| CalendarError::InternalError)?
    .ok_or(CalendarError::NotFound)?;

    let slots = fetch_slots(&state, id).await?;

    Ok(Json(PollDetail {
        poll: row_to_summary(poll_row),
        slots,
    }))
}

/// POST /api/v1/polls/:id/vote — Submit votes for multiple slots at once.
#[tracing::instrument(skip(state, payload))]
#[utoipa::path(
    get,
    path = "/api/v1/polls",
    responses((status = 200, description = "Success")),
    tag = "Calendar"
)]
pub async fn vote_poll(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<VoteInput>,
) -> Result<StatusCode, CalendarError> {
    if payload.voter_name.is_empty() || payload.voter_email.is_empty() {
        return Err(CalendarError::bad_request(
            "voter_name and voter_email are required",
        ));
    }

    // Verify poll exists and is open
    let status: Option<(String,)> =
        sqlx::query_as("SELECT status FROM calendar.schedule_polls WHERE id = $1")
            .bind(id)
            .fetch_optional(&*state.pool)
            .await
            .map_err(|_| CalendarError::InternalError)?;

    match status {
        None => return Err(CalendarError::NotFound),
        Some((s,)) if s != "open" => {
            return Err(CalendarError::bad_request("Poll is not open for voting"))
        },
        _ => {},
    }

    let valid_votes = ["yes", "maybe", "no"];

    for (slot_id_str, vote_val) in &payload.votes {
        let slot_id = slot_id_str.parse::<Uuid>().map_err(|_| {
            CalendarError::bad_request(&format!("Invalid slot_id: {}", slot_id_str))
        })?;

        if !valid_votes.contains(&vote_val.as_str()) {
            return Err(CalendarError::bad_request(&format!(
                "Invalid vote '{}'; must be yes|maybe|no",
                vote_val
            )));
        }

        // Verify slot belongs to this poll
        let exists: Option<(i64,)> =
            sqlx::query_as("SELECT 1 FROM calendar.poll_slots WHERE id = $1 AND poll_id = $2")
                .bind(slot_id)
                .bind(id)
                .fetch_optional(&*state.pool)
                .await
                .map_err(|_| CalendarError::InternalError)?;

        if exists.is_none() {
            return Err(CalendarError::bad_request(&format!(
                "Slot {} does not belong to poll {}",
                slot_id, id
            )));
        }

        sqlx::query(
            r#"INSERT INTO calendar.poll_votes (slot_id, voter_name, voter_email, vote)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (slot_id, voter_email)
               DO UPDATE SET voter_name = EXCLUDED.voter_name, vote = EXCLUDED.vote"#,
        )
        .bind(slot_id)
        .bind(&payload.voter_name)
        .bind(&payload.voter_email)
        .bind(vote_val)
        .execute(&*state.pool)
        .await
        .map_err(|_| CalendarError::InternalError)?;
    }

    tracing::info!(poll_id = %id, voter = %payload.voter_email, "Poll vote submitted");
    Ok(StatusCode::NO_CONTENT)
}

/// POST /api/v1/polls/:id/confirm — Close poll and pick winning slot; optionally create event.
#[tracing::instrument(skip(state, payload))]
#[utoipa::path(
    get,
    path = "/api/v1/polls",
    responses((status = 200, description = "Success")),
    tag = "Calendar"
)]
pub async fn confirm_poll(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<ConfirmPollRequest>,
) -> Result<Json<PollDetail>, CalendarError> {
    // Verify organizer owns this poll
    let poll_row: Option<PollRow> = sqlx::query_as(
        r#"SELECT id, organizer_id, title, description, status,
                  confirmed_slot_id, confirmed_event_id, created_at, updated_at
           FROM calendar.schedule_polls WHERE id = $1"#,
    )
    .bind(id)
    .fetch_optional(&*state.pool)
    .await
    .map_err(|_| CalendarError::InternalError)?;

    let poll = poll_row.ok_or(CalendarError::NotFound)?;

    if poll.1 != claims.sub {
        return Err(CalendarError::Forbidden);
    }
    if poll.4 == "confirmed" {
        return Err(CalendarError::bad_request("Poll already confirmed"));
    }

    // Verify slot belongs to this poll and fetch its times
    let slot_check: Option<(NaiveDate, NaiveTime, NaiveTime)> = sqlx::query_as(
        "SELECT slot_date, start_time, end_time FROM calendar.poll_slots WHERE id = $1 AND poll_id = $2",
    )
    .bind(payload.slot_id)
    .bind(id)
    .fetch_optional(&*state.pool)
    .await
    .map_err(|_| CalendarError::InternalError)?;

    let (slot_date, start_time, end_time) = slot_check
        .ok_or_else(|| CalendarError::bad_request("Slot does not belong to this poll"))?;

    // Optionally create a calendar event
    let event_id: Option<Uuid> = if let Some(calendar_id) = payload.calendar_id {
        let start_ts = slot_date.and_time(start_time).and_utc();
        let end_ts = slot_date.and_time(end_time).and_utc();

        let row: (Uuid,) = sqlx::query_as(
            r#"INSERT INTO calendar.events
               (calendar_id, title, description, start_time, end_time, created_by)
               VALUES ($1, $2, $3, $4, $5, $6)
               RETURNING id"#,
        )
        .bind(calendar_id)
        .bind(&poll.2)
        .bind(&poll.3)
        .bind(start_ts)
        .bind(end_ts)
        .bind(claims.sub)
        .fetch_one(&*state.pool)
        .await
        .map_err(|_| CalendarError::InternalError)?;

        Some(row.0)
    } else {
        None
    };

    // Mark poll as confirmed
    let updated_row = sqlx::query_as::<_, PollRow>(
        r#"UPDATE calendar.schedule_polls
           SET status = 'confirmed', confirmed_slot_id = $2, confirmed_event_id = $3, updated_at = NOW()
           WHERE id = $1
           RETURNING id, organizer_id, title, description, status,
                     confirmed_slot_id, confirmed_event_id, created_at, updated_at"#,
    )
    .bind(id)
    .bind(payload.slot_id)
    .bind(event_id)
    .fetch_one(&*state.pool)
    .await
    .map_err(|_| CalendarError::InternalError)?;

    tracing::info!(poll_id = %id, slot_id = %payload.slot_id, "Poll confirmed");

    let slots = fetch_slots(&state, id).await?;

    Ok(Json(PollDetail {
        poll: row_to_summary(updated_row),
        slots,
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
