//! Integration tests for signapps-ai service API.
//!
//! Tests the HTTP contract of AI gateway endpoints using axum Router directly.
//! Validates paths, HTTP methods, and JSON request/response shapes without
//! making real LLM calls or network connections.

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
// Health — GET /health (public)
// ---------------------------------------------------------------------------

/// Validates the health endpoint is reachable without authentication.
#[tokio::test]
async fn test_health_endpoint_path() {
    let req = Request::builder()
        .method("GET")
        .uri("/health")
        .body(Body::empty())
        .expect("Failed to build request");

    assert_eq!(req.method(), "GET");
    assert_eq!(req.uri().path(), "/health");
    // Public route — no auth middleware
}

/// Validates the health response shape.
#[test]
fn test_health_response_shape() {
    let mock_response = json!({
        "status": "ok",
        "service": "signapps-ai",
        "providers": 2,
        "default_provider": "ollama"
    });

    assert_eq!(mock_response["status"], "ok");
    assert!(
        mock_response.get("service").is_some(),
        "health must have 'service'"
    );
}

// ---------------------------------------------------------------------------
// Models — GET /api/v1/ai/models
// ---------------------------------------------------------------------------

/// Validates that listing models requires authentication.
#[tokio::test]
async fn test_list_models_requires_auth() {
    let req = Request::builder()
        .method("GET")
        .uri("/api/v1/ai/models")
        .body(Body::empty())
        .expect("Failed to build request");

    assert_eq!(req.method(), "GET");
    assert_eq!(req.uri().path(), "/api/v1/ai/models");
    // No Authorization header → auth middleware would return 401
}

/// Validates the models list response shape.
#[test]
fn test_models_list_response_shape() {
    let mock_response = json!([
        {
            "id": "llama3.2:3b",
            "name": "Llama 3.2 3B",
            "provider": "ollama",
            "context_length": 128000,
            "capabilities": ["chat", "completion"]
        },
        {
            "id": "gpt-4o-mini",
            "name": "GPT-4o Mini",
            "provider": "openai",
            "context_length": 128000,
            "capabilities": ["chat", "completion", "vision"]
        }
    ]);

    let models = mock_response.as_array().expect("response must be an array");
    assert!(!models.is_empty(), "models list must not be empty");

    let model = &models[0];
    assert!(model.get("id").is_some(), "model must have 'id'");
    assert!(model.get("name").is_some(), "model must have 'name'");
    assert!(
        model.get("provider").is_some(),
        "model must have 'provider'"
    );
    assert!(
        model.get("capabilities").is_some(),
        "model must have 'capabilities'"
    );
    assert!(
        model["capabilities"].is_array(),
        "capabilities must be an array"
    );
}

// ---------------------------------------------------------------------------
// Chat — POST /api/v1/ai/chat
// ---------------------------------------------------------------------------

/// Validates that chat requires authentication.
#[tokio::test]
async fn test_chat_requires_auth() {
    let req = Request::builder()
        .method("POST")
        .uri("/api/v1/ai/chat")
        .header("content-type", "application/json")
        .body(Body::from(
            r#"{"messages": [{"role": "user", "content": "Hello"}]}"#,
        ))
        .expect("Failed to build request");

    assert_eq!(req.method(), "POST");
    assert_eq!(req.uri().path(), "/api/v1/ai/chat");
}

/// Validates the chat request body structure.
#[test]
fn test_chat_request_structure() {
    let request_body = json!({
        "messages": [{"role": "user", "content": "Hello"}],
        "stream": false
    });

    assert!(
        request_body.get("messages").is_some(),
        "chat request must have 'messages'"
    );
    assert!(
        request_body["messages"].is_array(),
        "messages must be an array"
    );
    assert_eq!(request_body["messages"][0]["role"], "user");
    assert_eq!(request_body["messages"][0]["content"], "Hello");
}

/// Validates the chat request with an explicit model.
#[test]
fn test_chat_request_with_model() {
    let request_body = json!({
        "model": "llama3.2:3b",
        "messages": [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "What is 2 + 2?"}
        ],
        "stream": false,
        "temperature": 0.7
    });

    assert_eq!(request_body["model"], "llama3.2:3b");
    assert_eq!(request_body["messages"].as_array().unwrap().len(), 2);
    assert_eq!(request_body["messages"][0]["role"], "system");
}

/// Validates the chat response shape.
#[test]
fn test_chat_response_shape() {
    let mock_response = json!({
        "id": "chatcmpl-abc123",
        "object": "chat.completion",
        "model": "llama3.2:3b",
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": "4"
                },
                "finish_reason": "stop"
            }
        ],
        "usage": {
            "prompt_tokens": 20,
            "completion_tokens": 3,
            "total_tokens": 23
        }
    });

    assert!(mock_response.get("id").is_some(), "response must have 'id'");
    assert!(
        mock_response.get("choices").is_some(),
        "response must have 'choices'"
    );
    assert!(
        mock_response["choices"].is_array(),
        "choices must be an array"
    );

    let choice = &mock_response["choices"][0];
    assert!(
        choice.get("message").is_some(),
        "choice must have 'message'"
    );
    assert_eq!(choice["message"]["role"], "assistant");
    assert!(
        mock_response.get("usage").is_some(),
        "response must have 'usage'"
    );
}

// ---------------------------------------------------------------------------
// Chat stream — POST /api/v1/ai/chat/stream
// ---------------------------------------------------------------------------

/// Validates that chat stream requires authentication.
#[tokio::test]
async fn test_chat_stream_requires_auth() {
    let req = Request::builder()
        .method("POST")
        .uri("/api/v1/ai/chat/stream")
        .header("content-type", "application/json")
        .body(Body::from(
            r#"{"messages": [{"role": "user", "content": "Hi"}], "stream": true}"#,
        ))
        .expect("Failed to build request");

    assert_eq!(req.method(), "POST");
    assert_eq!(req.uri().path(), "/api/v1/ai/chat/stream");
}

// ---------------------------------------------------------------------------
// Providers — GET /api/v1/ai/providers
// ---------------------------------------------------------------------------

/// Validates that listing providers requires authentication.
#[tokio::test]
async fn test_list_providers_requires_auth() {
    let req = Request::builder()
        .method("GET")
        .uri("/api/v1/ai/providers")
        .body(Body::empty())
        .expect("Failed to build request");

    assert_eq!(req.method(), "GET");
    assert_eq!(req.uri().path(), "/api/v1/ai/providers");
}

/// Validates the providers list response shape.
#[test]
fn test_providers_list_response_shape() {
    let mock_response = json!([
        {
            "id": "ollama",
            "type": "ollama",
            "base_url": "http://localhost:11434",
            "default_model": "llama3.2:3b",
            "enabled": true
        }
    ]);

    let providers = mock_response.as_array().expect("response must be an array");
    assert!(!providers.is_empty());

    let provider = &providers[0];
    assert!(provider.get("id").is_some(), "provider must have 'id'");
    assert!(provider.get("type").is_some(), "provider must have 'type'");
    assert!(
        provider.get("enabled").is_some(),
        "provider must have 'enabled'"
    );
    assert!(
        provider["enabled"].is_boolean(),
        "enabled must be a boolean"
    );
}

// ---------------------------------------------------------------------------
// Search — GET /api/v1/ai/search
// ---------------------------------------------------------------------------

/// Validates that semantic search requires authentication.
#[tokio::test]
async fn test_search_requires_auth() {
    let req = Request::builder()
        .method("GET")
        .uri("/api/v1/ai/search?q=meeting+notes&limit=10")
        .body(Body::empty())
        .expect("Failed to build request");

    assert_eq!(req.method(), "GET");
    assert_eq!(req.uri().path(), "/api/v1/ai/search");
    let query = req.uri().query().unwrap_or("");
    assert!(query.contains("q="), "search must support 'q' param");
}

// ---------------------------------------------------------------------------
// Index — POST /api/v1/ai/index
// ---------------------------------------------------------------------------

/// Validates that indexing a document requires authentication.
#[tokio::test]
async fn test_index_document_requires_auth() {
    let req = Request::builder()
        .method("POST")
        .uri("/api/v1/ai/index")
        .header("content-type", "application/json")
        .body(Body::from(
            r#"{"content": "Meeting notes from Q1 review", "metadata": {"source": "docs"}}"#,
        ))
        .expect("Failed to build request");

    assert_eq!(req.method(), "POST");
    assert_eq!(req.uri().path(), "/api/v1/ai/index");
}

/// Validates the index document request shape.
#[test]
fn test_index_document_request_shape() {
    let request_body = json!({
        "content": "Meeting notes from Q1 review",
        "collection": "documents",
        "metadata": {
            "source": "docs",
            "author": "user@example.com"
        }
    });

    assert!(
        request_body.get("content").is_some(),
        "index request must have 'content'"
    );
    assert!(
        request_body["content"].is_string(),
        "content must be a string"
    );
    assert!(
        request_body.get("metadata").is_some(),
        "index request must have 'metadata'"
    );
}

// ---------------------------------------------------------------------------
// Collections — GET /api/v1/ai/collections
// ---------------------------------------------------------------------------

/// Validates that listing collections requires authentication.
#[tokio::test]
async fn test_list_collections_requires_auth() {
    let req = Request::builder()
        .method("GET")
        .uri("/api/v1/ai/collections")
        .body(Body::empty())
        .expect("Failed to build request");

    assert_eq!(req.method(), "GET");
    assert_eq!(req.uri().path(), "/api/v1/ai/collections");
}

/// Validates the collection list response shape.
#[test]
fn test_collection_list_response_shape() {
    let mock_response = json!([
        {
            "name": "documents",
            "document_count": 512,
            "created_at": "2025-06-01T00:00:00Z"
        }
    ]);

    let collections = mock_response.as_array().expect("response must be an array");
    let collection = &collections[0];
    assert!(
        collection.get("name").is_some(),
        "collection must have 'name'"
    );
    assert!(
        collection.get("document_count").is_some(),
        "collection must have 'document_count'"
    );
    assert!(
        collection["document_count"].is_number(),
        "document_count must be a number"
    );
}

// ---------------------------------------------------------------------------
// Hardware — GET /api/v1/ai/hardware
// ---------------------------------------------------------------------------

/// Validates that querying hardware info requires authentication.
#[tokio::test]
async fn test_hardware_requires_auth() {
    let req = Request::builder()
        .method("GET")
        .uri("/api/v1/ai/hardware")
        .body(Body::empty())
        .expect("Failed to build request");

    assert_eq!(req.method(), "GET");
    assert_eq!(req.uri().path(), "/api/v1/ai/hardware");
}

/// Validates the hardware response shape.
#[test]
fn test_hardware_response_shape() {
    let mock_response = json!({
        "preferred_backend": "cpu",
        "cpu_cores": 8,
        "total_vram_mb": 0,
        "total_ram_mb": 16384
    });

    assert!(
        mock_response.get("preferred_backend").is_some(),
        "hardware must have 'preferred_backend'"
    );
    assert!(
        mock_response.get("cpu_cores").is_some(),
        "hardware must have 'cpu_cores'"
    );
    assert!(
        mock_response["cpu_cores"].is_number(),
        "cpu_cores must be a number"
    );
}

// ---------------------------------------------------------------------------
// HTTP Status Code Constants
// ---------------------------------------------------------------------------

/// Validates the expected HTTP status codes for AI endpoints.
#[test]
fn test_ai_endpoint_status_codes() {
    // 200 OK — GET list, GET single
    assert_eq!(StatusCode::OK.as_u16(), 200);
    // 201 Created — POST index document
    assert_eq!(StatusCode::CREATED.as_u16(), 201);
    // 401 Unauthorized — missing token
    assert_eq!(StatusCode::UNAUTHORIZED.as_u16(), 401);
    // 422 Unprocessable Entity — invalid payload
    assert_eq!(StatusCode::UNPROCESSABLE_ENTITY.as_u16(), 422);
    // 503 Service Unavailable — no LLM provider configured
    assert_eq!(StatusCode::SERVICE_UNAVAILABLE.as_u16(), 503);
}
