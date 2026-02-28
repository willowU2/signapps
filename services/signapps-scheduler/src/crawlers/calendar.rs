use async_trait::async_trait;
use serde_json::json;
use signapps_common::traits::crawler::{CrawledDocument, DatabaseCrawler};
use signapps_common::{Error, Result};
use signapps_db::DatabasePool;
use uuid::Uuid;

#[derive(Debug)]
pub struct CalendarCrawler;

#[async_trait]
impl DatabaseCrawler for CalendarCrawler {
    fn table_name(&self) -> &'static str {
        "calendar_events"
    }

    async fn fetch_pending_records(&self, pool: &DatabasePool, limit: i64) -> Result<Vec<Uuid>> {
        // Find events that haven't been processed yet based on ai.ingestion_queue
        // For simplicity in this implementation, we just mock the fetch or do a basic left join
        
        let rows: Vec<(Uuid,)> = sqlx::query_as(
            r#"
            SELECT e.id 
            FROM calendar_events e 
            LEFT JOIN ai.ingestion_queue q ON e.id::text = q.record_id AND q.source_table = 'calendar_events'
            WHERE q.id IS NULL OR q.status = 'PENDING'
            LIMIT $1
            "#,
        )
        .bind(limit)
        .fetch_all(pool.inner())
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(rows.into_iter().map(|(id,)| id).collect())
    }

    async fn crawl_record(&self, pool: &DatabasePool, record_id: Uuid) -> Result<Option<CrawledDocument>> {
        let row: Option<(String, String, Option<String>, Option<Uuid>)> = sqlx::query_as(
            "SELECT title, description, location, organizer_id FROM calendar_events WHERE id = $1"
        )
        .bind(record_id)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        if let Some((title, description, location, organizer_id)) = row {
            // Build the string to embed
            let content = format!(
                "Event: {}\nLocation: {}\nDescription: {}", 
                title, 
                location.unwrap_or_else(|| "Unknown".to_string()), 
                description
            );

            // Access Control Rules: Here we could fetch the organization_id from the organizer_id
            let security_tags = json!({
                "resource_type": "calendar_event",
                "owner_id": organizer_id
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

    async fn mark_as_processed(&self, pool: &DatabasePool, record_id: Uuid) -> Result<()> {
        sqlx::query(
            r#"
            INSERT INTO ai.ingestion_queue (source_table, record_id, action, status, processed_at)
            VALUES ($1, $2, 'UPSERT', 'COMPLETED', NOW())
            ON CONFLICT (id) DO UPDATE SET status = 'COMPLETED', processed_at = NOW()
            "#
        )
        .bind(self.table_name())
        .bind(record_id.to_string())
        .execute(pool.inner())
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(())
    }
}
