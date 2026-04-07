# Refactor 4: Merge Near-Empty Services — 28 Services → ~18

> **Status:** Design — not yet executed
> **Estimated effort:** 2–3 days (human-supervised)
> **Risk level:** Medium
> **Author:** Architecture audit, 2026-04-07

---

## Why

The platform has 28 services. Several were created as stubs with the intent to grow, but
have not. Maintaining 28 separate services means 28 separate build targets, 28 separate
`AppState` definitions, 28 startup binaries, 28 health-check endpoints, and 28 port
assignments to keep synchronized in the gateway, client configuration, and deployment
scripts.

The overhead is not just compilation cost — it is cognitive: a developer looking at
`signapps-collab` (120 lines of `main.rs`, one WebSocket handler) and `signapps-docs`
(194 lines, rich document editing) cannot understand why these are separate binaries
without a domain explanation that does not exist in code.

The goal is to consolidate services by domain affinity — not arbitrarily, but where the
handlers already belong together semantically and share no distinct deployment constraints.

---

## Current State

### Service Inventory by `main.rs` Size

Full list (measured 2026-04-07):

| Service | Port | `main.rs` Lines | Handler Count | Assessment |
|---|---|---|---|---|
| `signapps-it-assets` | 3022 | 73 | 14+ handlers in `handlers/` | Small main.rs but rich handler tree — **keep separate** |
| `signapps-collab` | 3013 | 120 | 2 handlers (health, websocket) | Stub — merge into docs |
| `signapps-remote` | 3017 | 120 | 5 handlers (connections CRUD, ws) | Stub — merge into realtime |
| `signapps-agent` | — | 147 | Unknown | Sidecar agent — assess separately |
| `signapps-chat` | 3020 | 169 | 12 handlers (channels, messages, dms, presence, search…) | Small but distinct — borderline |
| `signapps-office` | 3018 | 179 | 12 handlers (convert, import, pdf, spreadsheet, pptx…) | Stateless converter — **keep** |
| `signapps-pxe` | 3016 | 189 | 8 handlers + catalog + images + tftp + dhcp | Infrastructure — merge with dc |
| `signapps-docs` | 3010 | 194 | 12 handlers (notes, templates, collab ws, types…) | Rich — keep but absorb collab |
| `signapps-meet` | 3014 | 204 | 9 handlers (rooms, tokens, recordings, voicemail…) | Medium — merge with remote |
| `signapps-dc` | — | 207 | 0 REST handlers (LDAP+Kerberos+NTP listeners) | Protocol server — merge with infra |
| `signapps-metrics` | 3008 | 215 | — | Keep — dedicated monitoring |
| `signapps-billing` | 8096 | 248 | — | Keep — financial isolation |

**Services with 300+ lines (keep as-is):**
`signapps-media` (312), `signapps-proxy` (339), `signapps-containers` (355),
`signapps-social` (380), `signapps-securelink` (398), `signapps-calendar` (407),
`signapps-ai` (491), `signapps-workforce` (507), `signapps-scheduler` (536),
`signapps-notifications` (550), `signapps-storage` (562), `signapps-gateway` (729),
`signapps-mail` (753), `signapps-forms` (795), `signapps-identity` (813),
`signapps-contacts` (844)

### Services Identified for Merger

#### Candidate Group 1: Documents Cluster
- `signapps-collab` (120 lines) — CRDT WebSocket collaborative editing
- `signapps-docs` (194 lines) — Rich document types (notes, sheets, slides, boards)

**Relationship:** `signapps-collab` is literally the real-time collaboration layer for
`signapps-docs`. The collab WebSocket endpoint serves `yrs` (Y.js CRDT) documents, and
the docs service manages those documents at rest. There is no architectural reason for
these to be separate binaries. The collab service even uses `AiIndexerClient` to index
doc content — a concern that belongs in the docs service.

**Proposed merged service:** `signapps-docs` absorbs `signapps-collab`.

---

#### Candidate Group 2: Real-Time Communications Cluster
- `signapps-meet` (204 lines) — Video conferencing, rooms, recordings, LiveKit
- `signapps-remote` (120 lines) — Remote desktop connections + WebSocket gateway

**Relationship:** Both services deal with real-time AV/device streams over WebSocket.
Both are relatively small. The primary distinction is protocol (WebRTC via LiveKit for
meet, vs. custom remote desktop protocol for remote), but they share the operational
pattern of "manage a persistent real-time connection session."

**Proposed merged service:** New `signapps-realtime` (or keep `signapps-meet` name) that
owns both room-based conferencing and remote desktop connections.

---

#### Candidate Group 3: Infrastructure / AD Cluster
- `signapps-dc` (207 lines) — Domain Controller: LDAP, Kerberos, NTP, AD sync
- `signapps-pxe` (189 lines) — PXE boot: TFTP server, ProxyDHCP, image catalog

**Relationship:** Both are infrastructure services in the "network boot and domain" space.
`signapps-dc` is also tightly coupled to AD sync (`signapps-ad-core`) and the
infrastructure domain models. `signapps-pxe` already uses `DeployProfile` models from
`signapps-db::infrastructure`. These are IT-infrastructure-layer services with no
business logic.

**Note on `signapps-dc`:** This service is unusual — it spawns protocol listeners
(LDAP :389, LDAPS :636, KDC :88, kpasswd :464, NTP :10123) on a shared tokio runtime.
It has zero REST handlers and a separate health port. Merging requires careful tokio
runtime design.

**Proposed merged service:** New `signapps-infrastructure` that owns DC protocol
listeners, AD sync workers, and PXE/TFTP/DHCP.

---

#### Candidate Group 4: Chat (borderline — assess)
- `signapps-chat` (169 lines) — 12 handlers covering channels, DMs, presence, search,
  reactions, pins, read status

**Assessment:** Despite the small `main.rs`, chat has 12 substantive handler files and
covers a distinct product surface. Chat should stay separate. The 169-line `main.rs` is
just well-organized, not a stub.

**Decision: KEEP `signapps-chat` separate.**

---

## Target State

### After Mergers

| New Service | Absorbs | Port | Rationale |
|---|---|---|---|
| `signapps-docs` (enriched) | `signapps-collab` | 3010 | Docs + collab are one product |
| `signapps-realtime` | `signapps-meet` + `signapps-remote` | 3014 | Real-time streams cluster |
| `signapps-infrastructure` | `signapps-dc` + `signapps-pxe` | 3016 | Network infra cluster |

**Services count:** 28 → 25 (3 mergers reduce count by 3 binaries).

Note: This is a conservative target. Refactor 3 (break identity) will create 3–4 new
services (`signapps-vault`, `signapps-integrations`, potentially `signapps-facilities`),
keeping the total around 25–27 rather than growing toward 35+.

---

## Migration Plan

### Phase 1: Merge `signapps-collab` into `signapps-docs`

**Goal:** Move the single WebSocket CRDT handler from `signapps-collab` into `signapps-docs`.

**Files touched:**
- `services/signapps-collab/src/handlers/websocket.rs` → `services/signapps-docs/src/handlers/websocket_crdt.rs`
- `services/signapps-collab/src/handlers/health.rs` — discard (docs has its own)
- `services/signapps-collab/src/models/` — move broadcast message models into docs
- `services/signapps-collab/src/utils/` — merge into docs
- `services/signapps-docs/src/main.rs` — add WebSocket route `/api/v1/collab/ws/:doc_id`
- `services/signapps-docs/Cargo.toml` — add `yrs`, `dashmap`, `tokio::sync::broadcast`
  (already present in collab's Cargo.toml)
- `services/signapps-gateway/src/main.rs` — remap `/api/v1/collab/*` → docs service

**AppState changes in `signapps-docs`:**
Add fields that `signapps-collab::AppState` had:
```rust
pub docs: Arc<dashmap::DashMap<String, yrs::Doc>>,
pub channels: Arc<dashmap::DashMap<String, broadcast::Sender<BroadcastMessage>>>,
pub indexer: AiIndexerClient,
```

**Steps:**
1. Copy WebSocket handler and models to `signapps-docs`.
2. Extend `signapps-docs::AppState` with the collab fields.
3. Register `/api/v1/collab/ws/:doc_id` in `signapps-docs/src/main.rs`.
4. Update gateway to proxy `/api/v1/collab/*` → docs service port 3010.
5. `cargo build -p signapps-docs` — verify compiles.
6. Remove `services/signapps-collab/` directory.
7. Remove `signapps-collab` from workspace `Cargo.toml`.
8. Remove `signapps-collab` from gateway upstream table and `scripts/start-all`.

**Port:** The WebSocket endpoint moves from port 3013 to port 3010. Update frontend
constants in `client/src/lib/api/` that reference the collab WebSocket URL.

**Backward compat:** Gateway forwards port-3013 requests to port-3010 for one sprint.
After that, port 3013 is freed.

**Verification:** `cargo check --workspace`; WebSocket connect to new endpoint; `cargo test -p signapps-docs`
**Commit message:** `refactor(services): merge signapps-collab into signapps-docs`
**Rollback:** `git revert <sha>`.

---

### Phase 2: Merge `signapps-remote` into `signapps-meet` → `signapps-realtime`

**Goal:** Create `signapps-realtime` that serves both video conferencing and remote desktop.

**Decision: rename or create new?**
- If the gateway already routes `/api/v1/meet/*` and `/api/v1/remote/*` to separate
  services, the safest approach is: keep `signapps-meet` as the host, rename its package
  to `signapps-realtime`, and absorb `signapps-remote`'s handlers.
- This avoids a port change for meet (port 3014 stays).

**Files touched:**
- `services/signapps-remote/src/handlers.rs` → `services/signapps-meet/src/handlers/remote.rs`
- `services/signapps-remote/src/models/` → `services/signapps-meet/src/models/remote.rs`
- `services/signapps-meet/src/main.rs` — add remote routes `/api/v1/remote/*`
- `services/signapps-meet/Cargo.toml` — rename package to `signapps-realtime`
- `services/signapps-gateway/src/main.rs` — remap `/api/v1/remote/*` → meet/realtime service port 3014

**AppState changes in `signapps-meet`:**
`signapps-remote::AppState` is just `db: DatabasePool` + `jwt_config: JwtConfig` — already
present in meet's AppState. No new fields needed.

**Steps:**
1. Copy remote connection handlers into `signapps-meet/src/handlers/remote.rs`.
2. Register remote routes in `signapps-meet/src/main.rs`.
3. `cargo build -p signapps-meet`.
4. Update gateway to proxy `/api/v1/remote/*` → port 3014.
5. Remove `services/signapps-remote/` directory.
6. Remove `signapps-remote` from workspace `Cargo.toml`.
7. Rename `signapps-meet` package name to `signapps-realtime` in `Cargo.toml` (optional,
   low priority — can stay as `signapps-meet`).

**Verification:** `cargo check --workspace`; `cargo test -p signapps-meet`
**Commit message:** `refactor(services): merge signapps-remote into signapps-meet (realtime cluster)`
**Rollback:** `git revert <sha>`.

---

### Phase 3: Create `signapps-infrastructure` from `signapps-dc` + `signapps-pxe`

**Goal:** One service manages all network-boot and domain-controller infrastructure.

**Complexity warning:** This is the hardest merger. `signapps-dc` spawns protocol listeners
(LDAP, Kerberos, NTP) that bind system ports and have their own shutdown sequences.
`signapps-pxe` spawns TFTP and ProxyDHCP workers. Neither uses Axum for its primary
purpose — they both bolt on an Axum health server separately. The merged service must:
- Maintain all five protocol listener spawns (LDAP, LDAPS, KDC, kpasswd, NTP from dc)
- Maintain TFTP and ProxyDHCP spawns (from pxe)
- Serve the PXE REST API on a single HTTP port
- Serve a shared health endpoint

**Design for merged `main.rs`:**
```rust
// Spawn protocol listeners (DC)
tokio::spawn(ldap_listener.run(...));
tokio::spawn(kdc_listener.run(...));
tokio::spawn(ntp_server(...));
tokio::spawn(ad_sync_worker(...));
tokio::spawn(reconciliation_cron(...));

// Spawn PXE listeners
tokio::spawn(tftp::start_tftp_server(...));
tokio::spawn(dhcp_proxy::start_proxy_dhcp(...));

// Single Axum HTTP server for REST API (PXE routes) + health
axum::serve(app).await
```

**Port assignment:** Keep PXE's port 3016 as the HTTP API port. DC's health port becomes
a sub-path on the same server (`/dc/health`).

**Files touched:**
- New `services/signapps-infrastructure/` directory
- Copy `services/signapps-dc/src/` into `signapps-infrastructure/src/dc/`
- Copy `services/signapps-pxe/src/` into `signapps-infrastructure/src/pxe/`
- New `services/signapps-infrastructure/src/main.rs` — combined startup
- `services/signapps-gateway/src/main.rs` — no routing change (PXE API stays on 3016)
- Remove `services/signapps-dc/` and `services/signapps-pxe/` directories
- `Cargo.toml` workspace — replace both with `signapps-infrastructure`

**Cargo.toml dependencies:** Union of both services:
- From dc: `signapps-ldap-server`, `signapps-kerberos-kdc`, `signapps-dns-server`,
  `signapps-ad-core`, `sqlx`
- From pxe: `tokio-tftp` (or custom tftp module), `tower-http::ServeDir`

**Steps:**
1. Create `services/signapps-infrastructure/Cargo.toml` with union deps.
2. Create combined `main.rs` following the design above.
3. Copy all module files (catalog, dhcp_proxy, handlers, images, tftp from pxe;
   config, health from dc).
4. Compile and fix naming conflicts.
5. Test protocol listeners start (LDAP, Kerberos, NTP, TFTP, ProxyDHCP).
6. Remove old services.
7. Update workspace.

**Verification:** `cargo build -p signapps-infrastructure`; verify all listeners bind;
PXE API responds on 3016; health endpoint responds.
**Commit message:** `refactor(services): merge signapps-dc + signapps-pxe into signapps-infrastructure`
**Rollback:** `git revert <sha>`.

---

## Backward Compatibility Strategy

### Option A: Gateway Redirects (recommended)
The gateway (`signapps-gateway`) maintains routing for old service ports. For merged
services:
- Port 3013 (old collab) → gateway forwards to port 3010 (docs)
- Port 3017 (old remote) → gateway forwards to port 3014 (meet/realtime)
- Port 3016 stays as-is (pxe/infra HTTP)

**Duration:** Maintain redirects for 2 sprints (4 weeks), then remove.

### Option B: Clean Break (aggressive)
Remove old ports immediately after merge. Requires updating all frontend constants and any
direct service-to-service calls that bypass the gateway.

**Recommendation:** Use Option A for Phase 1–2 (collab, remote) since the frontend
actively uses these ports. Use Option B for Phase 3 (infra) since `signapps-dc` has no
REST API — only a health port — and `signapps-pxe` can simply keep its port.

---

## Per-Phase Checklist

### Before each phase:
- [ ] `cargo check --workspace` passes on main branch
- [ ] Identify all direct (non-gateway) references to the service being removed
  (`grep -r "localhost:30XX"` in client source)
- [ ] Identify any scripts in `scripts/` that start the service

### During each phase:
- [ ] Build target service with new handlers
- [ ] Add gateway routing for old paths
- [ ] Remove old service directory
- [ ] Remove from workspace `Cargo.toml`
- [ ] Remove from `scripts/start-all`

### After each phase:
- [ ] `cargo build --workspace` passes
- [ ] `cargo nextest run` passes
- [ ] `rtk git status` — verify no stray files
- [ ] Health check: `curl http://localhost:3010/health` (docs absorbing collab)

---

## Env Var Changes

Each merged service will have environment variables from both source services. The merged
service must accept all of them:

| Source | Env Var | Target |
|---|---|---|
| `signapps-collab` | `SERVER_PORT=3013` | Dropped — docs uses 3010 |
| `signapps-remote` | `SERVER_PORT=3017` | Dropped — realtime uses 3014 |
| `signapps-dc` | `DC_LDAP_PORT`, `DC_KDC_PORT`, `DC_NTP_PORT`, `DC_HEALTH_PORT` | Carried into infra |
| `signapps-pxe` | `SERVER_PORT=3016` | Infra uses 3016 |

Update `.env.example` and deployment docs after each phase.

---

## Risks

- **Protocol listener port conflicts:** `signapps-infrastructure` runs LDAP on :389, NTP
  on :10123, and HTTP on :3016 in the same process. If any listener fails to bind (e.g.,
  LDAP requires root), the HTTP API also fails. Implement independent task panic handling:
  a listener crash should log an error but not kill the entire process. *Severity: High*
- **`signapps-dc` is NOT an Axum service:** It has no Axum routes except a separate health
  server on a different port. The merged service needs to decide: one HTTP server on 3016
  with DC health on `/dc/health`, or two Axum servers on different ports. *Severity: Medium*
- **Frontend WebSocket URL hardcoding:** If `client/src/` hardcodes
  `ws://localhost:3013/api/v1/collab/ws/` rather than going through the gateway, moving
  collab to port 3010 breaks the client immediately. Grep `3013` in client source before
  Phase 1. *Severity: High — verify first*
- **LiveKit integration in meet:** The LiveKit client in `signapps-meet` uses
  `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET`. These env vars are already in the service;
  they just need to be present in `signapps-realtime`'s `.env`. *Severity: Low*
- **`signapps-agent` (147 lines):** This service was not included in the merger plan
  because its role is unclear (agent sidecar for IT assets?). Investigate before deciding.
  *Severity: Unknown*

---

## Success Criteria

- [ ] Service count decreases from 28 to 25 (three mergers complete)
- [ ] `cargo build --workspace` passes
- [ ] `cargo nextest run` passes
- [ ] All three merged services have a single health endpoint responding `200 OK`
- [ ] Gateway correctly routes all old and new paths
- [ ] `scripts/start-all` starts 25 services (not 28)
- [ ] No port conflicts in merged services
- [ ] Frontend client (port 3000) functions correctly after collab port migration

---

## Out of Scope

- Merging `signapps-chat` with any other service (borderline case — keep separate)
- Merging any of the 300+ line services (they have earned their independence)
- Splitting services (Refactors 1–3 handle that direction)
- The `signapps-agent` sidecar (needs separate architectural decision)
- Creating new services for identity extractions (Refactor 3)
