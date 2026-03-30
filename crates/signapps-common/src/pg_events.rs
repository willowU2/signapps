//! # PostgreSQL-Backed Event Bus
//!
//! Cross-service event bus using PostgreSQL `LISTEN`/`NOTIFY` with persistent
//! event storage and catch-up polling. Complements the in-process [`super::events`]
//! bus — use this module when events must survive process restarts and be
//! delivered to services running in separate processes.
//!
//! ## Architecture
//!
//! - Events are stored in `platform.events` (the DB trigger fires `pg_notify`
//!   automatically after each INSERT).
//! - Each consumer service tracks its position in `platform.event_consumers`.
//! - On startup [`PgEventBus::listen`] catches up from the last processed event,
//!   then switches to live `LISTEN` mode so it never misses events.
//!
//! ## Usage
//!
//! ```rust,ignore
//! use signapps_common::pg_events::{PgEventBus, NewEvent};
//!
//! let bus = PgEventBus::new(pool, "my-service".to_string());
//!
//! // Publish an event
//! bus.publish(NewEvent {
//!     event_type: "user.created".to_string(),
//!     aggregate_id: Some(user_id),
//!     payload: serde_json::json!({ "email": "alice@example.com" }),
//! }).await?;
//!
//! // Subscribe and process events
//! bus.listen("my-consumer", |event| async move {
//!     println!("Received: {:?}", event);
//!     Ok(())
//! }).await?;
//! ```

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

// ── Public types ─────────────────────────────────────────────────────────────

/// A platform event as stored in `platform.events` and returned to handlers.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformEvent {
    /// Auto-incrementing surrogate key used for cursor tracking.
    pub id: i64,
    /// Unique event identifier (UUID v4).
    pub event_id: Uuid,
    /// Logical event type, e.g. `"user.created"`.
    pub event_type: String,
    /// Originating service name.
    pub source_service: String,
    /// Optional aggregate (entity) ID the event belongs to.
    pub aggregate_id: Option<Uuid>,
    /// Free-form JSON payload.
    pub payload: serde_json::Value,
    /// Wall-clock time the event was persisted.
    pub created_at: DateTime<Utc>,
}

/// Input used to publish a new event.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewEvent {
    /// Logical event type, e.g. `"document.signed"`.
    pub event_type: String,
    /// Optional aggregate (entity) ID.
    pub aggregate_id: Option<Uuid>,
    /// Arbitrary JSON payload.
    pub payload: serde_json::Value,
}

// ── Private DB row ────────────────────────────────────────────────────────────

/// Internal struct that maps 1-to-1 to the `platform.events` columns.
/// Never leaked outside this module.
#[derive(sqlx::FromRow)]
struct PlatformEventRow {
    id: i64,
    event_id: Uuid,
    event_type: String,
    source_service: String,
    aggregate_id: Option<Uuid>,
    payload: serde_json::Value,
    created_at: DateTime<Utc>,
}

impl From<PlatformEventRow> for PlatformEvent {
    fn from(row: PlatformEventRow) -> Self {
        Self {
            id: row.id,
            event_id: row.event_id,
            event_type: row.event_type,
            source_service: row.source_service,
            aggregate_id: row.aggregate_id,
            payload: row.payload,
            created_at: row.created_at,
        }
    }
}

// ── PgEventBus ────────────────────────────────────────────────────────────────

/// PostgreSQL-backed event bus.
///
/// Cheap to clone — the inner [`PgPool`] is `Arc`-wrapped by sqlx.
#[derive(Debug, Clone)]
pub struct PgEventBus {
    pool: PgPool,
    /// Service name stamped on every published event and used to skip
    /// self-originated events during `listen`.
    source_service: String,
}

impl PgEventBus {
    /// Create a new bus bound to the given pool and service name.
    pub fn new(pool: PgPool, source_service: String) -> Self {
        Self {
            pool,
            source_service,
        }
    }

    /// Publish a new event by inserting into `platform.events`.
    ///
    /// The database trigger on that table fires `pg_notify('platform_events', …)`
    /// automatically, so no explicit `NOTIFY` call is needed here.
    ///
    /// Returns the auto-assigned `id` of the inserted row.
    pub async fn publish(&self, event: NewEvent) -> Result<i64, sqlx::Error> {
        let row: (i64,) = sqlx::query_as(
            r#"
            INSERT INTO platform.events
                (event_id, event_type, source_service, aggregate_id, payload)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(&event.event_type)
        .bind(&self.source_service)
        .bind(event.aggregate_id)
        .bind(&event.payload)
        .fetch_one(&self.pool)
        .await?;

        tracing::info!(
            event_type = %event.event_type,
            source = %self.source_service,
            id = row.0,
            "published platform event"
        );

        Ok(row.0)
    }

    /// Publish a new event within an existing transaction.
    ///
    /// Use this when the event and its triggering business-logic change must be
    /// committed atomically.
    pub async fn publish_in_tx(
        &self,
        event: NewEvent,
        tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<i64, sqlx::Error> {
        let row: (i64,) = sqlx::query_as(
            r#"
            INSERT INTO platform.events
                (event_id, event_type, source_service, aggregate_id, payload)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(&event.event_type)
        .bind(&self.source_service)
        .bind(event.aggregate_id)
        .bind(&event.payload)
        .fetch_one(&mut **tx)
        .await?;

        tracing::info!(
            event_type = %event.event_type,
            source = %self.source_service,
            id = row.0,
            "published platform event (in-tx)"
        );

        Ok(row.0)
    }

    /// Start consuming events, blocking the current task indefinitely.
    ///
    /// ## Startup sequence
    /// 1. Upsert a row in `platform.event_consumers` for `consumer_name`.
    /// 2. Fetch all events with `id > last_event_id` in order (catch-up).
    /// 3. Connect a [`sqlx::postgres::PgListener`] on `platform_events`.
    /// 4. For each notification, fetch the full row from `platform.events` and
    ///    call `handler`.
    /// 5. After every successful handler call, advance the consumer cursor.
    ///
    /// Events whose `source_service` matches `self.source_service` are skipped
    /// so a service does not process its own events.
    ///
    /// The `handler` receives an owned [`PlatformEvent`] and must return a
    /// `Future<Output = Result<(), E>>` where `E: std::error::Error + Send + Sync`.
    pub async fn listen<F, Fut, E>(
        &self,
        consumer_name: &str,
        handler: F,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>>
    where
        F: Fn(PlatformEvent) -> Fut + Send + Sync,
        Fut: std::future::Future<Output = Result<(), E>> + Send,
        E: std::error::Error + Send + Sync + 'static,
    {
        // 1. Ensure consumer cursor row exists (INSERT … ON CONFLICT DO NOTHING)
        sqlx::query(
            r#"
            INSERT INTO platform.event_consumers (consumer_name, last_event_id)
            VALUES ($1, 0)
            ON CONFLICT (consumer_name) DO NOTHING
            "#,
        )
        .bind(consumer_name)
        .execute(&self.pool)
        .await?;

        // 2. Load current cursor
        let cursor: i64 = sqlx::query_scalar(
            "SELECT last_event_id FROM platform.event_consumers WHERE consumer_name = $1",
        )
        .bind(consumer_name)
        .fetch_one(&self.pool)
        .await?;

        tracing::info!(
            consumer = consumer_name,
            cursor,
            service = %self.source_service,
            "starting event consumer, catching up from cursor"
        );

        // 3. Catch-up: fetch missed events in order
        let mut last_id = cursor;
        let missed: Vec<PlatformEventRow> = sqlx::query_as(
            r#"
            SELECT id, event_id, event_type, source_service, aggregate_id,
                   payload, created_at
            FROM platform.events
            WHERE id > $1
            ORDER BY id ASC
            "#,
        )
        .bind(last_id)
        .fetch_all(&self.pool)
        .await?;

        for row in missed {
            let event: PlatformEvent = row.into();
            if event.source_service == self.source_service {
                last_id = event.id;
                continue; // skip own events
            }
            tracing::info!(
                consumer = consumer_name,
                event_id = %event.event_id,
                event_type = %event.event_type,
                "catch-up event"
            );
            if let Err(e) = handler(event.clone()).await {
                tracing::error!(
                    consumer = consumer_name,
                    event_id = %event.event_id,
                    error = %e,
                    "handler error during catch-up"
                );
            }
            last_id = event.id;
            self.advance_cursor(consumer_name, last_id).await?;
        }

        tracing::info!(
            consumer = consumer_name,
            cursor = last_id,
            "catch-up complete, switching to LISTEN mode"
        );

        // 4. Connect PgListener
        let mut pg_listener = sqlx::postgres::PgListener::connect_with(&self.pool).await?;
        pg_listener.listen("platform_events").await?;

        // 5. Live loop
        loop {
            match pg_listener.recv().await {
                Ok(notification) => {
                    // The notification payload is the event id as a string
                    let event_id_str = notification.payload();
                    let notified_id: i64 = match event_id_str.parse() {
                        Ok(id) => id,
                        Err(_) => {
                            tracing::error!(
                                payload = event_id_str,
                                "could not parse event id from pg_notify payload"
                            );
                            continue;
                        },
                    };

                    // Skip if we already processed this id during catch-up
                    if notified_id <= last_id {
                        continue;
                    }

                    // Fetch the full event row
                    let maybe_row: Option<PlatformEventRow> = sqlx::query_as(
                        r#"
                            SELECT id, event_id, event_type, source_service,
                                   aggregate_id, payload, created_at
                            FROM platform.events
                            WHERE id = $1
                            "#,
                    )
                    .bind(notified_id)
                    .fetch_optional(&self.pool)
                    .await
                    .unwrap_or(None);

                    let event: PlatformEvent = match maybe_row {
                        Some(row) => row.into(),
                        None => {
                            tracing::error!(id = notified_id, "notified event not found in DB");
                            continue;
                        },
                    };

                    // Skip self-originated events
                    if event.source_service == self.source_service {
                        last_id = event.id;
                        self.advance_cursor(consumer_name, last_id).await.ok();
                        continue;
                    }

                    tracing::info!(
                        consumer = consumer_name,
                        event_id = %event.event_id,
                        event_type = %event.event_type,
                        "received live event"
                    );

                    if let Err(e) = handler(event.clone()).await {
                        tracing::error!(
                            consumer = consumer_name,
                            event_id = %event.event_id,
                            error = %e,
                            "handler error for live event"
                        );
                    }

                    last_id = event.id;
                    self.advance_cursor(consumer_name, last_id).await.ok();
                },
                Err(e) => {
                    tracing::error!(
                        consumer = consumer_name,
                        error = %e,
                        "PgListener recv error, reconnecting in 1s"
                    );
                    tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                    // PgListener reconnects automatically on next recv()
                },
            }
        }
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    /// Advance the consumer cursor to `event_id` in `platform.event_consumers`.
    async fn advance_cursor(&self, consumer_name: &str, event_id: i64) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"
            INSERT INTO platform.event_consumers (consumer_name, last_event_id)
            VALUES ($1, $2)
            ON CONFLICT (consumer_name)
            DO UPDATE SET last_event_id = EXCLUDED.last_event_id,
                          updated_at    = NOW()
            "#,
        )
        .bind(consumer_name)
        .bind(event_id)
        .execute(&self.pool)
        .await?;
        Ok(())
    }
}
