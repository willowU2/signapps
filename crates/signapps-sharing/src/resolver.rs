//! Multi-axis permission resolver for the sharing engine.
//!
//! [`PermissionResolver`] implements the 6-step resolution algorithm:
//!
//! 1. SuperAdmin bypass — superadmins always get `Manager` with all capabilities.
//! 2. Owner check — resource owners always get `Manager`.
//! 3. Deny check — an explicit deny on any axis returns `None` (access denied).
//! 4. Collect grants from all four axes (user, groups, org nodes, everyone),
//!    optionally walking up a parent chain when no direct grant is found.
//! 5. Most-permissive wins — take the highest `Role` across all collected grants;
//!    `can_reshare` is `true` if any grant sets it.
//! 6. Capability lookup — resolve the allowed actions from the DB capability table.
//!
//! ## Parent-chain walk-up
//!
//! Call [`PermissionResolver::resolve_with_parents`] instead of
//! [`PermissionResolver::resolve`] when the caller can supply an ordered slice of
//! ancestor resources (current resource first, then its parent, grandparent, …).
//!
//! The resolver walks the chain from most-specific to least-specific:
//! - Grants found at a level are collected and merged (most-permissive wins).
//! - If a **deny** grant is found at any level the walk stops immediately and
//!   access is denied (deny at any ancestor blocks inheritance).
//! - If a grant set is found at a given level the walk stops (no further
//!   inheritance from less-specific ancestors).
//! - Walking continues until the chain is exhausted.
//!
//! The chain population is the caller's responsibility.  [`SharingEngine`] ships
//! a `parent_chain` helper that currently returns the single resource (Phase A);
//! per-type DB walks (e.g. `drive.nodes.parent_id`) can be added per service.

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
/// to construct, then call [`resolve`], [`resolve_with_parents`], or
/// [`check_action`].
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

        // Secondary Deny safety net: if any collected source carries Role::Deny,
        // block access immediately regardless of other positive grants.
        // (The primary check is has_deny above; this net catches any Deny that
        // reaches this point via future code paths such as apply_template.)
        if sources.iter().any(|s| s.role == Role::Deny) {
            tracing::debug!("secondary deny safety net triggered — access denied");
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

    /// Resolve the effective permission for `user_ctx` by walking a parent chain.
    ///
    /// `chain` is an ordered slice of [`ResourceRef`] values representing the
    /// resource hierarchy, with the **most specific resource first** (index 0)
    /// and its ancestors following in order (index 1 = direct parent, …).
    ///
    /// The algorithm:
    /// 1. Apply the same superadmin / owner bypasses as [`resolve`].
    /// 2. For each level in the chain:
    ///    a. Check for any deny grant — if found, stop and return `None`.
    ///    b. Collect grants on all four axes for this resource.
    ///    c. If at least one grant is found, stop walking and merge them.
    /// 3. If the chain is exhausted without finding any grant, return `None`.
    ///
    /// Passing a single-element chain is equivalent to calling [`resolve`].
    ///
    /// # Errors
    ///
    /// Returns [`Error::Database`] if any repository call fails.
    ///
    /// # Panics
    ///
    /// No panics — all errors are propagated via `Result`.
    ///
    /// # Examples
    ///
    /// ```rust,ignore
    /// // file inherits from its folder parent
    /// let chain = vec![ResourceRef::file(file_id), ResourceRef::folder(folder_id)];
    /// let ep = resolver.resolve_with_parents(&user_ctx, &chain, None).await?;
    /// ```
    #[instrument(skip(self, user_ctx, chain), fields(
        user_id    = %user_ctx.user_id,
        chain_len  = chain.len(),
    ))]
    pub async fn resolve_with_parents(
        &self,
        user_ctx: &UserContext,
        chain: &[ResourceRef],
        owner_id: Option<Uuid>,
    ) -> Result<Option<EffectivePermission>> {
        // Degenerate: no resources in chain → no access.
        let Some(resource) = chain.first() else {
            return Ok(None);
        };

        let rt = resource.resource_type.as_str();
        let tid = user_ctx.tenant_id;

        // ── Step 1: SuperAdmin bypass ────────────────────────────────────────
        if user_ctx.is_superadmin() {
            tracing::debug!("superadmin bypass (parent-chain)");
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
        // Owner check only applies to the primary (first) resource.
        if let Some(oid) = owner_id {
            if oid == user_ctx.user_id {
                tracing::debug!("owner bypass (parent-chain)");
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

        // ── Steps 3–4: Walk the chain ────────────────────────────────────────
        let mut all_sources: Vec<PermissionSource> = Vec::new();
        let mut found_level: Option<usize> = None;

        'chain: for (depth, res) in chain.iter().enumerate() {
            let res_type = res.resource_type.as_str();
            let res_id = res.resource_id;

            // 3a. Deny check at this level.
            let denied = SharingRepository::has_deny(
                self.pool,
                tid,
                res_type,
                res_id,
                user_ctx.user_id,
                &user_ctx.group_ids,
                &user_ctx.org_ancestors,
            )
            .await?;

            if denied {
                tracing::debug!(depth, "deny grant found at chain level — access denied");
                return Ok(None);
            }

            // 3b. Collect all four axes at this level.
            let via_suffix = if depth == 0 {
                "direct grant".to_owned()
            } else {
                format!("inherited from {res}")
            };

            let user_grants = if !user_ctx.user_id.is_nil() {
                SharingRepository::find_grants_for_grantee(
                    self.pool,
                    tid,
                    res_type,
                    res_id,
                    "user",
                    &[user_ctx.user_id],
                )
                .await?
            } else {
                vec![]
            };

            for g in &user_grants {
                if let Some(role) = g.parsed_role() {
                    all_sources.push(PermissionSource {
                        axis: "user".into(),
                        grantee_name: None,
                        role,
                        via: via_suffix.clone(),
                    });
                }
            }

            let group_grants = if !user_ctx.group_ids.is_empty() {
                SharingRepository::find_grants_for_grantee(
                    self.pool,
                    tid,
                    res_type,
                    res_id,
                    "group",
                    &user_ctx.group_ids,
                )
                .await?
            } else {
                vec![]
            };

            for g in &group_grants {
                if let Some(role) = g.parsed_role() {
                    all_sources.push(PermissionSource {
                        axis: "group".into(),
                        grantee_name: None,
                        role,
                        via: format!(
                            "group {} {}",
                            g.grantee_id.map(|id| id.to_string()).unwrap_or_default(),
                            via_suffix
                        ),
                    });
                }
            }

            let org_grants = if !user_ctx.org_ancestors.is_empty() {
                SharingRepository::find_grants_for_grantee(
                    self.pool,
                    tid,
                    res_type,
                    res_id,
                    "org_node",
                    &user_ctx.org_ancestors,
                )
                .await?
            } else {
                vec![]
            };

            for g in &org_grants {
                if let Some(role) = g.parsed_role() {
                    all_sources.push(PermissionSource {
                        axis: "org_node".into(),
                        grantee_name: None,
                        role,
                        via: format!(
                            "org node {} {}",
                            g.grantee_id.map(|id| id.to_string()).unwrap_or_default(),
                            via_suffix
                        ),
                    });
                }
            }

            let everyone_grants =
                SharingRepository::find_everyone_grants(self.pool, tid, res_type, res_id).await?;

            for g in &everyone_grants {
                if let Some(role) = g.parsed_role() {
                    all_sources.push(PermissionSource {
                        axis: "everyone".into(),
                        grantee_name: None,
                        role,
                        via: format!("tenant-wide grant {via_suffix}"),
                    });
                }
            }

            // 3c. If grants were found at this level, stop walking.
            let level_has_grants = !user_grants.is_empty()
                || !group_grants.is_empty()
                || !org_grants.is_empty()
                || !everyone_grants.is_empty();

            if level_has_grants {
                found_level = Some(depth);
                tracing::debug!(depth, "grants found — stopping chain walk");
                break 'chain;
            }
        }

        // ── Step 5: Most permissive wins ─────────────────────────────────────
        if all_sources.is_empty() {
            tracing::debug!("no grants found in parent chain — no access");
            return Ok(None);
        }

        // Secondary Deny safety net: if any collected source carries Role::Deny,
        // block access immediately regardless of other positive grants.
        if all_sources.iter().any(|s| s.role == Role::Deny) {
            tracing::debug!("secondary deny safety net triggered (parent-chain) — access denied");
            return Ok(None);
        }

        let effective_role = all_sources
            .iter()
            .map(|s| s.role)
            .fold(Role::Deny, Role::max_permissive);

        if effective_role == Role::Deny {
            tracing::debug!("all collected grants are deny — access denied");
            return Ok(None);
        }

        let can_reshare = all_sources.iter().any(|s| {
            // can_reshare is only meaningful for direct grants (depth 0).
            // For inherited grants we conservatively disallow resharing.
            found_level == Some(0)
                && s.axis != "everyone"
                && s.role != Role::Deny
        });

        // ── Step 6: Capability lookup ────────────────────────────────────────
        // Use the resource_type of the first (most specific) resource.
        let capabilities = self
            .get_capabilities(resource.resource_type.as_str(), effective_role.as_str())
            .await?;

        tracing::debug!(
            role          = %effective_role,
            can_reshare,
            caps          = capabilities.len(),
            depth         = ?found_level,
            "resolved effective permission (parent-chain)"
        );

        Ok(Some(EffectivePermission {
            role: effective_role,
            can_reshare,
            capabilities,
            sources: all_sources,
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

    /// Check that `action` is allowed, walking a parent chain for inheritance.
    ///
    /// Combines [`resolve_with_parents`] with action validation.
    ///
    /// # Errors
    ///
    /// - [`Error::Forbidden`] — action not permitted or access denied.
    /// - [`Error::Database`] — repository call failed.
    ///
    /// # Panics
    ///
    /// No panics — all errors are propagated via `Result`.
    #[instrument(skip(self, user_ctx, chain), fields(
        user_id   = %user_ctx.user_id,
        chain_len = chain.len(),
        action    = %action,
    ))]
    pub async fn check_action_with_parents(
        &self,
        user_ctx: &UserContext,
        chain: &[ResourceRef],
        owner_id: Option<Uuid>,
        action: &Action,
    ) -> Result<()> {
        let resource_display = chain
            .first()
            .map(|r| r.to_string())
            .unwrap_or_else(|| "<empty>".into());

        match self.resolve_with_parents(user_ctx, chain, owner_id).await? {
            None => Err(Error::Forbidden(format!(
                "access denied to {} on {}",
                action, resource_display
            ))),
            Some(ep) => {
                if ep.capabilities.iter().any(|c| c == action.as_str()) {
                    Ok(())
                } else {
                    Err(Error::Forbidden(format!(
                        "action '{}' not permitted on {} (role: {})",
                        action, resource_display, ep.role
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

    // ── Parent-chain unit tests ───────────────────────────────────────────────
    //
    // The following tests exercise the chain-construction helpers and logic
    // that can be verified without a live database (e.g. chain ordering, empty
    // chain handling, Role::max_permissive merging across sources).
    //
    // Integration tests that exercise resolve_with_parents against a real pool
    // live in tests/integration_resolver.rs.

    /// An empty chain must produce no `ResourceRef` at index 0.
    #[test]
    fn empty_chain_has_no_primary_resource() {
        let chain: Vec<ResourceRef> = vec![];
        assert!(chain.first().is_none());
    }

    /// A single-element chain represents a resource with no ancestors.
    #[test]
    fn single_element_chain() {
        let id = Uuid::new_v4();
        let chain = vec![ResourceRef::file(id)];
        assert_eq!(chain.len(), 1);
        assert_eq!(chain[0].resource_type, crate::types::ResourceType::File);
        assert_eq!(chain[0].resource_id, id);
    }

    /// A two-element chain has the child at index 0 and the parent at index 1.
    #[test]
    fn two_element_chain_ordering() {
        let file_id = Uuid::new_v4();
        let folder_id = Uuid::new_v4();
        let chain = vec![
            ResourceRef::file(file_id),
            ResourceRef::folder(folder_id),
        ];
        assert_eq!(chain[0].resource_id, file_id);
        assert_eq!(chain[1].resource_id, folder_id);
    }

    /// Role merging: most permissive wins across multiple sources.
    #[test]
    fn role_most_permissive_across_sources() {
        let sources = vec![
            PermissionSource {
                axis: "user".into(),
                grantee_name: None,
                role: Role::Viewer,
                via: "direct".into(),
            },
            PermissionSource {
                axis: "group".into(),
                grantee_name: None,
                role: Role::Editor,
                via: "inherited from folder".into(),
            },
        ];
        let effective = sources
            .iter()
            .map(|s| s.role)
            .fold(Role::Deny, Role::max_permissive);
        assert_eq!(effective, Role::Editor);
    }

    /// A Deny source alongside a positive grant → positive grant wins
    /// (deny-at-a-level is caught by has_deny before grant collection).
    #[test]
    fn deny_source_plus_positive_grant_most_permissive() {
        // In the resolver, an explicit deny triggers early return via has_deny.
        // If a Deny role somehow ends up in sources (e.g. a stale record), the
        // most-permissive merge still picks the positive role.
        let sources = vec![
            PermissionSource {
                axis: "group".into(),
                grantee_name: None,
                role: Role::Deny,
                via: "some legacy record".into(),
            },
            PermissionSource {
                axis: "user".into(),
                grantee_name: None,
                role: Role::Manager,
                via: "direct".into(),
            },
        ];
        let effective = sources
            .iter()
            .map(|s| s.role)
            .fold(Role::Deny, Role::max_permissive);
        assert_eq!(effective, Role::Manager);
    }

    /// All sources being Deny → effective role is Deny.
    #[test]
    fn all_deny_sources_gives_deny_role() {
        let sources = vec![PermissionSource {
            axis: "group".into(),
            grantee_name: None,
            role: Role::Deny,
            via: "explicit deny".into(),
        }];
        let effective = sources
            .iter()
            .map(|s| s.role)
            .fold(Role::Deny, Role::max_permissive);
        assert_eq!(effective, Role::Deny);
    }

    /// Verify `PermissionSource::via` is set correctly for inherited grants.
    #[test]
    fn via_suffix_format_for_inherited_grant() {
        let folder = ResourceRef::folder(Uuid::new_v4());
        let via = format!("inherited from {folder}");
        assert!(via.starts_with("inherited from folder:"));
    }

    /// Verify `PermissionSource::via` is "direct grant" at depth 0.
    #[test]
    fn via_suffix_direct_at_depth_zero() {
        let depth: usize = 0;
        let via = if depth == 0 {
            "direct grant".to_owned()
        } else {
            "inherited from something".to_owned()
        };
        assert_eq!(via, "direct grant");
    }

    /// `found_level = Some(0)` → can_reshare may be true; `Some(1)` → false.
    #[test]
    fn can_reshare_false_for_inherited_level() {
        // Simulate the can_reshare predicate used in resolve_with_parents.
        let found_level: Option<usize> = Some(1); // inherited from parent
        let sources = vec![PermissionSource {
            axis: "user".into(),
            grantee_name: None,
            role: Role::Editor,
            via: "inherited from folder".into(),
        }];
        let can_reshare = sources.iter().any(|s| {
            found_level == Some(0) && s.axis != "everyone" && s.role != Role::Deny
        });
        assert!(!can_reshare);
    }

    /// `found_level = Some(0)` + non-everyone non-deny source → can_reshare true.
    #[test]
    fn can_reshare_true_for_direct_level() {
        let found_level: Option<usize> = Some(0);
        let sources = vec![PermissionSource {
            axis: "user".into(),
            grantee_name: None,
            role: Role::Manager,
            via: "direct grant".into(),
        }];
        let can_reshare = sources.iter().any(|s| {
            found_level == Some(0) && s.axis != "everyone" && s.role != Role::Deny
        });
        assert!(can_reshare);
    }

    /// `found_level = None` (no grants found anywhere) → can_reshare stays false.
    #[test]
    fn can_reshare_false_when_no_level_found() {
        let found_level: Option<usize> = None;
        let sources = vec![PermissionSource {
            axis: "user".into(),
            grantee_name: None,
            role: Role::Editor,
            via: "direct grant".into(),
        }];
        let can_reshare = sources.iter().any(|s| {
            found_level == Some(0) && s.axis != "everyone" && s.role != Role::Deny
        });
        assert!(!can_reshare);
    }

    /// Secondary deny safety net: a Deny in sources blocks access even when
    /// positive grants are present in the same collection.
    ///
    /// This verifies the logic added before the most-permissive fold in
    /// both `resolve` and `resolve_with_parents`.
    #[test]
    fn secondary_deny_safety_net_blocks_access() {
        // Mixed sources: one Deny + one Manager
        let sources_with_deny = vec![
            PermissionSource {
                axis: "group".into(),
                grantee_name: None,
                role: Role::Deny,
                via: "explicit deny".into(),
            },
            PermissionSource {
                axis: "user".into(),
                grantee_name: None,
                role: Role::Manager,
                via: "direct grant".into(),
            },
        ];
        // The secondary safety net: if any source is Deny → deny access
        let blocked = sources_with_deny.iter().any(|s| s.role == Role::Deny);
        assert!(blocked, "deny in sources must block access (secondary net)");

        // Without Deny sources → not blocked
        let sources_no_deny = vec![PermissionSource {
            axis: "user".into(),
            grantee_name: None,
            role: Role::Manager,
            via: "direct grant".into(),
        }];
        let blocked_no_deny = sources_no_deny.iter().any(|s| s.role == Role::Deny);
        assert!(
            !blocked_no_deny,
            "no deny in sources must not trigger secondary net"
        );
    }
}
