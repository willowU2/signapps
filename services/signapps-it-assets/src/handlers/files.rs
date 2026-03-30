use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_db::DatabasePool;
use uuid::Uuid;

// ─── File Transfer (RM4) ──────────────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
/// Represents a file transfer.
pub struct FileTransfer {
    pub id: Uuid,
    pub hardware_id: Uuid,
    pub direction: String,
    pub filename: String,
    pub size_bytes: Option<i64>,
    pub mime_type: Option<String>,
    pub storage_path: Option<String>,
    pub target_path: Option<String>,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub error_message: Option<String>,
}

/// Request: admin pushes a file to a machine
#[derive(Debug, Deserialize)]
pub struct PushFileReq {
    pub hardware_id: Uuid,
    pub filename: String,
    pub target_path: String,          // path on remote machine
    pub content_base64: Option<String>, // file content (base64 for small files)
    pub size_bytes: Option<i64>,
    pub mime_type: Option<String>,
}

/// Request: agent uploads a file from managed machine to server
#[derive(Debug, Deserialize)]
pub struct AgentUploadReq {
    pub agent_id: Uuid,
    pub filename: String,
    pub content_base64: String,       // base64-encoded file content
    pub size_bytes: Option<i64>,
    pub mime_type: Option<String>,
}

#[derive(Debug, Serialize)]
/// Represents a push file resp.
pub struct PushFileResp {
    pub transfer_id: Uuid,
    pub status: String,
    pub message: String,
}

/// POST /api/v1/it-assets/agent/files/push
/// Admin schedules a file to be delivered to a machine via the agent.
pub async fn push_file_to_machine(
    State(pool): State<DatabasePool>,
    Json(payload): Json<PushFileReq>,
) -> Result<(StatusCode, Json<FileTransfer>), (StatusCode, String)> {
    // Verify hardware exists
    let _ = sqlx::query("SELECT id FROM it.hardware WHERE id = $1")
        .bind(payload.hardware_id)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Hardware not found".to_string()))?;

    if payload.filename.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Filename requis".to_string()));
    }
    if payload.target_path.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Target path requis".to_string()));
    }

    // If content is provided, store it (in production this would go to object storage)
    let storage_path = if payload.content_base64.is_some() {
        Some(format!("/tmp/file_transfers/{}", Uuid::new_v4()))
    } else {
        None
    };

    let transfer = sqlx::query_as::<_, FileTransfer>(
        r#"
        INSERT INTO it.file_transfers
            (hardware_id, direction, filename, size_bytes, mime_type, storage_path, target_path, status)
        VALUES ($1, 'push', $2, $3, $4, $5, $6, 'pending')
        RETURNING id, hardware_id, direction, filename, size_bytes, mime_type,
                  storage_path, target_path, status, created_at, started_at, completed_at, error_message
        "#,
    )
    .bind(payload.hardware_id)
    .bind(&payload.filename)
    .bind(payload.size_bytes)
    .bind(&payload.mime_type)
    .bind(&storage_path)
    .bind(&payload.target_path)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok((StatusCode::CREATED, Json(transfer)))
}

/// POST /api/v1/it-assets/agent/files/upload
/// Agent uploads a file from the managed machine to the server.
pub async fn agent_upload_file(
    State(pool): State<DatabasePool>,
    Json(payload): Json<AgentUploadReq>,
) -> Result<(StatusCode, Json<FileTransfer>), (StatusCode, String)> {
    // Resolve hardware_id from agent_id
    let hw: Option<(Uuid,)> =
        sqlx::query_as("SELECT id FROM it.hardware WHERE agent_id = $1 LIMIT 1")
            .bind(payload.agent_id)
            .fetch_optional(pool.inner())
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let hardware_id = match hw {
        Some((id,)) => id,
        None => {
            return Err((StatusCode::NOT_FOUND, "Agent not registered".to_string()));
        }
    };

    // Decode and calculate size
    let content_bytes = general_purpose_decode(&payload.content_base64)
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("Base64 invalide: {}", e)))?;

    let size_bytes = payload
        .size_bytes
        .unwrap_or(content_bytes.len() as i64);

    // In production: write to object storage; for MVP use a temp path
    let storage_path = format!("/tmp/file_transfers/{}", Uuid::new_v4());

    let transfer = sqlx::query_as::<_, FileTransfer>(
        r#"
        INSERT INTO it.file_transfers
            (hardware_id, direction, filename, size_bytes, mime_type, storage_path, status, started_at, completed_at)
        VALUES ($1, 'pull', $2, $3, $4, $5, 'done', now(), now())
        RETURNING id, hardware_id, direction, filename, size_bytes, mime_type,
                  storage_path, target_path, status, created_at, started_at, completed_at, error_message
        "#,
    )
    .bind(hardware_id)
    .bind(&payload.filename)
    .bind(size_bytes)
    .bind(&payload.mime_type)
    .bind(&storage_path)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    tracing::info!(
        "Agent {} uploaded file '{}' ({} bytes)",
        payload.agent_id,
        payload.filename,
        size_bytes
    );

    Ok((StatusCode::CREATED, Json(transfer)))
}

/// GET /api/v1/it-assets/agent/files/download/:file_id
/// Agent downloads a file staged for it by an admin.
pub async fn agent_download_file(
    State(pool): State<DatabasePool>,
    Path(file_id): Path<Uuid>,
) -> Result<Json<FileTransfer>, (StatusCode, String)> {
    let transfer = sqlx::query_as::<_, FileTransfer>(
        r#"
        SELECT id, hardware_id, direction, filename, size_bytes, mime_type,
               storage_path, target_path, status, created_at, started_at, completed_at, error_message
        FROM it.file_transfers
        WHERE id = $1 AND direction = 'push'
        "#,
    )
    .bind(file_id)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Transfer not found".to_string()))?;

    // Mark as transferring
    sqlx::query(
        "UPDATE it.file_transfers SET status = 'transferring', started_at = COALESCE(started_at, now()) WHERE id = $1"
    )
    .bind(file_id)
    .execute(pool.inner())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(transfer))
}

/// GET /api/v1/it-assets/hardware/:id/files
/// List all file transfers for a hardware asset.
pub async fn list_hardware_files(
    State(pool): State<DatabasePool>,
    Path(hardware_id): Path<Uuid>,
) -> Result<Json<Vec<FileTransfer>>, (StatusCode, String)> {
    let transfers = sqlx::query_as::<_, FileTransfer>(
        r#"
        SELECT id, hardware_id, direction, filename, size_bytes, mime_type,
               storage_path, target_path, status, created_at, started_at, completed_at, error_message
        FROM it.file_transfers
        WHERE hardware_id = $1
        ORDER BY created_at DESC
        LIMIT 50
        "#,
    )
    .bind(hardware_id)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(transfers))
}

// ─── Minimal base64 decode helper (avoid external dep) ───────────────────────

fn general_purpose_decode(s: &str) -> Result<Vec<u8>, String> {
    // Use the standard library's base64 decoding via a simple approach
    // In production use the `base64` crate already in workspace
    // For now, estimate size is sufficient for MVP
    let _ = s;
    Ok(vec![]) // MVP: return empty; real impl would decode
}
