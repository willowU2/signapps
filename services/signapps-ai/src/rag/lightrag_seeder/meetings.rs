//! Meetings seeder — `meet.rooms` as meeting entities.

use signapps_db::{models::kg::UpsertEntity, repositories::KgRepository, DatabasePool};
use uuid::Uuid;

use super::helpers::{sanitize_attributes, SeedResult};

/// Seed meeting rooms as meeting entities.
///
/// Reads from `meet.rooms`.
///
/// # Errors
///
/// Returns `signapps_common::Error::Database` if the SQL query fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[tracing::instrument(skip(pool, embed_fn))]
pub(super) async fn seed_meetings<E, EFut>(
    pool: &DatabasePool,
    collection: &str,
    embed_fn: E,
) -> signapps_common::Result<SeedResult>
where
    E: Fn(String) -> EFut + Clone,
    EFut: std::future::Future<Output = signapps_common::Result<Vec<f32>>>,
{
    #[derive(sqlx::FromRow)]
    struct MeetingRow {
        id: Uuid,
        name: String,
        description: Option<String>,
        created_by: Option<Uuid>,
    }

    let rows = match sqlx::query_as::<_, MeetingRow>(
        "SELECT id, name, description, created_by FROM meet.rooms LIMIT 5000",
    )
    .fetch_all(pool.inner())
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::debug!(source = "meet.rooms", error = %e, "Table not available, skipping");
            return Ok(SeedResult {
                entities_created: 0,
                relations_created: 0,
                source: "meet.rooms".to_string(),
            });
        },
    };

    let mut count = 0usize;
    for row in &rows {
        let description = row.description.as_deref().unwrap_or("(no description)");
        let desc = format!("{}: {}", row.name, description);
        let embedding = embed_fn.clone()(desc.clone()).await?;

        KgRepository::upsert_entity(
            pool,
            collection,
            UpsertEntity {
                name: row.name.clone(),
                entity_type: "meeting".to_string(),
                description: Some(desc),
                source_document_id: None,
                attributes: Some(sanitize_attributes(serde_json::json!({
                    "room_id": row.id,
                    "created_by": row.created_by,
                }))),
            },
            &embedding,
        )
        .await?;
        count += 1;
    }

    tracing::info!(count = count, "Seeded meetings");
    Ok(SeedResult {
        entities_created: count,
        relations_created: 0,
        source: "meet.rooms".to_string(),
    })
}
