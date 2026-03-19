use async_trait::async_trait;
use serde_json::json;
use signapps_common::traits::crawler::{CrawledDocument, DatabaseCrawler};
use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug)]
pub struct DocsCrawler;

#[async_trait]
impl DatabaseCrawler for DocsCrawler {
    fn table_name(&self) -> &'static str {
        "documents"
    }



    async fn crawl_record(
        &self,
        pool: &PgPool,
        record_id: Uuid,
    ) -> Result<Option<CrawledDocument>> {
        let row: Option<(String, String, Option<Uuid>)> =
            sqlx::query_as("SELECT title, doc_type, created_by FROM documents WHERE id = $1")
                .bind(record_id)
                .fetch_optional(pool)
                .await
                .map_err(|e| Error::Database(e.to_string()))?;

        if let Some((title, doc_type, created_by)) = row {
            // Get the latest content from document_metadata if available
            let metadata: Option<(serde_json::Value,)> = sqlx::query_as(
                "SELECT value FROM document_metadata WHERE doc_id = $1 AND key = 'content' LIMIT 1",
            )
            .bind(record_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;

            let body = metadata
                .map(|(v,)| v.as_str().unwrap_or("").to_string())
                .unwrap_or_default();

            let content = format!("Document: {} (type: {})\n\n{}", title, doc_type, body);

            let security_tags = json!({
                "resource_type": "document",
                "doc_type": doc_type,
                "owner_id": created_by
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
