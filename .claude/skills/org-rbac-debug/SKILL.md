---
name: org-rbac-debug
description: Use when a service returns 403 on /api/v1/* with the RBAC middleware enabled, when `OrgPermissionResolver` is missing from a service AppState, when an admin role gets denied despite a valid JWT, when moka cache is stale after a policy change, or when SQL debug shows `org_policy_bindings` / `org_access_grants` miss-joins. Covers the RBAC trait, the three resolver paths (grants → policies → boards) and the moka 60 s TTL cache.
---

# org-rbac-debug

Use this skill when debugging RBAC decisions across the 34 services after the S1 refonte.

## Architecture recap

RBAC in SignApps goes through a **single trait** — `OrgPermissionResolver` in `signapps-common::rbac` (behind the `rbac` feature) — and a **single implementation** — `OrgClient` in `signapps-org`. Every service receives it via `SharedState::resolver` as `Arc<dyn OrgPermissionResolver>` and plugs the `rbac::require(action, resource_extractor)` middleware onto its protected routes.

Resolution order inside `OrgClient::check`:

1. **Access grants** — look up `org_access_grants` for direct `(person_id | anonymous, resource_type, resource_id)` matches. Grants carry their own expiry + revocation flag; an active grant with the requested permission short-circuits to `Decision::Allow`.
2. **Policy bindings** — walk `org_policy_bindings` along the ltree path of the caller's assignment(s). Each binding points at a `policies.permissions` JSONB array; the first match wins.
3. **Board memberships** — if the resource lives under an org node and the caller is a member of a board attached to an ancestor node, the board's permissions cascade down via ltree subtree queries.

A moka cache with **60 s TTL** front-loads the result keyed by `(person_id, resource_type, resource_id, action)`. Cache invalidation is triggered by the event bus: `org.policy.binding_changed`, `org.grant.revoked`, `org.user.archived`, `org.assignment.updated`.

## Common issues

- **503 / RbacError::Unavailable** — `OrgClient` cannot reach its backing pool. Usually means the service was started before `SharedState::resolver` was populated. Check the service's `AppState::resolver` is `Some` and that `lib.rs::router()` receives the SharedState by value.
- **Unexpected 403 with admin JWT** — the JWT contains `role` but NOT the org `person_id` the resolver needs. Inspect the `auth_middleware` output — the `Claims` must have a `sub` that resolves to a `org_persons.id`. Missing mapping usually means the legacy `core.users` → `org_persons` cutover left the admin without a person row.
- **Stale allow after DELETE /api/v1/org/grants/:id** — the moka TTL has not expired AND the invalidation event was not published. `rtk grep "org.grant.revoked" services/signapps-org` must show the publish call wrapped in a `warn!` on failure.
- **OrgPermissionResolver not in AppState** — the service was added after the W4 rollout but its `AppState` builder was not updated. Diff against `signapps-mail::AppState` (reference) + check the `rbac` feature is enabled in the service's `Cargo.toml`.
- **SQL cost spike on `check`** — the ltree GiST index on `org_nodes.path` was dropped during a reseed. Verify via `docker exec signapps-postgres psql -c "\d org_nodes"`.
- **Different answer for the same key in two consecutive calls** — two cache instances (one per `Arc::clone` vs one per service). There MUST be exactly one `OrgClient` per process; check `SharedState::init_once` is the only constructor.

## Commands

```bash
# Which services have the rbac feature wired?
rtk grep -n "rbac" services/*/Cargo.toml

# Where is require(...) middleware applied?
rtk grep -n "rbac::require" services/

# Trait + impl file list
rtk grep -n "OrgPermissionResolver" crates/signapps-common/src/rbac services/signapps-org/src

# Inspect recent grant revocations
docker exec signapps-postgres psql -U signapps -d signapps -c "SELECT id, resource_type, resource_id, is_revoked, expires_at FROM org_access_grants ORDER BY created_at DESC LIMIT 20"

# Inspect policy bindings tree for a node
docker exec signapps-postgres psql -U signapps -d signapps -c "SELECT b.id, b.node_id, p.name FROM org_policy_bindings b JOIN org_policies p ON p.id = b.policy_id ORDER BY b.created_at DESC LIMIT 20"

# Active bus subscriptions relevant to RBAC
docker exec signapps-postgres psql -U signapps -d signapps -c "SELECT consumer, cursor FROM platform.event_cursors WHERE consumer ILIKE '%rbac%' OR consumer ILIKE '%org%'"

# Verify cache invalidation callback is wired
rtk grep -n "invalidate" crates/signapps-common/src/rbac/cache.rs services/signapps-org/src/rbac_client.rs
```

Service-log snippets to look for:

```
rbac_client: cache hit      (good)
rbac_client: cache miss     (first call for key)
rbac_client: decision=Allow (final answer)
rbac_client: decision=Deny reason=...
```

## Related

- Spec: `docs/superpowers/specs/2026-04-18-s1-org-rbac-refonte-design.md`
- Plan: `docs/superpowers/plans/2026-04-18-s1-org-rbac-refonte.md` (Tasks 22-29 = W4 rollout)
- Product spec: `docs/product-specs/53-org-rbac-refonte.md`
- Code: `crates/signapps-common/src/rbac/{mod,resolver,middleware,cache,types}.rs`, `services/signapps-org/src/rbac_client.rs`
- Migrations: `404_org_policies.sql`, `406_org_access_grants.sql`, `405_org_boards.sql`
