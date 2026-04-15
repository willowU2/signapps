//! Files seeder — `storage.files` as file entities.

use signapps_db::{models::kg::UpsertEntity, repositories::KgRepository, DatabasePool};
use uuid::Uuid;

use super::helpers::{sanitize_attributes, SeedResult};

/// Seed storage files as file entities.
///
/// Reads from `storage.files`.
///
/// # Errors
///
/// Returns `signapps_common::Error::Database` if the SQL query fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[tracing::instrument(skip(pool, embed_fn))]
pub(super) async fn seed_files<E, EFut>(
    pool: &DatabasePool,
    collection: &str,
    embed_fn: E,
) -> signapps_common::Result<SeedResult>
where
    E: Fn(String) -> EFut + Clone,
    EFut: std::future::Future<Output = signapps_common::Result<Vec<f32>>>,
{
    #[derive(sqlx::FromRow)]
    struct FileRow {
        id: Uuid,
        key: String,
        content_type: Option<String>,
        bucket: Option<String>,
    }

    let rows = match sqlx::query_as::<_, FileRow>(
        "SELECT id, key, content_type, bucket FROM storage.files LIMIT 10000",
    )
    .fetch_all(pool.inner())
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::debug!(source = "storage.files", error = %e, "Table not available, skipping");
            return Ok(SeedResult {
                entities_created: 0,
                relations_created: 0,
                source: "storage.files".to_string(),
            });
        },
    };

    let mut count = 0usize;
    for row in &rows {
        let content_type = row.content_type.as_deref().unwrap_or("unknown");
        let bucket = row.bucket.as_deref().unwrap_or("default");
        let desc = format!("File: {} ({}) in {}", row.key, content_type, bucket);
        let embedding = embed_fn.clone()(desc.clone()).await?;

        KgRepository::upsert_entity(
            pool,
            collection,
            UpsertEntity {
                name: row.key.clone(),
                entity_type: "file".to_string(),
                description: Some(desc),
                source_document_id: None,
                attributes: Some(sanitize_attributes(serde_json::json!({
                    "file_id": row.id,
                    "content_type": row.content_type,
                    "bucket": row.bucket,
                }))),
            },
            &embedding,
        )
        .await?;
        count += 1;
    }

    tracing::info!(count = count, "Seeded storage files");
    Ok(SeedResult {
        entities_created: count,
        relations_created: 0,
        source: "storage.files".to_string(),
    })
}
