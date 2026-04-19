//! AD synchronization cycle.
//!
//! [`run_cycle`] performs ONE end-to-end synchronization pass for a
//! tenant:
//!
//! 1. Open an [`AdClient`] using the plaintext bind credentials in
//!    [`AdSyncConfig`].
//! 2. List AD users with `cfg.user_filter` under `cfg.base_dn`.
//! 3. For each AD entry, look up the matching row in `org_persons` by
//!    email (unique per tenant):
//!    - absent → create it (or log `added_dry` in dry-run).
//!    - present → diff against AD; apply the resolution dictated by
//!      `cfg.conflict_strategy`.
//! 4. Every applied change is mirrored into `org_ad_sync_log` and
//!    emitted on [`PgEventBus`] as `org.person.synced_from_ad`.
//!
//! The OrgToAd direction is stubbed for W3 — it ships in a later wave.

use std::sync::Arc;

use anyhow::Result;
use serde::{Deserialize, Serialize};
use signapps_common::pg_events::{NewEvent, PgEventBus};
use signapps_db::models::org::{AdSyncMode, Person};
use signapps_db::repositories::org::{AdSyncLogRepository, PersonRepository};
use sqlx::PgPool;
use uuid::Uuid;

use crate::ad::client::AdClient;
use crate::ad::config::AdSyncConfig;
use crate::ad::conflict::{resolve, Resolved};

/// Marker stored in `org_persons.last_synced_by` for AD-originated
/// changes (introduced in Task 21).
pub const SYNCED_BY_AD: &str = "ad";

/// Summary returned by [`run_cycle`].
#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct SyncReport {
    /// Unique ID stamped on every `org_ad_sync_log` row for this run.
    pub run_id: Uuid,
    /// Number of persons created from AD entries.
    pub added: u64,
    /// Number of persons whose scalar fields were updated from AD.
    pub updated: u64,
    /// Number of entries left untouched because the conflict strategy
    /// was `Manual`.
    pub conflicts: u64,
    /// Number of AD entries skipped (missing email or identical to
    /// the Org row).
    pub skipped: u64,
    /// True when no writes were applied — the caller merely walks AD.
    pub dry_run: bool,
}

/// Compact view of the scalar attributes the engine synchronizes.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
struct PersonView {
    first_name: Option<String>,
    last_name: Option<String>,
    dn: Option<String>,
}

impl PersonView {
    fn from_org(p: &Person) -> Self {
        Self {
            first_name: p.first_name.clone(),
            last_name: p.last_name.clone(),
            dn: p.dn.clone(),
        }
    }

    fn diverges_from(&self, other: &Self) -> bool {
        self != other
    }
}

/// Drive one AD→Org synchronization cycle.
///
/// # Errors
///
/// Any LDAP or database failure short-circuits the cycle and is
/// returned. Callers SHOULD log the error and retry on the next tick.
#[tracing::instrument(skip(pool, cfg, event_bus), fields(tenant_id = %cfg.tenant_id, dry_run))]
pub async fn run_cycle(
    pool: &PgPool,
    cfg: &AdSyncConfig,
    dry_run: bool,
    event_bus: Option<&Arc<PgEventBus>>,
) -> Result<SyncReport> {
    let mut report = SyncReport {
        run_id: Uuid::new_v4(),
        dry_run,
        ..Default::default()
    };

    // Early-out when the tenant's mode is `off`.
    if matches!(cfg.mode, AdSyncMode::Off) {
        tracing::info!("ad sync mode=off, skipping cycle");
        return Ok(report);
    }

    // --- Step 1: connect + bind ------------------------------------
    let mut client =
        AdClient::connect(&cfg.ldap_url, &cfg.bind_dn, &cfg.bind_password).await?;

    // --- Step 2: list AD users -------------------------------------
    let entries = match client.list_users(&cfg.base_dn, &cfg.user_filter).await {
        Ok(v) => v,
        Err(e) => {
            let _ = unbind_quiet(client).await;
            return Err(e);
        }
    };

    let person_repo = PersonRepository::new(pool);
    let log_repo = AdSyncLogRepository::new(pool);

    // --- Step 3: walk each AD entry --------------------------------
    for entry in entries {
        let dn = entry.dn.clone();
        let email = first_attr(&entry, "mail").unwrap_or_default();
        if email.is_empty() {
            report.skipped += 1;
            let _ = log_repo
                .insert(
                    cfg.tenant_id,
                    report.run_id,
                    &dn,
                    "ad_to_org",
                    "skipped",
                    serde_json::json!({"reason": "missing email"}),
                    None,
                )
                .await;
            continue;
        }

        let first_name = first_attr(&entry, "givenName");
        let last_name = first_attr(&entry, "sn");
        let ad_view = PersonView {
            first_name: first_name.clone(),
            last_name: last_name.clone(),
            dn: Some(dn.clone()),
        };

        match person_repo.get_by_email(cfg.tenant_id, &email).await {
            Err(e) => {
                tracing::warn!(?e, email = %email, "get_by_email failed");
                let _ = log_repo
                    .insert(
                        cfg.tenant_id,
                        report.run_id,
                        &dn,
                        "ad_to_org",
                        "error",
                        serde_json::json!({}),
                        Some(&e.to_string()),
                    )
                    .await;
                continue;
            }
            Ok(None) => {
                // Create.
                if dry_run {
                    report.added += 1;
                    let _ = log_repo
                        .insert(
                            cfg.tenant_id,
                            report.run_id,
                            &dn,
                            "ad_to_org",
                            "added_dry",
                            serde_json::json!({"after": &ad_view_payload(&email, &ad_view)}),
                            None,
                        )
                        .await;
                    continue;
                }
                match person_repo
                    .create(
                        cfg.tenant_id,
                        &email,
                        first_name.as_deref(),
                        last_name.as_deref(),
                        Some(&dn),
                    )
                    .await
                {
                    Ok(p) => {
                        // Stamp sync markers so the OrgToAd side can
                        // honor the debounce window (Task 21).
                        let _ = stamp_sync_markers(pool, p.id, SYNCED_BY_AD).await;

                        let payload = serde_json::json!({
                            "after": &ad_view_payload(&email, &ad_view)
                        });
                        let _ = log_repo
                            .insert(
                                cfg.tenant_id,
                                report.run_id,
                                &dn,
                                "ad_to_org",
                                "added",
                                payload.clone(),
                                None,
                            )
                            .await;
                        if let Some(bus) = event_bus {
                            let _ = bus
                                .publish(NewEvent {
                                    event_type: "org.person.synced_from_ad".to_string(),
                                    aggregate_id: Some(p.id),
                                    payload,
                                })
                                .await;
                        }
                        report.added += 1;
                    }
                    Err(e) => {
                        tracing::warn!(?e, email = %email, "create person failed");
                        let _ = log_repo
                            .insert(
                                cfg.tenant_id,
                                report.run_id,
                                &dn,
                                "ad_to_org",
                                "error",
                                serde_json::json!({}),
                                Some(&e.to_string()),
                            )
                            .await;
                    }
                }
            }
            Ok(Some(existing)) => {
                let org_view = PersonView::from_org(&existing);
                if !org_view.diverges_from(&ad_view) {
                    report.skipped += 1;
                    continue;
                }

                let outcome =
                    resolve(cfg.conflict_strategy, org_view.clone(), ad_view.clone());
                match outcome {
                    Resolved::UseOrg(_) => {
                        // Keep SignApps state — log for auditing and
                        // mark as skipped (no Org change applied).
                        report.skipped += 1;
                        let _ = log_repo
                            .insert(
                                cfg.tenant_id,
                                report.run_id,
                                &dn,
                                "ad_to_org",
                                "skipped",
                                serde_json::json!({
                                    "reason": "org_wins",
                                    "org": &ad_view_payload(&email, &org_view),
                                    "ad":  &ad_view_payload(&email, &ad_view),
                                }),
                                None,
                            )
                            .await;
                    }
                    Resolved::UseAd(_) => {
                        if dry_run {
                            report.updated += 1;
                            let _ = log_repo
                                .insert(
                                    cfg.tenant_id,
                                    report.run_id,
                                    &dn,
                                    "ad_to_org",
                                    "updated_dry",
                                    serde_json::json!({
                                        "before": &ad_view_payload(&email, &org_view),
                                        "after":  &ad_view_payload(&email, &ad_view),
                                    }),
                                    None,
                                )
                                .await;
                            continue;
                        }
                        match apply_ad_view(pool, existing.id, &ad_view).await {
                            Ok(()) => {
                                let _ = stamp_sync_markers(pool, existing.id, SYNCED_BY_AD).await;
                                let payload = serde_json::json!({
                                    "before": &ad_view_payload(&email, &org_view),
                                    "after":  &ad_view_payload(&email, &ad_view),
                                });
                                let _ = log_repo
                                    .insert(
                                        cfg.tenant_id,
                                        report.run_id,
                                        &dn,
                                        "ad_to_org",
                                        "updated",
                                        payload.clone(),
                                        None,
                                    )
                                    .await;
                                if let Some(bus) = event_bus {
                                    let _ = bus
                                        .publish(NewEvent {
                                            event_type: "org.person.synced_from_ad".to_string(),
                                            aggregate_id: Some(existing.id),
                                            payload,
                                        })
                                        .await;
                                }
                                report.updated += 1;
                            }
                            Err(e) => {
                                tracing::warn!(?e, email = %email, "apply ad view failed");
                                let _ = log_repo
                                    .insert(
                                        cfg.tenant_id,
                                        report.run_id,
                                        &dn,
                                        "ad_to_org",
                                        "error",
                                        serde_json::json!({}),
                                        Some(&e.to_string()),
                                    )
                                    .await;
                            }
                        }
                    }
                    Resolved::Manual => {
                        report.conflicts += 1;
                        let _ = log_repo
                            .insert(
                                cfg.tenant_id,
                                report.run_id,
                                &dn,
                                "ad_to_org",
                                "conflict_manual",
                                serde_json::json!({
                                    "org": &ad_view_payload(&email, &org_view),
                                    "ad":  &ad_view_payload(&email, &ad_view),
                                }),
                                None,
                            )
                            .await;
                    }
                }
            }
        }
    }

    // --- Step 4: Org → AD direction (stub) -------------------------
    //
    // TODO(S1-W3-followup): push Org→AD changes respecting the 30s
    // debounce window on `org_persons.last_synced_at` /
    // `last_synced_by = 'ad'` (see Task 21). The shape of the LDAP
    // modify operation (attribute map, DN placement, group delta) is
    // out of scope for the canonical refonte and will ship in a
    // dedicated follow-up ticket.

    let _ = unbind_quiet(client).await;
    Ok(report)
}

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

fn first_attr(entry: &ldap3::SearchEntry, name: &str) -> Option<String> {
    entry
        .attrs
        .get(name)
        .and_then(|v| v.first())
        .cloned()
        .filter(|s| !s.is_empty())
}

fn ad_view_payload(email: &str, v: &PersonView) -> serde_json::Value {
    serde_json::json!({
        "email": email,
        "first_name": v.first_name,
        "last_name": v.last_name,
        "dn": v.dn,
    })
}

async fn apply_ad_view(pool: &PgPool, person_id: Uuid, v: &PersonView) -> Result<()> {
    sqlx::query(
        "UPDATE org_persons SET
            first_name = $2,
            last_name  = $3,
            dn         = COALESCE($4, dn),
            updated_at = now()
         WHERE id = $1",
    )
    .bind(person_id)
    .bind(v.first_name.as_deref())
    .bind(v.last_name.as_deref())
    .bind(v.dn.as_deref())
    .execute(pool)
    .await?;
    Ok(())
}

/// Best-effort stamp of `last_synced_at` / `last_synced_by` introduced
/// by migration 410. Uses [`PersonRepository::mark_synced`]; a DB
/// failure is downgraded to a debug log so one misbehaving row cannot
/// abort a whole sync cycle.
async fn stamp_sync_markers(pool: &PgPool, person_id: Uuid, by: &str) -> Result<()> {
    let repo = PersonRepository::new(pool);
    if let Err(e) = repo.mark_synced(person_id, by).await {
        tracing::debug!(?e, "stamp_sync_markers: ignoring (migration 410 not applied?)");
    }
    Ok(())
}

async fn unbind_quiet(client: AdClient) -> Result<()> {
    client.unbind().await;
    Ok(())
}
