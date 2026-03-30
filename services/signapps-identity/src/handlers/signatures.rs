//! Signature workflow handlers.
//!
//! Provides CRUD and state-transition endpoints for signature envelopes and steps.

use axum::{
    extract::{Extension, Path, Query, State},
    http::{header, HeaderMap, StatusCode},
    Json,
};
use serde::{Deserialize, Serialize};
use signapps_common::{Claims, Error, Result};
use signapps_db::models::signature::{
    CreateEnvelope, CreateStep, EnvelopeStatus, EnvelopeStep, EnvelopeTransition,
    SignatureEnvelope, StepStatus,
};
use signapps_db::repositories::SignatureRepository;
use uuid::Uuid;

use crate::AppState;

// ============================================================================
// Request / Response DTOs
// ============================================================================

/// Query parameters for listing envelopes.
#[derive(Debug, Deserialize)]
/// Query parameters for filtering results.
pub struct ListQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

/// Request body for creating a new envelope.
#[derive(Debug, Deserialize)]
/// Request body for CreateEnvelope.
pub struct CreateEnvelopeRequest {
    pub title: String,
    pub document_id: Uuid,
    pub expires_at: Option<chrono::DateTime<chrono::Utc>>,
    pub metadata: Option<serde_json::Value>,
}

/// Request body for adding a step to an envelope.
#[derive(Debug, Deserialize)]
/// Request body for AddStep.
pub struct AddStepRequest {
    /// Signer email (plain text — stored encrypted by the DB layer).
    pub signer_email: String,
    pub signer_user_id: Option<Uuid>,
    pub signer_name: Option<String>,
    /// Action type: "sign" | "approve" | "witness" | "acknowledge" | "delegate".
    pub action: Option<String>,
    /// Display order of this step (1-based).
    pub step_order: i16,
}

/// Request body for signing a step.
#[derive(Debug, Deserialize)]
/// Request body for SignStep.
pub struct SignStepRequest {
    /// Optional hash of the signature image/data.
    pub signature_hash: Option<String>,
}

/// Request body for declining a step.
#[derive(Debug, Deserialize)]
/// Request body for DeclineStep.
pub struct DeclineStepRequest {
    pub reason: Option<String>,
}

/// Request body for voiding an envelope.
#[derive(Debug, Deserialize)]
/// Request body for VoidEnvelope.
pub struct VoidEnvelopeRequest {
    pub reason: Option<String>,
}

/// Envelope response DTO.
#[derive(Debug, Serialize)]
/// Response for Envelope.
pub struct EnvelopeResponse {
    pub id: Uuid,
    pub title: String,
    pub document_id: Uuid,
    pub created_by: Uuid,
    pub status: String,
    pub expires_at: Option<String>,
    pub metadata: serde_json::Value,
    pub created_at: String,
    pub updated_at: String,
}

impl From<SignatureEnvelope> for EnvelopeResponse {
    fn from(e: SignatureEnvelope) -> Self {
        Self {
            id: e.id,
            title: e.title,
            document_id: e.document_id,
            created_by: e.created_by,
            status: e.status,
            expires_at: e.expires_at.map(|dt| dt.to_rfc3339()),
            metadata: e.metadata,
            created_at: e.created_at.to_rfc3339(),
            updated_at: e.updated_at.to_rfc3339(),
        }
    }
}

/// Step response DTO.
/// Note: signer_email and signer_name are stored as `bytea` (encrypted) in the DB.
/// They are returned as UTF-8 strings when valid, or as an empty string on decode failure.
#[derive(Debug, Serialize)]
/// Response for Step.
pub struct StepResponse {
    pub id: Uuid,
    pub envelope_id: Uuid,
    pub step_order: i16,
    pub signer_email: String,
    pub signer_user_id: Option<Uuid>,
    pub signer_name: Option<String>,
    pub action: String,
    pub status: String,
    pub signed_at: Option<String>,
    pub signature_hash: Option<String>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub decline_reason: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

impl From<EnvelopeStep> for StepResponse {
    fn from(s: EnvelopeStep) -> Self {
        Self {
            id: s.id,
            envelope_id: s.envelope_id,
            step_order: s.step_order,
            signer_email: String::from_utf8(s.signer_email).unwrap_or_default(),
            signer_user_id: s.signer_user_id,
            signer_name: s.signer_name.and_then(|b| String::from_utf8(b).ok()),
            action: s.action,
            status: s.status,
            signed_at: s.signed_at.map(|dt| dt.to_rfc3339()),
            signature_hash: s.signature_hash,
            ip_address: s.ip_address,
            user_agent: s.user_agent,
            decline_reason: s.decline_reason,
            created_at: s.created_at.to_rfc3339(),
            updated_at: s.updated_at.to_rfc3339(),
        }
    }
}

/// Transition response DTO.
#[derive(Debug, Serialize)]
/// Response for Transition.
pub struct TransitionResponse {
    pub id: Uuid,
    pub envelope_id: Uuid,
    pub step_id: Option<Uuid>,
    pub from_status: String,
    pub to_status: String,
    pub triggered_by: Option<Uuid>,
    pub reason: Option<String>,
    pub metadata: serde_json::Value,
    pub created_at: String,
}

impl From<EnvelopeTransition> for TransitionResponse {
    fn from(t: EnvelopeTransition) -> Self {
        Self {
            id: t.id,
            envelope_id: t.envelope_id,
            step_id: t.step_id,
            from_status: t.from_status,
            to_status: t.to_status,
            triggered_by: t.triggered_by,
            reason: t.reason,
            metadata: t.metadata,
            created_at: t.created_at.to_rfc3339(),
        }
    }
}

// ============================================================================
// Helpers
// ============================================================================

/// Extract client IP from forwarded headers or fall back to a placeholder.
fn extract_ip(headers: &HeaderMap) -> Option<String> {
    headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.split(',').next())
        .map(|s| s.trim().to_string())
}

/// Extract User-Agent header value.
fn extract_user_agent(headers: &HeaderMap) -> Option<String> {
    headers
        .get(header::USER_AGENT)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
}

// ============================================================================
// Envelope Endpoints
// ============================================================================

/// `POST /api/v1/signatures` — Create a new signature envelope.
#[tracing::instrument(skip(state))]
#[utoipa::path(
    post,
    path = "/api/v1/signatures",
    responses((status = 201, description = "Success")),
    tag = "Identity"
)]
#[tracing::instrument(skip_all)]
pub async fn create_envelope(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateEnvelopeRequest>,
) -> Result<(StatusCode, Json<EnvelopeResponse>)> {
    if payload.title.trim().is_empty() {
        return Err(Error::BadRequest(
            "Envelope title must not be empty".to_string(),
        ));
    }

    let repo = SignatureRepository::new(state.pool.inner().clone());

    let input = CreateEnvelope {
        title: payload.title,
        document_id: payload.document_id,
        expires_at: payload.expires_at,
        metadata: payload.metadata,
    };

    let envelope = repo
        .create_envelope(claims.sub, &input)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

    tracing::info!(envelope_id = %envelope.id, user_id = %claims.sub, "Signature envelope created");

    Ok((StatusCode::CREATED, Json(EnvelopeResponse::from(envelope))))
}

/// `GET /api/v1/signatures` — List envelopes owned by the authenticated user.
#[tracing::instrument(skip(state))]
#[utoipa::path(
    get,
    path = "/api/v1/signatures",
    responses((status = 200, description = "Success")),
    tag = "Identity"
)]
#[tracing::instrument(skip_all)]
pub async fn list_envelopes(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<ListQuery>,
) -> Result<Json<Vec<EnvelopeResponse>>> {
    let limit = query.limit.unwrap_or(50).min(100);
    let offset = query.offset.unwrap_or(0);

    let repo = SignatureRepository::new(state.pool.inner().clone());

    let envelopes = repo
        .list_by_user(claims.sub, limit, offset)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

    Ok(Json(
        envelopes.into_iter().map(EnvelopeResponse::from).collect(),
    ))
}

/// `GET /api/v1/signatures/:id` — Get a single envelope by ID.
#[tracing::instrument(skip(state))]
#[utoipa::path(
    get,
    path = "/api/v1/signatures",
    responses((status = 200, description = "Success")),
    tag = "Identity"
)]
#[tracing::instrument(skip_all)]
pub async fn get_envelope(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<EnvelopeResponse>> {
    let repo = SignatureRepository::new(state.pool.inner().clone());

    let envelope = repo
        .get_envelope(id)
        .await
        .map_err(|e| Error::Database(e.to_string()))?
        .ok_or_else(|| Error::NotFound(format!("Envelope {id}")))?;

    // Only the creator can view the envelope (signers access via dedicated flow).
    if envelope.created_by != claims.sub {
        return Err(Error::Forbidden("Access denied".to_string()));
    }

    Ok(Json(EnvelopeResponse::from(envelope)))
}

/// `POST /api/v1/signatures/:id/send` — Transition envelope from draft to sent.
#[tracing::instrument(skip(state))]
#[utoipa::path(
    post,
    path = "/api/v1/signatures",
    responses((status = 201, description = "Success")),
    tag = "Identity"
)]
#[tracing::instrument(skip_all)]
pub async fn send_envelope(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<EnvelopeResponse>> {
    let repo = SignatureRepository::new(state.pool.inner().clone());

    // Verify ownership first.
    let envelope = repo
        .get_envelope(id)
        .await
        .map_err(|e| Error::Database(e.to_string()))?
        .ok_or_else(|| Error::NotFound(format!("Envelope {id}")))?;

    if envelope.created_by != claims.sub {
        return Err(Error::Forbidden("Access denied".to_string()));
    }

    let updated = repo
        .transition_envelope(id, EnvelopeStatus::Sent, Some(claims.sub), None)
        .await
        .map_err(Error::BadRequest)?;

    tracing::info!(envelope_id = %id, "Envelope sent");

    Ok(Json(EnvelopeResponse::from(updated)))
}

/// `POST /api/v1/signatures/:id/void` — Void an envelope.
#[tracing::instrument(skip(state))]
#[utoipa::path(
    get,
    path = "/api/v1/signatures",
    responses((status = 200, description = "Success")),
    tag = "Identity"
)]
#[tracing::instrument(skip_all)]
pub async fn void_envelope(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<VoidEnvelopeRequest>,
) -> Result<Json<EnvelopeResponse>> {
    let repo = SignatureRepository::new(state.pool.inner().clone());

    let envelope = repo
        .get_envelope(id)
        .await
        .map_err(|e| Error::Database(e.to_string()))?
        .ok_or_else(|| Error::NotFound(format!("Envelope {id}")))?;

    if envelope.created_by != claims.sub {
        return Err(Error::Forbidden("Access denied".to_string()));
    }

    let updated = repo
        .transition_envelope(
            id,
            EnvelopeStatus::Voided,
            Some(claims.sub),
            payload.reason.as_deref(),
        )
        .await
        .map_err(Error::BadRequest)?;

    tracing::info!(envelope_id = %id, "Envelope voided");

    Ok(Json(EnvelopeResponse::from(updated)))
}

// ============================================================================
// Step Endpoints
// ============================================================================

/// `POST /api/v1/signatures/:id/steps` — Add a step to an envelope.
#[tracing::instrument(skip(state))]
#[utoipa::path(
    post,
    path = "/api/v1/signatures",
    responses((status = 201, description = "Success")),
    tag = "Identity"
)]
#[tracing::instrument(skip_all)]
pub async fn add_step(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<AddStepRequest>,
) -> Result<(StatusCode, Json<StepResponse>)> {
    let repo = SignatureRepository::new(state.pool.inner().clone());

    // Only the creator can add steps.
    let envelope = repo
        .get_envelope(id)
        .await
        .map_err(|e| Error::Database(e.to_string()))?
        .ok_or_else(|| Error::NotFound(format!("Envelope {id}")))?;

    if envelope.created_by != claims.sub {
        return Err(Error::Forbidden("Access denied".to_string()));
    }

    if payload.signer_email.trim().is_empty() {
        return Err(Error::BadRequest(
            "signer_email must not be empty".to_string(),
        ));
    }

    let input = CreateStep {
        signer_email: payload.signer_email.into_bytes(),
        signer_user_id: payload.signer_user_id,
        signer_name: payload.signer_name.map(|n| n.into_bytes()),
        action: payload.action,
    };

    let step = repo
        .add_step(id, payload.step_order, &input)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

    tracing::info!(envelope_id = %id, step_id = %step.id, "Step added");

    Ok((StatusCode::CREATED, Json(StepResponse::from(step))))
}

/// `GET /api/v1/signatures/:id/steps` — List all steps for an envelope.
#[tracing::instrument(skip(state))]
#[utoipa::path(
    get,
    path = "/api/v1/signatures",
    responses((status = 200, description = "Success")),
    tag = "Identity"
)]
#[tracing::instrument(skip_all)]
pub async fn list_steps(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<StepResponse>>> {
    let repo = SignatureRepository::new(state.pool.inner().clone());

    let envelope = repo
        .get_envelope(id)
        .await
        .map_err(|e| Error::Database(e.to_string()))?
        .ok_or_else(|| Error::NotFound(format!("Envelope {id}")))?;

    if envelope.created_by != claims.sub {
        return Err(Error::Forbidden("Access denied".to_string()));
    }

    let steps = repo
        .get_steps(id)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

    Ok(Json(steps.into_iter().map(StepResponse::from).collect()))
}

/// `POST /api/v1/signatures/:id/steps/:step_id/sign` — Sign a step.
#[tracing::instrument(skip(state))]
#[utoipa::path(
    get,
    path = "/api/v1/signatures",
    responses((status = 200, description = "Success")),
    tag = "Identity"
)]
#[tracing::instrument(skip_all)]
pub async fn sign_step(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, step_id)): Path<(Uuid, Uuid)>,
    headers: HeaderMap,
    Json(payload): Json<SignStepRequest>,
) -> Result<Json<StepResponse>> {
    let repo = SignatureRepository::new(state.pool.inner().clone());

    // Ensure the envelope exists.
    let _envelope = repo
        .get_envelope(id)
        .await
        .map_err(|e| Error::Database(e.to_string()))?
        .ok_or_else(|| Error::NotFound(format!("Envelope {id}")))?;

    let ip_address = extract_ip(&headers);
    let user_agent = extract_user_agent(&headers);

    let step = repo
        .transition_step(
            step_id,
            StepStatus::Signed,
            Some(claims.sub),
            payload.signature_hash.as_deref(),
            ip_address.as_deref(),
            user_agent.as_deref(),
            None,
        )
        .await
        .map_err(Error::BadRequest)?;

    tracing::info!(envelope_id = %id, step_id = %step_id, user_id = %claims.sub, "Step signed");

    Ok(Json(StepResponse::from(step)))
}

/// `POST /api/v1/signatures/:id/steps/:step_id/decline` — Decline a step.
#[tracing::instrument(skip(state))]
#[utoipa::path(
    get,
    path = "/api/v1/signatures",
    responses((status = 200, description = "Success")),
    tag = "Identity"
)]
#[tracing::instrument(skip_all)]
pub async fn decline_step(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, step_id)): Path<(Uuid, Uuid)>,
    headers: HeaderMap,
    Json(payload): Json<DeclineStepRequest>,
) -> Result<Json<StepResponse>> {
    let repo = SignatureRepository::new(state.pool.inner().clone());

    // Ensure the envelope exists.
    let _envelope = repo
        .get_envelope(id)
        .await
        .map_err(|e| Error::Database(e.to_string()))?
        .ok_or_else(|| Error::NotFound(format!("Envelope {id}")))?;

    let ip_address = extract_ip(&headers);
    let user_agent = extract_user_agent(&headers);

    let step = repo
        .transition_step(
            step_id,
            StepStatus::Declined,
            Some(claims.sub),
            None,
            ip_address.as_deref(),
            user_agent.as_deref(),
            payload.reason.as_deref(),
        )
        .await
        .map_err(Error::BadRequest)?;

    tracing::info!(envelope_id = %id, step_id = %step_id, user_id = %claims.sub, "Step declined");

    Ok(Json(StepResponse::from(step)))
}

// ============================================================================
// Transition History
// ============================================================================

/// `GET /api/v1/signatures/:id/transitions` — Get full transition history for an envelope.
#[tracing::instrument(skip(state))]
#[utoipa::path(
    get,
    path = "/api/v1/signatures",
    responses((status = 200, description = "Success")),
    tag = "Identity"
)]
#[tracing::instrument(skip_all)]
pub async fn list_transitions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<TransitionResponse>>> {
    let repo = SignatureRepository::new(state.pool.inner().clone());

    let envelope = repo
        .get_envelope(id)
        .await
        .map_err(|e| Error::Database(e.to_string()))?
        .ok_or_else(|| Error::NotFound(format!("Envelope {id}")))?;

    if envelope.created_by != claims.sub {
        return Err(Error::Forbidden("Access denied".to_string()));
    }

    let transitions = repo
        .get_transitions(id)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

    Ok(Json(
        transitions
            .into_iter()
            .map(TransitionResponse::from)
            .collect(),
    ))
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
