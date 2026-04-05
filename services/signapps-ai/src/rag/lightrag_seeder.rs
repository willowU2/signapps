//! LightRAG Knowledge Graph Seeder.
//!
//! Populates the knowledge graph from existing signapps structured data
//! (users, org nodes, groups, assignments) WITHOUT LLM extraction.
//! This is "free" in terms of LLM tokens — just PostgreSQL reads + writes.

use std::collections::HashMap;

use signapps_db::models::kg::{CreateRelation, UpsertEntity};
use signapps_db::repositories::KgRepository;
use signapps_db::DatabasePool;
use uuid::Uuid;

/// Result of a seeding operation.
///
/// # Examples
///
/// ```
/// let r = SeedResult {
///     entities_created: 10,
///     relations_created: 5,
///     source: "identity.users".to_string(),
/// };
/// assert_eq!(r.entities_created, 10);
/// ```
#[derive(Debug, Clone, serde::Serialize)]
pub struct SeedResult {
    /// Number of entities created or updated.
    pub entities_created: usize,
    /// Number of relations created or updated.
    pub relations_created: usize,
    /// Source table that was seeded.
    pub source: String,
}

/// Seed the knowledge graph from all signapps structured data sources.
///
/// This is the main entry point — call it on startup or periodically.
/// Seeds users, org nodes, groups, assignments and all domain data in tiers.
///
/// # Errors
///
/// Returns `signapps_common::Error::Database` if any SQL query fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[tracing::instrument(skip(pool, embed_fn))]
pub async fn seed_all<E, EFut>(
    pool: &DatabasePool,
    collection: &str,
    embed_fn: E,
) -> signapps_common::Result<Vec<SeedResult>>
where
    E: Fn(String) -> EFut + Clone,
    EFut: std::future::Future<Output = signapps_common::Result<Vec<f32>>>,
{
    let mut results = Vec::new();

    tracing::info!(collection = collection, "Starting LightRAG seeding from signapps data");

    // Tier 1: Identity & Org
    results.push(seed_users(pool, collection, embed_fn.clone()).await?);
    results.push(seed_org_nodes(pool, collection, embed_fn.clone()).await?);
    results.push(seed_groups(pool, collection, embed_fn.clone()).await?);
    results.push(seed_assignments(pool, collection, embed_fn.clone()).await?);

    // Tier 2: Content
    results.push(seed_calendar_events(pool, collection, embed_fn.clone()).await?);
    results.push(seed_documents(pool, collection, embed_fn.clone()).await?);
    results.push(seed_chat_channels(pool, collection, embed_fn.clone()).await?);
    results.push(seed_mail_accounts(pool, collection, embed_fn.clone()).await?);
    results.push(seed_files(pool, collection, embed_fn.clone()).await?);

    // Tier 3: Specialized
    results.push(seed_meetings(pool, collection, embed_fn.clone()).await?);
    results.push(seed_forms(pool, collection, embed_fn.clone()).await?);
    results.push(seed_social_posts(pool, collection, embed_fn.clone()).await?);
    results.push(seed_crm(pool, collection, embed_fn.clone()).await?);
    results.push(seed_courses(pool, collection, embed_fn.clone()).await?);

    // Tier 4: Infrastructure
    results.push(seed_it_hardware(pool, collection, embed_fn.clone()).await?);
    results.push(seed_it_tickets(pool, collection, embed_fn.clone()).await?);
    results.push(seed_invoices(pool, collection, embed_fn.clone()).await?);

    let total_entities: usize = results.iter().map(|r| r.entities_created).sum();
    let total_relations: usize = results.iter().map(|r| r.relations_created).sum();

    tracing::info!(
        entities = total_entities,
        relations = total_relations,
        "LightRAG seeding complete"
    );

    Ok(results)
}

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
async fn seed_users<E, EFut>(
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
                attributes: Some(serde_json::json!({
                    "username": user.username,
                    "email": user.email,
                    "user_id": user.id,
                })),
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
async fn seed_org_nodes<E, EFut>(
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
                attributes: Some(serde_json::json!({
                    "node_id": node.id,
                    "node_type": node.node_type,
                })),
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
async fn seed_groups<E, EFut>(
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
        let desc = group.description.clone().unwrap_or_else(|| {
            format!("{} group ({})", group.name, group.group_type)
        });
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
                attributes: Some(serde_json::json!({
                    "group_id": group.id,
                    "group_type": group.group_type,
                })),
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
async fn seed_assignments<E, EFut>(
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
async fn seed_calendar_events<E, EFut>(
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
        }
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
                attributes: Some(serde_json::json!({
                    "event_id": row.id,
                    "event_type": row.event_type,
                    "start_time": row.start_time,
                    "end_time": row.end_time,
                })),
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

    tracing::info!(entities = entity_count, relations = relation_count, "Seeded calendar events");
    Ok(SeedResult {
        entities_created: entity_count,
        relations_created: relation_count,
        source: "calendar.events".to_string(),
    })
}

/// Seed mail accounts as mail_account entities.
///
/// Reads from `mail.accounts`. Email bodies are intentionally excluded for privacy.
///
/// # Errors
///
/// Returns `signapps_common::Error::Database` if the SQL query fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[tracing::instrument(skip(pool, embed_fn))]
async fn seed_mail_accounts<E, EFut>(
    pool: &DatabasePool,
    collection: &str,
    embed_fn: E,
) -> signapps_common::Result<SeedResult>
where
    E: Fn(String) -> EFut + Clone,
    EFut: std::future::Future<Output = signapps_common::Result<Vec<f32>>>,
{
    #[derive(sqlx::FromRow)]
    struct MailAccountRow {
        id: Uuid,
        email_address: String,
        display_name: Option<String>,
    }

    let rows = match sqlx::query_as::<_, MailAccountRow>(
        "SELECT id, email_address, display_name FROM mail.accounts LIMIT 5000",
    )
    .fetch_all(pool.inner())
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::debug!(source = "mail.accounts", error = %e, "Table not available, skipping");
            return Ok(SeedResult {
                entities_created: 0,
                relations_created: 0,
                source: "mail.accounts".to_string(),
            });
        }
    };

    let mut count = 0usize;
    for row in &rows {
        let display = row.display_name.as_deref().unwrap_or(&row.email_address);
        let desc = format!("Mail account: {} ({})", display, row.email_address);
        let embedding = embed_fn.clone()(desc.clone()).await?;

        KgRepository::upsert_entity(
            pool,
            collection,
            UpsertEntity {
                name: display.to_string(),
                entity_type: "mail_account".to_string(),
                description: Some(desc),
                source_document_id: None,
                attributes: Some(serde_json::json!({
                    "account_id": row.id,
                    "email_address": row.email_address,
                })),
            },
            &embedding,
        )
        .await?;
        count += 1;
    }

    tracing::info!(count = count, "Seeded mail accounts");
    Ok(SeedResult {
        entities_created: count,
        relations_created: 0,
        source: "mail.accounts".to_string(),
    })
}

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
async fn seed_chat_channels<E, EFut>(
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
        }
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
                attributes: Some(serde_json::json!({
                    "channel_id": row.id,
                })),
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

/// Seed documents as document entities.
///
/// Reads from the `documents` table.
///
/// # Errors
///
/// Returns `signapps_common::Error::Database` if the SQL query fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[tracing::instrument(skip(pool, embed_fn))]
async fn seed_documents<E, EFut>(
    pool: &DatabasePool,
    collection: &str,
    embed_fn: E,
) -> signapps_common::Result<SeedResult>
where
    E: Fn(String) -> EFut + Clone,
    EFut: std::future::Future<Output = signapps_common::Result<Vec<f32>>>,
{
    #[derive(sqlx::FromRow)]
    struct DocumentRow {
        id: Uuid,
        name: String,
        doc_type: Option<String>,
    }

    let rows = match sqlx::query_as::<_, DocumentRow>(
        "SELECT id, name, doc_type FROM documents LIMIT 10000",
    )
    .fetch_all(pool.inner())
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::debug!(source = "documents", error = %e, "Table not available, skipping");
            return Ok(SeedResult {
                entities_created: 0,
                relations_created: 0,
                source: "documents".to_string(),
            });
        }
    };

    let mut count = 0usize;
    for row in &rows {
        let dtype = row.doc_type.as_deref().unwrap_or("document");
        let desc = format!("{} ({} document)", row.name, dtype);
        let embedding = embed_fn.clone()(desc.clone()).await?;

        KgRepository::upsert_entity(
            pool,
            collection,
            UpsertEntity {
                name: row.name.clone(),
                entity_type: "document".to_string(),
                description: Some(desc),
                source_document_id: None,
                attributes: Some(serde_json::json!({
                    "document_id": row.id,
                    "doc_type": row.doc_type,
                })),
            },
            &embedding,
        )
        .await?;
        count += 1;
    }

    tracing::info!(count = count, "Seeded documents");
    Ok(SeedResult {
        entities_created: count,
        relations_created: 0,
        source: "documents".to_string(),
    })
}

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
async fn seed_files<E, EFut>(
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
        }
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
                attributes: Some(serde_json::json!({
                    "file_id": row.id,
                    "content_type": row.content_type,
                    "bucket": row.bucket,
                })),
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
async fn seed_it_hardware<E, EFut>(
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
                attributes: Some(serde_json::json!({
                    "hardware_id": row.id,
                    "device_type": row.device_type,
                    "manufacturer": row.manufacturer,
                    "model": row.model,
                    "status": row.status,
                })),
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
async fn seed_it_tickets<E, EFut>(
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
                attributes: Some(serde_json::json!({
                    "ticket_id": row.id,
                    "number": row.number,
                    "status": row.status,
                    "priority": row.priority,
                    "category": row.category,
                    "requester_name": row.requester_name,
                })),
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

/// Seed CRM leads as lead entities.
///
/// Reads from `crm.leads`.
///
/// # Errors
///
/// Returns `signapps_common::Error::Database` if the SQL query fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[tracing::instrument(skip(pool, embed_fn))]
async fn seed_crm<E, EFut>(
    pool: &DatabasePool,
    collection: &str,
    embed_fn: E,
) -> signapps_common::Result<SeedResult>
where
    E: Fn(String) -> EFut + Clone,
    EFut: std::future::Future<Output = signapps_common::Result<Vec<f32>>>,
{
    #[derive(sqlx::FromRow)]
    struct LeadRow {
        id: Uuid,
        name: String,
        company: Option<String>,
        status: Option<String>,
        email: Option<String>,
    }

    let rows = match sqlx::query_as::<_, LeadRow>(
        "SELECT id, name, company, status, email FROM crm.leads LIMIT 5000",
    )
    .fetch_all(pool.inner())
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::debug!(source = "crm.leads", error = %e, "Table not available, skipping");
            return Ok(SeedResult {
                entities_created: 0,
                relations_created: 0,
                source: "crm.leads".to_string(),
            });
        }
    };

    let mut count = 0usize;
    for row in &rows {
        let company = row.company.as_deref().unwrap_or("unknown company");
        let status = row.status.as_deref().unwrap_or("unknown");
        let desc = format!("{} at {} ({})", row.name, company, status);
        let embedding = embed_fn.clone()(desc.clone()).await?;

        KgRepository::upsert_entity(
            pool,
            collection,
            UpsertEntity {
                name: row.name.clone(),
                entity_type: "lead".to_string(),
                description: Some(desc),
                source_document_id: None,
                attributes: Some(serde_json::json!({
                    "lead_id": row.id,
                    "company": row.company,
                    "status": row.status,
                    "email": row.email,
                })),
            },
            &embedding,
        )
        .await?;
        count += 1;
    }

    tracing::info!(count = count, "Seeded CRM leads");
    Ok(SeedResult {
        entities_created: count,
        relations_created: 0,
        source: "crm.leads".to_string(),
    })
}

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
async fn seed_social_posts<E, EFut>(
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
                attributes: Some(serde_json::json!({
                    "post_id": row.id,
                    "status": row.status,
                    "published_at": row.published_at,
                })),
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
async fn seed_meetings<E, EFut>(
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
        }
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
                attributes: Some(serde_json::json!({
                    "room_id": row.id,
                    "created_by": row.created_by,
                })),
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

/// Seed published forms as form entities.
///
/// Reads from `forms.forms` (published only).
///
/// # Errors
///
/// Returns `signapps_common::Error::Database` if the SQL query fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[tracing::instrument(skip(pool, embed_fn))]
async fn seed_forms<E, EFut>(
    pool: &DatabasePool,
    collection: &str,
    embed_fn: E,
) -> signapps_common::Result<SeedResult>
where
    E: Fn(String) -> EFut + Clone,
    EFut: std::future::Future<Output = signapps_common::Result<Vec<f32>>>,
{
    #[derive(sqlx::FromRow)]
    struct FormRow {
        id: Uuid,
        title: String,
        description: Option<String>,
    }

    let rows = match sqlx::query_as::<_, FormRow>(
        "SELECT id, title, description FROM forms.forms WHERE is_published = true LIMIT 5000",
    )
    .fetch_all(pool.inner())
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::debug!(source = "forms.forms", error = %e, "Table not available, skipping");
            return Ok(SeedResult {
                entities_created: 0,
                relations_created: 0,
                source: "forms.forms".to_string(),
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
                entity_type: "form".to_string(),
                description: Some(desc),
                source_document_id: None,
                attributes: Some(serde_json::json!({
                    "form_id": row.id,
                })),
            },
            &embedding,
        )
        .await?;
        count += 1;
    }

    tracing::info!(count = count, "Seeded forms");
    Ok(SeedResult {
        entities_created: count,
        relations_created: 0,
        source: "forms.forms".to_string(),
    })
}

/// Seed billing invoices as invoice entities.
///
/// Reads from `billing.invoices`. Skips gracefully if table does not exist.
///
/// # Errors
///
/// Returns `signapps_common::Error::Database` if any SQL query fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[tracing::instrument(skip(pool, embed_fn))]
async fn seed_invoices<E, EFut>(
    pool: &DatabasePool,
    collection: &str,
    embed_fn: E,
) -> signapps_common::Result<SeedResult>
where
    E: Fn(String) -> EFut + Clone,
    EFut: std::future::Future<Output = signapps_common::Result<Vec<f32>>>,
{
    #[derive(sqlx::FromRow)]
    struct InvoiceRow {
        id: Uuid,
        number: Option<String>,
        status: Option<String>,
        total_cents: Option<i64>,
        currency: Option<String>,
    }

    let rows = match sqlx::query_as::<_, InvoiceRow>(
        "SELECT id, number, status, total_cents, currency \
         FROM billing.invoices LIMIT 5000",
    )
    .fetch_all(pool.inner())
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::debug!(source = "billing.invoices", error = %e, "Table not available, skipping");
            return Ok(SeedResult {
                entities_created: 0,
                relations_created: 0,
                source: "billing.invoices".to_string(),
            });
        }
    };

    let mut count = 0usize;
    for row in &rows {
        let number = row.number.as_deref().unwrap_or("?");
        let status = row.status.as_deref().unwrap_or("unknown");
        let currency = row.currency.as_deref().unwrap_or("?");
        let amount = row.total_cents.unwrap_or(0);
        let amount_display = format!("{:.2}", amount as f64 / 100.0);
        let desc = format!(
            "Invoice #{} ({}, {} {})",
            number, status, amount_display, currency
        );
        let embedding = embed_fn.clone()(desc.clone()).await?;

        KgRepository::upsert_entity(
            pool,
            collection,
            UpsertEntity {
                name: format!("Invoice #{}", number),
                entity_type: "invoice".to_string(),
                description: Some(desc),
                source_document_id: None,
                attributes: Some(serde_json::json!({
                    "invoice_id": row.id,
                    "number": row.number,
                    "status": row.status,
                    "total_cents": row.total_cents,
                    "currency": row.currency,
                })),
            },
            &embedding,
        )
        .await?;
        count += 1;
    }

    tracing::info!(count = count, "Seeded invoices");
    Ok(SeedResult {
        entities_created: count,
        relations_created: 0,
        source: "billing.invoices".to_string(),
    })
}

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
async fn seed_courses<E, EFut>(
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
                attributes: Some(serde_json::json!({
                    "course_id": row.id,
                })),
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn seed_result_serializable() {
        let r = SeedResult {
            entities_created: 10,
            relations_created: 5,
            source: "test".to_string(),
        };
        let json = serde_json::to_string(&r).unwrap();
        assert!(json.contains("entities_created"));
    }
}
