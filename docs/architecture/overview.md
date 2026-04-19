# SignApps Platform — Architecture Overview (2026-04-18)

Last updated after the S1 + S2 + S3 tracks landed on `main`.

## Single-binary runtime

34 services + 7 shared crates live inside a single binary `signapps-platform`.
Ports 3001–3099 are multiplexed through a Tokio supervisor. **Boot time
budget: < 5 seconds** on a developer box (PostgreSQL local, single
tokio-multi-thread runtime).

See `docs/architecture/single-binary.md` for the supervisor pattern and
shutdown story.

## Layers

- **Shared crates** (`crates/*`): `signapps-common`, `signapps-db`,
  `signapps-cache`, `signapps-keystore`, `signapps-oauth`, `signapps-runtime`,
  `signapps-service`. Plus domain crates (`signapps-ad-core`,
  `signapps-filters`, `signapps-sharing`, `signapps-triggers`, etc.).
- **Services** (`services/*`): 33 HTTP microservices + 1 gateway
  (`signapps-gateway`). Ports are mapped in the project `CLAUDE.md`.
- **Shared state**: `SharedState { pool, jwt, keystore, cache, eventbus,
  resolver }` is constructed once by
  `signapps-service::shared_state::SharedState::init_once()`, then each
  service borrows an `Arc<SharedState>` instead of opening its own pool
  or keystore.

## RBAC (S1)

- `OrgPermissionResolver` trait in `signapps-common::rbac` (feature
  `rbac`) is the single contract for permission checks.
- `OrgClient` is the production impl. It hits `signapps-org` and caches
  results in a moka 60s TTL store.
- Each service wires an Axum middleware `rbac::require(action,
  resource_extractor)` that pulls the resolver from `AppState`.

## Org + AD + Provisioning (S1)

- Canonical model: `org_nodes` (LTREE), `org_persons`, `org_assignments`
  (3 axes), `org_policies`, `org_boards`, `org_access_grants`,
  `org_ad_config`, `org_ad_sync_log`, `org_provisioning_log`.
  Tables live in the `public.*` schema (see
  `docs/architecture/database-schemas.md`).
- AD sync is bidirectional via `ldap3`, with secrets stored in the
  keystore.
- Events flow through `PgEventBus`: `org.user.*`, `org.grant.*`,
  `org.assignment.*`, `org.policy.*`.
- Provisioning consumers live in `mail`, `storage`, `calendar`, `chat`
  and react to `org.user.created`/`org.user.deactivated` to create or
  suspend the user's resources.

## PXE + DHCP (S2)

- Unprivileged ports by default: TFTP on `:6969`, ProxyDHCP on `:4011`
  (set via `PXE_MODE=user`). Privileged mode re-enables `:69` and `:67`.
- Auto-discovery via simulated DHCPDISCOVER (HTTP API for tests).
- SSE stream `GET /api/v1/pxe/deployments/:mac/stream` powered by
  PostgreSQL `LISTEN/NOTIFY` channels.
- 5-step frontend wizard in `client/src/app/pxe/wizard/page.tsx`.

## Seed demo — Acme Corp (S2)

- `services/signapps-seed`: bin + lib crate.
- 267 rows across 15 services (org, identity, calendar, mail, chat,
  docs, drive, forms, contacts, meet, tasks, it-assets, vault, pxe).
- Deterministic UUIDs (v5 namespace). Idempotent reseed. Safe gate
  refuses non-localhost databases unless `SEED_ALLOW_PROD=1`.

## Cross-service integration (S3)

- `services/signapps-integration-tests` — a dedicated crate with
  `#[ignore]` scenarios that spawn the real binary and hit real ports:
  - `provisioning_flow` — create person → mailbox provisioned within 3s.
  - `grants_redirect` — HMAC grant → /g/:token redirect.
  - `rbac_enforcement` — marie.dupont → /admin/users = 403.
  - `ad_sync_dryrun` — dry-run never 5xxs.
  - `pxe_enrollment` — simulate-dhcp → discovered → enroll.
- Playwright E2E lives in `client/e2e/`. `just e2e` chains
  `just db-seed-reset` + `npx playwright test --reporter=list`.

## Observability

- `tracing` is the single logging surface — `println!`, `eprintln!`,
  `dbg!` are forbidden in production code.
- Each public handler is `#[instrument(skip(...))]`.
- Prometheus metrics are exposed at `/metrics` on `signapps-metrics`
  (port 3008).

## Roadmap (post-S3)

Possible next tracks (non-binding):
- Performance profiling + upsell heavy allocation sites.
- Mobile app (React Native over the existing REST API).
- Public API v2 (GraphQL gateway fronted by `signapps-graphql-layer`).
- External security audit.
