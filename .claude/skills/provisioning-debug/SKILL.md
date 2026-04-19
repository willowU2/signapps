---
name: provisioning-debug
description: Use when cross-service provisioning fan-out fails (mailbox/drive/calendar/chat not created on user creation), when `org_provisioning_log` fills with `failed` or `pending` rows, when a consumer misses an event because its cursor drifted, when retry loops hammer a dead consumer, or when an admin asks why a user has no mailbox 5 s after creation. Covers the event topics, consumer registry and retry semantics.
---

# provisioning-debug

Use this skill when provisioning fan-out goes wrong after a user is created or archived.

## Architecture recap

Provisioning is event-driven (W5). When `signapps-org::handlers::persons::create` succeeds, it publishes `org.user.created` via `PgEventBus` with payload `{id, tenant_id, email, first_name, last_name}`. Archival publishes `org.user.deactivated` (plus a legacy `org.user.archived` alias).

Consumers live inside the target services and subscribe via `PgEventBus::subscribe(event_type, consumer_name, handler)` — the cursor is persisted per `(event_type, consumer_name)` in `platform.event_cursors`. Current consumer registry:

- `signapps-mail` subscribes to `org.user.created` → creates a mailbox row.
- `signapps-storage` subscribes to `org.user.created` → creates a drive root.
- `signapps-calendar` subscribes to `org.user.created` → creates a default personal calendar.
- `signapps-chat` subscribes to `org.user.deactivated` → soft-removes the user from all rooms.

Each consumer writes a row in `org_provisioning_log` with columns `event_id, consumer, status, error_detail, retries, created_at`. Statuses: `pending`, `running`, `succeeded`, `failed`. The W5 bodies in each consumer are **today stubs** that log and return `succeeded` — the real mailbox/drive/calendar creation is tracked as a follow-up. `signapps-org::handlers::provisioning` exposes `/api/v1/org/provisioning/pending` (non-succeeded rows) and `POST /:id/retry` which re-publishes the source event.

## Common issues

- **`org_provisioning_log` empty after user create** — the event was never published. Check `rtk grep "org.user.created" services/signapps-org/src/handlers/persons.rs` and that `OrgEventPublisher::user_created` is called on the happy path.
- **One consumer lagging** — its cursor in `platform.event_cursors` is behind. Either the consumer crashed and never restarted, or the handler is non-idempotent and refuses to re-apply the event. Grep `rtk grep -n "subscribe" services/signapps-mail services/signapps-storage services/signapps-calendar services/signapps-chat`.
- **Retries hammer a dead consumer** — `retries` column climbs without a fix. Current retry policy is "trigger manually via POST /:id/retry" — there is no automatic retry loop yet. If you see automatic retries, a hotfix consumer re-implemented the retry logic on its own: revert it, use the admin endpoint.
- **Orphan `running` rows** — the consumer died mid-handler. Bulk-requeue via `UPDATE org_provisioning_log SET status='pending' WHERE status='running' AND created_at < now() - interval '5 minutes'`. Restart the owning service.
- **User cannot open mailbox 5 s after create** — expected today; the W5 provisioning bodies log-only. Real mailbox creation is a follow-up.
- **`POST /:id/retry` returns 404** — the row ID passed is stale OR the log was already reaped. The admin UI should refresh after retry.

## Commands

```bash
# Show the event publishers
rtk grep -n "user_created\|user_deactivated" services/signapps-org/src

# Show all consumers currently subscribed
rtk grep -rn "subscribe(\"org\." services/

# Admin view of non-succeeded rows
docker exec signapps-postgres psql -U signapps -d signapps -c "SELECT id, consumer, status, retries, created_at, error_detail FROM org_provisioning_log WHERE status <> 'succeeded' ORDER BY created_at DESC LIMIT 30"

# Consumer cursor drift
docker exec signapps-postgres psql -U signapps -d signapps -c "SELECT consumer, event_type, cursor, updated_at FROM platform.event_cursors ORDER BY updated_at DESC LIMIT 20"

# Manually re-emit a user-created event for tenant X, user Y
# (prefer the admin API, but in a pinch):
docker exec signapps-postgres psql -U signapps -d signapps <<'SQL'
INSERT INTO platform.events (event_type, aggregate_id, payload)
VALUES ('org.user.created', '<person-uuid>', '{"id":"<person-uuid>","tenant_id":"<tenant-uuid>"}'::jsonb);
SQL

# Reset a consumer cursor to re-process (LOSSY — consumers must be idempotent)
docker exec signapps-postgres psql -U signapps -d signapps -c "UPDATE platform.event_cursors SET cursor = 0 WHERE consumer = 'signapps-mail' AND event_type = 'org.user.created'"
```

Service-log snippets to look for:

```
OrgEventPublisher: user_created event_id=... person_id=...
provisioning consumer=signapps-mail status=succeeded event_id=...
provisioning consumer=signapps-storage status=failed event_id=... err=...
```

## Related

- Spec: `docs/superpowers/specs/2026-04-18-s1-org-rbac-refonte-design.md`
- Plan: `docs/superpowers/plans/2026-04-18-s1-org-rbac-refonte.md` (Tasks 30-34 = W5)
- Product spec: `docs/product-specs/53-org-rbac-refonte.md`
- Code: `services/signapps-org/src/event_publisher.rs`, `services/signapps-org/src/handlers/{persons,provisioning}.rs`
- Migration: `409_org_provisioning_log.sql`
