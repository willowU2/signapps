//! Chat handlers with RAG.

use axum::{
    extract::{State, Extension},
    response::sse::{Event, Sse},
    Json,
};
use futures_util::stream::Stream;
use serde::{Deserialize, Serialize};
use signapps_common::Result;
use std::convert::Infallible;
use std::time::Duration;
use uuid::Uuid;

use crate::AppState;

/// Chat request.
#[derive(Debug, Deserialize)]
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
}

fn default_include_sources() -> bool {
    true
}

/// Source reference.
#[derive(Debug, Serialize)]
pub struct SourceReference {
    pub document_id: Uuid,
    pub filename: String,
    pub score: f32,
    pub excerpt: String,
}

/// Chat response.
#[derive(Debug, Serialize)]
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
    /// Generation complete.
    #[serde(rename = "done")]
    Done,
    /// Error occurred.
    #[serde(rename = "error")]
    Error { message: String },
}

/// Chat with RAG (non-streaming).
#[tracing::instrument(skip(state, claims))]
pub async fn chat(
    State(state): State<AppState>,
    Extension(claims): Extension<signapps_common::auth::Claims>,
    Json(payload): Json<ChatRequest>,
) -> Result<Json<ChatResponse>> {
    let tags_filter = serde_json::json!({
        "organization_id": claims.org_id
    });

    let response = state
        .rag
        .query_with_provider(
            &payload.question,
            payload.provider.as_deref(),
            payload.model.as_deref(),
            payload.language.as_deref(),
            payload.system_prompt.as_deref(),
            payload.collection.as_deref(),
            Some(&tags_filter),
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

/// Chat with RAG (streaming via SSE).
#[tracing::instrument(skip(state, claims))]
pub async fn chat_stream(
    State(state): State<AppState>,
    Extension(claims): Extension<signapps_common::auth::Claims>,
    Json(payload): Json<ChatRequest>,
) -> Sse<impl Stream<Item = std::result::Result<Event, Infallible>>> {
    let tags_filter = serde_json::json!({
        "organization_id": claims.org_id
    });

    let model = payload.model.clone();
    let provider = payload.provider.clone();
    let language = payload.language.clone();
    let system_prompt = payload.system_prompt.clone();
    let collection = payload.collection.clone();
    let stream = async_stream::stream! {
        // First, retrieve sources
        match state.rag.query_stream_with_provider(&payload.question, provider.as_deref(), model.as_deref(), language.as_deref(), system_prompt.as_deref(), collection.as_deref(), Some(&tags_filter)).await {
            Ok((sources, mut token_rx)) => {
                // Send sources first
                if payload.include_sources {
                    let source_refs: Vec<SourceReference> = sources
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

                // Stream tokens
                while let Some(result) = token_rx.recv().await {
                    match result {
                        Ok(content) => {
                            let event = ChatEvent::Token { content };
                            if let Ok(json) = serde_json::to_string(&event) {
                                yield Ok(Event::default().data(json));
                            }
                        }
                        Err(e) => {
                            let event = ChatEvent::Error { message: e.to_string() };
                            if let Ok(json) = serde_json::to_string(&event) {
                                yield Ok(Event::default().data(json));
                            }
                            break;
                        }
                    }
                }

                // Send done event
                let event = ChatEvent::Done;
                if let Ok(json) = serde_json::to_string(&event) {
                    yield Ok(Event::default().data(json));
                }
            }
            Err(e) => {
                let event = ChatEvent::Error { message: e.to_string() };
                if let Ok(json) = serde_json::to_string(&event) {
                    yield Ok(Event::default().data(json));
                }
            }
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
