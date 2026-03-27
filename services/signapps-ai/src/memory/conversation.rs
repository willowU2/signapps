//! Conversation memory service wrapping the ConversationRepository.

use signapps_common::{Error, Result};
use signapps_db::models::conversation::{Conversation, ConversationMessage};
use signapps_db::repositories::ConversationRepository;
use signapps_db::DatabasePool;
use uuid::Uuid;

/// High-level conversation memory service.
pub struct ConversationMemory {
    pool: DatabasePool,
}

impl ConversationMemory {
    /// Create a new ConversationMemory backed by the given database pool.
    pub fn new(pool: DatabasePool) -> Self {
        Self { pool }
    }

    /// Get an existing conversation or create a new one.
    ///
    /// If `conv_id` is `Some`, fetches the conversation and verifies that
    /// `user_id` matches the owner. If `None`, creates a new conversation.
    pub async fn get_or_create(
        &self,
        conv_id: Option<Uuid>,
        user_id: Uuid,
    ) -> Result<Conversation> {
        match conv_id {
            Some(id) => {
                let conv = ConversationRepository::get(&self.pool, id)
                    .await?
                    .ok_or_else(|| Error::NotFound(format!("Conversation '{}' not found", id)))?;

                if conv.user_id != user_id {
                    return Err(Error::Forbidden(
                        "You do not have access to this conversation".to_string(),
                    ));
                }

                Ok(conv)
            },
            None => ConversationRepository::create(&self.pool, user_id, None).await,
        }
    }

    /// Add a message to a conversation.
    pub async fn add_message(
        &self,
        conv_id: Uuid,
        role: &str,
        content: &str,
        sources: &serde_json::Value,
        media: &serde_json::Value,
        model: Option<&str>,
        tokens_used: Option<i32>,
    ) -> Result<ConversationMessage> {
        ConversationRepository::add_message(
            &self.pool,
            conv_id,
            role,
            content,
            sources,
            media,
            model,
            tokens_used,
        )
        .await
    }

    /// Get the last N messages for a conversation (ordered by creation time).
    pub async fn get_context(
        &self,
        conv_id: Uuid,
        max_messages: usize,
    ) -> Result<Vec<ConversationMessage>> {
        ConversationRepository::get_messages(&self.pool, conv_id, max_messages as i64).await
    }

    /// List conversations for a user, most recently updated first.
    pub async fn list_conversations(&self, user_id: Uuid, limit: i64) -> Result<Vec<Conversation>> {
        ConversationRepository::list_by_user(&self.pool, user_id, limit).await
    }

    /// Delete a conversation and all its messages.
    pub async fn delete_conversation(&self, conv_id: Uuid) -> Result<()> {
        ConversationRepository::delete(&self.pool, conv_id).await
    }

    /// Update the conversation title.
    ///
    /// If the conversation has no title yet, auto-generates one from the first
    /// user message (truncated to 80 characters).
    pub async fn update_title(&self, conv_id: Uuid, title: &str) -> Result<()> {
        let truncated = if title.len() > 80 {
            format!("{}...", &title[..77])
        } else {
            title.to_string()
        };

        sqlx::query("UPDATE ai.conversations SET title = $1, updated_at = NOW() WHERE id = $2")
            .bind(&truncated)
            .bind(conv_id)
            .execute(self.pool.inner())
            .await
            .map_err(|e| Error::Internal(format!("Failed to update title: {}", e)))?;

        Ok(())
    }
}
