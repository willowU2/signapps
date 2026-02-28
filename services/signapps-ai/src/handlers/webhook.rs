use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde_json::Value;
use signapps_common::Result;
use uuid::Uuid;

use crate::AppState;
use crate::llm::types::{ChatMessage, Role};

/// Webhook ingest response.
#[derive(Debug, serde::Serialize)]
pub struct WebhookResponse {
    pub document_id: Uuid,
    pub chunks_indexed: usize,
    pub message: String,
}

/// Ingest arbitrary JSON from external services.
#[tracing::instrument(skip(state, payload))]
pub async fn ingest_webhook(
    State(state): State<AppState>,
    Path(source_type): Path<String>,
    Json(payload): Json<Value>,
) -> Result<Json<WebhookResponse>> {
    tracing::info!("Received webhook ingestion from source: {}", source_type);

    // 1. OMNIPRESENT AI: Convert the arbitrary JSON into a human-readable narrative using Claude 4.6
    let json_str = serde_json::to_string_pretty(&payload).unwrap_or_default();
    
    let system_prompt = format!(
        "You are the SignApps Universal Memory Engine (Claude 4.6). Your job is to read raw JSON payloads from a \
        webhook (source: {}) and construct a highly descriptive, narrative full-text search summary of the event. \
        This summary will be embedded into a Vector Database for Retrieval-Augmented Generation (RAG). \
        Include all relevant text, names, IDs, statuses, and context so the AI can find it later when a user asks a question. \
        Output ONLY the raw text summary, no markdown, no conversational filler.",
        source_type
    );

    let messages = vec![
        ChatMessage::system(system_prompt),
        ChatMessage::user(format!("JSON Payload:\n{}", json_str)),
    ];

    // Call the AI Provider (Claude Opus default)
    let ai_response = state
        .rag
        .providers()
        .get_default()?
        .chat(messages, None, Some(1024), Some(0.2))
        .await?;

    let narrative_text = ai_response
        .choices
        .first()
        .map(|c| c.message.content.clone())
        .unwrap_or_else(|| "Failed to generate context.".to_string());

    tracing::debug!("Generated narrative context for RAG: {}", narrative_text);

    // 2. Extract dynamic Access Control (RBAC) tags if present in the raw JSON
    // Common fields: user_id, organization_id, project_id, owner_id
    let mut security_tags = serde_json::Map::new();
    security_tags.insert("source_type".to_string(), Value::String(source_type.clone()));
    
    if let Some(org_id) = payload.get("organization_id").or(payload.get("org_id")) {
        security_tags.insert("organization_id".to_string(), org_id.clone());
    }
    if let Some(user_id) = payload.get("user_id").or(payload.get("owner_id")) {
        security_tags.insert("owner_id".to_string(), user_id.clone());
    }

    // 3. OMNIPRESENT RAG: Store the intelligent narrative in the Unified Vector Database
    let document_id = Uuid::new_v4();
    let filename = format!("webhook-{}-{}", source_type, document_id);
    let path = format!("/webhook/{}/{}", source_type, document_id);

    let chunks_indexed = state
        .rag
        .index_document(
            document_id,
            &narrative_text,
            &filename,
            &path,
            Some("application/json"),
            Some(&source_type),
            Some(Value::Object(security_tags)),
        )
        .await?;

    Ok(Json(WebhookResponse {
        document_id,
        chunks_indexed,
        message: format!("Successfully mapped JSON to Universal AI Memory ({} chunks)", chunks_indexed),
    }))
}
