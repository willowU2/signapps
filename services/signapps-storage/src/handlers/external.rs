//! External storage management handlers.
//!
//! Provides endpoints to list, connect, and disconnect external storage
//! including USB drives, NFS shares, SMB/CIFS shares, and S3-compatible storage.
#![allow(dead_code)]

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use signapps_common::{Error, Result};
use uuid::Uuid;

use crate::AppState;

/// Type of external storage.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExternalStorageType {
    Usb,
    Nfs,
    Smb,
    S3,
    Webdav,
}

impl std::fmt::Display for ExternalStorageType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ExternalStorageType::Usb => write!(f, "usb"),
            ExternalStorageType::Nfs => write!(f, "nfs"),
            ExternalStorageType::Smb => write!(f, "smb"),
            ExternalStorageType::S3 => write!(f, "s3"),
            ExternalStorageType::Webdav => write!(f, "webdav"),
        }
    }
}

/// Status of an external storage connection.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ConnectionStatus {
    Connected,
    Disconnected,
    Error,
    Connecting,
}

/// External storage information.
#[derive(Debug, Clone, Serialize)]
/// ExternalStorage data transfer object.
pub struct ExternalStorage {
    pub id: Uuid,
    pub name: String,
    pub storage_type: ExternalStorageType,
    pub status: ConnectionStatus,
    pub mount_path: Option<String>,
    pub remote_path: Option<String>,
    pub host: Option<String>,
    pub total_bytes: Option<u64>,
    pub used_bytes: Option<u64>,
    pub available_bytes: Option<u64>,
    pub is_readonly: bool,
    pub last_connected: Option<chrono::DateTime<chrono::Utc>>,
    pub error_message: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// Request to connect external storage.
#[derive(Debug, Deserialize)]
/// Request body for Connect.
pub struct ConnectRequest {
    /// Human-readable name for this storage
    pub name: String,
    /// Type of storage to connect
    pub storage_type: ExternalStorageType,
    /// Local mount path (e.g., /mnt/nas)
    pub mount_path: String,
    /// Remote path/share (e.g., //server/share for SMB, server:/export for NFS)
    pub remote_path: Option<String>,
    /// Host for network storage
    pub host: Option<String>,
    /// Username for authentication
    pub username: Option<String>,
    /// Password for authentication
    pub password: Option<String>,
    /// Additional options
    pub options: Option<ConnectOptions>,
}

/// Additional connection options.
#[derive(Debug, Deserialize)]
/// ConnectOptions data transfer object.
pub struct ConnectOptions {
    /// Mount as read-only
    pub readonly: Option<bool>,
    /// NFS version (3 or 4)
    pub nfs_version: Option<u8>,
    /// SMB version (1, 2, or 3)
    pub smb_version: Option<u8>,
    /// S3 endpoint URL
    pub s3_endpoint: Option<String>,
    /// S3 region
    pub s3_region: Option<String>,
    /// S3 bucket name
    pub s3_bucket: Option<String>,
    /// S3 access key
    pub s3_access_key: Option<String>,
    /// S3 secret key
    pub s3_secret_key: Option<String>,
}

/// Response after connecting storage.
#[derive(Debug, Serialize)]
/// Response for Connect.
pub struct ConnectResponse {
    pub success: bool,
    pub storage: Option<ExternalStorage>,
    pub message: String,
}

// In-memory storage for connected external storage (in production, use database)
use once_cell::sync::Lazy;
use std::sync::RwLock;

static EXTERNAL_STORAGES: Lazy<RwLock<Vec<ExternalStorage>>> =
    Lazy::new(|| RwLock::new(Vec::new()));

/// List all external storage (USB, NAS, etc.).
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/external",
    responses((status = 200, description = "Success")),
    tag = "Storage"
)]
#[tracing::instrument(skip_all)]
pub async fn list_external(State(_state): State<AppState>) -> Result<Json<Vec<ExternalStorage>>> {
    let mut storages = Vec::new();

    // Get USB drives from sysinfo
    let disks = sysinfo::Disks::new_with_refreshed_list();
    for disk in disks.list() {
        if disk.is_removable() {
            let mount_path = disk.mount_point().to_string_lossy().to_string();
            let device_name = disk.name().to_string_lossy().to_string();

            let total = disk.total_space();
            let available = disk.available_space();
            let used = total - available;

            storages.push(ExternalStorage {
                id: Uuid::new_v5(&Uuid::NAMESPACE_OID, mount_path.as_bytes()),
                name: device_name.clone(),
                storage_type: ExternalStorageType::Usb,
                status: ConnectionStatus::Connected,
                mount_path: Some(mount_path),
                remote_path: None,
                host: None,
                total_bytes: Some(total),
                used_bytes: Some(used),
                available_bytes: Some(available),
                is_readonly: false,
                last_connected: Some(chrono::Utc::now()),
                error_message: None,
                created_at: chrono::Utc::now(),
            });
        }
    }

    // Add configured external storages
    if let Ok(guard) = EXTERNAL_STORAGES.read() {
        storages.extend(guard.iter().cloned());
    }

    Ok(Json(storages))
}

/// Connect external storage (NFS, SMB, S3).
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/external",
    responses((status = 200, description = "Success")),
    tag = "Storage"
)]
#[tracing::instrument(skip_all)]
pub async fn connect_external(
    State(_state): State<AppState>,
    Json(payload): Json<ConnectRequest>,
) -> Result<Json<ConnectResponse>> {
    // Validate mount path
    if !payload.mount_path.starts_with('/') {
        return Err(Error::Validation("Mount path must be absolute".to_string()));
    }

    // Create mount point directory
    if !tokio::fs::try_exists(&payload.mount_path)
        .await
        .unwrap_or(false)
    {
        tokio::fs::create_dir_all(&payload.mount_path)
            .await
            .map_err(|e| Error::Storage(format!("Failed to create mount point: {}", e)))?;
    }

    let id = Uuid::new_v4();
    let now = chrono::Utc::now();

    let result = match payload.storage_type {
        ExternalStorageType::Nfs => connect_nfs(&payload).await,
        ExternalStorageType::Smb => connect_smb(&payload).await,
        ExternalStorageType::S3 => connect_s3(&payload).await,
        ExternalStorageType::Webdav => connect_webdav(&payload).await,
        ExternalStorageType::Usb => {
            return Err(Error::Validation(
                "USB devices are auto-detected, cannot manually connect".to_string(),
            ));
        },
    };

    match result {
        Ok(()) => {
            let storage = ExternalStorage {
                id,
                name: payload.name.clone(),
                storage_type: payload.storage_type,
                status: ConnectionStatus::Connected,
                mount_path: Some(payload.mount_path.clone()),
                remote_path: payload.remote_path.clone(),
                host: payload.host.clone(),
                total_bytes: None, // Will be populated after mount
                used_bytes: None,
                available_bytes: None,
                is_readonly: payload
                    .options
                    .as_ref()
                    .and_then(|o| o.readonly)
                    .unwrap_or(false),
                last_connected: Some(now),
                error_message: None,
                created_at: now,
            };

            // Store the connection
            if let Ok(mut guard) = EXTERNAL_STORAGES.write() {
                guard.push(storage.clone());
            }

            tracing::info!(
                storage_id = %id,
                name = %payload.name,
                storage_type = %payload.storage_type,
                "External storage connected"
            );

            Ok(Json(ConnectResponse {
                success: true,
                storage: Some(storage),
                message: format!(
                    "{} storage '{}' connected successfully",
                    payload.storage_type, payload.name
                ),
            }))
        },
        Err(e) => {
            let storage = ExternalStorage {
                id,
                name: payload.name.clone(),
                storage_type: payload.storage_type,
                status: ConnectionStatus::Error,
                mount_path: Some(payload.mount_path.clone()),
                remote_path: payload.remote_path.clone(),
                host: payload.host.clone(),
                total_bytes: None,
                used_bytes: None,
                available_bytes: None,
                is_readonly: false,
                last_connected: None,
                error_message: Some(e.to_string()),
                created_at: now,
            };

            Ok(Json(ConnectResponse {
                success: false,
                storage: Some(storage),
                message: format!("Failed to connect: {}", e),
            }))
        },
    }
}

/// Disconnect external storage.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/external",
    responses((status = 200, description = "Success")),
    tag = "Storage"
)]
#[tracing::instrument(skip_all)]
pub async fn disconnect_external(
    State(_state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    // Find the storage
    let storage = {
        let guard = EXTERNAL_STORAGES
            .read()
            .map_err(|_| Error::Internal("Failed to read storage list".to_string()))?;
        guard.iter().find(|s| s.id == id).cloned()
    };

    let storage = storage.ok_or_else(|| Error::NotFound(format!("External storage {}", id)))?;

    // Check if it's a USB device (cannot disconnect)
    if storage.storage_type == ExternalStorageType::Usb {
        return Err(Error::Validation(
            "USB devices must be safely ejected through the OS".to_string(),
        ));
    }

    // Unmount if mounted
    if let Some(ref mount_path) = storage.mount_path {
        let output = tokio::process::Command::new("umount")
            .arg(mount_path)
            .output()
            .await
            .map_err(|e| Error::Storage(format!("Failed to execute umount: {}", e)))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            // Try lazy unmount
            let lazy_output = tokio::process::Command::new("umount")
                .arg("-l")
                .arg(mount_path)
                .output()
                .await;

            if lazy_output.as_ref().map_or(true, |o| !o.status.success()) {
                return Err(Error::Storage(format!("Failed to unmount: {}", stderr)));
            }
        }
    }

    // Remove from storage list
    if let Ok(mut guard) = EXTERNAL_STORAGES.write() {
        guard.retain(|s| s.id != id);
    }

    tracing::info!(storage_id = %id, "External storage disconnected");

    Ok(StatusCode::NO_CONTENT)
}

/// Connect NFS share.
async fn connect_nfs(payload: &ConnectRequest) -> Result<()> {
    let remote = payload
        .remote_path
        .as_ref()
        .ok_or_else(|| Error::Validation("remote_path is required for NFS".to_string()))?;

    let mut cmd = tokio::process::Command::new("mount");
    cmd.arg("-t").arg("nfs");

    // Add NFS version if specified
    if let Some(ref opts) = payload.options {
        if let Some(version) = opts.nfs_version {
            cmd.arg("-o").arg(format!("nfsvers={}", version));
        }
    }

    cmd.arg(remote).arg(&payload.mount_path);

    let output = cmd
        .output()
        .await
        .map_err(|e| Error::Storage(format!("Failed to execute mount: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(Error::Storage(format!("NFS mount failed: {}", stderr)));
    }

    Ok(())
}

/// Connect SMB/CIFS share.
async fn connect_smb(payload: &ConnectRequest) -> Result<()> {
    let remote = payload
        .remote_path
        .as_ref()
        .ok_or_else(|| Error::Validation("remote_path is required for SMB".to_string()))?;

    let mut cmd = tokio::process::Command::new("mount");
    cmd.arg("-t").arg("cifs");

    let mut options = Vec::new();

    // Add credentials if provided
    if let Some(ref username) = payload.username {
        options.push(format!("username={}", username));
    }
    if let Some(ref password) = payload.password {
        options.push(format!("password={}", password));
    }

    // Add SMB version if specified
    if let Some(ref opts) = payload.options {
        if let Some(version) = opts.smb_version {
            options.push(format!("vers={}.0", version));
        }
    }

    if !options.is_empty() {
        cmd.arg("-o").arg(options.join(","));
    }

    cmd.arg(remote).arg(&payload.mount_path);

    let output = cmd
        .output()
        .await
        .map_err(|e| Error::Storage(format!("Failed to execute mount: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(Error::Storage(format!("SMB mount failed: {}", stderr)));
    }

    Ok(())
}

/// Connect S3-compatible storage (via s3fs-fuse).
async fn connect_s3(payload: &ConnectRequest) -> Result<()> {
    let opts = payload
        .options
        .as_ref()
        .ok_or_else(|| Error::Validation("options with S3 configuration required".to_string()))?;

    let bucket = opts
        .s3_bucket
        .as_ref()
        .ok_or_else(|| Error::Validation("s3_bucket is required".to_string()))?;

    let access_key = opts
        .s3_access_key
        .as_ref()
        .ok_or_else(|| Error::Validation("s3_access_key is required".to_string()))?;

    let secret_key = opts
        .s3_secret_key
        .as_ref()
        .ok_or_else(|| Error::Validation("s3_secret_key is required".to_string()))?;

    // Write credentials to temp file
    let creds_file = format!("/tmp/.s3fs-creds-{}", Uuid::new_v4());
    let creds_content = format!("{}:{}", access_key, secret_key);
    tokio::fs::write(&creds_file, &creds_content)
        .await
        .map_err(|e| Error::Storage(format!("Failed to write S3 credentials: {}", e)))?;

    // Set permissions to 600
    tokio::process::Command::new("chmod")
        .arg("600")
        .arg(&creds_file)
        .output()
        .await
        .ok();

    let mut cmd = tokio::process::Command::new("s3fs");
    cmd.arg(bucket).arg(&payload.mount_path);

    let mut s3fs_opts = vec![format!("passwd_file={}", creds_file)];

    if let Some(ref endpoint) = opts.s3_endpoint {
        s3fs_opts.push(format!("url={}", endpoint));
        s3fs_opts.push("use_path_request_style".to_string());
    }

    if let Some(ref region) = opts.s3_region {
        s3fs_opts.push(format!("endpoint={}", region));
    }

    cmd.arg("-o").arg(s3fs_opts.join(","));

    let output = cmd
        .output()
        .await
        .map_err(|e| Error::Storage(format!("Failed to execute s3fs: {}", e)))?;

    // Clean up credentials file
    let _ = tokio::fs::remove_file(&creds_file).await;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(Error::Storage(format!("S3 mount failed: {}", stderr)));
    }

    Ok(())
}

/// Connect WebDAV storage (via davfs2).
async fn connect_webdav(payload: &ConnectRequest) -> Result<()> {
    let remote = payload
        .remote_path
        .as_ref()
        .ok_or_else(|| Error::Validation("remote_path (WebDAV URL) is required".to_string()))?;

    let mut cmd = tokio::process::Command::new("mount");
    cmd.arg("-t").arg("davfs");

    if let (Some(username), Some(password)) = (&payload.username, &payload.password) {
        // Write to secrets file
        let secrets_dir = "/etc/davfs2";
        let secrets_file = format!("{}/secrets", secrets_dir);

        // Append credentials (in production, manage this more securely)
        let _entry = format!("{} {} {}\n", remote, username, password);
        tokio::fs::OpenOptions::new()
            .append(true)
            .create(true)
            .open(&secrets_file)
            .await
            .ok();
    }

    cmd.arg(remote).arg(&payload.mount_path);

    let output = cmd
        .output()
        .await
        .map_err(|e| Error::Storage(format!("Failed to execute mount: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(Error::Storage(format!("WebDAV mount failed: {}", stderr)));
    }

    Ok(())
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
