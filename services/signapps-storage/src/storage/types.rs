//! Storage types.
#![allow(dead_code)]

use serde::{Deserialize, Serialize};

/// Bucket information.
#[derive(Debug, Clone, Serialize)]
pub struct BucketInfo {
    pub name: String,
    pub creation_date: Option<String>,
}

/// Object (file) information.
#[derive(Debug, Clone, Serialize)]
pub struct ObjectInfo {
    pub key: String,
    pub size: i64,
    pub last_modified: Option<String>,
    pub etag: Option<String>,
    pub content_type: Option<String>,
}

/// Upload request.
#[derive(Debug, Clone, Deserialize)]
pub struct UploadRequest {
    pub bucket: String,
    pub key: String,
    pub content_type: Option<String>,
}

/// Presigned URL request.
#[derive(Debug, Clone, Deserialize)]
pub struct PresignedUrlRequest {
    pub bucket: String,
    pub key: String,
    /// Expiration in seconds (default: 3600)
    pub expires_in: Option<u64>,
}

/// Presigned URL response.
#[derive(Debug, Clone, Serialize)]
pub struct PresignedUrlResponse {
    pub url: String,
    pub expires_at: String,
}

/// Copy request.
#[derive(Debug, Clone, Deserialize)]
pub struct CopyRequest {
    pub source_bucket: String,
    pub source_key: String,
    pub dest_bucket: String,
    pub dest_key: String,
}

/// Storage stats.
#[derive(Debug, Clone, Serialize)]
pub struct StorageStats {
    pub total_buckets: usize,
    pub total_objects: usize,
    pub total_size_bytes: i64,
}

/// List objects query parameters.
#[derive(Debug, Clone, Deserialize)]
pub struct ListObjectsQuery {
    pub prefix: Option<String>,
    pub delimiter: Option<String>,
    pub max_keys: Option<i32>,
    pub continuation_token: Option<String>,
}

/// List objects response.
#[derive(Debug, Clone, Serialize)]
pub struct ListObjectsResponse {
    pub objects: Vec<ObjectInfo>,
    pub prefixes: Vec<String>,
    pub is_truncated: bool,
    pub next_continuation_token: Option<String>,
}
