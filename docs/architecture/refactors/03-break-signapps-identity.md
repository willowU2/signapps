# Refactor 3: Break `signapps-identity` — Extract Non-IAM Features

> **Status:** Design — not yet executed
> **Estimated effort:** 3–5 days (human-supervised, HIGH ATTENTION)
> **Risk level:** High
> **Author:** Architecture audit, 2026-04-07

---

## Why

`signapps-identity` (port 3001) was designed as the authentication and authorization
service. It is now the largest service in the platform with 813 lines of `main.rs`, 51
handler files, and domains spanning CRM, LMS, accounting (FEC), vault, org sites, supply
chain, compliance, and Slack integrations.

This is the actual monolith hidden behind the label "auth service." Practical consequences:

1. **Deployment blast radius.** Any change to the CRM handlers (completely unrelated to
   authentication) requires re-deploying the identity service — the most security-critical
   service in the platform. A CRM bug can take down authentication for all tenants.

2. **Security audit scope explosion.** When auditing IAM security, every reviewer must
   wade through accounting, LMS, and supply chain code. Conversely, auditing accounting
   requires reading authentication middleware. The two concerns pollute each other.

3. **Compilation and testing cost.** `signapps-identity` compiles the entire `signapps-db`
   monolith plus `signapps-common` in full. Its test suite covers unrelated domains,
   making it slow and fragile.

4. **Team ownership is undefined.** Who owns `signapps-identity`? The IAM team? The HR
   team? The finance team? The answer is "everyone" which means "no one."

---

## Current State

### All 51 Handler Files in `services/signapps-identity/src/handlers/`

Enumerated from filesystem (2026-04-07):

**Clearly IAM — STAY in identity:**

| Handler | Domain | Notes |
|---|---|---|
| `auth.rs` | Authentication | Login, logout, refresh token |
| `users.rs` | User CRUD | Core user management |
| `groups.rs` | Group management | RBAC groups |
| `roles.rs` | Role management | RBAC roles |
| `mfa.rs` | Multi-factor auth | TOTP, SMS, backup codes |
| `sessions.rs` | Session management | Active sessions, revoke |
| `sso.rs` | Single Sign-On | SAML2, OIDC providers |
| `jwks.rs` | JWKS endpoint | Public key set for JWT validation |
| `ldap.rs` | LDAP/AD sync | Directory integration |
| `api_keys.rs` | API key management | Service-to-service auth |
| `guest_tokens.rs` | Guest access tokens | Temporary access |
| `ip_allowlist.rs` | IP allowlist | Network security policy |
| `admin_security.rs` | Admin security settings | Password policy, lockout |
| `security_events.rs` | Security events | Login failures, anomalies |
| `audit_logs.rs` | Audit trail | IAM-specific audit |
| `preferences.rs` | User preferences | UI/locale settings |
| `user_profile.rs` | Profile data | Name, avatar, contact |
| `bulk_users.rs` | Bulk user import | CSV/LDAP mass onboarding |
| `tenants.rs` | Tenant management | Multi-tenant administration |
| `workspace_features.rs` | Feature flags per workspace | — |
| `feature_flags.rs` | Feature flag management | — |
| `tenant_css.rs` | Tenant branding CSS | White-label per tenant |
| `branding.rs` | Tenant branding config | Logo, colors, name |
| `health.rs` | Health endpoint | Service health |
| `openapi.rs` | OpenAPI spec | Swagger UI |
| `mod.rs` | Router wiring | — |
| `migration.rs` | Data migration helpers | Tenant migration tooling |
| `retention_purge.rs` | GDPR purge | User data deletion — IAM-adjacent |
| `data_export.rs` | GDPR data export | User data portability |
| `entity_links.rs` | Cross-entity linking | Link users to resources |
| `incoming_webhooks.rs` | Webhook receivers | IAM event webhooks |
| `webhooks.rs` | Webhook dispatch | Outbound webhook delivery |
| `compliance.rs` | Compliance reporting | GDPR/SOC2 compliance checks |

**Debatable but IAM-adjacent — STAY (for now):**

| Handler | Domain | Notes |
|---|---|---|
| `org_context.rs` | Org context | Org tree context for auth decisions |
| `org_trees.rs` | Org tree CRUD | Org hierarchy management |
| `org_nodes.rs` | Org node CRUD | Org node management |
| `assignments.rs` | Org assignments | User-to-node assignments |
| `signatures.rs` | Email signatures (admin) | Tenant-level signature templates |
| `user_signatures.rs` | Email signatures (user) | User-level signature templates |
| `activities.rs` | Activity feed | User activity log |

**NOT IAM — MUST MOVE:**

| Handler | Target Service | Domain |
|---|---|---|
| `crm.rs` | `signapps-contacts` | CRM contacts, leads, pipelines |
| `persons.rs` | `signapps-contacts` | Person / contact records |
| `comms.rs` | `signapps-contacts` | Communication log / call records |
| `lms.rs` | `signapps-workforce` or new `signapps-learning` | LMS courses, enrollments, progress |
| `accounting.rs` | `signapps-billing` | FEC accounting, expense tracking |
| `vault.rs` | New `signapps-vault` service or stays if tiny | Password vault management |
| `sites.rs` | `signapps-it-assets` or new `signapps-facilities` | Physical site/office management |
| `resources.rs` | `signapps-it-assets` or `signapps-calendar` | Resource booking (rooms, assets) |
| `slack.rs` | New `signapps-integrations` | Slack integration bridge |
| `supply_chain.rs` | `signapps-workforce` | Supply chain / procurement |
| `backup.rs` | `signapps-storage` | Backup job management |

---

## What Stays in Identity (Post-Refactor)

After extraction, `signapps-identity` should cover these and only these concerns:

- Authentication: login, logout, token refresh, password reset
- User CRUD and bulk operations
- Groups, roles, and RBAC policy evaluation
- MFA (TOTP, SMS, WebAuthn)
- Sessions: list, revoke, device tracking
- SSO: SAML2, OIDC provider configuration
- API keys and guest tokens
- JWKS (public key endpoint for JWT validation)
- LDAP/AD directory sync configuration
- IP allowlist and admin security settings
- Security events and anomaly detection
- Audit logs (IAM-specific)
- Tenant management and white-labeling
- Feature flags
- Compliance (GDPR: data export, purge, audit)
- Webhooks (IAM event delivery)
- Org tree + assignments (these drive RBAC, so they stay)

---

## Extraction Targets

### Extraction 1: CRM + Persons + Comms → `signapps-contacts`

**Source handlers:** `crm.rs`, `persons.rs`, `comms.rs`
**Target service:** `services/signapps-contacts/` (already exists, port 8097 or TBD)
**DB models:** `core_org.rs` (PersonRepository, SiteRepository) in `signapps-db-identity`
  → copy relevant structs into `signapps-db-content` or new `signapps-db-crm`
**API paths currently served:**
- `GET/POST /api/v1/identity/crm/*`
- `GET/POST /api/v1/identity/persons/*`
- `GET/POST /api/v1/identity/comms/*`
**API paths after migration:**
- `GET/POST /api/v1/contacts/crm/*`
- `GET/POST /api/v1/contacts/persons/*`
- `GET/POST /api/v1/contacts/comms/*`
**Gateway routing:** Update `signapps-gateway` to proxy old paths to new service.

---

### Extraction 2: LMS → `signapps-workforce`

**Source handlers:** `lms.rs`
**Target service:** `services/signapps-workforce/` (port 3021 — already exists)
**API paths currently served:** `GET/POST /api/v1/identity/lms/*`
**API paths after migration:** `GET/POST /api/v1/workforce/lms/*`
**Gateway routing:** Forward old `/api/v1/identity/lms/*` → workforce service.

---

### Extraction 3: Accounting → `signapps-billing`

**Source handlers:** `accounting.rs`
**Target service:** `services/signapps-billing/` (port 8096 — already exists)
**Source module in common:** `signapps-common::accounting` (FEC exporter, 380 lines)
  — also covered by Refactor 2 extraction of `signapps-accounting-fec`
**API paths currently served:** `GET/POST /api/v1/identity/accounting/*`
**API paths after migration:** `GET/POST /api/v1/billing/accounting/*`
**DB impact:** Any `accounting`-related models currently live in identity's domain.
  Verify if a SQL schema change is needed or if models can be re-used by billing.

---

### Extraction 4: Vault → New `signapps-vault` Service

**Source handlers:** `vault.rs`
**Target:** New service `services/signapps-vault/` on port 3023 (or next available)
**Rationale for new service vs. staying:** Vault has its own encryption key management
  (`VaultKeysRepository`, `VaultOrgKeyRepository`), separate audit trail, and security
  requirements that differ from IAM. It should have its own deployment boundary.
**DB models:** All vault models from `signapps-db::vault` → `signapps-db-vault`
  (already designed in Refactor 1).
**API paths currently served:** `GET/POST /api/v1/identity/vault/*`
**API paths after migration:** `GET/POST /api/v1/vault/*`
**Note:** `services/signapps-proxy/src/handlers/vault_browse.rs` already exists — this
  vault browse handler in proxy may be related; audit the overlap before extraction.

---

### Extraction 5: Sites + Resources → `signapps-it-assets`

**Source handlers:** `sites.rs`, `resources.rs`
**Target service:** `services/signapps-it-assets/` (port 3022 — already exists)
**Rationale:** Physical sites and bookable resources are infrastructure/facilities concerns,
  not identity concerns. IT-assets already manages devices and infrastructure.
**API paths currently served:**
- `GET/POST /api/v1/identity/sites/*`
- `GET/POST /api/v1/identity/resources/*`
**API paths after migration:**
- `GET/POST /api/v1/it-assets/sites/*`
- `GET/POST /api/v1/it-assets/resources/*`

---

### Extraction 6: Slack Bridge → New `signapps-integrations`

**Source handlers:** `slack.rs`
**Source module in common:** `signapps-common::bridge` (Slack/Teams bridge, 323 lines)
**Target:** New service `services/signapps-integrations/` on port 3024 (or next available)
**Rationale:** Integration bridges will grow (Teams, GitHub, Jira, etc.). Keeping them in
  identity conflates external platform integration with user authentication.
**API paths currently served:** `GET/POST /api/v1/identity/slack/*`
**API paths after migration:** `GET/POST /api/v1/integrations/slack/*`

---

### Extraction 7: Supply Chain → `signapps-workforce`

**Source handlers:** `supply_chain.rs`
**Target service:** `services/signapps-workforce/` (port 3021)
**Rationale:** Supply chain / procurement is an HR/workforce concern.
**API paths:** Forward `/api/v1/identity/supply-chain/*` → `/api/v1/workforce/supply-chain/*`

---

### Extraction 8: Backup Management → `signapps-storage`

**Source handlers:** `backup.rs`
**Target service:** `services/signapps-storage/` (port 3004)
**Rationale:** Backup job management is a storage operations concern.
**API paths:** Forward `/api/v1/identity/backups/*` → `/api/v1/storage/backups/*`

---

## Migration Plan

### Phase 1: Audit Hidden Coupling

**Goal:** Before moving any code, map every cross-handler `use` in identity.

**Steps:**
1. Run `grep -r "use crate::" services/signapps-identity/src/handlers/` and list which
   non-IAM handlers import from IAM modules (e.g., does `crm.rs` use `auth.rs` types?).
2. Run `grep -r "signapps_db::" services/signapps-identity/src/handlers/crm.rs` etc. to
   identify which DB repositories each target handler uses.
3. Document shared state fields: what fields in `AppState` do the non-IAM handlers use?
4. Output: a coupling matrix (handler × dependency) before touching code.

**Verification:** Manual review of coupling matrix by tech lead.
**Commit message:** None — analysis only.

---

### Phase 2: Extract CRM + Persons + Comms to `signapps-contacts`

**Goal:** Move the three contact management handlers with the lowest IAM coupling.

**Files touched:**
- `services/signapps-identity/src/handlers/crm.rs` — move to `signapps-contacts`
- `services/signapps-identity/src/handlers/persons.rs` — move to `signapps-contacts`
- `services/signapps-identity/src/handlers/comms.rs` — move to `signapps-contacts`
- `services/signapps-identity/src/handlers/mod.rs` — remove registrations
- `services/signapps-identity/src/main.rs` — remove route registrations
- `services/signapps-contacts/src/handlers/` — add moved files
- `services/signapps-contacts/src/main.rs` — add new routes
- `services/signapps-gateway/src/main.rs` — add gateway proxy rules for old paths

**Steps:**
1. Confirm `signapps-contacts` has an `AppState` that includes the DB pool.
2. Copy (not move yet) handler files into `signapps-contacts`.
3. Compile `signapps-contacts` with new handlers.
4. Add gateway redirect rules for old identity paths → contacts.
5. Remove from identity `main.rs` route table and `handlers/mod.rs`.
6. Delete original files from identity.
7. `cargo test -p signapps-identity -p signapps-contacts`.

**API contract:** Old paths remain accessible via gateway redirect during a deprecation
window of at least 2 sprints before removal.

**Verification:** `cargo check --workspace`; integration test calling old and new paths.
**Commit message:** `refactor(identity): extract CRM/persons/comms handlers to signapps-contacts`
**Rollback:** `git revert <sha>` — gateway redirect removed, identity route restored.

---

### Phase 3: Extract LMS + Supply Chain to `signapps-workforce`

Same pattern as Phase 2.

**Files touched:**
- `services/signapps-identity/src/handlers/lms.rs` → `signapps-workforce`
- `services/signapps-identity/src/handlers/supply_chain.rs` → `signapps-workforce`
- `services/signapps-gateway/src/main.rs` — redirect rules

**Verification:** `cargo check --workspace`; `cargo test -p signapps-workforce`
**Commit message:** `refactor(identity): extract LMS and supply chain to signapps-workforce`

---

### Phase 4: Extract Accounting to `signapps-billing`

**Dependencies:** Refactor 2 Phase 1 should have already created `signapps-accounting-fec`.

**Files touched:**
- `services/signapps-identity/src/handlers/accounting.rs` → `signapps-billing`
- `services/signapps-billing/Cargo.toml` — add `signapps-accounting-fec`

**Verification:** `cargo check --workspace`; `cargo test -p signapps-billing`
**Commit message:** `refactor(identity): extract accounting handler to signapps-billing`

---

### Phase 5: Create `signapps-vault` Service

**Note:** This is the highest-effort extraction — vault has its own encryption key
management, separate audit trail, and 7 repository types.

**Steps:**
1. Create `services/signapps-vault/` with `Cargo.toml`, `main.rs`, `handlers/vault.rs`.
2. Add `signapps-db-vault` as a dependency (from Refactor 1 Phase 4).
3. Move vault handler code from identity.
4. Verify master-password auto-unlock behavior is preserved (last commit touched this).
5. Add gateway route: `/api/v1/vault/*` → `signapps-vault:3023`.
6. Add legacy gateway redirect: `/api/v1/identity/vault/*` → `/api/v1/vault/*`.
7. Check `services/signapps-proxy/src/handlers/vault_browse.rs` — coordinate or merge.

**Verification:** `cargo check --workspace`; vault E2E test with token auth.
**Commit message:** `refactor(identity): extract vault to new signapps-vault service`

---

### Phase 6: Extract Sites + Resources to `signapps-it-assets`

**Files touched:**
- `services/signapps-identity/src/handlers/sites.rs` → `signapps-it-assets`
- `services/signapps-identity/src/handlers/resources.rs` → `signapps-it-assets`

**Verification:** `cargo check --workspace`
**Commit message:** `refactor(identity): move sites and resources handlers to signapps-it-assets`

---

### Phase 7: Create `signapps-integrations` Service

**Steps:**
1. Create `services/signapps-integrations/` with Slack bridge handler.
2. Move `signapps-common::bridge` (Slack/Teams, 323 lines) to this service (or
   `signapps-integrations-common` crate if shared).
3. Add `services/signapps-identity/src/handlers/slack.rs` as first handler.
4. Add gateway route: `/api/v1/integrations/*` → `signapps-integrations:3024`.

**Verification:** `cargo check --workspace`
**Commit message:** `refactor(identity): extract Slack bridge to new signapps-integrations service`

---

### Phase 8: Extract Backup to `signapps-storage`

**Files touched:**
- `services/signapps-identity/src/handlers/backup.rs` → `signapps-storage`

**Verification:** `cargo check --workspace`
**Commit message:** `refactor(identity): move backup management handler to signapps-storage`

---

## API Contract Preservation

Every extracted handler has a public REST API currently served at `/api/v1/identity/<domain>/*`.
These paths are used by the frontend client (`client/src/lib/api/`).

**Strategy:** The gateway (`signapps-gateway`) acts as the URL stability layer.

For each extracted domain, add a gateway proxy rule that forwards the old path to the new
service for a minimum deprecation window of 2 sprints (4 weeks):

```
# In signapps-gateway main.rs route table:
/api/v1/identity/crm/*        → signapps-contacts:PORT/api/v1/contacts/crm/$tail
/api/v1/identity/persons/*    → signapps-contacts:PORT/api/v1/contacts/persons/$tail
/api/v1/identity/lms/*        → signapps-workforce:PORT/api/v1/workforce/lms/$tail
/api/v1/identity/accounting/* → signapps-billing:PORT/api/v1/billing/accounting/$tail
/api/v1/identity/vault/*      → signapps-vault:PORT/api/v1/vault/$tail
/api/v1/identity/sites/*      → signapps-it-assets:PORT/api/v1/it-assets/sites/$tail
/api/v1/identity/slack/*      → signapps-integrations:PORT/api/v1/integrations/slack/$tail
```

After the deprecation window, update frontend `client/src/lib/api/` path constants and
remove gateway redirects.

---

## Risks

- **Hidden state coupling:** Non-IAM handlers may read from `AppState` fields that only
  exist in identity (e.g., JWT blacklist cache, MFA state). Phase 1 coupling audit is
  non-negotiable before any Phase 2+ work. *Severity: High*
- **Shared DB transaction boundaries:** An accounting handler might call `UserRepository`
  in the same transaction for user-linked accounting entries. After extraction, this
  becomes a cross-service call. Identify and document all cross-repository transactions
  in the coupling audit. *Severity: High*
- **Gateway availability dependency:** After extraction, the old identity paths depend on
  the gateway being up. If the gateway is down, old paths fail even if the new service is
  healthy. Consider whether critical paths (vault, auth) should have direct URLs in the
  client rather than gateway redirects. *Severity: Medium*
- **Vault encryption key continuity:** The vault master-password auto-unlock (committed
  recently) relies on identity's session context. Moving vault to its own service may
  break this. Must design a key-derivation handshake between identity and vault.
  *Severity: High — verify before Phase 5*
- **`vault_browse.rs` in `signapps-proxy`:** There is already a `vault_browse` handler
  in the proxy service. This creates a potential ownership conflict with the new vault
  service. Audit what `vault_browse.rs` does before creating the vault service.
  *Severity: Medium*
- **Test suite explosion:** Identity's current test suite covers all 51 handlers. After
  extraction, tests must move with their handlers. Incomplete test migration leaves
  coverage gaps. *Severity: Medium*
- **Frontend build breakage:** The client `src/lib/api/` files import from identity-specific
  paths. Without gateway redirects or an immediate client update, the frontend will break.
  Gateway redirects must be live before any handler is removed from identity.
  *Severity: High — always deploy gateway change first*

---

## Success Criteria

- [ ] `services/signapps-identity/src/handlers/` contains ≤ 35 files (only IAM-domain handlers)
- [ ] `services/signapps-identity/src/main.rs` ≤ 500 lines
- [ ] CRM, LMS, accounting, vault, sites, Slack, supply chain, backup are in their own services
- [ ] Old API paths return valid responses via gateway redirects
- [ ] `cargo nextest run` passes
- [ ] No cross-service DB transactions (each service touches only its own repositories)
- [ ] Security audit scope for identity covers only IAM code

---

## Out of Scope

- Splitting `signapps-db` (Refactor 1)
- Slimming `signapps-common` (Refactor 2)
- Merging empty services (Refactor 4)
- Redesigning the authentication protocol itself
- Moving the frontend client API paths (tracked separately, after gateway redirects are live)
