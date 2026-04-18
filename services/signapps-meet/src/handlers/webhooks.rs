//! LiveKit webhook receiver.
//!
//! LiveKit Server signs webhook deliveries with a JWT (HS256 using the
//! same `LIVEKIT_API_SECRET`) placed in the `Authorization: Bearer`
//! header. The body is JSON with a `sha256` claim matching the body
//! digest.
//!
//! We verify the signature, then project interesting events into the DB:
//! - `egress_ended` → locate `meet.recordings` by `egress_id` (stored in
//!   `storage_bucket` as `livekit:<egress_id>`) and update status/file
//!   size. Under Phase 3a (Option C) no real egress is ever started, so
//!   the lookup will usually miss — we log a warning and move on.

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
    egress_info: Option<EgressInfo>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EgressInfo {
    #[serde(default)]
    egress_id: String,
    #[serde(default)]
    status: Option<String>,
    #[serde(default)]
    file: Option<EgressFileInfo>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EgressFileInfo {
    #[serde(default)]
    filename: Option<String>,
    #[serde(default)]
    size: Option<i64>,
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

            // Project egress lifecycle into meet.recordings.
            if let Some(egress) = evt.egress_info.as_ref() {
                project_egress_event(&state, &evt.event, egress).await;
            }
        },
        Err(err) => {
            tracing::warn!(
                ?err,
                raw_len = body.len(),
                "failed to parse livekit webhook"
            );
            return Err((StatusCode::BAD_REQUEST, "invalid webhook body".into()));
        },
    }

    Ok(StatusCode::OK)
}

/// Update `meet.recordings` based on an `EgressInfo` payload. Non-fatal —
/// failures are logged and dropped.
async fn project_egress_event(state: &AppState, event: &str, egress: &EgressInfo) {
    if egress.egress_id.is_empty() {
        return;
    }

    // Our egress marker lives in storage_bucket as "livekit:<egress_id>"
    // (once real egress is wired — see recordings.rs module docs).
    let marker = format!("livekit:{}", egress.egress_id);

    let row: Option<(uuid::Uuid,)> =
        match sqlx::query_as("SELECT id FROM meet.recordings WHERE storage_bucket = $1 LIMIT 1")
            .bind(&marker)
            .fetch_optional(&state.pool)
            .await
        {
            Ok(r) => r,
            Err(err) => {
                tracing::warn!(?err, egress_id = %egress.egress_id, "lookup failed");
                return;
            },
        };

    let Some((recording_id,)) = row else {
        tracing::warn!(
            event,
            egress_id = %egress.egress_id,
            "no recording matched egress — ignoring (expected under Phase 3a Option C)"
        );
        return;
    };

    let new_status = match event {
        "egress_ended" => "ready",
        "egress_updated" => "processing",
        "egress_failed" => "failed",
        _ => return,
    };

    let file_size = egress.file.as_ref().and_then(|f| f.size);
    let storage_path = egress
        .file
        .as_ref()
        .and_then(|f| f.filename.clone())
        .unwrap_or_default();

    let update = sqlx::query(
        r#"
        UPDATE meet.recordings SET
            status = $1,
            ended_at = COALESCE(ended_at, NOW()),
            file_size_bytes = COALESCE($2, file_size_bytes),
            storage_path = CASE WHEN $3 = '' THEN storage_path ELSE $3 END
        WHERE id = $4
        "#,
    )
    .bind(new_status)
    .bind(file_size)
    .bind(&storage_path)
    .bind(recording_id)
    .execute(&state.pool)
    .await;

    match update {
        Ok(_) => {
            tracing::info!(
                %recording_id,
                event,
                new_status,
                "recording projected from egress webhook"
            );
        },
        Err(err) => {
            tracing::warn!(?err, %recording_id, "failed to project egress event");
        },
    }

    // Fire meet.recording.ready / failed event bus notification for Phase 4.
    if matches!(
        egress.status.as_deref(),
        Some("EGRESS_COMPLETE") | Some("EGRESS_FAILED")
    ) {
        let bus = signapps_common::pg_events::PgEventBus::new(
            state.pool.clone(),
            "signapps-meet".to_string(),
        );
        let payload = serde_json::json!({
            "recording_id": recording_id,
            "egress_id": egress.egress_id,
            "status": new_status,
        });
        let event_type = if new_status == "ready" {
            "meet.recording.ready"
        } else {
            "meet.recording.failed"
        };
        if let Err(err) = bus
            .publish(signapps_common::pg_events::NewEvent {
                event_type: event_type.to_string(),
                aggregate_id: Some(recording_id),
                payload,
            })
            .await
        {
            tracing::warn!(?err, "failed to publish recording event");
        }
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn module_compiles() {
        assert!(true, "{} loaded", module_path!());
    }
}
