//! Database access layer for the `sharing.*` schema.
//!
//! [`SharingRepository`] provides CRUD operations for all sharing tables:
//! grants, policies, templates, capabilities, default visibility, and the
//! audit log.
//!
//! All queries enforce tenant isolation via `WHERE tenant_id = $N` and filter
//! expired grants with `AND (expires_at IS NULL OR expires_at > NOW())`.

use chrono::{DateTime, Utc};
use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::{AuditEntry, Capability, DefaultVisibility, Grant, Policy, Template};

// ─── CreateGrantInput ────────────────────────────────────────────────────────

/// Input bundle for [`SharingRepository::create_grant`].
///
/// Groups the 8+ individual parameters into a single struct to comply with
/// the function-argument-count limit.
pub struct CreateGrantInput<'a> {
    /// Tenant scope for this grant.
    pub tenant_id: Uuid,
    /// The resource type (e.g. `"file"`, `"folder"`).
    pub resource_type: &'a str,
    /// The specific resource instance.
    pub resource_id: Uuid,
    /// The kind of grantee (`"user"`, `"group"`, `"org_node"`, `"everyone"`).
    pub grantee_type: &'a str,
    /// The grantee UUID, or `None` for `"everyone"` grants.
    pub grantee_id: Option<Uuid>,
    /// The role to assign (e.g. `"viewer"`, `"editor"`, `"manager"`, `"deny"`).
    pub role: &'a str,
    /// Whether the grantee may re-share the resource.
    pub can_reshare: Option<bool>,
    /// Optional expiry after which the grant is no longer active.
    pub expires_at: Option<DateTime<Utc>>,
    /// The actor who is creating this grant.
    pub granted_by: Uuid,
}

// ─── SharingRepository ────────────────────────────────────────────────────────

/// Repository for all `sharing.*` table operations.
///
/// Methods accept a `&PgPool` as first parameter (unit-struct pattern) so
/// callers can pass any pooled connection without holding a repository object.
pub struct SharingRepository;

// ─── Grants ───────────────────────────────────────────────────────────────────

impl SharingRepository {
    /// List all active (non-expired) grants on a resource.
    ///
    /// # Errors
    ///
    /// Returns [`Error::Database`] if the query fails.
    pub async fn list_grants(
        pool: &PgPool,
        tenant_id: Uuid,
        resource_type: &str,
        resource_id: Uuid,
    ) -> Result<Vec<Grant>> {
        sqlx::query_as::<_, Grant>(
            r#"SELECT * FROM sharing.grants
               WHERE tenant_id     = $1
                 AND resource_type = $2
                 AND resource_id   = $3
                 AND (expires_at IS NULL OR expires_at > NOW())
               ORDER BY created_at ASC"#,
        )
        .bind(tenant_id)
        .bind(resource_type)
        .bind(resource_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// Find grants matching specific grantees (user / group / org_node axes).
    ///
    /// Used by the resolver to find grants for a user's direct identity and
    /// memberships in one query.
    ///
    /// # Errors
    ///
    /// Returns [`Error::Database`] if the query fails.
    pub async fn find_grants_for_grantee(
        pool: &PgPool,
        tenant_id: Uuid,
        resource_type: &str,
        resource_id: Uuid,
        grantee_type: &str,
        grantee_ids: &[Uuid],
    ) -> Result<Vec<Grant>> {
        sqlx::query_as::<_, Grant>(
            r#"SELECT * FROM sharing.grants
               WHERE tenant_id     = $1
                 AND resource_type = $2
                 AND resource_id   = $3
                 AND grantee_type  = $4
                 AND grantee_id    = ANY($5)
                 AND (expires_at IS NULL OR expires_at > NOW())
               ORDER BY created_at ASC"#,
        )
        .bind(tenant_id)
        .bind(resource_type)
        .bind(resource_id)
        .bind(grantee_type)
        .bind(grantee_ids)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// Find tenant-wide `everyone` grants for a resource.
    ///
    /// # Errors
    ///
    /// Returns [`Error::Database`] if the query fails.
    pub async fn find_everyone_grants(
        pool: &PgPool,
        tenant_id: Uuid,
        resource_type: &str,
        resource_id: Uuid,
    ) -> Result<Vec<Grant>> {
        sqlx::query_as::<_, Grant>(
            r#"SELECT * FROM sharing.grants
               WHERE tenant_id     = $1
                 AND resource_type = $2
                 AND resource_id   = $3
                 AND grantee_type  = 'everyone'
                 AND (expires_at IS NULL OR expires_at > NOW())
               ORDER BY created_at ASC"#,
        )
        .bind(tenant_id)
        .bind(resource_type)
        .bind(resource_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// Check whether any deny grant exists for the given user / groups / org nodes.
    ///
    /// Returns `true` if at least one active deny-role grant targets the user
    /// directly, any of their groups, or any of their org-node ancestors.
    ///
    /// # Errors
    ///
    /// Returns [`Error::Database`] if the query fails.
    pub async fn has_deny(
        pool: &PgPool,
        tenant_id: Uuid,
        resource_type: &str,
        resource_id: Uuid,
        user_id: Uuid,
        group_ids: &[Uuid],
        org_node_ids: &[Uuid],
    ) -> Result<bool> {
        let count: i64 = sqlx::query_scalar(
            r#"SELECT COUNT(*) FROM sharing.grants
               WHERE tenant_id     = $1
                 AND resource_type = $2
                 AND resource_id   = $3
                 AND role          = 'deny'
                 AND (expires_at IS NULL OR expires_at > NOW())
                 AND (
                       (grantee_type = 'user'     AND grantee_id = $4)
                    OR (grantee_type = 'group'    AND grantee_id = ANY($5))
                    OR (grantee_type = 'org_node' AND grantee_id = ANY($6))
                    OR  grantee_type = 'everyone'
                 )"#,
        )
        .bind(tenant_id)
        .bind(resource_type)
        .bind(resource_id)
        .bind(user_id)
        .bind(group_ids)
        .bind(org_node_ids)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(count > 0)
    }

    /// Insert a new grant and return the created row.
    ///
    /// # Errors
    ///
    /// Returns [`Error::Database`] if the insert fails (e.g. constraint
    /// violation).
    pub async fn create_grant(pool: &PgPool, input: CreateGrantInput<'_>) -> Result<Grant> {
        sqlx::query_as::<_, Grant>(
            r#"INSERT INTO sharing.grants
                   (tenant_id, resource_type, resource_id,
                    grantee_type, grantee_id, role,
                    can_reshare, expires_at, granted_by)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
               RETURNING *"#,
        )
        .bind(input.tenant_id)
        .bind(input.resource_type)
        .bind(input.resource_id)
        .bind(input.grantee_type)
        .bind(input.grantee_id)
        .bind(input.role)
        .bind(input.can_reshare)
        .bind(input.expires_at)
        .bind(input.granted_by)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// Atomically update role, `can_reshare`, and `expires_at` on an existing
    /// grant within a tenant. Returns the updated grant, or `None` when the
    /// grant does not exist or belongs to another tenant.
    ///
    /// Replaces the previous revoke-then-create pattern so that the caller
    /// never loses access when the subsequent `create_grant` would fail.
    ///
    /// # Errors
    ///
    /// Returns [`Error::Database`] if the `UPDATE` fails.
    pub async fn update_grant_role(
        pool: &PgPool,
        tenant_id: Uuid,
        grant_id: Uuid,
        new_role: &str,
        new_can_reshare: Option<bool>,
        new_expires_at: Option<DateTime<Utc>>,
    ) -> Result<Option<Grant>> {
        sqlx::query_as::<_, Grant>(
            r#"UPDATE sharing.grants
               SET role        = $3,
                   can_reshare = COALESCE($4, can_reshare),
                   expires_at  = $5,
                   updated_at  = NOW()
               WHERE id = $1 AND tenant_id = $2
               RETURNING *"#,
        )
        .bind(grant_id)
        .bind(tenant_id)
        .bind(new_role)
        .bind(new_can_reshare)
        .bind(new_expires_at)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// Delete a grant by ID within a tenant. Returns `true` if a row was deleted.
    ///
    /// # Errors
    ///
    /// Returns [`Error::Database`] if the delete fails.
    pub async fn delete_grant(pool: &PgPool, tenant_id: Uuid, grant_id: Uuid) -> Result<bool> {
        let result = sqlx::query("DELETE FROM sharing.grants WHERE tenant_id = $1 AND id = $2")
            .bind(tenant_id)
            .bind(grant_id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;

        Ok(result.rows_affected() > 0)
    }

    /// Return all active grants targeting a user across all three axes.
    ///
    /// Finds grants where:
    /// - `grantee_type = 'user'` and `grantee_id = user_id`, OR
    /// - `grantee_type = 'group'` and `grantee_id` is in `group_ids`, OR
    /// - `grantee_type = 'org_node'` and `grantee_id` is in `org_node_ids`, OR
    /// - `grantee_type = 'everyone'`
    ///
    /// Pass `resource_type_filter = Some("file")` to restrict to one type.
    ///
    /// # Errors
    ///
    /// Returns [`Error::Database`] if the query fails.
    pub async fn shared_with_user(
        pool: &PgPool,
        tenant_id: Uuid,
        user_id: Uuid,
        group_ids: &[Uuid],
        org_node_ids: &[Uuid],
        resource_type_filter: Option<&str>,
    ) -> Result<Vec<Grant>> {
        sqlx::query_as::<_, Grant>(
            r#"SELECT * FROM sharing.grants
               WHERE tenant_id = $1
                 AND (expires_at IS NULL OR expires_at > NOW())
                 AND ($5::text IS NULL OR resource_type = $5)
                 AND (
                       (grantee_type = 'user'     AND grantee_id = $2)
                    OR (grantee_type = 'group'    AND grantee_id = ANY($3))
                    OR (grantee_type = 'org_node' AND grantee_id = ANY($4))
                    OR  grantee_type = 'everyone'
                 )
               ORDER BY created_at ASC"#,
        )
        .bind(tenant_id)
        .bind(user_id)
        .bind(group_ids)
        .bind(org_node_ids)
        .bind(resource_type_filter)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    // ─── Policies ─────────────────────────────────────────────────────────────

    /// List all policies for a container within a tenant.
    ///
    /// Pass `container_type` and/or `container_id` to filter results.
    ///
    /// # Errors
    ///
    /// Returns [`Error::Database`] if the query fails.
    pub async fn list_policies(
        pool: &PgPool,
        tenant_id: Uuid,
        container_type: Option<&str>,
        container_id: Option<Uuid>,
    ) -> Result<Vec<Policy>> {
        sqlx::query_as::<_, Policy>(
            r#"SELECT * FROM sharing.policies
               WHERE tenant_id = $1
                 AND ($2::text IS NULL OR container_type = $2)
                 AND ($3::uuid IS NULL OR container_id = $3)
               ORDER BY created_at ASC"#,
        )
        .bind(tenant_id)
        .bind(container_type)
        .bind(container_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// Insert a new policy and return the created row.
    ///
    /// # Errors
    ///
    /// Returns [`Error::Database`] if the insert fails.
    #[allow(clippy::too_many_arguments)]
    pub async fn create_policy(
        pool: &PgPool,
        tenant_id: Uuid,
        container_type: &str,
        container_id: Uuid,
        grantee_type: &str,
        grantee_id: Option<Uuid>,
        default_role: &str,
        can_reshare: bool,
        apply_to_existing: bool,
        created_by: Uuid,
    ) -> Result<Policy> {
        sqlx::query_as::<_, Policy>(
            r#"INSERT INTO sharing.policies
                   (tenant_id, container_type, container_id,
                    grantee_type, grantee_id, default_role,
                    can_reshare, apply_to_existing, created_by)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
               RETURNING *"#,
        )
        .bind(tenant_id)
        .bind(container_type)
        .bind(container_id)
        .bind(grantee_type)
        .bind(grantee_id)
        .bind(default_role)
        .bind(can_reshare)
        .bind(apply_to_existing)
        .bind(created_by)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// Delete a policy by ID within a tenant. Returns `true` if deleted.
    ///
    /// # Errors
    ///
    /// Returns [`Error::Database`] if the delete fails.
    pub async fn delete_policy(pool: &PgPool, tenant_id: Uuid, policy_id: Uuid) -> Result<bool> {
        let result = sqlx::query("DELETE FROM sharing.policies WHERE tenant_id = $1 AND id = $2")
            .bind(tenant_id)
            .bind(policy_id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;

        Ok(result.rows_affected() > 0)
    }

    // ─── Templates ────────────────────────────────────────────────────────────

    /// List all sharing templates for a tenant.
    ///
    /// # Errors
    ///
    /// Returns [`Error::Database`] if the query fails.
    pub async fn list_templates(pool: &PgPool, tenant_id: Uuid) -> Result<Vec<Template>> {
        sqlx::query_as::<_, Template>(
            r#"SELECT * FROM sharing.templates
               WHERE tenant_id = $1
               ORDER BY name ASC"#,
        )
        .bind(tenant_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// Insert a new sharing template and return the created row.
    ///
    /// # Errors
    ///
    /// Returns [`Error::Database`] if the insert fails.
    pub async fn create_template(
        pool: &PgPool,
        tenant_id: Uuid,
        created_by: Uuid,
        name: &str,
        description: Option<&str>,
        grants: serde_json::Value,
    ) -> Result<Template> {
        sqlx::query_as::<_, Template>(
            r#"INSERT INTO sharing.templates
                   (tenant_id, created_by, name, description, grants)
               VALUES ($1, $2, $3, $4, $5)
               RETURNING *"#,
        )
        .bind(tenant_id)
        .bind(created_by)
        .bind(name)
        .bind(description)
        .bind(grants)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// Delete a non-system template by ID within a tenant.
    ///
    /// Returns `true` if a row was deleted.  Returns `false` when the template
    /// does not exist or has `is_system = true` (system templates are protected).
    ///
    /// # Errors
    ///
    /// Returns [`Error::Database`] if the delete fails.
    pub async fn delete_template(
        pool: &PgPool,
        tenant_id: Uuid,
        template_id: Uuid,
    ) -> Result<bool> {
        let result = sqlx::query(
            "DELETE FROM sharing.templates WHERE id = $1 AND tenant_id = $2 AND is_system = false",
        )
        .bind(template_id)
        .bind(tenant_id)
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(result.rows_affected() > 0)
    }

    /// Fetch a single template by ID within a tenant.
    ///
    /// # Errors
    ///
    /// Returns [`Error::Database`] if the query fails.
    pub async fn get_template(
        pool: &PgPool,
        tenant_id: Uuid,
        template_id: Uuid,
    ) -> Result<Option<Template>> {
        sqlx::query_as::<_, Template>(
            "SELECT * FROM sharing.templates WHERE tenant_id = $1 AND id = $2",
        )
        .bind(tenant_id)
        .bind(template_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    // ─── Capabilities ─────────────────────────────────────────────────────────

    /// Fetch the capability definition for a (resource_type, role) pair.
    ///
    /// # Errors
    ///
    /// Returns [`Error::Database`] if the query fails.
    pub async fn get_capabilities(
        pool: &PgPool,
        resource_type: &str,
        role: &str,
    ) -> Result<Option<Capability>> {
        sqlx::query_as::<_, Capability>(
            r#"SELECT * FROM sharing.capabilities
               WHERE resource_type = $1 AND role = $2"#,
        )
        .bind(resource_type)
        .bind(role)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    // ─── Default Visibility ───────────────────────────────────────────────────

    /// Fetch the default visibility setting for a resource type within a tenant.
    ///
    /// # Errors
    ///
    /// Returns [`Error::Database`] if the query fails.
    pub async fn get_default_visibility(
        pool: &PgPool,
        tenant_id: Uuid,
        resource_type: &str,
    ) -> Result<Option<DefaultVisibility>> {
        sqlx::query_as::<_, DefaultVisibility>(
            r#"SELECT * FROM sharing.defaults
               WHERE tenant_id = $1 AND resource_type = $2"#,
        )
        .bind(tenant_id)
        .bind(resource_type)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    // ─── Audit ────────────────────────────────────────────────────────────────

    /// Insert an immutable audit log entry and return the created row.
    ///
    /// # Errors
    ///
    /// Returns [`Error::Database`] if the insert fails.
    pub async fn insert_audit(
        pool: &PgPool,
        tenant_id: Uuid,
        resource_type: &str,
        resource_id: Uuid,
        actor_id: Uuid,
        action: &str,
        details: serde_json::Value,
    ) -> Result<AuditEntry> {
        sqlx::query_as::<_, AuditEntry>(
            r#"INSERT INTO sharing.audit_log
                   (tenant_id, resource_type, resource_id, actor_id, action, details)
               VALUES ($1, $2, $3, $4, $5, $6)
               RETURNING *"#,
        )
        .bind(tenant_id)
        .bind(resource_type)
        .bind(resource_id)
        .bind(actor_id)
        .bind(action)
        .bind(details)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// List recent audit log entries for a tenant (all resources), newest first.
    ///
    /// # Errors
    ///
    /// Returns [`Error::Database`] if the query fails.
    pub async fn list_audit_by_tenant(
        pool: &PgPool,
        tenant_id: Uuid,
        limit: i64,
    ) -> Result<Vec<AuditEntry>> {
        sqlx::query_as::<_, AuditEntry>(
            r#"SELECT * FROM sharing.audit_log
               WHERE tenant_id = $1
               ORDER BY created_at DESC
               LIMIT $2"#,
        )
        .bind(tenant_id)
        .bind(limit)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// List recent audit log entries for a resource, newest first.
    ///
    /// # Errors
    ///
    /// Returns [`Error::Database`] if the query fails.
    pub async fn list_audit(
        pool: &PgPool,
        tenant_id: Uuid,
        resource_type: &str,
        resource_id: Uuid,
        limit: i64,
    ) -> Result<Vec<AuditEntry>> {
        sqlx::query_as::<_, AuditEntry>(
            r#"SELECT * FROM sharing.audit_log
               WHERE tenant_id     = $1
                 AND resource_type = $2
                 AND resource_id   = $3
               ORDER BY created_at DESC
               LIMIT $4"#,
        )
        .bind(tenant_id)
        .bind(resource_type)
        .bind(resource_id)
        .bind(limit)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // Unit tests for SharingRepository require a live database connection.
    // Integration tests live in tests/integration_*.rs with a test PgPool.

    #[test]
    fn sharing_repository_is_zero_sized() {
        assert_eq!(std::mem::size_of::<SharingRepository>(), 0);
    }
}
