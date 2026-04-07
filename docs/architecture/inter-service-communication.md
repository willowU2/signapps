# Inter-Service Communication Strategy

> **Status:** Adopted 2026-04-07
> **Author:** signapps-platform team

## Decision

We use **PgEventBus** for all asynchronous inter-service events.
For synchronous reads, services query the shared database via `signapps-db`.
Direct HTTP calls between backend services are **forbidden**, with two
narrowly scoped exceptions: gateway → backend proxying, and outbound
webhooks to external (user-configured) URLs.

---

## Rationale

### Why not RabbitMQ / Kafka / NATS?

Every external broker adds an operational dependency that must be deployed,
monitored, patched, and backed up. SignApps runs natively (no Docker required
except for PostgreSQL in dev). Introducing a broker would double the mandatory
infra surface for async messaging while providing no meaningful advantage at
current scale — all 33 services already share a single PostgreSQL instance
that is already operated, monitored, and backed up.

### Why not pure HTTP between services?

Synchronous HTTP calls couple services by liveness: if the callee is slow or
restarting, the caller blocks or fails. There is no built-in replay,
guaranteed delivery, or audit trail. Adding retry/circuit-breaker logic
to every caller duplicates cross-cutting concerns in 33 services. The
existing instances of cross-service HTTP (workforce → scheduler) have already
surfaced exactly this problem: no circuit breaker, no retry policy, no service
discovery.

### Why PgEventBus?

PostgreSQL is the single source of truth for the platform. The `PgEventBus`
in `crates/signapps-common/src/pg_events.rs` provides:

- **Durability** — events are written to `platform.events` (a persistent
  outbox table, `migrations/138_event_bus.sql`) before the trigger fires
  `pg_notify`. If a consumer is down, it catches up from its cursor on
  restart.
- **At-least-once delivery** — each consumer tracks its position in
  `platform.event_consumers`. On startup, `PgEventBus::listen` replays all
  events since the last processed cursor, then switches to live `LISTEN` mode.
- **Transactional publishing** — `publish_in_tx` lets a service insert a
  business row and its outbox event in a single database transaction,
  eliminating the dual-write problem.
- **Zero new infrastructure** — the same PostgreSQL instance, the same
  connection pool, the same `sqlx` dependency already used by every service.
- **Simple operation** — no broker processes to restart, no topic partitions
  to balance, no dead-letter queues to drain.

---

## Current State (Audit 2026-04-07)

### Pattern 1 — Shared DB (25+ services)

All services depend on `signapps-db` for their own domain models. This is
intentional and correct for same-domain reads and writes. It becomes a problem
only when a service queries another service's tables directly to react to
state changes instead of subscribing to events — a pattern to watch for
during future reviews.

### Pattern 2 — PgEventBus (12 services, fully adopted)

The following services already publish or consume via `PgEventBus`:

| Service | Role |
|---------|------|
| `signapps-billing` | publishes + listens (`crm.deal.won` → draft invoice) |
| `signapps-calendar` | publishes + listens (`mail.received` → ICS import) |
| `signapps-chat` | publishes + listens |
| `signapps-contacts` | publishes |
| `signapps-forms` | publishes |
| `signapps-identity` | publishes (`compliance.dsar.approved`), webhook dispatcher |
| `signapps-mail` | publishes + listens |
| `signapps-notifications` | listens (fan-out to push/email) |
| `signapps-social` | publishes + listens |
| `signapps-storage` | publishes |
| `signapps-calendar` (tasks) | publishes per-task mutations |
| `signapps-calendar` (events) | publishes per-event mutations |

### Pattern 3 — Internal HTTP (non-conforming, must migrate)

| Caller | Callee | File | Notes |
|--------|--------|------|-------|
| `signapps-workforce` | `signapps-scheduler` | `services/signapps-workforce/src/handlers/validation/helpers.rs` | 3 direct GET calls to `{scheduler_base_url}/time-items`; no circuit breaker, no retry |
| `signapps-ai` | all services | `services/signapps-ai/src/tools/service_clients.rs` | `ServiceEndpoints` struct with 22 hardcoded localhost URLs; used by the AI tool-use agent to call other services on behalf of a user prompt |

### Pattern 4 — External webhooks / third-party HTTP (allowed, distinct from inter-service)

The following are **not** inter-service calls and remain allowed:

| Service | Target | Purpose |
|---------|--------|---------|
| `signapps-forms` | user-configured webhook URL | `dispatch_webhook()` in `main.rs` — delivers form submission to external systems |
| `signapps-it-assets` | PSA system webhook URL | `handlers/tickets.rs` — outbound PSA integration |
| `signapps-identity` | user-registered webhook URL | `webhook_dispatcher.rs` — delivers identity events to customer webhooks |
| `signapps-social` | platform APIs (Twitter, Slack, etc.) | `platforms/*.rs` — calls external social network APIs |
| `signapps-ai` | LLM providers, OCR/STT/TTS clouds | `llm/*.rs`, `workers/` — calls external AI APIs |
| `signapps-calendar` | CalDAV / push subscriptions | `services/push_service.rs` — CalDAV push to external clients |
| `signapps-gateway` | backend services | `main.rs` — the reverse-proxy role; see Pattern 3 below |

---

## Canonical Patterns

### Pattern A — Async event (PREFERRED for cross-service side-effects)

Use when: service A mutates state and service B must react (e.g., "mail
received → import ICS attachment to calendar").

```rust
// ── Publisher side (service A) ────────────────────────────────────────────

use signapps_common::pg_events::{NewEvent, PgEventBus};

// Always prefer publish_in_tx when there is an owning business transaction.
// This atomically writes the business row AND the outbox event.
let mut tx = pool.begin().await?;

// ... your business INSERT/UPDATE ...

event_bus
    .publish_in_tx(
        NewEvent {
            event_type: "mail.received".to_string(),
            aggregate_id: Some(mail_id),
            payload: serde_json::json!({
                "account_id": account_id,
                "has_ics": true,
            }),
        },
        &mut tx,
    )
    .await?;

tx.commit().await?;

// ── Consumer side (service B) ─────────────────────────────────────────────

// Spawn once at startup (see signapps-calendar/src/main.rs for reference).
tokio::spawn(async move {
    if let Err(e) = cal_bus
        .listen("calendar-consumer", move |event| {
            let pool = pool.clone();
            async move {
                match event.event_type.as_str() {
                    "mail.received" => {
                        // handle event …
                        Ok::<_, anyhow::Error>(())
                    }
                    _ => Ok(()),
                }
            }
        })
        .await
    {
        tracing::error!("calendar event consumer crashed: {e}");
    }
});
```

Key properties:
- Durable: the event survives a consumer restart (cursor-based catch-up).
- Transactional: `publish_in_tx` ensures no event is published for a
  rolled-back business operation.
- Self-filtering: consumers automatically skip events whose `source_service`
  matches their own service name.

### Pattern B — Synchronous read (same-domain data access)

Use when: service A needs the current state of an entity that lives in
service A's own domain or in a shared `signapps-db` model, and does not
need to trigger any cross-service side effect.

```rust
// Query directly via signapps-db — not via HTTP to another service's REST API.
use signapps_db::repositories::UserRepository;

let user = UserRepository::find_by_id(&pool, user_id)
    .await
    .map_err(|e| AppError::internal(format!("failed to fetch user: {e}")))?
    .ok_or_else(|| AppError::not_found("user not found"))?;
```

Do NOT make an HTTP call to `http://localhost:3001/api/v1/users/{id}` for
this. That would re-add authentication overhead, serialize/deserialize
unnecessarily, and couple services by liveness.

### Pattern C — Gateway → backend (only allowed synchronous HTTP pattern)

`signapps-gateway` is the single entry point for all client traffic. It
forwards requests from the frontend/mobile clients to the appropriate backend
service by path prefix. This is its sole purpose; it has no business logic.

```
Client → gateway (port 3099) → backend service (port 300X)
```

The gateway uses `reqwest` with a 60-second timeout and connection pooling.
This pattern is explicitly allowed and must not be replicated by backend
services calling each other.

---

## What Is Not Allowed

| Anti-pattern | Why forbidden |
|--------------|---------------|
| `reqwest::Client` calls from service A to service B's REST API | Tight liveness coupling, no replay, no audit, circuit-breaker debt |
| Subscribing to another service's database tables directly for change detection | Bypasses the event model, creates implicit cross-domain coupling |
| Shared mutable in-memory state across services | Services run as separate OS processes; in-memory state is not shared |
| Distributed locks via ad-hoc mechanisms | Use PostgreSQL row-level locks (`SELECT … FOR UPDATE`) when serialization is needed |
| Publishing events outside a transaction when a business write is involved | Use `publish_in_tx`; a standalone `publish` after `commit` risks losing the event on crash |

---

## Migration Plan for Non-Conforming Code

The following files require migration. They are listed in order of impact.

### 1. `signapps-workforce` → `signapps-scheduler` (HIGH — internal HTTP)

**Files:**
- `services/signapps-workforce/src/handlers/validation/helpers.rs` (3 call sites)
- `services/signapps-workforce/src/main.rs` (AppState carries `http_client` + `scheduler_base_url`)

**Problem:** Workforce validation helpers call `GET /time-items` on the
scheduler service to check for scheduling conflicts. There is no circuit
breaker or retry. If the scheduler is restarting, workforce validations fail
silently or return errors.

**Migration path:** The `time_items` table is owned by `signapps-db`
(model and repository already exist). The validation helpers should query
`TimeItemRepository` directly via the shared pool instead of calling the
scheduler over HTTP. The `http_client` and `scheduler_base_url` fields can
then be removed from `AppState`.

**Effort:** ~2 hours. No schema change needed.

### 2. `signapps-ai` tool-use service clients (MEDIUM — AI agent HTTP)

**Files:**
- `services/signapps-ai/src/tools/service_clients.rs` (22 service URLs)

**Problem:** The AI tool-use agent calls other services over HTTP to fulfill
user prompts (e.g., "create a calendar event"). This is a special case: the
AI acts as an autonomous agent and genuinely needs to call service APIs,
including sending authenticated requests with a user JWT.

**Migration path:** This is the one legitimate non-gateway use of inter-service
HTTP, because the AI needs to act as a user delegate. The calls must be
hardened before the next release:
- Add a `tower` middleware with exponential backoff retry (max 3 attempts,
  initial delay 100 ms).
- Add a per-call timeout (already present via `reqwest::Client` timeout, but
  verify per-endpoint timeouts are appropriate).
- Document `ServiceEndpoints` as an approved AI-agent-only pattern to prevent
  copy-paste into other services.

**Effort:** ~4 hours for retry middleware; ongoing enforcement via code review.

---

## Enforcement

1. **Code review** — any new `reqwest::Client` in a service that is not
   `signapps-gateway` or `signapps-ai` (tool-use only) or an external webhook
   dispatcher requires explicit justification in the PR description.

2. **Clippy custom lint (future)** — a workspace-level Clippy deny for
   `reqwest::Client::new()` in service crates (excluding the allowed ones)
   could automate detection. Not yet implemented.

3. **This document** — referenced from `CLAUDE.md` and must be updated
   whenever a new cross-service communication pattern is introduced or an
   existing one is migrated.

---

## Glossary

| Term | Definition |
|------|------------|
| **PgEventBus** | `signapps_common::pg_events::PgEventBus` — PostgreSQL-backed event bus with durable storage and cursor-based catch-up |
| **outbox table** | `platform.events` — the persistent event store; `platform.event_consumers` tracks each consumer's cursor |
| **publish_in_tx** | `PgEventBus::publish_in_tx` — publishes an event atomically within an existing SQLx transaction |
| **platform_events** | The PostgreSQL `NOTIFY` channel name used by the `platform.notify_event()` trigger |
| **EventBus** | `signapps_common::events::EventBus` — in-process broadcast bus; useful for intra-service fan-out within a single process, **not** for cross-service communication |
