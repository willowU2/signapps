//! Repositories for the unified infrastructure domain registry.
//!
//! Covers domains, certificates, DHCP (scopes/leases/reservations),
//! and deployment profiles/history.

use chrono::Utc;
use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::infrastructure::{
    DeployHistory, DeployProfile, DhcpLease, DhcpScope, InfraCertificate, InfraDomain,
};

// ── Domain Registry ───────────────────────────────────────────────────────────

/// Repository for `infrastructure.domains` table operations.
pub struct InfraDomainRepository;

impl InfraDomainRepository {
    /// Create a new infrastructure domain.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the INSERT fails (e.g., duplicate
    /// `(tenant_id, dns_name)`).
    #[allow(clippy::too_many_arguments)]
    pub async fn create(
        pool: &PgPool,
        tenant_id: Uuid,
        dns_name: &str,
        netbios_name: Option<&str>,
        domain_type: &str,
        ad_enabled: bool,
        mail_enabled: bool,
        dhcp_enabled: bool,
        pxe_enabled: bool,
    ) -> Result<InfraDomain> {
        let domain = sqlx::query_as::<_, InfraDomain>(
            r#"
            INSERT INTO infrastructure.domains (
                tenant_id, dns_name, netbios_name, domain_type,
                ad_enabled, mail_enabled, dhcp_enabled, pxe_enabled
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
            "#,
        )
        .bind(tenant_id)
        .bind(dns_name)
        .bind(netbios_name)
        .bind(domain_type)
        .bind(ad_enabled)
        .bind(mail_enabled)
        .bind(dhcp_enabled)
        .bind(pxe_enabled)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(domain)
    }

    /// Update a domain's AD identity fields (SID, realm, cert_mode).
    ///
    /// Called by the provisioner after the initial INSERT to store
    /// generated values.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the UPDATE fails.
    pub async fn update_ad_identity(
        pool: &PgPool,
        domain_id: Uuid,
        domain_sid: Option<&str>,
        realm: Option<&str>,
        cert_mode: &str,
    ) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE infrastructure.domains
            SET domain_sid = COALESCE($2, domain_sid),
                realm = COALESCE($3, realm),
                cert_mode = $4,
                updated_at = now()
            WHERE id = $1
            "#,
        )
        .bind(domain_id)
        .bind(domain_sid)
        .bind(realm)
        .bind(cert_mode)
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(())
    }

    /// Get an infrastructure domain by its ID.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the query fails.
    pub async fn get(pool: &PgPool, id: Uuid) -> Result<Option<InfraDomain>> {
        let domain =
            sqlx::query_as::<_, InfraDomain>("SELECT * FROM infrastructure.domains WHERE id = $1")
                .bind(id)
                .fetch_optional(pool)
                .await
                .map_err(|e| Error::Database(e.to_string()))?;

        Ok(domain)
    }

    /// Get an infrastructure domain by tenant and DNS name.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the query fails.
    pub async fn get_by_dns_name(
        pool: &PgPool,
        tenant_id: Uuid,
        dns_name: &str,
    ) -> Result<Option<InfraDomain>> {
        let domain = sqlx::query_as::<_, InfraDomain>(
            "SELECT * FROM infrastructure.domains WHERE tenant_id = $1 AND dns_name = $2",
        )
        .bind(tenant_id)
        .bind(dns_name)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(domain)
    }

    /// List all active infrastructure domains for a tenant, ordered by DNS name.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the query fails.
    pub async fn list_by_tenant(pool: &PgPool, tenant_id: Uuid) -> Result<Vec<InfraDomain>> {
        let domains = sqlx::query_as::<_, InfraDomain>(
            "SELECT * FROM infrastructure.domains WHERE tenant_id = $1 AND is_active = true \
             ORDER BY dns_name",
        )
        .bind(tenant_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(domains)
    }

    /// Update the service-enabled flags for a domain.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the UPDATE fails.
    pub async fn update_flags(
        pool: &PgPool,
        id: Uuid,
        ad_enabled: bool,
        mail_enabled: bool,
        dhcp_enabled: bool,
        pxe_enabled: bool,
        ntp_enabled: bool,
    ) -> Result<Option<InfraDomain>> {
        let domain = sqlx::query_as::<_, InfraDomain>(
            r#"
            UPDATE infrastructure.domains
            SET ad_enabled = $2, mail_enabled = $3, dhcp_enabled = $4,
                pxe_enabled = $5, ntp_enabled = $6, updated_at = now()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(ad_enabled)
        .bind(mail_enabled)
        .bind(dhcp_enabled)
        .bind(pxe_enabled)
        .bind(ntp_enabled)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(domain)
    }

    /// Soft-delete a domain by marking it inactive.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the UPDATE fails.
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<()> {
        sqlx::query(
            "UPDATE infrastructure.domains SET is_active = false, updated_at = now() \
             WHERE id = $1",
        )
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(())
    }
}

// ── Certificates ──────────────────────────────────────────────────────────────

/// Repository for `infrastructure.certificates` table operations.
pub struct InfraCertificateRepository;

impl InfraCertificateRepository {
    /// Create a new certificate record.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the INSERT fails.
    #[allow(clippy::too_many_arguments)]
    pub async fn create(
        pool: &PgPool,
        domain_id: Uuid,
        subject: &str,
        issuer: &str,
        cert_type: &str,
        certificate: &str,
        not_before: chrono::DateTime<Utc>,
        not_after: chrono::DateTime<Utc>,
        san: &[String],
        serial_number: Option<&str>,
        fingerprint_sha256: Option<&str>,
    ) -> Result<InfraCertificate> {
        let cert = sqlx::query_as::<_, InfraCertificate>(
            r#"
            INSERT INTO infrastructure.certificates (
                domain_id, subject, issuer, cert_type, certificate,
                not_before, not_after, san, serial_number, fingerprint_sha256
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
            "#,
        )
        .bind(domain_id)
        .bind(subject)
        .bind(issuer)
        .bind(cert_type)
        .bind(certificate)
        .bind(not_before)
        .bind(not_after)
        .bind(san)
        .bind(serial_number)
        .bind(fingerprint_sha256)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(cert)
    }

    /// List all certificates for a domain.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the query fails.
    pub async fn list_by_domain(pool: &PgPool, domain_id: Uuid) -> Result<Vec<InfraCertificate>> {
        let certs = sqlx::query_as::<_, InfraCertificate>(
            "SELECT * FROM infrastructure.certificates WHERE domain_id = $1 ORDER BY not_after DESC",
        )
        .bind(domain_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(certs)
    }

    /// List active certificates expiring within the next `days` days.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the query fails.
    pub async fn get_expiring(pool: &PgPool, days: i32) -> Result<Vec<InfraCertificate>> {
        let certs = sqlx::query_as::<_, InfraCertificate>(
            r#"
            SELECT * FROM infrastructure.certificates
            WHERE status = 'active'
              AND not_after <= now() + ($1 || ' days')::interval
            ORDER BY not_after ASC
            "#,
        )
        .bind(days)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(certs)
    }

    /// Mark a certificate as revoked.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the UPDATE fails.
    pub async fn revoke(pool: &PgPool, id: Uuid) -> Result<()> {
        sqlx::query("UPDATE infrastructure.certificates SET status = 'revoked' WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;

        Ok(())
    }
}

// ── DHCP Scopes ───────────────────────────────────────────────────────────────

/// Repository for `infrastructure.dhcp_scopes` table operations.
pub struct DhcpScopeRepository;

impl DhcpScopeRepository {
    /// Create a new DHCP scope.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the INSERT fails.
    #[allow(clippy::too_many_arguments)]
    pub async fn create(
        pool: &PgPool,
        domain_id: Uuid,
        site_id: Option<Uuid>,
        name: &str,
        subnet: &str,
        range_start: &str,
        range_end: &str,
        gateway: Option<&str>,
        dns_servers: &[String],
        lease_duration_hours: i32,
    ) -> Result<DhcpScope> {
        let scope = sqlx::query_as::<_, DhcpScope>(
            r#"
            INSERT INTO infrastructure.dhcp_scopes (
                domain_id, site_id, name, subnet, range_start, range_end,
                gateway, dns_servers, lease_duration_hours
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
            "#,
        )
        .bind(domain_id)
        .bind(site_id)
        .bind(name)
        .bind(subnet)
        .bind(range_start)
        .bind(range_end)
        .bind(gateway)
        .bind(dns_servers)
        .bind(lease_duration_hours)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(scope)
    }

    /// List all active DHCP scopes for a domain.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the query fails.
    pub async fn list_by_domain(pool: &PgPool, domain_id: Uuid) -> Result<Vec<DhcpScope>> {
        let scopes = sqlx::query_as::<_, DhcpScope>(
            "SELECT * FROM infrastructure.dhcp_scopes \
             WHERE domain_id = $1 AND is_active = true ORDER BY name",
        )
        .bind(domain_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(scopes)
    }

    /// Get DHCP scopes for a specific site.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the query fails.
    pub async fn get_by_site(pool: &PgPool, site_id: Uuid) -> Result<Vec<DhcpScope>> {
        let scopes = sqlx::query_as::<_, DhcpScope>(
            "SELECT * FROM infrastructure.dhcp_scopes \
             WHERE site_id = $1 AND is_active = true ORDER BY name",
        )
        .bind(site_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(scopes)
    }
}

// ── DHCP Leases ───────────────────────────────────────────────────────────────

/// Repository for `infrastructure.dhcp_leases` table operations.
pub struct DhcpLeaseRepository;

impl DhcpLeaseRepository {
    /// Record a new DHCP lease grant.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the INSERT fails (e.g., duplicate
    /// `(scope_id, ip_address)`).
    pub async fn create(
        pool: &PgPool,
        scope_id: Uuid,
        ip_address: &str,
        mac_address: &str,
        hostname: Option<&str>,
        lease_start: chrono::DateTime<Utc>,
        lease_end: chrono::DateTime<Utc>,
    ) -> Result<DhcpLease> {
        let lease = sqlx::query_as::<_, DhcpLease>(
            r#"
            INSERT INTO infrastructure.dhcp_leases (
                scope_id, ip_address, mac_address, hostname, lease_start, lease_end
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (scope_id, ip_address) DO UPDATE
                SET mac_address = EXCLUDED.mac_address,
                    hostname    = EXCLUDED.hostname,
                    lease_start = EXCLUDED.lease_start,
                    lease_end   = EXCLUDED.lease_end,
                    is_active   = true
            RETURNING *
            "#,
        )
        .bind(scope_id)
        .bind(ip_address)
        .bind(mac_address)
        .bind(hostname)
        .bind(lease_start)
        .bind(lease_end)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(lease)
    }

    /// Get the active lease for a given MAC address within a scope.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the query fails.
    pub async fn get_active_by_mac(
        pool: &PgPool,
        scope_id: Uuid,
        mac_address: &str,
    ) -> Result<Option<DhcpLease>> {
        let lease = sqlx::query_as::<_, DhcpLease>(
            r#"
            SELECT * FROM infrastructure.dhcp_leases
            WHERE scope_id = $1 AND mac_address = $2 AND is_active = true
              AND lease_end > now()
            "#,
        )
        .bind(scope_id)
        .bind(mac_address)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(lease)
    }

    /// List all leases for a scope, newest first.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the query fails.
    pub async fn list_by_scope(pool: &PgPool, scope_id: Uuid) -> Result<Vec<DhcpLease>> {
        let leases = sqlx::query_as::<_, DhcpLease>(
            "SELECT * FROM infrastructure.dhcp_leases \
             WHERE scope_id = $1 ORDER BY lease_end DESC",
        )
        .bind(scope_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(leases)
    }

    /// Mark expired leases as inactive (maintenance sweep).
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the UPDATE fails.
    pub async fn expire_stale(pool: &PgPool) -> Result<u64> {
        let result = sqlx::query(
            "UPDATE infrastructure.dhcp_leases \
             SET is_active = false \
             WHERE is_active = true AND lease_end <= now()",
        )
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(result.rows_affected())
    }
}

// ── Deploy Profiles ───────────────────────────────────────────────────────────

/// Repository for deployment profiles, assignments, and history.
pub struct DeployProfileRepository;

impl DeployProfileRepository {
    /// Create a new deployment profile.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the INSERT fails.
    pub async fn create(
        pool: &PgPool,
        domain_id: Uuid,
        name: &str,
        description: Option<&str>,
        os_type: Option<&str>,
        os_version: Option<&str>,
    ) -> Result<DeployProfile> {
        let profile = sqlx::query_as::<_, DeployProfile>(
            r#"
            INSERT INTO infrastructure.deploy_profiles (
                domain_id, name, description, os_type, os_version, is_default
            )
            VALUES ($1, $2, $3, $4, $5, true)
            RETURNING *
            "#,
        )
        .bind(domain_id)
        .bind(name)
        .bind(description)
        .bind(os_type)
        .bind(os_version)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(profile)
    }

    /// List all deployment profiles for a domain, ordered by sort_order then name.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the query fails.
    pub async fn list_by_domain(pool: &PgPool, domain_id: Uuid) -> Result<Vec<DeployProfile>> {
        let profiles = sqlx::query_as::<_, DeployProfile>(
            "SELECT * FROM infrastructure.deploy_profiles \
             WHERE domain_id = $1 ORDER BY sort_order, name",
        )
        .bind(domain_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(profiles)
    }

    /// Get the default deployment profile for a domain, if one exists.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the query fails.
    pub async fn get_default(pool: &PgPool, domain_id: Uuid) -> Result<Option<DeployProfile>> {
        let profile = sqlx::query_as::<_, DeployProfile>(
            "SELECT * FROM infrastructure.deploy_profiles \
             WHERE domain_id = $1 AND is_default = true LIMIT 1",
        )
        .bind(domain_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(profile)
    }

    /// Create a deployment assignment linking a profile to a target.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the INSERT fails (e.g., duplicate assignment).
    pub async fn assign(
        pool: &PgPool,
        profile_id: Uuid,
        target_type: &str,
        target_id: &str,
    ) -> Result<()> {
        sqlx::query(
            r#"
            INSERT INTO infrastructure.deploy_assignments (profile_id, target_type, target_id)
            VALUES ($1, $2, $3)
            ON CONFLICT (profile_id, target_type, target_id) DO NOTHING
            "#,
        )
        .bind(profile_id)
        .bind(target_type)
        .bind(target_id)
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(())
    }

    /// Create a deployment history entry.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the INSERT fails.
    pub async fn record_history(
        pool: &PgPool,
        profile_id: Uuid,
        mac_address: Option<&str>,
        hostname: Option<&str>,
    ) -> Result<DeployHistory> {
        let record = sqlx::query_as::<_, DeployHistory>(
            r#"
            INSERT INTO infrastructure.deploy_history (profile_id, mac_address, hostname)
            VALUES ($1, $2, $3)
            RETURNING *
            "#,
        )
        .bind(profile_id)
        .bind(mac_address)
        .bind(hostname)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(record)
    }

    /// List deployment history for a profile, newest first.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the query fails.
    pub async fn list_history(pool: &PgPool, profile_id: Uuid) -> Result<Vec<DeployHistory>> {
        let records = sqlx::query_as::<_, DeployHistory>(
            "SELECT * FROM infrastructure.deploy_history \
             WHERE profile_id = $1 ORDER BY created_at DESC",
        )
        .bind(profile_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(records)
    }
}
