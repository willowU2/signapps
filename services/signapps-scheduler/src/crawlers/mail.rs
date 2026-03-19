use async_trait::async_trait;
use serde_json::json;
use signapps_common::traits::crawler::{CrawledDocument, DatabaseCrawler};
use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug)]
pub struct MailCrawler;

#[async_trait]
impl DatabaseCrawler for MailCrawler {
    fn table_name(&self) -> &'static str {
        "mail.emails"
    }

    async fn fetch_pending_records(&self, pool: &PgPool, limit: i64) -> Result<Vec<Uuid>> {
        let rows: Vec<(Uuid,)> = sqlx::query_as(
            r#"
            SELECT e.id
            FROM mail.emails e
            LEFT JOIN ai.ingestion_queue q
                ON e.id::text = q.record_id AND q.source_table = 'mail.emails'
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
        let row: Option<(String, String, Option<String>, Option<String>, Uuid)> = sqlx::query_as(
            r#"
            SELECT subject, sender, body_text, body_html, account_id
            FROM mail.emails WHERE id = $1
            "#,
        )
        .bind(record_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        if let Some((subject, sender, body_text, body_html, account_id)) = row {
            // Prefer plain text, fall back to HTML stripped
            let body = body_text
                .filter(|t| !t.is_empty())
                .or(body_html)
                .unwrap_or_default();

            let content = format!("Email from: {}\nSubject: {}\n\n{}", sender, subject, body);

            // Get owner from account
            let owner: Option<(Uuid,)> =
                sqlx::query_as("SELECT user_id FROM mail.accounts WHERE id = $1")
                    .bind(account_id)
                    .fetch_optional(pool)
                    .await
                    .map_err(|e| Error::Database(e.to_string()))?;

            let security_tags = json!({
                "resource_type": "email",
                "owner_id": owner.map(|(id,)| id),
                "account_id": account_id
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
