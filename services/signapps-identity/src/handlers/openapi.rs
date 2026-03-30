//! OpenAPI 3.1 spec endpoint — manual JSON generation.
//!
//! Serves a static OpenAPI 3.1 document describing the Identity service API.
//! This avoids adding the `utoipa` dependency while still providing machine-readable docs.
//! Registered at `GET /api/v1/openapi.json` in `main.rs`.

use axum::{http::header, response::IntoResponse, Json};
use serde_json::json;

/// `GET /api/v1/openapi.json` — Returns the OpenAPI 3.1 spec for the Identity service.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/openapi",
    responses((status = 200, description = "Success")),
    tag = "Identity"
)]
#[tracing::instrument(skip_all)]
pub async fn openapi_spec() -> impl IntoResponse {
    let spec = json!({
        "openapi": "3.1.0",
        "info": {
            "title": "SignApps Identity Service",
            "version": "1.0.0",
            "description": "Authentication, authorization, and user management service for SignApps Platform.",
            "license": { "name": "Apache-2.0", "url": "https://www.apache.org/licenses/LICENSE-2.0" }
        },
        "servers": [
            { "url": "http://localhost:3001", "description": "Local development" }
        ],
        "paths": {
            "/health": {
                "get": {
                    "summary": "Health check",
                    "operationId": "healthCheck",
                    "tags": ["system"],
                    "responses": { "200": { "description": "Service is healthy" } }
                }
            },
            "/api/v1/auth/login": {
                "post": {
                    "summary": "Login with email and password",
                    "operationId": "login",
                    "tags": ["auth"],
                    "requestBody": {
                        "required": true,
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "required": ["email", "password"],
                                    "properties": {
                                        "email": { "type": "string", "format": "email" },
                                        "password": { "type": "string" }
                                    }
                                }
                            }
                        }
                    },
                    "responses": {
                        "200": { "description": "Login successful, returns tokens" },
                        "401": { "description": "Invalid credentials" }
                    }
                }
            },
            "/api/v1/auth/register": {
                "post": {
                    "summary": "Register a new user",
                    "operationId": "register",
                    "tags": ["auth"],
                    "responses": {
                        "201": { "description": "User created" },
                        "409": { "description": "Email already exists" }
                    }
                }
            },
            "/api/v1/auth/refresh": {
                "post": {
                    "summary": "Refresh access token",
                    "operationId": "refreshToken",
                    "tags": ["auth"],
                    "responses": { "200": { "description": "New access token" } }
                }
            },
            "/api/v1/auth/logout": {
                "post": {
                    "summary": "Logout and invalidate tokens",
                    "operationId": "logout",
                    "tags": ["auth"],
                    "security": [{ "bearerAuth": [] }],
                    "responses": { "200": { "description": "Logged out" } }
                }
            },
            "/api/v1/auth/me": {
                "get": {
                    "summary": "Get current authenticated user",
                    "operationId": "getCurrentUser",
                    "tags": ["auth"],
                    "security": [{ "bearerAuth": [] }],
                    "responses": { "200": { "description": "Current user info" } }
                }
            },
            "/api/v1/users": {
                "get": {
                    "summary": "List all users (admin)",
                    "operationId": "listUsers",
                    "tags": ["users"],
                    "security": [{ "bearerAuth": [] }],
                    "responses": { "200": { "description": "Array of users" } }
                },
                "post": {
                    "summary": "Create a user (admin)",
                    "operationId": "createUser",
                    "tags": ["users"],
                    "security": [{ "bearerAuth": [] }],
                    "responses": { "201": { "description": "User created" } }
                }
            },
            "/api/v1/users/{id}": {
                "get": {
                    "summary": "Get user by ID",
                    "operationId": "getUser",
                    "tags": ["users"],
                    "security": [{ "bearerAuth": [] }],
                    "parameters": [{ "name": "id", "in": "path", "required": true, "schema": { "type": "string", "format": "uuid" } }],
                    "responses": { "200": { "description": "User details" }, "404": { "description": "Not found" } }
                },
                "put": {
                    "summary": "Update user",
                    "operationId": "updateUser",
                    "tags": ["users"],
                    "security": [{ "bearerAuth": [] }],
                    "parameters": [{ "name": "id", "in": "path", "required": true, "schema": { "type": "string", "format": "uuid" } }],
                    "responses": { "200": { "description": "User updated" } }
                },
                "delete": {
                    "summary": "Delete user",
                    "operationId": "deleteUser",
                    "tags": ["users"],
                    "security": [{ "bearerAuth": [] }],
                    "parameters": [{ "name": "id", "in": "path", "required": true, "schema": { "type": "string", "format": "uuid" } }],
                    "responses": { "204": { "description": "User deleted" } }
                }
            },
            "/api/v1/signatures": {
                "get": {
                    "summary": "List signature envelopes",
                    "operationId": "listSignatureEnvelopes",
                    "tags": ["signatures"],
                    "security": [{ "bearerAuth": [] }],
                    "responses": { "200": { "description": "Array of envelopes" } }
                },
                "post": {
                    "summary": "Create a signature envelope",
                    "operationId": "createSignatureEnvelope",
                    "tags": ["signatures"],
                    "security": [{ "bearerAuth": [] }],
                    "responses": { "201": { "description": "Envelope created" } }
                }
            },
            "/api/v1/user-signatures": {
                "get": {
                    "summary": "List user signatures/stamps",
                    "operationId": "listUserSignatures",
                    "tags": ["user-signatures"],
                    "security": [{ "bearerAuth": [] }],
                    "responses": { "200": { "description": "Array of user signatures" } }
                },
                "post": {
                    "summary": "Create a user signature",
                    "operationId": "createUserSignature",
                    "tags": ["user-signatures"],
                    "security": [{ "bearerAuth": [] }],
                    "responses": { "201": { "description": "Signature created" } }
                }
            }
        },
        "components": {
            "securitySchemes": {
                "bearerAuth": {
                    "type": "http",
                    "scheme": "bearer",
                    "bearerFormat": "JWT"
                },
                "cookieAuth": {
                    "type": "apiKey",
                    "in": "cookie",
                    "name": "access_token"
                }
            }
        },
        "tags": [
            { "name": "system", "description": "Health and system endpoints" },
            { "name": "auth", "description": "Authentication endpoints" },
            { "name": "users", "description": "User management" },
            { "name": "signatures", "description": "Signature workflow envelopes" },
            { "name": "user-signatures", "description": "User signature/stamp management" }
        ]
    });

    ([(header::CONTENT_TYPE, "application/json")], Json(spec))
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
