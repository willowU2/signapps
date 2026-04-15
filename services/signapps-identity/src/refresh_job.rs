//! Periodic OAuth token refresh job.
//!
//! Spawned as a tokio task at boot. Wakes every 5 minutes, processes a
//! batch of up to 200 tokens that expire within the next 15 minutes.
//! Parallelism bounded to 10 concurrent refreshes to avoid hammering
//! providers.

use crate::AppState;
use anyhow::Context;
use chrono::{DateTime, Utc};
use futures::stream::{FuturesUnordered, StreamExt};
use signapps_common::pg_events::NewEvent;
use signapps_keystore::{decrypt_string, encrypt_string};
use signapps_oauth::{
    try_refresh, CalendarConnectionsTable, MailAccountsTable, OAuthTokenInvalidated,
    RefreshOutcome, SocialAccountsTable, TokenTable, EVENT_OAUTH_TOKEN_INVALIDATED,
};
use sqlx::PgPool;
use std::time::Duration;
use tokio::time::{interval, MissedTickBehavior};
use tracing::{error, info, instrument, warn};
use uuid::Uuid;

const SCAN_INTERVAL: Duration = Duration::from_secs(300); // 5 min
const MAX_PARALLEL_REFRESHES: usize = 10;
const BATCH_SIZE: i64 = 200;

/// Spawn the OAuth refresh job as a background tokio task.
///
/// Wakes every 5 minutes and refreshes tokens expiring within 15 minutes.
pub fn spawn(state: AppState) {
    tokio::spawn(async move {
        info!("oauth refresh job starting (every {:?})", SCAN_INTERVAL);
        let mut tick = interval(SCAN_INTERVAL);
        tick.set_missed_tick_behavior(MissedTickBehavior::Skip);
        // Consume the first tick immediately (interval fires instantly on first call).
        tick.tick().await;
        loop {
            tick.tick().await;
            if let Err(e) = run_one_pass(&state).await {
                error!(?e, "oauth refresh pass failed (will retry next tick)");
            }
        }
    });
}

#[instrument(skip(state))]
async fn run_one_pass(state: &AppState) -> anyhow::Result<()> {
    let pool = state.pool.inner().clone();

    let rows: Vec<RefreshQueueRow> = sqlx::query_as(
        r#"
        SELECT id, source_table, source_id, tenant_id, user_id, provider_key, expires_at,
               consecutive_failures
        FROM identity.oauth_refresh_queue
        WHERE disabled = false
          AND consecutive_failures < 10
          AND expires_at < NOW() + INTERVAL '15 minutes'
          AND (last_refresh_attempt_at IS NULL
               OR last_refresh_attempt_at < NOW() - INTERVAL '2 minutes')
        ORDER BY expires_at ASC
        LIMIT $1
        "#,
    )
    .bind(BATCH_SIZE)
    .fetch_all(&pool)
    .await
    .context("scan oauth_refresh_queue")?;

    if rows.is_empty() {
        return Ok(());
    }
    info!(count = rows.len(), "refreshing tokens");

    // Bounded parallelism: at most MAX_PARALLEL_REFRESHES in flight at once.
    let mut in_flight: FuturesUnordered<_> = FuturesUnordered::new();

    for row in rows {
        // If we're at the limit, wait for one to complete before adding another.
        if in_flight.len() >= MAX_PARALLEL_REFRESHES {
            in_flight.next().await;
        }
        let state_clone = state.clone();
        let pool_clone = pool.clone();
        in_flight.push(tokio::spawn(async move {
            refresh_one(state_clone, pool_clone, row).await;
        }));
    }

    // Drain remaining futures.
    while in_flight.next().await.is_some() {}

    Ok(())
}

#[instrument(skip(state, pool, row), fields(provider = %row.provider_key, source_table = %row.source_table))]
async fn refresh_one(state: AppState, pool: PgPool, row: RefreshQueueRow) {
    let table_handle: Box<dyn TokenTable> = match row.source_table.as_str() {
        "mail.accounts" => Box::new(MailAccountsTable),
        "calendar.provider_connections" => Box::new(CalendarConnectionsTable),
        "social.accounts" => Box::new(SocialAccountsTable),
        other => {
            warn!(table = other, "unknown source_table — skipping");
            record_failure(&pool, row.id, "unknown source_table", false).await;
            return;
        },
    };

    let outcome = match attempt(&state, &pool, table_handle.as_ref(), &row).await {
        Ok(o) => o,
        Err(e) => RefreshOutcome::Transient {
            reason: format!("attempt setup error: {e:#}"),
        },
    };

    match outcome {
        RefreshOutcome::Refreshed(_tokens) => {
            // Tokens already persisted by attempt(); reset failure counter.
            let _ = sqlx::query(
                "UPDATE identity.oauth_refresh_queue \
                 SET last_refresh_attempt_at = NOW(), consecutive_failures = 0, \
                     last_error = NULL, updated_at = NOW() \
                 WHERE id = $1",
            )
            .bind(row.id)
            .execute(&pool)
            .await;
        },
        RefreshOutcome::Revoked {
            status,
            error,
            description,
        } => {
            let reason = format!("revoked: status={status} {error}: {description:?}");
            warn!(reason = %reason, "refresh token revoked — disabling");
            let _ = sqlx::query(
                "UPDATE identity.oauth_refresh_queue \
                 SET last_refresh_attempt_at = NOW(), disabled = true, last_error = $2, \
                     updated_at = NOW() \
                 WHERE id = $1",
            )
            .bind(row.id)
            .bind(&reason)
            .execute(&pool)
            .await;

            emit_invalidated(&state, &row, reason).await;
        },
        RefreshOutcome::Transient { reason } => {
            let now_disabled = (row.consecutive_failures + 1) >= 10;
            let _ = sqlx::query(
                "UPDATE identity.oauth_refresh_queue \
                 SET last_refresh_attempt_at = NOW(), \
                     consecutive_failures = consecutive_failures + 1, \
                     last_error = $2, \
                     disabled = $3, \
                     updated_at = NOW() \
                 WHERE id = $1",
            )
            .bind(row.id)
            .bind(&reason)
            .bind(now_disabled)
            .execute(&pool)
            .await;

            if now_disabled {
                warn!(reason = %reason, "10 consecutive failures — disabling");
                emit_invalidated(&state, &row, reason).await;
            }
        },
    }
}

/// Perform the actual refresh: load tokens → decrypt → HTTP call → encrypt + persist.
///
/// Returns the outcome so the caller can update the queue table accordingly.
async fn attempt(
    state: &AppState,
    pool: &PgPool,
    table: &dyn TokenTable,
    row: &RefreshQueueRow,
) -> Result<RefreshOutcome, anyhow::Error> {
    // 1. Load encrypted tokens from the source table.
    let enc = table
        .load(pool, row.source_id)
        .await
        .map_err(|e| anyhow::anyhow!("load tokens: {:?}", e))?;

    let dek = state.keystore.dek("oauth-tokens-v1");

    // 2. Decrypt the refresh token.
    let refresh_token =
        decrypt_string(&enc.refresh_token_enc, dek.as_ref()).context("decrypt refresh_token")?;

    // 3. Resolve the provider definition from the embedded catalog.
    let provider = state
        .oauth_engine_state
        .catalog
        .get(&row.provider_key)
        .map_err(|e| anyhow::anyhow!("catalog lookup {}: {:?}", row.provider_key, e))?;

    // 4. Load the tenant's client_id / client_secret from config store.
    let cfg = state
        .oauth_engine_state
        .configs
        .get(row.tenant_id, &row.provider_key)
        .await
        .map_err(|e| anyhow::anyhow!("config store: {:?}", e))?
        .with_context(|| {
            format!(
                "provider config not found: tenant={} provider={}",
                row.tenant_id, row.provider_key
            )
        })?;

    // 5. Decrypt client credentials.
    let creds = crate::handlers::oauth::creds::resolve_credentials(&cfg, &state.keystore)
        .map_err(|e| anyhow::anyhow!("resolve_credentials: {:?}", e))?;

    // 6. POST to the provider's token endpoint.
    let http = reqwest::Client::new();
    let outcome = try_refresh(
        &http,
        provider,
        &creds.client_id,
        &creds.client_secret,
        &refresh_token,
    )
    .await;

    // 7. On success, encrypt the new tokens and write them back to the source table.
    if let RefreshOutcome::Refreshed(ref tokens) = outcome {
        let access_enc =
            encrypt_string(&tokens.access_token, dek.as_ref()).context("encrypt access_token")?;

        let new_refresh_enc = if let Some(ref rt) = tokens.refresh_token {
            encrypt_string(rt, dek.as_ref()).context("encrypt new refresh_token")?
        } else {
            // Provider did not issue a new refresh token — keep the existing one.
            enc.refresh_token_enc.clone()
        };

        let new_expires_at = tokens
            .expires_in
            .map(|s| Utc::now() + chrono::Duration::seconds(s))
            .unwrap_or_else(|| Utc::now() + chrono::Duration::hours(1));

        table
            .update(
                pool,
                row.source_id,
                &access_enc,
                &new_refresh_enc,
                new_expires_at,
            )
            .await
            .map_err(|e| anyhow::anyhow!("update source table: {:?}", e))?;
    }

    Ok(outcome)
}

/// Emit an `oauth.tokens.invalidated` event to the platform event bus.
async fn emit_invalidated(state: &AppState, row: &RefreshQueueRow, reason: String) {
    let event = OAuthTokenInvalidated {
        user_id: row.user_id,
        tenant_id: row.tenant_id,
        provider_key: row.provider_key.clone(),
        source_table: row.source_table.clone(),
        source_id: row.source_id,
        reason,
    };
    match serde_json::to_value(&event) {
        Ok(payload) => {
            let _ = state
                .event_bus
                .publish(NewEvent {
                    event_type: EVENT_OAUTH_TOKEN_INVALIDATED.to_string(),
                    aggregate_id: Some(row.user_id),
                    payload,
                })
                .await;
        },
        Err(e) => {
            error!(?e, "failed to serialize OAuthTokenInvalidated event");
        },
    }
}

/// Write a failure record to the queue row without changing disabled status.
async fn record_failure(pool: &PgPool, id: Uuid, reason: &str, hard: bool) {
    let _ = sqlx::query(
        "UPDATE identity.oauth_refresh_queue \
         SET last_refresh_attempt_at = NOW(), \
             consecutive_failures = consecutive_failures + 1, \
             last_error = $2, \
             disabled = $3, \
             updated_at = NOW() \
         WHERE id = $1",
    )
    .bind(id)
    .bind(reason)
    .bind(hard)
    .execute(pool)
    .await;
}

/// A row from `identity.oauth_refresh_queue` as fetched by the scanner query.
#[derive(Debug, sqlx::FromRow)]
struct RefreshQueueRow {
    id: Uuid,
    source_table: String,
    source_id: Uuid,
    tenant_id: Uuid,
    user_id: Uuid,
    provider_key: String,
    #[allow(dead_code)]
    expires_at: DateTime<Utc>,
    consecutive_failures: i32,
}
