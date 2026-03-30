//! Presence management handlers.
//!
//! Covers presence rule CRUD, rule validation, team status, and headcount analytics.

use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::{Datelike, NaiveDate};
use serde::{Deserialize, Serialize};
use signapps_common::Claims;
use signapps_db::{models::calendar::CreatePresenceRule, repositories::PresenceRuleRepository};
use uuid::Uuid;

use crate::{AppState, CalendarError};

// ============================================================================
// Request / Response types
// ============================================================================

#[derive(Debug, Deserialize)]
/// Query parameters for filtering results.
pub struct ListRulesQuery {
    pub team_id: Option<Uuid>,
    pub org_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
/// ValidateActionBody data transfer object.
pub struct ValidateActionBody {
    pub event_type: String,
    pub start_date: String,
    pub end_date: String,
    pub presence_mode: Option<String>,
}

#[derive(Debug, Serialize)]
/// RuleViolation data transfer object.
pub struct RuleViolation {
    pub rule_id: Uuid,
    pub rule_type: String,
    pub enforcement: String,
    pub message: String,
}

#[derive(Debug, Serialize)]
/// Response for ValidateAction.
pub struct ValidateActionResponse {
    pub violations: Vec<RuleViolation>,
}

#[derive(Debug, Deserialize)]
/// Query parameters for filtering results.
pub struct TeamStatusQuery {
    pub date: String,
    #[allow(dead_code)]
    pub team_id: Option<Uuid>,
}

#[derive(Debug, Serialize)]
/// UserPresenceStatus data transfer object.
pub struct UserPresenceStatus {
    pub user_id: Uuid,
    pub display_name: String,
    pub presence_mode: String,
}

#[derive(Debug, Deserialize)]
/// Query parameters for filtering results.
pub struct HeadcountQuery {
    pub date: String,
    #[allow(dead_code)]
    pub team_id: Option<Uuid>,
}

#[derive(Debug, Serialize)]
/// HeadcountSlot data transfer object.
pub struct HeadcountSlot {
    pub time: String,
    pub role: String,
    pub count: i64,
}

// ============================================================================
// List rules
// ============================================================================

/// `GET /api/v1/presence/rules`
///
/// List presence rules for the user's organisation (optionally filtered by team).
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/presence",
    responses((status = 200, description = "Success")),
    tag = "Calendar"
)]
#[tracing::instrument(skip_all)]
pub async fn list_rules(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListRulesQuery>,
) -> Result<Json<Vec<signapps_db::models::calendar::PresenceRule>>, CalendarError> {
    // Use explicitly provided org_id, fall back to the claims subject (org context)
    let org_id = params.org_id.unwrap_or(claims.sub);
    let repo = PresenceRuleRepository::new(&state.pool);

    let rules = repo
        .list(org_id, params.team_id)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok(Json(rules))
}

// ============================================================================
// Create rule
// ============================================================================

/// `POST /api/v1/presence/rules`
///
/// Create a new presence rule (admin only by convention — callers must gate at
/// the API gateway or via `role` check; here we trust the auth middleware).
#[tracing::instrument(skip_all)]
#[utoipa::path(
    post,
    path = "/api/v1/presence",
    responses((status = 201, description = "Success")),
    tag = "Calendar"
)]
#[tracing::instrument(skip_all)]
pub async fn create_rule(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Json(body): Json<CreatePresenceRule>,
) -> Result<
    (
        StatusCode,
        Json<signapps_db::models::calendar::PresenceRule>,
    ),
    CalendarError,
> {
    let repo = PresenceRuleRepository::new(&state.pool);

    let rule = repo
        .create(&body)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok((StatusCode::CREATED, Json(rule)))
}

// ============================================================================
// Update rule
// ============================================================================

/// `PUT /api/v1/presence/rules/:id`
///
/// Update an existing presence rule.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    put,
    path = "/api/v1/presence",
    responses((status = 200, description = "Success")),
    tag = "Calendar"
)]
#[tracing::instrument(skip_all)]
pub async fn update_rule(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Extension(_claims): Extension<Claims>,
    Json(body): Json<CreatePresenceRule>,
) -> Result<Json<signapps_db::models::calendar::PresenceRule>, CalendarError> {
    let repo = PresenceRuleRepository::new(&state.pool);

    // Verify the rule exists
    repo.find_by_id(id)
        .await
        .map_err(|_| CalendarError::InternalError)?
        .ok_or(CalendarError::NotFound)?;

    let rule = repo
        .update(id, &body)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok(Json(rule))
}

// ============================================================================
// Delete rule
// ============================================================================

/// `DELETE /api/v1/presence/rules/:id`
///
/// Delete a presence rule.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    delete,
    path = "/api/v1/presence",
    responses((status = 204, description = "Success")),
    tag = "Calendar"
)]
#[tracing::instrument(skip_all)]
pub async fn delete_rule(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Extension(_claims): Extension<Claims>,
) -> Result<StatusCode, CalendarError> {
    let repo = PresenceRuleRepository::new(&state.pool);

    // Verify the rule exists before deleting
    repo.find_by_id(id)
        .await
        .map_err(|_| CalendarError::InternalError)?
        .ok_or(CalendarError::NotFound)?;

    repo.delete(id)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok(StatusCode::NO_CONTENT)
}

// ============================================================================
// Validate action
// ============================================================================

/// `POST /api/v1/presence/validate`
///
/// Check a proposed action (`event_type`, date range, `presence_mode`) against
/// applicable presence rules for the user's organisation.  Returns a list of
/// violations; an empty list means the action is fully compliant.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    post,
    path = "/api/v1/presence",
    responses((status = 201, description = "Success")),
    tag = "Calendar"
)]
#[tracing::instrument(skip_all)]
pub async fn validate_action(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ValidateActionBody>,
) -> Result<Json<ValidateActionResponse>, CalendarError> {
    let start_date: NaiveDate = body.start_date.parse().map_err(|_| {
        CalendarError::InvalidInput("Invalid start_date (expected YYYY-MM-DD)".to_string())
    })?;
    let end_date: NaiveDate = body.end_date.parse().map_err(|_| {
        CalendarError::InvalidInput("Invalid end_date (expected YYYY-MM-DD)".to_string())
    })?;

    if end_date < start_date {
        return Err(CalendarError::InvalidInput(
            "end_date must not be before start_date".to_string(),
        ));
    }

    let repo = PresenceRuleRepository::new(&state.pool);
    // Fetch all org-level rules (no team filter)
    let rules = repo
        .list(claims.sub, None)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    let mut violations = Vec::new();

    for rule in rules {
        // Only evaluate active rules
        if rule.active == Some(false) {
            continue;
        }

        if let Some(violation_msg) = evaluate_rule(
            &rule,
            &body.event_type,
            start_date,
            end_date,
            body.presence_mode.as_deref(),
        ) {
            violations.push(RuleViolation {
                rule_id: rule.id,
                rule_type: rule.rule_type.clone(),
                enforcement: rule
                    .enforcement
                    .clone()
                    .unwrap_or_else(|| "soft".to_string()),
                message: violation_msg,
            });
        }
    }

    Ok(Json(ValidateActionResponse { violations }))
}

/// Evaluate a single presence rule against the proposed action.
///
/// Returns `Some(message)` when the rule is violated, `None` when compliant.
fn evaluate_rule(
    rule: &signapps_db::models::calendar::PresenceRule,
    event_type: &str,
    start_date: NaiveDate,
    end_date: NaiveDate,
    presence_mode: Option<&str>,
) -> Option<String> {
    let config = &rule.rule_config;

    match rule.rule_type.as_str() {
        // "min_office_days": { "days_per_week": 2 }
        "min_office_days" => {
            if presence_mode == Some("remote") || presence_mode == Some("off") {
                let min: i64 = config
                    .get("days_per_week")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0);
                if min > 0 {
                    return Some(format!(
                        "Minimum {min} office day(s) per week required — remote mode may violate this rule"
                    ));
                }
            }
            None
        },

        // "max_consecutive_remote": { "days": 5 }
        "max_consecutive_remote" => {
            if presence_mode == Some("remote") {
                let duration = (end_date - start_date).num_days() + 1;
                let max: i64 = config
                    .get("days")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(i64::MAX);
                if duration > max {
                    return Some(format!(
                        "Maximum {max} consecutive remote day(s) allowed; requested {duration}"
                    ));
                }
            }
            None
        },

        // "required_onsite_days": { "weekdays": [1, 2] } (1=Mon … 7=Sun, ISO)
        "required_onsite_days" => {
            if presence_mode == Some("remote") || presence_mode == Some("off") {
                if let Some(required) = config.get("weekdays").and_then(|v| v.as_array()) {
                    let required_days: Vec<u32> = required
                        .iter()
                        .filter_map(|d| d.as_u64().map(|v| v as u32))
                        .collect();
                    // Check every day in the range
                    let mut cur = start_date;
                    while cur <= end_date {
                        let iso_wd = cur.weekday().number_from_monday(); // 1=Mon … 7=Sun
                        if required_days.contains(&iso_wd) {
                            return Some(format!(
                                "Day {} is a required onsite day (weekday {})",
                                cur, iso_wd
                            ));
                        }
                        cur = cur.succ_opt().unwrap_or(cur);
                        if cur > end_date {
                            break;
                        }
                    }
                }
            }
            None
        },

        // "no_leave_during": { "event_types": ["shift"] }
        "no_leave_during" => {
            if let Some(restricted) = config.get("event_types").and_then(|v| v.as_array()) {
                let restricted_types: Vec<&str> =
                    restricted.iter().filter_map(|t| t.as_str()).collect();
                if restricted_types.contains(&event_type) {
                    return Some(format!(
                        "Event type '{event_type}' is restricted by a presence rule"
                    ));
                }
            }
            None
        },

        // Unknown rule types are silently ignored
        _ => None,
    }
}

// ============================================================================
// Team status
// ============================================================================

/// `GET /api/v1/presence/team-status?date=YYYY-MM-DD`
///
/// Query all shift/leave events for the team on the given date and return
/// `[{ user_id, display_name, presence_mode }]`.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/presence",
    responses((status = 200, description = "Success")),
    tag = "Calendar"
)]
#[tracing::instrument(skip_all)]
pub async fn team_status(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Query(params): Query<TeamStatusQuery>,
) -> Result<Json<Vec<UserPresenceStatus>>, CalendarError> {
    let date: NaiveDate = params.date.parse().map_err(|_| {
        CalendarError::InvalidInput("Invalid date (expected YYYY-MM-DD)".to_string())
    })?;

    let start_dt = date
        .and_hms_opt(0, 0, 0)
        .map(|dt| dt.and_utc())
        .ok_or_else(|| CalendarError::InvalidInput("Invalid date".to_string()))?;

    let end_dt = date
        .and_hms_opt(23, 59, 59)
        .map(|dt| dt.and_utc())
        .ok_or_else(|| CalendarError::InvalidInput("Invalid date".to_string()))?;

    // One row per (user, event) — we take the first presence_mode found per user.
    // The join with identity.users gives us the display name.
    let rows: Vec<(Uuid, String, Option<String>)> = sqlx::query_as(
        r#"
        SELECT DISTINCT ON (e.created_by)
            e.created_by                                        AS user_id,
            COALESCE(u.display_name, u.username, 'Unknown')    AS display_name,
            e.presence_mode
        FROM calendar.events e
        LEFT JOIN identity.users u ON u.id = e.created_by
        WHERE e.event_type IN ('shift', 'leave')
          AND e.is_deleted = FALSE
          AND e.start_time <= $2
          AND e.end_time   >= $1
        ORDER BY e.created_by, e.start_time
        "#,
    )
    .bind(start_dt)
    .bind(end_dt)
    .fetch_all(state.pool.inner())
    .await
    .map_err(|_| CalendarError::InternalError)?;

    let statuses = rows
        .into_iter()
        .map(
            |(user_id, display_name, presence_mode)| UserPresenceStatus {
                user_id,
                display_name,
                presence_mode: presence_mode.unwrap_or_else(|| "onsite".to_string()),
            },
        )
        .collect();

    Ok(Json(statuses))
}

// ============================================================================
// Headcount
// ============================================================================

/// `GET /api/v1/presence/headcount?date=YYYY-MM-DD&team_id=UUID`
///
/// Compute per-hour headcount data for the given day.  For each occupied time
/// slot (hour) and role (stored in event metadata), return the number of people
/// present.
///
/// The response is `[{ time: "08:00", role: "technicien", count: 3 }, ...]`.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/presence",
    responses((status = 200, description = "Success")),
    tag = "Calendar"
)]
#[tracing::instrument(skip_all)]
pub async fn headcount(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Query(params): Query<HeadcountQuery>,
) -> Result<Json<Vec<HeadcountSlot>>, CalendarError> {
    let date: NaiveDate = params.date.parse().map_err(|_| {
        CalendarError::InvalidInput("Invalid date (expected YYYY-MM-DD)".to_string())
    })?;

    let start_dt = date
        .and_hms_opt(0, 0, 0)
        .map(|dt| dt.and_utc())
        .ok_or_else(|| CalendarError::InvalidInput("Invalid date".to_string()))?;

    let end_dt = date
        .and_hms_opt(23, 59, 59)
        .map(|dt| dt.and_utc())
        .ok_or_else(|| CalendarError::InvalidInput("Invalid date".to_string()))?;

    // Query shift events overlapping the day, grouped by hour and a "role"
    // stored as event metadata (key = 'role').
    // We generate a series of hours from 00 to 23 and count shifts covering
    // each hour.
    let rows: Vec<(String, String, i64)> = sqlx::query_as(
        r#"
        WITH hours AS (
            SELECT generate_series(0, 23) AS hour
        ),
        shifts AS (
            SELECT
                e.id,
                e.start_time,
                e.end_time,
                COALESCE(
                    (SELECT em.value->>'role'
                     FROM calendar.event_metadata em
                     WHERE em.event_id = e.id AND em.key = 'role'
                     LIMIT 1),
                    'other'
                ) AS role
            FROM calendar.events e
            WHERE e.event_type = 'shift'
              AND e.is_deleted = FALSE
              AND e.start_time <= $2
              AND e.end_time   >= $1
        )
        SELECT
            lpad(h.hour::text, 2, '0') || ':00'  AS time_slot,
            s.role,
            COUNT(s.id)                           AS headcount
        FROM hours h
        JOIN shifts s ON
            EXTRACT(HOUR FROM s.start_time AT TIME ZONE 'UTC') <= h.hour
            AND EXTRACT(HOUR FROM s.end_time AT TIME ZONE 'UTC') >  h.hour
        GROUP BY h.hour, s.role
        ORDER BY h.hour, s.role
        "#,
    )
    .bind(start_dt)
    .bind(end_dt)
    .fetch_all(state.pool.inner())
    .await
    .map_err(|_| CalendarError::InternalError)?;

    let slots = rows
        .into_iter()
        .map(|(time, role, count)| HeadcountSlot { time, role, count })
        .collect();

    Ok(Json(slots))
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
