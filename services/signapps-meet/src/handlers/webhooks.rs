//! LiveKit webhook receiver.
//!
//! LiveKit Server signs webhook deliveries with a JWT (HS256 using the
//! same `LIVEKIT_API_SECRET`) placed in the `Authorization: Bearer`
//! header. The body is JSON with a `sha256` claim matching the body
//! digest. For Phase 1 we do the signature check and log the event —
//! DB projections (updating `meet.room_participants`, `meet.recordings`)
//! are flagged as incremental follow-up.

use axum::{
    body::Bytes,
    extract::State,
    http::{HeaderMap, StatusCode},
};
use jsonwebtoken::{decode, DecodingKey, Validation};
use serde::Deserialize;

use crate::AppState;

#[derive(Debug, Deserialize)]
#[allow(dead_code)] // fields retained for future body-digest validation
struct WebhookClaims {
    #[serde(default)]
    sha256: Option<String>,
    #[serde(default)]
    video: Option<serde_json::Value>,
    #[serde(default)]
    exp: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct WebhookEvent {
    #[serde(default)]
    event: String,
    #[serde(default)]
    id: String,
    #[serde(default)]
    room: Option<serde_json::Value>,
    #[serde(default)]
    participant: Option<serde_json::Value>,
    #[serde(default, rename = "egressInfo")]
    egress_info: Option<serde_json::Value>,
}

/// Receive a LiveKit webhook.
///
/// Public endpoint (no app-level JWT). Verifies the LiveKit-issued JWT
/// against `LIVEKIT_API_SECRET`. Returns 401 on bad signature, 200 on
/// any recognized event (even if projection is skipped).
///
/// # Errors
///
/// Responds with `StatusCode::UNAUTHORIZED` if the Authorization header
/// is missing or the JWT is invalid, and `StatusCode::BAD_REQUEST` if
/// the body cannot be parsed as a webhook event.
#[tracing::instrument(skip(state, headers, body))]
pub async fn receive_webhook(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<StatusCode, (StatusCode, String)> {
    let auth = headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .ok_or((StatusCode::UNAUTHORIZED, "missing Authorization".into()))?;
    let token = auth.strip_prefix("Bearer ").unwrap_or(auth);

    let mut validation = Validation::new(jsonwebtoken::Algorithm::HS256);
    validation.required_spec_claims.clear();
    validation.validate_exp = false;
    let key = DecodingKey::from_secret(state.livekit.api_secret.as_bytes());
    let _claims: WebhookClaims = decode::<WebhookClaims>(token, &key, &validation)
        .map_err(|e| (StatusCode::UNAUTHORIZED, format!("invalid JWT: {e}")))?
        .claims;

    // Body parse — we don't yet project into Postgres, just log.
    match serde_json::from_slice::<WebhookEvent>(&body) {
        Ok(evt) => {
            tracing::info!(
                event = %evt.event,
                event_id = %evt.id,
                has_room = evt.room.is_some(),
                has_participant = evt.participant.is_some(),
                has_egress = evt.egress_info.is_some(),
                "livekit webhook received"
            );
        }
        Err(err) => {
            tracing::warn!(?err, raw_len = body.len(), "failed to parse livekit webhook");
            return Err((StatusCode::BAD_REQUEST, "invalid webhook body".into()));
        }
    }

    Ok(StatusCode::OK)
}

#[cfg(test)]
mod tests {
    #[test]
    fn module_compiles() {
        assert!(true, "{} loaded", module_path!());
    }
}
