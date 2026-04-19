//! Canonical `OrgPermissionResolver` implementation backed by the
//! canonical `org_*` tables (nodes / policies / bindings / boards /
//! access grants) plus a moka decision cache.
//!
//! Every SignApps service receives this resolver as
//! `Arc<dyn OrgPermissionResolver>` via `SharedState::resolver` and
//! never instantiates it directly — the platform binary builds it once
//! from the shared pool before spawning services.
//!
//! # Decision order
//!
//! The resolver tries rules in this order and stops at the first hit:
//!
//! 1. **Direct access grants** — a row in `org_access_grants` matching
//!    `(tenant_id, resource_type, resource_id, granted_to=person)`
//!    that is not revoked / not expired and whose `permissions`
//!    contains the action.
//! 2. **Policy bindings** — a row in `org_policy_bindings` that
//!    attaches a policy to an ancestor node (via LTREE `path @>`) and
//!    whose `org_policies.permissions` contains the action.  Assumes
//!    the caller holds an assignment to the bound node (or any
//!    descendant when `inherit = true`).
//! 3. **Board membership** — the caller sits on the governing board
//!    of an ancestor node (`org_board_members.person_id`).
//! 4. **Tenant admin** — caller's JWT role is 2 (admin) or 3
//!    (super-admin).  Surfaced via the `admin_role` parameter of
//!    [`OrgClient::check_with_role`].
//! 5. **SO1 delegation** — if the caller is a **delegate** on an
//!    active `org_delegations` row with `scope IN ('rbac','all')`,
//!    the resolver re-runs steps 1–3 using the **delegator** identity
//!    and accepts an allow from that branch.

use std::sync::Arc;

use async_trait::async_trait;
use signapps_common::rbac::{
    cache::{CachedDecision, DecisionCache},
    resolver::{OrgPermissionResolver, RbacError},
    types::{Action, Decision, DecisionSource, DenyReason, PersonRef, ResourceRef},
};
use sqlx::PgPool;
use uuid::Uuid;

/// Concrete resolver bound to the runtime's Postgres pool.
pub struct OrgClient {
    pool: Arc<PgPool>,
    cache: DecisionCache,
}

impl OrgClient {
    /// Build a new resolver from an `Arc<PgPool>`.
    ///
    /// `ttl_sec` is the TTL applied to each cached decision.  The
    /// platform builder passes 60 s — short enough to absorb policy
    /// churn, long enough to avoid hammering Postgres on hot paths.
    pub fn new(pool: Arc<PgPool>, ttl_sec: u64) -> Self {
        Self {
            pool,
            cache: DecisionCache::new(ttl_sec),
        }
    }

    /// Access the inner cache — used by the event listener to issue
    /// targeted invalidations on `org.*` notifications.
    pub fn cache(&self) -> &DecisionCache {
        &self.cache
    }

    /// Extended check that accepts an optional admin role.  If the
    /// caller is an admin, the method short-circuits with
    /// `Decision::Allow { source: Admin }`.
    ///
    /// This is the entry point used by the Axum middleware: `role` is
    /// read from `Claims::role`.  The plain [`OrgPermissionResolver`]
    /// trait method is a thin wrapper that passes `None`.
    ///
    /// # Errors
    ///
    /// Returns [`RbacError::Unavailable`] if Postgres is unreachable.
    pub async fn check_with_role(
        &self,
        who: PersonRef,
        resource: ResourceRef,
        action: Action,
        admin_role: Option<i16>,
    ) -> Result<Decision, RbacError> {
        // Fast-path: admin short-circuit.
        if matches!(admin_role, Some(r) if r >= 2) {
            return Ok(Decision::Allow { source: DecisionSource::Admin });
        }

        // Cache lookup.
        if let Some(c) = self.cache.get(who, &resource, action).await {
            return Ok(if c.allow {
                // We don't cache the precise source — reconstruct a
                // placeholder.  Callers that need provenance bypass
                // the cache.
                Decision::Allow {
                    source: DecisionSource::PolicyBinding {
                        policy_id: Uuid::nil(),
                        node_id: Uuid::nil(),
                    },
                }
            } else {
                Decision::Deny { reason: DenyReason::NoGrant }
            });
        }

        // 1) Direct access grants.
        if let Some(source) = self
            .direct_grant(who, &resource, action)
            .await
            .map_err(|e| RbacError::Unavailable(e.to_string()))?
        {
            self.cache
                .put(who, &resource, action, CachedDecision { allow: true })
                .await;
            return Ok(Decision::Allow { source });
        }

        // 2) Policy bindings — resource must be an OrgNode for the
        //    canonical LTREE join.  Other resource kinds need a
        //    containing node which is service-specific and will be
        //    fleshed out as each service adopts the resolver.  In the
        //    meantime we only cover OrgNode.
        if let ResourceRef::OrgNode(node_id) = resource {
            if let Some(source) = self
                .policy_binding(who, node_id, action)
                .await
                .map_err(|e| RbacError::Unavailable(e.to_string()))?
            {
                self.cache
                    .put(who, &resource, action, CachedDecision { allow: true })
                    .await;
                return Ok(Decision::Allow { source });
            }

            // 3) Board of containing node.
            if let Some(source) = self
                .board_member(who, node_id)
                .await
                .map_err(|e| RbacError::Unavailable(e.to_string()))?
            {
                self.cache
                    .put(who, &resource, action, CachedDecision { allow: true })
                    .await;
                return Ok(Decision::Allow { source });
            }
        }

        // 5) SO1 delegation branch — si `who` est delegate actif d'une
        //    délégation avec scope IN ('rbac','all'), on réessaye les
        //    checks 1-3 avec l'identité du delegator.
        if let Some(source) = self
            .check_via_delegation(who, &resource, action)
            .await
            .map_err(|e| RbacError::Unavailable(e.to_string()))?
        {
            self.cache
                .put(who, &resource, action, CachedDecision { allow: true })
                .await;
            return Ok(Decision::Allow { source });
        }

        // Nothing matched — cache the deny.
        self.cache
            .put(who, &resource, action, CachedDecision { allow: false })
            .await;
        Ok(Decision::Deny { reason: DenyReason::NoGrant })
    }

    // ---- Step 5: SO1 delegation branch -----------------------------

    /// Si `who` est delegate actif (scope rbac/all) d'une délégation,
    /// réessayer steps 1-3 avec l'identité du delegator. Retourne une
    /// [`DecisionSource::Delegation`] si l'une des checks autorise.
    async fn check_via_delegation(
        &self,
        who: PersonRef,
        resource: &ResourceRef,
        action: Action,
    ) -> Result<Option<DecisionSource>, sqlx::Error> {
        // Charger les délégations actives pour `who` (comme delegate).
        let rows: Vec<(Uuid, Uuid)> = sqlx::query_as(
            r#"
            SELECT id, delegator_person_id
              FROM org_delegations
             WHERE tenant_id = $1
               AND delegate_person_id = $2
               AND active = true
               AND now() BETWEEN start_at AND end_at
               AND scope IN ('rbac','all')
            "#,
        )
        .bind(who.tenant_id)
        .bind(who.id)
        .fetch_all(self.pool.as_ref())
        .await?;

        for (delegation_id, delegator_person_id) in rows {
            let as_delegator = PersonRef {
                id: delegator_person_id,
                tenant_id: who.tenant_id,
            };
            if self.direct_grant(as_delegator, resource, action).await?.is_some() {
                return Ok(Some(DecisionSource::Delegation {
                    delegation_id,
                    delegator_person_id,
                }));
            }
            if let ResourceRef::OrgNode(node_id) = *resource {
                if self.policy_binding(as_delegator, node_id, action).await?.is_some() {
                    return Ok(Some(DecisionSource::Delegation {
                        delegation_id,
                        delegator_person_id,
                    }));
                }
                if self.board_member(as_delegator, node_id).await?.is_some() {
                    return Ok(Some(DecisionSource::Delegation {
                        delegation_id,
                        delegator_person_id,
                    }));
                }
            }
        }
        Ok(None)
    }

    // ---- Step 1: direct grants -------------------------------------

    /// Look for a direct `org_access_grants` row that matches the
    /// person + resource + action triple.
    async fn direct_grant(
        &self,
        who: PersonRef,
        resource: &ResourceRef,
        action: Action,
    ) -> Result<Option<DecisionSource>, sqlx::Error> {
        let rec: Option<(Uuid,)> = sqlx::query_as(
            r#"
            SELECT id
            FROM org_access_grants
            WHERE tenant_id = $1
              AND granted_to = $2
              AND resource_type = $3
              AND resource_id = $4
              AND (revoked_at IS NULL)
              AND (expires_at IS NULL OR expires_at > now())
              AND (permissions @> $5::jsonb OR permissions @> $6::jsonb)
            LIMIT 1
            "#,
        )
        .bind(who.tenant_id)
        .bind(who.id)
        .bind(resource.kind())
        .bind(resource.id())
        .bind(serde_json::json!([action.as_str()]))
        .bind(serde_json::json!([action.as_str(), "admin"]))
        .fetch_optional(self.pool.as_ref())
        .await?;

        Ok(rec.map(|(grant_id,)| DecisionSource::AccessGrant { grant_id }))
    }

    // ---- Step 2: policy binding along the org path ------------------

    /// Look for a policy bound to an ancestor of `node_id` whose
    /// `permissions` contains the requested action, and to which
    /// `who` is assigned.
    async fn policy_binding(
        &self,
        who: PersonRef,
        node_id: Uuid,
        action: Action,
    ) -> Result<Option<DecisionSource>, sqlx::Error> {
        let rec: Option<(Uuid, Uuid)> = sqlx::query_as(
            r#"
            SELECT pb.policy_id, pb.node_id
            FROM org_policy_bindings pb
            JOIN org_policies       p ON p.id = pb.policy_id
            JOIN org_nodes          an ON an.id = pb.node_id
            JOIN org_nodes          rn ON rn.id = $2
            WHERE p.tenant_id = $1
              AND (an.path @> rn.path)
              AND (p.permissions @> $3::jsonb OR p.permissions @> $4::jsonb)
              AND EXISTS (
                  SELECT 1 FROM org_assignments a
                  WHERE a.person_id = $5
                    AND a.tenant_id = $1
                    AND (a.node_id = an.id
                         OR (pb.inherit = true
                             AND EXISTS (
                                 SELECT 1 FROM org_nodes ann
                                 WHERE ann.id = a.node_id
                                   AND an.path @> ann.path
                             )))
              )
            LIMIT 1
            "#,
        )
        .bind(who.tenant_id)
        .bind(node_id)
        .bind(serde_json::json!([action.as_str()]))
        .bind(serde_json::json!([action.as_str(), "admin"]))
        .bind(who.id)
        .fetch_optional(self.pool.as_ref())
        .await?;

        Ok(rec.map(|(policy_id, node_id)| DecisionSource::PolicyBinding { policy_id, node_id }))
    }

    // ---- Step 3: board of containing node ---------------------------

    /// Look for a board seat on any ancestor of `node_id`.
    async fn board_member(
        &self,
        who: PersonRef,
        node_id: Uuid,
    ) -> Result<Option<DecisionSource>, sqlx::Error> {
        let rec: Option<(Uuid,)> = sqlx::query_as(
            r#"
            SELECT ob.node_id
            FROM org_board_members obm
            JOIN org_boards        ob ON ob.id = obm.board_id
            JOIN org_nodes         an ON an.id = ob.node_id
            JOIN org_nodes         rn ON rn.id = $2
            WHERE obm.person_id = $1
              AND (an.path @> rn.path)
            LIMIT 1
            "#,
        )
        .bind(who.id)
        .bind(node_id)
        .fetch_optional(self.pool.as_ref())
        .await?;

        Ok(rec.map(|(node_id,)| DecisionSource::BoardOfContainingNode(node_id)))
    }
}

#[async_trait]
impl OrgPermissionResolver for OrgClient {
    #[tracing::instrument(skip(self), fields(person = %who.id, tenant = %who.tenant_id, resource = resource.kind(), action = action.as_str()))]
    async fn check(
        &self,
        who: PersonRef,
        resource: ResourceRef,
        action: Action,
    ) -> Result<Decision, RbacError> {
        self.check_with_role(who, resource, action, None).await
    }
}
