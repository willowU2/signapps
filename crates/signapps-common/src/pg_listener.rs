use serde::Deserialize;
use sqlx::PgPool;
use tokio::sync::broadcast;

#[derive(Debug, Clone, Deserialize)]
/// Represents a pg event.
pub struct PgEvent {
    pub table: Option<String>,
    pub action: Option<String>,
    pub id: Option<uuid::Uuid>,
    pub envelope_id: Option<uuid::Uuid>,
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
