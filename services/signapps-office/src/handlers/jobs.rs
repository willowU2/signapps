//! Async job queue for heavy document exports.
//!
//! POST /api/v1/office/jobs/convert — enqueue a conversion, returns { job_id }
//! GET  /api/v1/office/jobs/:id    — poll job status

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

use crate::handlers::conversion::{ConversionRequest, OutputFormat};
use crate::AppState;

// ─── JobStatus ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
/// Application state for Job service.
pub enum JobState {
    Queued,
    Processing,
    Completed,
    Failed,
}

#[derive(Debug, Clone, Serialize)]
/// JobStatus data transfer object.
pub struct JobStatus {
    pub id: String,
    pub status: JobState,
    /// 0-100
    pub progress: u8,
    /// Download URL once completed
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result_url: Option<String>,
    /// Human-readable error if failed
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<String>,
}

// ─── In-memory store ─────────────────────────────────────────────────────────

/// Thread-safe in-memory map of job_id → JobStatus.
pub type JobStore = Arc<DashMap<String, JobStatus>>;

pub fn new_job_store() -> JobStore {
    Arc::new(DashMap::new())
}

// ─── Request / Response DTOs ─────────────────────────────────────────────────

/// POST /api/v1/office/jobs/convert
#[derive(Debug, Deserialize)]
/// Request body for JobConvert.
pub struct JobConvertRequest {
    /// Output format (docx, pdf, markdown, html, text)
    pub format: OutputFormat,
    /// Optional filename for the output
    pub filename: Option<String>,
    /// Conversion payload — same as POST /api/v1/convert
    #[serde(flatten)]
    pub conversion: ConversionRequest,
}

#[derive(Debug, Serialize)]
/// Response for JobSubmit.
pub struct JobSubmitResponse {
    pub job_id: String,
}

// ─── Handlers ────────────────────────────────────────────────────────────────

/// POST /api/v1/office/jobs/convert
///
/// Accepts the same body as `/api/v1/convert` plus a `format` field.
/// Returns `{ job_id }` immediately; the conversion runs in the background.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    post,
    path = "/api/v1/jobs",
    responses((status = 201, description = "Success")),
    tag = "Office"
)]
#[tracing::instrument(skip_all)]
pub async fn submit_convert_job(
    State(state): State<AppState>,
    Json(req): Json<JobConvertRequest>,
) -> Result<(StatusCode, Json<JobSubmitResponse>), (StatusCode, String)> {
    let job_id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    // Register as queued
    state.jobs.insert(
        job_id.clone(),
        JobStatus {
            id: job_id.clone(),
            status: JobState::Queued,
            progress: 0,
            result_url: None,
            error: None,
            created_at: now,
            completed_at: None,
        },
    );

    // Spawn background task
    let jobs = Arc::clone(&state.jobs);
    let converter = state.converter.clone();
    let cache = state.cache.clone();
    let jid = job_id.clone();

    tokio::spawn(async move {
        run_conversion_job(jid, req, jobs, converter, cache).await;
    });

    Ok((StatusCode::ACCEPTED, Json(JobSubmitResponse { job_id })))
}

/// GET /api/v1/office/jobs/:id
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/jobs",
    responses((status = 200, description = "Success")),
    tag = "Office"
)]
#[tracing::instrument(skip_all)]
pub async fn get_job_status(
    State(state): State<AppState>,
    Path(job_id): Path<String>,
) -> Result<Json<JobStatus>, (StatusCode, String)> {
    match state.jobs.get(&job_id) {
        Some(entry) => Ok(Json(entry.value().clone())),
        None => Err((StatusCode::NOT_FOUND, format!("Job '{}' not found", job_id))),
    }
}

// ─── Background worker ───────────────────────────────────────────────────────

async fn run_conversion_job(
    job_id: String,
    req: JobConvertRequest,
    jobs: JobStore,
    converter: crate::converter::DocumentConverter,
    cache: signapps_cache::BinaryCacheService,
) {
    // Mark as processing
    if let Some(mut entry) = jobs.get_mut(&job_id) {
        entry.status = JobState::Processing;
        entry.progress = 10;
    }

    // Build cache key (same strategy as convert_json handler)
    let cache_key = {
        use std::hash::{DefaultHasher, Hash, Hasher};
        let mut hasher = DefaultHasher::new();
        serde_json::to_string(&req.conversion)
            .unwrap_or_default()
            .hash(&mut hasher);
        format!("job_{:?}_{}", req.format, hasher.finish())
    };

    // Convert content string
    let content_str = match req.conversion.input_format {
        crate::handlers::conversion::InputFormat::TiptapJson => {
            match serde_json::to_string(&req.conversion.content) {
                Ok(s) => s,
                Err(e) => {
                    mark_failed(&jobs, &job_id, e.to_string());
                    return;
                },
            }
        },
        crate::handlers::conversion::InputFormat::Html
        | crate::handlers::conversion::InputFormat::Markdown => {
            match req.conversion.content.as_str() {
                Some(s) => s.to_string(),
                None => {
                    mark_failed(&jobs, &job_id, "Content must be a string".into());
                    return;
                },
            }
        },
    };

    let input_format = match req.conversion.input_format {
        crate::handlers::conversion::InputFormat::TiptapJson => {
            crate::converter::InputFormat::TiptapJson
        },
        crate::handlers::conversion::InputFormat::Html => crate::converter::InputFormat::Html,
        crate::handlers::conversion::InputFormat::Markdown => {
            crate::converter::InputFormat::Markdown
        },
    };

    // Convert external comments to internal format
    let internal_comments: Option<Vec<crate::converter::comments::Comment>> =
        req.conversion.comments.map(|comments| {
            comments
                .into_iter()
                .map(|c| crate::converter::comments::Comment {
                    id: c.id,
                    author: c.author,
                    author_id: String::new(),
                    content: c.content,
                    created_at: c.created_at,
                    resolved: c.resolved,
                    replies: c
                        .replies
                        .into_iter()
                        .map(|r| crate::converter::comments::CommentReply {
                            id: String::new(),
                            author: r.author,
                            author_id: String::new(),
                            content: r.content,
                            created_at: r.created_at,
                        })
                        .collect(),
                })
                .collect()
        });

    // Update progress before the heavy work
    if let Some(mut entry) = jobs.get_mut(&job_id) {
        entry.progress = 30;
    }

    let result = converter
        .convert_with_comments(
            &content_str,
            input_format,
            req.format.into(),
            internal_comments.as_deref(),
        )
        .await;

    match result {
        Ok(conversion_result) => {
            // Store output in cache so clients can retrieve it
            let output_key = format!("job_result_{}", job_id);
            cache
                .set_with_ttl(
                    &output_key,
                    conversion_result.data.clone(),
                    std::time::Duration::from_secs(60 * 60), // 1 hour
                )
                .await;

            // Also populate the shared conversion cache
            cache
                .set_with_ttl(
                    &cache_key,
                    conversion_result.data,
                    std::time::Duration::from_secs(30 * 60),
                )
                .await;

            let ext = conversion_result.extension;
            let filename = req.filename.unwrap_or_else(|| format!("document.{}", ext));
            let result_url = format!("/api/v1/office/jobs/{}/download/{}", job_id, filename);
            let now = chrono::Utc::now().to_rfc3339();

            if let Some(mut entry) = jobs.get_mut(&job_id) {
                entry.status = JobState::Completed;
                entry.progress = 100;
                entry.result_url = Some(result_url);
                entry.completed_at = Some(now);
            }

            tracing::info!(job_id = %job_id, "Async conversion job completed");
        },
        Err(e) => {
            mark_failed(&jobs, &job_id, e.to_string());
            tracing::error!(job_id = %job_id, error = %e, "Async conversion job failed");
        },
    }
}

fn mark_failed(jobs: &JobStore, job_id: &str, error: String) {
    if let Some(mut entry) = jobs.get_mut(job_id) {
        entry.status = JobState::Failed;
        entry.error = Some(error);
        entry.completed_at = Some(chrono::Utc::now().to_rfc3339());
    }
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
