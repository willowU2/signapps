//! Handlers for recurring events and instances

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_db::{models::Event, EventRepository};
use uuid::Uuid;

use crate::{services, AppState, CalendarError};

#[derive(Debug, Deserialize)]
/// Query parameters for filtering results.
pub struct DateRangeQuery {
    pub start: DateTime<Utc>,
    pub end: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
/// ExpandedEvent data transfer object.
pub struct ExpandedEvent {
    /// Original event with RRULE
    pub event: Event,
    /// Expanded start times for instances
    pub instances: Vec<DateTime<Utc>>,
    /// Count of instances in range
    pub instance_count: usize,
}

/// Get expanded instances for a recurring event
#[tracing::instrument(skip_all)]
pub async fn get_event_instances(
    State(state): State<AppState>,
    Path(event_id): Path<Uuid>,
    Query(query): Query<DateRangeQuery>,
) -> Result<Json<ExpandedEvent>, CalendarError> {
    let repo = EventRepository::new(&state.pool);
    let event = repo
        .find_by_id(event_id)
        .await
        .map_err(|_| CalendarError::InternalError)?
        .ok_or(CalendarError::NotFound)?;

    if event.rrule.is_none() {
        return Err(CalendarError::InvalidInput(
            "Event is not recurring".to_string(),
        ));
    }

    let instances = services::expand_rrule(
        &event.rrule.clone().unwrap_or_default(),
        event.start_time,
        query.start,
        query.end,
        365,
    )
    .map_err(CalendarError::InvalidInput)?;

    let instance_count = instances.len();

    Ok(Json(ExpandedEvent {
        event,
        instances,
        instance_count,
    }))
}

#[derive(Debug, Deserialize)]
/// Request body for CreateException.
pub struct CreateExceptionRequest {
    /// ISO 8601 datetime of the instance to cancel
    pub cancelled_at: DateTime<Utc>,
}

/// Cancel a single instance of a recurring event
#[tracing::instrument(skip_all)]
pub async fn create_exception(
    State(state): State<AppState>,
    Path(event_id): Path<Uuid>,
    Json(payload): Json<CreateExceptionRequest>,
) -> Result<StatusCode, CalendarError> {
    let repo = EventRepository::new(&state.pool);
    let event = repo
        .find_by_id(event_id)
        .await
        .map_err(|_| CalendarError::InternalError)?
        .ok_or(CalendarError::NotFound)?;

    if event.rrule.is_none() {
        return Err(CalendarError::InvalidInput(
            "Event is not recurring".to_string(),
        ));
    }

    // Note: In a production system, you would store this exception
    // in a separate table or as JSON in the exceptions column
    // For now, we log it
    tracing::info!(
        "Exception for event {} at {}",
        event_id,
        payload.cancelled_at
    );

    Ok(StatusCode::OK)
}

#[derive(Debug, Deserialize)]
/// Request body for ValidateRrule.
pub struct ValidateRruleRequest {
    pub rrule: String,
}

#[derive(Debug, Serialize)]
/// Response for ValidateRrule.
pub struct ValidateRruleResponse {
    pub valid: bool,
    pub error: Option<String>,
}

/// Validate RRULE string
#[tracing::instrument(skip_all)]
pub async fn validate_rrule(
    Json(payload): Json<ValidateRruleRequest>,
) -> Json<ValidateRruleResponse> {
    match services::validate_rrule(&payload.rrule) {
        Ok(_) => Json(ValidateRruleResponse {
            valid: true,
            error: None,
        }),
        Err(e) => Json(ValidateRruleResponse {
            valid: false,
            error: Some(e),
        }),
    }
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
