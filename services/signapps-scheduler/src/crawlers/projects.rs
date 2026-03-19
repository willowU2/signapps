use async_trait::async_trait;
use serde_json::json;
use signapps_common::traits::crawler::{CrawledDocument, DatabaseCrawler};
use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug)]
pub struct ProjectCrawler;

#[async_trait]
impl DatabaseCrawler for ProjectCrawler {
    fn table_name(&self) -> &'static str {
        "calendar.projects"
    }

    async fn crawl_record(
        &self,
        pool: &PgPool,
        record_id: Uuid,
    ) -> Result<Option<CrawledDocument>> {
        let row: Option<(String, Option<String>, Uuid)> = sqlx::query_as(
            "SELECT name, description, owner_id FROM calendar.projects WHERE id = $1",
        )
        .bind(record_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        if let Some((name, description, owner_id)) = row {
            let content = format!(
                "Project: {}\n\n{}",
                name,
                description.unwrap_or_default()
            );

            let security_tags = json!({
                "resource_type": "project",
                "owner_id": owner_id
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
