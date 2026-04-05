//! LightRAG Knowledge Graph Seeder — multi-source data population.
//!
//! Populates the knowledge graph from existing signapps structured data
//! (users, org nodes, groups, assignments, and all domain tables) WITHOUT LLM extraction.
//! This is "free" in terms of LLM tokens — just PostgreSQL reads + writes.
//!
//! # Module layout
//!
//! | Module | Source tables |
//! |--------|--------------|
//! | `identity` | `identity.users` |
//! | `org` | `workforce_org_nodes`, `core.assignments` |
//! | `groups` | `workforce_org_groups` |
//! | `calendar` | `calendar.events` |
//! | `documents` | `documents` |
//! | `chat` | `chat.channels` |
//! | `mail` | `mail.accounts` |
//! | `files` | `storage.files` |
//! | `meetings` | `meet.rooms` |
//! | `forms` | `forms.forms` |
//! | `social` | `social.posts` |
//! | `crm` | `crm.leads` |
//! | `courses` | `workforce.courses` |
//! | `it` | `it.hardware`, `it.tickets` |
//! | `billing` | `billing.invoices` |

mod billing;
mod calendar;
mod chat;
mod courses;
mod crm;
mod documents;
mod files;
mod forms;
mod groups;
mod helpers;
mod identity;
mod it;
mod mail;
mod meetings;
mod org;
mod social;

pub use helpers::SeedResult;

use signapps_db::DatabasePool;

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
    results.push(identity::seed_users(pool, collection, embed_fn.clone()).await?);
    results.push(org::seed_org_nodes(pool, collection, embed_fn.clone()).await?);
    results.push(groups::seed_groups(pool, collection, embed_fn.clone()).await?);
    results.push(org::seed_assignments(pool, collection, embed_fn.clone()).await?);

    // Tier 2: Content
    results.push(calendar::seed_calendar_events(pool, collection, embed_fn.clone()).await?);
    results.push(documents::seed_documents(pool, collection, embed_fn.clone()).await?);
    results.push(chat::seed_chat_channels(pool, collection, embed_fn.clone()).await?);
    results.push(mail::seed_mail_accounts(pool, collection, embed_fn.clone()).await?);
    results.push(files::seed_files(pool, collection, embed_fn.clone()).await?);

    // Tier 3: Specialized
    results.push(meetings::seed_meetings(pool, collection, embed_fn.clone()).await?);
    results.push(forms::seed_forms(pool, collection, embed_fn.clone()).await?);
    results.push(social::seed_social_posts(pool, collection, embed_fn.clone()).await?);
    results.push(crm::seed_crm(pool, collection, embed_fn.clone()).await?);
    results.push(courses::seed_courses(pool, collection, embed_fn.clone()).await?);

    // Tier 4: Infrastructure
    results.push(it::seed_it_hardware(pool, collection, embed_fn.clone()).await?);
    results.push(it::seed_it_tickets(pool, collection, embed_fn.clone()).await?);
    results.push(billing::seed_invoices(pool, collection, embed_fn.clone()).await?);

    let total_entities: usize = results.iter().map(|r| r.entities_created).sum();
    let total_relations: usize = results.iter().map(|r| r.relations_created).sum();

    tracing::info!(
        entities = total_entities,
        relations = total_relations,
        "LightRAG seeding complete"
    );

    Ok(results)
}
