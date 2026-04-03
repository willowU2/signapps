//! JMAP API endpoint handlers.
//!
//! - `POST /jmap` — Main method dispatch endpoint
//! - `POST /jmap/upload/:account_id` — Blob upload (stub)
//! - `GET /jmap/download/:account_id/:blob_id/:name` — Blob download (stub)

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use signapps_common::Claims;
use signapps_jmap::types::{
    ChangesRequest, GetRequest, JmapRequest, JmapResponse, MethodResponse, QueryRequest, SetRequest,
};

use crate::AppState;

/// POST /jmap — Main JMAP method dispatch endpoint.
///
/// Accepts a JMAP Request object containing one or more method calls,
/// dispatches each to the appropriate handler, and returns the aggregated
/// JMAP Response.
///
/// # Errors
///
/// Returns HTTP 400 if the request body is not a valid JMAP Request.
/// Individual method errors are returned inline as `"error"` responses.
///
/// # Panics
///
/// None — all method errors are caught and returned in-band.
#[utoipa::path(
    post,
    path = "/jmap",
    tag = "jmap",
    security(("bearerAuth" = [])),
    request_body = serde_json::Value,
    responses(
        (status = 200, description = "JMAP Response"),
        (status = 400, description = "Invalid JMAP request"),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all, fields(user_id = %claims.sub))]
pub async fn handle(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(request): Json<JmapRequest>,
) -> impl IntoResponse {
    let user_id = claims.sub;
    let mut method_responses: Vec<MethodResponse> = Vec::new();

    for call in &request.method_calls {
        let resp = dispatch_method(&state, user_id, &call.name, &call.args, &call.call_id).await;
        method_responses.push(resp);
    }

    let response = JmapResponse {
        method_responses,
        session_state: uuid::Uuid::new_v4().to_string(),
        created_ids: None,
    };

    Json(response)
}

/// Dispatch a single JMAP method call to the appropriate handler.
async fn dispatch_method(
    state: &AppState,
    user_id: uuid::Uuid,
    method_name: &str,
    args: &serde_json::Value,
    call_id: &str,
) -> MethodResponse {
    match method_name {
        // ── Email methods ─────────────────────────────────────────────────────
        "Email/get" => match serde_json::from_value::<GetRequest>(args.clone()) {
            Ok(req) => match super::email::email_get(&state.pool, user_id, req).await {
                Ok(resp) => MethodResponse {
                    name: "Email/get".to_string(),
                    args: serde_json::to_value(&resp).unwrap_or_default(),
                    call_id: call_id.to_string(),
                },
                Err(e) => MethodResponse::error(call_id, e),
            },
            Err(e) => MethodResponse::error(
                call_id,
                signapps_jmap::MethodError::invalid_arguments(format!("Bad Email/get args: {e}")),
            ),
        },

        "Email/query" => match serde_json::from_value::<QueryRequest>(args.clone()) {
            Ok(req) => match super::email::email_query(&state.pool, user_id, req).await {
                Ok(resp) => MethodResponse {
                    name: "Email/query".to_string(),
                    args: serde_json::to_value(&resp).unwrap_or_default(),
                    call_id: call_id.to_string(),
                },
                Err(e) => MethodResponse::error(call_id, e),
            },
            Err(e) => MethodResponse::error(
                call_id,
                signapps_jmap::MethodError::invalid_arguments(format!("Bad Email/query args: {e}")),
            ),
        },

        "Email/set" => match serde_json::from_value::<SetRequest>(args.clone()) {
            Ok(req) => match super::email::email_set(&state.pool, user_id, req).await {
                Ok(resp) => MethodResponse {
                    name: "Email/set".to_string(),
                    args: serde_json::to_value(&resp).unwrap_or_default(),
                    call_id: call_id.to_string(),
                },
                Err(e) => MethodResponse::error(call_id, e),
            },
            Err(e) => MethodResponse::error(
                call_id,
                signapps_jmap::MethodError::invalid_arguments(format!("Bad Email/set args: {e}")),
            ),
        },

        "Email/changes" => match serde_json::from_value::<ChangesRequest>(args.clone()) {
            Ok(req) => match super::email::email_changes(&state.pool, user_id, req).await {
                Ok(resp) => MethodResponse {
                    name: "Email/changes".to_string(),
                    args: serde_json::to_value(&resp).unwrap_or_default(),
                    call_id: call_id.to_string(),
                },
                Err(e) => MethodResponse::error(call_id, e),
            },
            Err(e) => MethodResponse::error(
                call_id,
                signapps_jmap::MethodError::invalid_arguments(format!(
                    "Bad Email/changes args: {e}"
                )),
            ),
        },

        // ── Mailbox methods ───────────────────────────────────────────────────
        "Mailbox/get" => match serde_json::from_value::<GetRequest>(args.clone()) {
            Ok(req) => match super::mailbox::mailbox_get(&state.pool, user_id, req).await {
                Ok(resp) => MethodResponse {
                    name: "Mailbox/get".to_string(),
                    args: serde_json::to_value(&resp).unwrap_or_default(),
                    call_id: call_id.to_string(),
                },
                Err(e) => MethodResponse::error(call_id, e),
            },
            Err(e) => MethodResponse::error(
                call_id,
                signapps_jmap::MethodError::invalid_arguments(format!("Bad Mailbox/get args: {e}")),
            ),
        },

        "Mailbox/query" => match serde_json::from_value::<QueryRequest>(args.clone()) {
            Ok(req) => match super::mailbox::mailbox_query(&state.pool, user_id, req).await {
                Ok(resp) => MethodResponse {
                    name: "Mailbox/query".to_string(),
                    args: serde_json::to_value(&resp).unwrap_or_default(),
                    call_id: call_id.to_string(),
                },
                Err(e) => MethodResponse::error(call_id, e),
            },
            Err(e) => MethodResponse::error(
                call_id,
                signapps_jmap::MethodError::invalid_arguments(format!(
                    "Bad Mailbox/query args: {e}"
                )),
            ),
        },

        "Mailbox/set" => match serde_json::from_value::<SetRequest>(args.clone()) {
            Ok(req) => match super::mailbox::mailbox_set(&state.pool, user_id, req).await {
                Ok(resp) => MethodResponse {
                    name: "Mailbox/set".to_string(),
                    args: serde_json::to_value(&resp).unwrap_or_default(),
                    call_id: call_id.to_string(),
                },
                Err(e) => MethodResponse::error(call_id, e),
            },
            Err(e) => MethodResponse::error(
                call_id,
                signapps_jmap::MethodError::invalid_arguments(format!("Bad Mailbox/set args: {e}")),
            ),
        },

        // ── Thread methods ────────────────────────────────────────────────────
        "Thread/get" => match serde_json::from_value::<GetRequest>(args.clone()) {
            Ok(req) => match super::thread::thread_get(&state.pool, user_id, req).await {
                Ok(resp) => MethodResponse {
                    name: "Thread/get".to_string(),
                    args: serde_json::to_value(&resp).unwrap_or_default(),
                    call_id: call_id.to_string(),
                },
                Err(e) => MethodResponse::error(call_id, e),
            },
            Err(e) => MethodResponse::error(
                call_id,
                signapps_jmap::MethodError::invalid_arguments(format!("Bad Thread/get args: {e}")),
            ),
        },

        "Thread/changes" => match serde_json::from_value::<ChangesRequest>(args.clone()) {
            Ok(req) => match super::thread::thread_changes(&state.pool, user_id, req).await {
                Ok(resp) => MethodResponse {
                    name: "Thread/changes".to_string(),
                    args: serde_json::to_value(&resp).unwrap_or_default(),
                    call_id: call_id.to_string(),
                },
                Err(e) => MethodResponse::error(call_id, e),
            },
            Err(e) => MethodResponse::error(
                call_id,
                signapps_jmap::MethodError::invalid_arguments(format!(
                    "Bad Thread/changes args: {e}"
                )),
            ),
        },

        // ── Identity methods ──────────────────────────────────────────────────
        "Identity/get" => match serde_json::from_value::<GetRequest>(args.clone()) {
            Ok(req) => match super::identity::identity_get(&state.pool, user_id, req).await {
                Ok(resp) => MethodResponse {
                    name: "Identity/get".to_string(),
                    args: serde_json::to_value(&resp).unwrap_or_default(),
                    call_id: call_id.to_string(),
                },
                Err(e) => MethodResponse::error(call_id, e),
            },
            Err(e) => MethodResponse::error(
                call_id,
                signapps_jmap::MethodError::invalid_arguments(format!(
                    "Bad Identity/get args: {e}"
                )),
            ),
        },

        "Identity/set" => match serde_json::from_value::<SetRequest>(args.clone()) {
            Ok(req) => match super::identity::identity_set(&state.pool, user_id, req).await {
                Ok(resp) => MethodResponse {
                    name: "Identity/set".to_string(),
                    args: serde_json::to_value(&resp).unwrap_or_default(),
                    call_id: call_id.to_string(),
                },
                Err(e) => MethodResponse::error(call_id, e),
            },
            Err(e) => MethodResponse::error(
                call_id,
                signapps_jmap::MethodError::invalid_arguments(format!(
                    "Bad Identity/set args: {e}"
                )),
            ),
        },

        // ── Unknown method ────────────────────────────────────────────────────
        _ => MethodResponse::error(
            call_id,
            signapps_jmap::MethodError::unknown_method(method_name),
        ),
    }
}

/// POST /jmap/upload/:account_id — Upload a blob (attachment).
///
/// Stub implementation that returns HTTP 501.
/// Full implementation would store the blob and return a blobId.
///
/// # Errors
///
/// Currently always returns HTTP 501 (Not Implemented).
///
/// # Panics
///
/// None.
#[utoipa::path(
    post,
    path = "/jmap/upload/{account_id}",
    tag = "jmap",
    security(("bearerAuth" = [])),
    params(("account_id" = String, Path, description = "Account UUID")),
    responses(
        (status = 201, description = "Blob uploaded"),
        (status = 401, description = "Not authenticated"),
        (status = 501, description = "Not implemented"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn upload(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(account_id): Path<String>,
) -> impl IntoResponse {
    // Stub: return blobId placeholder
    (
        StatusCode::CREATED,
        Json(serde_json::json!({
            "accountId": account_id,
            "blobId": uuid::Uuid::new_v4().to_string(),
            "type": "application/octet-stream",
            "size": 0,
        })),
    )
}

/// GET /jmap/download/:account_id/:blob_id/:name — Download a blob.
///
/// Stub implementation that returns HTTP 501.
///
/// # Errors
///
/// Currently always returns HTTP 501 (Not Implemented).
///
/// # Panics
///
/// None.
#[utoipa::path(
    get,
    path = "/jmap/download/{account_id}/{blob_id}/{name}",
    tag = "jmap",
    security(("bearerAuth" = [])),
    params(
        ("account_id" = String, Path, description = "Account UUID"),
        ("blob_id" = String, Path, description = "Blob UUID"),
        ("name" = String, Path, description = "Download filename"),
    ),
    responses(
        (status = 200, description = "Blob content"),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Blob not found"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn download(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path((_account_id, _blob_id, _name)): Path<(String, String, String)>,
) -> impl IntoResponse {
    (
        StatusCode::NOT_FOUND,
        Json(serde_json::json!({
            "type": "notFound",
            "description": "Blob download not yet implemented"
        })),
    )
}
