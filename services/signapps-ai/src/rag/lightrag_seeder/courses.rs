//! Courses seeder — `workforce.courses` (published) as course entities.

use signapps_db::{models::kg::UpsertEntity, repositories::KgRepository, DatabasePool};
use uuid::Uuid;

use super::helpers::{sanitize_attributes, SeedResult};

/// Seed published workforce courses as course entities.
///
/// Reads from `workforce.courses` (published only).
///
/// # Errors
///
/// Returns `signapps_common::Error::Database` if the SQL query fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[tracing::instrument(skip(pool, embed_fn))]
pub(super) async fn seed_courses<E, EFut>(
    pool: &DatabasePool,
    collection: &str,
    embed_fn: E,
) -> signapps_common::Result<SeedResult>
where
    E: Fn(String) -> EFut + Clone,
    EFut: std::future::Future<Output = signapps_common::Result<Vec<f32>>>,
{
    #[derive(sqlx::FromRow)]
    struct CourseRow {
        id: Uuid,
        title: String,
        description: Option<String>,
    }

    let rows = match sqlx::query_as::<_, CourseRow>(
        "SELECT id, title, description FROM workforce.courses WHERE is_published = true LIMIT 5000",
    )
    .fetch_all(pool.inner())
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::debug!(source = "workforce.courses", error = %e, "Table not available, skipping");
            return Ok(SeedResult {
                entities_created: 0,
                relations_created: 0,
                source: "workforce.courses".to_string(),
            });
        }
    };

    let mut count = 0usize;
    for row in &rows {
        let description = row.description.as_deref().unwrap_or("(no description)");
        let desc = format!("{}: {}", row.title, description);
        let embedding = embed_fn.clone()(desc.clone()).await?;

        KgRepository::upsert_entity(
            pool,
            collection,
            UpsertEntity {
                name: row.title.clone(),
                entity_type: "course".to_string(),
                description: Some(desc),
                source_document_id: None,
                attributes: Some(sanitize_attributes(serde_json::json!({
                    "course_id": row.id,
                }))),
            },
            &embedding,
        )
        .await?;
        count += 1;
    }

    tracing::info!(count = count, "Seeded courses");
    Ok(SeedResult {
        entities_created: count,
        relations_created: 0,
        source: "workforce.courses".to_string(),
    })
}
