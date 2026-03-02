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

    /// Fetches records that need to be processed (e.g., from an ingestion queue or recent updated_at)
    async fn fetch_pending_records(&self, pool: &PgPool, limit: i64) -> Result<Vec<Uuid>>;

    /// Given a specific record ID, generate the string content for the AI and the security tags (RBAC context)
    async fn crawl_record(&self, pool: &PgPool, record_id: Uuid)
        -> Result<Option<CrawledDocument>>;

    /// Marks the document as successfully ingested
    async fn mark_as_processed(&self, pool: &PgPool, record_id: Uuid) -> Result<()>;
}
