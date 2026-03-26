//! Image generation HTTP endpoints.
//!
//! Provides text-to-image, inpainting, image-to-image, upscaling, and
//! model listing via multipart form data or JSON payloads.

use axum::{
    extract::{Multipart, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::workers::imagegen::{CloudImageGen, HttpImageGen};
use crate::workers::{
    ImageGenRequest, ImageGenWorker, Img2ImgRequest, InpaintRequest, ModelInfo, UpscaleRequest,
};
use crate::AppState;

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

/// Response for image generation endpoints.
#[derive(Debug, Serialize)]
pub struct ImageGenResponse {
    pub image_url: String,
    pub seed_used: Option<i64>,
    pub model_used: String,
    pub width: u32,
    pub height: u32,
}

/// Response for listing available models.
#[derive(Debug, Serialize)]
pub struct ImageModelsResponse {
    pub models: Vec<ModelInfo>,
    pub count: usize,
}

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

/// JSON request body for the text-to-image endpoint.
#[derive(Debug, Deserialize)]
pub struct GenerateRequest {
    pub prompt: String,
    pub negative_prompt: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub num_steps: Option<u32>,
    pub guidance_scale: Option<f32>,
    pub seed: Option<i64>,
    pub model: Option<String>,
    pub style: Option<String>,
}

// ---------------------------------------------------------------------------
// Worker construction
// ---------------------------------------------------------------------------

/// Build an image generation worker from environment variables.
///
/// Precedence:
/// 1. `IMAGEGEN_URL` + optional `IMAGEGEN_MODEL` -> [`HttpImageGen`]
/// 2. `OPENAI_API_KEY` + optional `IMAGEGEN_CLOUD_MODEL` -> [`CloudImageGen`] (DALL-E)
fn create_imagegen_worker() -> Result<Box<dyn ImageGenWorker + Send + Sync>, String> {
    if let Ok(url) = std::env::var("IMAGEGEN_URL") {
        let model = std::env::var("IMAGEGEN_MODEL").unwrap_or_else(|_| "default".into());
        Ok(Box::new(HttpImageGen::new(&url, &model)))
    } else if let Ok(api_key) = std::env::var("OPENAI_API_KEY") {
        let model = std::env::var("IMAGEGEN_CLOUD_MODEL").unwrap_or_else(|_| "dall-e-3".into());
        Ok(Box::new(CloudImageGen::new(&api_key, Some(&model))))
    } else {
        Err("No image generation backend configured. \
             Set IMAGEGEN_URL or OPENAI_API_KEY."
            .into())
    }
}

/// Store generated image bytes in OpenDAL storage and return the path.
async fn store_image(state: &AppState, image_bytes: &[u8]) -> Result<String, (StatusCode, String)> {
    let path = format!("ai/generated/{}.png", Uuid::new_v4());
    state
        .storage
        .write(&path, image_bytes.to_vec())
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to store generated image: {e}"),
            )
        })?;
    Ok(path)
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// Generate an image from a text prompt.
///
/// Accepts `application/json` with:
/// - `prompt` — text description of the image to generate (required)
/// - `negative_prompt` — what to avoid (optional)
/// - `width` / `height` — image dimensions (optional, default 1024)
/// - `num_steps` — inference steps (optional, default 20)
/// - `guidance_scale` — CFG scale (optional, default 7.5)
/// - `seed` — random seed for reproducibility (optional)
/// - `model` — model name override (optional)
/// - `style` — prepended to prompt as a style prefix (optional)
#[tracing::instrument(skip(state, body))]
pub async fn generate_image(
    State(state): State<AppState>,
    Json(body): Json<GenerateRequest>,
) -> Result<Json<ImageGenResponse>, (StatusCode, String)> {
    if body.prompt.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "Prompt must not be empty".to_string(),
        ));
    }

    let worker = create_imagegen_worker().map_err(|e| (StatusCode::SERVICE_UNAVAILABLE, e))?;

    // Optionally prepend a style prefix to the prompt.
    let prompt = match &body.style {
        Some(style) if !style.is_empty() => {
            format!("{style}, {}", body.prompt)
        },
        _ => body.prompt.clone(),
    };

    let width = body.width.unwrap_or(1024);
    let height = body.height.unwrap_or(1024);

    let request = ImageGenRequest {
        prompt,
        negative_prompt: body.negative_prompt,
        width: Some(width),
        height: Some(height),
        num_images: Some(1),
        seed: body.seed,
        steps: body.num_steps,
        guidance_scale: body.guidance_scale,
        model: body.model,
    };

    let result = worker.generate(request).await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Image generation failed: {e}"),
        )
    })?;

    let image = result.images.first().ok_or_else(|| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "No image returned from generator".to_string(),
        )
    })?;

    let image_url = store_image(&state, image).await?;

    Ok(Json(ImageGenResponse {
        image_url,
        seed_used: result.seed,
        model_used: result.model,
        width,
        height,
    }))
}

/// Inpaint a masked region of an image.
///
/// Accepts `multipart/form-data` with:
/// - `image` — the source image file (required)
/// - `mask` — the mask image file (required; white = inpaint region)
/// - `prompt` — text description of the fill (required)
/// - `model` — model name override (optional)
#[tracing::instrument(skip(state, multipart))]
pub async fn inpaint_image(
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> Result<Json<ImageGenResponse>, (StatusCode, String)> {
    let mut image_bytes: Option<Vec<u8>> = None;
    let mut mask_bytes: Option<Vec<u8>> = None;
    let mut prompt: Option<String> = None;
    let mut model: Option<String> = None;

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
            Some("mask") => {
                mask_bytes = Some(
                    field
                        .bytes()
                        .await
                        .map_err(|e| {
                            (
                                StatusCode::BAD_REQUEST,
                                format!("Failed to read mask bytes: {e}"),
                            )
                        })?
                        .to_vec(),
                );
            },
            Some("prompt") => {
                prompt = field.text().await.ok();
            },
            Some("model") => {
                model = field.text().await.ok();
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

    let mask = mask_bytes.ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            "Missing required 'mask' field".to_string(),
        )
    })?;

    if mask.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Mask file is empty".to_string()));
    }

    let prompt = prompt.ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            "Missing required 'prompt' field".to_string(),
        )
    })?;

    if prompt.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "Prompt must not be empty".to_string(),
        ));
    }

    let worker = create_imagegen_worker().map_err(|e| (StatusCode::SERVICE_UNAVAILABLE, e))?;

    let request = InpaintRequest {
        prompt,
        negative_prompt: None,
        image: bytes::Bytes::from(image),
        mask: bytes::Bytes::from(mask),
        steps: None,
        guidance_scale: None,
        model,
    };

    let result = worker.inpaint(request).await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Inpainting failed: {e}"),
        )
    })?;

    let gen_image = result.images.first().ok_or_else(|| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "No image returned from inpainting".to_string(),
        )
    })?;

    let image_url = store_image(&state, gen_image).await?;

    Ok(Json(ImageGenResponse {
        image_url,
        seed_used: result.seed,
        model_used: result.model,
        width: 512,
        height: 512,
    }))
}

/// Transform an existing image guided by a text prompt.
///
/// Accepts `multipart/form-data` with:
/// - `image` — the source image file (required)
/// - `prompt` — text description of the transformation (required)
/// - `strength` — denoising strength 0.0..1.0 (optional, default 0.75)
/// - `model` — model name override (optional)
#[tracing::instrument(skip(state, multipart))]
pub async fn img2img(
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> Result<Json<ImageGenResponse>, (StatusCode, String)> {
    let mut image_bytes: Option<Vec<u8>> = None;
    let mut prompt: Option<String> = None;
    let mut strength: Option<f32> = None;
    let mut model: Option<String> = None;

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
            Some("strength") => {
                if let Ok(text) = field.text().await {
                    if let Ok(val) = text.parse::<f32>() {
                        strength = Some(val.clamp(0.0, 1.0));
                    }
                }
            },
            Some("model") => {
                model = field.text().await.ok();
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

    let prompt = prompt.ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            "Missing required 'prompt' field".to_string(),
        )
    })?;

    if prompt.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "Prompt must not be empty".to_string(),
        ));
    }

    let worker = create_imagegen_worker().map_err(|e| (StatusCode::SERVICE_UNAVAILABLE, e))?;

    let request = Img2ImgRequest {
        prompt,
        negative_prompt: None,
        image: bytes::Bytes::from(image),
        strength,
        steps: None,
        guidance_scale: None,
        model,
    };

    let result = worker.img2img(request).await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Image-to-image failed: {e}"),
        )
    })?;

    let gen_image = result.images.first().ok_or_else(|| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "No image returned from img2img".to_string(),
        )
    })?;

    let image_url = store_image(&state, gen_image).await?;

    Ok(Json(ImageGenResponse {
        image_url,
        seed_used: result.seed,
        model_used: result.model,
        width: 512,
        height: 512,
    }))
}

/// Upscale an image using super-resolution.
///
/// Accepts `multipart/form-data` with:
/// - `image` — the image file to upscale (required)
/// - `scale` — scale factor, e.g. 2 or 4 (optional, default 2)
#[tracing::instrument(skip(state, multipart))]
pub async fn upscale_image(
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> Result<Json<ImageGenResponse>, (StatusCode, String)> {
    let mut image_bytes: Option<Vec<u8>> = None;
    let mut scale: Option<u32> = None;

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
            Some("scale") => {
                if let Ok(text) = field.text().await {
                    if let Ok(val) = text.parse::<u32>() {
                        scale = Some(val.clamp(1, 8));
                    }
                }
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

    let worker = create_imagegen_worker().map_err(|e| (StatusCode::SERVICE_UNAVAILABLE, e))?;

    let scale_factor = scale.unwrap_or(2);

    let request = UpscaleRequest {
        image: bytes::Bytes::from(image),
        scale_factor: Some(scale_factor),
        model: None,
    };

    let result = worker.upscale(request).await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Upscaling failed: {e}"),
        )
    })?;

    let gen_image = result.images.first().ok_or_else(|| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "No image returned from upscaler".to_string(),
        )
    })?;

    let image_url = store_image(&state, gen_image).await?;

    // The upscaled dimensions are not directly known here; report the scale
    // factor through width/height as a best-effort indicator.
    Ok(Json(ImageGenResponse {
        image_url,
        seed_used: None,
        model_used: result.model,
        width: scale_factor,
        height: scale_factor,
    }))
}

/// List available image generation models.
#[tracing::instrument]
pub async fn list_image_models() -> Result<Json<ImageModelsResponse>, (StatusCode, String)> {
    let worker = create_imagegen_worker().map_err(|e| (StatusCode::SERVICE_UNAVAILABLE, e))?;

    let models = worker.list_models().await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to list image models: {e}"),
        )
    })?;

    let count = models.len();
    Ok(Json(ImageModelsResponse { models, count }))
}
