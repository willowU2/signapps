//! Shared state injected into every handler.

use signapps_cache::CacheService;
use signapps_common::middleware::AuthState;
use signapps_common::JwtConfig;
use signapps_feature_flags::repository::PgFeatureFlagRepository;
use sqlx::PgPool;
use std::sync::Arc;

/// Injected into Axum handlers via `State<AppState>`.
#[derive(Clone)]
pub struct AppState {
    /// Shared PG pool.
    pub pool: PgPool,
    /// Shared in-process cache (Phase 3a POC: NOT shared with the proxy).
    pub cache: Arc<CacheService>,
    /// JWT verification config (used by auth middleware, Task P3a.7).
    pub jwt: JwtConfig,
    /// Feature flag repository + cache.
    pub feature_flags: PgFeatureFlagRepository,
}

impl AuthState for AppState {
    fn jwt_config(&self) -> &JwtConfig {
        &self.jwt
    }
}
