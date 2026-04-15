//! Calendar seeder — `calendar.events` as event entities.

use signapps_db::{
    models::kg::{CreateRelation, UpsertEntity},
    repositories::KgRepository,
    DatabasePool,
};
use uuid::Uuid;

use super::helpers::{sanitize_attributes, SeedResult};

/// Seed calendar events as event entities.
///
/// Reads from `calendar.events` and upserts each event with an `organized_by`
/// relation to the creator user when found in the KG.
///
/// # Errors
///
/// Returns `signapps_common::Error::Database` if any SQL query fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[tracing::instrument(skip(pool, embed_fn))]
pub(super) async fn seed_calendar_events<E, EFut>(
    pool: &DatabasePool,
    collection: &str,
    embed_fn: E,
) -> signapps_common::Result<SeedResult>
where
    E: Fn(String) -> EFut + Clone,
    EFut: std::future::Future<Output = signapps_common::Result<Vec<f32>>>,
{
    #[derive(sqlx::FromRow)]
    struct EventRow {
        id: Uuid,
        title: String,
        description: Option<String>,
        event_type: String,
        start_time: Option<String>,
        end_time: Option<String>,
        created_by: Option<Uuid>,
        location: Option<String>,
    }

    let rows = match sqlx::query_as::<_, EventRow>(
        "SELECT id, title, description, event_type, \
         start_time::text, end_time::text, created_by, location \
         FROM calendar.events LIMIT 10000",
    )
    .fetch_all(pool.inner())
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::debug!(source = "calendar.events", error = %e, "Table not available, skipping");
            return Ok(SeedResult {
                entities_created: 0,
                relations_created: 0,
                source: "calendar.events".to_string(),
            });
        },
    };

    let mut entity_count = 0usize;
    let mut relation_count = 0usize;

    for row in &rows {
        let location = row.location.as_deref().unwrap_or("unknown location");
        let start = row.start_time.as_deref().unwrap_or("?");
        let desc = format!(
            "{} ({}) at {} on {}",
            row.title, row.event_type, location, start
        );
        let embed_text = format!("{}: {}", row.title, desc);
        let embedding = embed_fn.clone()(embed_text).await?;

        let stored = KgRepository::upsert_entity(
            pool,
            collection,
            UpsertEntity {
                name: row.title.clone(),
                entity_type: "event".to_string(),
                description: Some(desc.clone()),
                source_document_id: None,
                attributes: Some(sanitize_attributes(serde_json::json!({
                    "event_id": row.id,
                    "event_type": row.event_type,
                    "start_time": row.start_time,
                    "end_time": row.end_time,
                }))),
            },
            &embedding,
        )
        .await?;
        entity_count += 1;

        // Relation: organized_by → creator user entity
        if let Some(creator_id) = row.created_by {
            let creator_entity: Option<(Uuid,)> = sqlx::query_as(
                "SELECT id FROM ai.kg_entities \
                 WHERE collection = $1 AND entity_type = 'person' \
                 AND (attributes->>'user_id')::uuid = $2 LIMIT 1",
            )
            .bind(collection)
            .bind(creator_id)
            .fetch_optional(pool.inner())
            .await
            .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

            if let Some((creator_eid,)) = creator_entity {
                let rel_desc = format!("{} organized by user {}", row.title, creator_id);
                let rel_embedding = embed_fn.clone()(rel_desc.clone()).await?;
                KgRepository::create_relation(
                    pool,
                    collection,
                    CreateRelation {
                        source_entity_id: stored.id,
                        target_entity_id: creator_eid,
                        relation_type: "organized_by".to_string(),
                        description: Some(rel_desc),
                        weight: None,
                        source_document_id: None,
                    },
                    &rel_embedding,
                )
                .await?;
                relation_count += 1;
            }
        }
    }

    tracing::info!(
        entities = entity_count,
        relations = relation_count,
        "Seeded calendar events"
    );
    Ok(SeedResult {
        entities_created: entity_count,
        relations_created: relation_count,
        source: "calendar.events".to_string(),
    })
}
