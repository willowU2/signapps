//! Repository for AI conversation and message persistence.

use crate::models::conversation::{Conversation, ConversationMessage};
use signapps_db_shared::DatabasePool;
use signapps_common::{Error, Result};
use uuid::Uuid;

/// Repository for conversation CRUD operations.
pub struct ConversationRepository;

impl ConversationRepository {
    /// Create a new conversation for a user.
    pub async fn create(
        pool: &DatabasePool,
        user_id: Uuid,
        title: Option<&str>,
    ) -> Result<Conversation> {
        let row = sqlx::query_as::<_, ConversationRow>(
            r#"
            INSERT INTO ai.conversations (user_id, title)
            VALUES ($1, $2)
            RETURNING id, user_id, title, summary, created_at, updated_at
            "#,
        )
        .bind(user_id)
        .bind(title)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| Error::Internal(format!("Failed to create conversation: {}", e)))?;

        Ok(row.into())
    }

    /// Get a conversation by ID.
    pub async fn get(pool: &DatabasePool, id: Uuid) -> Result<Option<Conversation>> {
        let row = sqlx::query_as::<_, ConversationRow>(
            r#"
            SELECT id, user_id, title, summary, created_at, updated_at
            FROM ai.conversations
            WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| Error::Internal(format!("Failed to get conversation: {}", e)))?;

        Ok(row.map(Into::into))
    }

    /// List conversations for a user, ordered by most recently updated.
    pub async fn list_by_user(
        pool: &DatabasePool,
        user_id: Uuid,
        limit: i64,
    ) -> Result<Vec<Conversation>> {
        let rows = sqlx::query_as::<_, ConversationRow>(
            r#"
            SELECT id, user_id, title, summary, created_at, updated_at
            FROM ai.conversations
            WHERE user_id = $1
            ORDER BY updated_at DESC
            LIMIT $2
            "#,
        )
        .bind(user_id)
        .bind(limit)
        .fetch_all(pool.inner())
        .await
        .map_err(|e| Error::Internal(format!("Failed to list conversations: {}", e)))?;

        Ok(rows.into_iter().map(Into::into).collect())
    }

    /// Delete a conversation (cascades to messages).
    pub async fn delete(pool: &DatabasePool, id: Uuid) -> Result<()> {
        let result = sqlx::query("DELETE FROM ai.conversations WHERE id = $1")
            .bind(id)
            .execute(pool.inner())
            .await
            .map_err(|e| Error::Internal(format!("Failed to delete conversation: {}", e)))?;

        if result.rows_affected() == 0 {
            return Err(Error::NotFound(format!("Conversation '{}' not found", id)));
        }

        Ok(())
    }

    /// Add a message to a conversation and bump `updated_at`.
    pub async fn add_message(
        pool: &DatabasePool,
        conversation_id: Uuid,
        role: &str,
        content: &str,
        sources: &serde_json::Value,
        media: &serde_json::Value,
        model: Option<&str>,
        tokens_used: Option<i32>,
    ) -> Result<ConversationMessage> {
        // Bump conversation updated_at
        sqlx::query("UPDATE ai.conversations SET updated_at = NOW() WHERE id = $1")
            .bind(conversation_id)
            .execute(pool.inner())
            .await
            .map_err(|e| {
                Error::Internal(format!("Failed to update conversation timestamp: {}", e))
            })?;

        let row = sqlx::query_as::<_, ConversationMessageRow>(
            r#"
            INSERT INTO ai.conversation_messages
                (conversation_id, role, content, sources, media, model, tokens_used)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, conversation_id, role, content, sources, media,
                      model, tokens_used, created_at
            "#,
        )
        .bind(conversation_id)
        .bind(role)
        .bind(content)
        .bind(sources)
        .bind(media)
        .bind(model)
        .bind(tokens_used)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| Error::Internal(format!("Failed to add message: {}", e)))?;

        Ok(row.into())
    }

    /// Get messages for a conversation, ordered by creation time.
    pub async fn get_messages(
        pool: &DatabasePool,
        conversation_id: Uuid,
        limit: i64,
    ) -> Result<Vec<ConversationMessage>> {
        let rows = sqlx::query_as::<_, ConversationMessageRow>(
            r#"
            SELECT id, conversation_id, role, content, sources, media,
                   model, tokens_used, created_at
            FROM ai.conversation_messages
            WHERE conversation_id = $1
            ORDER BY created_at ASC
            LIMIT $2
            "#,
        )
        .bind(conversation_id)
        .bind(limit)
        .fetch_all(pool.inner())
        .await
        .map_err(|e| Error::Internal(format!("Failed to get messages: {}", e)))?;

        Ok(rows.into_iter().map(Into::into).collect())
    }

    /// Update the conversation summary (used for context compression).
    pub async fn update_summary(
        pool: &DatabasePool,
        conversation_id: Uuid,
        summary: &str,
    ) -> Result<()> {
        sqlx::query("UPDATE ai.conversations SET summary = $1, updated_at = NOW() WHERE id = $2")
            .bind(summary)
            .bind(conversation_id)
            .execute(pool.inner())
            .await
            .map_err(|e| Error::Internal(format!("Failed to update summary: {}", e)))?;

        Ok(())
    }
}

/// Internal row type for conversations.
#[derive(sqlx::FromRow)]
struct ConversationRow {
    id: Uuid,
    user_id: Uuid,
    title: Option<String>,
    summary: Option<String>,
    created_at: chrono::DateTime<chrono::Utc>,
    updated_at: chrono::DateTime<chrono::Utc>,
}

impl From<ConversationRow> for Conversation {
    fn from(r: ConversationRow) -> Self {
        Conversation {
            id: r.id,
            user_id: r.user_id,
            title: r.title,
            summary: r.summary,
            created_at: r.created_at,
            updated_at: r.updated_at,
        }
    }
}

/// Internal row type for conversation messages.
#[derive(sqlx::FromRow)]
struct ConversationMessageRow {
    id: Uuid,
    conversation_id: Uuid,
    role: String,
    content: String,
    sources: serde_json::Value,
    media: serde_json::Value,
    model: Option<String>,
    tokens_used: Option<i32>,
    created_at: chrono::DateTime<chrono::Utc>,
}

impl From<ConversationMessageRow> for ConversationMessage {
    fn from(r: ConversationMessageRow) -> Self {
        ConversationMessage {
            id: r.id,
            conversation_id: r.conversation_id,
            role: r.role,
            content: r.content,
            sources: r.sources,
            media: r.media,
            model: r.model,
            tokens_used: r.tokens_used,
            created_at: r.created_at,
        }
    }
}
