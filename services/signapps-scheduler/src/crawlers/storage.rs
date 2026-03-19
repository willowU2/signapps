use async_trait::async_trait;
use serde_json::json;
use signapps_common::traits::crawler::{CrawledDocument, DatabaseCrawler};
use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug)]
pub struct StorageCrawler;

#[async_trait]
impl DatabaseCrawler for StorageCrawler {
    fn table_name(&self) -> &'static str {
        "drive.nodes"
    }



    async fn crawl_record(
        &self,
        pool: &PgPool,
        record_id: Uuid,
    ) -> Result<Option<CrawledDocument>> {
        let row: Option<(String, Option<String>, Option<i64>, Uuid, Option<String>)> =
            sqlx::query_as(
                r#"
                SELECT name, mime_type, size_bytes, owner_id, storage_path
                FROM drive.nodes WHERE id = $1
                "#,
            )
            .bind(record_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;

        if let Some((name, mime_type, size_bytes, owner_id, storage_path)) = row {
            // For the crawler, we index the metadata
            // Actual file content would need to be read from storage backend
            // which is handled by the real-time indexer in each service
            let content = format!(
                "File: {}\nType: {}\nSize: {} bytes\nPath: {}",
                name,
                mime_type.as_deref().unwrap_or("unknown"),
                size_bytes.unwrap_or(0),
                storage_path.as_deref().unwrap_or("/")
            );

            let security_tags = json!({
                "resource_type": "file",
                "owner_id": owner_id,
                "mime_type": mime_type
            });

            Ok(Some(CrawledDocument {
                source_table: self.table_name().to_string(),
                record_id,
                content,
                security_tags: Some(security_tags),
            }))
        } else {
            Ok(None)
        }
    }


}
