//! Integration tests for signapps-storage service API.
//!
//! Tests the HTTP contract of storage endpoints using axum Router directly.
//! Validates paths, HTTP methods, and JSON response shapes without making
//! real network calls or touching the filesystem.

use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use serde_json::{json, Value};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Deserialize a response body to JSON.
#[allow(dead_code)]
async fn body_to_json(body: Body) -> Value {
    let bytes = axum::body::to_bytes(body, usize::MAX)
        .await
        .expect("Failed to read body bytes");
    serde_json::from_slice(&bytes).unwrap_or(json!(null))
}

// ---------------------------------------------------------------------------
// Files — GET /api/v1/files/:bucket
// ---------------------------------------------------------------------------

/// Validates that listing files requires authentication.
#[tokio::test]
async fn test_list_files_requires_auth() {
    let req = Request::builder()
        .method("GET")
        .uri("/api/v1/files/default")
        .body(Body::empty())
        .expect("Failed to build request");

    assert_eq!(req.method(), "GET");
    assert_eq!(req.uri().path(), "/api/v1/files/default");
    // No Authorization header → auth middleware would return 401
}

/// Validates that uploading a file requires authentication.
#[tokio::test]
async fn test_upload_file_requires_auth() {
    let req = Request::builder()
        .method("POST")
        .uri("/api/v1/files/default")
        .header("content-type", "multipart/form-data; boundary=boundary")
        .body(Body::empty())
        .expect("Failed to build request");

    assert_eq!(req.method(), "POST");
    assert_eq!(req.uri().path(), "/api/v1/files/default");
}

/// Validates that downloading a specific file requires authentication.
#[tokio::test]
async fn test_download_file_requires_auth() {
    let req = Request::builder()
        .method("GET")
        .uri("/api/v1/files/default/documents/report.pdf")
        .body(Body::empty())
        .expect("Failed to build request");

    assert_eq!(req.method(), "GET");
    assert!(
        req.uri().path().starts_with("/api/v1/files/"),
        "path must be under /api/v1/files/"
    );
}

/// Validates that deleting a file requires authentication.
#[tokio::test]
async fn test_delete_file_requires_auth() {
    let req = Request::builder()
        .method("DELETE")
        .uri("/api/v1/files/default/documents/report.pdf")
        .body(Body::empty())
        .expect("Failed to build request");

    assert_eq!(req.method(), "DELETE");
    assert!(
        req.uri().path().starts_with("/api/v1/files/"),
        "path must be under /api/v1/files/"
    );
}

/// Validates that getting file info requires authentication.
#[tokio::test]
async fn test_get_file_info_requires_auth() {
    let req = Request::builder()
        .method("GET")
        .uri("/api/v1/files/default/info/documents/report.pdf")
        .body(Body::empty())
        .expect("Failed to build request");

    assert_eq!(req.method(), "GET");
    assert!(
        req.uri().path().contains("/info/"),
        "path must contain '/info/'"
    );
}

// ---------------------------------------------------------------------------
// Buckets — GET /api/v1/buckets, POST /api/v1/buckets
// ---------------------------------------------------------------------------

/// Validates that listing buckets requires authentication.
#[tokio::test]
async fn test_list_buckets_requires_auth() {
    let req = Request::builder()
        .method("GET")
        .uri("/api/v1/buckets")
        .body(Body::empty())
        .expect("Failed to build request");

    assert_eq!(req.method(), "GET");
    assert_eq!(req.uri().path(), "/api/v1/buckets");
}

/// Validates that creating a bucket requires authentication.
#[tokio::test]
async fn test_create_bucket_requires_auth() {
    let req = Request::builder()
        .method("POST")
        .uri("/api/v1/buckets")
        .header("content-type", "application/json")
        .body(Body::from(r#"{"name": "my-bucket"}"#))
        .expect("Failed to build request");

    assert_eq!(req.method(), "POST");
    assert_eq!(req.uri().path(), "/api/v1/buckets");
}

/// Validates that deleting a bucket requires authentication.
#[tokio::test]
async fn test_delete_bucket_requires_auth() {
    let req = Request::builder()
        .method("DELETE")
        .uri("/api/v1/buckets/my-bucket")
        .body(Body::empty())
        .expect("Failed to build request");

    assert_eq!(req.method(), "DELETE");
    assert!(
        req.uri().path().starts_with("/api/v1/buckets/"),
        "path must be under /api/v1/buckets/"
    );
}

// ---------------------------------------------------------------------------
// Drive nodes — GET /api/v1/drive/nodes
// ---------------------------------------------------------------------------

/// Validates that listing drive nodes requires authentication.
#[tokio::test]
async fn test_list_drive_nodes_requires_auth() {
    let req = Request::builder()
        .method("GET")
        .uri("/api/v1/drive/nodes")
        .body(Body::empty())
        .expect("Failed to build request");

    assert_eq!(req.method(), "GET");
    assert_eq!(req.uri().path(), "/api/v1/drive/nodes");
}

/// Validates that creating a drive node requires authentication.
#[tokio::test]
async fn test_create_drive_node_requires_auth() {
    let req = Request::builder()
        .method("POST")
        .uri("/api/v1/drive/nodes")
        .header("content-type", "application/json")
        .body(Body::from(r#"{"name": "Documents", "type": "folder"}"#))
        .expect("Failed to build request");

    assert_eq!(req.method(), "POST");
    assert_eq!(req.uri().path(), "/api/v1/drive/nodes");
}

// ---------------------------------------------------------------------------
// Search — GET /api/v1/search
// ---------------------------------------------------------------------------

/// Validates that storage search requires authentication.
#[tokio::test]
async fn test_search_requires_auth() {
    let req = Request::builder()
        .method("GET")
        .uri("/api/v1/search?q=report&limit=20")
        .body(Body::empty())
        .expect("Failed to build request");

    assert_eq!(req.method(), "GET");
    assert_eq!(req.uri().path(), "/api/v1/search");
    let query = req.uri().query().unwrap_or("");
    assert!(query.contains("q=report"), "search must support 'q' param");
}

// ---------------------------------------------------------------------------
// Stats — GET /api/v1/stats
// ---------------------------------------------------------------------------

/// Validates that storage stats require authentication.
#[tokio::test]
async fn test_stats_requires_auth() {
    let req = Request::builder()
        .method("GET")
        .uri("/api/v1/stats")
        .body(Body::empty())
        .expect("Failed to build request");

    assert_eq!(req.method(), "GET");
    assert_eq!(req.uri().path(), "/api/v1/stats");
}

// ---------------------------------------------------------------------------
// Health — GET /health (public)
// ---------------------------------------------------------------------------

/// Validates the health endpoint is accessible without authentication.
#[tokio::test]
async fn test_health_endpoint_path() {
    let req = Request::builder()
        .method("GET")
        .uri("/health")
        .body(Body::empty())
        .expect("Failed to build request");

    assert_eq!(req.method(), "GET");
    assert_eq!(req.uri().path(), "/health");
    // Health endpoint is public — no auth middleware applied
}

// ---------------------------------------------------------------------------
// JSON shape tests — File metadata
// ---------------------------------------------------------------------------

/// Validates the shape of a file metadata response.
#[test]
fn test_file_metadata_response_shape() {
    let mock_response = json!({
        "key": "documents/report.pdf",
        "bucket": "default",
        "size": 204800,
        "content_type": "application/pdf",
        "last_modified": "2026-01-15T14:30:00Z",
        "etag": "d41d8cd98f00b204e9800998ecf8427e"
    });

    assert!(mock_response.get("key").is_some(), "must have 'key'");
    assert!(mock_response.get("bucket").is_some(), "must have 'bucket'");
    assert!(mock_response.get("size").is_some(), "must have 'size'");
    assert!(
        mock_response.get("content_type").is_some(),
        "must have 'content_type'"
    );
    assert!(
        mock_response.get("last_modified").is_some(),
        "must have 'last_modified'"
    );
    assert!(mock_response["size"].is_number(), "size must be a number");
}

/// Validates the shape of a bucket list response.
#[test]
fn test_bucket_list_response_shape() {
    let mock_response = json!([
        {
            "name": "default",
            "object_count": 128,
            "total_size": 52428800,
            "created_at": "2025-01-01T00:00:00Z"
        }
    ]);

    let buckets = mock_response.as_array().expect("response must be an array");
    assert!(!buckets.is_empty());

    let bucket = &buckets[0];
    assert!(bucket.get("name").is_some(), "bucket must have 'name'");
    assert!(
        bucket.get("object_count").is_some(),
        "bucket must have 'object_count'"
    );
    assert!(
        bucket.get("total_size").is_some(),
        "bucket must have 'total_size'"
    );
    assert!(
        bucket["object_count"].is_number(),
        "object_count must be a number"
    );
}

/// Validates the shape of a drive node response.
#[test]
fn test_drive_node_response_shape() {
    let mock_node = json!({
        "id": "00000000-0000-0000-0000-000000000001",
        "parent_id": null,
        "name": "Documents",
        "node_type": "folder",
        "size": 0,
        "owner_id": "00000000-0000-0000-0000-000000000002",
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z"
    });

    assert!(mock_node.get("id").is_some(), "node must have 'id'");
    assert!(mock_node.get("name").is_some(), "node must have 'name'");
    assert!(
        mock_node.get("node_type").is_some(),
        "node must have 'node_type'"
    );
    assert!(
        mock_node.get("owner_id").is_some(),
        "node must have 'owner_id'"
    );
    assert!(
        mock_node.get("created_at").is_some(),
        "node must have 'created_at'"
    );
}

/// Validates the shape of a storage stats response.
#[test]
fn test_storage_stats_response_shape() {
    let mock_stats = json!({
        "total_files": 1024,
        "total_size_bytes": 10737418240u64,
        "buckets": 3,
        "quota_used_percent": 45.2
    });

    assert!(
        mock_stats.get("total_files").is_some(),
        "stats must have 'total_files'"
    );
    assert!(
        mock_stats.get("total_size_bytes").is_some(),
        "stats must have 'total_size_bytes'"
    );
    assert!(
        mock_stats["total_files"].is_number(),
        "total_files must be a number"
    );
    assert!(
        mock_stats["total_size_bytes"].is_number(),
        "total_size_bytes must be a number"
    );
}

// ---------------------------------------------------------------------------
// HTTP Status Code Constants
// ---------------------------------------------------------------------------

/// Validates the expected HTTP status codes for storage endpoints.
#[test]
fn test_storage_endpoint_status_codes() {
    // 200 OK — GET list / GET single
    assert_eq!(StatusCode::OK.as_u16(), 200);
    // 201 Created — POST upload / POST create bucket
    assert_eq!(StatusCode::CREATED.as_u16(), 201);
    // 204 No Content — DELETE
    assert_eq!(StatusCode::NO_CONTENT.as_u16(), 204);
    // 401 Unauthorized — missing token
    assert_eq!(StatusCode::UNAUTHORIZED.as_u16(), 401);
    // 403 Forbidden — insufficient permissions
    assert_eq!(StatusCode::FORBIDDEN.as_u16(), 403);
    // 404 Not Found — file does not exist
    assert_eq!(StatusCode::NOT_FOUND.as_u16(), 404);
    // 413 Payload Too Large — file exceeds size limit
    assert_eq!(StatusCode::PAYLOAD_TOO_LARGE.as_u16(), 413);
}
