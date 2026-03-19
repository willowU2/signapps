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


}
