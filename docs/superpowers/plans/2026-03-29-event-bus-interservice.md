# Event Bus & Inter-Service Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all localStorage stubs with real cross-service integrations powered by a PostgreSQL outbox event bus, so actions in one module automatically reflect in all others.

**Architecture:** PostgreSQL outbox table (`platform.events`) with NOTIFY trigger for real-time delivery. Each service publishes events in the same DB transaction as its business logic. A shared `EventBus` crate handles publish/subscribe with catch-up-on-startup. The existing in-memory `EventBus` in `signapps-common/src/events.rs` is extended to persist to PostgreSQL.

**Tech Stack:** Rust/Axum (backend), PostgreSQL LISTEN/NOTIFY, sqlx, tokio::sync::broadcast, Next.js/React (frontend)

---

## File Structure

### New files
- `migrations/093_event_bus.sql` — events + event_consumers tables + NOTIFY trigger
- `crates/signapps-common/src/pg_events.rs` — PostgreSQL-backed EventBus (publish, listen, catch-up)

### Modified files (backend — event publishing)
- `services/signapps-mail/src/main.rs` — publish `mail.received`, `mail.sent`
- `services/signapps-calendar/src/handlers/events.rs` — publish `calendar.event.created`
- `services/signapps-calendar/src/handlers/tasks.rs` — publish `calendar.task.completed`
- `services/signapps-billing/src/main.rs` — publish `billing.invoice.created`, `billing.invoice.paid`
- `services/signapps-forms/src/main.rs` — publish `forms.response.submitted`
- `services/signapps-social/src/main.rs` — publish `social.post.published`
- `services/signapps-chat/src/main.rs` — publish `chat.message.created`, `chat.mention`
- `services/signapps-storage/src/main.rs` — publish `drive.file.uploaded`
- `services/signapps-contacts/src/main.rs` — publish `contacts.created`

### Modified files (backend — event consuming)
- `services/signapps-notifications/src/main.rs` — listen to ALL events, create notifications
- `services/signapps-calendar/src/main.rs` — listen to `mail.received` (ICS parse)
- `services/signapps-billing/src/main.rs` — listen to `crm.deal.won` (auto-invoice)
- `services/signapps-mail/src/main.rs` — listen to `calendar.task.overdue` (send reminder)

### Modified files (frontend — replace stubs)
- `client/src/components/interop/ContactDealsPanel.tsx` — real crmApi
- `client/src/components/interop/ContactPaymentHistory.tsx` — real billingApi
- `client/src/components/interop/ContactCalendarPanel.tsx` — real calendarApi
- `client/src/components/interop/ContactTasksPanel.tsx` — real calendarApi
- `client/src/components/interop/BillingForecast.tsx` — real billingApi
- `client/src/components/interop/ContactActivityTimeline.tsx` — real activitiesApi
- `client/src/components/interop/TasksDueInCalendar.tsx` — real calendarApi
- `client/src/components/interop/EventNotesDoc.tsx` — fix targetType bug
- `client/src/components/interop/unified-notifications.tsx` — real notifications API
- `client/src/components/interop/cross-module-comments.tsx` — real comments API

### Modified files (gateway)
- `services/signapps-gateway/src/main.rs` — add 12 missing service routes

---

## Task 1: Event Bus Migration

**Files:**
- Create: `migrations/093_event_bus.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 093_event_bus.sql
-- Event Bus: PostgreSQL outbox pattern with LISTEN/NOTIFY

-- Table: persisted events (outbox)
CREATE TABLE IF NOT EXISTS platform.events (
    id UUID PRIMARY KEY DEFAULT gen_uuid_v7(),
    event_type VARCHAR(100) NOT NULL,
    source_service VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    tenant_id UUID,
    actor_id UUID,
    payload JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_type_created ON platform.events (event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_events_entity ON platform.events (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_events_created ON platform.events (created_at);

-- Table: consumer cursor tracking
CREATE TABLE IF NOT EXISTS platform.event_consumers (
    consumer VARCHAR(50) PRIMARY KEY,
    last_event_id UUID NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger: NOTIFY on new event
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

CREATE TRIGGER trg_platform_notify_event
    AFTER INSERT ON platform.events
    FOR EACH ROW EXECUTE FUNCTION platform.notify_event();

-- Retention: auto-delete events older than 90 days (optional cron)
-- DELETE FROM platform.events WHERE created_at < now() - INTERVAL '90 days';
```

- [ ] **Step 2: Verify migration file is in correct directory**

Run: `ls migrations/093_event_bus.sql`
Expected: file exists

- [ ] **Step 3: Commit**

```bash
git add migrations/093_event_bus.sql
git commit -m "feat: add platform.events outbox table with NOTIFY trigger"
```

---

## Task 2: PgEventBus Crate

**Files:**
- Create: `crates/signapps-common/src/pg_events.rs`
- Modify: `crates/signapps-common/src/lib.rs` — add `pub mod pg_events;`

- [ ] **Step 1: Write the PgEventBus module**

```rust
//! PostgreSQL-backed event bus with LISTEN/NOTIFY + catch-up polling.
//!
//! Usage:
//! ```rust
//! let bus = PgEventBus::new(pool.clone(), "signapps-notifications").await?;
//! bus.publish(NewEvent { event_type: "mail.received".into(), ... }).await?;
//! bus.listen(|event| async move { handle(event).await }).await?;
//! ```

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use std::sync::Arc;
use tokio::sync::broadcast;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformEvent {
    pub id: Uuid,
    pub event_type: String,
    pub source_service: String,
    pub entity_type: String,
    pub entity_id: Uuid,
    pub tenant_id: Option<Uuid>,
    pub actor_id: Option<Uuid>,
    pub payload: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct NewEvent {
    pub event_type: String,
    pub entity_type: String,
    pub entity_id: Uuid,
    pub tenant_id: Option<Uuid>,
    pub actor_id: Option<Uuid>,
    pub payload: serde_json::Value,
}

#[derive(Clone)]
pub struct PgEventBus {
    pool: PgPool,
    consumer_name: String,
    source_service: String,
    tx: broadcast::Sender<PlatformEvent>,
}

impl PgEventBus {
    /// Create a new event bus for a service.
    /// `consumer_name` is used to track the last processed event.
    /// `source_service` is stamped on every published event.
    pub async fn new(pool: PgPool, consumer_name: &str, source_service: &str) -> Result<Self, sqlx::Error> {
        let (tx, _) = broadcast::channel(512);
        Ok(Self {
            pool,
            consumer_name: consumer_name.to_string(),
            source_service: source_service.to_string(),
            tx,
        })
    }

    /// Publish an event (INSERT into platform.events in current transaction context).
    pub async fn publish(&self, event: NewEvent) -> Result<Uuid, sqlx::Error> {
        let row = sqlx::query_scalar::<_, Uuid>(
            "INSERT INTO platform.events (event_type, source_service, entity_type, entity_id, tenant_id, actor_id, payload) \
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id"
        )
        .bind(&event.event_type)
        .bind(&self.source_service)
        .bind(&event.entity_type)
        .bind(&event.entity_id)
        .bind(&event.tenant_id)
        .bind(&event.actor_id)
        .bind(&event.payload)
        .fetch_one(&self.pool)
        .await?;
        Ok(row)
    }

    /// Publish within an existing transaction.
    pub async fn publish_in_tx(&self, tx: &mut sqlx::Transaction<'_, sqlx::Postgres>, event: NewEvent) -> Result<Uuid, sqlx::Error> {
        let row = sqlx::query_scalar::<_, Uuid>(
            "INSERT INTO platform.events (event_type, source_service, entity_type, entity_id, tenant_id, actor_id, payload) \
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id"
        )
        .bind(&event.event_type)
        .bind(&self.source_service)
        .bind(&event.entity_type)
        .bind(&event.entity_id)
        .bind(&event.tenant_id)
        .bind(&event.actor_id)
        .bind(&event.payload)
        .fetch_one(&mut **tx)
        .await?;
        Ok(row)
    }

    /// Start listening for events. Catches up from last processed event, then switches to LISTEN.
    /// The handler is called for each event. Return Ok(()) to mark as processed, Err to retry later.
    pub async fn listen<F, Fut>(&self, handler: F) -> Result<(), Box<dyn std::error::Error + Send + Sync>>
    where
        F: Fn(PlatformEvent) -> Fut + Send + Sync + 'static,
        Fut: std::future::Future<Output = Result<(), Box<dyn std::error::Error + Send + Sync>>> + Send,
    {
        // 1. Catch up from last processed event
        let last_id = self.get_last_event_id().await?;
        let missed = if let Some(last_id) = last_id {
            sqlx::query_as::<_, PlatformEventRow>(
                "SELECT id, event_type, source_service, entity_type, entity_id, tenant_id, actor_id, payload, created_at \
                 FROM platform.events WHERE id > $1 ORDER BY id"
            )
            .bind(last_id)
            .fetch_all(&self.pool)
            .await?
        } else {
            // First run — only process events from now
            Vec::new()
        };

        tracing::info!(
            consumer = %self.consumer_name,
            missed_count = missed.len(),
            "Event bus catch-up complete"
        );

        for row in missed {
            let event = row.into_event();
            if let Err(e) = handler(event.clone()).await {
                tracing::error!(event_id = %event.id, error = %e, "Failed to process missed event");
            }
            self.update_cursor(event.id).await?;
        }

        // 2. Register for LISTEN
        let mut listener = sqlx::postgres::PgListener::connect_with(&self.pool).await?;
        listener.listen("platform_events").await?;
        tracing::info!(consumer = %self.consumer_name, "Listening for platform events");

        // 3. Process incoming notifications
        loop {
            let notification = listener.recv().await?;
            let payload: serde_json::Value = serde_json::from_str(notification.payload())?;
            let event_id: Uuid = payload["id"].as_str()
                .and_then(|s| s.parse().ok())
                .unwrap_or_default();

            // Fetch full event from DB (NOTIFY payload is truncated)
            if let Some(row) = sqlx::query_as::<_, PlatformEventRow>(
                "SELECT id, event_type, source_service, entity_type, entity_id, tenant_id, actor_id, payload, created_at \
                 FROM platform.events WHERE id = $1"
            )
            .bind(event_id)
            .fetch_optional(&self.pool)
            .await?
            {
                let event = row.into_event();
                // Skip events from our own service
                if event.source_service == self.source_service {
                    self.update_cursor(event.id).await?;
                    continue;
                }
                if let Err(e) = handler(event.clone()).await {
                    tracing::error!(event_id = %event.id, error = %e, "Failed to process event");
                }
                self.update_cursor(event.id).await?;
            }
        }
    }

    async fn get_last_event_id(&self) -> Result<Option<Uuid>, sqlx::Error> {
        let row = sqlx::query_scalar::<_, Uuid>(
            "SELECT last_event_id FROM platform.event_consumers WHERE consumer = $1"
        )
        .bind(&self.consumer_name)
        .fetch_optional(&self.pool)
        .await?;
        Ok(row)
    }

    async fn update_cursor(&self, event_id: Uuid) -> Result<(), sqlx::Error> {
        sqlx::query(
            "INSERT INTO platform.event_consumers (consumer, last_event_id, updated_at) \
             VALUES ($1, $2, now()) \
             ON CONFLICT (consumer) DO UPDATE SET last_event_id = $2, updated_at = now()"
        )
        .bind(&self.consumer_name)
        .bind(event_id)
        .execute(&self.pool)
        .await?;
        Ok(())
    }
}

#[derive(sqlx::FromRow)]
struct PlatformEventRow {
    id: Uuid,
    event_type: String,
    source_service: String,
    entity_type: String,
    entity_id: Uuid,
    tenant_id: Option<Uuid>,
    actor_id: Option<Uuid>,
    payload: serde_json::Value,
    created_at: DateTime<Utc>,
}

impl PlatformEventRow {
    fn into_event(self) -> PlatformEvent {
        PlatformEvent {
            id: self.id,
            event_type: self.event_type,
            source_service: self.source_service,
            entity_type: self.entity_type,
            entity_id: self.entity_id,
            tenant_id: self.tenant_id,
            actor_id: self.actor_id,
            payload: self.payload,
            created_at: self.created_at,
        }
    }
}
```

- [ ] **Step 2: Register module in lib.rs**

Add `pub mod pg_events;` after the existing `pub mod pg_listener;` line in `crates/signapps-common/src/lib.rs`. Add re-export: `pub use pg_events::{PgEventBus, PlatformEvent, NewEvent};`

- [ ] **Step 3: Verify compilation**

Run: `cargo check -p signapps-common`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add crates/signapps-common/src/pg_events.rs crates/signapps-common/src/lib.rs
git commit -m "feat: add PgEventBus — PostgreSQL outbox with LISTEN/NOTIFY"
```

---

## Task 3: Publish Events — Mail, Calendar, Billing, Forms, Chat, Storage, Contacts

**Files:**
- Modify: 9 service `main.rs` files (see file structure above)

For each service, the pattern is identical:
1. Add `PgEventBus` to `AppState`
2. Initialize in `main()` after pool creation
3. Call `event_bus.publish(...)` after key operations

- [ ] **Step 1: Add PgEventBus to each service's AppState**

In each service's `main.rs`, add to the `AppState` struct:
```rust
pub event_bus: signapps_common::PgEventBus,
```

In `main()`, after pool creation:
```rust
let event_bus = signapps_common::PgEventBus::new(
    pool.clone(), "signapps-{service}", "signapps-{service}"
).await.expect("Failed to create event bus");
```

Pass it into `AppState { pool, jwt_config, event_bus }`.

- [ ] **Step 2: Publish events in mail service**

In `signapps-mail/src/main.rs`, after a message is received/stored:
```rust
let _ = state.event_bus.publish(signapps_common::NewEvent {
    event_type: "mail.received".into(),
    entity_type: "email".into(),
    entity_id: email_id,
    tenant_id: claims.tenant_id,
    actor_id: Some(claims.sub),
    payload: serde_json::json!({
        "from": from_address,
        "to": to_address,
        "subject": subject,
    }),
}).await;
```

- [ ] **Step 3: Publish events in calendar service**

In `signapps-calendar/src/handlers/events.rs`, after event creation (around line 70):
```rust
let _ = state.event_bus.publish(NewEvent {
    event_type: "calendar.event.created".into(),
    entity_type: "calendar_event".into(),
    entity_id: event.id,
    tenant_id: claims.tenant_id,
    actor_id: Some(claims.sub),
    payload: json!({ "title": event.title, "start": event.start_time, "end": event.end_time }),
}).await;
```

In `handlers/tasks.rs`, after task completion:
```rust
let _ = state.event_bus.publish(NewEvent {
    event_type: "calendar.task.completed".into(),
    entity_type: "task".into(),
    entity_id: task.id,
    tenant_id: claims.tenant_id,
    actor_id: Some(claims.sub),
    payload: json!({ "title": task.title }),
}).await;
```

- [ ] **Step 4: Publish events in billing, forms, chat, storage, contacts**

Same pattern for each — publish after the key INSERT. Event types:
- billing: `billing.invoice.created` after `create_invoice`, `billing.invoice.paid` after payment status change
- forms: `forms.response.submitted` after `submit_response`
- chat: `chat.message.created` after message insert
- storage: `drive.file.uploaded` after file creation
- contacts: `contacts.created` after contact insert

Each publish is fire-and-forget (`let _ = ...`) to avoid blocking the main request.

- [ ] **Step 5: Verify compilation**

Run: `cargo check --workspace`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add services/
git commit -m "feat: publish platform events from 9 services"
```

---

## Task 4: Notifications Service — Listen & Create Notifications

**Files:**
- Modify: `services/signapps-notifications/src/main.rs`

- [ ] **Step 1: Add event listener to notifications service**

Add `PgEventBus` to AppState. In `main()`, after pool/router setup, spawn a listener task:

```rust
let event_bus = signapps_common::PgEventBus::new(
    pool.clone(), "signapps-notifications", "signapps-notifications"
).await.expect("Failed to create event bus");

let listener_pool = pool.clone();
tokio::spawn(async move {
    if let Err(e) = event_bus.listen(move |event| {
        let pool = listener_pool.clone();
        async move {
            handle_platform_event(&pool, event).await
        }
    }).await {
        tracing::error!("Event listener failed: {}", e);
    }
});
```

- [ ] **Step 2: Implement event-to-notification mapping**

```rust
async fn handle_platform_event(
    pool: &PgPool,
    event: signapps_common::PlatformEvent,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let (user_id, title, message, link) = match event.event_type.as_str() {
        "mail.received" => {
            let to_id = event.actor_id.unwrap_or_default();
            let from = event.payload["from"].as_str().unwrap_or("unknown");
            let subject = event.payload["subject"].as_str().unwrap_or("(sans objet)");
            (to_id, "Nouveau mail".to_string(), format!("De {}: {}", from, subject), Some("/mail".to_string()))
        }
        "calendar.task.completed" => {
            let actor = event.actor_id.unwrap_or_default();
            let title_str = event.payload["title"].as_str().unwrap_or("tache");
            (actor, "Tache terminee".to_string(), format!("{}", title_str), Some("/tasks".to_string()))
        }
        "billing.invoice.paid" => {
            let actor = event.actor_id.unwrap_or_default();
            let amount = event.payload["amount_cents"].as_i64().unwrap_or(0);
            (actor, "Paiement recu".to_string(), format!("{}EUR", amount / 100), Some("/billing".to_string()))
        }
        "chat.mention" => {
            let mentioned = event.payload["mentioned_user_id"].as_str()
                .and_then(|s| s.parse::<Uuid>().ok())
                .unwrap_or_default();
            (mentioned, "Mention".to_string(), "Vous avez ete mentionne dans un chat".to_string(), Some("/chat".to_string()))
        }
        "forms.response.submitted" => {
            let owner = event.actor_id.unwrap_or_default();
            (owner, "Nouvelle reponse".to_string(), "Un formulaire a recu une reponse".to_string(), Some("/forms".to_string()))
        }
        "social.post.failed" => {
            let author = event.actor_id.unwrap_or_default();
            let err = event.payload["error_message"].as_str().unwrap_or("erreur inconnue");
            (author, "Publication echouee".to_string(), err.to_string(), Some("/social".to_string()))
        }
        _ => return Ok(()), // Ignore unknown events
    };

    sqlx::query(
        "INSERT INTO notifications.notifications (user_id, type, title, message, metadata) \
         VALUES ($1, 'event', $2, $3, $4)"
    )
    .bind(user_id)
    .bind(&title)
    .bind(&message)
    .bind(serde_json::json!({
        "event_id": event.id,
        "event_type": event.event_type,
        "entity_id": event.entity_id,
        "link": link,
    }))
    .execute(pool)
    .await?;

    Ok(())
}
```

- [ ] **Step 3: Verify compilation**

Run: `cargo check -p signapps-notifications`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add services/signapps-notifications/
git commit -m "feat: notifications service listens to platform events"
```

---

## Task 5: Cross-Service Event Reactions (Calendar←Mail, Billing←CRM, Mail←Tasks)

**Files:**
- Modify: `services/signapps-calendar/src/main.rs` — listen for `mail.received` with ICS
- Modify: `services/signapps-billing/src/main.rs` — listen for `crm.deal.won`
- Modify: `services/signapps-mail/src/main.rs` — listen for `calendar.task.overdue`

- [ ] **Step 1: Calendar listens for mail.received (ICS auto-import)**

Same pattern as Task 4 — spawn listener in calendar's main(). Handler:
```rust
if event.event_type == "mail.received" {
    if event.payload["has_ics_attachment"].as_bool() == Some(true) {
        // Fetch the email, parse ICS, create calendar event
        tracing::info!(email_id = %event.entity_id, "Auto-importing ICS from email");
        // Implementation: fetch email body via DB, parse ICS with icalendar crate,
        // INSERT INTO calendar.events
    }
}
```

- [ ] **Step 2: Billing listens for crm.deal.won (auto-invoice)**

```rust
if event.event_type == "crm.deal.won" {
    let deal_amount = event.payload["amount"].as_i64().unwrap_or(0);
    let contact_id = event.payload["contact_id"].as_str()
        .and_then(|s| s.parse::<Uuid>().ok());
    sqlx::query(
        "INSERT INTO billing.invoices (tenant_id, amount_cents, currency, status, metadata) \
         VALUES ($1, $2, 'EUR', 'draft', $3)"
    )
    .bind(event.tenant_id)
    .bind(deal_amount)
    .bind(serde_json::json!({ "deal_id": event.entity_id, "contact_id": contact_id, "auto_generated": true }))
    .execute(&pool)
    .await?;
    tracing::info!(deal_id = %event.entity_id, "Auto-created invoice from won deal");
}
```

- [ ] **Step 3: Mail listens for calendar.task.overdue (email reminder)**

```rust
if event.event_type == "calendar.task.overdue" {
    let assignee_id = event.payload["assignee_id"].as_str()
        .and_then(|s| s.parse::<Uuid>().ok());
    if let Some(user_id) = assignee_id {
        // Look up user email from identity.users
        let email: Option<String> = sqlx::query_scalar(
            "SELECT email FROM identity.users WHERE id = $1"
        ).bind(user_id).fetch_optional(&pool).await?;
        if let Some(email) = email {
            let title = event.payload["title"].as_str().unwrap_or("tache");
            // Send reminder email (use internal mail sending logic)
            tracing::info!(user = %email, task = %title, "Sending overdue task reminder");
        }
    }
}
```

- [ ] **Step 4: Verify compilation**

Run: `cargo check --workspace`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add services/signapps-calendar/ services/signapps-billing/ services/signapps-mail/
git commit -m "feat: cross-service event reactions — ICS import, auto-invoice, task reminders"
```

---

## Task 6: Frontend — Replace CRM/Billing/Contacts localStorage Stubs

**Files:** ~10 interop components (see file structure)

- [ ] **Step 1: Replace ContactDealsPanel**

Read current file. Replace `getDealsForContact()` (localStorage) with:
```typescript
import { crmApi } from '@/lib/api/crm';
const { data } = await crmApi.deals.list({ contact_id: contactId });
```
Remove all localStorage reads/writes for deals.

- [ ] **Step 2: Replace ContactPaymentHistory**

Replace `getContactPaymentHistory()` with:
```typescript
import { billingApi } from '@/lib/api/billing';
const { data } = await billingApi.listInvoices();
const contactInvoices = data.filter(inv => inv.metadata?.contact_id === contactId);
```

- [ ] **Step 3: Replace ContactCalendarPanel**

Replace `localStorage.getItem("calendar:events")` with:
```typescript
import { calendarApi } from '@/lib/api/calendar';
const { data: calendars } = await calendarApi.listCalendars();
// Fetch events from each calendar, filter by attendee email
```

- [ ] **Step 4: Replace ContactTasksPanel, TasksDueInCalendar**

Replace localStorage reads with real `calendarApi.listTasks()` calls.

- [ ] **Step 5: Replace BillingForecast, PipelineInvoiceValue, OverdueInvoicesCrmFlag**

Replace `localInvoicesApi` with real `billingApi` calls:
```typescript
const { data: invoices } = await billingApi.listInvoices();
const overdue = invoices.filter(i => i.status === 'overdue');
```

- [ ] **Step 6: Replace ContactActivityTimeline**

Replace `useInteropActivity()` → `interopStore` with real:
```typescript
import { activitiesApi } from '@/lib/api/crosslinks';
const { data } = await activitiesApi.forEntity('contact', contactId);
```

- [ ] **Step 7: Fix EventNotesDoc targetType bug**

In `EventNotesDoc.tsx` line 53, change `targetType: "mail"` to `targetType: "document"`.

- [ ] **Step 8: Replace unified-notifications and cross-module-comments**

- `unified-notifications.tsx`: replace localStorage fallback with real `notificationsApi.list()`
- `cross-module-comments.tsx`: replace localStorage with real identity comments API

- [ ] **Step 9: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 10: Commit**

```bash
git add client/src/components/interop/
git commit -m "feat: replace all localStorage stubs with real API calls in interop components"
```

---

## Task 7: Identity Service — Cross-Module Activity Endpoint

**Files:**
- Modify: `services/signapps-identity/src/main.rs` — add `GET /api/v1/activity/cross-module`

- [ ] **Step 1: Add the endpoint**

```rust
async fn cross_module_activity(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<ActivityEntry>>, AppError> {
    let workspace_id = claims.workspace_ids.first();
    let activities = sqlx::query_as::<_, ActivityEntry>(
        "SELECT id, actor_id, action, entity_type, entity_id, entity_title, metadata, workspace_id, created_at \
         FROM platform.activities \
         WHERE workspace_id = $1 \
         ORDER BY created_at DESC LIMIT 50"
    )
    .bind(workspace_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(Json(activities))
}
```

- [ ] **Step 2: Register route**

Add to protected routes: `.route("/api/v1/activity/cross-module", get(cross_module_activity))`

- [ ] **Step 3: Verify compilation**

Run: `cargo check -p signapps-identity`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add services/signapps-identity/
git commit -m "feat: add cross-module activity feed endpoint"
```

---

## Task 8: Gateway — Add Missing Service Routes

**Files:**
- Modify: `services/signapps-gateway/src/main.rs`

- [ ] **Step 1: Add 12 missing routes**

In the gateway's route configuration (around line 243), add:

```rust
// Missing services
("/api/v1/chat",          env_or("CHAT_SERVICE_URL", "http://127.0.0.1:3020")),
("/api/v1/collab",        env_or("COLLAB_SERVICE_URL", "http://127.0.0.1:3013")),
("/api/v1/meet",          env_or("MEET_SERVICE_URL", "http://127.0.0.1:3014")),
("/api/v1/notifications", env_or("NOTIFICATIONS_SERVICE_URL", "http://127.0.0.1:8095")),
("/api/v1/billing",       env_or("BILLING_SERVICE_URL", "http://127.0.0.1:8096")),
("/api/v1/workforce",     env_or("WORKFORCE_SERVICE_URL", "http://127.0.0.1:3024")),
("/api/v1/contacts",      env_or("CONTACTS_SERVICE_URL", "http://127.0.0.1:3021")),
("/api/v1/metrics",       env_or("METRICS_SERVICE_URL", "http://127.0.0.1:3025")),
("/api/v1/media",         env_or("MEDIA_SERVICE_URL", "http://127.0.0.1:3009")),
("/api/v1/scheduler",     env_or("SCHEDULER_SERVICE_URL", "http://127.0.0.1:3023")),
("/api/v1/securelink",    env_or("SECURELINK_SERVICE_URL", "http://127.0.0.1:3006")),
("/api/v1/it-assets",     env_or("IT_ASSETS_SERVICE_URL", "http://127.0.0.1:3026")),
```

Also fix conflicting ports in existing routes to match client factory.ts definitions.

- [ ] **Step 2: Verify compilation**

Run: `cargo check -p signapps-gateway`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add services/signapps-gateway/
git commit -m "feat: add 12 missing service routes to gateway"
```

---

## Task 9: AI Indexing — Uncomment Chat Trigger + Social Indexing

**Files:**
- Modify: `migrations/038_ai_ingestion_triggers.sql` or create new migration

- [ ] **Step 1: Create migration to enable chat AI indexing**

```sql
-- 094_ai_chat_social_indexing.sql
-- Enable AI ingestion for chat messages and social posts

-- Chat messages → AI ingestion queue (was commented out in 038)
CREATE OR REPLACE FUNCTION trg_ai_ingest_chat_fn() RETURNS trigger AS $$
BEGIN
    INSERT INTO ai.ingestion_queue (source_type, source_id, content, metadata)
    VALUES ('chat_message', NEW.id, NEW.content,
            json_build_object('channel_id', NEW.channel_id, 'author_id', NEW.author_id)::jsonb);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Only create trigger if chat.messages table exists
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'chat' AND table_name = 'messages') THEN
        CREATE TRIGGER trg_ai_ingest_chat
            AFTER INSERT ON chat.messages
            FOR EACH ROW EXECUTE FUNCTION trg_ai_ingest_chat_fn();
    END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Social posts → AI ingestion queue
CREATE OR REPLACE FUNCTION trg_ai_ingest_social_fn() RETURNS trigger AS $$
BEGIN
    INSERT INTO ai.ingestion_queue (source_type, source_id, content, metadata)
    VALUES ('social_post', NEW.id, NEW.content,
            json_build_object('platform', NEW.platform, 'status', NEW.status)::jsonb);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
    CREATE TRIGGER trg_ai_ingest_social
        AFTER INSERT ON social.posts
        FOR EACH ROW EXECUTE FUNCTION trg_ai_ingest_social_fn();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
```

- [ ] **Step 2: Commit**

```bash
git add migrations/094_ai_chat_social_indexing.sql
git commit -m "feat: enable AI indexing for chat messages and social posts"
```

---

## Execution Order

1. Task 1 (migration) — foundation, no deps
2. Task 2 (PgEventBus crate) — depends on Task 1 schema
3. Task 3 (publish events) — depends on Task 2 crate
4. Task 4 (notifications listener) — depends on Task 2+3
5. Task 5 (cross-service reactions) — depends on Task 2+3
6. Task 6 (frontend stubs) — independent of backend tasks
7. Task 7 (activity endpoint) — independent
8. Task 8 (gateway) — independent
9. Task 9 (AI indexing) — independent

Tasks 6, 7, 8, 9 can run in parallel. Tasks 1→2→3→4/5 are sequential.
