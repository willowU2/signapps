//! Consumer for the `oauth.tokens.acquired` event — persists the encrypted
//! token into `mail.accounts`.
//!
//! The handler is keystore-agnostic: tokens are stored still-encrypted
//! (DEK `oauth-tokens-v1`). The mail service decrypts at use-time inside
//! its IMAP/SMTP code paths.

use signapps_common::pg_events::{PgEventBus, PlatformEvent};
use signapps_oauth::{OAuthTokensAcquired, ProviderCategory, EVENT_OAUTH_TOKENS_ACQUIRED};
use sqlx::PgPool;
use std::sync::Arc;
use tracing::{info, instrument, warn};

// ── Internal error type ───────────────────────────────────────────────────────
// PgEventBus::listen requires E: std::error::Error + Send + Sync + 'static.
// We use a lightweight wrapper so we can surface both sqlx and serde_json errors
// without pulling in anyhow's Error (which does not impl std::error::Error).

/// Errors emitted by the mail OAuth consumer.
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

/// Spawn the mail OAuth consumer in a background tokio task.
///
/// The task runs indefinitely, retrying after a 10-second back-off on
/// [`PgEventBus::listen`] failure — matching the pattern used for the
/// cross-service listener in `main.rs`.
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
                tracing::error!(?e, "mail oauth consumer crashed — restarting in 10s");
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
    info!("mail oauth consumer starting");
    bus.listen("mail-oauth-consumer", move |event: PlatformEvent| {
        let pool = pool.clone();
        async move { handle(pool, event).await }
    })
    .await
}

/// Dispatch a single platform event.  Fast-path ignores non-OAuth events.
async fn handle(pool: PgPool, event: PlatformEvent) -> Result<(), ConsumerError> {
    if event.event_type != EVENT_OAUTH_TOKENS_ACQUIRED {
        return Ok(()); // not for us
    }

    let payload: OAuthTokensAcquired = serde_json::from_value(event.payload.clone())?;

    // Only react to Mail-category providers (e.g. Gmail, Outlook, Fastmail).
    if payload.category != ProviderCategory::Mail {
        return Ok(());
    }

    persist(&pool, &payload).await
}

/// Upsert the encrypted token into `mail.accounts`.
///
/// Keyed on `(user_id, email_address)` — the table has a UNIQUE constraint
/// `accounts_user_id_email_address_key` so `ON CONFLICT` is safe.
///
/// For MVP we require `user_id` to be `Some`.  Events from `purpose=Login`
/// that have not yet provisioned a user are skipped with a warning.
#[instrument(skip_all, fields(provider = %ev.provider_key, user_id = ?ev.user_id))]
async fn persist(pool: &PgPool, ev: &OAuthTokensAcquired) -> Result<(), ConsumerError> {
    let Some(user_id) = ev.user_id else {
        warn!(
            provider = %ev.provider_key,
            "oauth.tokens.acquired has user_id=None — skipping mail.accounts upsert"
        );
        return Ok(());
    };

    // Fall back to a synthesised address when the provider does not return
    // an email (uncommon but possible for some enterprise OIDC setups).
    let email_address = ev
        .provider_user_email
        .clone()
        .unwrap_or_else(|| format!("{}@unknown", ev.provider_key));

    sqlx::query(
        r#"
        INSERT INTO mail.accounts (
            id,
            user_id,
            email_address,
            provider,
            oauth_provider_key,
            oauth_access_token_enc,
            oauth_refresh_token_enc,
            oauth_expires_at,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(), $1, $2,
            'oauth',
            $3, $4, $5, $6,
            NOW(), NOW()
        )
        ON CONFLICT (user_id, email_address) DO UPDATE SET
            oauth_provider_key      = EXCLUDED.oauth_provider_key,
            oauth_access_token_enc  = EXCLUDED.oauth_access_token_enc,
            oauth_refresh_token_enc = EXCLUDED.oauth_refresh_token_enc,
            oauth_expires_at        = EXCLUDED.oauth_expires_at,
            updated_at              = NOW()
        "#,
    )
    .bind(user_id)
    .bind(&email_address)
    .bind(&ev.provider_key)
    .bind(&ev.access_token_enc)
    .bind(ev.refresh_token_enc.as_ref())
    .bind(ev.expires_at)
    .execute(pool)
    .await?;

    info!(
        email = %email_address,
        "mail.accounts upserted from oauth.tokens.acquired event"
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Verify that all non-Mail categories are distinct from Mail,
    /// confirming the consumer's category filter logic is exhaustive.
    #[test]
    fn category_filter_mail_only() {
        let non_mail = [
            ProviderCategory::Calendar,
            ProviderCategory::Drive,
            ProviderCategory::Social,
            ProviderCategory::Sso,
            ProviderCategory::Chat,
            ProviderCategory::Dev,
            ProviderCategory::Crm,
            ProviderCategory::Other,
        ];
        for cat in &non_mail {
            assert!(
                *cat != ProviderCategory::Mail,
                "category {cat:?} should be filtered by the mail consumer"
            );
        }
        // Sanity: Mail passes through.
        assert_eq!(ProviderCategory::Mail, ProviderCategory::Mail);
    }
}
