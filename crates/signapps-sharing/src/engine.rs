//! High-level public API for the sharing engine.
//!
//! [`SharingEngine`] is the main entry point that services inject into their
//! Axum [`State`]. It orchestrates the repository, resolver, cache, and
//! audit logger into a single coherent API.
//!
//! # Example
//!
//! ```rust,ignore
//! use signapps_sharing::engine::SharingEngine;
//! use signapps_sharing::types::{ResourceRef, Action};
//! use signapps_cache::CacheService;
//!
//! let engine = SharingEngine::new(pool.clone(), CacheService::default_config());
//! engine.check(&user_ctx, ResourceRef::file(file_id), Action::read(), None).await?;
//! ```

use signapps_cache::CacheService;
use signapps_common::{Claims, Error, Result};
use sqlx::PgPool;
use tracing::instrument;
use uuid::Uuid;

use crate::audit::AuditLogger;
use crate::cache::SharingCache;
use crate::models::{CreateGrant, EffectivePermission, Grant, UserContext};
use crate::repository::SharingRepository;
use crate::resolver::PermissionResolver;
use crate::types::{Action, GranteeType, ResourceRef, ResourceType, Role};

// ─── SharingEngine ────────────────────────────────────────────────────────────

/// Main public API for the sharing / permission subsystem.
///
/// Owns a [`PgPool`] and a [`SharingCache`]; both are cheaply cloneable so
/// the engine can be stored in Axum [`State`] and cloned per-request.
///
/// # Examples
///
/// ```rust,ignore
/// use signapps_sharing::engine::SharingEngine;
/// use signapps_cache::CacheService;
///
/// let engine = SharingEngine::new(pool, CacheService::default_config());
/// ```
#[derive(Clone)]
pub struct SharingEngine {
    pool: PgPool,
    cache: SharingCache,
}

impl SharingEngine {
    /// Create a new engine backed by `pool` and `cache`.
    pub fn new(pool: PgPool, cache: CacheService) -> Self {
        Self { pool, cache: SharingCache::new(cache) }
    }

    // ─── Permission checks ────────────────────────────────────────────────

    /// Check that `action` is allowed for `user_ctx` on `resource`.
    ///
    /// Returns `Ok(())` if the action is permitted.
    ///
    /// # Errors
    ///
    /// - [`Error::Forbidden`] — action not permitted or access explicitly denied.
    /// - [`Error::Database`] — a repository call failed.
    ///
    /// # Panics
    ///
    /// No panics — all errors are propagated via `Result`.
    #[instrument(skip(self, user_ctx), fields(
        user_id  = %user_ctx.user_id,
        resource = %resource,
        action   = %action,
    ))]
    pub async fn check(
        &self,
        user_ctx: &UserContext,
        resource: ResourceRef,
        action: Action,
        owner_id: Option<Uuid>,
    ) -> Result<()> {
        let resolver = PermissionResolver::new(&self.pool);
        resolver.check_action(user_ctx, &resource, owner_id, &action).await
    }

    /// Resolve the effective permission for `user_ctx` on `resource`.
    ///
    /// Returns `None` when the user has no access to the resource.
    ///
    /// # Errors
    ///
    /// - [`Error::Database`] — a repository call failed.
    ///
    /// # Panics
    ///
    /// No panics — all errors are propagated via `Result`.
    #[instrument(skip(self, user_ctx), fields(
        user_id  = %user_ctx.user_id,
        resource = %resource,
    ))]
    pub async fn effective_role(
        &self,
        user_ctx: &UserContext,
        resource: ResourceRef,
        owner_id: Option<Uuid>,
    ) -> Result<Option<EffectivePermission>> {
        let resolver = PermissionResolver::new(&self.pool);
        resolver.resolve(user_ctx, &resource, owner_id).await
    }

    // ─── Grant management ─────────────────────────────────────────────────

    /// Create a new permission grant on `resource`.
    ///
    /// The `actor_ctx` must hold at least `Manager` role on the resource (or be
    /// the resource owner / admin) to create a grant.  Non-owners may only
    /// grant access if their own grant has `can_reshare = true`.
    ///
    /// Vault entries (`ResourceType::VaultEntry`) may not be granted to
    /// `Everyone`; that combination is rejected with [`Error::BadRequest`].
    ///
    /// # Errors
    ///
    /// - [`Error::Forbidden`] — actor lacks permission to grant access.
    /// - [`Error::BadRequest`] — vault entry + everyone combination rejected.
    /// - [`Error::Database`] — a repository call failed.
    ///
    /// # Panics
    ///
    /// No panics — all errors are propagated via `Result`.
    #[instrument(skip(self, actor_ctx, request), fields(
        actor_id    = %actor_ctx.user_id,
        resource    = %resource,
        grantee     = ?request.grantee_type,
    ))]
    pub async fn grant(
        &self,
        actor_ctx: &UserContext,
        resource: ResourceRef,
        owner_id: Option<Uuid>,
        request: CreateGrant,
    ) -> Result<Grant> {
        // Validate: vault_entry may not be granted to everyone.
        if resource.resource_type == ResourceType::VaultEntry
            && request.grantee_type == GranteeType::Everyone
        {
            return Err(Error::BadRequest(
                "vault_entry resources cannot be granted to 'everyone'".into(),
            ));
        }

        // Verify actor has manager role or is admin.
        let resolver = PermissionResolver::new(&self.pool);
        let effective = resolver.resolve(actor_ctx, &resource, owner_id).await?;

        let can_grant = actor_ctx.is_admin()
            || effective
                .as_ref()
                .is_some_and(|ep| ep.role == Role::Manager);

        if !can_grant {
            // Non-manager: check can_reshare flag.
            let can_reshare = effective.as_ref().is_some_and(|ep| ep.can_reshare);
            if !can_reshare {
                return Err(Error::Forbidden(format!(
                    "actor {} is not allowed to grant access on {}",
                    actor_ctx.user_id, resource
                )));
            }
        }

        // Create the grant.
        let grant = SharingRepository::create_grant(
            &self.pool,
            actor_ctx.tenant_id,
            resource.resource_type.as_str(),
            resource.resource_id,
            request.grantee_type.as_str(),
            request.resolved_grantee_id(),
            request.role.as_str(),
            request.can_reshare,
            request.expires_at,
            actor_ctx.user_id,
        )
        .await?;

        // Audit log.
        let logger = AuditLogger::new(&self.pool);
        logger
            .log_grant_created(
                actor_ctx.tenant_id,
                resource.resource_type.as_str(),
                resource.resource_id,
                actor_ctx.user_id,
                grant.id,
                &grant.grantee_type,
                grant.grantee_id,
                &grant.role,
            )
            .await?;

        // Invalidate L2 cache for this resource.
        self.cache
            .invalidate_resource(resource.resource_type.as_str(), resource.resource_id);

        Ok(grant)
    }

    /// Revoke a specific grant by ID.
    ///
    /// The `actor_ctx` must hold at least `Manager` role (or be admin) to
    /// revoke grants on the resource.
    ///
    /// # Errors
    ///
    /// - [`Error::Forbidden`] — actor lacks permission to revoke grants.
    /// - [`Error::NotFound`] — the grant does not exist.
    /// - [`Error::Database`] — a repository call failed.
    ///
    /// # Panics
    ///
    /// No panics — all errors are propagated via `Result`.
    #[instrument(skip(self, actor_ctx), fields(
        actor_id = %actor_ctx.user_id,
        resource = %resource,
        grant_id = %grant_id,
    ))]
    pub async fn revoke(
        &self,
        actor_ctx: &UserContext,
        resource: ResourceRef,
        owner_id: Option<Uuid>,
        grant_id: Uuid,
    ) -> Result<()> {
        // Verify actor has manager role or is admin.
        let resolver = PermissionResolver::new(&self.pool);
        let effective = resolver.resolve(actor_ctx, &resource, owner_id).await?;

        let can_revoke = actor_ctx.is_admin()
            || effective.is_some_and(|ep| ep.role == Role::Manager);

        if !can_revoke {
            return Err(Error::Forbidden(format!(
                "actor {} is not allowed to revoke grants on {}",
                actor_ctx.user_id, resource
            )));
        }

        let deleted =
            SharingRepository::delete_grant(&self.pool, actor_ctx.tenant_id, grant_id).await?;

        if !deleted {
            return Err(Error::NotFound(format!("grant {grant_id} not found")));
        }

        // Audit log.
        let logger = AuditLogger::new(&self.pool);
        logger
            .log_grant_revoked(
                actor_ctx.tenant_id,
                resource.resource_type.as_str(),
                resource.resource_id,
                actor_ctx.user_id,
                grant_id,
            )
            .await?;

        // Invalidate L2 cache for this resource.
        self.cache
            .invalidate_resource(resource.resource_type.as_str(), resource.resource_id);

        Ok(())
    }

    // ─── Listing ──────────────────────────────────────────────────────────

    /// List all active grants on `resource`.
    ///
    /// Any authenticated user can list grants (the list may be used to show
    /// who has access); the caller is responsible for filtering what to display.
    ///
    /// # Errors
    ///
    /// - [`Error::Database`] — a repository call failed.
    ///
    /// # Panics
    ///
    /// No panics — all errors are propagated via `Result`.
    #[instrument(skip(self, user_ctx), fields(
        user_id  = %user_ctx.user_id,
        resource = %resource,
    ))]
    pub async fn list_grants(
        &self,
        user_ctx: &UserContext,
        resource: ResourceRef,
    ) -> Result<Vec<Grant>> {
        SharingRepository::list_grants(
            &self.pool,
            user_ctx.tenant_id,
            resource.resource_type.as_str(),
            resource.resource_id,
        )
        .await
    }

    /// List all resources shared with the calling user (across all axes).
    ///
    /// Pass `resource_type_filter` to restrict results to a single resource type.
    ///
    /// # Errors
    ///
    /// - [`Error::Database`] — a repository call failed.
    ///
    /// # Panics
    ///
    /// No panics — all errors are propagated via `Result`.
    #[instrument(skip(self, user_ctx), fields(user_id = %user_ctx.user_id))]
    pub async fn shared_with_me(
        &self,
        user_ctx: &UserContext,
        resource_type_filter: Option<ResourceType>,
    ) -> Result<Vec<Grant>> {
        let filter_str = resource_type_filter.map(|rt| rt.as_str());
        SharingRepository::shared_with_user(
            &self.pool,
            user_ctx.tenant_id,
            user_ctx.user_id,
            &user_ctx.group_ids,
            &user_ctx.org_ancestors,
            filter_str,
        )
        .await
    }

    // ─── Templates ────────────────────────────────────────────────────────

    /// Apply a sharing template to `resource`.
    ///
    /// Parses the template's `grants` JSON array, creates each grant in
    /// sequence, audits the batch operation, and invalidates the L2 cache.
    ///
    /// Returns the number of grants successfully created.
    ///
    /// # Errors
    ///
    /// - [`Error::Forbidden`] — actor lacks manager role.
    /// - [`Error::NotFound`] — template not found.
    /// - [`Error::BadRequest`] — template `grants` JSON is malformed.
    /// - [`Error::Database`] — a repository call failed.
    ///
    /// # Panics
    ///
    /// No panics — all errors are propagated via `Result`.
    #[instrument(skip(self, actor_ctx), fields(
        actor_id    = %actor_ctx.user_id,
        resource    = %resource,
        template_id = %template_id,
    ))]
    pub async fn apply_template(
        &self,
        actor_ctx: &UserContext,
        resource: ResourceRef,
        owner_id: Option<Uuid>,
        template_id: Uuid,
    ) -> Result<usize> {
        // Verify actor is manager or admin.
        let resolver = PermissionResolver::new(&self.pool);
        let effective = resolver.resolve(actor_ctx, &resource, owner_id).await?;

        let can_apply = actor_ctx.is_admin()
            || effective.is_some_and(|ep| ep.role == Role::Manager);

        if !can_apply {
            return Err(Error::Forbidden(format!(
                "actor {} is not allowed to apply templates on {}",
                actor_ctx.user_id, resource
            )));
        }

        // Fetch template.
        let template =
            SharingRepository::get_template(&self.pool, actor_ctx.tenant_id, template_id)
                .await?
                .ok_or_else(|| Error::NotFound(format!("template {template_id} not found")))?;

        // Parse grants JSON array.
        let grant_defs: Vec<CreateGrant> =
            serde_json::from_value(template.grants.clone()).map_err(|e| {
                Error::BadRequest(format!("invalid template grants JSON: {e}"))
            })?;

        // Create each grant.
        let mut created = 0usize;
        for def in grant_defs {
            SharingRepository::create_grant(
                &self.pool,
                actor_ctx.tenant_id,
                resource.resource_type.as_str(),
                resource.resource_id,
                def.grantee_type.as_str(),
                def.resolved_grantee_id(),
                def.role.as_str(),
                def.can_reshare,
                def.expires_at,
                actor_ctx.user_id,
            )
            .await?;
            created += 1;
        }

        // Audit log.
        let logger = AuditLogger::new(&self.pool);
        logger
            .log_template_applied(
                actor_ctx.tenant_id,
                resource.resource_type.as_str(),
                resource.resource_id,
                actor_ctx.user_id,
                template_id,
                created,
            )
            .await?;

        // Invalidate L2 cache.
        self.cache
            .invalidate_resource(resource.resource_type.as_str(), resource.resource_id);

        Ok(created)
    }

    // ─── User context ─────────────────────────────────────────────────────

    /// Build a [`UserContext`] from JWT [`Claims`].
    ///
    /// Group IDs and org ancestors are fetched from cache when available,
    /// otherwise queried from the database via `identity.group_members` and
    /// `core.org_closure` / `core.assignments`.
    ///
    /// # Errors
    ///
    /// - [`Error::Forbidden`] — claims do not contain a `tenant_id`.
    /// - [`Error::Database`] — a DB query failed.
    ///
    /// # Panics
    ///
    /// No panics — all errors are propagated via `Result`.
    #[instrument(skip(self, claims), fields(user_id = %claims.sub))]
    pub async fn build_user_context(&self, claims: &Claims) -> Result<UserContext> {
        let user_id = claims.sub;
        let tenant_id = claims
            .tenant_id
            .ok_or_else(|| Error::Forbidden("JWT missing tenant_id".into()))?;
        let system_role = claims.role;

        // ── L1 cache: group IDs ──────────────────────────────────────────
        let group_ids = if let Some(ids) = self.cache.get_group_ids(user_id).await {
            ids
        } else {
            let ids = self.fetch_group_ids(user_id).await?;
            self.cache.set_group_ids(user_id, &ids).await;
            ids
        };

        // ── L1 cache: org ancestors ──────────────────────────────────────
        let org_ancestors = if let Some(ids) = self.cache.get_org_ancestors(user_id).await {
            ids
        } else {
            let ids = self.fetch_org_ancestors(user_id, tenant_id).await?;
            self.cache.set_org_ancestors(user_id, &ids).await;
            ids
        };

        // group_roles: not cached; leave empty for now (used for group-level
        // role display only, not for the core permission check).
        let group_roles = std::collections::HashMap::new();

        Ok(UserContext { user_id, tenant_id, group_ids, group_roles, org_ancestors, system_role })
    }

    // ─── Internal helpers ─────────────────────────────────────────────────

    /// Fetch group IDs for a user from the DB.
    ///
    /// Queries `identity.group_members UNION workforce.org_member_of` to cover
    /// both identity-managed groups and workforce org groups.
    ///
    /// # Errors
    ///
    /// Returns [`Error::Database`] if the query fails.
    async fn fetch_group_ids(&self, user_id: Uuid) -> Result<Vec<Uuid>> {
        let rows: Vec<(Uuid,)> = sqlx::query_as(
            r#"
            SELECT DISTINCT group_id
            FROM identity.group_members
            WHERE user_id = $1
            UNION
            SELECT DISTINCT group_id
            FROM workforce.org_member_of
            WHERE user_id = $1
            "#,
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(rows.into_iter().map(|(id,)| id).collect())
    }

    /// Fetch org-node ancestors for a user from the DB.
    ///
    /// Queries `core.org_closure` joined with `core.assignments` to find all
    /// ancestor org nodes the user is assigned to (direct + inherited).
    ///
    /// # Errors
    ///
    /// Returns [`Error::Database`] if the query fails.
    async fn fetch_org_ancestors(&self, user_id: Uuid, tenant_id: Uuid) -> Result<Vec<Uuid>> {
        let rows: Vec<(Uuid,)> = sqlx::query_as(
            r#"
            SELECT DISTINCT oc.ancestor_id
            FROM core.assignments a
            JOIN core.org_closure oc ON oc.descendant_id = a.org_node_id
            WHERE a.user_id   = $1
              AND a.tenant_id = $2
            "#,
        )
        .bind(user_id)
        .bind(tenant_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(rows.into_iter().map(|(id,)| id).collect())
    }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sharing_engine_is_clone() {
        // Compile-time check: SharingEngine must implement Clone.
        fn assert_clone<T: Clone>() {}
        assert_clone::<SharingEngine>();
    }
}
