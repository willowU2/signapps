use async_trait::async_trait;
use serde_json::json;
use signapps_common::traits::crawler::{CrawledDocument, DatabaseCrawler};
use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug)]
/// Represents a task crawler;.
pub struct TaskCrawler;

#[async_trait]
impl DatabaseCrawler for TaskCrawler {
    fn table_name(&self) -> &'static str {
        "scheduling.time_items"
    }

    async fn crawl_record(
        &self,
        pool: &PgPool,
        record_id: Uuid,
    ) -> Result<Option<CrawledDocument>> {
        let row: Option<(String, Option<String>, Uuid, Option<Uuid>)> = sqlx::query_as(
            "SELECT title, description, owner_id, project_id FROM scheduling.time_items WHERE id = $1",
        )
        .bind(record_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        if let Some((title, description, owner_id, project_id)) = row {
            let content = format!("Task: {}\n\n{}", title, description.unwrap_or_default());

            let security_tags = json!({
                "resource_type": "task",
                "owner_id": owner_id,
                "project_id": project_id
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
