use axum::{http::StatusCode, response::IntoResponse, Extension, Json, extract::State};
use serde::{Deserialize, Serialize};
use signapps_common::Claims;
use uuid::Uuid;
use std::sync::Arc;
use tokio::sync::RwLock;
use crate::AppState;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EmailSignature {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub html_content: String,
    pub is_default: bool,
}

#[derive(Clone)]
pub struct SignatureStore {
    signatures: Arc<RwLock<Vec<EmailSignature>>>,
}

impl Default for SignatureStore {
    fn default() -> Self {
        Self::new()
    }
}

impl SignatureStore {
    pub fn new() -> Self {
        Self { signatures: Arc::new(RwLock::new(Vec::new())) }
    }
    async fn get_user_signature(&self, user_id: Uuid) -> Option<EmailSignature> {
        self.signatures.read().await.iter().find(|s| s.user_id == user_id).cloned()
    }
    async fn upsert_signature(&self, sig: EmailSignature) {
        let mut sigs = self.signatures.write().await;
        if let Some(pos) = sigs.iter().position(|s| s.user_id == sig.user_id) {
            sigs[pos] = sig;
        } else {
            sigs.push(sig);
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct UpdateSignatureRequest {
    pub name: Option<String>,
    pub html_content: Option<String>,
    pub is_default: Option<bool>,
}

pub async fn get_signature(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    match state.signatures.get_user_signature(claims.sub).await {
        Some(sig) => Json(sig).into_response(),
        None => (StatusCode::NOT_FOUND, "Signature not found").into_response(),
    }
}

pub async fn upsert_signature(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<UpdateSignatureRequest>,
) -> impl IntoResponse {
    let current = state.signatures.get_user_signature(claims.sub).await;
    let signature = EmailSignature {
        id: current.as_ref().map(|s| s.id).unwrap_or_else(Uuid::new_v4),
        user_id: claims.sub,
        name: payload.name.unwrap_or_else(|| "Default".to_string()),
        html_content: payload.html_content.unwrap_or_default(),
        is_default: payload.is_default.unwrap_or(true),
    };
    state.signatures.upsert_signature(signature.clone()).await;
    (StatusCode::OK, Json(signature)).into_response()
}
