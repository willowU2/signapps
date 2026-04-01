use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use tracing::info;
use uuid::Uuid;

use crate::AppState;

#[derive(serde::Serialize, serde::Deserialize, utoipa::ToSchema)]
/// Request payload for CreatePresentation operation.
pub struct CreatePresentationRequest {
    pub name: String,
    #[serde(default)]
    pub theme: String,
}

#[derive(serde::Serialize, serde::Deserialize, utoipa::ToSchema)]
/// Response payload for Presentation operation.
pub struct PresentationResponse {
    pub id: String,
    pub name: String,
    pub doc_type: String,
    pub theme: String,
    pub slide_count: u32,
    pub created_at: String,
}

#[derive(serde::Serialize, serde::Deserialize)]
/// Represents a slide.
pub struct Slide {
    pub id: String,
    pub index: u32,
    pub title: String,
    pub content: String,
}

#[derive(serde::Serialize, serde::Deserialize)]
/// Response payload for Slides operation.
pub struct SlidesResponse {
    pub slides: Vec<Slide>,
}

/// POST /api/v1/docs/slide — create a new presentation
#[utoipa::path(
    post,
    path = "/api/v1/docs/slide",
    request_body = CreatePresentationRequest,
    responses(
        (status = 201, description = "Presentation created", body = PresentationResponse),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Documents"
)]
/// Create a new presentation and persist its initial CRDT state to the
/// database so the first WebSocket client receives a well-formed structure.
#[tracing::instrument(skip_all)]
pub async fn create_presentation(
    State(state): State<AppState>,
    Json(payload): Json<CreatePresentationRequest>,
) -> Result<(StatusCode, Json<PresentationResponse>), (StatusCode, String)> {
    let doc_id = Uuid::new_v4().to_string();
    let doc_type = "slide";
    let theme = if payload.theme.is_empty() {
        "default".to_string()
    } else {
        payload.theme
    };

    // Build and persist initial CRDT state (slides YArray, meta YMap)
    let doc_binary = crate::utils::crdt::initial_state_for_type(doc_type);
    let doc_uuid = Uuid::parse_str(&doc_id).expect("newly-generated UUID is always valid");
    sqlx::query(
        r#"INSERT INTO documents (id, doc_type, doc_binary, updated_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (id) DO NOTHING"#,
    )
    .bind(doc_uuid)
    .bind(doc_type)
    .bind(doc_binary)
    .execute(state.pool.inner())
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to persist document: {e}"),
        )
    })?;

    info!(
        doc_id = %doc_id,
        doc_type = %doc_type,
        name = %payload.name,
        theme = %theme,
        "Created presentation"
    );

    Ok((
        StatusCode::CREATED,
        Json(PresentationResponse {
            id: doc_id,
            name: payload.name,
            doc_type: doc_type.to_string(),
            theme,
            slide_count: 1,
            created_at: chrono::Utc::now().to_rfc3339(),
        }),
    ))
}

/// GET /api/v1/docs/slide/:doc_id/slides — get presentation slides
#[utoipa::path(
    get,
    path = "/api/v1/docs/slide/{doc_id}/slides",
    params(("doc_id" = String, Path, description = "Presentation document ID")),
    responses(
        (status = 200, description = "Presentation slides"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Documents"
)]
/// Get slides from presentation
#[tracing::instrument(skip_all)]
pub async fn get_slides(
    State(_state): State<AppState>,
    Path(_doc_id): Path<String>,
) -> Result<Json<SlidesResponse>, (StatusCode, String)> {
    // In production: fetch from Y.doc
    Ok(Json(SlidesResponse {
        slides: vec![Slide {
            id: Uuid::new_v4().to_string(),
            index: 0,
            title: "Slide 1".to_string(),
            content: "Welcome".to_string(),
        }],
    }))
}
