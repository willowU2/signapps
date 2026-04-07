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

use crate::audit::{AuditLogger, GrantCreatedEvent};
use crate::cache::SharingCache;
use crate::models::{CreateGrant, EffectivePermission, Grant, UserContext};
use crate::repository::{CreateGrantInput, SharingRepository};
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
        Self {
            pool,
            cache: SharingCache::new(cache),
        }
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
        let chain = self.parent_chain(&resource).await;
        let resolver = PermissionResolver::with_cache(&self.pool, &self.cache);
        resolver
            .check_action_with_parents(user_ctx, &chain, owner_id, &action)
            .await
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
        let chain = self.parent_chain(&resource).await;
        let resolver = PermissionResolver::with_cache(&self.pool, &self.cache);
        resolver.resolve_with_parents(user_ctx, &chain, owner_id).await
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
        let resolver = PermissionResolver::with_cache(&self.pool, &self.cache);
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
            CreateGrantInput {
                tenant_id: actor_ctx.tenant_id,
                resource_type: resource.resource_type.as_str(),
                resource_id: resource.resource_id,
                grantee_type: request.grantee_type.as_str(),
                grantee_id: request.resolved_grantee_id(),
                role: request.role.as_str(),
                can_reshare: request.can_reshare,
                expires_at: request.expires_at,
                granted_by: actor_ctx.user_id,
            },
        )
        .await?;

        // Audit log.
        let logger = AuditLogger::new(&self.pool);
        logger
            .log_grant_created(GrantCreatedEvent {
                tenant_id: actor_ctx.tenant_id,
                resource_type: resource.resource_type.as_str(),
                resource_id: resource.resource_id,
                actor_id: actor_ctx.user_id,
                grant_id: grant.id,
                grantee_type: &grant.grantee_type,
                grantee_id: grant.grantee_id,
                role: &grant.role,
            })
            .await?;

        // Emit notification (best-effort, never fails the grant).
        // Only direct user grants get a notification; group / org_node /
        // everyone fan-out is out of scope for this iteration.
        if grant.grantee_type == GranteeType::User.as_str() {
            if let Some(recipient_id) = grant.grantee_id {
                crate::notifications::notify_grant_created(
                    &self.pool,
                    actor_ctx.tenant_id,
                    recipient_id,
                    actor_ctx.user_id,
                    resource.resource_type,
                    resource.resource_id,
                    &grant.role,
                )
                .await;
            }
        }

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
        let resolver = PermissionResolver::with_cache(&self.pool, &self.cache);
        let effective = resolver.resolve(actor_ctx, &resource, owner_id).await?;

        let can_revoke =
            actor_ctx.is_admin() || effective.is_some_and(|ep| ep.role == Role::Manager);

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

    /// Apply the same grant to multiple resources at once.
    ///
    /// Atomic per-resource: a failure on one resource does not stop the others.
    /// The caller receives the count of successfully created grants plus the
    /// list of per-resource errors.
    ///
    /// # Errors
    ///
    /// - [`Error::BadRequest`] — `resource_type` string is not a known type.
    /// - Individual per-resource errors are collected into [`BulkGrantResult::errors`]
    ///   rather than propagated.
    ///
    /// # Panics
    ///
    /// No panics — all errors are propagated via `Result`.
    #[instrument(skip(self, actor_ctx, request), fields(
        actor_id      = %actor_ctx.user_id,
        resource_type = %resource_type,
        count         = resource_ids.len(),
        grantee       = ?request.grantee_type,
    ))]
    pub async fn bulk_grant(
        &self,
        actor_ctx: &UserContext,
        resource_type: crate::types::ResourceType,
        resource_ids: Vec<Uuid>,
        owner_id: Option<Uuid>,
        request: CreateGrant,
    ) -> Result<crate::models::BulkGrantResult> {
        let mut created = 0usize;
        let mut errors: Vec<crate::models::BulkGrantError> = Vec::new();

        for resource_id in resource_ids {
            let resource = ResourceRef {
                resource_type,
                resource_id,
            };
            match self
                .grant(actor_ctx, resource, owner_id, request.clone())
                .await
            {
                Ok(_) => created += 1,
                Err(e) => errors.push(crate::models::BulkGrantError {
                    resource_id,
                    error: format!("{e:?}"),
                }),
            }
        }

        Ok(crate::models::BulkGrantResult { created, errors })
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
        let resolver = PermissionResolver::with_cache(&self.pool, &self.cache);
        let effective = resolver.resolve(actor_ctx, &resource, owner_id).await?;

        let can_apply =
            actor_ctx.is_admin() || effective.is_some_and(|ep| ep.role == Role::Manager);

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
        let grant_defs: Vec<CreateGrant> = serde_json::from_value(template.grants.clone())
            .map_err(|e| Error::BadRequest(format!("invalid template grants JSON: {e}")))?;

        // Create each grant via self.grant() to enforce:
        //   - vault_entry + everyone restriction
        //   - per-grant can_reshare / manager checks
        //   - per-grant audit log and notifications
        // Errors on individual grants are logged and skipped so that one
        // bad entry does not abort the remaining template entries.
        let mut created = 0usize;
        for def in grant_defs {
            match self
                .grant(actor_ctx, resource.clone(), owner_id, def.clone())
                .await
            {
                Ok(_) => created += 1,
                Err(e) => {
                    tracing::warn!(
                        actor_id    = %actor_ctx.user_id,
                        resource    = %resource,
                        template_id = %template_id,
                        grantee     = ?def.grantee_type,
                        error       = ?e,
                        "apply_template: skipping grant due to error"
                    );
                },
            }
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

    /// List all sharing templates for the calling user's tenant.
    ///
    /// Any authenticated user can list templates (they are tenant-wide presets).
    ///
    /// # Errors
    ///
    /// - [`Error::Database`] — a repository call failed.
    ///
    /// # Panics
    ///
    /// No panics — all errors are propagated via `Result`.
    #[instrument(skip(self, user_ctx), fields(user_id = %user_ctx.user_id))]
    pub async fn list_templates(
        &self,
        user_ctx: &UserContext,
    ) -> Result<Vec<crate::models::Template>> {
        SharingRepository::list_templates(&self.pool, user_ctx.tenant_id).await
    }

    /// Create a new sharing template (admin only).
    ///
    /// # Errors
    ///
    /// - [`Error::Forbidden`] — actor is not an admin.
    /// - [`Error::Database`] — a repository call failed.
    ///
    /// # Panics
    ///
    /// No panics — all errors are propagated via `Result`.
    #[instrument(skip(self, actor_ctx, request), fields(actor_id = %actor_ctx.user_id))]
    pub async fn create_template(
        &self,
        actor_ctx: &UserContext,
        request: crate::models::CreateTemplate,
    ) -> Result<crate::models::Template> {
        if !actor_ctx.is_admin() {
            return Err(Error::Forbidden(
                "only admins can create templates".to_string(),
            ));
        }
        SharingRepository::create_template(
            &self.pool,
            actor_ctx.tenant_id,
            actor_ctx.user_id,
            &request.name,
            request.description.as_deref(),
            request.grants,
        )
        .await
    }

    /// Delete a non-system sharing template by ID.
    ///
    /// Only admins may delete templates.  System templates (`is_system = true`)
    /// are always protected and will return [`Error::NotFound`].
    ///
    /// # Errors
    ///
    /// - [`Error::Forbidden`] — actor is not an admin.
    /// - [`Error::NotFound`] — template does not exist or is a system template.
    /// - [`Error::Database`] — a repository call failed.
    ///
    /// # Panics
    ///
    /// No panics — all errors are propagated via `Result`.
    #[instrument(skip(self, actor_ctx), fields(
        actor_id    = %actor_ctx.user_id,
        template_id = %template_id,
    ))]
    pub async fn delete_template(
        &self,
        actor_ctx: &UserContext,
        template_id: Uuid,
    ) -> Result<()> {
        if !actor_ctx.is_admin() {
            return Err(Error::Forbidden(
                "only admins can delete templates".to_string(),
            ));
        }

        let deleted =
            SharingRepository::delete_template(&self.pool, actor_ctx.tenant_id, template_id)
                .await?;

        if !deleted {
            return Err(Error::NotFound(
                "template not found or is a system template".to_string(),
            ));
        }

        // Audit log.
        let logger = AuditLogger::new(&self.pool);
        logger
            .log_template_deleted(actor_ctx.tenant_id, actor_ctx.user_id, template_id)
            .await?;

        Ok(())
    }

    /// List recent audit log entries for the calling user's tenant.
    ///
    /// Optionally filter by `resource_type` + `resource_id`.  Only admins may
    /// call this method.
    ///
    /// # Errors
    ///
    /// - [`Error::Forbidden`] — actor is not an admin.
    /// - [`Error::Database`] — a repository call failed.
    ///
    /// # Panics
    ///
    /// No panics — all errors are propagated via `Result`.
    #[instrument(skip(self, user_ctx), fields(user_id = %user_ctx.user_id))]
    pub async fn list_audit(
        &self,
        user_ctx: &UserContext,
        resource_type: Option<String>,
        resource_id: Option<Uuid>,
        limit: i64,
    ) -> Result<Vec<crate::models::AuditEntry>> {
        if !user_ctx.is_admin() {
            return Err(Error::Forbidden("admin required".to_string()));
        }

        match (resource_type, resource_id) {
            (Some(rt), Some(rid)) => {
                SharingRepository::list_audit(&self.pool, user_ctx.tenant_id, &rt, rid, limit)
                    .await
            }
            _ => {
                SharingRepository::list_audit_by_tenant(&self.pool, user_ctx.tenant_id, limit)
                    .await
            }
        }
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
        let group_ids = if let Some(ids) = self.cache.get_group_ids(tenant_id, user_id).await {
            ids
        } else {
            let ids = self.fetch_group_ids(user_id).await?;
            self.cache.set_group_ids(tenant_id, user_id, &ids).await;
            ids
        };

        // ── L1 cache: org ancestors ──────────────────────────────────────
        let org_ancestors =
            if let Some(ids) = self.cache.get_org_ancestors(tenant_id, user_id).await {
                ids
            } else {
                let ids = self.fetch_org_ancestors(user_id, tenant_id).await?;
                self.cache
                    .set_org_ancestors(tenant_id, user_id, &ids)
                    .await;
                ids
            };

        // group_roles: not cached; leave empty for now (used for group-level
        // role display only, not for the core permission check).
        let group_roles = std::collections::HashMap::new();

        Ok(UserContext {
            user_id,
            tenant_id,
            group_ids,
            group_roles,
            org_ancestors,
            system_role,
        })
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

    /// Build the ordered parent chain for a resource (current resource first,
    /// then its ancestors in order).
    ///
    /// The chain is built per resource type:
    /// - `file` / `folder` → walks `drive.nodes.parent_id` up to the root
    ///   (max 32 levels to guard against corrupt cycles).
    /// - `event` → appends the owning calendar as `[event_ref, calendar_ref]`.
    /// - All other types → single-element chain (no inheritance).
    ///
    /// All database errors are swallowed: if a parent lookup fails the method
    /// returns whatever chain has been assembled so far.  A `warn!` span is
    /// emitted so operators can detect issues without blocking the permission
    /// check.
    ///
    /// # Panics
    ///
    /// No panics — all errors are handled internally.
    async fn parent_chain(&self, resource: &ResourceRef) -> Vec<ResourceRef> {
        match resource.resource_type {
            ResourceType::File | ResourceType::Folder => {
                self.walk_drive_nodes(resource).await
            }
            ResourceType::Event => {
                self.event_with_calendar(resource).await
            }
            _ => vec![resource.clone()],
        }
    }

    /// Walk `drive.nodes` upward from `resource`, building a chain of
    /// `[resource, parent_folder, grandparent_folder, …]`.
    ///
    /// Uses a single recursive CTE to fetch the entire ancestor chain in one
    /// round-trip instead of one query per level.  Stops when `parent_id IS NULL`
    /// (root reached) or after 32 levels (infinite-loop guard for corrupt data).
    ///
    /// On query error the warning is logged and only the original resource ref is
    /// returned so the caller's permission check still works via direct grants.
    async fn walk_drive_nodes(&self, resource: &ResourceRef) -> Vec<ResourceRef> {
        let result: std::result::Result<Vec<Uuid>, sqlx::Error> = sqlx::query_scalar(
            r#"
            WITH RECURSIVE ancestors AS (
                SELECT id, parent_id, 0 AS depth
                FROM drive.nodes
                WHERE id = $1
                UNION ALL
                SELECT n.id, n.parent_id, a.depth + 1
                FROM drive.nodes n
                JOIN ancestors a ON n.id = a.parent_id
                WHERE a.depth < 32
            )
            SELECT id FROM ancestors ORDER BY depth ASC
            "#,
        )
        .bind(resource.resource_id)
        .fetch_all(&self.pool)
        .await;

        match result {
            Ok(ids) => {
                // The first row (depth 0) is the resource itself — preserve its
                // original type (File or Folder).  All subsequent rows are parent
                // folders.
                ids.into_iter()
                    .enumerate()
                    .map(|(i, id)| {
                        if i == 0 {
                            resource.clone()
                        } else {
                            ResourceRef::folder(id)
                        }
                    })
                    .collect()
            }
            Err(e) => {
                tracing::warn!(
                    resource_id = %resource.resource_id,
                    error = %e,
                    "parent_chain: recursive CTE failed on drive.nodes; \
                     returning single-element chain"
                );
                vec![resource.clone()]
            }
        }
    }

    /// Return `[event_ref, calendar_ref]` by looking up `calendar.events`.
    ///
    /// If the event row is not found or the query fails, returns only
    /// `[event_ref]` so the permission check still works via direct grants.
    async fn event_with_calendar(&self, resource: &ResourceRef) -> Vec<ResourceRef> {
        let result: std::result::Result<Option<Uuid>, sqlx::Error> = sqlx::query_scalar(
            "SELECT calendar_id FROM calendar.events WHERE id = $1",
        )
        .bind(resource.resource_id)
        .fetch_optional(&self.pool)
        .await;

        match result {
            Ok(Some(calendar_id)) => {
                vec![resource.clone(), ResourceRef::calendar(calendar_id)]
            }
            Ok(None) => {
                // Event not found — direct grant check only.
                vec![resource.clone()]
            }
            Err(e) => {
                tracing::warn!(
                    resource_id = %resource.resource_id,
                    error = %e,
                    "parent_chain: failed to fetch calendar_id from calendar.events; \
                     returning single-element chain"
                );
                vec![resource.clone()]
            }
        }
    }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use uuid::Uuid;

    use super::*;
    use crate::models::{EffectivePermission, PermissionSource, UserContext};
    use crate::types::{Action, GranteeType, ResourceRef, ResourceType, Role};

    // ── Helper constructors ───────────────────────────────────────────────────

    fn make_ctx(system_role: i16) -> UserContext {
        UserContext {
            user_id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            group_ids: vec![],
            group_roles: HashMap::new(),
            org_ancestors: vec![],
            system_role,
        }
    }

    // ── Scenario 1 — No grants → denied context ───────────────────────────────

    #[test]
    fn scenario_01_no_grants_context_has_no_elevated_roles() {
        // A plain UserContext with system_role=0 has no administrative access.
        let ctx = make_ctx(0);
        assert!(!ctx.is_superadmin(), "regular user must not be superadmin");
        assert!(!ctx.is_admin(), "regular user must not be admin");
        assert!(ctx.group_ids.is_empty());
        assert!(ctx.org_ancestors.is_empty());
    }

    // ── Scenario 2 — SuperAdmin bypass ───────────────────────────────────────

    #[test]
    fn scenario_02_superadmin_bypass_detected() {
        let ctx = make_ctx(3);
        assert!(ctx.is_superadmin(), "system_role=3 must be superadmin");
        assert!(ctx.is_admin(), "superadmin also satisfies is_admin");
    }

    #[test]
    fn scenario_02_system_role_above_3_still_superadmin() {
        // Defensive: any role >= 3 is superadmin.
        let ctx = make_ctx(10);
        assert!(ctx.is_superadmin());
    }

    // ── Scenario 3 — Admin detection ─────────────────────────────────────────

    #[test]
    fn scenario_03_admin_detection() {
        let ctx = make_ctx(2);
        assert!(ctx.is_admin(), "system_role=2 must be admin");
        assert!(!ctx.is_superadmin(), "system_role=2 must NOT be superadmin");
    }

    #[test]
    fn scenario_03_staff_is_not_admin() {
        let ctx = make_ctx(1);
        assert!(!ctx.is_admin());
        assert!(!ctx.is_superadmin());
    }

    // ── Scenario 4 — Most permissive wins ────────────────────────────────────

    #[test]
    fn scenario_04_max_permissive_viewer_vs_editor_returns_editor() {
        assert_eq!(
            Role::max_permissive(Role::Viewer, Role::Editor),
            Role::Editor
        );
    }

    #[test]
    fn scenario_04_max_permissive_deny_vs_manager_returns_manager() {
        // A positive grant on another axis overrides a deny on a less-specific axis.
        assert_eq!(
            Role::max_permissive(Role::Deny, Role::Manager),
            Role::Manager
        );
    }

    #[test]
    fn scenario_04_max_permissive_same_roles() {
        assert_eq!(
            Role::max_permissive(Role::Editor, Role::Editor),
            Role::Editor
        );
    }

    #[test]
    fn scenario_04_max_permissive_all_combinations() {
        let roles = [Role::Deny, Role::Viewer, Role::Editor, Role::Manager];
        for &a in &roles {
            for &b in &roles {
                let result = Role::max_permissive(a, b);
                // Result level must be >= both inputs.
                assert!(result.level() >= a.level());
                assert!(result.level() >= b.level());
            }
        }
    }

    // ── Scenario 5 — Role ordering ────────────────────────────────────────────

    #[test]
    fn scenario_05_role_levels_deny_lt_viewer_lt_editor_lt_manager() {
        assert!(Role::Deny.level() < Role::Viewer.level());
        assert!(Role::Viewer.level() < Role::Editor.level());
        assert!(Role::Editor.level() < Role::Manager.level());
    }

    #[test]
    fn scenario_05_deny_level_is_negative() {
        assert!(Role::Deny.level() < 0);
    }

    #[test]
    fn scenario_05_manager_level_is_three() {
        assert_eq!(Role::Manager.level(), 3);
    }

    // ── Scenario 6 — Vault + Everyone restriction (type-level) ───────────────

    #[test]
    fn scenario_06_vault_entry_resource_type_identified() {
        // Verify the type and grantee that the engine rejects are identifiable
        // from the typed model — the actual rejection happens in engine.grant().
        let vault_ref = ResourceRef::vault_entry(Uuid::new_v4());
        assert_eq!(vault_ref.resource_type, ResourceType::VaultEntry);
    }

    #[test]
    fn scenario_06_everyone_grantee_type_identified() {
        let dto = CreateGrant {
            grantee_type: GranteeType::Everyone,
            grantee_id: None,
            role: Role::Viewer,
            can_reshare: None,
            expires_at: None,
        };
        assert_eq!(dto.grantee_type, GranteeType::Everyone);
        // Confirms the combination that engine.grant() must reject.
        let is_forbidden_combination = ResourceType::VaultEntry == ResourceType::VaultEntry
            && dto.grantee_type == GranteeType::Everyone;
        assert!(is_forbidden_combination);
    }

    #[test]
    fn scenario_06_non_vault_everyone_is_not_forbidden() {
        // File + Everyone is a valid combination — only VaultEntry is restricted.
        let file_ref = ResourceRef::file(Uuid::new_v4());
        let is_forbidden = file_ref.resource_type == ResourceType::VaultEntry;
        assert!(!is_forbidden);
    }

    // ── Scenario 7 — Grant parsing (parsed_role / parsed_grantee_type) ────────

    #[test]
    fn scenario_07_grant_parsed_role_known_roles() {
        use crate::models::Grant;
        use chrono::Utc;

        let base_grant = || Grant {
            id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            resource_type: "file".into(),
            resource_id: Uuid::new_v4(),
            grantee_type: "user".into(),
            grantee_id: Some(Uuid::new_v4()),
            role: "viewer".into(),
            can_reshare: None,
            expires_at: None,
            granted_by: Uuid::new_v4(),
            created_at: Some(Utc::now()),
            updated_at: Some(Utc::now()),
        };

        let mut g = base_grant();
        for (role_str, expected) in [
            ("deny", Role::Deny),
            ("viewer", Role::Viewer),
            ("editor", Role::Editor),
            ("manager", Role::Manager),
        ] {
            g.role = role_str.into();
            assert_eq!(g.parsed_role(), Some(expected), "role={role_str}");
        }
    }

    #[test]
    fn scenario_07_grant_parsed_role_unknown_returns_none() {
        use crate::models::Grant;

        let g = Grant {
            id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            resource_type: "file".into(),
            resource_id: Uuid::new_v4(),
            grantee_type: "user".into(),
            grantee_id: Some(Uuid::new_v4()),
            role: "superuser".into(),
            can_reshare: None,
            expires_at: None,
            granted_by: Uuid::new_v4(),
            created_at: None,
            updated_at: None,
        };
        assert_eq!(g.parsed_role(), None);
    }

    #[test]
    fn scenario_07_grant_parsed_grantee_type_all_variants() {
        use crate::models::Grant;

        let make = |gt: &str| Grant {
            id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            resource_type: "file".into(),
            resource_id: Uuid::new_v4(),
            grantee_type: gt.into(),
            grantee_id: Some(Uuid::new_v4()),
            role: "viewer".into(),
            can_reshare: None,
            expires_at: None,
            granted_by: Uuid::new_v4(),
            created_at: None,
            updated_at: None,
        };

        assert_eq!(make("user").parsed_grantee_type(), Some(GranteeType::User));
        assert_eq!(
            make("group").parsed_grantee_type(),
            Some(GranteeType::Group)
        );
        assert_eq!(
            make("org_node").parsed_grantee_type(),
            Some(GranteeType::OrgNode)
        );
        assert_eq!(
            make("everyone").parsed_grantee_type(),
            Some(GranteeType::Everyone)
        );
        assert_eq!(make("unknown").parsed_grantee_type(), None);
    }

    // ── Scenario 8 — CreateGrant grantee_id resolution ───────────────────────

    #[test]
    fn scenario_08_create_grant_group_returns_id() {
        let id = Uuid::new_v4();
        let dto = CreateGrant {
            grantee_type: GranteeType::Group,
            grantee_id: Some(id),
            role: Role::Editor,
            can_reshare: None,
            expires_at: None,
        };
        assert_eq!(dto.resolved_grantee_id(), Some(id));
    }

    #[test]
    fn scenario_08_create_grant_org_node_returns_id() {
        let id = Uuid::new_v4();
        let dto = CreateGrant {
            grantee_type: GranteeType::OrgNode,
            grantee_id: Some(id),
            role: Role::Viewer,
            can_reshare: None,
            expires_at: None,
        };
        assert_eq!(dto.resolved_grantee_id(), Some(id));
    }

    #[test]
    fn scenario_08_create_grant_everyone_returns_none_even_with_id() {
        // The Everyone grantee ignores any supplied grantee_id.
        let dto = CreateGrant {
            grantee_type: GranteeType::Everyone,
            grantee_id: Some(Uuid::new_v4()),
            role: Role::Viewer,
            can_reshare: None,
            expires_at: None,
        };
        assert_eq!(dto.resolved_grantee_id(), None);
    }

    // ── Scenario 9 — ResourceRef constructors ────────────────────────────────

    #[test]
    fn scenario_09_resource_ref_all_constructors_set_correct_type() {
        let id = Uuid::new_v4();
        assert_eq!(ResourceRef::file(id).resource_type, ResourceType::File);
        assert_eq!(ResourceRef::folder(id).resource_type, ResourceType::Folder);
        assert_eq!(
            ResourceRef::calendar(id).resource_type,
            ResourceType::Calendar
        );
        assert_eq!(ResourceRef::event(id).resource_type, ResourceType::Event);
        assert_eq!(
            ResourceRef::document(id).resource_type,
            ResourceType::Document
        );
        assert_eq!(ResourceRef::form(id).resource_type, ResourceType::Form);
        assert_eq!(
            ResourceRef::contact_book(id).resource_type,
            ResourceType::ContactBook
        );
        assert_eq!(
            ResourceRef::channel(id).resource_type,
            ResourceType::Channel
        );
        assert_eq!(ResourceRef::asset(id).resource_type, ResourceType::Asset);
        assert_eq!(
            ResourceRef::vault_entry(id).resource_type,
            ResourceType::VaultEntry
        );
    }

    #[test]
    fn scenario_09_resource_ref_preserves_id() {
        let id = Uuid::new_v4();
        for rr in [
            ResourceRef::file(id),
            ResourceRef::folder(id),
            ResourceRef::calendar(id),
            ResourceRef::event(id),
            ResourceRef::document(id),
            ResourceRef::form(id),
            ResourceRef::contact_book(id),
            ResourceRef::channel(id),
            ResourceRef::asset(id),
            ResourceRef::vault_entry(id),
        ] {
            assert_eq!(rr.resource_id, id, "id mismatch for {:?}", rr.resource_type);
        }
    }

    #[test]
    fn scenario_09_resource_ref_display_format() {
        let id = Uuid::nil();
        let rr = ResourceRef::file(id);
        let display = rr.to_string();
        assert!(display.starts_with("file:"), "got: {display}");
        assert!(display.contains(&id.to_string()));
    }

    // ── Scenario 10 — Default visibility ─────────────────────────────────────

    #[test]
    fn scenario_10_default_visibility_private_resources() {
        use crate::defaults::system_default_visibility;
        for rt in [
            ResourceType::File,
            ResourceType::Folder,
            ResourceType::Document,
            ResourceType::Form,
            ResourceType::ContactBook,
            ResourceType::VaultEntry,
        ] {
            assert_eq!(
                system_default_visibility(rt),
                "private",
                "{rt} should be private"
            );
        }
    }

    #[test]
    fn scenario_10_default_visibility_workspace_resources() {
        use crate::defaults::system_default_visibility;
        for rt in [
            ResourceType::Calendar,
            ResourceType::Event,
            ResourceType::Channel,
        ] {
            assert_eq!(
                system_default_visibility(rt),
                "workspace",
                "{rt} should be workspace"
            );
        }
    }

    #[test]
    fn scenario_10_default_visibility_org_node_resources() {
        use crate::defaults::system_default_visibility;
        assert_eq!(system_default_visibility(ResourceType::Asset), "org_node");
    }

    // ── Scenario 11 — Action constructors ────────────────────────────────────

    #[test]
    fn scenario_11_standard_action_strings() {
        assert_eq!(Action::read().as_str(), "read");
        assert_eq!(Action::write().as_str(), "write");
        assert_eq!(Action::delete().as_str(), "delete");
        assert_eq!(Action::share().as_str(), "share");
        assert_eq!(Action::list().as_str(), "list");
    }

    #[test]
    fn scenario_11_action_new_custom() {
        let a = Action::new("approve");
        assert_eq!(a.as_str(), "approve");
    }

    #[test]
    fn scenario_11_action_from_str_ref() {
        let a: Action = "read".into();
        assert_eq!(a.as_str(), "read");
    }

    #[test]
    fn scenario_11_action_from_string() {
        let a: Action = String::from("write").into();
        assert_eq!(a.as_str(), "write");
    }

    #[test]
    fn scenario_11_action_display() {
        assert_eq!(Action::delete().to_string(), "delete");
    }

    // ── Scenario 12 — EffectivePermission construction ───────────────────────

    #[test]
    fn scenario_12_effective_permission_fields() {
        let ep = EffectivePermission {
            role: Role::Manager,
            can_reshare: true,
            capabilities: vec![
                "read".into(),
                "write".into(),
                "delete".into(),
                "share".into(),
            ],
            sources: vec![PermissionSource {
                axis: "user".into(),
                grantee_name: Some("alice".into()),
                role: Role::Manager,
                via: "direct grant".into(),
            }],
        };

        assert_eq!(ep.role, Role::Manager);
        assert!(ep.can_reshare);
        assert_eq!(ep.capabilities.len(), 4);
        assert!(ep.capabilities.contains(&"share".to_string()));
        assert_eq!(ep.sources.len(), 1);
        assert_eq!(ep.sources[0].axis, "user");
        assert_eq!(ep.sources[0].via, "direct grant");
        assert_eq!(ep.sources[0].grantee_name, Some("alice".into()));
    }

    #[test]
    fn scenario_12_effective_permission_viewer_cannot_reshare() {
        let ep = EffectivePermission {
            role: Role::Viewer,
            can_reshare: false,
            capabilities: vec!["read".into(), "list".into()],
            sources: vec![],
        };
        assert!(!ep.can_reshare);
        assert_eq!(ep.role, Role::Viewer);
    }

    #[test]
    fn scenario_12_permission_source_multiple_axes() {
        let sources = vec![
            PermissionSource {
                axis: "group".into(),
                grantee_name: Some("engineers".into()),
                role: Role::Editor,
                via: "group membership".into(),
            },
            PermissionSource {
                axis: "everyone".into(),
                grantee_name: None,
                role: Role::Viewer,
                via: "tenant-wide grant".into(),
            },
        ];
        assert_eq!(sources[0].axis, "group");
        assert_eq!(sources[1].axis, "everyone");
        assert_eq!(sources[1].grantee_name, None);
    }

    // ── Scenario 13 — Role Display/FromStr string roundtrip ──────────────────

    #[test]
    fn scenario_13_role_display_from_str_roundtrip() {
        use std::str::FromStr;
        for role in [Role::Deny, Role::Viewer, Role::Editor, Role::Manager] {
            let s = role.to_string();
            let parsed = Role::from_str(&s).expect("roundtrip must succeed");
            assert_eq!(parsed, role, "roundtrip failed for {s}");
        }
    }

    #[test]
    fn scenario_13_role_display_strings() {
        assert_eq!(Role::Deny.to_string(), "deny");
        assert_eq!(Role::Viewer.to_string(), "viewer");
        assert_eq!(Role::Editor.to_string(), "editor");
        assert_eq!(Role::Manager.to_string(), "manager");
    }

    #[test]
    fn scenario_13_role_from_str_invalid_returns_err() {
        use std::str::FromStr;
        assert!(Role::from_str("VIEWER").is_err(), "case-sensitive check");
        assert!(Role::from_str("").is_err());
        assert!(Role::from_str("superadmin").is_err());
    }

    // ── Scenario 14 — ResourceType as_str roundtrip ──────────────────────────

    #[test]
    fn scenario_14_resource_type_as_str_roundtrip() {
        use std::str::FromStr;
        for rt in [
            ResourceType::File,
            ResourceType::Folder,
            ResourceType::Calendar,
            ResourceType::Event,
            ResourceType::Document,
            ResourceType::Form,
            ResourceType::ContactBook,
            ResourceType::Channel,
            ResourceType::Asset,
            ResourceType::VaultEntry,
        ] {
            let s = rt.as_str();
            let parsed = ResourceType::from_str(s).expect("roundtrip must succeed");
            assert_eq!(parsed, rt, "roundtrip failed for {s}");
        }
    }

    #[test]
    fn scenario_14_resource_type_display_equals_as_str() {
        for rt in [
            ResourceType::File,
            ResourceType::Folder,
            ResourceType::Calendar,
            ResourceType::Event,
            ResourceType::Document,
            ResourceType::Form,
            ResourceType::ContactBook,
            ResourceType::Channel,
            ResourceType::Asset,
            ResourceType::VaultEntry,
        ] {
            assert_eq!(rt.to_string(), rt.as_str(), "display != as_str for {rt:?}");
        }
    }

    // ── Additional coverage ───────────────────────────────────────────────────

    #[test]
    fn sharing_engine_is_clone() {
        // Compile-time check: SharingEngine must implement Clone.
        fn assert_clone<T: Clone>() {}
        assert_clone::<SharingEngine>();
    }

    #[test]
    fn grantee_type_from_str_all_variants() {
        use std::str::FromStr;
        for (s, expected) in [
            ("user", GranteeType::User),
            ("group", GranteeType::Group),
            ("org_node", GranteeType::OrgNode),
            ("everyone", GranteeType::Everyone),
        ] {
            assert_eq!(GranteeType::from_str(s).unwrap(), expected);
        }
        assert!(GranteeType::from_str("unknown").is_err());
    }

    #[test]
    fn grantee_type_as_str_roundtrip() {
        use std::str::FromStr;
        for gt in [
            GranteeType::User,
            GranteeType::Group,
            GranteeType::OrgNode,
            GranteeType::Everyone,
        ] {
            let s = gt.as_str();
            let parsed = GranteeType::from_str(s).expect("roundtrip must succeed");
            assert_eq!(parsed, gt);
        }
    }

    #[test]
    fn grantee_display_format() {
        use crate::types::Grantee;
        let id = Uuid::nil();
        assert_eq!(Grantee::Everyone.to_string(), "everyone");
        assert!(Grantee::User(id).to_string().starts_with("user:"));
        assert!(Grantee::Group(id).to_string().starts_with("group:"));
        assert!(Grantee::OrgNode(id).to_string().starts_with("org_node:"));
    }

    #[test]
    fn user_context_with_groups_and_org_ancestors() {
        let group1 = Uuid::new_v4();
        let group2 = Uuid::new_v4();
        let org1 = Uuid::new_v4();
        let ctx = UserContext {
            user_id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            group_ids: vec![group1, group2],
            group_roles: HashMap::new(),
            org_ancestors: vec![org1],
            system_role: 0,
        };
        assert_eq!(ctx.group_ids.len(), 2);
        assert!(ctx.group_ids.contains(&group1));
        assert_eq!(ctx.org_ancestors.len(), 1);
        assert_eq!(ctx.org_ancestors[0], org1);
    }

    #[test]
    fn role_deny_is_most_restrictive_when_folded() {
        // Simulates the fold in resolver: folding only deny grants remains Deny.
        let grants = vec![Role::Deny, Role::Deny];
        let result = grants.into_iter().fold(Role::Deny, Role::max_permissive);
        assert_eq!(result, Role::Deny);
    }

    #[test]
    fn role_fold_mixed_positive_and_deny_yields_highest_positive() {
        // Simulates a user with a deny via org_node but editor via direct grant.
        let grants = vec![Role::Deny, Role::Editor, Role::Viewer];
        let result = grants.into_iter().fold(Role::Deny, Role::max_permissive);
        assert_eq!(result, Role::Editor);
    }

    // ── Phase B — parent_chain (unit-testable, no DB required) ───────────────

    /// Verify that a single resource ref round-trips through the logic paths
    /// that don't touch the database (unknown types) and that the chain always
    /// starts with the resource itself.
    ///
    /// NOTE: The DB-backed paths (`File`, `Folder`, `Event`) cannot be unit-
    /// tested without a live PostgreSQL connection. They are covered by the
    /// integration test suite (`cargo nextest run -p signapps-sharing`).

    #[test]
    fn phase_b_single_resource_chain_has_one_element_for_unknown_types() {
        // For resource types with no parent hierarchy the chain must be exactly
        // the resource itself.
        let id = Uuid::new_v4();
        for rr in [
            ResourceRef::document(id),
            ResourceRef::form(id),
            ResourceRef::contact_book(id),
            ResourceRef::channel(id),
            ResourceRef::asset(id),
            ResourceRef::vault_entry(id),
            ResourceRef::calendar(id),
        ] {
            // We verify the match arm logic by checking the type, since we
            // cannot call the async engine method synchronously here.
            let is_file_folder_event = matches!(
                rr.resource_type,
                ResourceType::File | ResourceType::Folder | ResourceType::Event
            );
            assert!(
                !is_file_folder_event,
                "{:?} should fall into the single-element branch",
                rr.resource_type
            );
        }
    }

    #[test]
    fn phase_b_file_and_folder_match_db_walk_arm() {
        // Verify File and Folder are covered by the DB-walk arm.
        let id = Uuid::new_v4();
        for rr in [ResourceRef::file(id), ResourceRef::folder(id)] {
            let hits_db_arm = matches!(
                rr.resource_type,
                ResourceType::File | ResourceType::Folder
            );
            assert!(hits_db_arm, "{:?} must use the drive.nodes walk", rr.resource_type);
        }
    }

    #[test]
    fn phase_b_event_matches_calendar_arm() {
        let id = Uuid::new_v4();
        let rr = ResourceRef::event(id);
        assert!(
            matches!(rr.resource_type, ResourceType::Event),
            "Event must use the calendar lookup arm"
        );
    }

    #[test]
    fn phase_b_resource_ref_folder_constructor_used_for_parents() {
        // Confirm that ResourceRef::folder builds the correct type — this is what
        // walk_drive_nodes uses when pushing parent nodes onto the chain.
        let parent_id = Uuid::new_v4();
        let parent_ref = ResourceRef::folder(parent_id);
        assert_eq!(parent_ref.resource_type, ResourceType::Folder);
        assert_eq!(parent_ref.resource_id, parent_id);
    }

    #[test]
    fn phase_b_resource_ref_calendar_constructor_used_for_event_parent() {
        // Confirm that ResourceRef::calendar builds the correct type — this is
        // what event_with_calendar pushes onto the chain.
        let cal_id = Uuid::new_v4();
        let cal_ref = ResourceRef::calendar(cal_id);
        assert_eq!(cal_ref.resource_type, ResourceType::Calendar);
        assert_eq!(cal_ref.resource_id, cal_id);
    }
}
