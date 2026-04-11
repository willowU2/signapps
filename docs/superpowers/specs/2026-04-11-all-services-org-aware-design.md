# All Services Org-Aware — Design Spec

## Summary

Make all 34 SignApps services org-aware by applying the patterns established in the Unified Person Model, My-Team, Mail, and Projects features. Four phases: (1) add tenant_context to 8 sharing services, (2) add sharing to 5 tenant services, (3) full org-awareness for 16 greenfield services, (4) portal/guest mode transversal.

## Established Patterns

These patterns are already proven and must be applied consistently:

### Tenant Context Middleware
```rust
// In main.rs route registration:
.layer(axum::middleware::from_fn(
    signapps_common::middleware::tenant_context_middleware,
))
.layer(axum::middleware::from_fn_with_state(
    state.clone(),
    signapps_common::middleware::auth_middleware::<AppState>,
))
```
Extracts `TenantContext` from JWT claims, makes `ctx.tenant_id` available to handlers.

### Claims with Context
JWT now contains: `sub`, `person_id`, `context_id`, `context_type`, `company_id`, `tenant_id`.
All handlers can use `claims.person_id` for person-scoped queries and `claims.context_type` for portal filtering.

### Sharing Engine
```rust
use signapps_sharing::SharingEngine;
// Check access: sharing_engine.check_access(resource_type, resource_id, user_id)
// Grant access: sharing_engine.grant(resource_type, resource_id, grantee_type, grantee_id, role)
```

### Portal Access
- `context_type = 'employee'` → full access
- `context_type = 'client'` → filtered by company_id + sharing.grants
- `context_type = 'supplier'` → same filtering

## Phase 1: Add Tenant Context to Sharing Services (8 services)

These services have SharingEngine but no tenant isolation:

| Service | Port | Action |
|---------|------|--------|
| calendar | 3011 | Add tenant_context_middleware to router |
| chat | 3020 | Add tenant_context_middleware to router |
| contacts | 3021 | Add tenant_context_middleware to router |
| docs | 3010 | Add tenant_context_middleware to router |
| forms | 3015 | Add tenant_context_middleware to router |
| it-assets | 3022 | Add tenant_context_middleware to router |
| mail | 3012 | Already has it on new routes, extend to all |
| storage | 3004 | Add tenant_context_middleware to router |

**Implementation per service:**
1. Open `services/signapps-{name}/src/main.rs`
2. Find the protected router section
3. Add `.layer(axum::middleware::from_fn(signapps_common::middleware::tenant_context_middleware))` BEFORE the auth middleware layer
4. In handlers that query data, add `WHERE tenant_id = $ctx.tenant_id` to SELECT queries where the table has a tenant_id column
5. Verify compilation: `cargo check -p signapps-{name}`

## Phase 2: Add Sharing to Tenant Services (5 services)

These services have tenant isolation but no resource-level sharing:

| Service | Port | Resources to share |
|---------|------|--------------------|
| identity | 3001 | user profiles, groups |
| scheduler | 3007 | projects (already done), scheduled tasks |
| signatures | 3028 | envelopes, templates |
| tenant-config | 3029 | branding configs (admin-only, no sharing needed) |
| workforce | 3024 | org charts (read via permissions), employee data |

**Implementation per service:**
1. Add `signapps-sharing` to Cargo.toml dependencies
2. Initialize SharingEngine in AppState
3. Add sharing routes: `GET/POST /api/v1/{resource}/:id/shares`
4. Check sharing grants in list/get handlers before returning data

**Skip tenant-config** — it's admin-only configuration, sharing doesn't apply.

## Phase 3: Full Org-Awareness for Greenfield Services (16 services)

These services need both tenant isolation AND Claims-based scoping:

| Service | Port | Data to scope | Priority |
|---------|------|---------------|----------|
| vault | 3025 | secrets, keys | HIGH — per-user private data |
| billing | 8096 | invoices, subscriptions | HIGH — company-scoped |
| compliance | 3032 | DPIA, DSAR, audit trails | HIGH — tenant-scoped |
| backup | 3031 | backup configs, schedules | MEDIUM — admin-only |
| integrations | 3030 | webhooks, API keys, automations | MEDIUM — tenant-scoped |
| ai | 3005 | conversations, embeddings | MEDIUM — per-user |
| media | 3009 | processed files | MEDIUM — per-user via storage |
| meet | 3014 | meetings, recordings | MEDIUM — per-user + sharing |
| metrics | 3008 | dashboards, alerts | LOW — admin/system |
| containers | 3002 | docker containers | LOW — admin/infra |
| proxy | 3003 | routes, certificates | LOW — admin/infra |
| securelink | 3006 | tunnels, DNS | LOW — admin/infra |
| pxe | 3016 | boot configs | LOW — admin/infra |
| webhooks | 3027 | webhook configs | LOW — tenant-scoped |
| org | 3026 | org structure | LOW — already org-native |
| gateway | 3099 | routing rules | LOW — proxy, no data |
| social | 3019 | posts, accounts | MEDIUM — per-user |
| gamification | 3033 | XP, badges | LOW — per-user |
| collaboration | 3034 | boards, mind maps | MEDIUM — sharing needed |
| notifications | 8095 | notification items | LOW — per-user (already has user_id) |

**Implementation per service (HIGH + MEDIUM priority):**
1. Add tenant_context_middleware to router
2. Add `WHERE tenant_id = $1` to data queries (if table has tenant_id)
3. Add `WHERE user_id = $1` or `WHERE person_id = $1` for per-user data
4. For shared resources (meet recordings, collab boards): integrate SharingEngine
5. For portal-accessible resources: add `context_type` filtering

**Skip LOW priority services** — they are admin/infra tools that don't need per-user org-awareness. They work at tenant level which is sufficient.

## Phase 4: Portal/Guest Mode Transversal

### Portal Token Support

The JWT already contains `context_type` from the Unified Person Model. Services need to check it:

```rust
// In any handler that portal users might access:
fn check_portal_access(claims: &Claims, resource_owner_id: Uuid) -> bool {
    match claims.context_type.as_deref() {
        Some("employee") => true, // full access
        Some("client") | Some("supplier") => {
            // Check if resource is shared with this person's company
            // via sharing.grants WHERE grantee_type='company' AND grantee_id=claims.company_id
            true // delegate to SharingEngine
        }
        _ => false
    }
}
```

### Services with Portal Access

| Service | Portal Feature |
|---------|---------------|
| storage | Shared documents visible in portal |
| billing | Invoices visible to client contacts |
| docs | Shared documents editable by external contributors |
| forms | Forms fillable by portal users |
| signatures | Envelopes signable by external parties |
| helpdesk (via identity) | Tickets creatable by portal users |
| calendar | Shared events visible to external members |
| meet | Meetings joinable by external invitees |

### Implementation
For each portal-accessible service:
1. Check `claims.context_type` in handlers
2. If external: filter data by `sharing.grants WHERE grantee_type='company' AND grantee_id = claims.company_id`
3. Block write access unless explicitly granted (role = 'editor' or 'contributor')

## Migration

No new tables needed — all patterns use existing:
- `identity.tenants` (tenant isolation)
- `sharing.grants` (resource-level access)
- `core.persons` / `core.companies` (person/company scoping)
- `identity.login_contexts` (context type detection)

## Implementation Strategy

Given the scale (34 services), implementation should be batched:

**Batch A (Phase 1):** 8 services, 1 line change each (add middleware layer) — 1 commit per service
**Batch B (Phase 2):** 4 services (skip tenant-config), add sharing routes — 1 commit per service
**Batch C (Phase 3 HIGH):** vault, billing, compliance — full implementation
**Batch D (Phase 3 MEDIUM):** ai, media, meet, social, collaboration, integrations — add scoping
**Batch E (Phase 4):** storage, billing, docs, forms, signatures, calendar, meet — portal checks

## E2E Assertions

- All services return 401 without JWT
- Tenant A data is invisible to Tenant B users
- Employee context sees full data
- Client context sees only shared resources
- Supplier context sees only shared resources
- Portal user cannot access admin endpoints
- Sharing a resource with a company makes it visible to all company contacts
- Revoking a share removes visibility immediately
