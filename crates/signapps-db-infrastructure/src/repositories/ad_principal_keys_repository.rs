//! Repository for Kerberos principal keys.

use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::ad_principal_keys::{AdPrincipalKey, CreatePrincipalKey};

/// Repository for `ad_principal_keys` table operations.
pub struct AdPrincipalKeysRepository;

impl AdPrincipalKeysRepository {
    /// Insert a new Kerberos key for a principal.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the INSERT fails (e.g., duplicate version/enc_type combo).
    pub async fn create(pool: &PgPool, input: CreatePrincipalKey) -> Result<AdPrincipalKey> {
        let key = sqlx::query_as::<_, AdPrincipalKey>(
            r#"
            INSERT INTO ad_principal_keys (
                domain_id, principal_name, principal_type,
                key_version, enc_type, key_data, salt, entity_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
            "#,
        )
        .bind(input.domain_id)
        .bind(&input.principal_name)
        .bind(&input.principal_type)
        .bind(input.key_version)
        .bind(input.enc_type)
        .bind(&input.key_data)
        .bind(&input.salt)
        .bind(input.entity_id)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(key)
    }

    /// Fetch the latest key for a given principal and encryption type.
    ///
    /// Returns the highest `key_version` for the specified `enc_type`.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the query fails.
    pub async fn get_key(
        pool: &PgPool,
        domain_id: Uuid,
        principal_name: &str,
        enc_type: i32,
    ) -> Result<Option<AdPrincipalKey>> {
        let key = sqlx::query_as::<_, AdPrincipalKey>(
            r#"
            SELECT * FROM ad_principal_keys
            WHERE domain_id = $1 AND principal_name = $2 AND enc_type = $3
            ORDER BY key_version DESC
            LIMIT 1
            "#,
        )
        .bind(domain_id)
        .bind(principal_name)
        .bind(enc_type)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(key)
    }

    /// Fetch the current key for each encryption type supported by a principal.
    ///
    /// Uses `DISTINCT ON (enc_type)` to return one row per encryption type,
    /// selecting the highest `key_version` for each.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the query fails.
    pub async fn get_all_keys(
        pool: &PgPool,
        domain_id: Uuid,
        principal_name: &str,
    ) -> Result<Vec<AdPrincipalKey>> {
        let keys = sqlx::query_as::<_, AdPrincipalKey>(
            r#"
            SELECT DISTINCT ON (enc_type) *
            FROM ad_principal_keys
            WHERE domain_id = $1 AND principal_name = $2
            ORDER BY enc_type, key_version DESC
            "#,
        )
        .bind(domain_id)
        .bind(principal_name)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(keys)
    }

    /// Delete all keys for a principal (e.g., on account deletion or password reset).
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` if the DELETE fails.
    pub async fn delete_keys(pool: &PgPool, domain_id: Uuid, principal_name: &str) -> Result<()> {
        sqlx::query("DELETE FROM ad_principal_keys WHERE domain_id = $1 AND principal_name = $2")
            .bind(domain_id)
            .bind(principal_name)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;

        Ok(())
    }
}
