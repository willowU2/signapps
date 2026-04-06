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

use signapps_common::Result;
use signapps_db::models::ad_sync::AdSyncEvent;
use signapps_db::repositories::{AdOuRepository, AdSyncQueueRepository, AdUserAccountRepository};
use sqlx::PgPool;
use uuid::Uuid;

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
        "group_create" | "group_sync" | "group_delete" => {
            tracing::info!("Group event — not yet implemented");
            Ok(())
        }
        "computer_create" | "computer_disable" => {
            tracing::info!("Computer event — not yet implemented");
            Ok(())
        }
        "mail_domain_bind" => {
            tracing::info!("Mail domain bind — not yet implemented");
            Ok(())
        }
        _ => {
            tracing::warn!(event_type = %event.event_type, "Unknown event type — skipping");
            Ok(())
        }
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
            }
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
                        }
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
                        }
                    }
                }
            }
            Err(e) => {
                tracing::error!(error = %e, "Failed to dequeue sync events");
                tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
            }
        }
    }
}

// ── OU handlers ───────────────────────────────────────────────────────────────

/// Handle OU creation from an org node INSERT event.
async fn handle_ou_create(pool: &PgPool, event: &AdSyncEvent) -> Result<()> {
    let node_id: Uuid = serde_json::from_value(event.payload["node_id"].clone())
        .map_err(|e| signapps_common::Error::Internal(format!("Bad payload node_id: {e}")))?;
    let name = event.payload["name"].as_str().unwrap_or("Unknown");
    let parent_id: Option<Uuid> =
        event.payload["parent_id"].as_str().and_then(|s| s.parse().ok());

    // Idempotent: skip if already created
    if AdOuRepository::find_by_node(pool, event.domain_id, node_id).await?.is_some() {
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
    let new_parent: Option<Uuid> =
        event.payload["new_parent"].as_str().and_then(|s| s.parse().ok());

    let domain_dn = resolve_domain_dn(pool, event.domain_id).await?;

    if let Some(ou) = AdOuRepository::find_by_node(pool, event.domain_id, node_id).await? {
        // Extract the leaf name from the current DN
        let ou_name = ou.distinguished_name.split(',').next().unwrap_or("OU=Unknown");
        let name = ou_name.strip_prefix("OU=").unwrap_or(ou_name);

        let new_parent_ou = if let Some(np) = new_parent {
            AdOuRepository::find_by_node(pool, event.domain_id, np).await?
        } else {
            None
        };

        let new_dn = naming::build_ou_dn(
            name,
            new_parent_ou.as_ref().map(|p| p.distinguished_name.as_str()),
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

    let (first_name, last_name, _email, _phone) = person.ok_or_else(|| {
        signapps_common::Error::NotFound(format!("Person {person_id} not found"))
    })?;

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
        ou.as_ref().map(|o| o.distinguished_name.as_str()).unwrap_or(&domain_dn)
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

    AdUserAccountRepository::create(
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
            new_ou.as_ref().map(|o| o.distinguished_name.as_str()).unwrap_or(&domain_dn)
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
        assert!(true);
    }
}
