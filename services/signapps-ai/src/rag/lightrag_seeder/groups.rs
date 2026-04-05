//! Groups seeder — `workforce_org_groups` as group entities.

use signapps_db::{models::kg::UpsertEntity, repositories::KgRepository, DatabasePool};
use uuid::Uuid;

use super::helpers::{sanitize_attributes, SeedResult};

/// Seed groups as group entities.
///
/// Reads from `workforce_org_groups` and upserts each active group.
///
/// # Errors
///
/// Returns `signapps_common::Error::Database` if the SQL query fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[tracing::instrument(skip(pool, embed_fn))]
pub(super) async fn seed_groups<E, EFut>(
    pool: &DatabasePool,
    collection: &str,
    embed_fn: E,
) -> signapps_common::Result<SeedResult>
where
    E: Fn(String) -> EFut + Clone,
    EFut: std::future::Future<Output = signapps_common::Result<Vec<f32>>>,
{
    #[derive(sqlx::FromRow)]
    struct GroupRow {
        id: Uuid,
        name: String,
        description: Option<String>,
        group_type: String,
    }

    let groups: Vec<GroupRow> = sqlx::query_as(
        "SELECT id, name, description, group_type \
         FROM workforce_org_groups \
         WHERE is_active = true \
         LIMIT 5000",
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    let mut count = 0;
    for group in &groups {
        let desc = group
            .description
            .clone()
            .unwrap_or_else(|| format!("{} group ({})", group.name, group.group_type));
        let embed_text = format!("{}: {}", group.name, desc);
        let embedding = embed_fn.clone()(embed_text).await?;

        KgRepository::upsert_entity(
            pool,
            collection,
            UpsertEntity {
                name: group.name.clone(),
                entity_type: "group".to_string(),
                description: Some(desc),
                source_document_id: None,
                attributes: Some(sanitize_attributes(serde_json::json!({
                    "group_id": group.id,
                    "group_type": group.group_type,
                }))),
            },
            &embedding,
        )
        .await?;
        count += 1;
    }

    tracing::info!(count = count, "Seeded groups");
    Ok(SeedResult {
        entities_created: count,
        relations_created: 0,
        source: "workforce_org_groups".to_string(),
    })
}
