//! Presentation (PPTX) export HTTP handlers.

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};

use crate::office::presentation::{
    json_to_pptx, parse_json_to_presentation, presentation_to_pngs, presentation_to_svgs,
    slide_to_png, slide_to_svg,
};

/// POST /api/v1/presentation/export/pptx — export slides JSON to PPTX
#[utoipa::path(
    post,
    path = "/api/v1/presentation/export/pptx",
    responses(
        (status = 200, description = "PPTX binary"),
        (status = 400, description = "Invalid presentation data"),
        (status = 500, description = "Internal server error"),
    ),
    tag = "Presentation"
)]
/// Export presentation JSON to PPTX
#[tracing::instrument(skip_all)]
pub async fn export_pptx(
    axum::extract::State(state): axum::extract::State<crate::office::OfficeState>,
    Json(payload): Json<serde_json::Value>,
) -> Response {
    use std::hash::{DefaultHasher, Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    serde_json::to_string(&payload)
        .unwrap_or_default()
        .hash(&mut hasher);
    let cache_key = format!("slides_pptx_{}", hasher.finish());

    let filename = payload
        .get("filename")
        .and_then(|f| f.as_str())
        .unwrap_or("presentation.pptx")
        .to_string();

    if let Some(cached_data) = state.cache.get(&cache_key).await {
        tracing::info!("Cache hit for PPTX: {}", cache_key);
        return (
            StatusCode::OK,
            [
                (
                    "Content-Type",
                    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                ),
                (
                    "Content-Disposition",
                    &format!("attachment; filename=\"{}\"", filename),
                ),
            ],
            cached_data,
        )
            .into_response();
    }
    match json_to_pptx(&payload) {
        Ok(data) => {
            let filename = payload
                .get("filename")
                .and_then(|f| f.as_str())
                .unwrap_or("presentation.pptx");

            state.cache.set(&cache_key, data.clone()).await;
            (
                StatusCode::OK,
                [
                    (
                        "Content-Type",
                        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                    ),
                    (
                        "Content-Disposition",
                        &format!("attachment; filename=\"{}\"", filename),
                    ),
                ],
                data,
            )
                .into_response()
        },
        Err(e) => {
            tracing::error!("PPTX export error: {}", e);
            (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "error": "Export failed",
                    "message": e.to_string()
                })),
            )
                .into_response()
        },
    }
}

/// POST /api/v1/presentation/export/pdf — export slides JSON to PDF
#[utoipa::path(
    post,
    path = "/api/v1/presentation/export/pdf",
    responses(
        (status = 200, description = "PDF binary"),
        (status = 400, description = "Invalid presentation data"),
        (status = 500, description = "Internal server error"),
    ),
    tag = "Presentation"
)]
/// Export presentation to PDF (all slides)
#[tracing::instrument(skip_all)]
pub async fn export_slides_pdf(
    axum::extract::State(state): axum::extract::State<crate::office::OfficeState>,
    Json(payload): Json<serde_json::Value>,
) -> Response {
    use std::hash::{DefaultHasher, Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    serde_json::to_string(&payload)
        .unwrap_or_default()
        .hash(&mut hasher);
    let cache_key = format!("slides_pdf_{}", hasher.finish());

    let filename = payload
        .get("filename")
        .and_then(|f| f.as_str())
        .unwrap_or("slides.pdf")
        .to_string();

    if let Some(cached_data) = state.cache.get(&cache_key).await {
        tracing::info!("Cache hit for PDF: {}", cache_key);
        return (
            StatusCode::OK,
            [
                ("Content-Type", "application/pdf"),
                (
                    "Content-Disposition",
                    &format!("attachment; filename=\"{}\"", filename),
                ),
            ],
            cached_data,
        )
            .into_response();
    }
    // Parse presentation
    let presentation = match parse_json_to_presentation(&payload) {
        Ok(p) => p,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "error": "Invalid presentation data",
                    "message": e.to_string()
                })),
            )
                .into_response();
        },
    };

    // Generate PDF from slides
    // For now, we use the existing PDF generator
    match crate::office::pdf::generate_slides_pdf(&presentation) {
        Ok(data) => {
            let filename = payload
                .get("filename")
                .and_then(|f| f.as_str())
                .unwrap_or("slides.pdf");

            state.cache.set(&cache_key, data.clone()).await;
            (
                StatusCode::OK,
                [
                    ("Content-Type", "application/pdf"),
                    (
                        "Content-Disposition",
                        &format!("attachment; filename=\"{}\"", filename),
                    ),
                ],
                data,
            )
                .into_response()
        },
        Err(e) => {
            tracing::error!("PDF slides export error: {}", e);
            (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "error": "Export failed",
                    "message": e.to_string()
                })),
            )
                .into_response()
        },
    }
}

/// POST /api/v1/presentation/export/png — export a single slide to PNG
#[utoipa::path(
    post,
    path = "/api/v1/presentation/export/png",
    responses(
        (status = 200, description = "PNG binary"),
        (status = 400, description = "Invalid presentation data or slide number"),
        (status = 500, description = "Internal server error"),
    ),
    tag = "Presentation"
)]
/// Export single slide to PNG
#[tracing::instrument(skip_all)]
pub async fn export_slide_png(Json(payload): Json<serde_json::Value>) -> Response {
    let presentation = match parse_json_to_presentation(&payload) {
        Ok(p) => p,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "error": "Invalid presentation data",
                    "message": e.to_string()
                })),
            )
                .into_response();
        },
    };

    let slide_num = payload.get("slide").and_then(|s| s.as_u64()).unwrap_or(1) as usize;

    if slide_num == 0 || slide_num > presentation.slides.len() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "error": "Invalid slide number",
                "message": format!("Slide {} does not exist (presentation has {} slides)", slide_num, presentation.slides.len())
            })),
        )
            .into_response();
    }

    let slide = &presentation.slides[slide_num - 1];

    match slide_to_png(slide, slide_num) {
        Ok(data) => {
            let filename = format!("slide_{}.png", slide_num);
            (
                StatusCode::OK,
                [
                    ("Content-Type", "image/png"),
                    (
                        "Content-Disposition",
                        &format!("attachment; filename=\"{}\"", filename),
                    ),
                ],
                data,
            )
                .into_response()
        },
        Err(e) => {
            tracing::error!("PNG slide export error: {}", e);
            (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "error": "Export failed",
                    "message": e.to_string()
                })),
            )
                .into_response()
        },
    }
}

/// POST /api/v1/presentation/export/svg — export a single slide to SVG
#[utoipa::path(
    post,
    path = "/api/v1/presentation/export/svg",
    responses(
        (status = 200, description = "SVG data"),
        (status = 400, description = "Invalid presentation data or slide number"),
        (status = 500, description = "Internal server error"),
    ),
    tag = "Presentation"
)]
/// Export single slide to SVG
#[tracing::instrument(skip_all)]
pub async fn export_slide_svg(Json(payload): Json<serde_json::Value>) -> Response {
    let presentation = match parse_json_to_presentation(&payload) {
        Ok(p) => p,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "error": "Invalid presentation data",
                    "message": e.to_string()
                })),
            )
                .into_response();
        },
    };

    let slide_num = payload.get("slide").and_then(|s| s.as_u64()).unwrap_or(1) as usize;

    if slide_num == 0 || slide_num > presentation.slides.len() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "error": "Invalid slide number",
                "message": format!("Slide {} does not exist (presentation has {} slides)", slide_num, presentation.slides.len())
            })),
        )
            .into_response();
    }

    let slide = &presentation.slides[slide_num - 1];

    match slide_to_svg(slide, slide_num) {
        Ok(data) => {
            let filename = format!("slide_{}.svg", slide_num);
            (
                StatusCode::OK,
                [
                    ("Content-Type", "image/svg+xml"),
                    (
                        "Content-Disposition",
                        &format!("attachment; filename=\"{}\"", filename),
                    ),
                ],
                data,
            )
                .into_response()
        },
        Err(e) => {
            tracing::error!("SVG slide export error: {}", e);
            (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "error": "Export failed",
                    "message": e.to_string()
                })),
            )
                .into_response()
        },
    }
}

/// POST /api/v1/presentation/export/all/png — export all slides as base64-encoded PNGs
#[utoipa::path(
    post,
    path = "/api/v1/presentation/export/all/png",
    responses(
        (status = 200, description = "All slides as base64 PNGs"),
        (status = 400, description = "Invalid presentation data"),
        (status = 500, description = "Internal server error"),
    ),
    tag = "Presentation"
)]
/// Export all slides as PNG (returns JSON with base64 encoded images)
#[tracing::instrument(skip_all)]
pub async fn export_all_slides_png(Json(payload): Json<serde_json::Value>) -> Response {
    let presentation = match parse_json_to_presentation(&payload) {
        Ok(p) => p,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "error": "Invalid presentation data",
                    "message": e.to_string()
                })),
            )
                .into_response();
        },
    };

    match presentation_to_pngs(&presentation) {
        Ok(pngs) => {
            let slides: Vec<serde_json::Value> = pngs
                .iter()
                .enumerate()
                .map(|(i, png)| {
                    serde_json::json!({
                        "slide": i + 1,
                        "data": base64::Engine::encode(&base64::engine::general_purpose::STANDARD, png),
                        "mime_type": "image/png"
                    })
                })
                .collect();

            (
                StatusCode::OK,
                Json(serde_json::json!({
                    "success": true,
                    "total_slides": slides.len(),
                    "slides": slides
                })),
            )
                .into_response()
        },
        Err(e) => {
            tracing::error!("PNG slides export error: {}", e);
            (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "error": "Export failed",
                    "message": e.to_string()
                })),
            )
                .into_response()
        },
    }
}

/// POST /api/v1/presentation/export/all/svg — export all slides as SVG strings
#[utoipa::path(
    post,
    path = "/api/v1/presentation/export/all/svg",
    responses(
        (status = 200, description = "All slides as SVG strings"),
        (status = 400, description = "Invalid presentation data"),
        (status = 500, description = "Internal server error"),
    ),
    tag = "Presentation"
)]
/// Export all slides as SVG (returns JSON with SVG strings)
#[tracing::instrument(skip_all)]
pub async fn export_all_slides_svg(Json(payload): Json<serde_json::Value>) -> Response {
    let presentation = match parse_json_to_presentation(&payload) {
        Ok(p) => p,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "error": "Invalid presentation data",
                    "message": e.to_string()
                })),
            )
                .into_response();
        },
    };

    match presentation_to_svgs(&presentation) {
        Ok(svgs) => {
            let slides: Vec<serde_json::Value> = svgs
                .iter()
                .enumerate()
                .map(|(i, svg)| {
                    serde_json::json!({
                        "slide": i + 1,
                        "data": svg,
                        "mime_type": "image/svg+xml"
                    })
                })
                .collect();

            (
                StatusCode::OK,
                Json(serde_json::json!({
                    "success": true,
                    "total_slides": slides.len(),
                    "slides": slides
                })),
            )
                .into_response()
        },
        Err(e) => {
            tracing::error!("SVG slides export error: {}", e);
            (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "error": "Export failed",
                    "message": e.to_string()
                })),
            )
                .into_response()
        },
    }
}

/// GET /api/v1/presentation/info — get presentation service info
#[utoipa::path(
    get,
    path = "/api/v1/presentation/info",
    responses(
        (status = 200, description = "Presentation service info"),
    ),
    tag = "Presentation"
)]
/// Get presentation service info
#[tracing::instrument(skip_all)]
pub async fn presentation_info() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "service": "SignApps Office - Presentations",
        "version": "1.0.0",
        "supported_formats": {
            "export": ["pptx", "pdf", "png", "svg"]
        },
        "endpoints": {
            "export_pptx": "POST /api/v1/presentation/export/pptx",
            "export_pdf": "POST /api/v1/presentation/export/pdf",
            "export_png": "POST /api/v1/presentation/export/png",
            "export_svg": "POST /api/v1/presentation/export/svg",
            "export_all_png": "POST /api/v1/presentation/export/all/png",
            "export_all_svg": "POST /api/v1/presentation/export/all/svg",
            "info": "GET /api/v1/presentation/info"
        },
        "features": {
            "slides": true,
            "speaker_notes": true,
            "shapes": true,
            "text": true,
            "images": true,
            "per_slide_export": true
        }
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
