use axum::{
    extract::{State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use signapps_common::{Error, Result};
use uuid::Uuid;

use crate::AppState;
use crate::llm::types::{ChatMessage, Role};

/// Request to execute a natural language action.
#[derive(Debug, Deserialize)]
pub struct ActionRequest {
    pub prompt: String,
    pub context_id: Option<String>,
}

/// Response from an executed action.
#[derive(Debug, Serialize)]
pub struct ActionResponse {
    pub success: bool,
    pub action_taken: String,
    pub result_message: String,
    pub confidence: f32,
}

/// Execute a natural language action using Claude Opus as an orchestrator.
#[tracing::instrument(skip(state))]
pub async fn execute_action(
    State(state): State<AppState>,
    Json(payload): Json<ActionRequest>,
) -> Result<Json<ActionResponse>> {
    tracing::info!("Received Action Request: {}", payload.prompt);

    // 1. System Prompt for the Action Orchestrator (Claude)
    let system_prompt = 
        "You are the SignApps Autopilot Orchestrator. The user will ask you to perform actions on their infrastructure. \
        Your job is to translate their natural language into specific JSON tool commands. \
        Currently, you have the following capabilities:
        - `restart_container`: takes `container_name` or `container_id`
        - `send_chat`: takes `channel` and `message`
        
        If the intent is clear, output ONLY a JSON object with this exact structure, nothing else:
        { \"intent\": \"restart_container\", \"target\": \"web-ui\", \"confidence\": 0.95 }
        
        If you are unsure or the action is not supported, return:
        { \"intent\": \"unknown\", \"target\": \"\", \"confidence\": 0.0 }";

    let messages = vec![
        ChatMessage::system(system_prompt.to_string()),
        ChatMessage::user(payload.prompt.clone()),
    ];

    // Call Claude Opus (default provider) to parse intent
    let ai_response = state
        .rag
        .providers()
        .get_default()?
        .chat(messages, None, Some(512), Some(0.1))
        .await?;

    let response_text = ai_response
        .choices
        .first()
        .map(|c| c.message.content.clone())
        .unwrap_or_else(|| "{}".to_string());

    tracing::debug!("Claude parsed intent: {}", response_text);

    // Parse the JSON intent from Claude
    let parsed_intent: Value = serde_json::from_str(&response_text)
        .map_err(|_| Error::Validation("Failed to parse AI intent".into()))?;

    let intent = parsed_intent.get("intent").and_then(|v| v.as_str()).unwrap_or("unknown");
    let target = parsed_intent.get("target").and_then(|v| v.as_str()).unwrap_or("");
    let confidence = parsed_intent.get("confidence").and_then(|v| v.as_f64()).unwrap_or(0.0) as f32;

    if confidence < 0.8 {
        return Ok(Json(ActionResponse {
            success: false,
            action_taken: "none".into(),
            result_message: "I am not confident enough to execute this action. Please be more specific.".into(),
            confidence,
        }));
    }

    // 2. Execute the mapped action
    // In a real implementation this would make an RPC or direct DB/Docker call
    // For Phase 3, we mock the success path to prove the routing logic
    match intent {
        "restart_container" => {
            tracing::info!("Executing simulated container restart for: {}", target);
            Ok(Json(ActionResponse {
                success: true,
                action_taken: "restart_container".into(),
                result_message: format!("Successfully restarted container: {}", target),
                confidence,
            }))
        },
        "send_chat" => {
            tracing::info!("Executing simulated chat message to: {}", target);
            Ok(Json(ActionResponse {
                success: true,
                action_taken: "send_chat".into(),
                result_message: format!("Message sent successfully to {}", target),
                confidence,
            }))
        },
        _ => {
            Ok(Json(ActionResponse {
                success: false,
                action_taken: "none".into(),
                result_message: "Sorry, I am not equipped to handle that action yet.".into(),
                confidence,
            }))
        }
    }
}
