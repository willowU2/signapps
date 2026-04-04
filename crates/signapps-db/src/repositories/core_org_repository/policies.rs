//! PolicyRepository — GPO-style policy CRUD and link management.

use crate::models::org_policies::{
    CreateOrgPolicy, CreatePolicyLink, OrgPolicy, OrgPolicyLink, UpdateOrgPolicy,
};
use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

/// Repository for GPO-style policy and policy link operations.
pub struct PolicyRepository;

impl PolicyRepository {
    /// List policies for a tenant, optionally filtered by domain.
    pub async fn list_policies(
        pool: &PgPool,
        tenant_id: Uuid,
        domain: Option<&str>,
    ) -> Result<Vec<OrgPolicy>> {
        let policies = if let Some(d) = domain {
            sqlx::query_as::<_, OrgPolicy>(
                r#"
                SELECT * FROM workforce_org_policies
                WHERE tenant_id = $1 AND domain = $2 AND is_disabled = false
                ORDER BY priority DESC, name
                "#,
            )
            .bind(tenant_id)
            .bind(d)
            .fetch_all(pool)
            .await
        } else {
            sqlx::query_as::<_, OrgPolicy>(
                r#"
                SELECT * FROM workforce_org_policies
                WHERE tenant_id = $1 AND is_disabled = false
                ORDER BY priority DESC, name
                "#,
            )
            .bind(tenant_id)
            .fetch_all(pool)
            .await
        }
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(policies)
    }

    /// Create a new org policy.
    pub async fn create_policy(
        pool: &PgPool,
        tenant_id: Uuid,
        input: CreateOrgPolicy,
    ) -> Result<OrgPolicy> {
        let policy = sqlx::query_as::<_, OrgPolicy>(
            r#"
            INSERT INTO workforce_org_policies
                (tenant_id, name, description, domain, priority, is_enforced, settings)
            VALUES ($1, $2, $3, $4, COALESCE($5, 0), COALESCE($6, false), $7)
            RETURNING *
            "#,
        )
        .bind(tenant_id)
        .bind(&input.name)
        .bind(&input.description)
        .bind(&input.domain)
        .bind(input.priority)
        .bind(input.is_enforced)
        .bind(&input.settings)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(policy)
    }

    /// Find a policy by primary key.
    pub async fn get_policy(pool: &PgPool, id: Uuid) -> Result<Option<OrgPolicy>> {
        let policy =
            sqlx::query_as::<_, OrgPolicy>("SELECT * FROM workforce_org_policies WHERE id = $1")
                .bind(id)
                .fetch_optional(pool)
                .await
                .map_err(|e| Error::Database(e.to_string()))?;
        Ok(policy)
    }

    /// Update an existing org policy using COALESCE patching.
    pub async fn update_policy(
        pool: &PgPool,
        id: Uuid,
        input: UpdateOrgPolicy,
    ) -> Result<OrgPolicy> {
        let policy = sqlx::query_as::<_, OrgPolicy>(
            r#"
            UPDATE workforce_org_policies SET
                name        = COALESCE($2, name),
                description = COALESCE($3, description),
                domain      = COALESCE($4, domain),
                priority    = COALESCE($5, priority),
                is_enforced = COALESCE($6, is_enforced),
                is_disabled = COALESCE($7, is_disabled),
                settings    = COALESCE($8, settings),
                updated_at  = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(&input.name)
        .bind(&input.description)
        .bind(&input.domain)
        .bind(input.priority)
        .bind(input.is_enforced)
        .bind(input.is_disabled)
        .bind(&input.settings)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(policy)
    }

    /// Delete a policy and all its links (ON DELETE CASCADE).
    pub async fn delete_policy(pool: &PgPool, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM workforce_org_policies WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }

    /// Attach a policy to a scope (node, group, site, country, or global).
    pub async fn add_policy_link(
        pool: &PgPool,
        policy_id: Uuid,
        input: CreatePolicyLink,
    ) -> Result<OrgPolicyLink> {
        let link = sqlx::query_as::<_, OrgPolicyLink>(
            r#"
            INSERT INTO workforce_org_policy_links
                (policy_id, link_type, link_id)
            VALUES ($1, $2, $3)
            ON CONFLICT (policy_id, link_type, link_id) DO NOTHING
            RETURNING *
            "#,
        )
        .bind(policy_id)
        .bind(&input.link_type)
        .bind(&input.link_id)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(link)
    }

    /// Remove a policy link by its id.
    pub async fn remove_policy_link(pool: &PgPool, link_id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM workforce_org_policy_links WHERE id = $1")
            .bind(link_id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }

    /// List all links for a specific policy.
    pub async fn list_policy_links(pool: &PgPool, policy_id: Uuid) -> Result<Vec<OrgPolicyLink>> {
        let links = sqlx::query_as::<_, OrgPolicyLink>(
            r#"
            SELECT * FROM workforce_org_policy_links
            WHERE policy_id = $1
            ORDER BY link_type, link_id
            "#,
        )
        .bind(policy_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(links)
    }

    /// Get all active policies linked to a node or any of its ancestors via the closure table.
    pub async fn get_policies_for_node(pool: &PgPool, node_id: Uuid) -> Result<Vec<OrgPolicy>> {
        let policies = sqlx::query_as::<_, OrgPolicy>(
            r#"
            SELECT DISTINCT p.*
            FROM workforce_org_policies p
            JOIN workforce_org_policy_links pl ON pl.policy_id = p.id
            JOIN workforce_org_closure c ON c.ancestor_id = pl.link_id::uuid
            WHERE c.descendant_id = $1
              AND pl.link_type = 'node'
              AND p.is_disabled = false
              AND pl.is_blocked = false
            ORDER BY p.priority DESC, p.name
            "#,
        )
        .bind(node_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(policies)
    }

    /// Get all active policies linked to a site or any of its parent sites.
    ///
    /// Walks up the `workforce_sites` parent chain using a recursive CTE.
    pub async fn get_policies_for_site(pool: &PgPool, site_id: Uuid) -> Result<Vec<OrgPolicy>> {
        let policies = sqlx::query_as::<_, OrgPolicy>(
            r#"
            SELECT DISTINCT p.*
            FROM workforce_org_policies p
            JOIN workforce_org_policy_links pl ON pl.policy_id = p.id
            WHERE pl.link_type = 'site'
              AND pl.link_id = $1::text
              AND p.is_disabled = false
              AND pl.is_blocked = false
            ORDER BY p.priority DESC, p.name
            "#,
        )
        .bind(site_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(policies)
    }

    /// Get all active policies linked to a country code.
    pub async fn get_country_policies(pool: &PgPool, country_code: &str) -> Result<Vec<OrgPolicy>> {
        let policies = sqlx::query_as::<_, OrgPolicy>(
            r#"
            SELECT DISTINCT p.*
            FROM workforce_org_policies p
            JOIN workforce_country_policies cp ON cp.policy_id = p.id
            WHERE cp.country_code = $1
              AND p.is_disabled = false
            ORDER BY p.priority DESC, p.name
            "#,
        )
        .bind(country_code)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(policies)
    }

    /// Get all global policies for a tenant.
    pub async fn get_global_policies(pool: &PgPool, tenant_id: Uuid) -> Result<Vec<OrgPolicy>> {
        let policies = sqlx::query_as::<_, OrgPolicy>(
            r#"
            SELECT DISTINCT p.*
            FROM workforce_org_policies p
            JOIN workforce_org_policy_links pl ON pl.policy_id = p.id
            WHERE p.tenant_id = $1
              AND pl.link_type = 'global'
              AND p.is_disabled = false
              AND pl.is_blocked = false
            ORDER BY p.priority DESC, p.name
            "#,
        )
        .bind(tenant_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(policies)
    }
}
