//! Image-based search handler.
//!
//! Accepts an image via multipart form data, embeds it using a
//! multimodal embedding service (SigLIP 1024d), and searches the
//! multimodal vector space for visually similar content.

use axum::{
    extract::{Multipart, State},
    http::StatusCode,
    Json,
};
use serde::Serialize;
use signapps_db::repositories::MultimodalVectorRepository;
use uuid::Uuid;

use crate::workers::embeddings_mm::HttpMultimodalEmbed;
use crate::workers::MultimodalEmbedWorker;
use crate::AppState;

/// Response from the image search endpoint.
#[derive(Debug, Serialize, utoipa::ToSchema)]
/// Response for ImageSearch.
pub struct ImageSearchResponse {
    pub results: Vec<ImageSearchResultItem>,
    pub count: usize,
}

/// A single image search result.
#[derive(Debug, Serialize, utoipa::ToSchema)]
/// ImageSearchResultItem data transfer object.
pub struct ImageSearchResultItem {
    pub document_id: Uuid,
    pub filename: String,
    pub path: String,
    pub media_type: String,
    pub content: Option<String>,
    pub score: f32,
    pub metadata: Option<serde_json::Value>,
}

/// Search by image in the multimodal vector space.
///
/// Accepts `multipart/form-data` with:
/// - `image` — the image file (required)
/// - `limit` — optional result count, default 10
/// - `collections` — optional comma-separated collection names
#[utoipa::path(
    post,
    path = "/api/v1/ai/search/image",
    request_body(
        content_type = "multipart/form-data",
        description = "Image file to search by",
        content = String,
    ),
    responses(
        (status = 200, description = "Visually similar content results", body = ImageSearchResponse),
        (status = 400, description = "Missing or empty image"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Embedding or search failed"),
    ),
    security(("bearerAuth" = [])),
    tag = "search"
)]
#[tracing::instrument(skip_all)]
pub async fn search_by_image(
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> Result<Json<ImageSearchResponse>, (StatusCode, String)> {
    let mut image_bytes: Option<Vec<u8>> = None;
    let mut limit: usize = 10;
    let mut collections: Option<Vec<String>> = None;

    // Parse multipart fields
    while let Some(field) = multipart.next_field().await.map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            format!("Failed to read multipart field: {}", e),
        )
    })? {
        match field.name() {
            Some("image") => {
                image_bytes = Some(
                    field
                        .bytes()
                        .await
                        .map_err(|e| {
                            (
                                StatusCode::BAD_REQUEST,
                                format!("Failed to read image bytes: {}", e),
                            )
                        })?
                        .to_vec(),
                );
            },
            Some("limit") => {
                if let Ok(text) = field.text().await {
                    if let Ok(n) = text.parse::<usize>() {
                        limit = n.clamp(1, 100);
                    }
                }
            },
            Some("collections") => {
                if let Ok(text) = field.text().await {
                    let cols: Vec<String> = text
                        .split(',')
                        .map(|s| s.trim().to_string())
                        .filter(|s| !s.is_empty())
                        .collect();
                    if !cols.is_empty() {
                        collections = Some(cols);
                    }
                }
            },
            _ => {},
        }
    }

    // Validate image is present
    let image = image_bytes.ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            "Missing required 'image' field".to_string(),
        )
    })?;

    if image.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Image file is empty".to_string()));
    }

    // Build a multimodal embed worker from env config.
    // This uses the same HTTP embedding service the indexer uses.
    let mm_embed_url = std::env::var("MULTIMODAL_EMBED_URL")
        .or_else(|_| std::env::var("EMBEDDINGS_URL"))
        .unwrap_or_else(|_| "http://localhost:8080".to_string());
    let mm_embed_model =
        std::env::var("MULTIMODAL_EMBED_MODEL").unwrap_or_else(|_| "siglip".to_string());
    let mm_embed_dim: usize = std::env::var("MULTIMODAL_EMBED_DIM")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(1024);

    let worker = HttpMultimodalEmbed::new(&mm_embed_url, &mm_embed_model, mm_embed_dim);

    // Embed the image
    let embeddings = worker
        .embed_image(vec![bytes::Bytes::from(image)])
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to embed image: {}", e),
            )
        })?;

    let embedding = embeddings.into_iter().next().ok_or_else(|| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Embedder returned no vectors for the image".to_string(),
        )
    })?;

    // Search the multimodal vector repository
    let results = MultimodalVectorRepository::search(
        &state.pool,
        &embedding,
        limit as i64,
        None,
        collections.as_deref(),
        None,
    )
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Vector search failed: {}", e),
        )
    })?;

    let items: Vec<ImageSearchResultItem> = results
        .into_iter()
        .map(|r| ImageSearchResultItem {
            document_id: r.document_id,
            filename: r.filename,
            path: r.path,
            media_type: r.media_type,
            content: r.content,
            score: r.score,
            metadata: r.metadata,
        })
        .collect();

    let count = items.len();

    Ok(Json(ImageSearchResponse {
        results: items,
        count,
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
