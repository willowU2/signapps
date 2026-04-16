//! Vision analysis HTTP endpoints.
//!
//! Provides image description, visual question answering, and batch
//! description via multipart form data.

use axum::{extract::Multipart, http::StatusCode, Json};
use serde::Serialize;

use crate::workers::vision::{CloudVision, HttpVision};
use crate::workers::{VisionResult, VisionWorker};

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

/// Response for the batch describe endpoint.
#[derive(Debug, Serialize, utoipa::ToSchema)]
/// Response for BatchDescribe.
pub struct BatchDescribeResponse {
    /// Vision analysis results for each image.
    #[schema(value_type = Vec<serde_json::Value>)]
    pub results: Vec<VisionResult>,
    /// Number of results.
    pub count: usize,
}

// ---------------------------------------------------------------------------
// Worker construction
// ---------------------------------------------------------------------------

/// Map an anyhow worker error to an (StatusCode, String) tuple.
/// Errors with MODEL_NOT_INSTALLED_PREFIX map to 501; others to 500.
fn map_worker_error(context: &str, e: anyhow::Error) -> (StatusCode, String) {
    let msg = e.to_string();
    if msg.contains("MODEL_NOT_INSTALLED:") {
        (StatusCode::NOT_IMPLEMENTED, format!("{}: {}", context, msg))
    } else {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("{}: {}", context, msg),
        )
    }
}

/// Build a vision worker from environment variables.
///
/// Precedence:
/// 1. `VISION_URL` + optional `VISION_MODEL` → [`HttpVision`]
/// 2. `OPENAI_API_KEY` → [`CloudVision`] (GPT-4o)
fn create_vision_worker() -> Result<Box<dyn VisionWorker + Send + Sync>, String> {
    if let Ok(url) = std::env::var("VISION_URL") {
        let model = std::env::var("VISION_MODEL").unwrap_or_else(|_| "default".into());
        Ok(Box::new(HttpVision::new(&url, &model)))
    } else if let Ok(api_key) = std::env::var("OPENAI_API_KEY") {
        Ok(Box::new(CloudVision::new(&api_key, None)))
    } else {
        Err("No vision backend configured. Set VISION_URL or OPENAI_API_KEY.".into())
    }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// Describe an image.
///
/// Accepts `multipart/form-data` with:
/// - `image` — the image file (required)
/// - `prompt` — optional text prompt guiding the description
#[utoipa::path(
    post,
    path = "/api/v1/ai/vision/describe",
    request_body(
        content_type = "multipart/form-data",
        description = "Image file and optional description prompt",
        content = String,
    ),
    responses(
        (status = 200, description = "Image description"),
        (status = 400, description = "Missing or empty image"),
        (status = 401, description = "Unauthorized"),
        (status = 503, description = "No vision backend configured"),
    ),
    security(("bearerAuth" = [])),
    tag = "vision"
)]
#[tracing::instrument(skip_all)]
pub async fn describe_image(
    mut multipart: Multipart,
) -> Result<Json<VisionResult>, (StatusCode, String)> {
    let mut image_bytes: Option<Vec<u8>> = None;
    let mut prompt: Option<String> = None;

    while let Some(field) = multipart.next_field().await.map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            format!("Failed to read multipart field: {e}"),
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
                                format!("Failed to read image bytes: {e}"),
                            )
                        })?
                        .to_vec(),
                );
            },
            Some("prompt") => {
                prompt = field.text().await.ok();
            },
            _ => {},
        }
    }

    let image = image_bytes.ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            "Missing required 'image' field".to_string(),
        )
    })?;

    if image.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Image file is empty".to_string()));
    }

    let worker = create_vision_worker().map_err(|e| (StatusCode::SERVICE_UNAVAILABLE, e))?;

    let result = worker
        .describe(bytes::Bytes::from(image), prompt.as_deref())
        .await
        .map_err(|e| map_worker_error("Vision describe failed", e))?;

    Ok(Json(result))
}

/// Visual question answering.
///
/// Accepts `multipart/form-data` with:
/// - `image` — the image file (required)
/// - `question` — the question to answer (required)
#[utoipa::path(
    post,
    path = "/api/v1/ai/vision/vqa",
    request_body(
        content_type = "multipart/form-data",
        description = "Image file and question",
        content = String,
    ),
    responses(
        (status = 200, description = "Answer to the visual question"),
        (status = 400, description = "Missing image or question"),
        (status = 401, description = "Unauthorized"),
        (status = 503, description = "No vision backend configured"),
    ),
    security(("bearerAuth" = [])),
    tag = "vision"
)]
#[tracing::instrument(skip_all)]
pub async fn visual_qa(
    mut multipart: Multipart,
) -> Result<Json<VisionResult>, (StatusCode, String)> {
    let mut image_bytes: Option<Vec<u8>> = None;
    let mut question: Option<String> = None;

    while let Some(field) = multipart.next_field().await.map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            format!("Failed to read multipart field: {e}"),
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
                                format!("Failed to read image bytes: {e}"),
                            )
                        })?
                        .to_vec(),
                );
            },
            Some("question") => {
                question = field.text().await.ok();
            },
            _ => {},
        }
    }

    let image = image_bytes.ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            "Missing required 'image' field".to_string(),
        )
    })?;

    if image.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Image file is empty".to_string()));
    }

    let question = question.ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            "Missing required 'question' field".to_string(),
        )
    })?;

    if question.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "Question must not be empty".to_string(),
        ));
    }

    let worker = create_vision_worker().map_err(|e| (StatusCode::SERVICE_UNAVAILABLE, e))?;

    let result = worker
        .vqa(bytes::Bytes::from(image), &question)
        .await
        .map_err(|e| map_worker_error("Vision VQA failed", e))?;

    Ok(Json(result))
}

/// Batch describe multiple images.
///
/// Accepts `multipart/form-data` with:
/// - `images` — one or more image files (each as a separate `images` field)
#[utoipa::path(
    post,
    path = "/api/v1/ai/vision/batch",
    request_body(
        content_type = "multipart/form-data",
        description = "One or more image files (field name: 'images')",
        content = String,
    ),
    responses(
        (status = 200, description = "Batch image descriptions", body = BatchDescribeResponse),
        (status = 400, description = "No images provided"),
        (status = 401, description = "Unauthorized"),
        (status = 503, description = "No vision backend configured"),
    ),
    security(("bearerAuth" = [])),
    tag = "vision"
)]
#[tracing::instrument(skip_all)]
pub async fn batch_describe(
    mut multipart: Multipart,
) -> Result<Json<BatchDescribeResponse>, (StatusCode, String)> {
    let mut images: Vec<Vec<u8>> = Vec::new();

    while let Some(field) = multipart.next_field().await.map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            format!("Failed to read multipart field: {e}"),
        )
    })? {
        if field.name() == Some("images") {
            let data = field
                .bytes()
                .await
                .map_err(|e| {
                    (
                        StatusCode::BAD_REQUEST,
                        format!("Failed to read image bytes: {e}"),
                    )
                })?
                .to_vec();

            if !data.is_empty() {
                images.push(data);
            }
        }
    }

    if images.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "Missing required 'images' field(s)".to_string(),
        ));
    }

    let worker = create_vision_worker().map_err(|e| (StatusCode::SERVICE_UNAVAILABLE, e))?;

    let image_bytes: Vec<bytes::Bytes> = images.into_iter().map(bytes::Bytes::from).collect();

    let results = worker
        .batch_describe(image_bytes)
        .await
        .map_err(|e| map_worker_error("Vision batch describe failed", e))?;

    let count = results.len();
    Ok(Json(BatchDescribeResponse { results, count }))
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
