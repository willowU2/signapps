//! Documents seeder — `documents` table as document entities.

use signapps_db::{models::kg::UpsertEntity, repositories::KgRepository, DatabasePool};
use uuid::Uuid;

use super::helpers::{sanitize_attributes, SeedResult};

/// Seed documents as document entities.
///
/// Reads from the `documents` table.
///
/// # Errors
///
/// Returns `signapps_common::Error::Database` if the SQL query fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[tracing::instrument(skip(pool, embed_fn))]
pub(super) async fn seed_documents<E, EFut>(
    pool: &DatabasePool,
    collection: &str,
    embed_fn: E,
) -> signapps_common::Result<SeedResult>
where
    E: Fn(String) -> EFut + Clone,
    EFut: std::future::Future<Output = signapps_common::Result<Vec<f32>>>,
{
    #[derive(sqlx::FromRow)]
    struct DocumentRow {
        id: Uuid,
        name: String,
        doc_type: Option<String>,
    }

    let rows = match sqlx::query_as::<_, DocumentRow>(
        "SELECT id, name, doc_type FROM documents LIMIT 10000",
    )
    .fetch_all(pool.inner())
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::debug!(source = "documents", error = %e, "Table not available, skipping");
            return Ok(SeedResult {
                entities_created: 0,
                relations_created: 0,
                source: "documents".to_string(),
            });
        }
    };

    let mut count = 0usize;
    for row in &rows {
        let dtype = row.doc_type.as_deref().unwrap_or("document");
        let desc = format!("{} ({} document)", row.name, dtype);
        let embedding = embed_fn.clone()(desc.clone()).await?;

        KgRepository::upsert_entity(
            pool,
            collection,
            UpsertEntity {
                name: row.name.clone(),
                entity_type: "document".to_string(),
                description: Some(desc),
                source_document_id: None,
                attributes: Some(sanitize_attributes(serde_json::json!({
                    "document_id": row.id,
                    "doc_type": row.doc_type,
                }))),
            },
            &embedding,
        )
        .await?;
        count += 1;
    }

    tracing::info!(count = count, "Seeded documents");
    Ok(SeedResult {
        entities_created: count,
        relations_created: 0,
        source: "documents".to_string(),
    })
}
