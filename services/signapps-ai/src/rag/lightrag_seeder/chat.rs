//! Chat seeder — `chat.channels` as channel entities.

use signapps_db::{models::kg::UpsertEntity, repositories::KgRepository, DatabasePool};
use uuid::Uuid;

use super::helpers::{sanitize_attributes, SeedResult};

/// Seed chat channels as channel entities.
///
/// Reads from `chat.channels`.
///
/// # Errors
///
/// Returns `signapps_common::Error::Database` if the SQL query fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[tracing::instrument(skip(pool, embed_fn))]
pub(super) async fn seed_chat_channels<E, EFut>(
    pool: &DatabasePool,
    collection: &str,
    embed_fn: E,
) -> signapps_common::Result<SeedResult>
where
    E: Fn(String) -> EFut + Clone,
    EFut: std::future::Future<Output = signapps_common::Result<Vec<f32>>>,
{
    #[derive(sqlx::FromRow)]
    struct ChannelRow {
        id: Uuid,
        name: String,
        topic: Option<String>,
    }

    let rows = match sqlx::query_as::<_, ChannelRow>(
        "SELECT id, name, topic FROM chat.channels LIMIT 5000",
    )
    .fetch_all(pool.inner())
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::debug!(source = "chat.channels", error = %e, "Table not available, skipping");
            return Ok(SeedResult {
                entities_created: 0,
                relations_created: 0,
                source: "chat.channels".to_string(),
            });
        },
    };

    let mut count = 0usize;
    for row in &rows {
        let topic = row.topic.as_deref().unwrap_or("(no topic)");
        let desc = format!("{}: {}", row.name, topic);
        let embedding = embed_fn.clone()(desc.clone()).await?;

        KgRepository::upsert_entity(
            pool,
            collection,
            UpsertEntity {
                name: row.name.clone(),
                entity_type: "channel".to_string(),
                description: Some(desc),
                source_document_id: None,
                attributes: Some(sanitize_attributes(serde_json::json!({
                    "channel_id": row.id,
                }))),
            },
            &embedding,
        )
        .await?;
        count += 1;
    }

    tracing::info!(count = count, "Seeded chat channels");
    Ok(SeedResult {
        entities_created: count,
        relations_created: 0,
        source: "chat.channels".to_string(),
    })
}
