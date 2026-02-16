use axum::{extract::{State, Path}, http::StatusCode, Json};
use uuid::Uuid;
use tracing::info;

use crate::AppState;

#[derive(serde::Serialize, serde::Deserialize)]
pub struct CreatePresentationRequest {
    pub name: String,
    #[serde(default)]
    pub theme: String,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct PresentationResponse {
    pub id: String,
    pub name: String,
    pub doc_type: String,
    pub theme: String,
    pub slide_count: u32,
    pub created_at: String,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct Slide {
    pub id: String,
    pub index: u32,
    pub title: String,
    pub content: String,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct SlidesResponse {
    pub slides: Vec<Slide>,
}

/// Create a new presentation
pub async fn create_presentation(
    State(_state): State<AppState>,
    Json(payload): Json<CreatePresentationRequest>,
) -> Result<(StatusCode, Json<PresentationResponse>), (StatusCode, String)> {
    let doc_id = Uuid::new_v4().to_string();
    let theme = if payload.theme.is_empty() {
        "default".to_string()
    } else {
        payload.theme
    };

    info!(
        doc_id = %doc_id,
        doc_type = "slide",
        name = %payload.name,
        theme = %theme,
        "Created presentation"
    );

    Ok((
        StatusCode::CREATED,
        Json(PresentationResponse {
            id: doc_id,
            name: payload.name,
            doc_type: "slide".to_string(),
            theme,
            slide_count: 1,
            created_at: chrono::Utc::now().to_rfc3339(),
        }),
    ))
}

/// Get slides from presentation
pub async fn get_slides(
    State(_state): State<AppState>,
    Path(_doc_id): Path<String>,
) -> Result<Json<SlidesResponse>, (StatusCode, String)> {
    // In production: fetch from Y.doc
    Ok(Json(SlidesResponse {
        slides: vec![
            Slide {
                id: Uuid::new_v4().to_string(),
                index: 0,
                title: "Slide 1".to_string(),
                content: "Welcome".to_string(),
            }
        ],
    }))
}
