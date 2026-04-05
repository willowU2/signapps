//! Identity seeder — populates person entities from `identity.users`.

use signapps_db::{models::kg::UpsertEntity, repositories::KgRepository, DatabasePool};
use uuid::Uuid;

use super::helpers::{sanitize_attributes, SeedResult};

/// Seed users as person entities.
///
/// Reads from `identity.users` and upserts each as a `person` entity.
///
/// # Errors
///
/// Returns `signapps_common::Error::Database` if the SQL query fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[tracing::instrument(skip(pool, embed_fn))]
pub(super) async fn seed_users<E, EFut>(
    pool: &DatabasePool,
    collection: &str,
    embed_fn: E,
) -> signapps_common::Result<SeedResult>
where
    E: Fn(String) -> EFut + Clone,
    EFut: std::future::Future<Output = signapps_common::Result<Vec<f32>>>,
{
    #[derive(sqlx::FromRow)]
    struct UserRow {
        id: Uuid,
        username: String,
        email: Option<String>,
        department: Option<String>,
        job_title: Option<String>,
        display_name: Option<String>,
    }

    let users: Vec<UserRow> = sqlx::query_as(
        "SELECT id, username, email, department, job_title, display_name \
         FROM identity.users LIMIT 10000",
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    let mut count = 0;
    for user in &users {
        let name = user.display_name.as_deref().unwrap_or(&user.username);
        let description = format!(
            "{}{}{}",
            user.job_title
                .as_deref()
                .map(|t| t.to_string())
                .unwrap_or_default(),
            if user.department.is_some() && user.job_title.is_some() {
                " in "
            } else {
                ""
            },
            user.department.as_deref().unwrap_or("")
        );
        let desc = if description.trim().is_empty() {
            format!("User account: {}", user.username)
        } else {
            description
        };

        let embed_text = format!("{name}: {desc}");
        let embedding = embed_fn.clone()(embed_text).await?;

        KgRepository::upsert_entity(
            pool,
            collection,
            UpsertEntity {
                name: name.to_string(),
                entity_type: "person".to_string(),
                description: Some(desc),
                source_document_id: None,
                attributes: Some(sanitize_attributes(serde_json::json!({
                    "username": user.username,
                    "email": user.email,
                    "user_id": user.id,
                }))),
            },
            &embedding,
        )
        .await?;
        count += 1;
    }

    tracing::info!(count = count, "Seeded users");
    Ok(SeedResult {
        entities_created: count,
        relations_created: 0,
        source: "identity.users".to_string(),
    })
}
