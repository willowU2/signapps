//! File sharing handlers - Create and manage share links.
#![allow(dead_code)]

use crate::AppState;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::{Error, Result};
use signapps_db::repositories::StorageTier3Repository;
use uuid::Uuid;
/// Share link information.
#[derive(Debug, Clone, Serialize, Deserialize)]
/// ShareLink data transfer object.
pub struct ShareLink {
    pub id: Uuid,
    pub bucket: String,
    pub key: String,
    pub token: String,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
    pub password_protected: bool,
    pub max_downloads: Option<i32>,
    pub download_count: i32,
    pub access_type: ShareAccessType,
    pub is_active: bool,
}

/// Share access type.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ShareAccessType {
    View, // Can only view/preview
    #[default]
    Download, // Can download
    Edit, // Can edit (for collaborative editing)
}

impl std::str::FromStr for ShareAccessType {
    type Err = ();

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "view" => Ok(ShareAccessType::View),
            "edit" => Ok(ShareAccessType::Edit),
            _ => Ok(ShareAccessType::Download),
        }
    }
}

impl std::fmt::Display for ShareAccessType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ShareAccessType::View => write!(f, "view"),
            ShareAccessType::Download => write!(f, "download"),
            ShareAccessType::Edit => write!(f, "edit"),
        }
    }
}

/// Create share request.
#[derive(Debug, Deserialize)]
/// Request body for CreateShare.
pub struct CreateShareRequest {
    pub bucket: String,
    pub key: String,
    /// Expiration in hours (None = never expires)
    pub expires_in_hours: Option<i64>,
    /// Optional password protection
    pub password: Option<String>,
    /// Maximum number of downloads (None = unlimited)
    pub max_downloads: Option<i32>,
    /// Access type
    #[serde(default)]
    pub access_type: ShareAccessType,
}

/// Create share response.
#[derive(Debug, Serialize)]
/// Response for CreateShare.
pub struct CreateShareResponse {
    pub id: Uuid,
    pub token: String,
    pub url: String,
    pub expires_at: Option<DateTime<Utc>>,
}

/// Update share request.
#[derive(Debug, Deserialize)]
/// Request body for UpdateShare.
pub struct UpdateShareRequest {
    pub expires_in_hours: Option<i64>,
    pub password: Option<String>,
    pub max_downloads: Option<i32>,
    pub access_type: Option<ShareAccessType>,
    pub is_active: Option<bool>,
}

/// List shares query.
#[derive(Debug, Deserialize)]
/// Query parameters for filtering results.
pub struct ListSharesQuery {
    pub bucket: Option<String>,
    pub key: Option<String>,
    pub active_only: Option<bool>,
    pub limit: Option<i32>,
    pub offset: Option<i32>,
}

/// List shares response.
#[derive(Debug, Serialize)]
/// Response for ListShares.
pub struct ListSharesResponse {
    pub shares: Vec<ShareLink>,
    pub total: i64,
}

/// Access share request (for password-protected shares).
#[derive(Debug, Deserialize)]
/// Request body for AccessShare.
pub struct AccessShareRequest {
    pub password: Option<String>,
}

/// Access share response.
#[derive(Debug, Serialize)]
/// Response for AccessShare.
pub struct AccessShareResponse {
    pub bucket: String,
    pub key: String,
    pub filename: String,
    pub size: i64,
    pub content_type: String,
    pub access_type: ShareAccessType,
    /// Temporary download URL (valid for limited time)
    pub download_url: Option<String>,
}

/// Create a new share link.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    post,
    path = "/api/v1/shares",
    responses((status = 201, description = "Success")),
    tag = "Storage"
)]
pub async fn create_share(
    State(state): State<AppState>,
    axum::Extension(user_id): axum::Extension<Uuid>,
    Json(request): Json<CreateShareRequest>,
) -> Result<Json<CreateShareResponse>> {
    // Verify file exists
    let _info = state
        .storage
        .get_object_info(&request.bucket, &request.key)
        .await?;

    let token = generate_share_token();

    let expires_at = request
        .expires_in_hours
        .map(|hours| Utc::now() + Duration::hours(hours));

    let password_hash = if let Some(pwd) = &request.password {
        if pwd.is_empty() {
            None
        } else {
            Some(
                bcrypt::hash(pwd, bcrypt::DEFAULT_COST)
                    .map_err(|_| Error::Internal("Failed to hash password".into()))?,
            )
        }
    } else {
        None
    };

    let share = StorageTier3Repository::create_share(
        state.pool.inner(),
        user_id,
        &request.bucket,
        &request.key,
        &token,
        expires_at,
        password_hash,
        request.max_downloads,
        &request.access_type.to_string(),
    )
    .await
    .map_err(|e| Error::Internal(format!("Failed to create share: {}", e)))?;

    let base_url = std::env::var("NEXT_PUBLIC_STORAGE_URL")
        .unwrap_or_else(|_| "http://localhost:3000/api/v1".into());
    let url = format!("{}/shares/{}/access", base_url, token);

    tracing::info!(
        id = %share.id,
        bucket = %request.bucket,
        key = %request.key,
        "Share link created"
    );

    Ok(Json(CreateShareResponse {
        id: share.id,
        token,
        url,
        expires_at,
    }))
}

/// List shares for the current user.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/shares",
    responses((status = 200, description = "Success")),
    tag = "Storage"
)]
pub async fn list_shares(
    State(state): State<AppState>,
    axum::Extension(user_id): axum::Extension<Uuid>,
    Query(query): Query<ListSharesQuery>,
) -> Result<Json<ListSharesResponse>> {
    let active_only = query.active_only.unwrap_or(false);

    let shares = StorageTier3Repository::list_shares(
        state.pool.inner(),
        user_id,
        query.bucket.clone(),
        query.key.clone(),
        active_only,
    )
    .await
    .map_err(|_| Error::Internal("Failed to list shares".into()))?;

    let count = shares.len() as i64;

    let mapped = shares.into_iter().map(map_share_to_api).collect();

    Ok(Json(ListSharesResponse {
        shares: mapped,
        total: count,
    }))
}

/// Get share details.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/shares",
    responses((status = 200, description = "Success")),
    tag = "Storage"
)]
pub async fn get_share(
    State(state): State<AppState>,
    axum::Extension(user_id): axum::Extension<Uuid>,
    Path(id): Path<Uuid>,
) -> Result<Json<ShareLink>> {
    let share = StorageTier3Repository::get_share_by_id(state.pool.inner(), id)
        .await
        .map_err(|_| Error::NotFound(format!("Share {} not found", id)))?;

    if share.created_by != user_id {
        return Err(Error::Unauthorized);
    }

    Ok(Json(map_share_to_api(share)))
}

/// Update share settings.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    put,
    path = "/api/v1/shares",
    responses((status = 200, description = "Success")),
    tag = "Storage"
)]
pub async fn update_share(
    State(state): State<AppState>,
    axum::Extension(user_id): axum::Extension<Uuid>,
    Path(id): Path<Uuid>,
    Json(request): Json<UpdateShareRequest>,
) -> Result<Json<ShareLink>> {
    let expires_at = request
        .expires_in_hours
        .map(|hours| Utc::now() + Duration::hours(hours));

    let password_hash = if let Some(pwd) = &request.password {
        if pwd.is_empty() {
            Some("".to_string()) // Marker to clear it? No, we will just say Empty=Clear
        } else {
            Some(
                bcrypt::hash(pwd, bcrypt::DEFAULT_COST)
                    .map_err(|_| Error::Internal("Failed to hash pwd".into()))?,
            )
        }
    } else {
        None
    };

    let share = StorageTier3Repository::update_share(
        state.pool.inner(),
        id,
        user_id,
        expires_at,
        password_hash,
        request.max_downloads,
        request.access_type.map(|a| a.to_string()),
        request.is_active,
    )
    .await
    .map_err(|_| Error::NotFound("Failed to update share".into()))?;

    Ok(Json(map_share_to_api(share)))
}

/// Delete/revoke a share.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    delete,
    path = "/api/v1/shares",
    responses((status = 204, description = "Success")),
    tag = "Storage"
)]
pub async fn delete_share(
    State(state): State<AppState>,
    axum::Extension(user_id): axum::Extension<Uuid>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    StorageTier3Repository::delete_share(state.pool.inner(), id, user_id)
        .await
        .map_err(|_| Error::Internal("Failed to delete share".into()))?;

    tracing::info!(id = %id, "Share link revoked");
    Ok(StatusCode::NO_CONTENT)
}

fn validate_public_share(
    share: &signapps_db::models::storage_tier3::Share,
    password: Option<&String>,
) -> Result<()> {
    if !share.is_active {
        return Err(Error::NotFound("Share is not active".into()));
    }

    if let Some(exp) = share.expires_at {
        if exp < Utc::now() {
            return Err(Error::NotFound("Share link has expired".into()));
        }
    }

    if let Some(max) = share.max_downloads {
        if share.download_count.unwrap_or(0) >= max {
            return Err(Error::NotFound(
                "Share link has reached its maximum access limit".into(),
            ));
        }
    }

    if let Some(hash) = &share.password_hash {
        if !hash.is_empty() {
            let pwd = password.ok_or_else(|| Error::Unauthorized)?;
            if !bcrypt::verify(pwd, hash).unwrap_or(false) {
                return Err(Error::Unauthorized);
            }
        }
    }

    Ok(())
}

/// Access a shared file (public endpoint).
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/shares",
    responses((status = 200, description = "Success")),
    tag = "Storage"
)]
pub async fn access_share(
    State(state): State<AppState>,
    Path(token): Path<String>,
    Json(request): Json<AccessShareRequest>,
) -> Result<Json<AccessShareResponse>> {
    let share = StorageTier3Repository::get_share_by_token(state.pool.inner(), &token)
        .await
        .map_err(|_| Error::NotFound("Share not found".into()))?;

    validate_public_share(&share, request.password.as_ref())?;

    let stat = state
        .storage
        .get_object_info(&share.bucket, &share.key)
        .await?;

    let filename = share
        .key
        .split('/')
        .next_back()
        .unwrap_or(&share.key)
        .to_string();

    // Generate a time-limited share access token instead of leaking the password
    let share_token = uuid::Uuid::new_v4().to_string();
    let cache_key = format!("share_access:{}", share_token);
    state
        .cache
        .set(&cache_key, &token, std::time::Duration::from_secs(300))
        .await;

    let download_url = format!(
        "/api/v1/shares/{}/download?access_token={}",
        token, share_token
    );

    Ok(Json(AccessShareResponse {
        bucket: share.bucket,
        key: share.key,
        filename,
        size: stat.size as i64,
        content_type: stat
            .content_type
            .unwrap_or_else(|| "application/octet-stream".into()),
        access_type: share
            .access_type
            .parse()
            .unwrap_or(ShareAccessType::Download),
        download_url: Some(download_url),
    }))
}

/// Query parameters for shared file download.
#[derive(Debug, Deserialize)]
/// Query parameters for filtering results.
pub struct DownloadSharedQuery {
    pub access_token: Option<String>,
    pub password: Option<String>,
}

/// Download shared file directly.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/shares",
    responses((status = 200, description = "Success")),
    tag = "Storage"
)]
pub async fn download_shared(
    State(state): State<AppState>,
    Path(token): Path<String>,
    Query(params): Query<DownloadSharedQuery>,
) -> Result<axum::response::Response> {
    let share = StorageTier3Repository::get_share_by_token(state.pool.inner(), &token)
        .await
        .map_err(|_| Error::NotFound("Share not found".into()))?;

    // Validate access: prefer time-limited access_token, fall back to password
    if let Some(ref access_token) = params.access_token {
        let cache_key = format!("share_access:{}", access_token);
        let cached = state.cache.get_checked(&cache_key).await;
        match cached {
            Some(ref cached_token) if cached_token == &token => {
                // Valid access token — consume it (single-use)
                state.cache.del(&cache_key).await;
            },
            _ => {
                return Err(Error::Forbidden(
                    "Invalid or expired access token".to_string(),
                ));
            },
        }
    } else {
        // Fallback: direct password validation
        validate_public_share(&share, params.password.as_ref())?;
    }

    // Increment download count
    let _ = StorageTier3Repository::increment_download_count(state.pool.inner(), share.id).await;

    let filename = share
        .key
        .split('/')
        .next_back()
        .unwrap_or(&share.key)
        .to_string();

    let object = state.storage.get_object(&share.bucket, &share.key).await?;

    let content_type = object.content_type;
    let content_length = object.content_length;

    let body = axum::body::Body::from(object.data);

    let response = axum::response::Response::builder()
        .status(axum::http::StatusCode::OK)
        .header(axum::http::header::CONTENT_TYPE, content_type)
        .header(axum::http::header::CONTENT_LENGTH, content_length)
        .header(
            axum::http::header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{}\"", filename),
        )
        .body(body)
        .map_err(|e| Error::Internal(e.to_string()))?;

    Ok(response)
}

/// Generate a secure random token for sharing.
fn generate_share_token() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let bytes: Vec<u8> = (0..24).map(|_| rng.gen()).collect();
    base64::Engine::encode(&base64::engine::general_purpose::URL_SAFE_NO_PAD, &bytes)
}

fn map_share_to_api(share: signapps_db::models::storage_tier3::Share) -> ShareLink {
    ShareLink {
        id: share.id,
        bucket: share.bucket,
        key: share.key,
        token: share.token,
        created_by: share.created_by,
        // created_at has DEFAULT NOW() in DB but no NOT NULL — fall back to epoch if somehow NULL
        created_at: share.created_at.unwrap_or_else(Utc::now),
        expires_at: share.expires_at,
        password_protected: share
            .password_hash
            .as_deref()
            .is_some_and(|h| !h.is_empty()),
        max_downloads: share.max_downloads,
        // download_count has DEFAULT 0 in DB but no NOT NULL — fall back to 0 if somehow NULL
        download_count: share.download_count.unwrap_or(0),
        access_type: share
            .access_type
            .parse()
            .unwrap_or(ShareAccessType::Download),
        is_active: share.is_active,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_share_token_generation() {
        let token1 = generate_share_token();
        let token2 = generate_share_token();

        assert!(!token1.is_empty());
        assert!(!token2.is_empty());
        assert_ne!(token1, token2);
        assert!(token1.len() >= 32); // Base64 of 24 bytes
    }

    #[test]
    fn test_share_access_type_default() {
        assert_eq!(ShareAccessType::default(), ShareAccessType::Download);
    }
}
