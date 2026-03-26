//! Auto-summarizer — compresses long conversations into a summary.
#![allow(dead_code)]

use std::sync::Arc;

use signapps_common::Result;
use signapps_db::repositories::ConversationRepository;
use signapps_db::DatabasePool;
use uuid::Uuid;

use crate::llm::{ChatMessage, ProviderRegistry};

use super::context_builder::ContextBuilder;

/// Automatically summarizes conversations when they exceed a message threshold.
pub struct ConversationSummarizer {
    pool: DatabasePool,
    providers: Arc<ProviderRegistry>,
    /// Number of messages that triggers summarization.
    threshold: usize,
}

impl ConversationSummarizer {
    /// Create a new summarizer.
    ///
    /// `threshold` is the message count after which summarization is triggered
    /// (default recommendation: 20).
    pub fn new(pool: DatabasePool, providers: Arc<ProviderRegistry>, threshold: usize) -> Self {
        Self {
            pool,
            providers,
            threshold,
        }
    }

    /// Summarize the conversation if it exceeds the message threshold.
    ///
    /// Returns `Some(summary)` if summarization was performed, `None` otherwise.
    pub async fn summarize_if_needed(&self, conv_id: Uuid) -> Result<Option<String>> {
        // Fetch all messages (use a high limit to get everything)
        let messages = ConversationRepository::get_messages(&self.pool, conv_id, i64::MAX).await?;

        if messages.len() < self.threshold {
            return Ok(None);
        }

        // Build conversation text for the summarization prompt
        let conversation_text: String = messages
            .iter()
            .map(|m| format!("{}: {}", m.role, m.content))
            .collect::<Vec<_>>()
            .join("\n");

        // Truncate conversation text if it's extremely long (keep ~12k chars for safety)
        let truncated_text = if conversation_text.len() > 12_000 {
            format!("{}...", &conversation_text[..12_000])
        } else {
            conversation_text
        };

        let prompt = format!(
            "Summarize the following conversation in 2-3 concise sentences. \
             Focus on the key topics, decisions, and outcomes.\n\n\
             Conversation:\n{}\n\nSummary:",
            truncated_text
        );

        let chat_messages = vec![
            ChatMessage::system(
                "You are a concise summarizer. Respond only with the summary, nothing else."
                    .to_string(),
            ),
            ChatMessage::user(prompt),
        ];

        // Call the default LLM provider
        let provider = self.providers.get_default()?;
        let response = provider
            .chat(chat_messages, None, Some(256), Some(0.3))
            .await?;

        let summary = response
            .choices
            .first()
            .map(|c| c.message.content.trim().to_string())
            .unwrap_or_default();

        if !summary.is_empty() {
            ConversationRepository::update_summary(&self.pool, conv_id, &summary).await?;
            tracing::info!(
                conversation_id = %conv_id,
                message_count = messages.len(),
                "Conversation summarized"
            );
        }

        // Also estimate and log token savings
        let original_tokens = ContextBuilder::estimate_tokens(&messages);
        let summary_tokens = summary.len() / 4;
        tracing::debug!(
            conversation_id = %conv_id,
            original_tokens,
            summary_tokens,
            "Context compression ratio: {:.1}x",
            original_tokens as f64 / summary_tokens.max(1) as f64
        );

        Ok(Some(summary))
    }
}
