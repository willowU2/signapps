use chrono::{DateTime, Duration, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::storage_tier3::Share;

pub struct StorageTier3Repository;

impl StorageTier3Repository {
    /// Create a new share link
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
        sqlx::query_as!(
            Share,
            r#"
            INSERT INTO storage.shares 
            (bucket, key, token, created_by, expires_at, password_hash, max_downloads, access_type)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, bucket, key, token, created_by, created_at, expires_at, password_hash, max_downloads, download_count, access_type, is_active
            "#,
            bucket,
            key,
            token,
            user_id,
            expires_at,
            password_hash,
            max_downloads,
            access_type
        )
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
        let update_active = is_active.is_some();

        sqlx::query_as!(
            Share,
            r#"
            UPDATE storage.shares
            SET
                expires_at = COALESCE($1, expires_at),
                password_hash = COALESCE($2, password_hash),
                max_downloads = COALESCE($3, max_downloads),
                access_type = COALESCE($4, access_type),
                is_active = CASE WHEN $5 THEN $6 ELSE is_active END
            WHERE id = $7 AND created_by = $8
            RETURNING id, bucket, key, token, created_by, created_at, expires_at, password_hash, max_downloads, download_count, access_type, is_active
            "#,
            expires_at,
            password_hash,
            max_downloads,
            access_type,
            update_active,
            is_active.unwrap_or(true), // Only used if update_active is true
            share_id,
            user_id
        )
        .fetch_one(pool)
        .await
    }

    /// List all active shares for a specific user
    pub async fn list_shares(
        pool: &PgPool,
        user_id: Uuid,
        bucket: Option<String>,
        key: Option<String>,
        active_only: bool,
    ) -> Result<Vec<Share>, sqlx::Error> {
        let b = bucket.clone();
        let k = key.clone();

        sqlx::query_as!(
            Share,
            r#"
            SELECT id, bucket, key, token, created_by, created_at, expires_at, password_hash, max_downloads, download_count, access_type, is_active
            FROM storage.shares
            WHERE created_by = $1
              AND ($2::text IS NULL OR bucket = $2)
              AND ($3::text IS NULL OR key = $3)
              AND ($4 = FALSE OR (is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW())))
            ORDER BY created_at DESC
            "#,
            user_id,
            b,
            k,
            active_only
        )
        .fetch_all(pool)
        .await
    }

    /// Get share details by ID (mostly for owners editing it)
    pub async fn get_share_by_id(pool: &PgPool, id: Uuid) -> Result<Share, sqlx::Error> {
        sqlx::query_as!(
            Share,
            r#"
            SELECT id, bucket, key, token, created_by, created_at, expires_at, password_hash, max_downloads, download_count, access_type, is_active
            FROM storage.shares
            WHERE id = $1
            "#,
            id
        )
        .fetch_one(pool)
        .await
    }

    /// Get share details by token (for public visitors)
    pub async fn get_share_by_token(pool: &PgPool, token: &str) -> Result<Share, sqlx::Error> {
        sqlx::query_as!(
            Share,
            r#"
            SELECT id, bucket, key, token, created_by, created_at, expires_at, password_hash, max_downloads, download_count, access_type, is_active
            FROM storage.shares
            WHERE token = $1
            "#,
            token
        )
        .fetch_one(pool)
        .await
    }

    /// Revoke/Delete a share entirely
    pub async fn delete_share(pool: &PgPool, id: Uuid, user_id: Uuid) -> Result<u64, sqlx::Error> {
        let result = sqlx::query!(
            "DELETE FROM storage.shares WHERE id = $1 AND created_by = $2",
            id,
            user_id
        )
        .execute(pool)
        .await?;
        Ok(result.rows_affected())
    }

    /// Increment download count directly (for when a public user downloads)
    pub async fn increment_download_count(pool: &PgPool, id: Uuid) -> Result<(), sqlx::Error> {
        sqlx::query!(
            "UPDATE storage.shares SET download_count = download_count + 1 WHERE id = $1",
            id
        )
        .execute(pool)
        .await?;
        Ok(())
    }
}
