//! Chat handlers with RAG and tool calling.

use axum::{
    extract::State,
    http::HeaderMap,
    response::sse::{Event, Sse},
    Extension, Json,
};
use futures_util::stream::Stream;
use serde::{Deserialize, Serialize};
use signapps_common::{Claims, Result};
use std::convert::Infallible;
use std::time::Duration;
use uuid::Uuid;

use crate::tools::executor::ToolCallEvent;
use crate::AppState;

/// Chat request.
#[derive(Debug, Deserialize)]
/// Request body for Chat.
pub struct ChatRequest {
    /// User question.
    pub question: String,
    /// Optional model to use (overrides default).
    pub model: Option<String>,
    /// Optional provider to use (ollama, vllm, openai, anthropic).
    pub provider: Option<String>,
    /// Optional conversation ID for context (reserved for future use).
    #[allow(dead_code)]
    pub conversation_id: Option<Uuid>,
    /// Whether to include sources in response.
    #[serde(default = "default_include_sources")]
    pub include_sources: bool,
    /// Optional language for AI responses (e.g. "fr", "en", "es").
    pub language: Option<String>,
    /// Optional custom system prompt (overrides default).
    pub system_prompt: Option<String>,
    /// Filter by collection.
    pub collection: Option<String>,
    /// Whether to enable tool calling (default: true).
    #[serde(default = "default_enable_tools")]
    pub enable_tools: bool,
}

fn default_include_sources() -> bool {
    true
}

fn default_enable_tools() -> bool {
    true
}

/// Source reference.
#[derive(Debug, Serialize)]
/// SourceReference data transfer object.
pub struct SourceReference {
    pub document_id: Uuid,
    pub filename: String,
    pub score: f32,
    pub excerpt: String,
}

/// Chat response.
#[derive(Debug, Serialize)]
/// Response for Chat.
pub struct ChatResponse {
    pub answer: String,
    pub sources: Vec<SourceReference>,
    pub tokens_used: Option<i32>,
}

/// Streaming chat event.
#[derive(Debug, Serialize)]
#[serde(tag = "type")]
pub enum ChatEvent {
    /// Sources retrieved.
    #[serde(rename = "sources")]
    Sources { sources: Vec<SourceReference> },
    /// Token generated.
    #[serde(rename = "token")]
    Token { content: String },
    /// Tool call initiated.
    #[serde(rename = "tool_call")]
    ToolCall {
        tool: String,
        parameters: serde_json::Value,
    },
    /// Tool call result.
    #[serde(rename = "tool_result")]
    ToolResult {
        tool: String,
        success: bool,
        #[serde(skip_serializing_if = "Option::is_none")]
        result: Option<serde_json::Value>,
        #[serde(skip_serializing_if = "Option::is_none")]
        error: Option<String>,
    },
    /// Generation complete.
    #[serde(rename = "done")]
    Done,
    /// Error occurred.
    #[serde(rename = "error")]
    Error { message: String },
}

/// Extract raw JWT token from Authorization header.
fn extract_jwt(headers: &HeaderMap) -> Option<String> {
    headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.strip_prefix("Bearer "))
        .map(|s| s.to_string())
}

/// Chat with RAG (non-streaming).
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/chat",
    responses((status = 200, description = "Success")),
    tag = "Ai"
)]
#[tracing::instrument(skip_all)]
pub async fn chat(
    State(state): State<AppState>,
    Json(payload): Json<ChatRequest>,
) -> Result<Json<ChatResponse>> {
    let response = state
        .rag
        .query_with_provider(
            &payload.question,
            payload.provider.as_deref(),
            payload.model.as_deref(),
            payload.language.as_deref(),
            payload.system_prompt.as_deref(),
            payload
                .collection
                .as_ref()
                .map(|c| vec![c.clone()])
                .as_deref(),
            None,
        )
        .await?;

    let sources: Vec<SourceReference> = if payload.include_sources {
        response
            .sources
            .iter()
            .map(|s| SourceReference {
                document_id: s.document_id,
                filename: s.filename.clone(),
                score: s.score,
                excerpt: truncate_text(&s.content, 200),
            })
            .collect()
    } else {
        vec![]
    };

    Ok(Json(ChatResponse {
        answer: response.answer,
        sources,
        tokens_used: response.usage.map(|u| u.total_tokens),
    }))
}

/// Chat with RAG + tool calling (streaming via SSE).
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/chat",
    responses((status = 200, description = "Success")),
    tag = "Ai"
)]
#[tracing::instrument(skip_all)]
pub async fn chat_stream(
    State(state): State<AppState>,
    headers: HeaderMap,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<ChatRequest>,
) -> Sse<impl Stream<Item = std::result::Result<Event, Infallible>>> {
    let jwt = extract_jwt(&headers).unwrap_or_default();
    let role = claims.role;
    let model = payload.model.clone();
    let provider = payload.provider.clone();
    let language = payload.language.clone();
    let system_prompt = payload.system_prompt.clone();
    let collection = payload.collection.clone();
    let enable_tools = payload.enable_tools;

    let stream = async_stream::stream! {
        // 1. RAG search for sources
        let search_results = match state.rag.search(
            &payload.question,
            None,
            collection.as_ref().map(|c| vec![c.clone()]).as_deref(),
            None,
        ).await {
            Ok(results) => results,
            Err(e) => {
                tracing::warn!("RAG search failed: {}", e);
                vec![]
            }
        };

        // 2. Emit sources
        if payload.include_sources && !search_results.is_empty() {
            let source_refs: Vec<SourceReference> = search_results
                .iter()
                .map(|s| SourceReference {
                    document_id: s.document_id,
                    filename: s.filename.clone(),
                    score: s.score,
                    excerpt: truncate_text(&s.content, 200),
                })
                .collect();

            let event = ChatEvent::Sources { sources: source_refs };
            if let Ok(json) = serde_json::to_string(&event) {
                yield Ok(Event::default().data(json));
            }
        }

        // 3. Build messages with tool system prompt
        let messages = if enable_tools {
            state.rag.build_messages_with_tools(
                &search_results,
                &payload.question,
                language.as_deref(),
                system_prompt.as_deref(),
                &state.tool_executor,
                role,
            )
        } else {
            state.rag.build_messages_simple(
                &search_results,
                &payload.question,
                language.as_deref(),
                system_prompt.as_deref(),
            )
        };

        // 4. Tool calling loop (non-streaming for parsing)
        if enable_tools {
            match state.tool_executor.run_with_tools(
                &state.providers,
                messages,
                &jwt,
                role,
                provider.as_deref(),
                model.as_deref(),
            ).await {
                Ok((events, final_messages)) => {
                    // Emit tool events
                    for tool_event in &events {
                        let chat_event = match tool_event {
                            ToolCallEvent::ToolCall { tool, parameters } => {
                                ChatEvent::ToolCall {
                                    tool: tool.clone(),
                                    parameters: parameters.clone(),
                                }
                            }
                            ToolCallEvent::ToolResult {
                                tool,
                                success,
                                result,
                                error,
                            } => ChatEvent::ToolResult {
                                tool: tool.clone(),
                                success: *success,
                                result: result.clone(),
                                error: error.clone(),
                            },
                        };
                        if let Ok(json) = serde_json::to_string(&chat_event) {
                            yield Ok(Event::default().data(json));
                        }
                    }

                    // 5. Stream final answer
                    if !events.is_empty() {
                        // Tools were called — stream final answer from
                        // the completed conversation
                        let provider_ref = state.providers.resolve(
                            provider.as_deref()
                        );
                        match provider_ref {
                            Ok(p) => {
                                match p.chat_stream(
                                    final_messages,
                                    model.as_deref(),
                                    Some(2048),
                                    Some(0.7),
                                ).await {
                                    Ok(mut token_rx) => {
                                        while let Some(result) =
                                            token_rx.recv().await
                                        {
                                            match result {
                                                Ok(content) => {
                                                    let ev = ChatEvent::Token {
                                                        content,
                                                    };
                                                    if let Ok(json) =
                                                        serde_json::to_string(&ev)
                                                    {
                                                        yield Ok(
                                                            Event::default()
                                                                .data(json),
                                                        );
                                                    }
                                                }
                                                Err(e) => {
                                                    let ev = ChatEvent::Error {
                                                        message: e.to_string(),
                                                    };
                                                    if let Ok(json) =
                                                        serde_json::to_string(&ev)
                                                    {
                                                        yield Ok(
                                                            Event::default()
                                                                .data(json),
                                                        );
                                                    }
                                                    break;
                                                }
                                            }
                                        }
                                    }
                                    Err(e) => {
                                        let ev = ChatEvent::Error {
                                            message: e.to_string(),
                                        };
                                        if let Ok(json) =
                                            serde_json::to_string(&ev)
                                        {
                                            yield Ok(
                                                Event::default().data(json),
                                            );
                                        }
                                    }
                                }
                            }
                            Err(e) => {
                                let ev = ChatEvent::Error {
                                    message: e.to_string(),
                                };
                                if let Ok(json) =
                                    serde_json::to_string(&ev)
                                {
                                    yield Ok(
                                        Event::default().data(json),
                                    );
                                }
                            }
                        }
                    } else {
                        // No tools called — the last assistant message
                        // is already the answer, stream it directly
                        if let Some(last) = final_messages.last() {
                            let ev = ChatEvent::Token {
                                content: last.content.clone(),
                            };
                            if let Ok(json) = serde_json::to_string(&ev) {
                                yield Ok(Event::default().data(json));
                            }
                        }
                    }
                }
                Err(e) => {
                    let ev = ChatEvent::Error {
                        message: format!("Tool execution error: {}", e),
                    };
                    if let Ok(json) = serde_json::to_string(&ev) {
                        yield Ok(Event::default().data(json));
                    }
                }
            }
        } else {
            // No tools — standard RAG streaming
            let msgs = state.rag.build_messages_simple(
                &search_results,
                &payload.question,
                language.as_deref(),
                system_prompt.as_deref(),
            );

            let provider_ref = state.providers.resolve(
                provider.as_deref()
            );
            match provider_ref {
                Ok(p) => {
                    match p.chat_stream(
                        msgs,
                        model.as_deref(),
                        Some(1024),
                        Some(0.7),
                    ).await {
                        Ok(mut token_rx) => {
                            while let Some(result) = token_rx.recv().await {
                                match result {
                                    Ok(content) => {
                                        let ev = ChatEvent::Token { content };
                                        if let Ok(json) =
                                            serde_json::to_string(&ev)
                                        {
                                            yield Ok(
                                                Event::default().data(json),
                                            );
                                        }
                                    }
                                    Err(e) => {
                                        let ev = ChatEvent::Error {
                                            message: e.to_string(),
                                        };
                                        if let Ok(json) =
                                            serde_json::to_string(&ev)
                                        {
                                            yield Ok(
                                                Event::default().data(json),
                                            );
                                        }
                                        break;
                                    }
                                }
                            }
                        }
                        Err(e) => {
                            let ev = ChatEvent::Error {
                                message: e.to_string(),
                            };
                            if let Ok(json) = serde_json::to_string(&ev) {
                                yield Ok(Event::default().data(json));
                            }
                        }
                    }
                }
                Err(e) => {
                    let ev = ChatEvent::Error {
                        message: e.to_string(),
                    };
                    if let Ok(json) = serde_json::to_string(&ev) {
                        yield Ok(Event::default().data(json));
                    }
                }
            }
        }

        // 6. Done
        let event = ChatEvent::Done;
        if let Ok(json) = serde_json::to_string(&event) {
            yield Ok(Event::default().data(json));
        }
    };

    Sse::new(stream).keep_alive(
        axum::response::sse::KeepAlive::new()
            .interval(Duration::from_secs(15))
            .text("keep-alive"),
    )
}

/// Truncate text to a maximum length.
fn truncate_text(text: &str, max_len: usize) -> String {
    if text.len() <= max_len {
        text.to_string()
    } else {
        let truncated: String = text.chars().take(max_len).collect();
        format!("{}...", truncated.trim_end())
    }
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
