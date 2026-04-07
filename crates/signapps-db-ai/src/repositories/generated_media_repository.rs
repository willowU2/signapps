//! Repository for AI-generated media persistence.

use crate::models::generated_media::GeneratedMedia;
use signapps_db_shared::DatabasePool;
use signapps_common::{Error, Result};
use uuid::Uuid;

/// Repository for generated media CRUD operations.
pub struct GeneratedMediaRepository;

impl GeneratedMediaRepository {
    /// Create a new generated media record.
    #[allow(clippy::too_many_arguments)]
    pub async fn create(
        pool: &DatabasePool,
        media_type: &str,
        prompt: &str,
        model_used: &str,
        storage_path: &str,
        file_size_bytes: Option<i64>,
        metadata: Option<&serde_json::Value>,
        conversation_id: Option<Uuid>,
        user_id: Uuid,
    ) -> Result<GeneratedMedia> {
        let row = sqlx::query_as::<_, GeneratedMediaRow>(
            r#"
            INSERT INTO ai.generated_media
                (media_type, prompt, model_used, storage_path,
                 file_size_bytes, metadata, conversation_id, user_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, media_type, prompt, model_used, storage_path,
                      file_size_bytes, metadata, indexed, conversation_id,
                      user_id, created_at
            "#,
        )
        .bind(media_type)
        .bind(prompt)
        .bind(model_used)
        .bind(storage_path)
        .bind(file_size_bytes)
        .bind(metadata)
        .bind(conversation_id)
        .bind(user_id)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| Error::Internal(format!("Failed to create generated media: {}", e)))?;

        Ok(row.into())
    }

    /// Mark a generated media record as indexed in the vector store.
    pub async fn mark_indexed(pool: &DatabasePool, id: Uuid) -> Result<()> {
        sqlx::query("UPDATE ai.generated_media SET indexed = true WHERE id = $1")
            .bind(id)
            .execute(pool.inner())
            .await
            .map_err(|e| Error::Internal(format!("Failed to mark media as indexed: {}", e)))?;

        Ok(())
    }

    /// List generated media that have not yet been indexed.
    pub async fn list_unindexed(pool: &DatabasePool, limit: i64) -> Result<Vec<GeneratedMedia>> {
        let rows = sqlx::query_as::<_, GeneratedMediaRow>(
            r#"
            SELECT id, media_type, prompt, model_used, storage_path,
                   file_size_bytes, metadata, indexed, conversation_id,
                   user_id, created_at
            FROM ai.generated_media
            WHERE indexed = false
            ORDER BY created_at ASC
            LIMIT $1
            "#,
        )
        .bind(limit)
        .fetch_all(pool.inner())
        .await
        .map_err(|e| Error::Internal(format!("Failed to list unindexed media: {}", e)))?;

        Ok(rows.into_iter().map(Into::into).collect())
    }
}

/// Internal row type for generated media.
#[derive(sqlx::FromRow)]
struct GeneratedMediaRow {
    id: Uuid,
    media_type: String,
    prompt: String,
    model_used: String,
    storage_path: String,
    file_size_bytes: Option<i64>,
    metadata: Option<serde_json::Value>,
    indexed: bool,
    conversation_id: Option<Uuid>,
    user_id: Uuid,
    created_at: chrono::DateTime<chrono::Utc>,
}

impl From<GeneratedMediaRow> for GeneratedMedia {
    fn from(r: GeneratedMediaRow) -> Self {
        GeneratedMedia {
            id: r.id,
            media_type: r.media_type,
            prompt: r.prompt,
            model_used: r.model_used,
            storage_path: r.storage_path,
            file_size_bytes: r.file_size_bytes,
            metadata: r.metadata,
            indexed: r.indexed,
            conversation_id: r.conversation_id,
            user_id: r.user_id,
            created_at: r.created_at,
        }
    }
}
