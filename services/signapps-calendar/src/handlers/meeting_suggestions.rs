//! Smart meeting time suggestions — IDEA-105
//!
//! POST /api/v1/calendar/meeting-suggestions
//!
//! Analyses calendar availability for a set of participants and returns
//! ranked time slots that minimise conflicts.

use axum::{extract::State, http::StatusCode, Json};
use chrono::{DateTime, Datelike, Duration, TimeZone, Timelike, Utc, Weekday};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::AppState;

// ─────────────────────────────────────────────────────────────────────────────
// Request / Response types
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct MeetingSuggestionsRequest {
    /// Participant user IDs to check calendars for.
    pub participant_ids: Vec<Uuid>,
    /// Preferred meeting duration in minutes.
    pub duration_minutes: i64,
    /// Earliest acceptable meeting start (ISO 8601).
    pub search_from: DateTime<Utc>,
    /// Latest acceptable meeting end (ISO 8601).
    pub search_until: DateTime<Utc>,
    /// Preferred working hours start (24-h, e.g. 9). Defaults to 9.
    pub work_start_hour: Option<u32>,
    /// Preferred working hours end (24-h, e.g. 18). Defaults to 18.
    pub work_end_hour: Option<u32>,
    /// Maximum number of suggestions to return. Defaults to 5.
    pub max_suggestions: Option<usize>,
}

#[derive(Debug, Serialize)]
pub struct TimeSlot {
    pub start: DateTime<Utc>,
    pub end: DateTime<Utc>,
    /// 0.0–1.0 score (1.0 = perfect, no conflicts).
    pub score: f32,
    /// Number of participants who have a conflict in this slot.
    pub conflicts: usize,
    /// IDs of participants with conflicting events.
    pub conflicted_participants: Vec<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct MeetingSuggestionsResponse {
    pub slots: Vec<TimeSlot>,
    pub participants_checked: usize,
    pub search_range_days: i64,
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

/// POST /api/v1/calendar/meeting-suggestions
#[tracing::instrument(skip_all)]
pub async fn suggest_meeting_times(
    State(state): State<AppState>,
    Json(req): Json<MeetingSuggestionsRequest>,
) -> Result<Json<MeetingSuggestionsResponse>, (StatusCode, String)> {
    let duration = Duration::minutes(req.duration_minutes.max(15));
    let work_start = req.work_start_hour.unwrap_or(9);
    let work_end = req.work_end_hour.unwrap_or(18);
    let max_suggestions = req.max_suggestions.unwrap_or(5).min(20);
    let n_participants = req.participant_ids.len();

    if req.participant_ids.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "No participants specified".to_string(),
        ));
    }
    if req.search_from >= req.search_until {
        return Err((
            StatusCode::BAD_REQUEST,
            "search_from must be before search_until".to_string(),
        ));
    }

    // Query all busy intervals for participants within the search range.
    // We collect (start, end, user_id) rows from the events table.
    let pool = state.pool.inner();

    #[derive(sqlx::FromRow)]
    struct BusyRow {
        user_id: Uuid,
        start_time: DateTime<Utc>,
        end_time: DateTime<Utc>,
    }

    let rows = sqlx::query_as::<_, BusyRow>(
        r#"
        SELECT ea.user_id, e.start_time, e.end_time
        FROM calendar.event_attendees ea
        JOIN calendar.events e ON e.id = ea.event_id
        WHERE ea.user_id = ANY($1)
          AND e.start_time < $3
          AND e.end_time   > $2
          AND e.is_deleted = FALSE
        "#,
    )
    .bind(&req.participant_ids)
    .bind(req.search_from)
    .bind(req.search_until)
    .fetch_all(pool)
    .await
    .map_err(|e| {
        tracing::warn!("meeting suggestions DB query failed: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
    })?;

    let busy: Vec<(DateTime<Utc>, DateTime<Utc>, Uuid)> = rows
        .into_iter()
        .map(|r| (r.start_time, r.end_time, r.user_id))
        .collect();

    // Enumerate candidate slots (step = duration / 2, clamped to 15 min min)
    let step = std::cmp::max(duration / 2, Duration::minutes(15));
    let mut candidates: Vec<TimeSlot> = Vec::new();
    let mut cursor = round_up_to_slot(req.search_from, work_start);

    while cursor + duration <= req.search_until {
        let slot_start = cursor;
        let slot_end = cursor + duration;

        // Skip outside working hours or weekends
        let local_hour = slot_start.hour();
        let weekday = slot_start.weekday();
        if local_hour < work_start
            || local_hour + (req.duration_minutes as u32 / 60) > work_end
            || weekday == Weekday::Sat
            || weekday == Weekday::Sun
        {
            // Jump to next working day start
            cursor = next_work_slot(cursor, work_start);
            continue;
        }

        // Count conflicts
        let conflicted: Vec<Uuid> = req
            .participant_ids
            .iter()
            .filter(|uid| {
                busy.iter()
                    .any(|(bs, be, bid)| bid == *uid && *bs < slot_end && *be > slot_start)
            })
            .copied()
            .collect();

        let conflict_count = conflicted.len();
        let score = 1.0 - (conflict_count as f32 / n_participants as f32);

        candidates.push(TimeSlot {
            start: slot_start,
            end: slot_end,
            score,
            conflicts: conflict_count,
            conflicted_participants: conflicted,
        });

        cursor += step;
    }

    // Sort by score desc, then by start asc
    candidates.sort_by(|a, b| {
        b.score
            .partial_cmp(&a.score)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then(a.start.cmp(&b.start))
    });

    let search_range_days = (req.search_until - req.search_from).num_days();
    let slots: Vec<TimeSlot> = candidates.into_iter().take(max_suggestions).collect();

    Ok(Json(MeetingSuggestionsResponse {
        slots,
        participants_checked: n_participants,
        search_range_days,
    }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

fn round_up_to_slot(dt: DateTime<Utc>, work_start_hour: u32) -> DateTime<Utc> {
    let hour = work_start_hour.min(23);
    let Some(naive) = dt.naive_utc().date().and_hms_opt(hour, 0, 0) else {
        return dt;
    };
    let candidate = Utc.from_utc_datetime(&naive);
    if candidate > dt {
        candidate
    } else {
        dt
    }
}

fn next_work_slot(dt: DateTime<Utc>, work_start_hour: u32) -> DateTime<Utc> {
    let hour = work_start_hour.min(23);
    let tomorrow = dt.date_naive().succ_opt().unwrap_or(dt.date_naive());
    let naive = match tomorrow.and_hms_opt(hour, 0, 0) {
        Some(n) => n,
        None => return dt,
    };
    Utc.from_utc_datetime(&naive)
}
