use async_trait::async_trait;
use serde_json::Value;
use std::fmt::Debug;
use uuid::Uuid;

use crate::Result;
use sqlx::PgPool;

/// Represents a raw document ready to be split, embedded, and tagged
pub struct CrawledDocument {
    pub source_table: String,
    pub record_id: Uuid,
    pub content: String,
    pub security_tags: Option<Value>,
}

/// A trait for structures that can crawl a specific database table and extract text & security tags
#[async_trait]
pub trait DatabaseCrawler: Send + Sync + Debug {
    /// The name of the table this crawler is responsible for
    fn table_name(&self) -> &'static str;

    /// Fetches records that need to be processed
    async fn fetch_pending_records(&self, pool: &PgPool, limit: i64) -> Result<Vec<Uuid>> {
        let rows: Vec<(String,)> = sqlx::query_as(
            r#"
            SELECT record_id
            FROM ai.ingestion_queue
            WHERE source_table = $1 AND status = 'PENDING'
            LIMIT $2
            "#,
        )
        .bind(self.table_name())
        .bind(limit)
        .fetch_all(pool)
        .await
        .map_err(|e| crate::Error::Database(e.to_string()))?;

        let mut uuids = Vec::new();
        for (record_id,) in rows {
            if let Ok(id) = Uuid::parse_str(&record_id) {
                uuids.push(id);
            }
        }
        Ok(uuids)
    }

    /// Given a specific record ID, generate the string content for the AI and the security tags (RBAC context)
    async fn crawl_record(&self, pool: &PgPool, record_id: Uuid)
        -> Result<Option<CrawledDocument>>;

    /// Marks the document as successfully ingested
    async fn mark_as_processed(&self, pool: &PgPool, record_id: Uuid) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE ai.ingestion_queue 
            SET status = 'COMPLETED', processed_at = NOW() 
            WHERE source_table = $1 AND record_id = $2
            "#,
        )
        .bind(self.table_name())
        .bind(record_id.to_string())
        .execute(pool)
        .await
        .map_err(|e| crate::Error::Database(e.to_string()))?;

        Ok(())
    }
}
