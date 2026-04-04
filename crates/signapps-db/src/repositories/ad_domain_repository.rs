//! Repository for Active Directory domain configuration.

use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::ad_domain::{AdDomain, CreateAdDomain};

/// Repository for `ad_domains` table operations.
pub struct AdDomainRepository;

impl AdDomainRepository {
    /// Create a new AD domain record.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the INSERT fails (e.g., duplicate `tenant_id` + `dns_name`).
    pub async fn create(
        pool: &PgPool,
        tenant_id: Uuid,
        input: CreateAdDomain,
        domain_sid: &str,
        realm: &str,
    ) -> Result<AdDomain> {
        let domain = sqlx::query_as::<_, AdDomain>(
            r#"
            INSERT INTO ad_domains (
                tenant_id, tree_id, dns_name, netbios_name, domain_sid, realm
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
            "#,
        )
        .bind(tenant_id)
        .bind(input.tree_id)
        .bind(&input.dns_name)
        .bind(&input.netbios_name)
        .bind(domain_sid)
        .bind(realm)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(domain)
    }

    /// Get an AD domain by its ID.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the query fails.
    pub async fn get(pool: &PgPool, id: Uuid) -> Result<Option<AdDomain>> {
        let domain = sqlx::query_as::<_, AdDomain>("SELECT * FROM ad_domains WHERE id = $1")
            .bind(id)
            .fetch_optional(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;

        Ok(domain)
    }

    /// Get an AD domain by tenant and DNS name.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the query fails.
    pub async fn get_by_dns_name(
        pool: &PgPool,
        tenant_id: Uuid,
        dns_name: &str,
    ) -> Result<Option<AdDomain>> {
        let domain = sqlx::query_as::<_, AdDomain>(
            "SELECT * FROM ad_domains WHERE tenant_id = $1 AND dns_name = $2",
        )
        .bind(tenant_id)
        .bind(dns_name)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(domain)
    }

    /// Get an AD domain by Kerberos realm.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the query fails.
    pub async fn get_by_realm(pool: &PgPool, realm: &str) -> Result<Option<AdDomain>> {
        let domain =
            sqlx::query_as::<_, AdDomain>("SELECT * FROM ad_domains WHERE realm = $1")
                .bind(realm)
                .fetch_optional(pool)
                .await
                .map_err(|e| Error::Database(e.to_string()))?;

        Ok(domain)
    }

    /// List all AD domains for a tenant, ordered by DNS name.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the query fails.
    pub async fn list_by_tenant(pool: &PgPool, tenant_id: Uuid) -> Result<Vec<AdDomain>> {
        let domains = sqlx::query_as::<_, AdDomain>(
            "SELECT * FROM ad_domains WHERE tenant_id = $1 ORDER BY dns_name",
        )
        .bind(tenant_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(domains)
    }

    /// Delete an AD domain by ID.
    ///
    /// Cascades to `ad_principal_keys` and `ad_dns_zones` via foreign key constraints.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the DELETE fails.
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM ad_domains WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;

        Ok(())
    }
}
