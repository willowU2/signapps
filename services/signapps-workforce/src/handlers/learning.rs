use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::AppState;
use signapps_common::Claims;

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, Serialize, FromRow)]
/// Course data transfer object.
pub struct Course {
    pub id: Uuid,
    pub title: String,
    pub description: String,
    pub modules: serde_json::Value,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, FromRow)]
/// CourseProgress data transfer object.
pub struct CourseProgress {
    pub id: Uuid,
    pub course_id: Uuid,
    pub user_id: Uuid,
    pub module_completions: serde_json::Value,
    pub progress: i32,
    pub status: String,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
/// CourseWithProgress data transfer object.
pub struct CourseWithProgress {
    #[serde(flatten)]
    pub course: Course,
    pub user_progress: Option<CourseProgress>,
}

#[derive(Debug, Deserialize)]
/// Request body for UpdateProgress.
pub struct UpdateProgressRequest {
    pub module_completions: serde_json::Value,
    pub progress: i32,
    pub status: Option<String>,
}

// ============================================================================
// Handlers
// ============================================================================

/// GET /api/v1/learning/courses
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/learning",
    responses((status = 200, description = "Success")),
    tag = "Workforce"
)]
#[tracing::instrument(skip_all)]
pub async fn list_courses(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let courses = sqlx::query_as::<_, Course>(
        r#"SELECT id, title, description, modules, created_by, created_at
           FROM workforce.courses
           ORDER BY created_at DESC"#,
    )
    .fetch_all(state.pool.inner())
    .await
    .map_err(|e| {
        tracing::error!("Failed to list courses: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Fetch progress for current user in one query
    let course_ids: Vec<Uuid> = courses.iter().map(|c| c.id).collect();
    let progress_rows = if course_ids.is_empty() {
        vec![]
    } else {
        sqlx::query_as::<_, CourseProgress>(
            r#"SELECT id, course_id, user_id, module_completions, progress, status, updated_at
               FROM workforce.course_progress
               WHERE user_id = $1 AND course_id = ANY($2)"#,
        )
        .bind(claims.sub)
        .bind(&course_ids)
        .fetch_all(state.pool.inner())
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch course progress: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
    };

    let result: Vec<CourseWithProgress> = courses
        .into_iter()
        .map(|c| {
            let user_progress =
                progress_rows
                    .iter()
                    .find(|p| p.course_id == c.id)
                    .map(|p| CourseProgress {
                        id: p.id,
                        course_id: p.course_id,
                        user_id: p.user_id,
                        module_completions: p.module_completions.clone(),
                        progress: p.progress,
                        status: p.status.clone(),
                        updated_at: p.updated_at,
                    });
            CourseWithProgress {
                course: c,
                user_progress,
            }
        })
        .collect();

    Ok(Json(serde_json::json!({ "data": result })))
}

/// GET /api/v1/learning/courses/:id
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/learning",
    responses((status = 200, description = "Success")),
    tag = "Workforce"
)]
#[tracing::instrument(skip_all)]
pub async fn get_course(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let course = sqlx::query_as::<_, Course>(
        r#"SELECT id, title, description, modules, created_by, created_at
           FROM workforce.courses
           WHERE id = $1"#,
    )
    .bind(id)
    .fetch_optional(state.pool.inner())
    .await
    .map_err(|e| {
        tracing::error!("Failed to get course: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;

    let user_progress = sqlx::query_as::<_, CourseProgress>(
        r#"SELECT id, course_id, user_id, module_completions, progress, status, updated_at
           FROM workforce.course_progress
           WHERE course_id = $1 AND user_id = $2"#,
    )
    .bind(id)
    .bind(claims.sub)
    .fetch_optional(state.pool.inner())
    .await
    .map_err(|e| {
        tracing::error!("Failed to get course progress: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(serde_json::json!({
        "data": CourseWithProgress { course, user_progress }
    })))
}

/// PUT /api/v1/learning/courses/:id/progress
#[tracing::instrument(skip_all)]
#[utoipa::path(
    put,
    path = "/api/v1/learning",
    responses((status = 200, description = "Success")),
    tag = "Workforce"
)]
#[tracing::instrument(skip_all)]
pub async fn update_progress(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateProgressRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Verify course exists
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM workforce.courses WHERE id = $1)",
    )
    .bind(id)
    .fetch_one(state.pool.inner())
    .await
    .map_err(|e| {
        tracing::error!("Failed to check course existence: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if !exists {
        return Err(StatusCode::NOT_FOUND);
    }

    let clamped_progress = payload.progress.clamp(0, 100);
    let status = payload.status.unwrap_or_else(|| {
        if clamped_progress == 100 {
            "completed".to_string()
        } else if clamped_progress > 0 {
            "in_progress".to_string()
        } else {
            "not_started".to_string()
        }
    });

    let row = sqlx::query_as::<_, CourseProgress>(
        r#"INSERT INTO workforce.course_progress
               (course_id, user_id, module_completions, progress, status)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (course_id, user_id) DO UPDATE
               SET module_completions = EXCLUDED.module_completions,
                   progress           = EXCLUDED.progress,
                   status             = EXCLUDED.status,
                   updated_at         = now()
           RETURNING id, course_id, user_id, module_completions, progress, status, updated_at"#,
    )
    .bind(id)
    .bind(claims.sub)
    .bind(&payload.module_completions)
    .bind(clamped_progress)
    .bind(&status)
    .fetch_one(state.pool.inner())
    .await
    .map_err(|e| {
        tracing::error!("Failed to upsert course progress: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(serde_json::json!({ "data": row })))
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
