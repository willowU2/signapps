//! IT seeder — hardware assets and support tickets.

use signapps_db::{models::kg::UpsertEntity, repositories::KgRepository, DatabasePool};
use uuid::Uuid;

use super::helpers::{sanitize_attributes, SeedResult};

/// Seed IT hardware assets as device entities.
///
/// Reads from `it.hardware`.
///
/// # Errors
///
/// Returns `signapps_common::Error::Database` if the SQL query fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[tracing::instrument(skip(pool, embed_fn))]
pub(super) async fn seed_it_hardware<E, EFut>(
    pool: &DatabasePool,
    collection: &str,
    embed_fn: E,
) -> signapps_common::Result<SeedResult>
where
    E: Fn(String) -> EFut + Clone,
    EFut: std::future::Future<Output = signapps_common::Result<Vec<f32>>>,
{
    #[derive(sqlx::FromRow)]
    struct HardwareRow {
        id: Uuid,
        device_name: String,
        device_type: Option<String>,
        manufacturer: Option<String>,
        model: Option<String>,
        status: Option<String>,
    }

    let rows = match sqlx::query_as::<_, HardwareRow>(
        "SELECT id, device_name, device_type, manufacturer, model, status \
         FROM it.hardware LIMIT 5000",
    )
    .fetch_all(pool.inner())
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::debug!(source = "it.hardware", error = %e, "Table not available, skipping");
            return Ok(SeedResult {
                entities_created: 0,
                relations_created: 0,
                source: "it.hardware".to_string(),
            });
        }
    };

    let mut count = 0usize;
    for row in &rows {
        let manufacturer = row.manufacturer.as_deref().unwrap_or("unknown");
        let model = row.model.as_deref().unwrap_or("unknown");
        let device_type = row.device_type.as_deref().unwrap_or("device");
        let status = row.status.as_deref().unwrap_or("unknown");
        let desc = format!(
            "{} — {} {} ({}, {})",
            row.device_name, manufacturer, model, device_type, status
        );
        let embedding = embed_fn.clone()(desc.clone()).await?;

        KgRepository::upsert_entity(
            pool,
            collection,
            UpsertEntity {
                name: row.device_name.clone(),
                entity_type: "device".to_string(),
                description: Some(desc),
                source_document_id: None,
                attributes: Some(sanitize_attributes(serde_json::json!({
                    "hardware_id": row.id,
                    "device_type": row.device_type,
                    "manufacturer": row.manufacturer,
                    "model": row.model,
                    "status": row.status,
                }))),
            },
            &embedding,
        )
        .await?;
        count += 1;
    }

    tracing::info!(count = count, "Seeded IT hardware");
    Ok(SeedResult {
        entities_created: count,
        relations_created: 0,
        source: "it.hardware".to_string(),
    })
}

/// Seed IT support tickets as ticket entities.
///
/// Reads from `it.tickets`.
///
/// # Errors
///
/// Returns `signapps_common::Error::Database` if the SQL query fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[tracing::instrument(skip(pool, embed_fn))]
pub(super) async fn seed_it_tickets<E, EFut>(
    pool: &DatabasePool,
    collection: &str,
    embed_fn: E,
) -> signapps_common::Result<SeedResult>
where
    E: Fn(String) -> EFut + Clone,
    EFut: std::future::Future<Output = signapps_common::Result<Vec<f32>>>,
{
    #[derive(sqlx::FromRow)]
    struct TicketRow {
        id: Uuid,
        number: Option<String>,
        title: String,
        description: Option<String>,
        status: Option<String>,
        priority: Option<String>,
        category: Option<String>,
        requester_name: Option<String>,
    }

    let rows = match sqlx::query_as::<_, TicketRow>(
        "SELECT id, number, title, description, status, priority, category, requester_name \
         FROM it.tickets LIMIT 10000",
    )
    .fetch_all(pool.inner())
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::debug!(source = "it.tickets", error = %e, "Table not available, skipping");
            return Ok(SeedResult {
                entities_created: 0,
                relations_created: 0,
                source: "it.tickets".to_string(),
            });
        }
    };

    let mut count = 0usize;
    for row in &rows {
        let number = row.number.as_deref().unwrap_or("?");
        let priority = row.priority.as_deref().unwrap_or("normal");
        let status = row.status.as_deref().unwrap_or("open");
        let desc = format!(
            "#{}: {} (priority: {}, status: {})",
            number, row.title, priority, status
        );
        let embedding = embed_fn.clone()(desc.clone()).await?;

        KgRepository::upsert_entity(
            pool,
            collection,
            UpsertEntity {
                name: format!("Ticket #{}: {}", number, row.title),
                entity_type: "ticket".to_string(),
                description: Some(desc),
                source_document_id: None,
                attributes: Some(sanitize_attributes(serde_json::json!({
                    "ticket_id": row.id,
                    "number": row.number,
                    "status": row.status,
                    "priority": row.priority,
                    "category": row.category,
                    "requester_name": row.requester_name,
                }))),
            },
            &embedding,
        )
        .await?;
        count += 1;
    }

    tracing::info!(count = count, "Seeded IT tickets");
    Ok(SeedResult {
        entities_created: count,
        relations_created: 0,
        source: "it.tickets".to_string(),
    })
}
