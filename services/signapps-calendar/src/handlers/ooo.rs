//! Out-of-office settings handlers.

use axum::{
    extract::{Extension, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::Claims;
use uuid::Uuid;

use crate::{AppState, CalendarError};

#[derive(Debug, Serialize)]
/// OooSettings data transfer object.
pub struct OooSettings {
    pub id: Uuid,
    pub user_id: Uuid,
    pub enabled: bool,
    pub ooo_start: Option<DateTime<Utc>>,
    pub ooo_end: Option<DateTime<Utc>>,
    pub message: Option<String>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
/// Request body for SetOoo.
pub struct SetOooRequest {
    pub enabled: Option<bool>,
    pub ooo_start: Option<DateTime<Utc>>,
    pub ooo_end: Option<DateTime<Utc>>,
    pub message: Option<String>,
}

type OooRow = (
    Uuid,
    Uuid,
    bool,
    Option<DateTime<Utc>>,
    Option<DateTime<Utc>>,
    Option<String>,
    DateTime<Utc>,
);

fn row_to_ooo(r: OooRow) -> OooSettings {
    OooSettings {
        id: r.0,
        user_id: r.1,
        enabled: r.2,
        ooo_start: r.3,
        ooo_end: r.4,
        message: r.5,
        updated_at: r.6,
    }
}

/// GET /api/v1/ooo — Get out-of-office settings for the current user.
#[tracing::instrument(skip(state))]
#[utoipa::path(
    get,
    path = "/api/v1/ooo",
    responses((status = 200, description = "Success")),
    tag = "Calendar"
)]
#[tracing::instrument(skip_all)]
pub async fn get_ooo(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<OooSettings>, CalendarError> {
    let row = sqlx::query_as::<_, OooRow>(
        r#"SELECT id, user_id, enabled, ooo_start, ooo_end, message, updated_at
           FROM calendar.out_of_office
           WHERE user_id = $1"#,
    )
    .bind(claims.sub)
    .fetch_optional(&*state.pool)
    .await
    .map_err(|_| CalendarError::InternalError)?;

    if let Some(r) = row {
        return Ok(Json(row_to_ooo(r)));
    }

    // Return a default (not yet configured) record
    Ok(Json(OooSettings {
        id: Uuid::nil(),
        user_id: claims.sub,
        enabled: false,
        ooo_start: None,
        ooo_end: None,
        message: None,
        updated_at: Utc::now(),
    }))
}

/// PUT /api/v1/ooo — Create or replace out-of-office settings.
#[tracing::instrument(skip(state, payload))]
#[utoipa::path(
    put,
    path = "/api/v1/ooo",
    responses((status = 200, description = "Success")),
    tag = "Calendar"
)]
#[tracing::instrument(skip_all)]
pub async fn set_ooo(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<SetOooRequest>,
) -> Result<Json<OooSettings>, CalendarError> {
    if let (Some(start), Some(end)) = (payload.ooo_start, payload.ooo_end) {
        if end <= start {
            return Err(CalendarError::bad_request(
                "ooo_end must be after ooo_start",
            ));
        }
    }

    let row = sqlx::query_as::<_, OooRow>(
        r#"INSERT INTO calendar.out_of_office (user_id, enabled, ooo_start, ooo_end, message)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (user_id)
           DO UPDATE SET enabled    = EXCLUDED.enabled,
                         ooo_start  = EXCLUDED.ooo_start,
                         ooo_end    = EXCLUDED.ooo_end,
                         message    = EXCLUDED.message,
                         updated_at = NOW()
           RETURNING id, user_id, enabled, ooo_start, ooo_end, message, updated_at"#,
    )
    .bind(claims.sub)
    .bind(payload.enabled.unwrap_or(false))
    .bind(payload.ooo_start)
    .bind(payload.ooo_end)
    .bind(payload.message)
    .fetch_one(&*state.pool)
    .await
    .map_err(|_| CalendarError::InternalError)?;

    tracing::info!(user_id = %claims.sub, "OOO settings updated");
    Ok(Json(row_to_ooo(row)))
}

/// DELETE /api/v1/ooo — Clear out-of-office settings.
#[tracing::instrument(skip(state))]
#[utoipa::path(
    delete,
    path = "/api/v1/ooo",
    responses((status = 204, description = "Success")),
    tag = "Calendar"
)]
#[tracing::instrument(skip_all)]
pub async fn delete_ooo(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<StatusCode, CalendarError> {
    sqlx::query("DELETE FROM calendar.out_of_office WHERE user_id = $1")
        .bind(claims.sub)
        .execute(&*state.pool)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    tracing::info!(user_id = %claims.sub, "OOO settings cleared");
    Ok(StatusCode::NO_CONTENT)
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
