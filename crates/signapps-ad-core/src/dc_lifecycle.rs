// crates/signapps-ad-core/src/dc_lifecycle.rs
//! Domain Controller lifecycle operations.
//!
//! Covers the full lifecycle of a DC: promotion, demotion, FSMO role management,
//! heartbeat tracking, and DC selection for sync operations.
//!
//! ## DC Lifecycle
//!
//! ```text
//! provisioning → online → (degraded | offline) → decommissioning
//! ```
//!
//! FSMO roles must be transferred away from a DC before it can be demoted.
//! Use [`seize_fsmo`] when the old DC is unreachable (forced seizure).

use signapps_common::{Error, Result};
use signapps_db::models::ad_sync::AdDcSite;
use signapps_db::repositories::AdDnsRepository;
use sqlx::PgPool;
use uuid::Uuid;

// ── Public API ────────────────────────────────────────────────────────────────

/// Promote a new Domain Controller into the domain.
///
/// Steps performed:
/// 1. Insert an `ad_dc_sites` row with `status = 'provisioning'`.
/// 2. If this is the first DC for the domain, set `is_primary = true` and
///    create all five FSMO roles pointing to it.
/// 3. Create DNS SRV records for LDAP, Kerberos, and GC for this DC's site.
/// 4. Transition `status → 'online'` and set `promoted_at = now()`.
///
/// # Errors
///
/// Returns `Error::Conflict` if a DC with the same hostname already exists.
/// Returns `Error::Database` if any database operation fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
///
/// # Examples
///
/// ```rust,no_run
/// use uuid::Uuid;
/// use signapps_ad_core::dc_lifecycle::promote_dc;
///
/// # async fn example(pool: &sqlx::PgPool) -> signapps_common::Result<()> {
/// let domain_id = Uuid::new_v4();
/// let dc = promote_dc(pool, domain_id, None, "dc1.corp.local", "192.168.1.10", "primary_rwdc").await?;
/// assert_eq!(dc.dc_status, "online");
/// # Ok(())
/// # }
/// ```
#[tracing::instrument(skip(pool))]
pub async fn promote_dc(
    pool: &PgPool,
    domain_id: Uuid,
    site_id: Option<Uuid>,
    hostname: &str,
    ip: &str,
    role: &str,
) -> Result<AdDcSite> {
    // Check for duplicate hostname
    let existing: Option<Uuid> =
        sqlx::query_scalar("SELECT id FROM ad_dc_sites WHERE domain_id = $1 AND dc_hostname = $2")
            .bind(domain_id)
            .bind(hostname)
            .fetch_optional(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;

    if existing.is_some() {
        return Err(Error::Conflict(format!(
            "DC '{hostname}' already exists in domain {domain_id}"
        )));
    }

    // 1. Insert with status='provisioning'
    let is_writable = role != "rodc";
    let dc: AdDcSite = sqlx::query_as(
        r#"
        INSERT INTO ad_dc_sites
            (domain_id, site_id, dc_hostname, dc_ip, dc_role, dc_status, is_writable, is_primary)
        VALUES ($1, $2, $3, $4, $5, 'provisioning', $6, false)
        RETURNING *
        "#,
    )
    .bind(domain_id)
    .bind(site_id)
    .bind(hostname)
    .bind(ip)
    .bind(role)
    .bind(is_writable)
    .fetch_one(pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    tracing::info!(dc_id = %dc.id, hostname = %hostname, "DC row inserted (provisioning)");

    // 2. Is this the first DC? → set primary + create FSMO roles
    let dc_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM ad_dc_sites WHERE domain_id = $1")
        .bind(domain_id)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

    if dc_count == 1 {
        sqlx::query("UPDATE ad_dc_sites SET is_primary = true WHERE id = $1")
            .bind(dc.id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;

        create_all_fsmo_roles(pool, domain_id, dc.id).await?;

        tracing::info!(dc_id = %dc.id, "First DC — assigned primary + all 5 FSMO roles");
    }

    // 3. Create DNS SRV records for this DC
    create_dc_srv_records(pool, domain_id, hostname, ip).await?;

    // 4. Transition to online
    let final_dc: AdDcSite = sqlx::query_as(
        r#"
        UPDATE ad_dc_sites
        SET dc_status = 'online', promoted_at = now()
        WHERE id = $1
        RETURNING *
        "#,
    )
    .bind(dc.id)
    .fetch_one(pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    tracing::info!(dc_id = %final_dc.id, hostname = %hostname, "DC promoted successfully");

    Ok(final_dc)
}

/// Demote a Domain Controller, removing it from service.
///
/// Steps performed:
/// 1. Verify the DC holds no FSMO roles (returns an error if it does — caller
///    must transfer them first with [`transfer_fsmo`]).
/// 2. Set `status = 'decommissioning'` and `demoted_at = now()`.
/// 3. Remove DNS SRV records registered for this DC.
///
/// # Errors
///
/// Returns `Error::Conflict` if the DC still holds FSMO roles.
/// Returns `Error::NotFound` if `dc_id` does not exist.
/// Returns `Error::Database` if any database operation fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
///
/// # Examples
///
/// ```rust,no_run
/// use uuid::Uuid;
/// use signapps_ad_core::dc_lifecycle::demote_dc;
///
/// # async fn example(pool: &sqlx::PgPool, dc_id: Uuid) -> signapps_common::Result<()> {
/// demote_dc(pool, dc_id).await?;
/// # Ok(())
/// # }
/// ```
#[tracing::instrument(skip(pool))]
pub async fn demote_dc(pool: &PgPool, dc_id: Uuid) -> Result<()> {
    // Verify the DC exists
    let dc: Option<AdDcSite> = sqlx::query_as("SELECT * FROM ad_dc_sites WHERE id = $1")
        .bind(dc_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

    let dc = dc.ok_or_else(|| Error::NotFound(format!("DC {dc_id} not found")))?;

    // 1. Check FSMO roles
    let fsmo_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM ad_fsmo_roles WHERE dc_id = $1")
        .bind(dc_id)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

    if fsmo_count > 0 {
        return Err(Error::Conflict(format!(
            "DC {dc_id} holds {fsmo_count} FSMO role(s) — transfer them before demoting"
        )));
    }

    // 2. Set status to decommissioning
    sqlx::query(
        "UPDATE ad_dc_sites SET dc_status = 'decommissioning', demoted_at = now() WHERE id = $1",
    )
    .bind(dc_id)
    .execute(pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    // 3. Remove DNS SRV records for this DC
    remove_dc_srv_records(pool, dc.domain_id, &dc.dc_hostname).await?;

    tracing::info!(dc_id = %dc_id, hostname = %dc.dc_hostname, "DC demoted");

    Ok(())
}

/// Transfer a FSMO role to a new Domain Controller (graceful transfer).
///
/// Verifies that the target DC is online and writable before updating the
/// `ad_fsmo_roles` table.
///
/// # Errors
///
/// Returns `Error::NotFound` if the role does not exist for the domain.
/// Returns `Error::BadRequest` if the target DC is not online or not writable.
/// Returns `Error::Database` if the UPDATE fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
///
/// # Examples
///
/// ```rust,no_run
/// use uuid::Uuid;
/// use signapps_ad_core::dc_lifecycle::transfer_fsmo;
///
/// # async fn example(pool: &sqlx::PgPool, domain_id: Uuid, new_dc_id: Uuid) -> signapps_common::Result<()> {
/// transfer_fsmo(pool, domain_id, "pdc_emulator", new_dc_id).await?;
/// # Ok(())
/// # }
/// ```
#[tracing::instrument(skip(pool))]
pub async fn transfer_fsmo(
    pool: &PgPool,
    domain_id: Uuid,
    role: &str,
    new_dc_id: Uuid,
) -> Result<()> {
    // 1. Verify new DC is online and writable
    verify_dc_writable_online(pool, new_dc_id).await?;

    // 2. Update FSMO role
    let updated = sqlx::query(
        r#"
        UPDATE ad_fsmo_roles
        SET dc_id = $1, transferred_at = now()
        WHERE domain_id = $2 AND role = $3
        "#,
    )
    .bind(new_dc_id)
    .bind(domain_id)
    .bind(role)
    .execute(pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    if updated.rows_affected() == 0 {
        return Err(Error::NotFound(format!(
            "FSMO role '{role}' not found for domain {domain_id}"
        )));
    }

    tracing::info!(role = %role, new_dc_id = %new_dc_id, "FSMO role transferred");

    Ok(())
}

/// Seize a FSMO role without coordinating with the previous DC holder.
///
/// Used when the previous DC is unavailable (crash, hardware failure). This
/// is a forced operation — the old DC is not consulted.
///
/// # Errors
///
/// Returns `Error::NotFound` if the role does not exist for the domain.
/// Returns `Error::BadRequest` if the target DC is not online or not writable.
/// Returns `Error::Database` if the UPDATE fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
///
/// # Examples
///
/// ```rust,no_run
/// use uuid::Uuid;
/// use signapps_ad_core::dc_lifecycle::seize_fsmo;
///
/// # async fn example(pool: &sqlx::PgPool, domain_id: Uuid, new_dc_id: Uuid) -> signapps_common::Result<()> {
/// seize_fsmo(pool, domain_id, "rid_master", new_dc_id).await?;
/// # Ok(())
/// # }
/// ```
#[tracing::instrument(skip(pool))]
pub async fn seize_fsmo(pool: &PgPool, domain_id: Uuid, role: &str, new_dc_id: Uuid) -> Result<()> {
    // Still verify the NEW DC is writable and online
    verify_dc_writable_online(pool, new_dc_id).await?;

    // Forcefully update without checking the old DC
    let updated = sqlx::query(
        r#"
        UPDATE ad_fsmo_roles
        SET dc_id = $1, transferred_at = now()
        WHERE domain_id = $2 AND role = $3
        "#,
    )
    .bind(new_dc_id)
    .bind(domain_id)
    .bind(role)
    .execute(pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    if updated.rows_affected() == 0 {
        return Err(Error::NotFound(format!(
            "FSMO role '{role}' not found for domain {domain_id}"
        )));
    }

    tracing::warn!(
        role = %role,
        new_dc_id = %new_dc_id,
        "FSMO role seized (forced — old DC not consulted)"
    );

    Ok(())
}

/// Record a heartbeat for a Domain Controller.
///
/// Updates `last_heartbeat_at = now()` for the given DC. Called periodically
/// by each running DC process to signal it is alive.
///
/// # Errors
///
/// Returns `Error::Database` if the UPDATE fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
///
/// # Examples
///
/// ```rust,no_run
/// use uuid::Uuid;
/// use signapps_ad_core::dc_lifecycle::dc_heartbeat;
///
/// # async fn example(pool: &sqlx::PgPool, dc_id: Uuid) -> signapps_common::Result<()> {
/// dc_heartbeat(pool, dc_id).await?;
/// # Ok(())
/// # }
/// ```
#[tracing::instrument(skip(pool))]
pub async fn dc_heartbeat(pool: &PgPool, dc_id: Uuid) -> Result<()> {
    sqlx::query("UPDATE ad_dc_sites SET last_heartbeat_at = now() WHERE id = $1")
        .bind(dc_id)
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

    tracing::debug!(dc_id = %dc_id, "DC heartbeat recorded");

    Ok(())
}

/// List all Domain Controllers for a domain.
///
/// Returns the list ordered by hostname for deterministic output.
///
/// # Errors
///
/// Returns `Error::Database` if the query fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
///
/// # Examples
///
/// ```rust,no_run
/// use uuid::Uuid;
/// use signapps_ad_core::dc_lifecycle::list_dc_sites;
///
/// # async fn example(pool: &sqlx::PgPool, domain_id: Uuid) -> signapps_common::Result<()> {
/// let dcs = list_dc_sites(pool, domain_id).await?;
/// for dc in &dcs {
///     println!("{} — {}", dc.dc_hostname, dc.dc_status);
/// }
/// # Ok(())
/// # }
/// ```
#[tracing::instrument(skip(pool))]
pub async fn list_dc_sites(pool: &PgPool, domain_id: Uuid) -> Result<Vec<AdDcSite>> {
    let dcs: Vec<AdDcSite> =
        sqlx::query_as("SELECT * FROM ad_dc_sites WHERE domain_id = $1 ORDER BY dc_hostname")
            .bind(domain_id)
            .fetch_all(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;

    Ok(dcs)
}

/// Resolve the best available DC for a sync operation.
///
/// Selection priority (from the spec, section 7):
/// 1. A writable DC in the requested `site_id` that is `online`.
/// 2. Any writable, `online` DC in the domain (most recently heartbeated first).
/// 3. The primary DC regardless of status (last resort).
///
/// Returns `None` if no DC exists for the domain.
///
/// # Errors
///
/// Returns `Error::Database` if any query fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
///
/// # Examples
///
/// ```rust,no_run
/// use uuid::Uuid;
/// use signapps_ad_core::dc_lifecycle::resolve_dc;
///
/// # async fn example(pool: &sqlx::PgPool, domain_id: Uuid, site_id: Uuid) -> signapps_common::Result<()> {
/// if let Some(dc) = resolve_dc(pool, domain_id, Some(site_id)).await? {
///     println!("Using DC: {}", dc.dc_hostname);
/// }
/// # Ok(())
/// # }
/// ```
#[tracing::instrument(skip(pool))]
pub async fn resolve_dc(
    pool: &PgPool,
    domain_id: Uuid,
    site_id: Option<Uuid>,
) -> Result<Option<AdDcSite>> {
    // 1. Writable DC in the requested site
    if let Some(sid) = site_id {
        let dc: Option<AdDcSite> = sqlx::query_as(
            r#"
            SELECT * FROM ad_dc_sites
            WHERE domain_id = $1
              AND site_id = $2
              AND is_writable = true
              AND dc_status = 'online'
            ORDER BY last_heartbeat_at DESC NULLS LAST
            LIMIT 1
            "#,
        )
        .bind(domain_id)
        .bind(sid)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        if dc.is_some() {
            tracing::debug!(domain_id = %domain_id, site_id = %sid, "DC resolved from site");
            return Ok(dc);
        }
    }

    // 2. Any writable online DC
    let dc: Option<AdDcSite> = sqlx::query_as(
        r#"
        SELECT * FROM ad_dc_sites
        WHERE domain_id = $1
          AND is_writable = true
          AND dc_status = 'online'
        ORDER BY last_heartbeat_at DESC NULLS LAST
        LIMIT 1
        "#,
    )
    .bind(domain_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    if dc.is_some() {
        tracing::debug!(domain_id = %domain_id, "DC resolved (any writable online)");
        return Ok(dc);
    }

    // 3. Primary DC (last resort, may be offline)
    let dc: Option<AdDcSite> = sqlx::query_as(
        "SELECT * FROM ad_dc_sites WHERE domain_id = $1 AND is_primary = true LIMIT 1",
    )
    .bind(domain_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    if dc.is_some() {
        tracing::warn!(domain_id = %domain_id, "DC resolved to primary (last resort — may be offline)");
    } else {
        tracing::warn!(domain_id = %domain_id, "No DC available for domain");
    }

    Ok(dc)
}

// ── Private helpers ───────────────────────────────────────────────────────────

/// Create all five FSMO roles pointing to the given DC (first DC in domain).
async fn create_all_fsmo_roles(pool: &PgPool, domain_id: Uuid, dc_id: Uuid) -> Result<()> {
    const ROLES: &[&str] = &[
        "schema_master",
        "domain_naming",
        "rid_master",
        "pdc_emulator",
        "infrastructure_master",
    ];

    for role in ROLES {
        sqlx::query(
            r#"
            INSERT INTO ad_fsmo_roles (domain_id, role, dc_id, transferred_at)
            VALUES ($1, $2, $3, now())
            ON CONFLICT (domain_id, role) DO NOTHING
            "#,
        )
        .bind(domain_id)
        .bind(role)
        .bind(dc_id)
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
    }

    tracing::info!(domain_id = %domain_id, dc_id = %dc_id, "5 FSMO roles created");

    Ok(())
}

/// Register DNS SRV records for a newly promoted DC.
async fn create_dc_srv_records(
    pool: &PgPool,
    domain_id: Uuid,
    hostname: &str,
    ip: &str,
) -> Result<()> {
    // Find the DNS zone for this domain
    let dns_name: Option<String> =
        sqlx::query_scalar("SELECT dns_name FROM infrastructure.domains WHERE id = $1")
            .bind(domain_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;

    let dns_name = match dns_name {
        Some(n) => n,
        None => {
            tracing::warn!(domain_id = %domain_id, "No DNS name found — skipping SRV records");
            return Ok(());
        },
    };

    let zone = AdDnsRepository::get_zone(pool, domain_id, &dns_name).await?;
    let zone = match zone {
        Some(z) => z,
        None => {
            tracing::warn!(zone = %dns_name, "DNS zone not found — skipping SRV records");
            return Ok(());
        },
    };

    // A record for the DC hostname
    AdDnsRepository::add_record(
        pool,
        zone.id,
        hostname,
        "A",
        serde_json::json!({ "ip": ip }),
        3600,
        true,
    )
    .await?;

    // SRV records pointing to this DC
    let srv_records = [
        ("_ldap._tcp", 389u16),
        ("_ldap._tcp.dc._msdcs", 389),
        ("_kerberos._tcp", 88),
        ("_kerberos._tcp.dc._msdcs", 88),
        ("_kpasswd._tcp", 464),
        ("_gc._tcp", 3268),
    ];

    for (name, port) in &srv_records {
        AdDnsRepository::add_record(
            pool,
            zone.id,
            name,
            "SRV",
            serde_json::json!({
                "priority": 0,
                "weight": 100,
                "port": port,
                "target": hostname
            }),
            600,
            true,
        )
        .await?;
    }

    tracing::info!(dc = %hostname, zone = %dns_name, "DC SRV records registered");

    Ok(())
}

/// Remove DNS records associated with a DC being decommissioned.
async fn remove_dc_srv_records(pool: &PgPool, domain_id: Uuid, hostname: &str) -> Result<()> {
    let dns_name: Option<String> =
        sqlx::query_scalar("SELECT dns_name FROM infrastructure.domains WHERE id = $1")
            .bind(domain_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;

    let dns_name = match dns_name {
        Some(n) => n,
        None => return Ok(()),
    };

    let zone = AdDnsRepository::get_zone(pool, domain_id, &dns_name).await?;
    let zone = match zone {
        Some(z) => z,
        None => return Ok(()),
    };

    // Remove A record for DC hostname
    sqlx::query(
        "DELETE FROM ad_dns_records WHERE zone_id = $1 AND name = $2 AND record_type = 'A'",
    )
    .bind(zone.id)
    .bind(hostname)
    .execute(pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    // Remove SRV records that point to this specific DC
    sqlx::query(
        r#"
        DELETE FROM ad_dns_records
        WHERE zone_id = $1
          AND record_type = 'SRV'
          AND rdata->>'target' = $2
        "#,
    )
    .bind(zone.id)
    .bind(hostname)
    .execute(pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    tracing::info!(dc = %hostname, zone = %dns_name, "DC SRV records removed");

    Ok(())
}

/// Verify a DC exists, is online, and writable — used before FSMO operations.
async fn verify_dc_writable_online(pool: &PgPool, dc_id: Uuid) -> Result<()> {
    let row: Option<(bool, String)> =
        sqlx::query_as("SELECT is_writable, dc_status FROM ad_dc_sites WHERE id = $1")
            .bind(dc_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;

    match row {
        None => Err(Error::NotFound(format!("DC {dc_id} not found"))),
        Some((false, _)) => Err(Error::BadRequest(format!(
            "DC {dc_id} is read-only (RODC) — cannot hold FSMO roles"
        ))),
        Some((true, status)) if status != "online" => Err(Error::BadRequest(format!(
            "DC {dc_id} is not online (status: {status}) — transfer to an online DC"
        ))),
        Some(_) => Ok(()),
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    /// Smoke test — ensures the module compiles and public types are accessible.
    #[test]
    fn dc_lifecycle_module_compiles() {
        // Integration tests require a live PostgreSQL instance.
        // See the DC integration test suite for full coverage.
        let _ = module_path!();
    }
}
