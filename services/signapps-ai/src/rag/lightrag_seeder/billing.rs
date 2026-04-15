//! Billing seeder — `billing.invoices` as invoice entities.

use signapps_db::{models::kg::UpsertEntity, repositories::KgRepository, DatabasePool};
use uuid::Uuid;

use super::helpers::{sanitize_attributes, SeedResult};

/// Seed billing invoices as invoice entities.
///
/// Reads from `billing.invoices`. Skips gracefully if table does not exist.
///
/// # Errors
///
/// Returns `signapps_common::Error::Database` if any SQL query fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[tracing::instrument(skip(pool, embed_fn))]
pub(super) async fn seed_invoices<E, EFut>(
    pool: &DatabasePool,
    collection: &str,
    embed_fn: E,
) -> signapps_common::Result<SeedResult>
where
    E: Fn(String) -> EFut + Clone,
    EFut: std::future::Future<Output = signapps_common::Result<Vec<f32>>>,
{
    #[derive(sqlx::FromRow)]
    struct InvoiceRow {
        id: Uuid,
        number: Option<String>,
        status: Option<String>,
        total_cents: Option<i64>,
        currency: Option<String>,
    }

    let rows = match sqlx::query_as::<_, InvoiceRow>(
        "SELECT id, number, status, total_cents, currency \
         FROM billing.invoices LIMIT 5000",
    )
    .fetch_all(pool.inner())
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::debug!(source = "billing.invoices", error = %e, "Table not available, skipping");
            return Ok(SeedResult {
                entities_created: 0,
                relations_created: 0,
                source: "billing.invoices".to_string(),
            });
        },
    };

    let mut count = 0usize;
    for row in &rows {
        let number = row.number.as_deref().unwrap_or("?");
        let status = row.status.as_deref().unwrap_or("unknown");
        let currency = row.currency.as_deref().unwrap_or("?");
        let amount = row.total_cents.unwrap_or(0);
        let amount_display = format!("{:.2}", amount as f64 / 100.0);
        let desc = format!(
            "Invoice #{} ({}, {} {})",
            number, status, amount_display, currency
        );
        let embedding = embed_fn.clone()(desc.clone()).await?;

        KgRepository::upsert_entity(
            pool,
            collection,
            UpsertEntity {
                name: format!("Invoice #{}", number),
                entity_type: "invoice".to_string(),
                description: Some(desc),
                source_document_id: None,
                attributes: Some(sanitize_attributes(serde_json::json!({
                    "invoice_id": row.id,
                    "number": row.number,
                    "status": row.status,
                    "total_cents": row.total_cents,
                    "currency": row.currency,
                }))),
            },
            &embedding,
        )
        .await?;
        count += 1;
    }

    tracing::info!(count = count, "Seeded invoices");
    Ok(SeedResult {
        entities_created: count,
        relations_created: 0,
        source: "billing.invoices".to_string(),
    })
}
