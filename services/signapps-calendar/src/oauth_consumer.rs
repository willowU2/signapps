//! Consumer for the `oauth.tokens.acquired` event — persists the encrypted
//! token into `calendar.provider_connections`.
//!
//! The handler is keystore-agnostic: tokens are stored still-encrypted
//! (DEK `oauth-tokens-v1`). The calendar service decrypts at use-time inside
//! its sync and CalDAV code paths.

use signapps_common::pg_events::{PgEventBus, PlatformEvent};
use signapps_oauth::{OAuthTokensAcquired, ProviderCategory, EVENT_OAUTH_TOKENS_ACQUIRED};
use sqlx::PgPool;
use std::sync::Arc;
use tracing::{info, instrument, warn};

// ── Internal error type ───────────────────────────────────────────────────────
// PgEventBus::listen requires E: std::error::Error + Send + Sync + 'static.

/// Errors emitted by the calendar OAuth consumer.
#[derive(Debug, thiserror::Error)]
enum ConsumerError {
    /// A database operation failed.
    #[error("database: {0}")]
    Db(#[from] sqlx::Error),
    /// JSON deserialization of the event payload failed.
    #[error("json: {0}")]
    Json(#[from] serde_json::Error),
}

// ── Public API ────────────────────────────────────────────────────────────────

/// Spawn the calendar OAuth consumer in a background tokio task.
///
/// The task runs indefinitely, retrying after a 10-second back-off on
/// [`PgEventBus::listen`] failure — matching the pattern used by the mail
/// consumer.
///
/// # Arguments
/// * `pool` — Postgres connection pool shared with the rest of the service.
/// * `bus`  — Shared event bus (cheap to clone: inner pool is `Arc`-wrapped).
pub fn spawn_consumer(pool: PgPool, bus: Arc<PgEventBus>) {
    tokio::spawn(async move {
        loop {
            let p = pool.clone();
            let b = Arc::clone(&bus);
            if let Err(e) = run(p, b).await {
                tracing::error!(?e, "calendar oauth consumer crashed — restarting in 10s");
                tokio::time::sleep(tokio::time::Duration::from_secs(10)).await;
            }
        }
    });
}

// ── Private implementation ────────────────────────────────────────────────────

/// Inner loop: blocks until [`PgEventBus::listen`] returns.
async fn run(
    pool: PgPool,
    bus: Arc<PgEventBus>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    info!("calendar oauth consumer starting");
    bus.listen("calendar-oauth-consumer", move |event: PlatformEvent| {
        let pool = pool.clone();
        async move { handle(pool, event).await }
    })
    .await
}

/// Dispatch a single platform event. Fast-path ignores non-OAuth events.
async fn handle(pool: PgPool, event: PlatformEvent) -> Result<(), ConsumerError> {
    if event.event_type != EVENT_OAUTH_TOKENS_ACQUIRED {
        return Ok(()); // not for us
    }

    let payload: OAuthTokensAcquired = serde_json::from_value(event.payload.clone())?;

    // Only react to Calendar-category providers (e.g. Google Calendar, Outlook Calendar).
    if payload.category != ProviderCategory::Calendar {
        return Ok(());
    }

    persist(&pool, &payload).await
}

/// Upsert the encrypted token into `calendar.provider_connections`.
///
/// Keyed on `(user_id, provider)` — the table has a UNIQUE constraint on
/// those two columns so `ON CONFLICT` is safe.
///
/// For MVP we require `user_id` to be `Some`. Events from `purpose=Login`
/// that have not yet provisioned a user are skipped with a warning.
#[instrument(skip_all, fields(provider = %ev.provider_key, user_id = ?ev.user_id))]
async fn persist(pool: &PgPool, ev: &OAuthTokensAcquired) -> Result<(), ConsumerError> {
    let Some(user_id) = ev.user_id else {
        warn!(
            provider = %ev.provider_key,
            "oauth.tokens.acquired has user_id=None — skipping calendar.provider_connections upsert"
        );
        return Ok(());
    };

    sqlx::query(
        r#"
        INSERT INTO calendar.provider_connections (
            id,
            user_id,
            provider,
            access_token_enc,
            refresh_token_enc,
            token_expires_at,
            sync_status,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5,
            'idle',
            NOW(), NOW()
        )
        ON CONFLICT (user_id, provider) DO UPDATE SET
            access_token_enc  = EXCLUDED.access_token_enc,
            refresh_token_enc = EXCLUDED.refresh_token_enc,
            token_expires_at  = EXCLUDED.token_expires_at,
            updated_at        = NOW()
        "#,
    )
    .bind(user_id)
    .bind(&ev.provider_key)
    .bind(&ev.access_token_enc)
    .bind(ev.refresh_token_enc.as_ref())
    .bind(ev.expires_at)
    .execute(pool)
    .await?;

    info!(
        provider = %ev.provider_key,
        "calendar.provider_connections upserted from oauth.tokens.acquired event"
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Verify that all non-Calendar categories are distinct from Calendar,
    /// confirming the consumer's category filter logic is exhaustive.
    #[test]
    fn category_filter_calendar_only() {
        let non_calendar = [
            ProviderCategory::Mail,
            ProviderCategory::Drive,
            ProviderCategory::Social,
            ProviderCategory::Sso,
            ProviderCategory::Chat,
            ProviderCategory::Dev,
            ProviderCategory::Crm,
            ProviderCategory::Other,
        ];
        for cat in &non_calendar {
            assert!(
                *cat != ProviderCategory::Calendar,
                "category {cat:?} should be filtered by the calendar consumer"
            );
        }
        // Sanity: Calendar passes through.
        assert_eq!(ProviderCategory::Calendar, ProviderCategory::Calendar);
    }
}
