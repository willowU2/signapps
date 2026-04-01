use axum::{
    extract::{Path, State},
    Json,
};
use serde_json::Value;
use signapps_common::Result;
use uuid::Uuid;

use crate::llm::types::ChatMessage;
use crate::AppState;

/// Webhook ingest response.
#[derive(Debug, serde::Serialize, utoipa::ToSchema)]
/// Response for Webhook.
pub struct WebhookResponse {
    pub document_id: Uuid,
    pub chunks_indexed: usize,
    pub message: String,
}

/// Ingest arbitrary JSON from external services.
#[utoipa::path(
    post,
    path = "/api/v1/ai/webhooks/{source_type}",
    params(
        ("source_type" = String, Path, description = "Source type identifier (e.g. odoo_ticket, github_issue)"),
    ),
    request_body(
        content_type = "application/json",
        description = "Arbitrary JSON payload from the source system",
        content = serde_json::Value,
    ),
    responses(
        (status = 200, description = "Payload indexed into AI memory", body = WebhookResponse),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearerAuth" = [])),
    tag = "webhooks"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn ingest_webhook(
    State(state): State<AppState>,
    Path(source_type): Path<String>,
    Json(payload): Json<Value>,
) -> Result<Json<WebhookResponse>> {
    tracing::info!("Received webhook ingestion from source: {}", source_type);

    // 1. OMNIPRESENT AI: Convert the arbitrary JSON into a human-readable narrative
    let json_str = serde_json::to_string_pretty(&payload).unwrap_or_default();

    let system_prompt = format!(
        "You are the SignApps Universal Memory Engine. Your job is to read raw JSON payloads from a \
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

    // Find the vLLM provider for ingestion to save tokens, fallback to default if none found
    let registry = state.providers;
    let vllm_id = registry
        .list_providers()
        .into_iter()
        .find(|(_, cfg)| cfg.provider_type == crate::llm::LlmProviderType::Vllm)
        .map(|(id, _)| id);

    let provider = match vllm_id {
        Some(id) => {
            tracing::info!(
                "Using local AI provider '{}' (vLLM) for RAG ingestion to save tokens",
                id
            );
            registry.get(id)?
        },
        None => {
            tracing::warn!("No vLLM provider found. Falling back to default (e.g., Claude Opus) for RAG ingestion.");
            registry.get_default()?
        },
    };

    // Call the AI Provider
    let ai_response = provider.chat(messages, None, Some(1024), Some(0.2)).await?;

    let narrative_text = ai_response
        .choices
        .first()
        .map(|c| c.message.content.clone())
        .unwrap_or_else(|| "Failed to generate context.".to_string());

    tracing::debug!("Generated narrative context for RAG: {}", narrative_text);

    // 2. Extract dynamic Access Control (RBAC) tags if present in the raw JSON
    // Common fields: user_id, organization_id, project_id, owner_id
    let mut security_tags = serde_json::Map::new();
    security_tags.insert(
        "source_type".to_string(),
        Value::String(source_type.clone()),
    );

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
        message: format!(
            "Successfully mapped JSON to Universal AI Memory ({} chunks)",
            chunks_indexed
        ),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_extract_security_tags() {
        // Simulate an incoming Odoo Ticket JSON payload
        let payload = json!({
            "ticket_id": 402,
            "title": "Server Crash",
            "organization_id": "org_abc123",
            "user_id": "usr_xyz890"
        });

        // Emulate the extraction logic in webhook.rs
        let mut security_tags = serde_json::Map::new();
        let source_type = "odoo_ticket".to_string();
        security_tags.insert(
            "source_type".to_string(),
            Value::String(source_type.clone()),
        );

        if let Some(org_id) = payload.get("organization_id").or(payload.get("org_id")) {
            security_tags.insert("organization_id".to_string(), org_id.clone());
        }
        if let Some(user_id) = payload.get("user_id").or(payload.get("owner_id")) {
            security_tags.insert("owner_id".to_string(), user_id.clone());
        }

        // Validate that crucial RBAC tags are captured for RAG filtering
        assert_eq!(
            security_tags
                .get("source_type")
                .expect("source_type tag must be present")
                .as_str()
                .expect("source_type must be a string"),
            "odoo_ticket"
        );
        assert_eq!(
            security_tags
                .get("organization_id")
                .expect("organization_id tag must be present")
                .as_str()
                .expect("organization_id must be a string"),
            "org_abc123"
        );
        assert_eq!(
            security_tags
                .get("owner_id")
                .expect("owner_id tag must be present")
                .as_str()
                .expect("owner_id must be a string"),
            "usr_xyz890"
        );
    }

    #[test]
    fn test_extract_security_tags_fallback_fields() {
        // Simulate a Github Webhook payload using different field names
        let payload = json!({
            "issue_id": 99,
            "title": "Bug in API",
            "org_id": "github_org_1",
            "owner_id": "dev_404"
        });

        let mut security_tags = serde_json::Map::new();
        let source_type = "github_issue".to_string();
        security_tags.insert(
            "source_type".to_string(),
            Value::String(source_type.clone()),
        );

        if let Some(org_id) = payload.get("organization_id").or(payload.get("org_id")) {
            security_tags.insert("organization_id".to_string(), org_id.clone());
        }
        if let Some(user_id) = payload.get("user_id").or(payload.get("owner_id")) {
            security_tags.insert("owner_id".to_string(), user_id.clone());
        }

        assert_eq!(
            security_tags
                .get("organization_id")
                .expect("organization_id tag must be present for fallback fields")
                .as_str()
                .expect("organization_id must be a string"),
            "github_org_1"
        );
        assert_eq!(
            security_tags
                .get("owner_id")
                .expect("owner_id tag must be present for fallback fields")
                .as_str()
                .expect("owner_id must be a string"),
            "dev_404"
        );
    }
}
