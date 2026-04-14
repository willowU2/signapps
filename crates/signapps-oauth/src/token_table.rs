//! Generic abstraction over per-service token tables.
//!
//! The refresh job uses this trait to load + update tokens without
//! hardcoding 3 separate code paths. Adding a 4th service that holds
//! tokens = implementing `TokenTable` + registering its concrete type
//! in the dispatch table at `OAuthRefreshJob::resolve_table`.

use crate::error::OAuthError;
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

/// Encrypted (access_token_enc, refresh_token_enc) pair plus expiry.
#[derive(Debug, Clone)]
pub struct EncryptedTokens {
    /// AES-GCM ciphertext of the access token.
    pub access_token_enc: Vec<u8>,
    /// AES-GCM ciphertext of the refresh token.
    pub refresh_token_enc: Vec<u8>,
    /// When the access token expires.
    pub expires_at: Option<DateTime<Utc>>,
}

/// Trait implemented by per-service token tables.
///
/// Each concrete type knows the schema-qualified table name and the
/// exact column names used by that service. The refresh job calls
/// `load` to decrypt inputs and `update` to persist refreshed tokens.
///
/// # Examples
///
/// ```ignore
/// let table = MailAccountsTable;
/// let tokens = table.load(&pool, account_id).await?;
/// table.update(&pool, account_id, &new_access, &new_refresh, new_expiry).await?;
/// ```
#[async_trait]
pub trait TokenTable: Send + Sync {
    /// Schema-qualified table name (e.g., `"mail.accounts"`).
    fn name(&self) -> &'static str;

    /// Load (access, refresh) ciphertexts for a row.
    ///
    /// # Errors
    ///
    /// Returns [`OAuthError::Database`] on connection / query failures.
    /// Returns [`OAuthError::MissingParameter`] if the row has no
    /// `refresh_token_enc` (cannot refresh without it).
    async fn load(&self, pool: &PgPool, id: Uuid) -> Result<EncryptedTokens, OAuthError>;

    /// Update access + refresh + expiry after a successful refresh.
    ///
    /// # Errors
    ///
    /// Returns [`OAuthError::Database`] on failure.
    async fn update(
        &self,
        pool: &PgPool,
        id: Uuid,
        access_enc: &[u8],
        refresh_enc: &[u8],
        expires_at: DateTime<Utc>,
    ) -> Result<(), OAuthError>;
}

// ── Concrete impls ──────────────────────────────────────────────────────────

/// `mail.accounts` — columns: `oauth_access_token_enc`, `oauth_refresh_token_enc`,
/// `oauth_expires_at`.
pub struct MailAccountsTable;

#[async_trait]
impl TokenTable for MailAccountsTable {
    fn name(&self) -> &'static str {
        "mail.accounts"
    }

    async fn load(&self, pool: &PgPool, id: Uuid) -> Result<EncryptedTokens, OAuthError> {
        let row = sqlx::query_as::<_, (Option<Vec<u8>>, Option<Vec<u8>>, Option<DateTime<Utc>>)>(
            "SELECT oauth_access_token_enc, oauth_refresh_token_enc, oauth_expires_at \
             FROM mail.accounts WHERE id = $1",
        )
        .bind(id)
        .fetch_one(pool)
        .await
        .map_err(|e| OAuthError::Database(e.to_string()))?;

        let access = row
            .0
            .ok_or_else(|| OAuthError::MissingParameter("oauth_access_token_enc".into()))?;
        let refresh = row
            .1
            .ok_or_else(|| OAuthError::MissingParameter("oauth_refresh_token_enc".into()))?;
        Ok(EncryptedTokens {
            access_token_enc: access,
            refresh_token_enc: refresh,
            expires_at: row.2,
        })
    }

    async fn update(
        &self,
        pool: &PgPool,
        id: Uuid,
        access_enc: &[u8],
        refresh_enc: &[u8],
        expires_at: DateTime<Utc>,
    ) -> Result<(), OAuthError> {
        sqlx::query(
            "UPDATE mail.accounts \
             SET oauth_access_token_enc = $1, oauth_refresh_token_enc = $2, \
                 oauth_expires_at = $3, updated_at = NOW() \
             WHERE id = $4",
        )
        .bind(access_enc)
        .bind(refresh_enc)
        .bind(expires_at)
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| OAuthError::Database(e.to_string()))?;
        Ok(())
    }
}

/// `calendar.provider_connections` — columns: `access_token_enc`,
/// `refresh_token_enc`, `token_expires_at`.
pub struct CalendarConnectionsTable;

#[async_trait]
impl TokenTable for CalendarConnectionsTable {
    fn name(&self) -> &'static str {
        "calendar.provider_connections"
    }

    async fn load(&self, pool: &PgPool, id: Uuid) -> Result<EncryptedTokens, OAuthError> {
        let row = sqlx::query_as::<_, (Option<Vec<u8>>, Option<Vec<u8>>, Option<DateTime<Utc>>)>(
            "SELECT access_token_enc, refresh_token_enc, token_expires_at \
             FROM calendar.provider_connections WHERE id = $1",
        )
        .bind(id)
        .fetch_one(pool)
        .await
        .map_err(|e| OAuthError::Database(e.to_string()))?;

        let access = row
            .0
            .ok_or_else(|| OAuthError::MissingParameter("access_token_enc".into()))?;
        let refresh = row
            .1
            .ok_or_else(|| OAuthError::MissingParameter("refresh_token_enc".into()))?;
        Ok(EncryptedTokens {
            access_token_enc: access,
            refresh_token_enc: refresh,
            expires_at: row.2,
        })
    }

    async fn update(
        &self,
        pool: &PgPool,
        id: Uuid,
        access_enc: &[u8],
        refresh_enc: &[u8],
        expires_at: DateTime<Utc>,
    ) -> Result<(), OAuthError> {
        sqlx::query(
            "UPDATE calendar.provider_connections \
             SET access_token_enc = $1, refresh_token_enc = $2, \
                 token_expires_at = $3, updated_at = NOW() \
             WHERE id = $4",
        )
        .bind(access_enc)
        .bind(refresh_enc)
        .bind(expires_at)
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| OAuthError::Database(e.to_string()))?;
        Ok(())
    }
}

/// `social.accounts` — columns: `access_token_enc`, `refresh_token_enc`,
/// `token_expires_at`.
pub struct SocialAccountsTable;

#[async_trait]
impl TokenTable for SocialAccountsTable {
    fn name(&self) -> &'static str {
        "social.accounts"
    }

    async fn load(&self, pool: &PgPool, id: Uuid) -> Result<EncryptedTokens, OAuthError> {
        let row = sqlx::query_as::<_, (Option<Vec<u8>>, Option<Vec<u8>>, Option<DateTime<Utc>>)>(
            "SELECT access_token_enc, refresh_token_enc, token_expires_at \
             FROM social.accounts WHERE id = $1",
        )
        .bind(id)
        .fetch_one(pool)
        .await
        .map_err(|e| OAuthError::Database(e.to_string()))?;

        let access = row
            .0
            .ok_or_else(|| OAuthError::MissingParameter("access_token_enc".into()))?;
        let refresh = row
            .1
            .ok_or_else(|| OAuthError::MissingParameter("refresh_token_enc".into()))?;
        Ok(EncryptedTokens {
            access_token_enc: access,
            refresh_token_enc: refresh,
            expires_at: row.2,
        })
    }

    async fn update(
        &self,
        pool: &PgPool,
        id: Uuid,
        access_enc: &[u8],
        refresh_enc: &[u8],
        expires_at: DateTime<Utc>,
    ) -> Result<(), OAuthError> {
        sqlx::query(
            "UPDATE social.accounts \
             SET access_token_enc = $1, refresh_token_enc = $2, \
                 token_expires_at = $3, updated_at = NOW() \
             WHERE id = $4",
        )
        .bind(access_enc)
        .bind(refresh_enc)
        .bind(expires_at)
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| OAuthError::Database(e.to_string()))?;
        Ok(())
    }
}
