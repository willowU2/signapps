//! Slides Persistence API -- CRUD for presentations, layouts, and slides.
//!
//! Routes:
//! - `POST   /api/v1/presentations`                              -- create presentation
//! - `GET    /api/v1/presentations/:doc_id`                      -- get presentation
//! - `PUT    /api/v1/presentations/:doc_id`                      -- update presentation
//! - `GET    /api/v1/presentations/:doc_id/layouts`              -- list layouts
//! - `GET    /api/v1/presentations/:doc_id/slides`               -- list slides
//! - `POST   /api/v1/presentations/:doc_id/slides`               -- create slide
//! - `PUT    /api/v1/presentations/:doc_id/slides/:slide_id`     -- update slide
//! - `DELETE /api/v1/presentations/:doc_id/slides/:slide_id`     -- delete slide
//! - `PUT    /api/v1/presentations/:doc_id/slides/reorder`       -- reorder slides

use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::AppState;
use signapps_common::middleware::TenantContext;
use signapps_db::models::{
    CreatePresentation, CreateSlide, Presentation, Slide, SlideLayout, UpdateSlide,
};
use signapps_db::repositories::PresentationRepository;

// ============================================================================
// Request / response types
// ============================================================================

/// Request body for creating a new presentation.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreatePresentationBody {
    /// Document ID to associate with the presentation.
    pub document_id: Uuid,
    /// Display title (defaults to "Untitled Presentation" if omitted).
    pub title: Option<String>,
    /// Theme tokens JSON object (defaults to `{}` if omitted).
    pub theme: Option<serde_json::Value>,
    /// Canvas width in logical pixels (defaults to 960).
    pub slide_width: Option<f64>,
    /// Canvas height in logical pixels (defaults to 540).
    pub slide_height: Option<f64>,
}

/// Request body for updating a presentation.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct UpdatePresentationBody {
    /// Updated title.
    pub title: Option<String>,
    /// Updated theme tokens.
    pub theme: Option<serde_json::Value>,
}

/// Request body for creating a new slide.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreateSlideBody {
    /// Optional layout to base this slide on.
    pub layout_id: Option<Uuid>,
    /// Slide elements (defaults to `[]` if omitted).
    pub elements: Option<serde_json::Value>,
    /// Speaker notes.
    pub speaker_notes: Option<String>,
}

/// Request body for updating an existing slide.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct UpdateSlideBody {
    /// Layout to associate with this slide.
    pub layout_id: Option<Uuid>,
    /// New position in the slide deck.
    pub sort_order: Option<i32>,
    /// Updated slide elements.
    pub elements: Option<serde_json::Value>,
    /// Updated speaker notes.
    pub speaker_notes: Option<String>,
    /// Transition effect: `none`, `fade`, `slide`, `zoom`.
    pub transition_type: Option<String>,
    /// Transition duration in milliseconds.
    pub transition_duration: Option<i32>,
    /// Whether this slide is hidden during playback.
    pub is_hidden: Option<bool>,
}

/// Request body for reordering slides.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct ReorderSlidesBody {
    /// Ordered list of slide IDs (position = new sort_order).
    pub slide_ids: Vec<Uuid>,
}

// ============================================================================
// Handlers
// ============================================================================

/// POST /api/v1/presentations -- create a new presentation and seed default layouts
#[utoipa::path(
    post,
    path = "/api/v1/presentations",
    request_body = CreatePresentationBody,
    responses(
        (status = 201, description = "Presentation created", body = Presentation),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden -- no tenant"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Presentations"
)]
#[tracing::instrument(skip_all, fields(document_id))]
pub async fn create_presentation(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Json(payload): Json<CreatePresentationBody>,
) -> Result<(StatusCode, Json<serde_json::Value>), StatusCode> {
    tracing::Span::current().record("document_id", tracing::field::display(payload.document_id));

    let input = CreatePresentation {
        title: payload.title,
        theme: payload.theme,
        slide_width: payload.slide_width,
        slide_height: payload.slide_height,
    };

    let row = PresentationRepository::create_presentation(
        state.pool.inner(),
        ctx.tenant_id,
        payload.document_id,
        input,
    )
    .await
    .map_err(|e| {
        tracing::error!("Failed to create presentation: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({ "data": row })),
    ))
}

/// GET /api/v1/presentations/:doc_id -- get a presentation by document ID
#[utoipa::path(
    get,
    path = "/api/v1/presentations/{doc_id}",
    params(("doc_id" = Uuid, Path, description = "Document ID")),
    responses(
        (status = 200, description = "Presentation found", body = Presentation),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Presentation not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Presentations"
)]
#[tracing::instrument(skip_all, fields(doc_id = %doc_id))]
pub async fn get_presentation(
    State(state): State<AppState>,
    Path(doc_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let row = PresentationRepository::get_presentation(state.pool.inner(), doc_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get presentation: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(serde_json::json!({ "data": row })))
}

/// PUT /api/v1/presentations/:doc_id -- update a presentation title or theme
#[utoipa::path(
    put,
    path = "/api/v1/presentations/{doc_id}",
    params(("doc_id" = Uuid, Path, description = "Document ID")),
    request_body = UpdatePresentationBody,
    responses(
        (status = 200, description = "Presentation updated", body = Presentation),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Presentation not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Presentations"
)]
#[tracing::instrument(skip_all, fields(doc_id = %doc_id))]
pub async fn update_presentation(
    State(state): State<AppState>,
    Path(doc_id): Path<Uuid>,
    Json(payload): Json<UpdatePresentationBody>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let row = sqlx::query_as::<_, Presentation>(
        r#"UPDATE content.presentations SET
            title = COALESCE($1, title),
            theme = COALESCE($2, theme),
            updated_at = NOW()
           WHERE document_id = $3
           RETURNING *"#,
    )
    .bind(payload.title.as_deref())
    .bind(payload.theme.as_ref())
    .bind(doc_id)
    .fetch_optional(state.pool.inner())
    .await
    .map_err(|e| {
        tracing::error!("Failed to update presentation: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(serde_json::json!({ "data": row })))
}

/// GET /api/v1/presentations/:doc_id/layouts -- list available layouts
#[utoipa::path(
    get,
    path = "/api/v1/presentations/{doc_id}/layouts",
    params(("doc_id" = Uuid, Path, description = "Document ID")),
    responses(
        (status = 200, description = "List of slide layouts", body = Vec<SlideLayout>),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Presentation not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Presentations"
)]
#[tracing::instrument(skip_all, fields(doc_id = %doc_id))]
pub async fn list_layouts(
    State(state): State<AppState>,
    Path(doc_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let pres = PresentationRepository::get_presentation(state.pool.inner(), doc_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get presentation: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    let rows = PresentationRepository::list_layouts(state.pool.inner(), pres.id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to list layouts: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(serde_json::json!({ "data": rows })))
}

/// GET /api/v1/presentations/:doc_id/slides -- list slides ordered by sort_order
#[utoipa::path(
    get,
    path = "/api/v1/presentations/{doc_id}/slides",
    params(("doc_id" = Uuid, Path, description = "Document ID")),
    responses(
        (status = 200, description = "Ordered list of slides", body = Vec<Slide>),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Presentation not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Presentations"
)]
#[tracing::instrument(skip_all, fields(doc_id = %doc_id))]
pub async fn list_slides(
    State(state): State<AppState>,
    Path(doc_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let pres = PresentationRepository::get_presentation(state.pool.inner(), doc_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get presentation: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    let rows = PresentationRepository::list_slides(state.pool.inner(), pres.id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to list slides: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(serde_json::json!({ "data": rows })))
}

/// POST /api/v1/presentations/:doc_id/slides -- create a new slide
#[utoipa::path(
    post,
    path = "/api/v1/presentations/{doc_id}/slides",
    params(("doc_id" = Uuid, Path, description = "Document ID")),
    request_body = CreateSlideBody,
    responses(
        (status = 201, description = "Slide created", body = Slide),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Presentation not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Presentations"
)]
#[tracing::instrument(skip_all, fields(doc_id = %doc_id))]
pub async fn create_slide(
    State(state): State<AppState>,
    Path(doc_id): Path<Uuid>,
    Json(payload): Json<CreateSlideBody>,
) -> Result<(StatusCode, Json<serde_json::Value>), StatusCode> {
    let pres = PresentationRepository::get_presentation(state.pool.inner(), doc_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get presentation: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    let input = CreateSlide {
        layout_id: payload.layout_id,
        sort_order: None,
        elements: payload.elements,
        speaker_notes: payload.speaker_notes,
    };

    let row = PresentationRepository::create_slide(state.pool.inner(), pres.id, input)
        .await
        .map_err(|e| {
            tracing::error!("Failed to create slide: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({ "data": row })),
    ))
}

/// PUT /api/v1/presentations/:doc_id/slides/:slide_id -- update a slide
#[utoipa::path(
    put,
    path = "/api/v1/presentations/{doc_id}/slides/{slide_id}",
    params(
        ("doc_id" = Uuid, Path, description = "Document ID"),
        ("slide_id" = Uuid, Path, description = "Slide ID"),
    ),
    request_body = UpdateSlideBody,
    responses(
        (status = 200, description = "Slide updated", body = Slide),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Slide not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Presentations"
)]
#[tracing::instrument(skip_all, fields(doc_id = %doc_id, slide_id = %slide_id))]
pub async fn update_slide(
    State(state): State<AppState>,
    Path((doc_id, slide_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<UpdateSlideBody>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Verify the presentation exists for this document
    let _pres = PresentationRepository::get_presentation(state.pool.inner(), doc_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get presentation: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    let input = UpdateSlide {
        layout_id: payload.layout_id,
        sort_order: payload.sort_order,
        elements: payload.elements,
        speaker_notes: payload.speaker_notes,
        transition_type: payload.transition_type,
        transition_duration: payload.transition_duration,
        is_hidden: payload.is_hidden,
    };

    let row = PresentationRepository::update_slide(state.pool.inner(), slide_id, input)
        .await
        .map_err(|e| {
            tracing::error!("Failed to update slide: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(serde_json::json!({ "data": row })))
}

/// DELETE /api/v1/presentations/:doc_id/slides/:slide_id -- delete a slide
#[utoipa::path(
    delete,
    path = "/api/v1/presentations/{doc_id}/slides/{slide_id}",
    params(
        ("doc_id" = Uuid, Path, description = "Document ID"),
        ("slide_id" = Uuid, Path, description = "Slide ID"),
    ),
    responses(
        (status = 204, description = "Slide deleted"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Slide not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Presentations"
)]
#[tracing::instrument(skip_all, fields(doc_id = %doc_id, slide_id = %slide_id))]
pub async fn delete_slide(
    State(state): State<AppState>,
    Path((doc_id, slide_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, StatusCode> {
    // Verify the presentation exists for this document
    let _pres = PresentationRepository::get_presentation(state.pool.inner(), doc_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get presentation: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    PresentationRepository::delete_slide(state.pool.inner(), slide_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete slide: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(StatusCode::NO_CONTENT)
}

/// PUT /api/v1/presentations/:doc_id/slides/reorder -- reorder slides
#[utoipa::path(
    put,
    path = "/api/v1/presentations/{doc_id}/slides/reorder",
    params(("doc_id" = Uuid, Path, description = "Document ID")),
    request_body = ReorderSlidesBody,
    responses(
        (status = 200, description = "Slides reordered"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Presentation not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Presentations"
)]
#[tracing::instrument(skip_all, fields(doc_id = %doc_id))]
pub async fn reorder_slides(
    State(state): State<AppState>,
    Path(doc_id): Path<Uuid>,
    Json(payload): Json<ReorderSlidesBody>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let pres = PresentationRepository::get_presentation(state.pool.inner(), doc_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get presentation: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    PresentationRepository::reorder_slides(state.pool.inner(), pres.id, payload.slide_ids)
        .await
        .map_err(|e| {
            tracing::error!("Failed to reorder slides: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(serde_json::json!({ "ok": true })))
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
