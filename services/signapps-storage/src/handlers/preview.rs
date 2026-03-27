//! File preview handlers - Thumbnails and document previews.
#![allow(dead_code)]

use axum::{
    body::Body,
    extract::{Path, Query, State},
    http::{header, StatusCode},
    response::Response,
    Json,
};
use base64;
use image::{imageops::FilterType, DynamicImage, ImageFormat, ImageReader, RgbaImage};
use lopdf::Document as PdfDocument;
use pdfium_render::prelude::*;
use reqwest;
use serde::{Deserialize, Serialize};
use signapps_common::{Error, Result};
use std::io::Cursor;
use zip::ZipArchive;

use crate::AppState;

/// Create a PDFium instance for rendering.
/// Returns None if PDFium library is not available on the system.
fn get_pdfium() -> Option<Pdfium> {
    Pdfium::bind_to_system_library().ok().map(Pdfium::new)
}

/// Thumbnail size options.
#[derive(Debug, Clone, Copy, Default, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ThumbnailSize {
    Small, // 64x64
    #[default]
    Medium, // 256x256
    Large, // 512x512
}

impl ThumbnailSize {
    pub fn dimensions(&self) -> (u32, u32) {
        match self {
            Self::Small => (64, 64),
            Self::Medium => (256, 256),
            Self::Large => (512, 512),
        }
    }
}

/// Thumbnail query parameters.
#[derive(Debug, Deserialize)]
pub struct ThumbnailQuery {
    #[serde(default)]
    pub size: ThumbnailSize,
    pub format: Option<String>, // "webp", "png", "jpeg"
}

/// Preview query parameters.
#[derive(Debug, Deserialize)]
pub struct PreviewQuery {
    pub page: Option<u32>,
    pub width: Option<u32>,
    pub height: Option<u32>,
}

/// Preview info response.
#[derive(Debug, Serialize)]
pub struct PreviewInfo {
    pub previewable: bool,
    pub preview_type: PreviewType,
    pub pages: Option<u32>,
    pub thumbnail_url: Option<String>,
    pub preview_url: Option<String>,
}

/// Preview types.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum PreviewType {
    Image,
    Pdf,
    Document,
    Video,
    Audio,
    Text,
    Code,
    None,
}

/// Get thumbnail for a file.
#[tracing::instrument(skip(state))]
pub async fn get_thumbnail(
    State(state): State<AppState>,
    Path((bucket, key)): Path<(String, String)>,
    Query(query): Query<ThumbnailQuery>,
) -> Result<Response> {
    // Get file info
    let info = state.storage.get_object_info(&bucket, &key).await?;

    // Check if we can generate thumbnail
    let content_type = info
        .content_type
        .as_deref()
        .unwrap_or("application/octet-stream");
    let preview_type = get_preview_type(content_type);

    match preview_type {
        PreviewType::Image => generate_image_thumbnail(&state, &bucket, &key, &query).await,
        PreviewType::Pdf => generate_pdf_thumbnail(&state, &bucket, &key, &query).await,
        PreviewType::Video => generate_video_thumbnail(&state, &bucket, &key, &query).await,
        PreviewType::Audio => generate_audio_waveform(&state, &bucket, &key, &query).await,
        _ => Err(Error::BadRequest(
            "Thumbnails not supported for this file type".to_string(),
        )),
    }
}

/// Generate thumbnail for an image file.
async fn generate_image_thumbnail(
    state: &AppState,
    bucket: &str,
    key: &str,
    query: &ThumbnailQuery,
) -> Result<Response> {
    // Get the original image data
    let object = state.storage.get_object(bucket, key).await?;

    // Decode the image
    let img = ImageReader::new(Cursor::new(&object.data))
        .with_guessed_format()
        .map_err(|e| Error::Internal(format!("Failed to detect image format: {}", e)))?
        .decode()
        .map_err(|e| Error::Internal(format!("Failed to decode image: {}", e)))?;

    // Get target dimensions
    let (max_width, max_height) = query.size.dimensions();

    // Calculate dimensions preserving aspect ratio
    let (orig_width, orig_height) = (img.width(), img.height());
    let (thumb_width, thumb_height) =
        calculate_thumbnail_dimensions(orig_width, orig_height, max_width, max_height);

    // Resize the image
    let thumbnail = img.resize_exact(thumb_width, thumb_height, FilterType::Lanczos3);

    // Determine output format
    let (output_format, content_type) = match query.format.as_deref() {
        Some("png") => (ImageFormat::Png, "image/png"),
        Some("jpeg") | Some("jpg") => (ImageFormat::Jpeg, "image/jpeg"),
        Some("webp") | None => (ImageFormat::WebP, "image/webp"),
        Some(f) => {
            return Err(Error::BadRequest(format!("Unsupported format: {}", f)));
        },
    };

    // Encode to output format
    let mut buffer = Cursor::new(Vec::new());
    thumbnail
        .write_to(&mut buffer, output_format)
        .map_err(|e| Error::Internal(format!("Failed to encode thumbnail: {}", e)))?;

    let bytes = buffer.into_inner();

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type)
        .header(header::CACHE_CONTROL, "public, max-age=86400") // Cache 24h
        .body(Body::from(bytes))
        .map_err(|e| Error::Internal(e.to_string()))
}

/// Generate thumbnail for a PDF file (first page).
async fn generate_pdf_thumbnail(
    state: &AppState,
    bucket: &str,
    key: &str,
    query: &ThumbnailQuery,
) -> Result<Response> {
    // Get the PDF data
    let object = state.storage.get_object(bucket, key).await?;
    let pdf_data = object.data.to_vec();

    // Spawn blocking task for CPU-intensive PDF rendering
    let (max_width, max_height) = query.size.dimensions();
    let format = query.format.clone();

    let result = tokio::task::spawn_blocking(move || {
        render_pdf_thumbnail_sync(&pdf_data, max_width, max_height, format.as_deref())
    })
    .await
    .map_err(|e| Error::Internal(format!("PDF render task failed: {}", e)))??;

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, result.content_type)
        .header(header::CACHE_CONTROL, "public, max-age=86400") // Cache 24h
        .body(Body::from(result.data))
        .map_err(|e| Error::Internal(e.to_string()))
}

/// Result of PDF thumbnail rendering.
struct PdfThumbnailResult {
    data: Vec<u8>,
    content_type: &'static str,
}

/// Synchronously render PDF thumbnail (called in spawn_blocking).
fn render_pdf_thumbnail_sync(
    pdf_data: &[u8],
    max_width: u32,
    max_height: u32,
    format: Option<&str>,
) -> Result<PdfThumbnailResult> {
    // Get PDFium instance
    let pdfium = get_pdfium()
        .ok_or_else(|| Error::Internal("PDF thumbnails unavailable: PDFium library not installed. Install pdfium on your system.".to_string()))?;

    // Load the PDF document
    let document = pdfium
        .load_pdf_from_byte_slice(pdf_data, None)
        .map_err(|e| Error::Internal(format!("Failed to load PDF: {}", e)))?;

    // Get the first page
    let page = document
        .pages()
        .get(0)
        .map_err(|e| Error::Internal(format!("Failed to get first page: {}", e)))?;

    // Calculate render dimensions preserving aspect ratio
    let page_width = page.width().value as u32;
    let page_height = page.height().value as u32;
    let (render_width, render_height) =
        calculate_thumbnail_dimensions(page_width, page_height, max_width, max_height);

    // Render the page to a bitmap
    let render_config = PdfRenderConfig::new()
        .set_target_width(render_width as i32)
        .set_target_height(render_height as i32)
        .rotate_if_landscape(PdfPageRenderRotation::None, false);

    let bitmap = page
        .render_with_config(&render_config)
        .map_err(|e| Error::Internal(format!("Failed to render PDF page: {}", e)))?;

    // Convert bitmap to image
    let img = bitmap_to_dynamic_image(&bitmap)?;

    // Determine output format
    let (output_format, content_type) = match format {
        Some("png") => (ImageFormat::Png, "image/png"),
        Some("jpeg") | Some("jpg") => (ImageFormat::Jpeg, "image/jpeg"),
        Some("webp") | None => (ImageFormat::WebP, "image/webp"),
        Some(f) => {
            return Err(Error::BadRequest(format!("Unsupported format: {}", f)));
        },
    };

    // Encode to output format
    let mut buffer = Cursor::new(Vec::new());
    img.write_to(&mut buffer, output_format)
        .map_err(|e| Error::Internal(format!("Failed to encode thumbnail: {}", e)))?;

    Ok(PdfThumbnailResult {
        data: buffer.into_inner(),
        content_type,
    })
}

/// Convert PDFium bitmap to DynamicImage.
fn bitmap_to_dynamic_image(bitmap: &PdfBitmap) -> Result<DynamicImage> {
    let width = bitmap.width() as u32;
    let height = bitmap.height() as u32;

    // Get the raw pixel buffer (renamed method in newer versions)
    let buffer = bitmap.as_raw_bytes();

    // PDFium uses BGRA format, we need to convert to RGBA
    let mut rgba_buffer = Vec::with_capacity(buffer.len());
    for chunk in buffer.chunks_exact(4) {
        rgba_buffer.push(chunk[2]); // R (was B)
        rgba_buffer.push(chunk[1]); // G
        rgba_buffer.push(chunk[0]); // B (was R)
        rgba_buffer.push(chunk[3]); // A
    }

    let img = RgbaImage::from_raw(width, height, rgba_buffer)
        .ok_or_else(|| Error::Internal("Failed to create image from PDF bitmap".to_string()))?;

    Ok(DynamicImage::ImageRgba8(img))
}

/// Generate thumbnail for a video file (extract frame using ffmpeg CLI).
async fn generate_video_thumbnail(
    state: &AppState,
    bucket: &str,
    key: &str,
    query: &ThumbnailQuery,
) -> Result<Response> {
    // Get the video data
    let object = state.storage.get_object(bucket, key).await?;
    let video_data = object.data.to_vec();

    // Spawn blocking task for CPU-intensive video processing
    let (max_width, max_height) = query.size.dimensions();
    let format = query.format.clone();

    let result = tokio::task::spawn_blocking(move || {
        extract_video_frame_cli(&video_data, max_width, max_height, format.as_deref())
    })
    .await
    .map_err(|e| Error::Internal(format!("Video frame extraction task failed: {}", e)))??;

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, result.content_type)
        .header(header::CACHE_CONTROL, "public, max-age=86400") // Cache 24h
        .body(Body::from(result.data))
        .map_err(|e| Error::Internal(e.to_string()))
}

/// Result of video frame extraction.
struct VideoThumbnailResult {
    data: Vec<u8>,
    content_type: &'static str,
}

/// Extract video frame using ffmpeg CLI.
fn extract_video_frame_cli(
    video_data: &[u8],
    max_width: u32,
    max_height: u32,
    format: Option<&str>,
) -> Result<VideoThumbnailResult> {
    use std::io::Write;
    use std::process::Command;

    // Check if ffmpeg is available
    let ffmpeg_check = Command::new("ffmpeg").arg("-version").output();
    if ffmpeg_check.is_err() {
        return Err(Error::Internal(
            "Video thumbnails unavailable: ffmpeg not installed. Install ffmpeg on your system."
                .to_string(),
        ));
    }

    // Create temp files for input and output
    let temp_dir = std::env::temp_dir();
    let input_path = temp_dir.join(format!("video_in_{}.tmp", uuid::Uuid::new_v4()));
    let output_ext = match format {
        Some("png") => "png",
        Some("jpeg") | Some("jpg") => "jpg",
        _ => "webp",
    };
    let output_path = temp_dir.join(format!("video_out_{}.{}", uuid::Uuid::new_v4(), output_ext));

    // Write video data to temp file
    {
        let mut file = std::fs::File::create(&input_path)
            .map_err(|e| Error::Internal(format!("Failed to create temp file: {}", e)))?;
        file.write_all(video_data)
            .map_err(|e| Error::Internal(format!("Failed to write temp file: {}", e)))?;
    }

    // Clean up temp files on exit
    let _cleanup_input = TempFileCleanup {
        path: input_path.clone(),
    };
    let _cleanup_output = TempFileCleanup {
        path: output_path.clone(),
    };

    // Build scale filter preserving aspect ratio
    let scale_filter = format!(
        "scale='min({},iw)':min'({},ih)':force_original_aspect_ratio=decrease",
        max_width, max_height
    );

    // Run ffmpeg to extract frame at 2 seconds (or first frame if shorter)
    let output = Command::new("ffmpeg")
        .args([
            "-y", // Overwrite output
            "-ss",
            "2", // Seek to 2 seconds
            "-i",
            input_path.to_str().unwrap_or(""),
            "-vframes",
            "1", // Extract 1 frame
            "-vf",
            &scale_filter, // Scale down
            "-q:v",
            "2", // Quality
            output_path.to_str().unwrap_or(""),
        ])
        .output();

    // If seeking to 2s failed (video too short), try from start
    let output = match output {
        Ok(o) if !o.status.success() => Command::new("ffmpeg")
            .args([
                "-y",
                "-i",
                input_path.to_str().unwrap_or(""),
                "-vframes",
                "1",
                "-vf",
                &scale_filter,
                "-q:v",
                "2",
                output_path.to_str().unwrap_or(""),
            ])
            .output(),
        other => other,
    };

    output.map_err(|e| Error::Internal(format!("Failed to run ffmpeg: {}", e)))?;

    // Read output file
    let thumbnail_data = std::fs::read(&output_path)
        .map_err(|e| Error::Internal(format!("Failed to read thumbnail: {}", e)))?;

    if thumbnail_data.is_empty() {
        return Err(Error::Internal("ffmpeg produced empty output".to_string()));
    }

    let content_type = match format {
        Some("png") => "image/png",
        Some("jpeg") | Some("jpg") => "image/jpeg",
        _ => "image/webp",
    };

    Ok(VideoThumbnailResult {
        data: thumbnail_data,
        content_type,
    })
}

/// Helper struct to clean up temp files.
struct TempFileCleanup {
    path: std::path::PathBuf,
}

impl Drop for TempFileCleanup {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.path);
    }
}

/// Generate waveform thumbnail for an audio file.
async fn generate_audio_waveform(
    state: &AppState,
    bucket: &str,
    key: &str,
    query: &ThumbnailQuery,
) -> Result<Response> {
    // Get the audio data
    let object = state.storage.get_object(bucket, key).await?;
    let audio_data = object.data.to_vec();

    // Spawn blocking task for CPU-intensive audio processing
    let (max_width, max_height) = query.size.dimensions();
    let format = query.format.clone();

    let result = tokio::task::spawn_blocking(move || {
        generate_waveform_cli(&audio_data, max_width, max_height, format.as_deref())
    })
    .await
    .map_err(|e| Error::Internal(format!("Audio waveform task failed: {}", e)))??;

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, result.content_type)
        .header(header::CACHE_CONTROL, "public, max-age=86400") // Cache 24h
        .body(Body::from(result.data))
        .map_err(|e| Error::Internal(e.to_string()))
}

/// Result of waveform generation.
struct WaveformResult {
    data: Vec<u8>,
    content_type: &'static str,
}

/// Generate waveform using ffmpeg CLI.
fn generate_waveform_cli(
    audio_data: &[u8],
    width: u32,
    height: u32,
    format: Option<&str>,
) -> Result<WaveformResult> {
    use std::io::Write;
    use std::process::Command;

    // Check if ffmpeg is available
    let ffmpeg_check = Command::new("ffmpeg").arg("-version").output();
    if ffmpeg_check.is_err() {
        return Err(Error::Internal(
            "Audio waveforms unavailable: ffmpeg not installed. Install ffmpeg on your system."
                .to_string(),
        ));
    }

    // Create temp files for input and output
    let temp_dir = std::env::temp_dir();
    let input_path = temp_dir.join(format!("audio_in_{}.tmp", uuid::Uuid::new_v4()));
    let output_ext = match format {
        Some("png") => "png",
        Some("jpeg") | Some("jpg") => "jpg",
        _ => "png", // Use PNG for waveforms (better for line graphics)
    };
    let output_path = temp_dir.join(format!(
        "waveform_out_{}.{}",
        uuid::Uuid::new_v4(),
        output_ext
    ));

    // Write audio data to temp file
    {
        let mut file = std::fs::File::create(&input_path)
            .map_err(|e| Error::Internal(format!("Failed to create temp file: {}", e)))?;
        file.write_all(audio_data)
            .map_err(|e| Error::Internal(format!("Failed to write temp file: {}", e)))?;
    }

    // Clean up temp files on exit
    let _cleanup_input = TempFileCleanup {
        path: input_path.clone(),
    };
    let _cleanup_output = TempFileCleanup {
        path: output_path.clone(),
    };

    // Build showwavespic filter for waveform visualization
    // Colors: foreground=#3b82f6 (blue), background transparent for PNG
    let filter = format!("showwavespic=s={}x{}:colors=#3b82f6|#60a5fa", width, height);

    // Run ffmpeg to generate waveform image
    let output = Command::new("ffmpeg")
        .args([
            "-y", // Overwrite output
            "-i",
            input_path.to_str().unwrap_or(""),
            "-filter_complex",
            &filter,
            "-frames:v",
            "1",
            output_path.to_str().unwrap_or(""),
        ])
        .output();

    let output = output.map_err(|e| Error::Internal(format!("Failed to run ffmpeg: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(Error::Internal(format!(
            "ffmpeg waveform generation failed: {}",
            stderr
        )));
    }

    // Read output file
    let waveform_data = std::fs::read(&output_path)
        .map_err(|e| Error::Internal(format!("Failed to read waveform: {}", e)))?;

    if waveform_data.is_empty() {
        return Err(Error::Internal(
            "ffmpeg produced empty waveform".to_string(),
        ));
    }

    let content_type = match format {
        Some("jpeg") | Some("jpg") => "image/jpeg",
        _ => "image/png",
    };

    Ok(WaveformResult {
        data: waveform_data,
        content_type,
    })
}

/// Generate preview for an image file (resized for display).
async fn generate_image_preview(
    state: &AppState,
    bucket: &str,
    key: &str,
    query: &PreviewQuery,
) -> Result<Response> {
    // Get the original image data
    let object = state.storage.get_object(bucket, key).await?;

    // Decode the image
    let img = ImageReader::new(Cursor::new(&object.data))
        .with_guessed_format()
        .map_err(|e| Error::Internal(format!("Failed to detect image format: {}", e)))?
        .decode()
        .map_err(|e| Error::Internal(format!("Failed to decode image: {}", e)))?;

    // Get target dimensions (default: max 1920x1080 for preview)
    let max_width = query.width.unwrap_or(1920);
    let max_height = query.height.unwrap_or(1080);

    // Only resize if image is larger than target
    let (orig_width, orig_height) = (img.width(), img.height());
    let preview_img = if orig_width > max_width || orig_height > max_height {
        let (new_width, new_height) =
            calculate_thumbnail_dimensions(orig_width, orig_height, max_width, max_height);
        img.resize_exact(new_width, new_height, FilterType::Lanczos3)
    } else {
        img
    };

    // Encode as WebP for efficient transmission
    let mut buffer = Cursor::new(Vec::new());
    preview_img
        .write_to(&mut buffer, ImageFormat::WebP)
        .map_err(|e| Error::Internal(format!("Failed to encode preview: {}", e)))?;

    let bytes = buffer.into_inner();

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "image/webp")
        .header(header::CACHE_CONTROL, "public, max-age=3600") // Cache 1h
        .body(Body::from(bytes))
        .map_err(|e| Error::Internal(e.to_string()))
}

/// Calculate thumbnail dimensions preserving aspect ratio.
fn calculate_thumbnail_dimensions(
    orig_width: u32,
    orig_height: u32,
    max_width: u32,
    max_height: u32,
) -> (u32, u32) {
    let width_ratio = max_width as f64 / orig_width as f64;
    let height_ratio = max_height as f64 / orig_height as f64;
    let ratio = width_ratio.min(height_ratio);

    let new_width = (orig_width as f64 * ratio).round() as u32;
    let new_height = (orig_height as f64 * ratio).round() as u32;

    (new_width.max(1), new_height.max(1))
}

/// Response body for unsupported preview types.
#[derive(Debug, Serialize)]
struct PreviewNotAvailable {
    previewable: bool,
    message: &'static str,
}

/// Generate a preview for a file and return it immediately.
///
/// - Images (`image/*`): resized to max 800 px width, returned as WebP.
/// - Text files (`text/*`): first 1 000 characters returned as `text/plain`.
/// - Everything else: JSON `{"previewable":false,"message":"preview not available"}`.
#[tracing::instrument(skip(state))]
pub async fn generate_preview(
    State(state): State<AppState>,
    Path((bucket, key)): Path<(String, String)>,
) -> Result<Response> {
    let info = state.storage.get_object_info(&bucket, &key).await?;
    let content_type = info
        .content_type
        .as_deref()
        .unwrap_or("application/octet-stream")
        .to_string();

    if content_type.starts_with("image/") {
        // Decode the image, resize to max 800 px width, return as WebP.
        let object = state.storage.get_object(&bucket, &key).await?;

        let img = ImageReader::new(Cursor::new(&object.data))
            .with_guessed_format()
            .map_err(|e| Error::Internal(format!("Failed to detect image format: {}", e)))?
            .decode()
            .map_err(|e| Error::Internal(format!("Failed to decode image: {}", e)))?;

        const MAX_WIDTH: u32 = 800;
        let preview_img = if img.width() > MAX_WIDTH {
            let new_height =
                ((img.height() as f64 * MAX_WIDTH as f64) / img.width() as f64).round() as u32;
            let new_height = new_height.max(1);
            img.resize_exact(MAX_WIDTH, new_height, FilterType::Lanczos3)
        } else {
            img
        };

        let mut buffer = Cursor::new(Vec::new());
        preview_img
            .write_to(&mut buffer, ImageFormat::WebP)
            .map_err(|e| Error::Internal(format!("Failed to encode preview: {}", e)))?;

        return Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, "image/webp")
            .header(header::CACHE_CONTROL, "public, max-age=3600")
            .body(Body::from(buffer.into_inner()))
            .map_err(|e| Error::Internal(e.to_string()));
    }

    if content_type.starts_with("text/") {
        // Return the first 1 000 characters as plain text.
        let object = state.storage.get_object(&bucket, &key).await?;

        let text = String::from_utf8_lossy(&object.data);
        let preview: String = text.chars().take(1_000).collect();

        return Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, "text/plain; charset=utf-8")
            .body(Body::from(preview))
            .map_err(|e| Error::Internal(e.to_string()));
    }

    // All other types: preview not available.
    let body = serde_json::to_vec(&PreviewNotAvailable {
        previewable: false,
        message: "preview not available",
    })
    .map_err(|e| Error::Internal(e.to_string()))?;

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(body))
        .map_err(|e| Error::Internal(e.to_string()))
}

/// Get preview for a file.
#[tracing::instrument(skip(state))]
pub async fn get_preview(
    State(state): State<AppState>,
    Path((bucket, key)): Path<(String, String)>,
    Query(query): Query<PreviewQuery>,
) -> Result<Response> {
    let info = state.storage.get_object_info(&bucket, &key).await?;
    let content_type = info
        .content_type
        .as_deref()
        .unwrap_or("application/octet-stream");
    let preview_type = get_preview_type(content_type);

    match preview_type {
        PreviewType::Text | PreviewType::Code => {
            // Return raw text content (limited)
            let object = state.storage.get_object(&bucket, &key).await?;

            // Limit to 100KB for preview
            let preview_bytes = if object.data.len() > 100_000 {
                object.data.slice(0..100_000)
            } else {
                object.data
            };

            Ok(Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, "text/plain; charset=utf-8")
                .body(Body::from(preview_bytes))
                .map_err(|e| Error::Internal(e.to_string()))?)
        },
        PreviewType::Image => {
            // Return resized image for preview
            generate_image_preview(&state, &bucket, &key, &query).await
        },
        PreviewType::Pdf => {
            // Return the raw PDF for client-side rendering (pdf.js)
            let object = state.storage.get_object(&bucket, &key).await?;
            Ok(Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, "application/pdf")
                .header(header::CACHE_CONTROL, "public, max-age=3600")
                .body(Body::from(object.data))
                .map_err(|e| Error::Internal(e.to_string()))?)
        },
        PreviewType::Video => {
            // Return the raw video for client-side playback (HTML5 video player)
            let object = state.storage.get_object(&bucket, &key).await?;
            let video_type = content_type.to_string();
            Ok(Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, video_type)
                .header(header::CACHE_CONTROL, "public, max-age=3600")
                .header(header::ACCEPT_RANGES, "bytes")
                .body(Body::from(object.data))
                .map_err(|e| Error::Internal(e.to_string()))?)
        },
        PreviewType::Audio => {
            // Return the raw audio for client-side playback (HTML5 audio player)
            let object = state.storage.get_object(&bucket, &key).await?;
            let audio_type = content_type.to_string();
            Ok(Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, audio_type)
                .header(header::CACHE_CONTROL, "public, max-age=3600")
                .header(header::ACCEPT_RANGES, "bytes")
                .body(Body::from(object.data))
                .map_err(|e| Error::Internal(e.to_string()))?)
        },
        PreviewType::Document => {
            // For DOCX: call signapps-office convert endpoint to get HTML preview.
            // For other doc types: fall back to a plain-text download redirect.
            let ext = key.rsplit('.').next().unwrap_or("").to_lowercase();

            if ext == "docx" || content_type.contains("wordprocessingml") {
                let object = state.storage.get_object(&bucket, &key).await?;
                let office_url = std::env::var("OFFICE_SERVICE_URL")
                    .unwrap_or_else(|_| "http://localhost:3014".to_string());

                // Build multipart form for the office convert endpoint
                let file_part = reqwest::multipart::Part::bytes(object.data.to_vec())
                    .file_name(key.clone())
                    .mime_str(
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    )
                    .map_err(|e| Error::Internal(format!("MIME error: {}", e)))?;
                let form = reqwest::multipart::Form::new()
                    .text("input_format", "html")
                    .text("target_format", "html")
                    .part("file", file_part);

                let client = reqwest::Client::new();
                match client
                    .post(format!("{}/api/v1/office/convert", office_url))
                    .multipart(form)
                    .send()
                    .await
                {
                    Ok(resp) if resp.status().is_success() => {
                        if let Ok(json) = resp.json::<serde_json::Value>().await {
                            if let Some(html_b64) = json["data_base64"].as_str() {
                                use base64::Engine;
                                if let Ok(html_bytes) =
                                    base64::engine::general_purpose::STANDARD.decode(html_b64)
                                {
                                    return Ok(Response::builder()
                                        .status(StatusCode::OK)
                                        .header(header::CONTENT_TYPE, "text/html; charset=utf-8")
                                        .header(header::CACHE_CONTROL, "public, max-age=300")
                                        .body(Body::from(html_bytes))
                                        .map_err(|e| Error::Internal(e.to_string()))?);
                                }
                            }
                        }
                        Err(Error::Internal(
                            "Office service returned invalid response".to_string(),
                        ))
                    },
                    _ => {
                        // Office service unavailable: redirect to download
                        Ok(Response::builder()
                            .status(StatusCode::SEE_OTHER)
                            .header(
                                header::LOCATION,
                                format!("/api/v1/files/{}/{}", bucket, key),
                            )
                            .body(Body::empty())
                            .map_err(|e| Error::Internal(e.to_string()))?)
                    },
                }
            } else {
                // For other document types (ODT, RTF…): redirect to download
                Ok(Response::builder()
                    .status(StatusCode::SEE_OTHER)
                    .header(
                        header::LOCATION,
                        format!("/api/v1/files/{}/{}", bucket, key),
                    )
                    .body(Body::empty())
                    .map_err(|e| Error::Internal(e.to_string()))?)
            }
        },
        PreviewType::None => Err(Error::BadRequest(
            "Preview not available for this file type".to_string(),
        )),
    }
}

/// Get preview info for a file.
#[tracing::instrument(skip(state))]
pub async fn get_preview_info(
    State(state): State<AppState>,
    Path((bucket, key)): Path<(String, String)>,
) -> Result<Json<PreviewInfo>> {
    let info = state.storage.get_object_info(&bucket, &key).await?;
    let content_type = info
        .content_type
        .as_deref()
        .unwrap_or("application/octet-stream");
    let preview_type = get_preview_type(content_type);

    let previewable = !matches!(preview_type, PreviewType::None);

    let base_url = std::env::var("PUBLIC_URL").unwrap_or_else(|_| "http://localhost:3004".into());

    let thumbnail_url = if matches!(
        preview_type,
        PreviewType::Image | PreviewType::Pdf | PreviewType::Video | PreviewType::Audio
    ) {
        Some(format!(
            "{}/api/v1/preview/{}/{}/thumbnail",
            base_url, bucket, key
        ))
    } else {
        None
    };

    let preview_url = if previewable {
        Some(format!("{}/api/v1/preview/{}/{}", base_url, bucket, key))
    } else {
        None
    };

    // Extract page count for PDFs
    let pages = if matches!(preview_type, PreviewType::Pdf) {
        get_pdf_page_count(&state, &bucket, &key).await.ok()
    } else {
        None
    };

    Ok(Json(PreviewInfo {
        previewable,
        preview_type,
        pages,
        thumbnail_url,
        preview_url,
    }))
}

/// Extract page count from a PDF file.
async fn get_pdf_page_count(state: &AppState, bucket: &str, key: &str) -> Result<u32> {
    let object = state.storage.get_object(bucket, key).await?;
    let doc = PdfDocument::load_mem(&object.data)
        .map_err(|e| Error::Internal(format!("Failed to load PDF: {}", e)))?;
    Ok(doc.get_pages().len() as u32)
}

/// Determine preview type from content type.
fn get_preview_type(content_type: &str) -> PreviewType {
    match content_type {
        t if t.starts_with("image/") => PreviewType::Image,
        "application/pdf" => PreviewType::Pdf,
        t if t.starts_with("video/") => PreviewType::Video,
        t if t.starts_with("audio/") => PreviewType::Audio,
        t if t.starts_with("text/") => {
            if t.contains("html") || t.contains("css") || t.contains("javascript") {
                PreviewType::Code
            } else {
                PreviewType::Text
            }
        },
        "application/json" | "application/xml" | "application/javascript" => PreviewType::Code,
        t if t.contains("word") || t.contains("document") => PreviewType::Document,
        t if t.contains("presentation") || t.contains("powerpoint") => PreviewType::Document,
        t if t.contains("spreadsheet") || t.contains("excel") => PreviewType::Document,
        _ => PreviewType::None,
    }
}

/// Check if a file type supports streaming preview.
pub fn supports_streaming_preview(content_type: &str) -> bool {
    content_type.starts_with("video/") || content_type.starts_with("audio/")
}

// ============================================================================
// ARCHIVE LISTING
// ============================================================================

/// A file entry in an archive.
#[derive(Debug, Serialize)]
pub struct ArchiveFile {
    pub name: String,
    pub size: u64,
    pub compressed_size: u64,
    pub is_directory: bool,
}

/// Response with archive listing.
#[derive(Debug, Serialize)]
pub struct ArchiveListResponse {
    pub files: Vec<ArchiveFile>,
    pub total_size: u64,
    pub total_compressed: u64,
    pub file_count: usize,
}

/// Get archive listing (ZIP files).
#[tracing::instrument(skip(state))]
pub async fn get_archive_listing(
    State(state): State<AppState>,
    Path((bucket, key)): Path<(String, String)>,
) -> Result<Json<ArchiveListResponse>> {
    // Get file data
    let object = state.storage.get_object(&bucket, &key).await?;

    // Check content type
    let content_type = &object.content_type;
    if !is_archive_type(content_type) && !key.ends_with(".zip") {
        return Err(Error::BadRequest(
            "File is not a supported archive format".to_string(),
        ));
    }

    // Parse ZIP archive
    let cursor = Cursor::new(&object.data);
    let mut archive = ZipArchive::new(cursor)
        .map_err(|e| Error::Internal(format!("Failed to read archive: {}", e)))?;

    let mut files = Vec::new();
    let mut total_size = 0u64;
    let mut total_compressed = 0u64;

    for i in 0..archive.len() {
        let file = archive
            .by_index(i)
            .map_err(|e| Error::Internal(format!("Failed to read archive entry: {}", e)))?;

        let size = file.size();
        let compressed_size = file.compressed_size();

        files.push(ArchiveFile {
            name: file.name().to_string(),
            size,
            compressed_size,
            is_directory: file.is_dir(),
        });

        total_size += size;
        total_compressed += compressed_size;
    }

    Ok(Json(ArchiveListResponse {
        file_count: files.len(),
        files,
        total_size,
        total_compressed,
    }))
}

// ============================================================================
// DOCUMENT METADATA
// ============================================================================

/// Document metadata response.
#[derive(Debug, Serialize)]
pub struct DocumentMetadata {
    pub filename: String,
    pub content_type: String,
    pub size: i64,
    pub document_type: String,
    pub title: Option<String>,
    pub author: Option<String>,
    pub creator: Option<String>,
    pub producer: Option<String>,
    pub created_at: Option<String>,
    pub modified_at: Option<String>,
    pub page_count: Option<u32>,
}

/// Get document metadata.
#[tracing::instrument(skip(state))]
pub async fn get_document_metadata(
    State(state): State<AppState>,
    Path((bucket, key)): Path<(String, String)>,
) -> Result<Json<DocumentMetadata>> {
    // Get file info
    let info = state.storage.get_object_info(&bucket, &key).await?;
    let content_type = info
        .content_type
        .as_deref()
        .unwrap_or("application/octet-stream");

    // Extract filename from key
    let filename = key.rsplit('/').next().unwrap_or(&key).to_string();

    // Determine document type
    let document_type = get_document_type_name(content_type, &filename);

    // For PDFs, extract detailed metadata
    if content_type == "application/pdf" || filename.ends_with(".pdf") {
        return get_pdf_metadata(
            &state,
            &bucket,
            &key,
            filename,
            content_type.to_string(),
            info.size,
        )
        .await;
    }

    // For other documents, return basic metadata
    Ok(Json(DocumentMetadata {
        filename,
        content_type: content_type.to_string(),
        size: info.size,
        document_type,
        title: None,
        author: None,
        creator: None,
        producer: None,
        created_at: info.last_modified.clone(),
        modified_at: info.last_modified,
        page_count: None,
    }))
}

/// Get PDF metadata using lopdf.
async fn get_pdf_metadata(
    state: &AppState,
    bucket: &str,
    key: &str,
    filename: String,
    content_type: String,
    size: i64,
) -> Result<Json<DocumentMetadata>> {
    let object = state.storage.get_object(bucket, key).await?;

    let doc = match PdfDocument::load_mem(&object.data) {
        Ok(d) => d,
        Err(_) => {
            // Return basic metadata if PDF parsing fails
            return Ok(Json(DocumentMetadata {
                filename,
                content_type,
                size,
                document_type: "PDF Document".to_string(),
                title: None,
                author: None,
                creator: None,
                producer: None,
                created_at: None,
                modified_at: None,
                page_count: None,
            }));
        },
    };

    let page_count = doc.get_pages().len() as u32;

    // Try to extract metadata from PDF Info dictionary
    let (title, author, creator, producer, created_at, modified_at) = extract_pdf_info_dict(&doc);

    Ok(Json(DocumentMetadata {
        filename,
        content_type,
        size,
        document_type: "PDF Document".to_string(),
        title,
        author,
        creator,
        producer,
        created_at,
        modified_at,
        page_count: Some(page_count),
    }))
}

/// Extract metadata from PDF Info dictionary.
#[allow(clippy::type_complexity)]
fn extract_pdf_info_dict(
    doc: &PdfDocument,
) -> (
    Option<String>,
    Option<String>,
    Option<String>,
    Option<String>,
    Option<String>,
    Option<String>,
) {
    let trailer = &doc.trailer;

    // Try to get Info dictionary reference
    let info_ref = match trailer.get(b"Info") {
        Ok(obj) => obj.as_reference().ok(),
        Err(_) => None,
    };

    let Some(info_ref) = info_ref else {
        return (None, None, None, None, None, None);
    };

    let info_dict = match doc.get_object(info_ref) {
        Ok(obj) => obj.as_dict().ok().cloned(),
        Err(_) => None,
    };

    let Some(info) = info_dict else {
        return (None, None, None, None, None, None);
    };

    let get_string = |key: &[u8]| -> Option<String> {
        info.get(key)
            .ok()
            .and_then(|o| o.as_string().ok())
            .map(|s| s.to_string())
    };

    (
        get_string(b"Title"),
        get_string(b"Author"),
        get_string(b"Creator"),
        get_string(b"Producer"),
        get_string(b"CreationDate"),
        get_string(b"ModDate"),
    )
}

/// Get human-readable document type name.
fn get_document_type_name(content_type: &str, filename: &str) -> String {
    // Try by content type first
    let type_name = match content_type {
        "application/pdf" => "PDF Document",
        "application/msword" => "Microsoft Word 97-2003",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" => {
            "Microsoft Word"
        },
        "application/vnd.ms-excel" => "Microsoft Excel 97-2003",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" => "Microsoft Excel",
        "application/vnd.ms-powerpoint" => "Microsoft PowerPoint 97-2003",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation" => {
            "Microsoft PowerPoint"
        },
        "application/vnd.oasis.opendocument.text" => "OpenDocument Text",
        "application/vnd.oasis.opendocument.spreadsheet" => "OpenDocument Spreadsheet",
        "application/vnd.oasis.opendocument.presentation" => "OpenDocument Presentation",
        "text/plain" => "Plain Text",
        "text/html" => "HTML Document",
        "text/markdown" => "Markdown Document",
        _ => "",
    };

    if !type_name.is_empty() {
        return type_name.to_string();
    }

    // Fall back to extension
    let ext = filename.rsplit('.').next().unwrap_or("").to_lowercase();
    match ext.as_str() {
        "pdf" => "PDF Document",
        "doc" => "Microsoft Word 97-2003",
        "docx" => "Microsoft Word",
        "xls" => "Microsoft Excel 97-2003",
        "xlsx" => "Microsoft Excel",
        "ppt" => "Microsoft PowerPoint 97-2003",
        "pptx" => "Microsoft PowerPoint",
        "odt" => "OpenDocument Text",
        "ods" => "OpenDocument Spreadsheet",
        "odp" => "OpenDocument Presentation",
        "txt" => "Plain Text",
        "md" => "Markdown Document",
        "html" | "htm" => "HTML Document",
        "rtf" => "Rich Text Format",
        _ => "Document",
    }
    .to_string()
}

/// Check if content type is an archive.
fn is_archive_type(content_type: &str) -> bool {
    matches!(
        content_type,
        "application/zip"
            | "application/x-zip-compressed"
            | "application/x-tar"
            | "application/gzip"
            | "application/x-gzip"
            | "application/x-7z-compressed"
            | "application/x-rar-compressed"
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_thumbnail_size_dimensions() {
        assert_eq!(ThumbnailSize::Small.dimensions(), (64, 64));
        assert_eq!(ThumbnailSize::Medium.dimensions(), (256, 256));
        assert_eq!(ThumbnailSize::Large.dimensions(), (512, 512));
    }

    #[test]
    fn test_preview_type_detection() {
        assert!(matches!(get_preview_type("image/png"), PreviewType::Image));
        assert!(matches!(
            get_preview_type("application/pdf"),
            PreviewType::Pdf
        ));
        assert!(matches!(get_preview_type("video/mp4"), PreviewType::Video));
        assert!(matches!(get_preview_type("text/plain"), PreviewType::Text));
        assert!(matches!(
            get_preview_type("application/json"),
            PreviewType::Code
        ));
        assert!(matches!(
            get_preview_type("application/octet-stream"),
            PreviewType::None
        ));
    }

    #[test]
    fn test_streaming_preview_support() {
        assert!(supports_streaming_preview("video/mp4"));
        assert!(supports_streaming_preview("audio/mpeg"));
        assert!(!supports_streaming_preview("image/png"));
        assert!(!supports_streaming_preview("application/pdf"));
    }
}
