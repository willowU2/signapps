# Refactor 2: Slim `signapps-common` from 46 Modules to ~14 Core Modules

> **Status:** Design — not yet executed
> **Estimated effort:** 2–3 days (human-supervised)
> **Risk level:** Medium
> **Author:** Architecture audit, 2026-04-07

---

## Why

`signapps-common` was created to hold shared infrastructure code (JWT auth, error types,
middleware). It has grown to 46 modules, 11 779 lines, and now includes a full FEC
accounting exporter, a marketplace / app-store engine, a DLP scanner, a UEBA anomaly
detector, a plugin registry, a reporting PDF engine, a GraphQL federation layer, and a
password vault implementation.

None of these belong in "common". Two concrete consequences:

1. **Every service that needs a JWT token transitively compiles FEC accounting, GraphQL
   federation, UEBA baselines, and marketplace listings.** The `signapps-collab` service
   (120 lines of main.rs, 1 WebSocket handler) carries 11 000 lines of shared code in its
   compile graph, most of which it never calls.

2. **Boundary confusion for new contributors.** "Is this the right place?" — the answer
   is always "no, but common is easy." The growth pattern is self-reinforcing. Without
   a hard trim, the crate will continue to absorb domain logic.

The target is a `signapps-common` of roughly 2 500 lines covering only the things that
are genuinely universal: auth tokens, error types, HTTP middleware, bootstrap helpers,
tenant context, and a handful of cross-cutting traits.

---

## Current State

### All 46 Modules in `crates/signapps-common/src/`

Source of truth: `crates/signapps-common/src/lib.rs` (read 2026-04-07).

| # | Module | Lines | Description |
|---|---|---|---|
| 1 | `accounting` | 380 | FEC (Fichier des Écritures Comptables) exporter |
| 2 | `alerts` | 269 | Custom alert rules + multi-channel dispatch |
| 3 | `approval` | 264 | Document approval workflow |
| 4 | `audit` | 360 | In-memory audit trail + middleware |
| 5 | `auth` | ~200 | JWT Claims, JwtConfig, TokenPair |
| 6 | `bootstrap` | 620 | Service startup helpers, graceful shutdown |
| 7 | `bridge` | 323 | Slack/Teams bridge adapter |
| 8 | `comments` | 439 | Inline comment threads with @mentions |
| 9 | `config` | 111 | AppConfig (env-based) |
| 10 | `config_reload` | ~80 | Hot-reload config watcher |
| 11 | `data_connectors` | 141 | Multi-source connector (PostgreSQL, CSV, JSON API) |
| 12 | `data_export` | 85 | Universal export to CSV/JSON/XLSX |
| 13 | `data_import` | 119 | Universal import from CSV/JSON/vCard/iCal |
| 14 | `dlp` | ~220 | Data Loss Prevention pattern scanner |
| 15 | `dry_run` | 78 | Dry-run execution mode helpers |
| 16 | `e2e_crypto` | ~180 | End-to-end encrypted channels (XOR stub) |
| 17 | `email_templates` | 105 | Template engine with `{{variable}}` substitution |
| 18 | `error` | 433 | RFC 7807 Problem Details, `AppError`, `Result` |
| 19 | `events` | 279 | Inter-service event bus (publish/subscribe) |
| 20 | `graphql_layer` | 58 | GraphQL federation config + playground |
| 21 | `healthz` | ~60 | Uptime helpers for health endpoints |
| 22 | `indexer` | ~100 | `AiIndexerClient` (HTTP client to AI service) |
| 23 | `marketplace` | ~200 | App Store listing + install/uninstall |
| 24 | `middleware` | 747 | Auth, logging, request-ID, Prometheus, CORS |
| 25 | `openapi` | 61 | Shared OpenAPI router helper |
| 26 | `pg_events` | 396 | PostgreSQL NOTIFY event bus |
| 27 | `pg_listener` | 49 | PostgreSQL LISTEN channel forwarder |
| 28 | `pii` | 111 | AES-256-GCM PII field encryption |
| 29 | `plugins` | 425 | Plugin manifest, registry, trait |
| 30 | `qrcode_gen` | 42 | SVG QR code generator |
| 31 | `rate_limit` | ~150 | Token-bucket rate limiter |
| 32 | `reporting` | 385 | PDF report engine + scheduling |
| 33 | `retention` | ~200 | GDPR retention policy engine |
| 34 | `search` | 272 | Search index + hit types (feature-gated) |
| 35 | `security_events` | 115 | Security event types and bus |
| 36 | `sql_dashboard` | 131 | SQL query builder + chart types |
| 37 | `sso` | 281 | SSO foundation (SAML2 + OIDC) |
| 38 | `tenant` | ~230 | TenantManager, multi-tenant schema isolation |
| 39 | `traits` | 139 | Crawler + Linkable cross-service traits |
| 40 | `triggers` | 125 | Event-driven trigger rule engine |
| 41 | `trust_level` | 145 | Trust level enum + comparison |
| 42 | `types` | 628 | Value objects: Email, Password, UserId, Username |
| 43 | `ueba` | 282 | UEBA anomaly detection + behavior baselines |
| 44 | `vault` | ~200 | In-memory password vault |
| 45 | `webhooks` | 331 | Webhook delivery + retry |
| 46 | `workflows` | 568 | AI workflow automation engine |

---

## Decision Matrix

### KEEP in `signapps-common` (~14 modules, ~2 500 lines)

These are genuinely universal — every service needs them or they are HTTP infrastructure.

| Module | Rationale |
|---|---|
| `auth` | JWT claims used by every protected service |
| `bootstrap` | Service startup boilerplate — one pattern for all |
| `config` | AppConfig + `env_or` helpers universally used |
| `error` | `AppError` (RFC 7807) — all handlers return this |
| `events` | Inter-service event bus — genuinely cross-cutting |
| `healthz` | Uptime metrics for health endpoints |
| `middleware` | Auth, logging, request-ID — every service uses all |
| `openapi` | Shared OpenAPI router helper — tiny (61 lines) |
| `pg_events` | PostgreSQL NOTIFY bus — used by several services |
| `pg_listener` | PostgreSQL LISTEN channel — tiny (49 lines) |
| `tenant` | Tenant context and isolation — every request carries this |
| `traits` | Crawler + Linkable traits — needed by db and services |
| `trust_level` | Trust level types — used by auth middleware |
| `types` | Value objects (Email, Password, UserId) — foundational |
| `rate_limit` | Token-bucket — used by middleware, tiny dep |
| `pii` | AES-256-GCM for PII fields — used by identity + calendar |
| `security_events` | Security event types — used by identity + audit |
| `email_templates` | Template engine for transactional mail — used by identity/mail |
| `indexer` | `AiIndexerClient` — used by collab and docs for AI indexing |
| `dry_run` | Dry-run helpers — small, used by data import/export |

### EXTRACT TO NEW CRATES

These are domain engines that happen to live in common. Each becomes its own workspace crate.

#### `signapps-workflows` (new crate)
- **Source:** `signapps-common/src/workflows.rs` (568 lines)
- **Consumers:** `signapps-ai`, `signapps-calendar`, `signapps-scheduler`
- **Rationale:** Full workflow automation engine with trigger evaluation, condition matching,
  and action execution — a product feature, not infrastructure.

#### `signapps-plugins` (new crate)
- **Source:** `signapps-common/src/plugins.rs` (425 lines)
- **Consumers:** `signapps-gateway`, `signapps-ai`
- **Rationale:** Plugin manifest system with registry — belongs next to the marketplace.

#### `signapps-marketplace` (new crate)
- **Source:** `signapps-common/src/marketplace.rs` (~200 lines)
- **Consumers:** `signapps-billing`, `signapps-identity`
- **Rationale:** App Store install/uninstall logic is billing/product infrastructure, not common.

#### `signapps-accounting-fec` (new crate)
- **Source:** `signapps-common/src/accounting.rs` (380 lines)
- **Consumers:** `signapps-billing`, `signapps-identity::handlers::accounting`
- **Rationale:** FEC export is a French tax compliance feature. Has zero business being
  in a crate called "common" used by a WebSocket collab service.

#### `signapps-e2e-crypto` (new crate)
- **Source:** `signapps-common/src/e2e_crypto.rs` (~180 lines)
- **Consumers:** `signapps-chat`, `signapps-docs`
- **Rationale:** Encryption channel management belongs with the messaging services.

#### `signapps-reporting` (new crate)
- **Source:** `signapps-common/src/reporting.rs` (385 lines)
- **Consumers:** `signapps-metrics`, `signapps-calendar`, `signapps-billing`
- **Rationale:** PDF report engine with scheduling — domain feature, not HTTP infrastructure.

### MOVE TO OWNING SERVICE

These modules belong to a specific service and should live there.

| Module | Move To | Rationale |
|---|---|---|
| `bridge` (Slack/Teams) | `signapps-identity` or new `signapps-integrations` | External messaging adapters are an integration concern |
| `sso` | `signapps-identity` | SSO is pure IAM — identity owns it already |
| `dlp` | `signapps-identity` or new `signapps-security` | DLP scanner is a security policy feature |
| `ueba` | `signapps-identity` or new `signapps-security` | Behavior analytics belongs with security policy |
| `marketplace` → already listed above | `signapps-marketplace` crate | — |
| `sql_dashboard` | `signapps-metrics` | SQL-to-chart is a metrics UI feature |
| `data_connectors` | `signapps-ai` or `signapps-office` | Multi-source connectors used for AI data ingestion |
| `data_import` + `data_export` | `signapps-office` | Universal import/export is a document processing feature |
| `graphql_layer` | `signapps-gateway` | GraphQL federation is an API gateway concern |
| `approval` | `signapps-docs` or `signapps-calendar` | Approval workflow is a document/calendar feature |
| `comments` | `signapps-docs` | Universal comments are a collaboration/docs feature |
| `alerts` | `signapps-metrics` or new `signapps-alerting` | Alert rules + multi-channel dispatch belongs with monitoring |
| `triggers` | `signapps-workflows` crate (above) | Triggers feed the workflow engine |
| `retention` | `signapps-identity` | GDPR retention policies are an IAM/compliance concern |
| `webhooks` | `signapps-identity` | Webhook delivery is an integration feature, already has a handler in identity |
| `audit` | `signapps-identity` | Audit trail is an IAM function |
| `search` | `signapps-ai` | Search index belongs with AI/embeddings |
| `qrcode_gen` | `signapps-identity` | Used for MFA QR codes only |
| `vault` | `signapps-identity` or new `signapps-vault` | Vault is a product feature (see Refactor 3) |
| `config_reload` | `signapps-gateway` | Hot-reload is a gateway/ops concern |
| `pg_events` / `pg_listener` | Keep in common | Still genuinely shared |

---

## Migration Plan

### Phase 1: Extract High-Value New Crates

**Goal:** Extract the largest non-common modules into standalone crates with no service
changes required yet. These extractions do not break any existing `use signapps_common::`.

**Target modules:** `workflows`, `accounting`, `reporting`, `plugins`, `marketplace`

**Steps for each:**
1. Create `crates/signapps-<name>/Cargo.toml` with exact same deps as current module needs.
2. Move `.rs` file to `crates/signapps-<name>/src/lib.rs`.
3. Add new crate to workspace `Cargo.toml` `[members]`.
4. In `signapps-common/src/lib.rs`: replace `pub mod <name>;` with
   `pub use signapps_<name>::*;` and add `signapps-<name>` to `signapps-common/Cargo.toml`.
5. `cargo check --workspace` — consumers see no path change.

**Files touched per extraction:**
- New crate directory + `Cargo.toml` + `src/lib.rs`
- `crates/signapps-common/Cargo.toml` (add dep)
- `crates/signapps-common/src/lib.rs` (replace mod with re-export)
- `Cargo.toml` (add workspace member)

**Verification:** `cargo check --workspace`
**Commit message:** `refactor(common): extract workflows, accounting, reporting, plugins, marketplace to own crates`
**Rollback:** `git revert <sha>` — re-exports maintain backward compat.

---

### Phase 2: Move Domain Modules to Owning Services

**Goal:** Remove modules from common that belong to a specific service. Each service gets
its own copy of the module.

**Batch A — Identity-owned modules:**
`sso`, `dlp`, `ueba`, `audit`, `retention`, `webhooks`, `vault`, `bridge`, `qrcode_gen`

**Steps for each module moving to `signapps-identity`:**
1. Copy `crates/signapps-common/src/<module>.rs` into
   `services/signapps-identity/src/<module>.rs`.
2. Update all `use signapps_common::<Module>` in identity handlers to
   `use crate::<module>::<Module>`.
3. Remove module from `signapps-common/src/lib.rs` and `Cargo.toml` deps (if exclusive).
4. Remove re-export from `signapps-common/src/lib.rs`.
5. `cargo test -p signapps-identity`.

**Note:** If any module (e.g., `vault`, `dlp`) is used by more than one service, keep it
in common until Refactor 3 (break identity) is complete and ownership is clear.

**Batch B — Other service modules:**
- `sql_dashboard` → `signapps-metrics/src/sql_dashboard.rs`
- `graphql_layer` → `signapps-gateway/src/graphql_layer.rs`
- `approval` + `comments` → `signapps-docs/src/`
- `alerts` → `signapps-metrics/src/alerts.rs`
- `data_import` + `data_export` + `data_connectors` → `signapps-office/src/`

**Verification:** `cargo check --workspace`; `cargo test` for affected services.
**Commit message:** `refactor(common): move domain modules to owning services`
**Rollback:** `git revert <sha>`.

---

### Phase 3: Extract `signapps-e2e-crypto` Crate

**Goal:** Separate the cryptography module (which has its own non-trivial deps) from common.

**Steps:**
1. Create `crates/signapps-e2e-crypto/` crate.
2. Move `e2e_crypto.rs`.
3. Update `signapps-chat` and `signapps-docs` deps.
4. Remove from `signapps-common`.

**Verification:** `cargo build -p signapps-chat -p signapps-docs`
**Commit message:** `refactor(common): extract signapps-e2e-crypto crate`
**Rollback:** `git revert <sha>`.

---

### Phase 4: Final Trim and Size Verification

**Goal:** Confirm `signapps-common` is at target (~14 modules, ~2 500 lines) and remove
any remaining module re-exports from Phase 1 that are no longer needed.

**Steps:**
1. Audit all `pub use` in `signapps-common/src/lib.rs` — remove anything pointing to an
   extracted crate if all consumers have been updated.
2. Run `cargo doc --no-deps -p signapps-common` and verify only the 14 core modules appear.
3. Check `signapps-common` compile time: `cargo build -p signapps-common --timings`.
4. Remove dead `[dependencies]` from `signapps-common/Cargo.toml`.

**Verification:** `cargo nextest run`; `wc -l crates/signapps-common/src/*.rs` shows < 3 000 total.
**Commit message:** `refactor(common): final trim — remove extracted module re-exports`
**Rollback:** `git revert <sha>`.

---

## Risks

- **Import path breakage:** Every service imports from `signapps_common`. The Phase 1
  re-export shim mitigates this, but Phase 2 (direct removal) will break any service not
  yet updated. Do batch-B moves in a single PR per service to keep scope contained.
  *Severity: Medium*
- **Hidden transitive users of domain modules:** `dlp` and `ueba` might be called from
  middleware inside common itself. Grep `use crate::dlp` and `use crate::ueba` inside
  `crates/signapps-common/src/` before removing. *Severity: Low*
- **Feature flags:** The `search` module is behind `#[cfg(feature = "search")]`. Moving it
  requires propagating the feature flag to the consumer crate. *Severity: Low*
- **`FecEntry` and `FecExporter` are re-exported at the crate root** (`pub use accounting::{FecEntry, FecExporter}`). Any consumer using the root re-export path will break
  unless the shim is maintained through Phase 4. *Severity: Medium — grep first*
- **`signapps-common/Cargo.toml` deps:** After removing domain modules, dependencies like
  `pdf` crates (for `reporting`), `totp-rs` (for potential vault), etc. must be removed.
  Removing a dep that is still indirectly needed (e.g., via macro expansion) can cause
  subtle failures. *Severity: Low — verify with `cargo build --no-default-features`*

---

## Success Criteria

- [ ] `crates/signapps-common/src/` has ≤ 20 `.rs` files
- [ ] `wc -l crates/signapps-common/src/*.rs | tail -1` shows total ≤ 3 000
- [ ] `cargo check --workspace` passes
- [ ] `cargo nextest run` passes
- [ ] Compile time of `signapps-collab` drops measurably (target: -30% wall time)
- [ ] `cargo doc --no-deps -p signapps-common` documents only infrastructure concerns

---

## Out of Scope

- Changing the public API of any module (no signature changes, only moves)
- Splitting `signapps-db` (Refactor 1)
- Breaking `signapps-identity` apart (Refactor 3)
- Adding new features to extracted crates
