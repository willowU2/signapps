use async_trait::async_trait;
use serde_json::json;
use signapps_common::traits::crawler::{CrawledDocument, DatabaseCrawler};
use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug)]
pub struct ChatCrawler;

#[async_trait]
impl DatabaseCrawler for ChatCrawler {
    fn table_name(&self) -> &'static str {
        "chat_messages"
    }

    async fn fetch_pending_records(&self, pool: &PgPool, limit: i64) -> Result<Vec<Uuid>> {
        let rows: Vec<(Uuid,)> = sqlx::query_as(
            r#"
            SELECT m.id
            FROM chat_messages m
            LEFT JOIN ai.ingestion_queue q
                ON m.id::text = q.record_id AND q.source_table = 'chat_messages'
            WHERE q.id IS NULL OR q.status = 'PENDING'
            LIMIT $1
            "#,
        )
        .bind(limit)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(rows.into_iter().map(|(id,)| id).collect())
    }

    async fn crawl_record(
        &self,
        pool: &PgPool,
        record_id: Uuid,
    ) -> Result<Option<CrawledDocument>> {
        let row: Option<(String, Uuid, Uuid)> = sqlx::query_as(
            "SELECT content, sender_id, channel_id FROM chat_messages WHERE id = $1",
        )
        .bind(record_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        if let Some((content, sender_id, channel_id)) = row {
            // Get channel name for context
            let channel_name: Option<(String,)> =
                sqlx::query_as("SELECT title FROM documents WHERE id = $1 AND doc_type = 'chat'")
                    .bind(channel_id)
                    .fetch_optional(pool)
                    .await
                    .map_err(|e| Error::Database(e.to_string()))?;

            let channel = channel_name
                .map(|(n,)| n)
                .unwrap_or_else(|| "unknown".to_string());

            let indexed_content = format!("Chat message in #{}\n\n{}", channel, content);

            let security_tags = json!({
                "resource_type": "chat_message",
                "sender_id": sender_id,
                "channel_id": channel_id
            });

            Ok(Some(CrawledDocument {
                source_table: self.table_name().to_string(),
                record_id,
                content: indexed_content,
                security_tags: Some(security_tags),
            }))
        } else {
            Ok(None)
        }
    }

    async fn mark_as_processed(&self, pool: &PgPool, record_id: Uuid) -> Result<()> {
        sqlx::query(
            r#"
            INSERT INTO ai.ingestion_queue (source_table, record_id, action, status, processed_at)
            VALUES ($1, $2, 'UPSERT', 'COMPLETED', NOW())
            ON CONFLICT (id) DO UPDATE SET status = 'COMPLETED', processed_at = NOW()
            "#,
        )
        .bind(self.table_name())
        .bind(record_id.to_string())
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(())
    }
}
