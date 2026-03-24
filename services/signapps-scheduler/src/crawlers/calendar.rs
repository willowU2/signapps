use async_trait::async_trait;
use serde_json::json;
use signapps_common::traits::crawler::{CrawledDocument, DatabaseCrawler};
use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug)]
pub struct CalendarCrawler;

#[async_trait]
impl DatabaseCrawler for CalendarCrawler {
    fn table_name(&self) -> &'static str {
        "calendar_events"
    }

    async fn crawl_record(
        &self,
        pool: &PgPool,
        record_id: Uuid,
    ) -> Result<Option<CrawledDocument>> {
        let row: Option<(String, String, Option<String>, Option<Uuid>)> = sqlx::query_as(
            "SELECT title, description, location, organizer_id FROM calendar_events WHERE id = $1",
        )
        .bind(record_id)
        .fetch_optional(pool)
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
}
