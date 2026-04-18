//! Shared, init-once resources for the single-binary runtime.
//!
//! Every service inside `signapps-platform` borrows an `Arc<SharedState>`
//! rather than constructing its own pool / keystore / tracing.
//!
//! # Errors
//!
//! [`SharedState::init_once`] returns an error when any of the underlying
//! subsystems fail to load (database connect, keystore unlock, env missing).
//!
//! # Panics
//!
//! Aucun panic possible — toutes les erreurs sont propagées via
//! `anyhow::Result`.

use std::sync::Arc;

use anyhow::{Context, Result};
use signapps_cache::CacheService;
use signapps_common::{bootstrap::load_env, pg_events::PgEventBus, JwtConfig};
use signapps_db::{create_pool, DatabasePool};
use signapps_keystore::{Keystore, KeystoreBackend};

/// Aggregate of every resource that must live for the lifetime of the
/// single-binary process. Constructed exactly once via
/// [`SharedState::init_once`].
#[derive(Clone)]
pub struct SharedState {
    /// Shared Postgres connection pool.
    pub pool: DatabasePool,
    /// Shared JWT config (HS256 or RS256 depending on env).
    pub jwt: Arc<JwtConfig>,
    /// Shared keystore used by every service that manipulates encrypted fields.
    pub keystore: Arc<Keystore>,
    /// Shared in-process cache (rate limiting, JWT blacklist, etc.).
    pub cache: Arc<CacheService>,
    /// Shared LISTEN/NOTIFY event bus, publishing as `signapps-platform`.
    pub event_bus: Arc<PgEventBus>,
}

impl SharedState {
    /// Load env, open the database pool, unlock the keystore, build JWT
    /// config and event bus. Safe to call at most once per process.
    ///
    /// # Errors
    ///
    /// Returns an `anyhow::Error` if any subsystem fails to load:
    /// - `DATABASE_URL` env var missing
    /// - Postgres pool creation fails (bad URL, DB down, auth error)
    /// - Keystore unlock fails (missing `KEYSTORE_MASTER_KEY`, bad hex)
    ///
    /// # Panics
    ///
    /// Aucun panic possible — toutes les erreurs sont propagées via
    /// `anyhow::Result`.
    ///
    /// # Examples
    ///
    /// ```no_run
    /// use signapps_service::shared_state::SharedState;
    ///
    /// # async fn demo() -> anyhow::Result<()> {
    /// let shared = SharedState::init_once().await?;
    /// let _pool = shared.pool.inner();
    /// # Ok(())
    /// # }
    /// ```
    pub async fn init_once() -> Result<Self> {
        load_env();

        let database_url = std::env::var("DATABASE_URL")
            .context("DATABASE_URL must be set for SharedState::init_once")?;
        let pool = create_pool(&database_url)
            .await
            .context("failed to create shared Postgres pool")?;

        let jwt = Arc::new(JwtConfig::from_env());

        let keystore = Arc::new(
            Keystore::init(KeystoreBackend::EnvVar)
                .await
                .context("failed to unlock shared keystore")?,
        );

        let cache = Arc::new(CacheService::new(
            50_000,
            std::time::Duration::from_secs(900),
        ));

        let event_bus = Arc::new(PgEventBus::new(
            pool.inner().clone(),
            "signapps-platform".to_string(),
        ));

        Ok(Self {
            pool,
            jwt,
            keystore,
            cache,
            event_bus,
        })
    }
}
