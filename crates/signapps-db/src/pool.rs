//! Database connection pool wrapper.

use sqlx::{Pool, Postgres, PgPool};
use std::ops::Deref;

/// Wrapper around the SQLx connection pool.
#[derive(Clone)]
pub struct DatabasePool {
    pool: Pool<Postgres>,
}

impl DatabasePool {
    /// Create a new database pool wrapper.
    pub fn new(pool: Pool<Postgres>) -> Self {
        Self { pool }
    }

    /// Get a reference to the inner pool.
    pub fn inner(&self) -> &Pool<Postgres> {
        &self.pool
    }

    /// Check if the database is reachable.
    pub async fn health_check(&self) -> Result<(), sqlx::Error> {
        sqlx::query("SELECT 1")
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}

/// Allow DatabasePool to be used as &PgPool directly.
impl Deref for DatabasePool {
    type Target = PgPool;

    fn deref(&self) -> &Self::Target {
        &self.pool
    }
}
