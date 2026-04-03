//! Shared state for the mail server.
//!
//! [`MailServerState`] is shared across all listeners (HTTP, SMTP inbound,
//! SMTP submission, IMAP) via `Clone`. It bundles the database pool, JWT
//! configuration, AI indexer client, and the platform event bus.

use signapps_common::pg_events::PgEventBus;
use signapps_common::{AiIndexerClient, JwtConfig};
use sqlx::{Pool, Postgres};

/// Shared state for all mail server listeners.
///
/// This struct is cheaply cloneable (all inner types are `Arc`-backed) and is
/// passed to each spawned listener task. It provides access to the database,
/// authentication configuration, AI indexing, and the cross-service event bus.
///
/// # Examples
///
/// ```ignore
/// let state = MailServerState {
///     pool: pool.clone(),
///     jwt_config: jwt_config.clone(),
///     indexer: AiIndexerClient::from_env(),
///     event_bus: event_bus.clone(),
/// };
/// tokio::spawn(smtp::inbound::start(state.clone(), 25));
/// ```
#[derive(Clone)]
pub struct MailServerState {
    /// PostgreSQL connection pool.
    pub pool: Pool<Postgres>,
    /// JWT signing/validation configuration.
    pub jwt_config: JwtConfig,
    /// AI indexer client for email content indexing.
    pub indexer: AiIndexerClient,
    /// Cross-service event bus (PG LISTEN/NOTIFY).
    pub event_bus: PgEventBus,
}
