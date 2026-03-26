//! Context builder — converts conversation messages into LLM chat format.

use signapps_db::models::conversation::ConversationMessage;

use crate::llm::ChatMessage;

/// Utility for building LLM-ready context from conversation history.
pub struct ContextBuilder;

impl ContextBuilder {
    /// Convert conversation messages into [`ChatMessage`] format for the LLM.
    pub fn build_chat_history(messages: &[ConversationMessage]) -> Vec<ChatMessage> {
        messages
            .iter()
            .map(|m| match m.role.as_str() {
                "user" => ChatMessage::user(m.content.clone()),
                "assistant" => ChatMessage::assistant(m.content.clone()),
                "system" => ChatMessage::system(m.content.clone()),
                _ => ChatMessage::user(m.content.clone()),
            })
            .collect()
    }

    /// Estimate token count for a set of messages (rough: 4 chars per token).
    pub fn estimate_tokens(messages: &[ConversationMessage]) -> usize {
        messages.iter().map(|m| m.content.len() / 4).sum()
    }

    /// Truncate context to fit within a max token budget.
    ///
    /// Keeps the most recent messages that fit, discarding older ones first.
    pub fn truncate_to_budget(
        messages: Vec<ConversationMessage>,
        max_tokens: usize,
    ) -> Vec<ConversationMessage> {
        let mut result = Vec::new();
        let mut tokens = 0;

        for msg in messages.into_iter().rev() {
            let msg_tokens = msg.content.len() / 4;
            if tokens + msg_tokens > max_tokens {
                break;
            }
            tokens += msg_tokens;
            result.push(msg);
        }

        result.reverse();
        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use uuid::Uuid;

    fn make_msg(role: &str, content: &str) -> ConversationMessage {
        ConversationMessage {
            id: Uuid::new_v4(),
            conversation_id: Uuid::new_v4(),
            role: role.to_string(),
            content: content.to_string(),
            sources: serde_json::Value::Null,
            media: serde_json::Value::Null,
            model: None,
            tokens_used: None,
            created_at: Utc::now(),
        }
    }

    #[test]
    fn test_build_chat_history() {
        let messages = vec![
            make_msg("user", "Hello"),
            make_msg("assistant", "Hi there!"),
            make_msg("system", "You are helpful."),
        ];
        let chat = ContextBuilder::build_chat_history(&messages);
        assert_eq!(chat.len(), 3);
    }

    #[test]
    fn test_estimate_tokens() {
        // 20 chars -> 5 tokens
        let messages = vec![make_msg("user", "12345678901234567890")];
        assert_eq!(ContextBuilder::estimate_tokens(&messages), 5);
    }

    #[test]
    fn test_truncate_to_budget() {
        let messages = vec![
            make_msg("user", "a]".repeat(200).as_str()), // ~100 tokens
            make_msg("assistant", "b".repeat(200).as_str()), // ~50 tokens
            make_msg("user", "c".repeat(40).as_str()),   // ~10 tokens
        ];

        let truncated = ContextBuilder::truncate_to_budget(messages, 60);
        // Should keep the last two messages (50+10=60 tokens)
        assert_eq!(truncated.len(), 2);
    }
}
