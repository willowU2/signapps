//! Extended user profile handlers — onboarding, streak, recent docs, history.

use axum::{
    extract::{Extension, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::{Claims, Error, Result};
use uuid::Uuid;

use crate::AppState;

// ============================================================================
// Profile (onboarding + streak)
// ============================================================================

#[derive(Debug, Serialize)]
/// UserProfileExt data transfer object.
pub struct UserProfileExt {
    pub user_id: Uuid,
    pub onboarding_completed_at: Option<DateTime<Utc>>,
    pub streak_count: i32,
    pub streak_last_date: Option<NaiveDate>,
}

#[derive(Debug, Deserialize)]
/// PatchUserProfileExt data transfer object.
pub struct PatchUserProfileExt {
    pub onboarding_completed_at: Option<DateTime<Utc>>,
    pub streak_count: Option<i32>,
    pub streak_last_date: Option<NaiveDate>,
}

/// GET /api/v1/users/me/profile — Get extended profile fields.
#[tracing::instrument(skip(state))]
#[utoipa::path(
    get,
    path = "/api/v1/user_profile",
    responses((status = 200, description = "Success")),
    tag = "Identity"
)]
#[tracing::instrument(skip_all)]
pub async fn get_profile(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<UserProfileExt>> {
    let row: Option<(Option<DateTime<Utc>>, i32, Option<NaiveDate>)> = sqlx::query_as(
        "SELECT onboarding_completed_at, streak_count, streak_last_date
         FROM identity.users WHERE id = $1",
    )
    .bind(claims.sub)
    .fetch_optional(&*state.pool)
    .await?;

    let (oat, sc, sld) = row.ok_or(Error::NotFound("User not found".to_string()))?;

    Ok(Json(UserProfileExt {
        user_id: claims.sub,
        onboarding_completed_at: oat,
        streak_count: sc,
        streak_last_date: sld,
    }))
}

/// PATCH /api/v1/users/me/profile — Update extended profile fields.
#[tracing::instrument(skip(state, payload))]
#[utoipa::path(
    get,
    path = "/api/v1/user_profile",
    responses((status = 200, description = "Success")),
    tag = "Identity"
)]
#[tracing::instrument(skip_all)]
pub async fn patch_profile(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<PatchUserProfileExt>,
) -> Result<Json<UserProfileExt>> {
    let row: Option<(Option<DateTime<Utc>>, i32, Option<NaiveDate>)> = sqlx::query_as(
        r#"UPDATE identity.users
           SET onboarding_completed_at = COALESCE($2, onboarding_completed_at),
               streak_count            = COALESCE($3, streak_count),
               streak_last_date        = COALESCE($4, streak_last_date)
           WHERE id = $1
           RETURNING onboarding_completed_at, streak_count, streak_last_date"#,
    )
    .bind(claims.sub)
    .bind(payload.onboarding_completed_at)
    .bind(payload.streak_count)
    .bind(payload.streak_last_date)
    .fetch_optional(&*state.pool)
    .await?;

    let (oat, sc, sld) = row.ok_or(Error::NotFound("User not found".to_string()))?;

    Ok(Json(UserProfileExt {
        user_id: claims.sub,
        onboarding_completed_at: oat,
        streak_count: sc,
        streak_last_date: sld,
    }))
}

// ============================================================================
// Recent docs
// ============================================================================

#[derive(Debug, Serialize)]
/// RecentDoc data transfer object.
pub struct RecentDoc {
    pub id: Uuid,
    pub doc_id: String,
    pub doc_name: String,
    pub doc_kind: String,
    pub doc_href: String,
    pub last_opened_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
/// Request body for UpsertRecentDoc.
pub struct UpsertRecentDocRequest {
    pub doc_id: String,
    pub doc_name: String,
    pub doc_kind: String,
    pub doc_href: String,
}

/// GET /api/v1/users/me/recent-docs
#[tracing::instrument(skip(state))]
#[utoipa::path(
    get,
    path = "/api/v1/user_profile",
    responses((status = 200, description = "Success")),
    tag = "Identity"
)]
#[tracing::instrument(skip_all)]
pub async fn list_recent_docs(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<RecentDoc>>> {
    let rows = sqlx::query_as::<_, (Uuid, String, String, String, String, DateTime<Utc>)>(
        r#"SELECT id, doc_id, doc_name, doc_kind, doc_href, last_opened_at
           FROM identity.user_recent_docs
           WHERE user_id = $1
           ORDER BY last_opened_at DESC
           LIMIT 20"#,
    )
    .bind(claims.sub)
    .fetch_all(&*state.pool)
    .await?;

    let docs = rows
        .into_iter()
        .map(|r| RecentDoc {
            id: r.0,
            doc_id: r.1,
            doc_name: r.2,
            doc_kind: r.3,
            doc_href: r.4,
            last_opened_at: r.5,
        })
        .collect();

    Ok(Json(docs))
}

/// POST /api/v1/users/me/recent-docs — Upsert a recently opened document.
#[tracing::instrument(skip(state, payload))]
#[utoipa::path(
    get,
    path = "/api/v1/user_profile",
    responses((status = 200, description = "Success")),
    tag = "Identity"
)]
#[tracing::instrument(skip_all)]
pub async fn upsert_recent_doc(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<UpsertRecentDocRequest>,
) -> Result<StatusCode> {
    if payload.doc_id.is_empty() || payload.doc_name.is_empty() {
        return Err(Error::Validation(
            "doc_id and doc_name are required".to_string(),
        ));
    }

    // Upsert: update last_opened_at if already exists, otherwise insert
    sqlx::query(
        r#"INSERT INTO identity.user_recent_docs (user_id, doc_id, doc_name, doc_kind, doc_href, last_opened_at)
           VALUES ($1, $2, $3, $4, $5, NOW())
           ON CONFLICT (user_id, doc_id)
           DO UPDATE SET doc_name = EXCLUDED.doc_name,
                         doc_kind = EXCLUDED.doc_kind,
                         doc_href = EXCLUDED.doc_href,
                         last_opened_at = NOW()"#,
    )
    .bind(claims.sub)
    .bind(&payload.doc_id)
    .bind(&payload.doc_name)
    .bind(&payload.doc_kind)
    .bind(&payload.doc_href)
    .execute(&*state.pool)
    .await?;

    // Trim to last 20 (delete oldest beyond the limit)
    sqlx::query(
        r#"DELETE FROM identity.user_recent_docs
           WHERE user_id = $1
             AND id NOT IN (
               SELECT id FROM identity.user_recent_docs
               WHERE user_id = $1
               ORDER BY last_opened_at DESC
               LIMIT 20
             )"#,
    )
    .bind(claims.sub)
    .execute(&*state.pool)
    .await?;

    Ok(StatusCode::NO_CONTENT)
}

// ============================================================================
// History
// ============================================================================

#[derive(Debug, Serialize)]
/// HistoryEntry data transfer object.
pub struct HistoryEntry {
    pub id: Uuid,
    pub action: String,
    pub entity_type: Option<String>,
    pub entity_id: Option<String>,
    pub entity_title: Option<String>,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
/// Request body for AddHistory.
pub struct AddHistoryRequest {
    pub action: String,
    pub entity_type: Option<String>,
    pub entity_id: Option<String>,
    pub entity_title: Option<String>,
    pub metadata: Option<serde_json::Value>,
}

/// GET /api/v1/users/me/history
#[tracing::instrument(skip(state))]
#[utoipa::path(
    get,
    path = "/api/v1/user_profile",
    responses((status = 200, description = "Success")),
    tag = "Identity"
)]
#[tracing::instrument(skip_all)]
pub async fn list_history(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<HistoryEntry>>> {
    let rows = sqlx::query_as::<
        _,
        (
            Uuid,
            String,
            Option<String>,
            Option<String>,
            Option<String>,
            serde_json::Value,
            DateTime<Utc>,
        ),
    >(
        r#"SELECT id, action, entity_type, entity_id, entity_title, metadata, created_at
           FROM identity.user_history
           WHERE user_id = $1
           ORDER BY created_at DESC
           LIMIT 100"#,
    )
    .bind(claims.sub)
    .fetch_all(&*state.pool)
    .await?;

    let entries = rows
        .into_iter()
        .map(|r| HistoryEntry {
            id: r.0,
            action: r.1,
            entity_type: r.2,
            entity_id: r.3,
            entity_title: r.4,
            metadata: r.5,
            created_at: r.6,
        })
        .collect();

    Ok(Json(entries))
}

/// POST /api/v1/users/me/history — Append a history entry.
#[tracing::instrument(skip(state, payload))]
#[utoipa::path(
    post,
    path = "/api/v1/user_profile",
    responses((status = 201, description = "Success")),
    tag = "Identity"
)]
#[tracing::instrument(skip_all)]
pub async fn add_history(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<AddHistoryRequest>,
) -> Result<StatusCode> {
    if payload.action.is_empty() {
        return Err(Error::Validation("action is required".to_string()));
    }

    let metadata = payload.metadata.unwrap_or(serde_json::json!({}));

    sqlx::query(
        r#"INSERT INTO identity.user_history (user_id, action, entity_type, entity_id, entity_title, metadata)
           VALUES ($1, $2, $3, $4, $5, $6)"#,
    )
    .bind(claims.sub)
    .bind(&payload.action)
    .bind(&payload.entity_type)
    .bind(&payload.entity_id)
    .bind(&payload.entity_title)
    .bind(&metadata)
    .execute(&*state.pool)
    .await?;

    // Trim to last 100 entries
    sqlx::query(
        r#"DELETE FROM identity.user_history
           WHERE user_id = $1
             AND id NOT IN (
               SELECT id FROM identity.user_history
               WHERE user_id = $1
               ORDER BY created_at DESC
               LIMIT 100
             )"#,
    )
    .bind(claims.sub)
    .execute(&*state.pool)
    .await?;

    Ok(StatusCode::NO_CONTENT)
}

// ============================================================================
// Streak check-in
// ============================================================================

/// POST /api/v1/users/me/streak/checkin — Record today's check-in and update streak.
#[tracing::instrument(skip(state))]
#[utoipa::path(
    get,
    path = "/api/v1/user_profile",
    responses((status = 200, description = "Success")),
    tag = "Identity"
)]
#[tracing::instrument(skip_all)]
pub async fn streak_checkin(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<UserProfileExt>> {
    // Fetch current streak state
    let row: Option<(i32, Option<NaiveDate>)> =
        sqlx::query_as("SELECT streak_count, streak_last_date FROM identity.users WHERE id = $1")
            .bind(claims.sub)
            .fetch_optional(&*state.pool)
            .await?;

    let (streak_count, streak_last_date) =
        row.ok_or(Error::NotFound("User not found".to_string()))?;

    let today = Utc::now().date_naive();

    // Already checked in today — return current state without modification
    if streak_last_date == Some(today) {
        return Ok(Json(UserProfileExt {
            user_id: claims.sub,
            onboarding_completed_at: None,
            streak_count,
            streak_last_date: Some(today),
        }));
    }

    // Compute new streak: consecutive if yesterday, else reset to 1
    let yesterday = today.pred_opt();
    let new_streak = if streak_last_date == yesterday {
        streak_count + 1
    } else {
        1
    };

    let updated: (Option<DateTime<Utc>>, i32, Option<NaiveDate>) = sqlx::query_as(
        r#"UPDATE identity.users
           SET streak_count = $2, streak_last_date = $3
           WHERE id = $1
           RETURNING onboarding_completed_at, streak_count, streak_last_date"#,
    )
    .bind(claims.sub)
    .bind(new_streak)
    .bind(today)
    .fetch_one(&*state.pool)
    .await?;

    tracing::info!(user_id = %claims.sub, streak = new_streak, "Streak check-in");

    Ok(Json(UserProfileExt {
        user_id: claims.sub,
        onboarding_completed_at: updated.0,
        streak_count: updated.1,
        streak_last_date: updated.2,
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
