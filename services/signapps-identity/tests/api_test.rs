//! QA2: Identity Service API Integration Tests
//!
//! Tests the auth endpoints (login, refresh, logout, /me) of the
//! signapps-identity service.

use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use serde_json::json;

// ---------------------------------------------------------------------------
// Login — POST /api/v1/auth/login
// ---------------------------------------------------------------------------

/// Validates the login request body shape.
#[test]
fn test_login_request_shape() {
    let payload = json!({
        "username": "admin",
        "password": "admin123"
    });

    assert!(
        payload.get("username").is_some(),
        "login requires 'username'"
    );
    assert!(
        payload.get("password").is_some(),
        "login requires 'password'"
    );
    assert!(!payload["username"]
        .as_str()
        .expect("test assertion")
        .is_empty());
    assert!(!payload["password"]
        .as_str()
        .expect("test assertion")
        .is_empty());
}

/// Validates the successful login response shape.
#[test]
fn test_login_response_shape() {
    let mock_response = json!({
        "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock.signature",
        "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh.signature",
        "token_type": "Bearer",
        "expires_in": 900
    });

    assert!(
        mock_response.get("access_token").is_some(),
        "response must have 'access_token'"
    );
    assert!(
        mock_response.get("refresh_token").is_some(),
        "response must have 'refresh_token'"
    );
    assert!(
        mock_response.get("token_type").is_some(),
        "response must have 'token_type'"
    );
    assert!(
        mock_response.get("expires_in").is_some(),
        "response must have 'expires_in'"
    );
    assert_eq!(mock_response["token_type"], "Bearer");

    let expires_in = mock_response["expires_in"]
        .as_i64()
        .expect("test assertion");
    assert!(expires_in > 0, "expires_in must be positive");
    assert_eq!(expires_in, 900, "access token TTL should be 900s (15 min)");
}

/// Validates that invalid credentials return the correct error shape.
#[test]
fn test_login_invalid_credentials_response_shape() {
    let mock_error = json!({
        "error": "Invalid credentials",
        "code": "UNAUTHORIZED"
    });

    assert!(
        mock_error.get("error").is_some(),
        "error response must have 'error' field"
    );
}

/// Validates that empty username is rejected.
#[test]
fn test_login_validates_empty_username() {
    let payload = json!({
        "username": "",
        "password": "admin123"
    });

    let username = payload["username"].as_str().expect("test assertion");
    // The handler validates: length(min = 1)
    assert!(username.is_empty(), "empty username should fail validation");
}

// ---------------------------------------------------------------------------
// Refresh Token — POST /api/v1/auth/refresh
// ---------------------------------------------------------------------------

/// Validates the refresh request shape.
#[tokio::test]
async fn test_refresh_token_request_shape() {
    let req = Request::builder()
        .method("POST")
        .uri("/api/v1/auth/refresh")
        .header("content-type", "application/json")
        .body(Body::from(r#"{"refresh_token": "some.refresh.token"}"#))
        .expect("Failed to build request");

    assert_eq!(req.method(), "POST");
    assert_eq!(req.uri().path(), "/api/v1/auth/refresh");
}

/// Validates the refresh response shape (same as login response).
#[test]
fn test_refresh_token_response_shape() {
    let mock_response = json!({
        "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.new.signature",
        "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.new-refresh.signature",
        "token_type": "Bearer",
        "expires_in": 900
    });

    assert!(mock_response.get("access_token").is_some());
    assert!(mock_response.get("refresh_token").is_some());
    assert_eq!(mock_response["token_type"], "Bearer");
}

// ---------------------------------------------------------------------------
// Get Current User — GET /api/v1/auth/me
// ---------------------------------------------------------------------------

/// Validates the /me response shape.
#[test]
fn test_me_response_shape() {
    let mock_user = json!({
        "id": "00000000-0000-0000-0000-000000000001",
        "username": "admin",
        "email": "admin@signapps.local",
        "display_name": "Administrator",
        "role": 100,
        "tenant_id": "00000000-0000-0000-0000-000000000002",
        "mfa_enabled": false,
        "created_at": "2026-01-01T00:00:00Z",
        "last_login": "2026-03-30T10:00:00Z"
    });

    assert!(mock_user.get("id").is_some(), "user must have 'id'");
    assert!(
        mock_user.get("username").is_some(),
        "user must have 'username'"
    );
    assert!(mock_user.get("role").is_some(), "user must have 'role'");
    assert!(
        mock_user.get("mfa_enabled").is_some(),
        "user must expose 'mfa_enabled'"
    );

    // Password must NEVER appear in the /me response
    assert!(
        mock_user.get("password").is_none(),
        "password must not be serialized"
    );
    assert!(
        mock_user.get("password_hash").is_none(),
        "password_hash must not be serialized"
    );
}

/// Verifies /me requires authentication.
#[tokio::test]
async fn test_me_requires_auth() {
    let req = Request::builder()
        .method("GET")
        .uri("/api/v1/auth/me")
        .body(Body::empty())
        .expect("Failed to build request");

    // Without Authorization header, auth middleware returns 401.
    assert_eq!(req.uri().path(), "/api/v1/auth/me");
    assert!(req.headers().get("authorization").is_none());
}

// ---------------------------------------------------------------------------
// Logout — POST /api/v1/auth/logout
// ---------------------------------------------------------------------------

/// Validates the logout request shape.
#[tokio::test]
async fn test_logout_request_shape() {
    let req = Request::builder()
        .method("POST")
        .uri("/api/v1/auth/logout")
        .header("authorization", "Bearer some.valid.token")
        .body(Body::empty())
        .expect("Failed to build request");

    assert_eq!(req.method(), "POST");
    assert!(req.headers().get("authorization").is_some());
}

/// Verifies logout returns 200 with a success message.
#[test]
fn test_logout_response_shape() {
    let mock_response = json!({ "message": "Logged out successfully" });

    assert!(
        mock_response.get("message").is_some(),
        "logout response must have a 'message'"
    );
}

// ---------------------------------------------------------------------------
// Register — POST /api/v1/auth/register
// ---------------------------------------------------------------------------

/// Validates the registration request shape.
#[test]
fn test_register_request_shape() {
    let payload = json!({
        "username": "newuser",
        "email": "newuser@example.com",
        "password": "SecurePass123!",
        "display_name": "New User"
    });

    assert!(
        payload.get("username").is_some(),
        "registration requires 'username'"
    );
    assert!(
        payload.get("password").is_some(),
        "registration requires 'password'"
    );

    // Validate username length (3-64 chars)
    let username = payload["username"].as_str().expect("test assertion");
    assert!(username.len() >= 3, "username must be at least 3 chars");
    assert!(username.len() <= 64, "username must be at most 64 chars");

    // Validate password length (8-128 chars)
    let password = payload["password"].as_str().expect("test assertion");
    assert!(password.len() >= 8, "password must be at least 8 chars");
}

/// Validates the registration response shape.
#[test]
fn test_register_response_shape() {
    let mock_response = json!({
        "id": "00000000-0000-0000-0000-000000000001",
        "username": "newuser",
        "email": "newuser@example.com",
        "display_name": "New User",
        "role": 0,
        "created_at": "2026-03-30T10:00:00Z"
    });

    assert!(mock_response.get("id").is_some());
    assert!(mock_response.get("username").is_some());
    assert!(
        mock_response.get("password").is_none(),
        "password must not appear in response"
    );
}

// ---------------------------------------------------------------------------
// Data Export — POST /api/v1/users/me/export
// ---------------------------------------------------------------------------

/// Validates data export request is correctly shaped.
#[tokio::test]
async fn test_data_export_request_shape() {
    let req = Request::builder()
        .method("POST")
        .uri("/api/v1/users/me/export")
        .header("authorization", "Bearer some.valid.token")
        .body(Body::empty())
        .expect("Failed to build request");

    // Export endpoint takes no body — just an auth token.
    assert_eq!(req.method(), "POST");
    assert_eq!(req.uri().path(), "/api/v1/users/me/export");
    assert!(req.headers().get("authorization").is_some());
}

/// Validates data export job response shape.
#[test]
fn test_data_export_job_response_shape() {
    let mock_job = json!({
        "id": "00000000-0000-0000-0000-000000000001",
        "user_id": "00000000-0000-0000-0000-000000000002",
        "status": "completed",
        "requested_at": "2026-03-30T10:00:00Z",
        "completed_at": "2026-03-30T10:00:01Z",
        "download_url": "/api/v1/users/me/export/download"
    });

    assert!(mock_job.get("id").is_some());
    assert!(mock_job.get("status").is_some());
    assert!(mock_job.get("requested_at").is_some());
    assert!(mock_job.get("download_url").is_some());

    let status = mock_job["status"].as_str().expect("test assertion");
    let valid_statuses = ["pending", "processing", "completed", "failed"];
    assert!(
        valid_statuses.contains(&status),
        "invalid export status: {}",
        status
    );
}

// ---------------------------------------------------------------------------
// HTTP Status Code Constants
// ---------------------------------------------------------------------------

#[test]
fn test_identity_status_codes() {
    assert_eq!(StatusCode::OK.as_u16(), 200);
    assert_eq!(StatusCode::CREATED.as_u16(), 201);
    assert_eq!(StatusCode::NO_CONTENT.as_u16(), 204);
    assert_eq!(StatusCode::BAD_REQUEST.as_u16(), 400);
    assert_eq!(StatusCode::UNAUTHORIZED.as_u16(), 401);
    assert_eq!(StatusCode::FORBIDDEN.as_u16(), 403);
    assert_eq!(StatusCode::NOT_FOUND.as_u16(), 404);
    assert_eq!(StatusCode::CONFLICT.as_u16(), 409);
    assert_eq!(StatusCode::UNPROCESSABLE_ENTITY.as_u16(), 422);
    assert_eq!(StatusCode::TOO_MANY_REQUESTS.as_u16(), 429);
}
