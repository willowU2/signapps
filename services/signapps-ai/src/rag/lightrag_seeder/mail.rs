//! Mail seeder — `mail.accounts` as mail_account entities.

use signapps_db::{models::kg::UpsertEntity, repositories::KgRepository, DatabasePool};
use uuid::Uuid;

use super::helpers::{sanitize_attributes, SeedResult};

/// Seed mail accounts as mail_account entities.
///
/// Reads from `mail.accounts`. Email bodies are intentionally excluded for privacy.
///
/// # Errors
///
/// Returns `signapps_common::Error::Database` if the SQL query fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[tracing::instrument(skip(pool, embed_fn))]
pub(super) async fn seed_mail_accounts<E, EFut>(
    pool: &DatabasePool,
    collection: &str,
    embed_fn: E,
) -> signapps_common::Result<SeedResult>
where
    E: Fn(String) -> EFut + Clone,
    EFut: std::future::Future<Output = signapps_common::Result<Vec<f32>>>,
{
    #[derive(sqlx::FromRow)]
    struct MailAccountRow {
        id: Uuid,
        email_address: String,
        display_name: Option<String>,
    }

    let rows = match sqlx::query_as::<_, MailAccountRow>(
        "SELECT id, email_address, display_name FROM mail.accounts LIMIT 5000",
    )
    .fetch_all(pool.inner())
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::debug!(source = "mail.accounts", error = %e, "Table not available, skipping");
            return Ok(SeedResult {
                entities_created: 0,
                relations_created: 0,
                source: "mail.accounts".to_string(),
            });
        }
    };

    let mut count = 0usize;
    for row in &rows {
        let display = row.display_name.as_deref().unwrap_or(&row.email_address);
        let desc = format!("Mail account: {} ({})", display, row.email_address);
        let embedding = embed_fn.clone()(desc.clone()).await?;

        KgRepository::upsert_entity(
            pool,
            collection,
            UpsertEntity {
                name: display.to_string(),
                entity_type: "mail_account".to_string(),
                description: Some(desc),
                source_document_id: None,
                attributes: Some(sanitize_attributes(serde_json::json!({
                    "account_id": row.id,
                    "email_address": row.email_address,
                }))),
            },
            &embedding,
        )
        .await?;
        count += 1;
    }

    tracing::info!(count = count, "Seeded mail accounts");
    Ok(SeedResult {
        entities_created: count,
        relations_created: 0,
        source: "mail.accounts".to_string(),
    })
}
