//! Social seeder — `social.posts` (published) as social_post entities.

use signapps_db::{models::kg::UpsertEntity, repositories::KgRepository, DatabasePool};
use uuid::Uuid;

use super::helpers::{sanitize_attributes, SeedResult};

/// Seed published social posts as social_post entities.
///
/// Reads from `social.posts` (published only). Content is truncated to 200 chars.
///
/// # Errors
///
/// Returns `signapps_common::Error::Database` if the SQL query fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[tracing::instrument(skip(pool, embed_fn))]
pub(super) async fn seed_social_posts<E, EFut>(
    pool: &DatabasePool,
    collection: &str,
    embed_fn: E,
) -> signapps_common::Result<SeedResult>
where
    E: Fn(String) -> EFut + Clone,
    EFut: std::future::Future<Output = signapps_common::Result<Vec<f32>>>,
{
    #[derive(sqlx::FromRow)]
    struct PostRow {
        id: Uuid,
        content: Option<String>,
        status: Option<String>,
        published_at: Option<String>,
    }

    let rows = match sqlx::query_as::<_, PostRow>(
        "SELECT id, content, status, published_at::text \
         FROM social.posts WHERE status = 'published' LIMIT 5000",
    )
    .fetch_all(pool.inner())
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::debug!(source = "social.posts", error = %e, "Table not available, skipping");
            return Ok(SeedResult {
                entities_created: 0,
                relations_created: 0,
                source: "social.posts".to_string(),
            });
        }
    };

    let mut count = 0usize;
    for row in &rows {
        let full_content = row.content.as_deref().unwrap_or("");
        let desc: String = full_content.chars().take(200).collect();
        let embedding = embed_fn.clone()(desc.clone()).await?;

        // Use first 60 chars as entity name, or post ID if empty
        let name: String = if full_content.is_empty() {
            format!("Post {}", row.id)
        } else {
            full_content.chars().take(60).collect()
        };

        KgRepository::upsert_entity(
            pool,
            collection,
            UpsertEntity {
                name,
                entity_type: "social_post".to_string(),
                description: Some(desc),
                source_document_id: None,
                attributes: Some(sanitize_attributes(serde_json::json!({
                    "post_id": row.id,
                    "status": row.status,
                    "published_at": row.published_at,
                }))),
            },
            &embedding,
        )
        .await?;
        count += 1;
    }

    tracing::info!(count = count, "Seeded social posts");
    Ok(SeedResult {
        entities_created: count,
        relations_created: 0,
        source: "social.posts".to_string(),
    })
}
