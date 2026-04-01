//! PostgreSQL NOTIFY listener — bridges `pg_notify` events into a Tokio broadcast channel.

use serde::Deserialize;
use sqlx::PgPool;
use tokio::sync::broadcast;

/// Deserialized payload from a PostgreSQL `NOTIFY` channel.
#[derive(Debug, Clone, Deserialize)]
pub struct PgEvent {
    /// Name of the database table that triggered the notification.
    pub table: Option<String>,
    /// DML action that caused the notification (e.g. `"INSERT"`, `"UPDATE"`).
    pub action: Option<String>,
    /// Primary-key UUID of the affected row.
    pub id: Option<uuid::Uuid>,
    /// Outbox envelope ID, used to correlate with the transactional outbox pattern.
    pub envelope_id: Option<uuid::Uuid>,
    /// Current processing status of the event (e.g. `"PENDING"`, `"COMPLETED"`).
    pub status: Option<String>,
}

/// Spawn a background task that listens to PostgreSQL NOTIFY channels
/// and forwards events to a broadcast sender.
pub async fn spawn_pg_listener(
    pool: &PgPool,
    channels: &[&str],
    tx: broadcast::Sender<PgEvent>,
) -> Result<(), sqlx::Error> {
    let mut listener = sqlx::postgres::PgListener::connect_with(pool).await?;
    for ch in channels {
        listener.listen(ch).await?;
    }
    tokio::spawn(async move {
        loop {
            match listener.recv().await {
                Ok(notification) => {
                    if let Ok(event) = serde_json::from_str::<PgEvent>(notification.payload()) {
                        let _ = tx.send(event);
                    }
                },
                Err(e) => {
                    tracing::error!("PgListener error: {e}");
                    tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                },
            }
        }
    });
    Ok(())
}
