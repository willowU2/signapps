# Event Bus & Inter-Service Integration Design

**Date:** 2026-03-29
**Status:** Approved
**Scope:** Event bus infrastructure + 4 vagues d'intégrations cross-service

---

## 1. Problem Statement

SignApps Platform has 20+ microservices sharing a single PostgreSQL database, but only 4 real backend-to-backend connections exist (identity→mail, calendar→AI, storage→office, AI→9 services). The remaining ~25 frontend interop components use localStorage stubs — data is lost on reload and never reaches other services.

Users expect a cohesive suite where actions in one module automatically reflect in others: winning a CRM deal creates an invoice, receiving an email with an ICS attachment adds a calendar event, completing a task triggers a notification.

## 2. Architecture: PostgreSQL Outbox + LISTEN/NOTIFY

### 2.1 Why This Pattern

- **Zero external dependencies** — PostgreSQL is already the only data store
- **Transactional guarantees** — events are INSERTed in the same transaction as the business operation (no dual-write problem)
- **Persistence** — events survive service restarts; missed NOTIFY messages are caught by polling `WHERE processed_at IS NULL`
- **Low latency** — LISTEN/NOTIFY delivers <100ms to connected listeners
- **Simple operations** — no Redis/NATS/Kafka to deploy, monitor, or upgrade

### 2.2 Event Table

```sql
CREATE TABLE platform.events (
    id UUID PRIMARY KEY DEFAULT gen_uuid_v7(),
    event_type VARCHAR(100) NOT NULL,      -- 'mail.received', 'deal.won', 'task.completed'
    source_service VARCHAR(50) NOT NULL,    -- 'signapps-mail', 'signapps-billing'
    entity_type VARCHAR(50) NOT NULL,       -- 'email', 'deal', 'invoice', 'task'
    entity_id UUID NOT NULL,               -- ID of the affected entity
    tenant_id UUID,                        -- multi-tenant isolation
    actor_id UUID,                         -- user who triggered the event (NULL for system events)
    payload JSONB NOT NULL DEFAULT '{}',   -- event-specific data
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ              -- NULL = not yet processed by all consumers
);

CREATE INDEX idx_events_unprocessed ON platform.events (created_at)
    WHERE processed_at IS NULL;
CREATE INDEX idx_events_type ON platform.events (event_type, created_at);
CREATE INDEX idx_events_entity ON platform.events (entity_type, entity_id);
```

### 2.3 NOTIFY Trigger

```sql
CREATE OR REPLACE FUNCTION platform.notify_event() RETURNS trigger AS $$
BEGIN
    PERFORM pg_notify('platform_events', json_build_object(
        'id', NEW.id,
        'event_type', NEW.event_type,
        'source_service', NEW.source_service,
        'entity_type', NEW.entity_type,
        'entity_id', NEW.entity_id,
        'tenant_id', NEW.tenant_id
    )::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notify_event
    AFTER INSERT ON platform.events
    FOR EACH ROW EXECUTE FUNCTION platform.notify_event();
```

### 2.4 Consumer Tracking

Each service tracks which events it has processed:

```sql
CREATE TABLE platform.event_consumers (
    consumer VARCHAR(50) NOT NULL,         -- 'signapps-notifications', 'signapps-billing'
    last_event_id UUID NOT NULL,           -- last successfully processed event ID
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (consumer)
);
```

On startup, each service reads its `last_event_id`, queries `SELECT * FROM platform.events WHERE id > $1 ORDER BY id`, and processes missed events before switching to LISTEN mode.

### 2.5 Event Listener Crate (signapps-common)

Add to `crates/signapps-common/src/events.rs`:

```rust
pub struct EventBus {
    pool: PgPool,
    consumer_name: String,
}

impl EventBus {
    pub async fn new(pool: PgPool, consumer_name: &str) -> Self;
    pub async fn publish(&self, event: NewEvent) -> Result<Uuid>;
    pub async fn listen(&self, handler: impl Fn(Event) -> BoxFuture<()>) -> Result<()>;
    // listen() does: 1) catch up from last_event_id, 2) LISTEN platform_events, 3) dispatch
}

pub struct NewEvent {
    pub event_type: String,
    pub entity_type: String,
    pub entity_id: Uuid,
    pub tenant_id: Option<Uuid>,
    pub actor_id: Option<Uuid>,
    pub payload: serde_json::Value,
}
```

Every service calls `EventBus::new(pool, "signapps-xxx")` at startup and registers handlers for event types it cares about.

### 2.6 Publishing Pattern (In Service Code)

```rust
// In a handler that creates an invoice after a deal is won:
let invoice = create_invoice(&pool, &data).await?;
event_bus.publish(NewEvent {
    event_type: "invoice.created".into(),
    entity_type: "invoice".into(),
    entity_id: invoice.id,
    tenant_id: claims.tenant_id,
    actor_id: Some(claims.sub),
    payload: json!({ "amount_cents": invoice.amount_cents, "deal_id": deal_id }),
}).await?;
```

## 3. Event Type Registry

### 3.1 Naming Convention

`{service_domain}.{entity}.{action}` — all lowercase, dot-separated.

### 3.2 Full Event Catalog

#### Mail Events
| Event Type | Payload | Emitted by |
|---|---|---|
| `mail.received` | `{ email_id, from, to, subject, has_ics_attachment }` | signapps-mail |
| `mail.sent` | `{ email_id, to, subject }` | signapps-mail |

#### Calendar Events
| Event Type | Payload | Emitted by |
|---|---|---|
| `calendar.event.created` | `{ event_id, title, start, end, attendees }` | signapps-calendar |
| `calendar.event.reminder` | `{ event_id, title, minutes_before, attendees }` | signapps-scheduler |
| `calendar.task.completed` | `{ task_id, title, assignee_id }` | signapps-calendar |
| `calendar.task.overdue` | `{ task_id, title, due_date, assignee_id }` | signapps-scheduler |

#### CRM/Contacts Events
| Event Type | Payload | Emitted by |
|---|---|---|
| `crm.deal.won` | `{ deal_id, title, amount, contact_id }` | signapps-contacts (CRM) |
| `crm.deal.lost` | `{ deal_id, title, reason }` | signapps-contacts (CRM) |
| `crm.deal.stage_changed` | `{ deal_id, from_stage, to_stage }` | signapps-contacts (CRM) |
| `contacts.created` | `{ contact_id, name, email }` | signapps-contacts |

#### Billing Events
| Event Type | Payload | Emitted by |
|---|---|---|
| `billing.invoice.created` | `{ invoice_id, tenant_id, amount_cents, currency }` | signapps-billing |
| `billing.invoice.paid` | `{ invoice_id, amount_cents, method }` | signapps-billing |
| `billing.invoice.overdue` | `{ invoice_id, due_date, amount_cents }` | signapps-scheduler |

#### Chat Events
| Event Type | Payload | Emitted by |
|---|---|---|
| `chat.message.created` | `{ channel_id, message_id, author_id, content_preview }` | signapps-chat |
| `chat.mention` | `{ channel_id, message_id, mentioned_user_id }` | signapps-chat |

#### Docs Events
| Event Type | Payload | Emitted by |
|---|---|---|
| `docs.document.created` | `{ doc_id, title, author_id }` | signapps-docs |
| `docs.mention` | `{ doc_id, mentioned_user_id, author_id }` | signapps-docs |

#### Social Events
| Event Type | Payload | Emitted by |
|---|---|---|
| `social.post.published` | `{ post_id, platform, account_id }` | signapps-social |
| `social.post.failed` | `{ post_id, error_message }` | signapps-social |

#### Meet Events
| Event Type | Payload | Emitted by |
|---|---|---|
| `meet.session.ended` | `{ room_id, duration_secs, participant_count, recording_id }` | signapps-meet |

#### Forms Events
| Event Type | Payload | Emitted by |
|---|---|---|
| `forms.response.submitted` | `{ form_id, response_id, respondent }` | signapps-forms |

#### Drive Events
| Event Type | Payload | Emitted by |
|---|---|---|
| `drive.file.uploaded` | `{ node_id, name, mime_type, size_bytes }` | signapps-storage |
| `drive.file.shared` | `{ node_id, shared_with_user_id }` | signapps-storage |

## 4. Integration Waves

### 4.1 Wave 1 — Event Bus + Unified Notifications

**Goal:** Every event produces a notification. Users see a unified activity feed.

**Backend changes:**
- Migration: `platform.events` + `platform.event_consumers` tables
- `signapps-common/src/events.rs`: EventBus crate with publish/listen
- Each service: publish events on key actions (INSERT into platform.events in same transaction)
- `signapps-notifications`: listen to ALL events, create notification entries, push via SSE

**Event → Notification mapping:**
| Event | Notification text | Recipients |
|---|---|---|
| `mail.received` | "Nouveau mail de {from}: {subject}" | to user |
| `calendar.event.reminder` | "Event dans {minutes}min: {title}" | attendees |
| `calendar.task.overdue` | "Tache en retard: {title}" | assignee |
| `chat.mention` | "{author} vous a mentionne dans #{channel}" | mentioned user |
| `docs.mention` | "{author} vous a mentionne dans {doc}" | mentioned user |
| `billing.invoice.paid` | "Facture payee: {amount}" | tenant admins |
| `crm.deal.won` | "Deal gagne: {title} ({amount})" | deal owner |
| `forms.response.submitted` | "Nouvelle reponse: {form_title}" | form owner |
| `social.post.failed` | "Publication echouee: {error}" | post author |

**Frontend changes:**
- `use-notifications-sse.ts` already connects to scheduler SSE — extend to read from notifications service
- Unified notification center shows all cross-service notifications
- Click on notification → deep link to relevant page

### 4.2 Wave 2 — Mail ↔ Calendar ↔ Tasks

**Goal:** The productivity triangle works end-to-end.

**Event reactions (backend listeners):**

| Trigger Event | Listener | Action |
|---|---|---|
| `mail.received` (has_ics_attachment) | signapps-calendar | Parse ICS from email body, create calendar event, link via entity_links |
| `calendar.event.reminder` | signapps-notifications | Push notification + optional email via mail service |
| `calendar.task.overdue` | signapps-mail | Send reminder email to assignee |
| `calendar.task.completed` | signapps-notifications | Notify task creator |

**Frontend changes:**
- `EmailToEventDialog`: already works (real API) — no change needed
- `QuickComposeFromTask`: replace localStorage outbox with real `mailApi.sendEmail()` call
- `TasksDueInCalendar`: replace localStorage read with real `calendarApi.listTasks()` call
- `EventNotesDoc`: replace localStorage with real `docsApi.createDocument()` call
- `RecurringEventToTask`: replace interopStore with real `calendarApi.createTask()` call

### 4.3 Wave 3 — CRM ↔ Billing ↔ Contacts

**Goal:** The business triangle is real. Deals, invoices, and contacts are linked.

**Event reactions (backend listeners):**

| Trigger Event | Listener | Action |
|---|---|---|
| `crm.deal.won` | signapps-billing | Auto-create invoice from deal amount + contact info |
| `billing.invoice.paid` | signapps-contacts (CRM) | Update deal revenue, mark as closed-won-paid |
| `billing.invoice.overdue` | signapps-notifications | Notify tenant admins + flag in CRM |
| `contacts.created` | signapps-contacts (CRM) | Auto-create lead if source is "form" or "email" |
| `forms.response.submitted` | signapps-contacts | Create/update contact from form data if form has contact fields |

**Frontend changes — replace ALL localStorage stubs:**
- `ContactDealsPanel` → real `crmApi.deals.list({ contact_id })`
- `ContactPaymentHistory` → real `billingApi.listInvoices({ contact_id })`
- `BillingForecast` → real `billingApi.listInvoices()` + aggregate
- `PipelineInvoiceValue` → real `crmApi.deals.list()` + `billingApi`
- `OverdueInvoicesCrmFlag` → real `billingApi.listInvoices({ status: 'overdue' })`
- `ContactCalendarPanel` → real `calendarApi.listEvents({ attendee_email })`
- `ContactSocialProfiles` → real `socialApi.accounts.list({ user_id })`
- `ContactTasksPanel` → real `calendarApi.listTasks({ assignee_id })`
- `DealDocumentsPanel` → real `linksApi.find({ source_type: 'deal', target_type: 'document' })`
- `SharedContactNotes` → real `linksApi` + comments API
- `ContactActivityTimeline` → real `activitiesApi.forEntity(contact_id)`
- `ContactCustomFieldsCrm` → real contacts API custom fields
- `InvoiceEmailSender` → real `mailApi.sendEmail()` with invoice PDF attachment
- `DealStageNotifier` → event bus: `crm.deal.stage_changed` → notification

**CRM backend (signapps-contacts extension):**
The contacts service needs CRM endpoints if they don't already exist:
- `GET/POST /api/v1/deals` — CRUD deals linked to contacts
- `GET /api/v1/deals?contact_id=X` — deals by contact
- `PATCH /api/v1/deals/:id/stage` — move deal through pipeline

Check if these exist before implementing. If not, add them to signapps-contacts.

### 4.4 Wave 4 — AI + Social + Docs + Meet

**Goal:** Intelligence layer — AI indexes everything, social analytics, doc collaboration notifications.

**Event reactions (backend listeners):**

| Trigger Event | Listener | Action |
|---|---|---|
| `chat.message.created` | signapps-ai | Index message in RAG (uncomment migration 038 trigger) |
| `social.post.published` | signapps-ai | Index post content for analytics |
| `docs.mention` | signapps-notifications | Notify mentioned user with doc link |
| `meet.session.ended` | signapps-docs | Auto-create transcript document if recording exists |
| `drive.file.uploaded` | signapps-ai | Trigger AI auto-tagging (replace localStorage tags) |

**Frontend changes:**
- `AiAutoTagDrive`: replace localStorage tags with real AI-generated tags stored in drive node metadata
- `SocialAnalyticsDocLink`: replace localStorage tracking with real `activitiesApi`
- `cross-module-comments`: replace localStorage with real identity comments API
- `unified-notifications`: replace localStorage fallback with real notifications API
- `ContactBirthdayCrmContext`: replace localStorage with real contacts + calendar API

## 5. Frontend Unified Activity Feed

### 5.1 Cross-Module Activity API

The `platform.activities` table (migration 066) already exists. The identity service needs a `GET /api/v1/activities/cross-module` endpoint that:
- Queries `platform.activities` filtered by workspace/tenant
- Joins with `identity.users` for actor names
- Returns the last 50 activities across all services

### 5.2 Frontend Hook

```typescript
// hooks/use-cross-module-activity.ts — already exists but hits a 404 endpoint
// Fix: implement the backend endpoint, then the hook works as-is
```

## 6. Gateway Consolidation

All services should be routable through the gateway. Fix port conflicts and add missing routes:

| Service | Port (factory) | Gateway path |
|---|---|---|
| chat | 3020 | `/api/v1/chat` |
| collab | 3013 | `/api/v1/collab` |
| meet | 3014 | `/api/v1/meet` |
| notifications | 8095 | `/api/v1/notifications` |
| billing | 8096 | `/api/v1/billing` |
| workforce | 3024 | `/api/v1/workforce` |
| contacts | 3021 | `/api/v1/contacts` |
| metrics | 3008 | `/api/v1/metrics` |
| media | 3009 | `/api/v1/media` |
| scheduler | 3023 | `/api/v1/scheduler` |
| securelink | 3006 | `/api/v1/securelink` |
| it-assets | 3015 | `/api/v1/it-assets` |

Fix conflicting ports in gateway config to match the factory definitions.

## 7. Implementation Order

1. **Migration** — `platform.events`, `platform.event_consumers` tables
2. **Crate** — `signapps-common/src/events.rs` (EventBus)
3. **Wave 1** — publish events in 5 key services + notifications listener
4. **Wave 2** — mail↔calendar↔tasks integrations
5. **Wave 3** — CRM↔billing↔contacts + replace localStorage stubs
6. **Wave 4** — AI indexing + social analytics + doc mentions
7. **Gateway** — consolidate all routes
8. **Frontend** — replace remaining stubs, unified activity feed

## 8. Success Criteria

- **Zero localStorage stubs remaining** in `components/interop/`
- **Every service publishes at least 1 event type** to platform.events
- **Notifications service** receives and displays events from all services
- **Deal won → invoice created** flow works end-to-end without frontend orchestration
- **Email with ICS → calendar event** works automatically
- **Task overdue → email reminder** sent without user action
- **0 new TypeScript errors, 0 new Rust errors**
- **No external infrastructure** — PostgreSQL only
