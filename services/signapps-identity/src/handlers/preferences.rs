//! User preferences handlers.

use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use signapps_common::Claims;
use signapps_db::{
    models::{
        ConflictInfo, PreferencesSyncRequest, PreferencesSyncResponse, UserPreferencesUpdate,
    },
    repositories::UserPreferencesRepository,
};

use crate::AppState;

/// Error response
#[derive(Debug, Serialize)]
struct ErrorResponse {
    error: String,
}

/// Get current user preferences
#[tracing::instrument(skip(state, claims))]
pub async fn get_preferences(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    let repo = UserPreferencesRepository::new(&state.pool);

    match repo.get_or_create(claims.sub).await {
        Ok(prefs) => {
            let response = PreferencesSyncResponse {
                preferences: prefs,
                server_timestamp: Utc::now().to_rfc3339(),
                conflict_resolution: None,
            };
            (StatusCode::OK, Json(response)).into_response()
        },
        Err(e) => {
            tracing::error!("Failed to get preferences: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to get preferences".to_string(),
                }),
            )
                .into_response()
        },
    }
}

/// Sync preferences (full update)
#[tracing::instrument(skip(state, claims, body))]
pub async fn sync_preferences(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<PreferencesSyncRequest>,
) -> impl IntoResponse {
    let repo = UserPreferencesRepository::new(&state.pool);

    // Check for conflicts if not forcing overwrite
    if !body.force_overwrite {
        if let Ok((has_conflict, server_prefs)) = repo
            .check_conflict(claims.sub, &body.client_timestamp)
            .await
        {
            if has_conflict {
                if let Some(prefs) = server_prefs {
                    return (
                        StatusCode::CONFLICT,
                        Json(PreferencesSyncResponse {
                            preferences: prefs,
                            server_timestamp: Utc::now().to_rfc3339(),
                            conflict_resolution: Some("server_wins".to_string()),
                        }),
                    )
                        .into_response();
                }
            }
        }
    }

    // Update preferences
    match repo
        .update(claims.sub, &body.preferences, Some(&body.device_id))
        .await
    {
        Ok(prefs) => {
            let response = PreferencesSyncResponse {
                preferences: prefs,
                server_timestamp: Utc::now().to_rfc3339(),
                conflict_resolution: Some("client_wins".to_string()),
            };
            (StatusCode::OK, Json(response)).into_response()
        },
        Err(e) => {
            tracing::error!("Failed to sync preferences: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to sync preferences".to_string(),
                }),
            )
                .into_response()
        },
    }
}

/// Patch a specific section of preferences
#[tracing::instrument(skip(state, claims, body))]
pub async fn patch_preferences(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    axum::extract::Path(section): axum::extract::Path<String>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let repo = UserPreferencesRepository::new(&state.pool);

    // Convert section data to update struct
    let update = section_to_update(&section, &body);

    match repo
        .update(
            claims.sub,
            &update,
            body.get("deviceId").and_then(|v| v.as_str()),
        )
        .await
    {
        Ok(prefs) => {
            let response = PreferencesSyncResponse {
                preferences: prefs,
                server_timestamp: Utc::now().to_rfc3339(),
                conflict_resolution: None,
            };
            (StatusCode::OK, Json(response)).into_response()
        },
        Err(e) => {
            tracing::error!("Failed to patch preferences: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to patch preferences".to_string(),
                }),
            )
                .into_response()
        },
    }
}

/// Check for conflicts
#[derive(Debug, Deserialize)]
/// Query parameters for filtering results.
pub struct ConflictQuery {
    #[serde(rename = "clientTimestamp")]
    client_timestamp: String,
}

#[tracing::instrument(skip(state, claims))]
pub async fn check_conflicts(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<ConflictQuery>,
) -> impl IntoResponse {
    let repo = UserPreferencesRepository::new(&state.pool);

    match repo
        .check_conflict(claims.sub, &query.client_timestamp)
        .await
    {
        Ok((has_conflict, server_prefs)) => {
            let response = ConflictInfo {
                has_conflict,
                server_version: server_prefs,
                client_version: None,
                conflict_fields: vec![],
            };
            (StatusCode::OK, Json(response)).into_response()
        },
        Err(e) => {
            tracing::error!("Failed to check conflicts: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to check conflicts".to_string(),
                }),
            )
                .into_response()
        },
    }
}

/// Reset preferences to defaults
#[tracing::instrument(skip(state, claims))]
pub async fn reset_preferences(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    let repo = UserPreferencesRepository::new(&state.pool);

    match repo.reset(claims.sub).await {
        Ok(prefs) => {
            let response = PreferencesSyncResponse {
                preferences: prefs,
                server_timestamp: Utc::now().to_rfc3339(),
                conflict_resolution: None,
            };
            (StatusCode::OK, Json(response)).into_response()
        },
        Err(e) => {
            tracing::error!("Failed to reset preferences: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to reset preferences".to_string(),
                }),
            )
                .into_response()
        },
    }
}

/// Export preferences as JSON
#[tracing::instrument(skip(state, claims))]
pub async fn export_preferences(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    let repo = UserPreferencesRepository::new(&state.pool);

    match repo.get_or_create(claims.sub).await {
        Ok(prefs) => {
            let json = serde_json::to_string_pretty(&prefs).unwrap_or_default();
            (
                StatusCode::OK,
                [
                    (axum::http::header::CONTENT_TYPE, "application/json"),
                    (
                        axum::http::header::CONTENT_DISPOSITION,
                        "attachment; filename=\"preferences.json\"",
                    ),
                ],
                json,
            )
                .into_response()
        },
        Err(e) => {
            tracing::error!("Failed to export preferences: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to export preferences".to_string(),
                }),
            )
                .into_response()
        },
    }
}

/// Import preferences from JSON
#[tracing::instrument(skip(state, claims, body))]
pub async fn import_preferences(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<UserPreferencesUpdate>,
) -> impl IntoResponse {
    let repo = UserPreferencesRepository::new(&state.pool);

    match repo.update(claims.sub, &body, None).await {
        Ok(prefs) => {
            let response = PreferencesSyncResponse {
                preferences: prefs,
                server_timestamp: Utc::now().to_rfc3339(),
                conflict_resolution: None,
            };
            (StatusCode::OK, Json(response)).into_response()
        },
        Err(e) => {
            tracing::error!("Failed to import preferences: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to import preferences".to_string(),
                }),
            )
                .into_response()
        },
    }
}

/// Convert section name and data to UserPreferencesUpdate
fn section_to_update(section: &str, data: &serde_json::Value) -> UserPreferencesUpdate {
    let mut update = UserPreferencesUpdate {
        theme: None,
        accent_color: None,
        font_size: None,
        compact_mode: None,
        language: None,
        timezone: None,
        date_format: None,
        time_format: None,
        first_day_of_week: None,
        notification_sound: None,
        notification_desktop: None,
        notification_email_digest: None,
        editor_autosave: None,
        editor_autosave_interval: None,
        editor_spell_check: None,
        editor_word_wrap: None,
        calendar_default_view: None,
        calendar_working_hours_start: None,
        calendar_working_hours_end: None,
        calendar_show_weekends: None,
        drive_default_view: None,
        drive_sort_by: None,
        drive_sort_order: None,
        keyboard_shortcuts_enabled: None,
        reduce_motion: None,
        high_contrast: None,
        extra: None,
    };

    let data_obj = data.get("data").unwrap_or(data);

    match section {
        "appearance" => {
            update.theme = data_obj
                .get("theme")
                .and_then(|v| v.as_str())
                .map(String::from);
            update.accent_color = data_obj
                .get("accentColor")
                .and_then(|v| v.as_str())
                .map(String::from);
            update.font_size = data_obj
                .get("fontSize")
                .and_then(|v| v.as_str())
                .map(String::from);
            update.compact_mode = data_obj.get("compactMode").and_then(|v| v.as_bool());
        },
        "regional" => {
            update.language = data_obj
                .get("language")
                .and_then(|v| v.as_str())
                .map(String::from);
            update.timezone = data_obj
                .get("timezone")
                .and_then(|v| v.as_str())
                .map(String::from);
            update.date_format = data_obj
                .get("dateFormat")
                .and_then(|v| v.as_str())
                .map(String::from);
            update.time_format = data_obj
                .get("timeFormat")
                .and_then(|v| v.as_str())
                .map(String::from);
            update.first_day_of_week = data_obj
                .get("firstDayOfWeek")
                .and_then(|v| v.as_i64())
                .map(|v| v as i16);
        },
        "notifications" => {
            update.notification_sound = data_obj.get("sound").and_then(|v| v.as_bool());
            update.notification_desktop = data_obj.get("desktop").and_then(|v| v.as_bool());
            update.notification_email_digest = data_obj
                .get("emailDigest")
                .and_then(|v| v.as_str())
                .map(String::from);
        },
        "editor" => {
            update.editor_autosave = data_obj.get("autosave").and_then(|v| v.as_bool());
            update.editor_autosave_interval = data_obj
                .get("autosaveInterval")
                .and_then(|v| v.as_i64())
                .map(|v| v as i32);
            update.editor_spell_check = data_obj.get("spellCheck").and_then(|v| v.as_bool());
            update.editor_word_wrap = data_obj.get("wordWrap").and_then(|v| v.as_bool());
        },
        "calendar" => {
            update.calendar_default_view = data_obj
                .get("defaultView")
                .and_then(|v| v.as_str())
                .map(String::from);
            update.calendar_working_hours_start = data_obj
                .get("workingHoursStart")
                .and_then(|v| v.as_str())
                .map(String::from);
            update.calendar_working_hours_end = data_obj
                .get("workingHoursEnd")
                .and_then(|v| v.as_str())
                .map(String::from);
            update.calendar_show_weekends = data_obj.get("showWeekends").and_then(|v| v.as_bool());
        },
        "drive" => {
            update.drive_default_view = data_obj
                .get("defaultView")
                .and_then(|v| v.as_str())
                .map(String::from);
            update.drive_sort_by = data_obj
                .get("sortBy")
                .and_then(|v| v.as_str())
                .map(String::from);
            update.drive_sort_order = data_obj
                .get("sortOrder")
                .and_then(|v| v.as_str())
                .map(String::from);
        },
        "accessibility" => {
            update.reduce_motion = data_obj.get("reduceMotion").and_then(|v| v.as_bool());
            update.high_contrast = data_obj.get("highContrast").and_then(|v| v.as_bool());
            update.keyboard_shortcuts_enabled =
                data_obj.get("keyboardShortcuts").and_then(|v| v.as_bool());
        },
        _ => {
            // Store in extra for unknown sections
            update.extra = Some(data_obj.clone());
        },
    }

    update
}
