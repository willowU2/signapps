// crates/signapps-ad-core/src/reconciliation.rs
//! Periodic org→AD reconciliation.
//!
//! The reconciliation loop compares the authoritative org-structure tables against
//! the cached AD snapshot tables (`ad_ous`, `ad_user_accounts`, `ad_security_groups`,
//! `ad_computer_accounts`) and enqueues corrective events for any drift that is
//! detected.
//!
//! Triggered every 15 minutes by [`services/signapps-dc`] via `tokio::time::interval`.
//! Can also be triggered on-demand through the workforce API.
//!
//! # Algorithm
//!
//! For each active AD domain:
//! 1. **OUs** — compare `core.org_nodes` (internal tree) against `ad_ous`.
//! 2. **Users** — compare active `core.assignments + core.persons` against `ad_user_accounts`.
//! 3. **Groups** — compare `workforce_org_groups + core.org_nodes (team/position)` against
//!    `ad_security_groups`.
//! 4. **Computers** — compare `it.hardware` (if the table exists) against `ad_computer_accounts`.
//!
//! Missing objects receive a low-priority (10) create event.
//! Orphaned AD objects are marked with `sync_status = 'orphan'`.
//!
//! # Examples
//!
//! ```rust,no_run
//! # async fn example() -> signapps_common::Result<()> {
//! use signapps_ad_core::reconciliation::reconcile;
//! # let pool: sqlx::PgPool = unimplemented!();
//! let report = reconcile(&pool).await?;
//! println!("OUs created: {}", report.ous_created);
//! # Ok(())
//! # }
//! ```

use serde::{Deserialize, Serialize};
use signapps_common::Result;
use sqlx::PgPool;
use uuid::Uuid;

use signapps_db::repositories::AdSyncQueueRepository;

// ── Report ─────────────────────────────────────────────────────────────────────

/// Summary of a single reconciliation run across all active domains.
///
/// All counts are cumulative across every domain processed during the run.
#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct ReconciliationReport {
    /// Number of OU create events enqueued (missing from AD).
    pub ous_created: u32,
    /// Number of AD OUs marked orphan (no longer in org-structure).
    pub ous_orphaned: u32,
    /// Number of user provision events enqueued (missing from AD).
    pub users_created: u32,
    /// Number of user disable events enqueued (no active assignment).
    pub users_disabled: u32,
    /// Number of group sync events enqueued (membership drift).
    pub groups_synced: u32,
    /// Number of computer create events enqueued (missing from AD).
    pub computers_created: u32,
}

// ── Entry point ───────────────────────────────────────────────────────────────

/// Run a full reconciliation pass over all active AD domains.
///
/// Iterates every active domain, running four sub-passes (OUs, users, groups,
/// computers) in sequence. Corrective events are enqueued at priority 10 (low)
/// so that real-time events are processed first.
///
/// # Errors
///
/// Returns `Error::Database` if any required query fails. Errors in optional
/// tables (e.g. `it.hardware` not existing) are handled gracefully.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[tracing::instrument(skip(pool))]
pub async fn reconcile(pool: &PgPool) -> Result<ReconciliationReport> {
    let mut report = ReconciliationReport::default();

    let domain_ids = get_active_ad_domains(pool).await?;
    tracing::info!(domain_count = domain_ids.len(), "Reconciliation started");

    for domain_id in domain_ids {
        reconcile_ous(pool, domain_id, &mut report).await?;
        reconcile_users(pool, domain_id, &mut report).await?;
        reconcile_groups(pool, domain_id, &mut report).await?;
        reconcile_computers(pool, domain_id, &mut report).await?;
    }

    tracing::info!(?report, "Reconciliation completed");
    Ok(report)
}

// ── Domain query ──────────────────────────────────────────────────────────────

/// Return the IDs of all currently active AD domains.
async fn get_active_ad_domains(pool: &PgPool) -> Result<Vec<Uuid>> {
    let ids: Vec<(Uuid,)> = sqlx::query_as(
        "SELECT id FROM infrastructure.domains WHERE is_active = true",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    Ok(ids.into_iter().map(|(id,)| id).collect())
}

// ── OU reconciliation ─────────────────────────────────────────────────────────

/// Reconcile org_nodes (internal tree) against `ad_ous` for one domain.
///
/// Missing OUs → enqueue `ou_create` at priority 10.
/// Orphaned AD OUs → mark `sync_status = 'orphan'`.
#[tracing::instrument(skip(pool, report), fields(domain_id = %domain_id))]
async fn reconcile_ous(
    pool: &PgPool,
    domain_id: Uuid,
    report: &mut ReconciliationReport,
) -> Result<()> {
    // Expected: org_nodes with node_type in group..service belonging to the internal tree
    let expected: Vec<(Uuid, String, Option<Uuid>)> = sqlx::query_as(
        r#"SELECT n.id, n.name, n.parent_id
           FROM core.org_nodes n
           WHERE n.tree_type = 'internal'
             AND n.node_type IN ('group', 'subsidiary', 'bu', 'department', 'service', 'team')"#,
    )
    .fetch_all(pool)
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    // Actual: ad_ous for this domain
    let actual: Vec<(Uuid,)> = sqlx::query_as(
        "SELECT node_id FROM ad_ous WHERE domain_id = $1 AND sync_status != 'orphan'",
    )
    .bind(domain_id)
    .fetch_all(pool)
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    use std::collections::HashSet;
    let expected_ids: HashSet<Uuid> = expected.iter().map(|(id, _, _)| *id).collect();
    let actual_ids: HashSet<Uuid> = actual.into_iter().map(|(id,)| id).collect();

    // Enqueue create for missing OUs
    for (node_id, name, parent_id) in &expected {
        if !actual_ids.contains(node_id) {
            let payload = serde_json::json!({
                "node_id": node_id,
                "name": name,
                "parent_id": parent_id,
            });
            AdSyncQueueRepository::enqueue(pool, domain_id, "ou_create", payload, 10).await?;
            report.ous_created += 1;
        }
    }

    // Mark orphans
    for actual_node_id in &actual_ids {
        if !expected_ids.contains(actual_node_id) {
            sqlx::query(
                "UPDATE ad_ous SET sync_status = 'orphan' \
                 WHERE domain_id = $1 AND node_id = $2",
            )
            .bind(domain_id)
            .bind(actual_node_id)
            .execute(pool)
            .await
            .map_err(|e| signapps_common::Error::Database(e.to_string()))?;
            report.ous_orphaned += 1;
        }
    }

    Ok(())
}

// ── User reconciliation ───────────────────────────────────────────────────────

/// Reconcile active assignments against `ad_user_accounts` for one domain.
///
/// Missing users → enqueue `user_provision` at priority 10.
/// Orphaned enabled AD accounts → enqueue `user_disable` at priority 10.
#[tracing::instrument(skip(pool, report), fields(domain_id = %domain_id))]
async fn reconcile_users(
    pool: &PgPool,
    domain_id: Uuid,
    report: &mut ReconciliationReport,
) -> Result<()> {
    // Expected: persons with at least one active assignment
    let expected: Vec<(Uuid, Uuid)> = sqlx::query_as(
        r#"SELECT DISTINCT a.person_id, a.node_id
           FROM core.assignments a
           WHERE (a.end_date IS NULL OR a.end_date > now())
           ORDER BY a.person_id"#,
    )
    .fetch_all(pool)
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    // Actual: enabled AD user accounts for this domain
    let actual: Vec<(Uuid,)> = sqlx::query_as(
        "SELECT person_id FROM ad_user_accounts \
         WHERE domain_id = $1 AND is_enabled = true",
    )
    .bind(domain_id)
    .fetch_all(pool)
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    use std::collections::{HashMap, HashSet};
    // Use first assignment per person for the create payload
    let mut expected_map: HashMap<Uuid, Uuid> = HashMap::new();
    for (person_id, node_id) in &expected {
        expected_map.entry(*person_id).or_insert(*node_id);
    }

    let actual_ids: HashSet<Uuid> = actual.into_iter().map(|(id,)| id).collect();

    // Enqueue provision for missing users
    for (person_id, node_id) in &expected_map {
        if !actual_ids.contains(person_id) {
            let payload = serde_json::json!({
                "person_id": person_id,
                "node_id": node_id,
            });
            AdSyncQueueRepository::enqueue(pool, domain_id, "user_provision", payload, 10)
                .await?;
            report.users_created += 1;
        }
    }

    // Enqueue disable for orphaned enabled accounts
    let expected_ids: HashSet<Uuid> = expected_map.keys().copied().collect();
    for actual_person_id in &actual_ids {
        if !expected_ids.contains(actual_person_id) {
            let payload = serde_json::json!({ "person_id": actual_person_id });
            AdSyncQueueRepository::enqueue(pool, domain_id, "user_disable", payload, 10).await?;
            report.users_disabled += 1;
        }
    }

    Ok(())
}

// ── Group reconciliation ──────────────────────────────────────────────────────

/// Reconcile workforce groups and team/position nodes against `ad_security_groups`.
///
/// Missing groups → enqueue `group_create` at priority 10.
/// Existing groups → enqueue `group_sync` at priority 10 (membership may have drifted).
/// Orphaned AD groups → mark `sync_status = 'orphan'`.
#[tracing::instrument(skip(pool, report), fields(domain_id = %domain_id))]
async fn reconcile_groups(
    pool: &PgPool,
    domain_id: Uuid,
    report: &mut ReconciliationReport,
) -> Result<()> {
    // Expected org_groups (transversal groups)
    let org_groups: Vec<(Uuid, String)> = sqlx::query_as(
        "SELECT id, name FROM workforce_org_groups",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    // Expected teams and positions from org_nodes
    let team_positions: Vec<(Uuid, String, String)> = sqlx::query_as(
        r#"SELECT id, name, node_type FROM core.org_nodes
           WHERE node_type IN ('team', 'position')
             AND tree_type = 'internal'"#,
    )
    .fetch_all(pool)
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    // Actual: all ad_security_groups for this domain (non-orphan)
    let actual: Vec<(Uuid, String)> = sqlx::query_as(
        "SELECT source_id, source_type FROM ad_security_groups \
         WHERE domain_id = $1 AND sync_status != 'orphan'",
    )
    .bind(domain_id)
    .fetch_all(pool)
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    use std::collections::{HashMap, HashSet};
    let actual_map: HashMap<Uuid, String> = actual.into_iter().collect();

    // Process org_groups
    for (group_id, name) in &org_groups {
        if !actual_map.contains_key(group_id) {
            let payload = serde_json::json!({
                "source_type": "org_group",
                "source_id": group_id,
                "name": name,
            });
            AdSyncQueueRepository::enqueue(pool, domain_id, "group_create", payload, 10).await?;
        } else {
            let payload = serde_json::json!({ "source_id": group_id });
            AdSyncQueueRepository::enqueue(pool, domain_id, "group_sync", payload, 10).await?;
            report.groups_synced += 1;
        }
    }

    // Process teams and positions
    for (node_id, name, node_type) in &team_positions {
        let source_type = node_type.as_str(); // "team" or "position"
        if !actual_map.contains_key(node_id) {
            let payload = serde_json::json!({
                "source_type": source_type,
                "source_id": node_id,
                "name": name,
            });
            AdSyncQueueRepository::enqueue(pool, domain_id, "group_create", payload, 10).await?;
        } else {
            let payload = serde_json::json!({ "source_id": node_id });
            AdSyncQueueRepository::enqueue(pool, domain_id, "group_sync", payload, 10).await?;
            report.groups_synced += 1;
        }
    }

    // Collect all expected source IDs
    let mut expected_ids: HashSet<Uuid> = org_groups.iter().map(|(id, _)| *id).collect();
    expected_ids.extend(team_positions.iter().map(|(id, _, _)| *id));

    // Mark orphans
    for (source_id, _) in actual_map.iter() {
        if !expected_ids.contains(source_id) {
            sqlx::query(
                "UPDATE ad_security_groups SET sync_status = 'orphan' \
                 WHERE domain_id = $1 AND source_id = $2",
            )
            .bind(domain_id)
            .bind(source_id)
            .execute(pool)
            .await
            .map_err(|e| signapps_common::Error::Database(e.to_string()))?;
        }
    }

    Ok(())
}

// ── Computer reconciliation ───────────────────────────────────────────────────

/// Reconcile `it.hardware` against `ad_computer_accounts` for one domain.
///
/// If the `it.hardware` table does not exist the pass is skipped silently.
/// Missing computers → enqueue `computer_create` at priority 10.
#[tracing::instrument(skip(pool, report), fields(domain_id = %domain_id))]
async fn reconcile_computers(
    pool: &PgPool,
    domain_id: Uuid,
    report: &mut ReconciliationReport,
) -> Result<()> {
    // Check whether the it.hardware table exists before querying it
    let table_exists: bool = sqlx::query_scalar(
        r#"SELECT EXISTS (
               SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'it' AND table_name = 'hardware'
           )"#,
    )
    .fetch_one(pool)
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    if !table_exists {
        tracing::debug!("it.hardware table not present — skipping computer reconciliation");
        return Ok(());
    }

    // Expected: all hardware records with a non-null hostname
    let expected: Vec<(Uuid, String)> =
        sqlx::query_as("SELECT id, hostname FROM it.hardware WHERE hostname IS NOT NULL")
            .fetch_all(pool)
            .await
            .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    // Actual: AD computer accounts for this domain (enabled or disabled)
    let actual: Vec<(Option<Uuid>,)> = sqlx::query_as(
        "SELECT hardware_id FROM ad_computer_accounts WHERE domain_id = $1",
    )
    .bind(domain_id)
    .fetch_all(pool)
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    use std::collections::HashSet;
    let actual_hw_ids: HashSet<Uuid> =
        actual.into_iter().filter_map(|(id,)| id).collect();

    for (hw_id, hostname) in &expected {
        if !actual_hw_ids.contains(hw_id) {
            let payload = serde_json::json!({
                "hardware_id": hw_id,
                "hostname": hostname,
            });
            AdSyncQueueRepository::enqueue(pool, domain_id, "computer_create", payload, 10)
                .await?;
            report.computers_created += 1;
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::ReconciliationReport;

    /// `ReconciliationReport` derives `Default` — all counters start at zero.
    #[test]
    fn report_default_is_zero() {
        let r = ReconciliationReport::default();
        assert_eq!(r.ous_created, 0);
        assert_eq!(r.ous_orphaned, 0);
        assert_eq!(r.users_created, 0);
        assert_eq!(r.users_disabled, 0);
        assert_eq!(r.groups_synced, 0);
        assert_eq!(r.computers_created, 0);
    }
}
