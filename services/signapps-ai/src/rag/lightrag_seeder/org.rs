//! Org seeder — org nodes as organization entities and assignment relations.

use std::collections::HashMap;

use signapps_db::{
    models::kg::{CreateRelation, UpsertEntity},
    repositories::KgRepository,
    DatabasePool,
};
use uuid::Uuid;

use super::helpers::{sanitize_attributes, SeedResult};

/// Seed org nodes as organization entities with `part_of` relations.
///
/// Two-pass approach: first upserts all node entities, then creates
/// parent-child `part_of` relations based on `parent_id`.
///
/// # Errors
///
/// Returns `signapps_common::Error::Database` if any SQL query fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[tracing::instrument(skip(pool, embed_fn))]
pub(super) async fn seed_org_nodes<E, EFut>(
    pool: &DatabasePool,
    collection: &str,
    embed_fn: E,
) -> signapps_common::Result<SeedResult>
where
    E: Fn(String) -> EFut + Clone,
    EFut: std::future::Future<Output = signapps_common::Result<Vec<f32>>>,
{
    #[derive(sqlx::FromRow)]
    struct NodeRow {
        id: Uuid,
        name: String,
        node_type: String,
        parent_id: Option<Uuid>,
        description: Option<String>,
    }

    let nodes: Vec<NodeRow> = sqlx::query_as(
        "SELECT id, name, node_type, parent_id, description \
         FROM workforce_org_nodes \
         WHERE is_active = true \
           AND (lifecycle_state IS NULL OR lifecycle_state = 'live') \
         LIMIT 10000",
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    let mut entity_count = 0;
    let mut relation_count = 0;

    // Map node_id → KG entity id for relation building
    let mut node_entity_ids: HashMap<Uuid, Uuid> = HashMap::new();

    // First pass: create entities
    for node in &nodes {
        let desc = node
            .description
            .clone()
            .unwrap_or_else(|| format!("{} ({})", node.name, node.node_type));
        let embed_text = format!("{}: {}", node.name, desc);
        let embedding = embed_fn.clone()(embed_text).await?;

        let entity_type = match node.node_type.as_str() {
            "group" | "subsidiary" | "bu" => "organization",
            "department" | "service" => "department",
            "team" => "team",
            "position" => "role",
            _ => "organization",
        };

        let stored = KgRepository::upsert_entity(
            pool,
            collection,
            UpsertEntity {
                name: node.name.clone(),
                entity_type: entity_type.to_string(),
                description: Some(desc),
                source_document_id: None,
                attributes: Some(sanitize_attributes(serde_json::json!({
                    "node_id": node.id,
                    "node_type": node.node_type,
                }))),
            },
            &embedding,
        )
        .await?;

        node_entity_ids.insert(node.id, stored.id);
        entity_count += 1;
    }

    // Second pass: create part_of relations
    for node in &nodes {
        if let Some(parent_id) = node.parent_id {
            let child_entity_id = node_entity_ids.get(&node.id);
            let parent_entity_id = node_entity_ids.get(&parent_id);

            if let (Some(&child_eid), Some(&parent_eid)) = (child_entity_id, parent_entity_id) {
                let parent_name = nodes
                    .iter()
                    .find(|n| n.id == parent_id)
                    .map(|n| n.name.as_str())
                    .unwrap_or("?");
                let rel_desc = format!("{} is part of {}", node.name, parent_name);
                let embedding = embed_fn.clone()(rel_desc.clone()).await?;

                KgRepository::create_relation(
                    pool,
                    collection,
                    CreateRelation {
                        source_entity_id: child_eid,
                        target_entity_id: parent_eid,
                        relation_type: "part_of".to_string(),
                        description: Some(rel_desc),
                        weight: None,
                        source_document_id: None,
                    },
                    &embedding,
                )
                .await?;
                relation_count += 1;
            }
        }
    }

    tracing::info!(
        entities = entity_count,
        relations = relation_count,
        "Seeded org nodes"
    );
    Ok(SeedResult {
        entities_created: entity_count,
        relations_created: relation_count,
        source: "workforce_org_nodes".to_string(),
    })
}

/// Seed assignments as `works_in` relations between persons and org nodes.
///
/// Joins `core.assignments`, `core.persons`, and `workforce_org_nodes`,
/// then resolves entity IDs by name lookup in the KG and creates typed relations.
///
/// # Errors
///
/// Returns `signapps_common::Error::Database` if any SQL query fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[tracing::instrument(skip(pool, embed_fn))]
pub(super) async fn seed_assignments<E, EFut>(
    pool: &DatabasePool,
    collection: &str,
    embed_fn: E,
) -> signapps_common::Result<SeedResult>
where
    E: Fn(String) -> EFut + Clone,
    EFut: std::future::Future<Output = signapps_common::Result<Vec<f32>>>,
{
    #[derive(sqlx::FromRow)]
    struct AssignmentRow {
        person_name: String,
        node_name: String,
        assignment_type: String,
    }

    let assignments: Vec<AssignmentRow> = sqlx::query_as(
        r#"
        SELECT
            CONCAT(p.first_name, ' ', p.last_name) AS person_name,
            n.name AS node_name,
            a.assignment_type
        FROM core.assignments a
        JOIN core.persons p ON p.id = a.person_id
        JOIN workforce_org_nodes n ON n.id = a.node_id
        WHERE a.end_date IS NULL
        LIMIT 10000
        "#,
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    let mut count = 0;
    for assignment in &assignments {
        let person_entity: Option<(Uuid,)> = sqlx::query_as(
            "SELECT id FROM ai.kg_entities \
             WHERE collection = $1 AND name = $2 AND entity_type = 'person' \
             LIMIT 1",
        )
        .bind(collection)
        .bind(&assignment.person_name)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

        let node_entity: Option<(Uuid,)> = sqlx::query_as(
            "SELECT id FROM ai.kg_entities \
             WHERE collection = $1 AND name = $2 \
             LIMIT 1",
        )
        .bind(collection)
        .bind(&assignment.node_name)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

        if let (Some((person_eid,)), Some((node_eid,))) = (person_entity, node_entity) {
            let rel_type = match assignment.assignment_type.as_str() {
                "holder" => "works_in",
                "interim" => "temporarily_in",
                "deputy" => "deputizes_in",
                _ => "assigned_to",
            };
            let desc = format!(
                "{} {} {}",
                assignment.person_name, rel_type, assignment.node_name
            );
            let embedding = embed_fn.clone()(desc.clone()).await?;

            KgRepository::create_relation(
                pool,
                collection,
                CreateRelation {
                    source_entity_id: person_eid,
                    target_entity_id: node_eid,
                    relation_type: rel_type.to_string(),
                    description: Some(desc),
                    weight: None,
                    source_document_id: None,
                },
                &embedding,
            )
            .await?;
            count += 1;
        }
    }

    tracing::info!(count = count, "Seeded assignments");
    Ok(SeedResult {
        entities_created: 0,
        relations_created: count,
        source: "core.assignments".to_string(),
    })
}
