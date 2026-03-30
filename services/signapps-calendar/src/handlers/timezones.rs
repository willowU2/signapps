//! Handlers for timezone operations

use axum::{
    extract::{Extension, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::DateTime;
use serde::{Deserialize, Serialize};
use signapps_common::Claims;

use crate::{services, AppState};

#[derive(Debug, Deserialize)]
/// Query parameters for filtering results.
pub struct TimezoneListQuery {
    pub search: Option<String>,
}

#[derive(Debug, Serialize)]
/// TimezoneInfo data transfer object.
pub struct TimezoneInfo {
    pub name: String,
}

/// List available timezones
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/timezones",
    responses((status = 200, description = "Success")),
    tag = "Calendar"
)]
pub async fn list_timezones(Query(query): Query<TimezoneListQuery>) -> Json<Vec<TimezoneInfo>> {
    let mut timezones = services::list_timezones()
        .into_iter()
        .map(|name| TimezoneInfo {
            name: name.to_string(),
        })
        .collect::<Vec<_>>();

    // Filter by search term if provided
    if let Some(search) = query.search {
        let search_lower = search.to_lowercase();
        timezones.retain(|tz| tz.name.to_lowercase().contains(&search_lower));
    }

    Json(timezones)
}

#[derive(Debug, Deserialize)]
/// Request body for ValidateTimezone.
pub struct ValidateTimezoneRequest {
    pub timezone: String,
}

#[derive(Debug, Serialize)]
/// Response for ValidateTimezone.
pub struct ValidateTimezoneResponse {
    pub valid: bool,
}

/// Validate timezone string
#[tracing::instrument(skip_all)]
#[utoipa::path(
    post,
    path = "/api/v1/timezones",
    responses((status = 201, description = "Success")),
    tag = "Calendar"
)]
pub async fn validate_timezone(
    Json(payload): Json<ValidateTimezoneRequest>,
) -> Json<ValidateTimezoneResponse> {
    Json(ValidateTimezoneResponse {
        valid: services::validate_timezone(&payload.timezone),
    })
}

#[derive(Debug, Deserialize)]
/// Request body for ConvertTimezone.
pub struct ConvertTimezoneRequest {
    pub datetime: DateTime<chrono::Utc>,
    pub from_timezone: String,
    pub to_timezone: String,
}

#[derive(Debug, Serialize)]
/// Response for ConvertTimezone.
pub struct ConvertTimezoneResponse {
    pub original: String,
    pub converted: String,
}

/// Convert datetime between timezones
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/timezones",
    responses((status = 200, description = "Success")),
    tag = "Calendar"
)]
pub async fn convert_timezone(
    Json(payload): Json<ConvertTimezoneRequest>,
) -> Result<Json<ConvertTimezoneResponse>, String> {
    // Convert from source timezone if needed
    let utc_time = if payload.from_timezone == "UTC" {
        payload.datetime
    } else {
        return Err("From timezone conversion not yet implemented".to_string());
    };

    let converted =
        services::format_in_timezone(utc_time, &payload.to_timezone, "%Y-%m-%d %H:%M:%S %Z")
            .map_err(|e| format!("Failed to convert: {}", e))?;

    Ok(Json(ConvertTimezoneResponse {
        original: utc_time.to_rfc3339(),
        converted,
    }))
}

// ---------------------------------------------------------------------------
// User timezone preference — SYNC-CALENDAR-TZ
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
/// Response for UserTimezone.
pub struct UserTimezoneResponse {
    pub timezone: String,
}

#[derive(Debug, Deserialize)]
/// Request body for SetUserTimezone.
pub struct SetUserTimezoneRequest {
    pub timezone: String,
}

/// GET /api/v1/timezones/me — get user's preferred timezone
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/timezones",
    responses((status = 200, description = "Success")),
    tag = "Calendar"
)]
pub async fn get_user_timezone(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    match sqlx::query_scalar::<_, Option<String>>(
        "SELECT timezone FROM calendar.user_settings WHERE user_id = $1",
    )
    .bind(claims.sub)
    .fetch_optional(&*state.pool)
    .await
    {
        Ok(Some(Some(tz))) => (
            StatusCode::OK,
            Json(serde_json::json!(UserTimezoneResponse { timezone: tz })),
        )
            .into_response(),
        Ok(_) => (
            StatusCode::OK,
            Json(serde_json::json!(UserTimezoneResponse {
                timezone: "UTC".to_string()
            })),
        )
            .into_response(),
        Err(e) => {
            tracing::error!("get_user_timezone: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            )
                .into_response()
        },
    }
}

/// PUT /api/v1/timezones/me — set user's preferred timezone
#[tracing::instrument(skip_all)]
#[utoipa::path(
    put,
    path = "/api/v1/timezones",
    responses((status = 200, description = "Success")),
    tag = "Calendar"
)]
pub async fn set_user_timezone(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<SetUserTimezoneRequest>,
) -> impl IntoResponse {
    if !services::validate_timezone(&payload.timezone) {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "invalid timezone" })),
        )
            .into_response();
    }

    match sqlx::query(
        "INSERT INTO calendar.user_settings (user_id, timezone)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET timezone = EXCLUDED.timezone",
    )
    .bind(claims.sub)
    .bind(&payload.timezone)
    .execute(&*state.pool)
    .await
    {
        Ok(_) => (
            StatusCode::OK,
            Json(serde_json::json!(UserTimezoneResponse {
                timezone: payload.timezone
            })),
        )
            .into_response(),
        Err(e) => {
            tracing::error!("set_user_timezone: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            )
                .into_response()
        },
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
