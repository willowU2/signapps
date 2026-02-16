//! Handlers for timezone operations

use axum::{extract::Query, Json};
use chrono::DateTime;
use serde::{Deserialize, Serialize};

use crate::services;

#[derive(Debug, Deserialize)]
pub struct TimezoneListQuery {
    pub search: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct TimezoneInfo {
    pub name: String,
}

/// List available timezones
pub async fn list_timezones(
    Query(query): Query<TimezoneListQuery>,
) -> Json<Vec<TimezoneInfo>> {
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
pub struct ValidateTimezoneRequest {
    pub timezone: String,
}

#[derive(Debug, Serialize)]
pub struct ValidateTimezoneResponse {
    pub valid: bool,
}

/// Validate timezone string
pub async fn validate_timezone(
    Json(payload): Json<ValidateTimezoneRequest>,
) -> Json<ValidateTimezoneResponse> {
    Json(ValidateTimezoneResponse {
        valid: services::validate_timezone(&payload.timezone),
    })
}

#[derive(Debug, Deserialize)]
pub struct ConvertTimezoneRequest {
    pub datetime: DateTime<chrono::Utc>,
    pub from_timezone: String,
    pub to_timezone: String,
}

#[derive(Debug, Serialize)]
pub struct ConvertTimezoneResponse {
    pub original: String,
    pub converted: String,
}

/// Convert datetime between timezones
pub async fn convert_timezone(
    Json(payload): Json<ConvertTimezoneRequest>,
) -> Result<Json<ConvertTimezoneResponse>, String> {
    // Convert from source timezone if needed
    let utc_time = if payload.from_timezone == "UTC" {
        payload.datetime
    } else {
        return Err("From timezone conversion not yet implemented".to_string());
    };

    let converted = services::format_in_timezone(utc_time, &payload.to_timezone, "%Y-%m-%d %H:%M:%S %Z")
        .map_err(|e| format!("Failed to convert: {}", e))?;

    Ok(Json(ConvertTimezoneResponse {
        original: utc_time.to_rfc3339(),
        converted,
    }))
}
