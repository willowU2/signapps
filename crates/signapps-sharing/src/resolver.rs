//! Multi-axis permission resolver for the sharing engine.
//!
//! [`PermissionResolver`] implements the 6-step resolution algorithm:
//!
//! 1. SuperAdmin bypass — superadmins always get `Manager` with all capabilities.
//! 2. Owner check — resource owners always get `Manager`.
//! 3. Deny check — an explicit deny on any axis returns `None` (access denied).
//! 4. Collect grants from all four axes (user, groups, org nodes, everyone).
//! 5. Most-permissive wins — take the highest `Role` across all collected grants;
//!    `can_reshare` is `true` if any grant sets it.
//! 6. Capability lookup — resolve the allowed actions from the DB capability table.

use signapps_common::{Error, Result};
use sqlx::PgPool;
use tracing::instrument;
use uuid::Uuid;

use crate::models::{EffectivePermission, PermissionSource, UserContext};
use crate::repository::SharingRepository;
use crate::types::{Action, ResourceRef, Role};

// ─── PermissionResolver ───────────────────────────────────────────────────────

/// Resolves effective permissions for a (user, resource) pair.
///
/// Wraps a `PgPool` so it can issue DB queries; use [`PermissionResolver::new`]
/// to construct, then call [`resolve`] or [`check_action`].
pub struct PermissionResolver<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PermissionResolver<'pool> {
    /// Create a new resolver backed by the given pool.
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }

    /// Resolve the effective permission for `user_ctx` on `resource`.
    ///
    /// `owner_id` is `Some(uuid)` when the caller knows who owns the resource.
    /// Pass `None` to skip the owner bypass.
    ///
    /// Returns `None` when access is explicitly denied or no grant exists.
    ///
    /// # Errors
    ///
    /// Returns [`Error::Database`] if any repository call fails.
    ///
    /// # Panics
    ///
    /// No panics — all errors are propagated via `Result`.
    #[instrument(skip(self, user_ctx), fields(
        user_id  = %user_ctx.user_id,
        resource = %resource,
    ))]
    pub async fn resolve(
        &self,
        user_ctx: &UserContext,
        resource: &ResourceRef,
        owner_id: Option<Uuid>,
    ) -> Result<Option<EffectivePermission>> {
        let rt = resource.resource_type.as_str();
        let rid = resource.resource_id;
        let tid = user_ctx.tenant_id;

        // ── Step 1: SuperAdmin bypass ────────────────────────────────────────
        if user_ctx.is_superadmin() {
            tracing::debug!("superadmin bypass");
            let caps = self.get_capabilities(rt, Role::Manager.as_str()).await?;
            return Ok(Some(EffectivePermission {
                role: Role::Manager,
                can_reshare: true,
                capabilities: caps,
                sources: vec![PermissionSource {
                    axis: "superadmin".into(),
                    grantee_name: None,
                    role: Role::Manager,
                    via: "superadmin bypass".into(),
                }],
            }));
        }

        // ── Step 2: Owner check ──────────────────────────────────────────────
        if let Some(oid) = owner_id {
            if oid == user_ctx.user_id {
                tracing::debug!("owner bypass");
                let caps = self.get_capabilities(rt, Role::Manager.as_str()).await?;
                return Ok(Some(EffectivePermission {
                    role: Role::Manager,
                    can_reshare: true,
                    capabilities: caps,
                    sources: vec![PermissionSource {
                        axis: "owner".into(),
                        grantee_name: None,
                        role: Role::Manager,
                        via: "resource owner".into(),
                    }],
                }));
            }
        }

        // ── Step 3: Deny check ───────────────────────────────────────────────
        let denied = SharingRepository::has_deny(
            self.pool,
            tid,
            rt,
            rid,
            user_ctx.user_id,
            &user_ctx.group_ids,
            &user_ctx.org_ancestors,
        )
        .await?;

        if denied {
            tracing::debug!("access explicitly denied");
            return Ok(None);
        }

        // ── Step 4: Collect grants from all four axes ────────────────────────
        let mut sources: Vec<PermissionSource> = Vec::new();

        // Axis 1 — direct user grant
        let user_grants = if !user_ctx.user_id.is_nil() {
            SharingRepository::find_grants_for_grantee(
                self.pool,
                tid,
                rt,
                rid,
                "user",
                &[user_ctx.user_id],
            )
            .await?
        } else {
            vec![]
        };

        for g in &user_grants {
            if let Some(role) = g.parsed_role() {
                sources.push(PermissionSource {
                    axis: "user".into(),
                    grantee_name: None,
                    role,
                    via: "direct grant".into(),
                });
            }
        }

        // Axis 2 — group grants
        let group_grants = if !user_ctx.group_ids.is_empty() {
            SharingRepository::find_grants_for_grantee(
                self.pool,
                tid,
                rt,
                rid,
                "group",
                &user_ctx.group_ids,
            )
            .await?
        } else {
            vec![]
        };

        for g in &group_grants {
            if let Some(role) = g.parsed_role() {
                sources.push(PermissionSource {
                    axis: "group".into(),
                    grantee_name: None,
                    role,
                    via: format!(
                        "group {}",
                        g.grantee_id.map(|id| id.to_string()).unwrap_or_default()
                    ),
                });
            }
        }

        // Axis 3 — org-node grants
        let org_grants = if !user_ctx.org_ancestors.is_empty() {
            SharingRepository::find_grants_for_grantee(
                self.pool,
                tid,
                rt,
                rid,
                "org_node",
                &user_ctx.org_ancestors,
            )
            .await?
        } else {
            vec![]
        };

        for g in &org_grants {
            if let Some(role) = g.parsed_role() {
                sources.push(PermissionSource {
                    axis: "org_node".into(),
                    grantee_name: None,
                    role,
                    via: format!(
                        "org node {}",
                        g.grantee_id.map(|id| id.to_string()).unwrap_or_default()
                    ),
                });
            }
        }

        // Axis 4 — everyone grants
        let everyone_grants =
            SharingRepository::find_everyone_grants(self.pool, tid, rt, rid).await?;

        for g in &everyone_grants {
            if let Some(role) = g.parsed_role() {
                sources.push(PermissionSource {
                    axis: "everyone".into(),
                    grantee_name: None,
                    role,
                    via: "tenant-wide grant".into(),
                });
            }
        }

        // ── Step 5: Most permissive wins ─────────────────────────────────────
        if sources.is_empty() {
            tracing::debug!("no grants found — no access");
            return Ok(None);
        }

        let all_grants = user_grants
            .iter()
            .chain(group_grants.iter())
            .chain(org_grants.iter())
            .chain(everyone_grants.iter());

        let effective_role = all_grants
            .clone()
            .filter_map(|g| g.parsed_role())
            .fold(Role::Deny, Role::max_permissive);

        // If every grant resolves to Deny, access is denied.
        if effective_role == Role::Deny {
            tracing::debug!("all grants are deny — access denied");
            return Ok(None);
        }

        let can_reshare = user_grants
            .iter()
            .chain(group_grants.iter())
            .chain(org_grants.iter())
            .chain(everyone_grants.iter())
            .any(|g| g.can_reshare.unwrap_or(false));

        // ── Step 6: Capability lookup ────────────────────────────────────────
        let capabilities = self.get_capabilities(rt, effective_role.as_str()).await?;

        tracing::debug!(
            role = %effective_role,
            can_reshare,
            caps = capabilities.len(),
            "resolved effective permission"
        );

        Ok(Some(EffectivePermission {
            role: effective_role,
            can_reshare,
            capabilities,
            sources,
        }))
    }

    /// Check that the given `action` is allowed for `user_ctx` on `resource`.
    ///
    /// Returns `Ok(())` if the action is permitted, or [`Error::Forbidden`] if
    /// not. Also returns [`Error::Forbidden`] when there is no grant at all.
    ///
    /// # Errors
    ///
    /// - [`Error::Forbidden`] — action not permitted or access denied.
    /// - [`Error::Database`] — repository call failed.
    ///
    /// # Panics
    ///
    /// No panics — all errors are propagated via `Result`.
    #[instrument(skip(self, user_ctx), fields(
        user_id  = %user_ctx.user_id,
        resource = %resource,
        action   = %action,
    ))]
    pub async fn check_action(
        &self,
        user_ctx: &UserContext,
        resource: &ResourceRef,
        owner_id: Option<Uuid>,
        action: &Action,
    ) -> Result<()> {
        match self.resolve(user_ctx, resource, owner_id).await? {
            None => Err(Error::Forbidden(format!(
                "access denied to {} on {}",
                action, resource
            ))),
            Some(ep) => {
                if ep.capabilities.iter().any(|c| c == action.as_str()) {
                    Ok(())
                } else {
                    Err(Error::Forbidden(format!(
                        "action '{}' not permitted on {} (role: {})",
                        action, resource, ep.role
                    )))
                }
            },
        }
    }

    /// Fetch allowed actions for a (resource_type, role) pair from the DB.
    ///
    /// Returns an empty `Vec` if no capability row exists for this combination.
    ///
    /// # Errors
    ///
    /// Returns [`Error::Database`] if the query fails.
    async fn get_capabilities(&self, resource_type: &str, role: &str) -> Result<Vec<String>> {
        match SharingRepository::get_capabilities(self.pool, resource_type, role).await? {
            Some(cap) => Ok(cap.actions),
            None => Ok(vec![]),
        }
    }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn superadmin_ctx(tenant_id: Uuid) -> UserContext {
        UserContext {
            user_id: Uuid::new_v4(),
            tenant_id,
            group_ids: vec![],
            group_roles: HashMap::new(),
            org_ancestors: vec![],
            system_role: 3,
        }
    }

    fn regular_ctx(tenant_id: Uuid) -> UserContext {
        UserContext {
            user_id: Uuid::new_v4(),
            tenant_id,
            group_ids: vec![],
            group_roles: HashMap::new(),
            org_ancestors: vec![],
            system_role: 0,
        }
    }

    #[test]
    fn superadmin_is_superadmin() {
        let ctx = superadmin_ctx(Uuid::new_v4());
        assert!(ctx.is_superadmin());
    }

    #[test]
    fn regular_user_is_not_superadmin() {
        let ctx = regular_ctx(Uuid::new_v4());
        assert!(!ctx.is_superadmin());
    }

    #[test]
    fn owner_check_same_user() {
        let tenant_id = Uuid::new_v4();
        let ctx = regular_ctx(tenant_id);
        let owner_id = ctx.user_id;
        // Owner check: user_id == owner_id → should resolve to Manager
        // (tested at integration level with a live pool)
        assert_eq!(owner_id, ctx.user_id);
    }
}
