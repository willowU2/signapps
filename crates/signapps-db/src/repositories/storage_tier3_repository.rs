use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::storage_tier3::Share;

pub struct StorageTier3Repository;

impl StorageTier3Repository {
    /// Create a new share link
    #[allow(clippy::too_many_arguments)]
    pub async fn create_share(
        pool: &PgPool,
        user_id: Uuid,
        bucket: &str,
        key: &str,
        token: &str,
        expires_at: Option<DateTime<Utc>>,
        password_hash: Option<String>,
        max_downloads: Option<i32>,
        access_type: &str,
    ) -> Result<Share, sqlx::Error> {
        sqlx::query_as::<_, Share>(
            r#"
            INSERT INTO storage.shares
                (id, bucket, key, token, created_by, expires_at, password_hash, max_downloads, access_type)
            VALUES
                ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING
                id, bucket, key, token, created_by, created_at,
                expires_at, password_hash, max_downloads, download_count,
                access_type, is_active
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(bucket)
        .bind(key)
        .bind(token)
        .bind(user_id)
        .bind(expires_at)
        .bind(password_hash)
        .bind(max_downloads)
        .bind(access_type)
        .fetch_one(pool)
        .await
    }

    /// Update an existing share
    pub async fn update_share(
        pool: &PgPool,
        share_id: Uuid,
        user_id: Uuid,
        expires_at: Option<DateTime<Utc>>,
        password_hash: Option<String>,
        max_downloads: Option<i32>,
        access_type: Option<String>,
        is_active: Option<bool>,
    ) -> Result<Share, sqlx::Error> {
        sqlx::query_as::<_, Share>(
            r#"
            UPDATE storage.shares
            SET
                expires_at     = COALESCE($3, expires_at),
                password_hash  = COALESCE($4, password_hash),
                max_downloads  = COALESCE($5, max_downloads),
                access_type    = COALESCE($6, access_type),
                is_active      = COALESCE($7, is_active)
            WHERE id = $1 AND created_by = $2
            RETURNING
                id, bucket, key, token, created_by, created_at,
                expires_at, password_hash, max_downloads, download_count,
                access_type, is_active
            "#,
        )
        .bind(share_id)
        .bind(user_id)
        .bind(expires_at)
        .bind(password_hash)
        .bind(max_downloads)
        .bind(access_type)
        .bind(is_active)
        .fetch_one(pool)
        .await
    }

    /// List all shares for a specific user, with optional filters
    pub async fn list_shares(
        pool: &PgPool,
        user_id: Uuid,
        bucket: Option<String>,
        key: Option<String>,
        active_only: bool,
    ) -> Result<Vec<Share>, sqlx::Error> {
        sqlx::query_as::<_, Share>(
            r#"
            SELECT
                id, bucket, key, token, created_by, created_at,
                expires_at, password_hash, max_downloads, download_count,
                access_type, is_active
            FROM storage.shares
            WHERE created_by = $1
              AND ($2::TEXT IS NULL OR bucket = $2)
              AND ($3::TEXT IS NULL OR key    = $3)
              AND (NOT $4 OR is_active = TRUE)
            ORDER BY created_at DESC
            "#,
        )
        .bind(user_id)
        .bind(bucket)
        .bind(key)
        .bind(active_only)
        .fetch_all(pool)
        .await
    }

    /// Get share details by ID (mostly for owners editing it)
    pub async fn get_share_by_id(pool: &PgPool, id: Uuid) -> Result<Share, sqlx::Error> {
        sqlx::query_as::<_, Share>(
            r#"
            SELECT
                id, bucket, key, token, created_by, created_at,
                expires_at, password_hash, max_downloads, download_count,
                access_type, is_active
            FROM storage.shares
            WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_one(pool)
        .await
    }

    /// Get share details by token (for public visitors)
    pub async fn get_share_by_token(pool: &PgPool, token: &str) -> Result<Share, sqlx::Error> {
        sqlx::query_as::<_, Share>(
            r#"
            SELECT
                id, bucket, key, token, created_by, created_at,
                expires_at, password_hash, max_downloads, download_count,
                access_type, is_active
            FROM storage.shares
            WHERE token = $1
            "#,
        )
        .bind(token)
        .fetch_one(pool)
        .await
    }

    /// Revoke/Delete a share entirely (only the owner can delete)
    pub async fn delete_share(pool: &PgPool, id: Uuid, user_id: Uuid) -> Result<u64, sqlx::Error> {
        let result = sqlx::query(
            r#"
            DELETE FROM storage.shares
            WHERE id = $1 AND created_by = $2
            "#,
        )
        .bind(id)
        .bind(user_id)
        .execute(pool)
        .await?;

        Ok(result.rows_affected())
    }

    /// Increment download count (called each time a public user downloads a file)
    pub async fn increment_download_count(pool: &PgPool, id: Uuid) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"
            UPDATE storage.shares
            SET download_count = download_count + 1
            WHERE id = $1
            "#,
        )
        .bind(id)
        .execute(pool)
        .await?;

        Ok(())
    }
}
