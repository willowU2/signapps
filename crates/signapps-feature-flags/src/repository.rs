//! PostgreSQL repository for `feature_flags`.
//!
//! All writes invalidate the corresponding cache entry before returning so
//! callers see consistent data within the TTL window.

use crate::cache::FeatureFlagCache;
use crate::types::FeatureFlag;
use anyhow::Result;
use sqlx::PgPool;
use uuid::Uuid;

/// Combined persistence + cache wrapper for feature flags.
#[derive(Clone)]
pub struct PgFeatureFlagRepository {
    pool: PgPool,
    cache: FeatureFlagCache,
}

impl PgFeatureFlagRepository {
    /// Build a new repository from a pool and a cache wrapper.
    pub fn new(pool: PgPool, cache: FeatureFlagCache) -> Self {
        Self { pool, cache }
    }

    /// Fetch a single flag by (key, env). Checks the cache first; on miss,
    /// queries Postgres and populates the cache.
    ///
    /// # Errors
    ///
    /// Returns an error on DB failure.
    pub async fn get(&self, key: &str, env: &str) -> Result<Option<FeatureFlag>> {
        if let Some(flag) = self.cache.get(key, env).await {
            return Ok(Some(flag));
        }
        let row: Option<FeatureFlag> = sqlx::query_as(
            "SELECT id, key, env, enabled, rollout_percent, target_orgs, \
             target_users, description, created_by, created_at, updated_at \
             FROM feature_flags WHERE key = $1 AND env = $2",
        )
        .bind(key)
        .bind(env)
        .fetch_optional(&self.pool)
        .await?;
        if let Some(ref f) = row {
            self.cache.put(f).await.ok();
        }
        Ok(row)
    }

    /// List flags, optionally filtered by env.
    ///
    /// # Errors
    ///
    /// Returns an error on DB failure.
    pub async fn list(&self, env: Option<&str>) -> Result<Vec<FeatureFlag>> {
        let rows: Vec<FeatureFlag> = match env {
            Some(e) => {
                sqlx::query_as(
                    "SELECT id, key, env, enabled, rollout_percent, target_orgs, \
                 target_users, description, created_by, created_at, updated_at \
                 FROM feature_flags WHERE env = $1 ORDER BY key",
                )
                .bind(e)
                .fetch_all(&self.pool)
                .await?
            },
            None => {
                sqlx::query_as(
                    "SELECT id, key, env, enabled, rollout_percent, target_orgs, \
                 target_users, description, created_by, created_at, updated_at \
                 FROM feature_flags ORDER BY key, env",
                )
                .fetch_all(&self.pool)
                .await?
            },
        };
        Ok(rows)
    }

    /// Insert or update a flag (by `(key, env)` unique constraint) and
    /// invalidate the cache entry.
    ///
    /// # Errors
    ///
    /// Returns an error on DB failure.
    #[allow(clippy::too_many_arguments)] // mirrors the table columns
    pub async fn upsert(
        &self,
        key: &str,
        env: &str,
        enabled: bool,
        rollout_percent: i32,
        target_orgs: &[Uuid],
        target_users: &[Uuid],
        description: Option<&str>,
        actor_id: Option<Uuid>,
    ) -> Result<FeatureFlag> {
        let row: FeatureFlag = sqlx::query_as(
            "INSERT INTO feature_flags \
               (key, env, enabled, rollout_percent, target_orgs, target_users, description, created_by) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) \
             ON CONFLICT (key, env) DO UPDATE SET \
               enabled = EXCLUDED.enabled, \
               rollout_percent = EXCLUDED.rollout_percent, \
               target_orgs = EXCLUDED.target_orgs, \
               target_users = EXCLUDED.target_users, \
               description = EXCLUDED.description, \
               updated_at = now() \
             RETURNING id, key, env, enabled, rollout_percent, target_orgs, \
                       target_users, description, created_by, created_at, updated_at",
        )
        .bind(key)
        .bind(env)
        .bind(enabled)
        .bind(rollout_percent)
        .bind(target_orgs)
        .bind(target_users)
        .bind(description)
        .bind(actor_id)
        .fetch_one(&self.pool)
        .await?;
        self.cache.invalidate(key, env).await;
        Ok(row)
    }

    /// Delete a flag by (key, env). Returns `true` if a row was deleted.
    ///
    /// # Errors
    ///
    /// Returns an error on DB failure.
    pub async fn delete(&self, key: &str, env: &str) -> Result<bool> {
        let result = sqlx::query("DELETE FROM feature_flags WHERE key = $1 AND env = $2")
            .bind(key)
            .bind(env)
            .execute(&self.pool)
            .await?;
        self.cache.invalidate(key, env).await;
        Ok(result.rows_affected() > 0)
    }
}
