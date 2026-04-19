// crates/signapps-ad-core/src/sync_worker.rs
//! AD Sync Worker — processes events from the `ad_sync_queue` table.
//!
//! The worker loop calls [`AdSyncQueueRepository::dequeue`] in batches, dispatches
//! each event to the appropriate handler, then marks it completed or schedules a
//! retry with exponential backoff.
//!
//! Supported event types:
//!
//! | Event | Handler |
//! |-------|---------|
//! | `ou_create` | [`handle_ou_create`] |
//! | `ou_rename` | [`handle_ou_rename`] |
//! | `ou_move` | [`handle_ou_move`] |
//! | `ou_delete` | [`handle_ou_delete`] |
//! | `user_provision` | [`handle_user_provision`] |
//! | `user_disable` | [`handle_user_disable`] |
//! | `user_move` | [`handle_user_move`] |
//! | `user_update` | [`handle_user_update`] |
//! | `group_create` | [`handle_group_create`] |
//! | `group_sync` | [`handle_group_sync`] |
//! | `group_delete` | [`handle_group_delete`] |
//! | `computer_create` | [`handle_computer_create`] |
//! | `computer_disable` | [`handle_computer_disable`] |
//! | `mail_domain_bind` | [`handle_mail_domain_bind`] |

use signapps_common::Result;
use signapps_db::models::ad_sync::AdSyncEvent;
use signapps_db::repositories::{AdOuRepository, AdSyncQueueRepository, AdUserAccountRepository};
use sqlx::PgPool;
use uuid::Uuid;

use crate::mail_provisioner;
use crate::mail_resolver;
use crate::naming;

// ── Public interface ──────────────────────────────────────────────────────────

/// Process a single sync event, dispatching to the appropriate handler.
///
/// Called by [`run_sync_worker`] for each dequeued event. Returns `Ok(())`
/// for both successful operations and no-op cases (e.g. already-provisioned
/// entities). Returns `Err` only for transient failures that should be retried.
///
/// # Errors
///
/// Returns an error if the database operation fails (the worker will retry).
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[tracing::instrument(skip(pool, event), fields(event_id = %event.id, event_type = %event.event_type))]
pub async fn process_event(pool: &PgPool, event: &AdSyncEvent) -> Result<()> {
    match event.event_type.as_str() {
        "ou_create" => handle_ou_create(pool, event).await,
        "ou_rename" => handle_ou_rename(pool, event).await,
        "ou_move" => handle_ou_move(pool, event).await,
        "ou_delete" => handle_ou_delete(pool, event).await,
        "user_provision" => handle_user_provision(pool, event).await,
        "user_disable" => handle_user_disable(pool, event).await,
        "user_move" => handle_user_move(pool, event).await,
        "user_update" => handle_user_update(pool, event).await,
        "group_create" => handle_group_create(pool, event).await,
        "group_sync" => handle_group_sync(pool, event).await,
        "group_delete" => handle_group_delete(pool, event).await,
        "computer_create" => handle_computer_create(pool, event).await,
        "computer_disable" => handle_computer_disable(pool, event).await,
        "mail_domain_bind" => handle_mail_domain_bind(pool, event).await,
        _ => {
            tracing::warn!(event_type = %event.event_type, "Unknown event type — skipping");
            Ok(())
        },
    }
}

/// Run the AD sync worker loop.
///
/// Polls the `ad_sync_queue` for pending events and processes them in batches.
/// Sleeps briefly when the queue is empty, or longer on database errors.
///
/// This function never returns — call it inside a `tokio::spawn`.
///
/// # Panics
///
/// No panics possible — errors are logged and the loop continues.
#[tracing::instrument(skip(pool))]
pub async fn run_sync_worker(pool: PgPool) {
    tracing::info!("AD sync worker started");

    loop {
        match AdSyncQueueRepository::dequeue(&pool, 10).await {
            Ok(events) if events.is_empty() => {
                // No events — wait briefly before polling again
                tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
            },
            Ok(events) => {
                for event in &events {
                    match process_event(&pool, event).await {
                        Ok(()) => {
                            if let Err(e) =
                                AdSyncQueueRepository::mark_completed(&pool, event.id).await
                            {
                                tracing::error!(
                                    event_id = %event.id,
                                    error = %e,
                                    "Failed to mark event completed"
                                );
                            }
                        },
                        Err(e) => {
                            tracing::warn!(
                                event_id = %event.id,
                                event_type = %event.event_type,
                                error = %e,
                                "Event processing failed — scheduling retry"
                            );
                            if let Err(e2) =
                                AdSyncQueueRepository::mark_retry(&pool, event.id, &e.to_string())
                                    .await
                            {
                                tracing::error!(
                                    event_id = %event.id,
                                    error = %e2,
                                    "Failed to mark event for retry"
                                );
                            }
                        },
                    }
                }
            },
            Err(e) => {
                tracing::error!(error = %e, "Failed to dequeue sync events");
                tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
            },
        }
    }
}

// ── OU handlers ───────────────────────────────────────────────────────────────

/// Handle OU creation from an org node INSERT event.
async fn handle_ou_create(pool: &PgPool, event: &AdSyncEvent) -> Result<()> {
    let node_id: Uuid = serde_json::from_value(event.payload["node_id"].clone())
        .map_err(|e| signapps_common::Error::Internal(format!("Bad payload node_id: {e}")))?;
    let name = event.payload["name"].as_str().unwrap_or("Unknown");
    let parent_id: Option<Uuid> = event.payload["parent_id"]
        .as_str()
        .and_then(|s| s.parse().ok());

    // Idempotent: skip if already created
    if AdOuRepository::find_by_node(pool, event.domain_id, node_id)
        .await?
        .is_some()
    {
        tracing::debug!(node_id = %node_id, "OU already exists — skipping");
        return Ok(());
    }

    let domain_dn = resolve_domain_dn(pool, event.domain_id).await?;

    let parent_ou = if let Some(pid) = parent_id {
        AdOuRepository::find_by_node(pool, event.domain_id, pid).await?
    } else {
        None
    };

    let dn = naming::build_ou_dn(
        name,
        parent_ou.as_ref().map(|p| p.distinguished_name.as_str()),
        &domain_dn,
    );

    AdOuRepository::create(pool, event.domain_id, node_id, &dn, parent_ou.map(|p| p.id)).await?;

    tracing::info!(dn = %dn, "OU created");
    Ok(())
}

/// Handle OU rename from an org node UPDATE event (name changed).
async fn handle_ou_rename(pool: &PgPool, event: &AdSyncEvent) -> Result<()> {
    let node_id: Uuid = serde_json::from_value(event.payload["node_id"].clone())
        .map_err(|e| signapps_common::Error::Internal(format!("Bad payload node_id: {e}")))?;
    let new_name = event.payload["new_name"].as_str().unwrap_or("Unknown");

    if let Some(ou) = AdOuRepository::find_by_node(pool, event.domain_id, node_id).await? {
        // Replace the leading OU=<old_name> component, keeping the rest of the DN
        let new_dn = if let Some(comma_pos) = ou.distinguished_name.find(',') {
            format!("OU={}{}", new_name, &ou.distinguished_name[comma_pos..])
        } else {
            format!("OU={}", new_name)
        };

        sqlx::query(
            "UPDATE ad_ous \
             SET distinguished_name = $1, last_synced_at = now() \
             WHERE id = $2",
        )
        .bind(&new_dn)
        .bind(ou.id)
        .execute(pool)
        .await
        .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

        tracing::info!(
            old_dn = %ou.distinguished_name,
            new_dn = %new_dn,
            "OU renamed"
        );
    }
    Ok(())
}

/// Handle OU move (reparent) from an org node UPDATE event (parent_id changed).
async fn handle_ou_move(pool: &PgPool, event: &AdSyncEvent) -> Result<()> {
    let node_id: Uuid = serde_json::from_value(event.payload["node_id"].clone())
        .map_err(|e| signapps_common::Error::Internal(format!("Bad payload node_id: {e}")))?;
    let new_parent: Option<Uuid> = event.payload["new_parent"]
        .as_str()
        .and_then(|s| s.parse().ok());

    let domain_dn = resolve_domain_dn(pool, event.domain_id).await?;

    if let Some(ou) = AdOuRepository::find_by_node(pool, event.domain_id, node_id).await? {
        // Extract the leaf name from the current DN
        let ou_name = ou
            .distinguished_name
            .split(',')
            .next()
            .unwrap_or("OU=Unknown");
        let name = ou_name.strip_prefix("OU=").unwrap_or(ou_name);

        let new_parent_ou = if let Some(np) = new_parent {
            AdOuRepository::find_by_node(pool, event.domain_id, np).await?
        } else {
            None
        };

        let new_dn = naming::build_ou_dn(
            name,
            new_parent_ou
                .as_ref()
                .map(|p| p.distinguished_name.as_str()),
            &domain_dn,
        );

        sqlx::query(
            "UPDATE ad_ous \
             SET distinguished_name = $1, parent_ou_id = $2, last_synced_at = now() \
             WHERE id = $3",
        )
        .bind(&new_dn)
        .bind(new_parent_ou.map(|p| p.id))
        .bind(ou.id)
        .execute(pool)
        .await
        .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

        tracing::info!(new_dn = %new_dn, "OU moved");
    }
    Ok(())
}

/// Handle OU deletion from an org node DELETE event.
async fn handle_ou_delete(pool: &PgPool, event: &AdSyncEvent) -> Result<()> {
    let node_id: Uuid = serde_json::from_value(event.payload["node_id"].clone())
        .map_err(|e| signapps_common::Error::Internal(format!("Bad payload node_id: {e}")))?;

    if let Some(ou) = AdOuRepository::find_by_node(pool, event.domain_id, node_id).await? {
        AdOuRepository::delete(pool, ou.id).await?;
        tracing::info!(dn = %ou.distinguished_name, "OU deleted");
    }
    Ok(())
}

// ── User handlers ─────────────────────────────────────────────────────────────

/// Handle user provisioning (create AD account + resolve mail).
async fn handle_user_provision(pool: &PgPool, event: &AdSyncEvent) -> Result<()> {
    let person_id: Uuid = serde_json::from_value(event.payload["person_id"].clone())
        .map_err(|e| signapps_common::Error::Internal(format!("Bad payload person_id: {e}")))?;
    let node_id: Uuid = serde_json::from_value(event.payload["node_id"].clone())
        .map_err(|e| signapps_common::Error::Internal(format!("Bad payload node_id: {e}")))?;

    // Idempotent: skip if already provisioned
    if AdUserAccountRepository::find_by_person(pool, event.domain_id, person_id)
        .await?
        .is_some()
    {
        tracing::debug!(person_id = %person_id, "User already provisioned — skipping");
        return Ok(());
    }

    // Load person data from core.persons
    let person: Option<(String, String, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT first_name, last_name, email, phone FROM core.persons WHERE id = $1",
    )
    .bind(person_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    let (first_name, last_name, _email, _phone) = person
        .ok_or_else(|| signapps_common::Error::NotFound(format!("Person {person_id} not found")))?;

    // Generate unique SAM account name
    let sam =
        naming::pick_available_sam(pool, event.domain_id, &first_name, &last_name, None).await?;

    // Build UPN and display name
    let domain_dn = resolve_domain_dn(pool, event.domain_id).await?;
    let realm = resolve_realm(pool, event.domain_id).await?;
    let upn = format!("{}@{}", sam, realm);
    let display_name = format!("{} {}", first_name, last_name);

    // Resolve the target OU
    let ou = AdOuRepository::find_by_node(pool, event.domain_id, node_id).await?;
    let dn = format!(
        "CN={},{}",
        display_name,
        ou.as_ref()
            .map(|o| o.distinguished_name.as_str())
            .unwrap_or(&domain_dn)
    );

    // Resolve primary mail domain via closure table inheritance
    let mail_info = mail_resolver::resolve_closest_mail_domain(pool, node_id).await?;
    let (mail, mail_domain_id) = if let Some((md_id, md_name)) = mail_info {
        (Some(format!("{}@{}", sam, md_name)), Some(md_id))
    } else {
        (None, None)
    };

    // Resolve job title from position node
    let title: Option<String> = sqlx::query_scalar(
        r#"SELECT n.name FROM core.org_nodes n
           JOIN core.assignments a ON a.node_id = n.id
           WHERE a.person_id = $1 AND n.node_type = 'position'
             AND (a.end_date IS NULL OR a.end_date > now())
           LIMIT 1"#,
    )
    .bind(person_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    // Resolve department from closest ancestor of type department/service
    let department: Option<String> = sqlx::query_scalar(
        r#"SELECT n.name FROM core.org_nodes n
           JOIN core.org_closure c ON c.ancestor_id = n.id
           WHERE c.descendant_id = $1
             AND n.node_type IN ('department', 'service')
           ORDER BY c.depth ASC LIMIT 1"#,
    )
    .bind(node_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    let user = AdUserAccountRepository::create(
        pool,
        event.domain_id,
        person_id,
        ou.map(|o| o.id),
        &sam,
        &upn,
        &dn,
        &display_name,
        title.as_deref(),
        department.as_deref(),
        mail.as_deref(),
        mail_domain_id,
    )
    .await?;

    tracing::info!(sam = %sam, dn = %dn, mail = ?mail, "User provisioned");

    // ── Phase 5: mail provisioning ─────────────────────────────────────────
    // Compute and persist mail aliases (default + sub-branch domains).
    if let Err(e) =
        mail_provisioner::compute_user_mail_aliases(pool, user.id, person_id, node_id, &sam).await
    {
        tracing::warn!(
            sam = %sam,
            error = %e,
            "Mail alias provisioning failed"
        );
    }

    // Compute and persist IMAP shared-folder subscriptions.
    if let Err(e) = mail_provisioner::compute_user_subscriptions(pool, user.id, node_id).await {
        tracing::warn!(
            sam = %sam,
            error = %e,
            "Shared mailbox subscription failed"
        );
    }

    Ok(())
}

/// Handle user disable from an assignment DELETE event.
async fn handle_user_disable(pool: &PgPool, event: &AdSyncEvent) -> Result<()> {
    let person_id: Uuid = serde_json::from_value(event.payload["person_id"].clone())
        .map_err(|e| signapps_common::Error::Internal(format!("Bad payload person_id: {e}")))?;

    if let Some(user) =
        AdUserAccountRepository::find_by_person(pool, event.domain_id, person_id).await?
    {
        AdUserAccountRepository::disable(pool, user.id).await?;
        tracing::info!(sam = %user.sam_account_name, "User disabled");
    }
    Ok(())
}

/// Handle user move (change OU) from an assignment UPDATE event (node_id changed).
async fn handle_user_move(pool: &PgPool, event: &AdSyncEvent) -> Result<()> {
    let person_id: Uuid = serde_json::from_value(event.payload["person_id"].clone())
        .map_err(|e| signapps_common::Error::Internal(format!("Bad payload person_id: {e}")))?;
    let new_node: Uuid = serde_json::from_value(event.payload["new_node"].clone())
        .map_err(|e| signapps_common::Error::Internal(format!("Bad payload new_node: {e}")))?;

    if let Some(user) =
        AdUserAccountRepository::find_by_person(pool, event.domain_id, person_id).await?
    {
        let new_ou = AdOuRepository::find_by_node(pool, event.domain_id, new_node).await?;
        let domain_dn = resolve_domain_dn(pool, event.domain_id).await?;

        let new_dn = format!(
            "CN={},{}",
            user.display_name,
            new_ou
                .as_ref()
                .map(|o| o.distinguished_name.as_str())
                .unwrap_or(&domain_dn)
        );

        sqlx::query(
            "UPDATE ad_user_accounts \
             SET ou_id = $1, distinguished_name = $2, updated_at = now() \
             WHERE id = $3",
        )
        .bind(new_ou.map(|o| o.id))
        .bind(&new_dn)
        .bind(user.id)
        .execute(pool)
        .await
        .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

        tracing::info!(sam = %user.sam_account_name, new_dn = %new_dn, "User moved");
    }
    Ok(())
}

/// Handle user attribute update (title/department change).
async fn handle_user_update(pool: &PgPool, event: &AdSyncEvent) -> Result<()> {
    let person_id: Uuid = serde_json::from_value(event.payload["person_id"].clone())
        .map_err(|e| signapps_common::Error::Internal(format!("Bad payload person_id: {e}")))?;

    if let Some(user) =
        AdUserAccountRepository::find_by_person(pool, event.domain_id, person_id).await?
    {
        let title = event.payload["title"].as_str();
        let department = event.payload["department"].as_str();

        sqlx::query(
            "UPDATE ad_user_accounts \
             SET title = COALESCE($1, title), \
                 department = COALESCE($2, department), \
                 updated_at = now() \
             WHERE id = $3",
        )
        .bind(title)
        .bind(department)
        .bind(user.id)
        .execute(pool)
        .await
        .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

        tracing::info!(sam = %user.sam_account_name, "User attributes updated");
    }
    Ok(())
}

// ── Group handlers ────────────────────────────────────────────────────────────

/// Handle security group creation from an org_group, team, or position event.
///
/// SAM name conventions:
/// - `org_group` or `team` → `GS-{name}`
/// - `position`            → `GR-Position-{name}`
///
/// Creates the `ad_security_groups` row and populates initial members in
/// `ad_group_members` for every user account that is already provisioned.
#[tracing::instrument(skip(pool, event), fields(event_id = %event.id))]
async fn handle_group_create(pool: &PgPool, event: &AdSyncEvent) -> Result<()> {
    let source_type = event.payload["source_type"].as_str().unwrap_or("org_group");
    let source_id: Uuid = serde_json::from_value(event.payload["source_id"].clone())
        .map_err(|e| signapps_common::Error::Internal(format!("Bad payload source_id: {e}")))?;
    let name = event.payload["name"].as_str().unwrap_or("Unknown");

    // Idempotent: skip if already created
    let existing: Option<(Uuid,)> = sqlx::query_as(
        "SELECT id FROM ad_security_groups \
         WHERE domain_id = $1 AND source_type = $2 AND source_id = $3",
    )
    .bind(event.domain_id)
    .bind(source_type)
    .bind(source_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    if existing.is_some() {
        tracing::debug!(source_id = %source_id, "Security group already exists — skipping");
        return Ok(());
    }

    let sam = if source_type == "position" {
        format!("GR-Position-{}", &name[..name.len().min(32)])
    } else {
        format!("GS-{}", &name[..name.len().min(35)])
    };

    let domain_dn = resolve_domain_dn(pool, event.domain_id).await?;
    let dn = format!("CN={sam},CN=Users,{domain_dn}");
    let display_name = name;

    let (group_id,): (Uuid,) = sqlx::query_as(
        r#"INSERT INTO ad_security_groups
           (domain_id, source_type, source_id, sam_account_name, distinguished_name,
            display_name, group_scope, group_type, sync_status)
           VALUES ($1, $2, $3, $4, $5, $6, 'global', 'security', 'synced')
           RETURNING id"#,
    )
    .bind(event.domain_id)
    .bind(source_type)
    .bind(source_id)
    .bind(&sam)
    .bind(&dn)
    .bind(display_name)
    .fetch_one(pool)
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    // Seed initial members — query depends on source type
    let member_person_ids: Vec<(Uuid,)> = match source_type {
        "org_group" => sqlx::query_as(
            r#"SELECT m.person_id FROM workforce_org_memberof m
               WHERE m.group_id = $1"#,
        )
        .bind(source_id)
        .fetch_all(pool)
        .await
        .map_err(|e| signapps_common::Error::Database(e.to_string()))?,
        "team" | "position" => sqlx::query_as(
            r#"SELECT a.person_id FROM core.assignments a
               WHERE a.node_id = $1
                 AND (a.end_date IS NULL OR a.end_date > now())"#,
        )
        .bind(source_id)
        .fetch_all(pool)
        .await
        .map_err(|e| signapps_common::Error::Database(e.to_string()))?,
        _ => vec![],
    };

    for (person_id,) in &member_person_ids {
        // Resolve the AD user account for this person
        let user_account: Option<(Uuid,)> = sqlx::query_as(
            "SELECT id FROM ad_user_accounts \
             WHERE domain_id = $1 AND person_id = $2 AND is_enabled = true",
        )
        .bind(event.domain_id)
        .bind(person_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

        if let Some((user_id,)) = user_account {
            sqlx::query(
                r#"INSERT INTO ad_group_members (group_id, member_type, member_id, sync_status)
                   VALUES ($1, 'user', $2, 'synced')
                   ON CONFLICT (group_id, member_type, member_id) DO NOTHING"#,
            )
            .bind(group_id)
            .bind(user_id)
            .execute(pool)
            .await
            .map_err(|e| signapps_common::Error::Database(e.to_string()))?;
        }
    }

    tracing::info!(
        sam = %sam,
        dn = %dn,
        member_count = member_person_ids.len(),
        "Security group created"
    );
    Ok(())
}

/// Handle security group member sync from a membership change event.
///
/// Queries the authoritative membership source, then adds missing members and
/// removes stale ones from `ad_group_members`.
#[tracing::instrument(skip(pool, event), fields(event_id = %event.id))]
async fn handle_group_sync(pool: &PgPool, event: &AdSyncEvent) -> Result<()> {
    let source_id: Uuid = serde_json::from_value(event.payload["source_id"].clone())
        .map_err(|e| signapps_common::Error::Internal(format!("Bad payload source_id: {e}")))?;

    // Locate the AD group record
    let group: Option<(Uuid, String)> = sqlx::query_as(
        "SELECT id, source_type FROM ad_security_groups \
         WHERE domain_id = $1 AND source_id = $2",
    )
    .bind(event.domain_id)
    .bind(source_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    let (group_id, source_type) = match group {
        Some(g) => g,
        None => {
            tracing::warn!(source_id = %source_id, "No AD group found for source — skipping sync");
            return Ok(());
        },
    };

    // Resolve expected members (as AD user account UUIDs)
    let expected_user_ids: Vec<Uuid> = match source_type.as_str() {
        "org_group" => sqlx::query_scalar(
            r#"SELECT u.id FROM ad_user_accounts u
               JOIN workforce_org_memberof m ON m.person_id = u.person_id
               WHERE m.group_id = $1
                 AND u.domain_id = $2
                 AND u.is_enabled = true"#,
        )
        .bind(source_id)
        .bind(event.domain_id)
        .fetch_all(pool)
        .await
        .map_err(|e| signapps_common::Error::Database(e.to_string()))?,
        "team" | "position" => sqlx::query_scalar(
            r#"SELECT u.id FROM ad_user_accounts u
               JOIN core.assignments a ON a.person_id = u.person_id
               WHERE a.node_id = $1
                 AND u.domain_id = $2
                 AND u.is_enabled = true
                 AND (a.end_date IS NULL OR a.end_date > now())"#,
        )
        .bind(source_id)
        .bind(event.domain_id)
        .fetch_all(pool)
        .await
        .map_err(|e| signapps_common::Error::Database(e.to_string()))?,
        _ => vec![],
    };

    // Resolve actual members currently in ad_group_members
    let actual_user_ids: Vec<Uuid> = sqlx::query_scalar(
        "SELECT member_id FROM ad_group_members \
         WHERE group_id = $1 AND member_type = 'user'",
    )
    .bind(group_id)
    .fetch_all(pool)
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    use std::collections::HashSet;
    let expected: HashSet<Uuid> = expected_user_ids.into_iter().collect();
    let actual: HashSet<Uuid> = actual_user_ids.into_iter().collect();

    // Add missing members
    let to_add: Vec<Uuid> = expected.difference(&actual).copied().collect();
    for user_id in &to_add {
        sqlx::query(
            r#"INSERT INTO ad_group_members (group_id, member_type, member_id, sync_status)
               VALUES ($1, 'user', $2, 'synced')
               ON CONFLICT (group_id, member_type, member_id) DO NOTHING"#,
        )
        .bind(group_id)
        .bind(user_id)
        .execute(pool)
        .await
        .map_err(|e| signapps_common::Error::Database(e.to_string()))?;
    }

    // Remove stale members
    let to_remove: Vec<Uuid> = actual.difference(&expected).copied().collect();
    for user_id in &to_remove {
        sqlx::query(
            "DELETE FROM ad_group_members \
             WHERE group_id = $1 AND member_type = 'user' AND member_id = $2",
        )
        .bind(group_id)
        .bind(user_id)
        .execute(pool)
        .await
        .map_err(|e| signapps_common::Error::Database(e.to_string()))?;
    }

    // Mark group as synced
    sqlx::query(
        "UPDATE ad_security_groups \
         SET sync_status = 'synced', last_synced_at = now() \
         WHERE id = $1",
    )
    .bind(group_id)
    .execute(pool)
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    tracing::info!(
        group_id = %group_id,
        added = to_add.len(),
        removed = to_remove.len(),
        "Security group synced"
    );
    Ok(())
}

/// Handle security group deletion from an org group/team/position delete event.
///
/// Deletes the `ad_security_groups` row; `ad_group_members` rows are removed
/// by the ON DELETE CASCADE foreign key.
#[tracing::instrument(skip(pool, event), fields(event_id = %event.id))]
async fn handle_group_delete(pool: &PgPool, event: &AdSyncEvent) -> Result<()> {
    let source_id: Uuid = serde_json::from_value(event.payload["source_id"].clone())
        .map_err(|e| signapps_common::Error::Internal(format!("Bad payload source_id: {e}")))?;

    let deleted = sqlx::query_scalar::<_, Option<String>>(
        "DELETE FROM ad_security_groups \
         WHERE domain_id = $1 AND source_id = $2 \
         RETURNING sam_account_name",
    )
    .bind(event.domain_id)
    .bind(source_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    if let Some(Some(sam)) = deleted {
        tracing::info!(sam = %sam, "Security group deleted (cascade to members)");
    }
    Ok(())
}

// ── Computer handlers ─────────────────────────────────────────────────────────

/// Handle computer account creation from an IT hardware or manual event.
///
/// All computers are placed in `OU=Computers,{domain_dn}` per spec.
/// SAM name: `{hostname}$`.
///
/// Looks up the `it.hardware` table first (if the table exists), otherwise
/// falls back to the `hostname` field in the event payload.
#[tracing::instrument(skip(pool, event), fields(event_id = %event.id))]
async fn handle_computer_create(pool: &PgPool, event: &AdSyncEvent) -> Result<()> {
    let hostname = event.payload["hostname"]
        .as_str()
        .unwrap_or("UNKNOWN")
        .to_uppercase();

    let hardware_id: Option<Uuid> = event.payload["hardware_id"]
        .as_str()
        .and_then(|s| s.parse().ok());

    // Idempotent check
    let sam = format!("{hostname}$");
    let existing: Option<(Uuid,)> = sqlx::query_as(
        "SELECT id FROM ad_computer_accounts \
         WHERE domain_id = $1 AND sam_account_name = $2",
    )
    .bind(event.domain_id)
    .bind(&sam)
    .fetch_optional(pool)
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    if existing.is_some() {
        tracing::debug!(hostname = %hostname, "Computer account already exists — skipping");
        return Ok(());
    }

    // Try to enrich from it.hardware if a hardware_id was provided
    let (dns_hostname, os_name, os_version): (Option<String>, Option<String>, Option<String>) =
        if let Some(hw_id) = hardware_id {
            sqlx::query_as("SELECT hostname, os_name, os_version FROM it.hardware WHERE id = $1")
                .bind(hw_id)
                .fetch_optional(pool)
                .await
                .map_err(|e| signapps_common::Error::Database(e.to_string()))?
                .map(|(h, o, ov): (Option<String>, Option<String>, Option<String>)| (h, o, ov))
                .unwrap_or((None, None, None))
        } else {
            (Some(hostname.to_lowercase()), None, None)
        };

    let domain_dn = resolve_domain_dn(pool, event.domain_id).await?;
    let dn = format!("CN={hostname},OU=Computers,{domain_dn}");

    sqlx::query(
        r#"INSERT INTO ad_computer_accounts
           (domain_id, hardware_id, sam_account_name, distinguished_name,
            dns_hostname, os_name, os_version, is_enabled, sync_status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, true, 'synced')"#,
    )
    .bind(event.domain_id)
    .bind(hardware_id)
    .bind(&sam)
    .bind(&dn)
    .bind(&dns_hostname)
    .bind(&os_name)
    .bind(&os_version)
    .execute(pool)
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    tracing::info!(sam = %sam, dn = %dn, "Computer account created");
    Ok(())
}

/// Handle computer account disable from a hardware removal or reassignment event.
#[tracing::instrument(skip(pool, event), fields(event_id = %event.id))]
async fn handle_computer_disable(pool: &PgPool, event: &AdSyncEvent) -> Result<()> {
    // Payload may carry hostname or hardware_id
    let hostname = event.payload["hostname"].as_str().map(|h| h.to_uppercase());
    let hardware_id: Option<Uuid> = event.payload["hardware_id"]
        .as_str()
        .and_then(|s| s.parse().ok());

    let id: Option<Uuid> = if let Some(hw_id) = hardware_id {
        sqlx::query_scalar(
            "SELECT id FROM ad_computer_accounts \
             WHERE domain_id = $1 AND hardware_id = $2",
        )
        .bind(event.domain_id)
        .bind(hw_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| signapps_common::Error::Database(e.to_string()))?
    } else if let Some(ref h) = hostname {
        let sam = format!("{h}$");
        sqlx::query_scalar(
            "SELECT id FROM ad_computer_accounts \
             WHERE domain_id = $1 AND sam_account_name = $2",
        )
        .bind(event.domain_id)
        .bind(&sam)
        .fetch_optional(pool)
        .await
        .map_err(|e| signapps_common::Error::Database(e.to_string()))?
    } else {
        tracing::warn!("computer_disable event has no hostname or hardware_id — skipping");
        return Ok(());
    };

    if let Some(computer_id) = id {
        sqlx::query(
            "UPDATE ad_computer_accounts \
             SET is_enabled = false, sync_status = 'disabled', last_synced_at = now() \
             WHERE id = $1",
        )
        .bind(computer_id)
        .execute(pool)
        .await
        .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

        tracing::info!(computer_id = %computer_id, "Computer account disabled");
    }
    Ok(())
}

// ── Mail domain bind handler ──────────────────────────────────────────────────

/// Handle `mail_domain_bind` — recalculate mail aliases and shared mailbox
/// addresses for every user in the affected subtree.
///
/// Payload keys:
/// - `node_id` (UUID) — the org node to which the mail domain was bound.
/// - `domain_id` (UUID) — the `infrastructure.domains.id` that was bound.
/// - `dns_name` (string) — the DNS name of the bound domain.
///
/// The handler:
/// 1. Walks every enabled user account whose assignment node is at or below
///    `node_id` (using the closure table).
/// 2. Re-runs [`mail_provisioner::compute_user_mail_aliases`] for each.
/// 3. For every OU in the same subtree that has a matching `ad_ous` row, calls
///    [`mail_provisioner::provision_ou_shared_mailbox`] to create/update the
///    shared mailbox entry.
///
/// Errors during individual user/OU provisioning are warned and skipped so that
/// one bad row does not abort the entire batch.
#[tracing::instrument(skip(pool, event), fields(event_id = %event.id))]
async fn handle_mail_domain_bind(pool: &PgPool, event: &AdSyncEvent) -> Result<()> {
    let node_id: Uuid = serde_json::from_value(event.payload["node_id"].clone())
        .map_err(|e| signapps_common::Error::Internal(format!("Bad payload node_id: {e}")))?;
    let domain_id: Uuid = serde_json::from_value(event.payload["domain_id"].clone())
        .map_err(|e| signapps_common::Error::Internal(format!("Bad payload domain_id: {e}")))?;
    let dns_name = event.payload["dns_name"]
        .as_str()
        .unwrap_or_default()
        .to_string();

    // ── 1. Re-provision mail aliases for all users in the subtree ─────────
    // Find all enabled user accounts whose assigned node is at or below node_id.
    let users: Vec<(Uuid, Uuid, String)> = sqlx::query_as(
        r#"SELECT ua.id, ua.person_id, ua.sam_account_name
           FROM ad_user_accounts ua
           JOIN core.assignments a ON a.person_id = ua.person_id
           JOIN core.org_closure c ON c.descendant_id = a.node_id
               AND c.ancestor_id = $1
           WHERE ua.domain_id = $2
             AND ua.is_enabled = true
             AND (a.end_date IS NULL OR a.end_date > now())"#,
    )
    .bind(node_id)
    .bind(event.domain_id)
    .fetch_all(pool)
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    let user_count = users.len();
    for (user_account_id, person_id, sam) in users {
        // Resolve the user's current assignment node.
        let user_node: Option<Uuid> = sqlx::query_scalar(
            r#"SELECT a.node_id
               FROM core.assignments a
               JOIN ad_user_accounts ua ON ua.person_id = a.person_id
               WHERE ua.id = $1
                 AND (a.end_date IS NULL OR a.end_date > now())
               LIMIT 1"#,
        )
        .bind(user_account_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

        let Some(user_node_id) = user_node else {
            continue;
        };

        if let Err(e) = mail_provisioner::compute_user_mail_aliases(
            pool,
            user_account_id,
            person_id,
            user_node_id,
            &sam,
        )
        .await
        {
            tracing::warn!(
                sam = %sam,
                error = %e,
                "mail_domain_bind: alias re-provisioning failed for user"
            );
        }
    }

    // ── 2. Provision/update shared mailboxes for OUs in the subtree ───────
    let ous: Vec<(Uuid, String)> = sqlx::query_as(
        r#"SELECT ao.id, n.name
           FROM ad_ous ao
           JOIN core.org_nodes n ON n.id = ao.node_id
           JOIN core.org_closure c ON c.descendant_id = ao.node_id
               AND c.ancestor_id = $1
           WHERE ao.domain_id = $2"#,
    )
    .bind(node_id)
    .bind(event.domain_id)
    .fetch_all(pool)
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    let ou_count = ous.len();
    for (ou_id, ou_name) in ous {
        if let Err(e) = mail_provisioner::provision_ou_shared_mailbox(
            pool, ou_id, &ou_name, domain_id, &dns_name,
        )
        .await
        {
            tracing::warn!(
                ou_id = %ou_id,
                error = %e,
                "mail_domain_bind: shared mailbox provisioning failed for OU"
            );
        }
    }

    tracing::info!(
        node_id = %node_id,
        users_processed = user_count,
        ous_processed = ou_count,
        "mail_domain_bind processed"
    );
    Ok(())
}

// ── Private helpers ───────────────────────────────────────────────────────────

/// Resolve the DC-style Distinguished Name for a domain (e.g. `DC=corp,DC=local`).
async fn resolve_domain_dn(pool: &PgPool, domain_id: Uuid) -> Result<String> {
    let dns_name: Option<String> =
        sqlx::query_scalar("SELECT dns_name FROM infrastructure.domains WHERE id = $1")
            .bind(domain_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    let dns =
        dns_name.ok_or_else(|| signapps_common::Error::NotFound("Domain not found".into()))?;
    Ok(naming::domain_to_dn(&dns))
}

/// Resolve the Kerberos realm for a domain (defaults to uppercased DNS name).
async fn resolve_realm(pool: &PgPool, domain_id: Uuid) -> Result<String> {
    let realm: Option<String> = sqlx::query_scalar(
        "SELECT COALESCE(realm, UPPER(dns_name)) FROM infrastructure.domains WHERE id = $1",
    )
    .bind(domain_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    realm.ok_or_else(|| signapps_common::Error::NotFound("Domain not found".into()))
}

#[cfg(test)]
mod tests {
    /// Compilation smoke test.
    #[test]
    fn sync_worker_module_compiles() {
        // Real integration tests require a live PostgreSQL instance.
        // Covered by the DC integration test suite.
        let _ = module_path!();
    }
}
