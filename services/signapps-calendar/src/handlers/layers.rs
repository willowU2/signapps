//! Layer configuration handlers.
//!
//! Persists and retrieves a user's calendar layer visibility settings.
//! Config is stored as a JSONB value in the `extra` field of
//! `identity.user_preferences`, under the key `calendar_layers`.

use axum::{extract::Extension, extract::State, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use signapps_common::Claims;

use crate::{AppState, CalendarError};

// ============================================================================
// Default layer config
// ============================================================================

fn default_layer_config() -> JsonValue {
    serde_json::json!({
        "layers": [
            { "id": "events",    "label": "Événements",        "visible": true,  "color": "#3b82f6" },
            { "id": "tasks",     "label": "Tâches",            "visible": true,  "color": "#8b5cf6" },
            { "id": "leave",     "label": "Congés",            "visible": true,  "color": "#f59e0b" },
            { "id": "shifts",    "label": "Permanences",       "visible": true,  "color": "#10b981" },
            { "id": "resources", "label": "Ressources",        "visible": false, "color": "#6366f1" },
            { "id": "presence",  "label": "Présence",          "visible": true,  "color": "#06b6d4" },
            { "id": "ooo",       "label": "Hors du bureau",    "visible": true,  "color": "#ef4444" }
        ]
    })
}

// ============================================================================
// Request / Response types
// ============================================================================

#[derive(Debug, Deserialize)]
/// SaveLayerConfigBody data transfer object.
pub struct SaveLayerConfigBody {
    /// The layer configuration JSON. Structure is opaque to the backend —
    /// the frontend owns the schema.
    pub config: JsonValue,
}

#[derive(Debug, Serialize)]
/// Response for LayerConfig.
pub struct LayerConfigResponse {
    pub config: JsonValue,
}

// ============================================================================
// get_layer_config
// ============================================================================

/// `GET /api/v1/layers/config`
///
/// Return the current user's saved layer configuration. Falls back to the
/// default config if none has been saved yet.
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn get_layer_config(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<LayerConfigResponse>, CalendarError> {
    // Query the extra JSONB column from user_preferences
    let row: Option<(Option<JsonValue>,)> =
        sqlx::query_as("SELECT extra FROM identity.user_preferences WHERE user_id = $1")
            .bind(claims.sub)
            .fetch_optional(state.pool.inner())
            .await
            .map_err(|_| CalendarError::InternalError)?;

    let config = match row {
        Some((Some(extra),)) => extra
            .get("calendar_layers")
            .cloned()
            .unwrap_or_else(default_layer_config),
        _ => default_layer_config(),
    };

    Ok(Json(LayerConfigResponse { config }))
}

// ============================================================================
// save_layer_config
// ============================================================================

/// `PUT /api/v1/layers/config`
///
/// Upsert the layer configuration for the current user into the
/// `identity.user_preferences.extra` JSONB column.
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn save_layer_config(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<SaveLayerConfigBody>,
) -> Result<(StatusCode, Json<LayerConfigResponse>), CalendarError> {
    // Upsert the row: create if missing, then merge `calendar_layers` into
    // the existing `extra` JSONB object.
    sqlx::query(
        r#"
        INSERT INTO identity.user_preferences (user_id, extra)
        VALUES ($1, jsonb_build_object('calendar_layers', $2::jsonb))
        ON CONFLICT (user_id) DO UPDATE
            SET extra = identity.user_preferences.extra
                     || jsonb_build_object('calendar_layers', $2::jsonb),
                updated_at = NOW()
        "#,
    )
    .bind(claims.sub)
    .bind(&body.config)
    .execute(state.pool.inner())
    .await
    .map_err(|_| CalendarError::InternalError)?;

    Ok((
        StatusCode::OK,
        Json(LayerConfigResponse {
            config: body.config,
        }),
    ))
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
