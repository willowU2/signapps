//! Vault Enterprise repositories.
//!
//! Seven repositories, one per vault domain object:
//! VaultKeysRepository, VaultItemRepository, VaultFolderRepository,
//! VaultShareRepository, VaultOrgKeyRepository, VaultBrowseRepository,
//! VaultAuditRepository.

use crate::models::vault::{
    CreateBrowseSession, CreateVaultFolder, CreateVaultItem, CreateVaultShare, UpdateVaultFolder,
    UpdateVaultItem, UpsertVaultOrgKey, UpsertVaultUserKeys, VaultAuditAction, VaultAuditLog,
    VaultBrowseSession, VaultFolder, VaultItem, VaultOrgKey, VaultShare, VaultUserKeys,
};
use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

// ---------------------------------------------------------------------------
// VaultKeysRepository
// ---------------------------------------------------------------------------

/// Repository for user encryption key bundles.
pub struct VaultKeysRepository;

impl VaultKeysRepository {
    /// Fetch the key bundle for a user, if initialised.
    pub async fn find_by_user(pool: &PgPool, user_id: Uuid) -> Result<Option<VaultUserKeys>> {
        sqlx::query_as::<_, VaultUserKeys>("SELECT * FROM vault.user_keys WHERE user_id = $1")
            .bind(user_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))
    }

    /// Insert or update the key bundle for a user (upsert).
    pub async fn upsert(
        pool: &PgPool,
        user_id: Uuid,
        req: UpsertVaultUserKeys,
    ) -> Result<VaultUserKeys> {
        sqlx::query_as::<_, VaultUserKeys>(
            r#"
            INSERT INTO vault.user_keys
                (user_id, encrypted_sym_key, encrypted_private_key, public_key,
                 kdf_type, kdf_iterations, has_master_password)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (user_id) DO UPDATE SET
                encrypted_sym_key     = EXCLUDED.encrypted_sym_key,
                encrypted_private_key = EXCLUDED.encrypted_private_key,
                public_key            = EXCLUDED.public_key,
                kdf_type              = EXCLUDED.kdf_type,
                kdf_iterations        = EXCLUDED.kdf_iterations,
                has_master_password   = EXCLUDED.has_master_password,
                updated_at            = NOW()
            RETURNING *
            "#,
        )
        .bind(user_id)
        .bind(&req.encrypted_sym_key)
        .bind(&req.encrypted_private_key)
        .bind(&req.public_key)
        .bind(&req.kdf_type)
        .bind(req.kdf_iterations)
        .bind(req.has_master_password)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }
}

// ---------------------------------------------------------------------------
// VaultFolderRepository
// ---------------------------------------------------------------------------

/// Repository for vault folders.
pub struct VaultFolderRepository;

impl VaultFolderRepository {
    /// List all folders owned by a user.
    pub async fn list(pool: &PgPool, owner_id: Uuid) -> Result<Vec<VaultFolder>> {
        sqlx::query_as::<_, VaultFolder>(
            "SELECT * FROM vault.folders WHERE owner_id = $1 ORDER BY created_at ASC",
        )
        .bind(owner_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// Find a folder by ID, checking ownership.
    pub async fn find(pool: &PgPool, id: Uuid, owner_id: Uuid) -> Result<Option<VaultFolder>> {
        sqlx::query_as::<_, VaultFolder>(
            "SELECT * FROM vault.folders WHERE id = $1 AND owner_id = $2",
        )
        .bind(id)
        .bind(owner_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// Create a new folder.
    pub async fn create(
        pool: &PgPool,
        owner_id: Uuid,
        req: CreateVaultFolder,
    ) -> Result<VaultFolder> {
        sqlx::query_as::<_, VaultFolder>(
            "INSERT INTO vault.folders (owner_id, name) VALUES ($1, $2) RETURNING *",
        )
        .bind(owner_id)
        .bind(&req.name)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// Rename a folder (owner-scoped).
    pub async fn update(
        pool: &PgPool,
        id: Uuid,
        owner_id: Uuid,
        req: UpdateVaultFolder,
    ) -> Result<Option<VaultFolder>> {
        sqlx::query_as::<_, VaultFolder>(
            "UPDATE vault.folders SET name = $1 WHERE id = $2 AND owner_id = $3 RETURNING *",
        )
        .bind(&req.name)
        .bind(id)
        .bind(owner_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// Delete a folder (owner-scoped). Items inside will have folder_id set to NULL.
    pub async fn delete(pool: &PgPool, id: Uuid, owner_id: Uuid) -> Result<bool> {
        let result = sqlx::query("DELETE FROM vault.folders WHERE id = $1 AND owner_id = $2")
            .bind(id)
            .bind(owner_id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;

        Ok(result.rows_affected() > 0)
    }
}

// ---------------------------------------------------------------------------
// VaultItemRepository
// ---------------------------------------------------------------------------

/// Repository for vault items.
pub struct VaultItemRepository;

impl VaultItemRepository {
    /// List all items owned by a user (excludes shared items — use share queries for those).
    pub async fn list(pool: &PgPool, owner_id: Uuid) -> Result<Vec<VaultItem>> {
        sqlx::query_as::<_, VaultItem>(
            "SELECT * FROM vault.items WHERE owner_id = $1 ORDER BY created_at DESC",
        )
        .bind(owner_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// Find an item by ID, checking ownership.
    pub async fn find(pool: &PgPool, id: Uuid, owner_id: Uuid) -> Result<Option<VaultItem>> {
        sqlx::query_as::<_, VaultItem>("SELECT * FROM vault.items WHERE id = $1 AND owner_id = $2")
            .bind(id)
            .bind(owner_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))
    }

    /// Find an item by ID without ownership check (used by share/browse flows).
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<VaultItem>> {
        sqlx::query_as::<_, VaultItem>("SELECT * FROM vault.items WHERE id = $1")
            .bind(id)
            .fetch_optional(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))
    }

    /// Create a new vault item.
    pub async fn create(pool: &PgPool, owner_id: Uuid, req: CreateVaultItem) -> Result<VaultItem> {
        sqlx::query_as::<_, VaultItem>(
            r#"
            INSERT INTO vault.items
                (owner_id, folder_id, item_type, name, data, notes, fields,
                 item_key, totp_secret, uri, favorite, reprompt)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
            RETURNING *
            "#,
        )
        .bind(owner_id)
        .bind(req.folder_id)
        .bind(&req.item_type)
        .bind(&req.name)
        .bind(&req.data)
        .bind(&req.notes)
        .bind(&req.fields)
        .bind(&req.item_key)
        .bind(&req.totp_secret)
        .bind(&req.uri)
        .bind(req.favorite.unwrap_or(false))
        .bind(req.reprompt.unwrap_or(false))
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// Update a vault item (owner-scoped, partial update).
    pub async fn update(
        pool: &PgPool,
        id: Uuid,
        owner_id: Uuid,
        req: UpdateVaultItem,
    ) -> Result<Option<VaultItem>> {
        sqlx::query_as::<_, VaultItem>(
            r#"
            UPDATE vault.items SET
                folder_id        = COALESCE($3, folder_id),
                name             = COALESCE($4, name),
                data             = COALESCE($5, data),
                notes            = COALESCE($6, notes),
                fields           = COALESCE($7, fields),
                item_key         = COALESCE($8, item_key),
                totp_secret      = COALESCE($9, totp_secret),
                password_history = COALESCE($10, password_history),
                uri              = COALESCE($11, uri),
                favorite         = COALESCE($12, favorite),
                reprompt         = COALESCE($13, reprompt)
            WHERE id = $1 AND owner_id = $2
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(owner_id)
        .bind(req.folder_id)
        .bind(&req.name)
        .bind(&req.data)
        .bind(&req.notes)
        .bind(&req.fields)
        .bind(&req.item_key)
        .bind(&req.totp_secret)
        .bind(&req.password_history)
        .bind(&req.uri)
        .bind(req.favorite)
        .bind(req.reprompt)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// Delete a vault item (owner-scoped).
    pub async fn delete(pool: &PgPool, id: Uuid, owner_id: Uuid) -> Result<bool> {
        let result = sqlx::query("DELETE FROM vault.items WHERE id = $1 AND owner_id = $2")
            .bind(id)
            .bind(owner_id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;

        Ok(result.rows_affected() > 0)
    }
}

// ---------------------------------------------------------------------------
// VaultShareRepository
// ---------------------------------------------------------------------------

/// Repository for vault shares.
pub struct VaultShareRepository;

impl VaultShareRepository {
    /// Create a share grant.
    pub async fn create(
        pool: &PgPool,
        granted_by: Uuid,
        req: CreateVaultShare,
    ) -> Result<VaultShare> {
        sqlx::query_as::<_, VaultShare>(
            r#"
            INSERT INTO vault.shares
                (item_id, share_type, grantee_id, access_level, encrypted_key, granted_by, expires_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7)
            RETURNING *
            "#,
        )
        .bind(req.item_id)
        .bind(&req.share_type)
        .bind(req.grantee_id)
        .bind(&req.access_level)
        .bind(&req.encrypted_key)
        .bind(granted_by)
        .bind(req.expires_at)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// Delete a share by ID (must be granted by the caller or item owner).
    pub async fn delete(pool: &PgPool, share_id: Uuid, actor_id: Uuid) -> Result<bool> {
        // Allow deletion by the grantor or by the item owner
        let result = sqlx::query(
            r#"
            DELETE FROM vault.shares s
            USING vault.items i
            WHERE s.id = $1
              AND i.id = s.item_id
              AND (s.granted_by = $2 OR i.owner_id = $2)
            "#,
        )
        .bind(share_id)
        .bind(actor_id)
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(result.rows_affected() > 0)
    }

    /// List shares for a specific item.
    pub async fn list_for_item(pool: &PgPool, item_id: Uuid) -> Result<Vec<VaultShare>> {
        sqlx::query_as::<_, VaultShare>(
            "SELECT * FROM vault.shares WHERE item_id = $1 ORDER BY created_at ASC",
        )
        .bind(item_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// List all items shared WITH the given user (as person or group member).
    pub async fn list_shared_with_user(pool: &PgPool, user_id: Uuid) -> Result<Vec<VaultShare>> {
        sqlx::query_as::<_, VaultShare>(
            r#"
            SELECT s.* FROM vault.shares s
            WHERE (s.share_type = 'person' AND s.grantee_id = $1)
               OR (s.share_type = 'group' AND s.grantee_id IN (
                       SELECT group_id FROM identity.group_members WHERE user_id = $1
                   ))
            ORDER BY s.created_at DESC
            "#,
        )
        .bind(user_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// Find a share by ID.
    pub async fn find_by_id(pool: &PgPool, share_id: Uuid) -> Result<Option<VaultShare>> {
        sqlx::query_as::<_, VaultShare>("SELECT * FROM vault.shares WHERE id = $1")
            .bind(share_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))
    }
}

// ---------------------------------------------------------------------------
// VaultOrgKeyRepository
// ---------------------------------------------------------------------------

/// Repository for org encryption keys.
pub struct VaultOrgKeyRepository;

impl VaultOrgKeyRepository {
    /// Upsert an org key for a group member.
    pub async fn upsert(pool: &PgPool, req: UpsertVaultOrgKey) -> Result<VaultOrgKey> {
        sqlx::query_as::<_, VaultOrgKey>(
            r#"
            INSERT INTO vault.org_keys (group_id, member_user_id, encrypted_org_key)
            VALUES ($1, $2, $3)
            ON CONFLICT (group_id, member_user_id) DO UPDATE SET
                encrypted_org_key = EXCLUDED.encrypted_org_key
            RETURNING *
            "#,
        )
        .bind(req.group_id)
        .bind(req.member_user_id)
        .bind(&req.encrypted_org_key)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// Fetch the org key for a specific group member.
    pub async fn find(
        pool: &PgPool,
        group_id: Uuid,
        member_user_id: Uuid,
    ) -> Result<Option<VaultOrgKey>> {
        sqlx::query_as::<_, VaultOrgKey>(
            "SELECT * FROM vault.org_keys WHERE group_id = $1 AND member_user_id = $2",
        )
        .bind(group_id)
        .bind(member_user_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// List all org keys for a group.
    pub async fn list_for_group(pool: &PgPool, group_id: Uuid) -> Result<Vec<VaultOrgKey>> {
        sqlx::query_as::<_, VaultOrgKey>(
            "SELECT * FROM vault.org_keys WHERE group_id = $1 ORDER BY created_at ASC",
        )
        .bind(group_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }
}

// ---------------------------------------------------------------------------
// VaultBrowseRepository
// ---------------------------------------------------------------------------

/// Repository for browse sessions (use_only proxy).
pub struct VaultBrowseRepository;

impl VaultBrowseRepository {
    /// Create a new browse session.
    pub async fn create(
        pool: &PgPool,
        user_id: Uuid,
        token: &str,
        req: CreateBrowseSession,
        expires_at: chrono::DateTime<chrono::Utc>,
    ) -> Result<VaultBrowseSession> {
        sqlx::query_as::<_, VaultBrowseSession>(
            r#"
            INSERT INTO vault.browse_sessions
                (token, item_id, user_id, target_url,
                 injected_username, injected_password, injected_totp_secret, expires_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
            RETURNING *
            "#,
        )
        .bind(token)
        .bind(req.item_id)
        .bind(user_id)
        .bind(&req.target_url)
        .bind(&req.injected_username)
        .bind(&req.injected_password)
        .bind(&req.injected_totp_secret)
        .bind(expires_at)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// Fetch a browse session by token (checks expiry in application layer).
    pub async fn find_by_token(pool: &PgPool, token: &str) -> Result<Option<VaultBrowseSession>> {
        sqlx::query_as::<_, VaultBrowseSession>(
            "SELECT * FROM vault.browse_sessions WHERE token = $1",
        )
        .bind(token)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// End (delete) a browse session by token.
    pub async fn delete_by_token(pool: &PgPool, token: &str, user_id: Uuid) -> Result<bool> {
        let result =
            sqlx::query("DELETE FROM vault.browse_sessions WHERE token = $1 AND user_id = $2")
                .bind(token)
                .bind(user_id)
                .execute(pool)
                .await
                .map_err(|e| Error::Database(e.to_string()))?;

        Ok(result.rows_affected() > 0)
    }

    /// Remove all expired sessions (meant to be called periodically).
    pub async fn purge_expired(pool: &PgPool) -> Result<u64> {
        let result = sqlx::query("DELETE FROM vault.browse_sessions WHERE expires_at < NOW()")
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;

        Ok(result.rows_affected())
    }
}

// ---------------------------------------------------------------------------
// VaultAuditRepository
// ---------------------------------------------------------------------------

/// Repository for the vault audit log.
pub struct VaultAuditRepository;

impl VaultAuditRepository {
    /// Append an audit entry (fire-and-forget friendly — returns Result for callers that care).
    pub async fn log(
        pool: &PgPool,
        item_id: Option<Uuid>,
        action: VaultAuditAction,
        actor_id: Uuid,
        actor_ip: Option<&str>,
        details: Option<serde_json::Value>,
    ) -> Result<VaultAuditLog> {
        sqlx::query_as::<_, VaultAuditLog>(
            r#"
            INSERT INTO vault.audit_log (item_id, action, actor_id, actor_ip, details)
            VALUES ($1, $2, $3, $4::INET, $5)
            RETURNING *
            "#,
        )
        .bind(item_id)
        .bind(&action)
        .bind(actor_id)
        .bind(actor_ip)
        .bind(details.unwrap_or(serde_json::json!({})))
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// List audit log entries for a specific item.
    pub async fn list_for_item(
        pool: &PgPool,
        item_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<VaultAuditLog>> {
        sqlx::query_as::<_, VaultAuditLog>(
            r#"
            SELECT * FROM vault.audit_log
            WHERE item_id = $1
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(item_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// List audit log entries for an actor.
    pub async fn list_for_actor(
        pool: &PgPool,
        actor_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<VaultAuditLog>> {
        sqlx::query_as::<_, VaultAuditLog>(
            r#"
            SELECT * FROM vault.audit_log
            WHERE actor_id = $1
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(actor_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }
}
