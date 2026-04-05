//! CRM seeder — `crm.leads` as lead entities.

use signapps_db::{models::kg::UpsertEntity, repositories::KgRepository, DatabasePool};
use uuid::Uuid;

use super::helpers::{sanitize_attributes, SeedResult};

/// Seed CRM leads as lead entities.
///
/// Reads from `crm.leads`.
///
/// # Errors
///
/// Returns `signapps_common::Error::Database` if the SQL query fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[tracing::instrument(skip(pool, embed_fn))]
pub(super) async fn seed_crm<E, EFut>(
    pool: &DatabasePool,
    collection: &str,
    embed_fn: E,
) -> signapps_common::Result<SeedResult>
where
    E: Fn(String) -> EFut + Clone,
    EFut: std::future::Future<Output = signapps_common::Result<Vec<f32>>>,
{
    #[derive(sqlx::FromRow)]
    struct LeadRow {
        id: Uuid,
        name: String,
        company: Option<String>,
        status: Option<String>,
        email: Option<String>,
    }

    let rows = match sqlx::query_as::<_, LeadRow>(
        "SELECT id, name, company, status, email FROM crm.leads LIMIT 5000",
    )
    .fetch_all(pool.inner())
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::debug!(source = "crm.leads", error = %e, "Table not available, skipping");
            return Ok(SeedResult {
                entities_created: 0,
                relations_created: 0,
                source: "crm.leads".to_string(),
            });
        }
    };

    let mut count = 0usize;
    for row in &rows {
        let company = row.company.as_deref().unwrap_or("unknown company");
        let status = row.status.as_deref().unwrap_or("unknown");
        let desc = format!("{} at {} ({})", row.name, company, status);
        let embedding = embed_fn.clone()(desc.clone()).await?;

        KgRepository::upsert_entity(
            pool,
            collection,
            UpsertEntity {
                name: row.name.clone(),
                entity_type: "lead".to_string(),
                description: Some(desc),
                source_document_id: None,
                attributes: Some(sanitize_attributes(serde_json::json!({
                    "lead_id": row.id,
                    "company": row.company,
                    "status": row.status,
                    "email": row.email,
                }))),
            },
            &embedding,
        )
        .await?;
        count += 1;
    }

    tracing::info!(count = count, "Seeded CRM leads");
    Ok(SeedResult {
        entities_created: count,
        relations_created: 0,
        source: "crm.leads".to_string(),
    })
}
