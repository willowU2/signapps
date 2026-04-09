//! Vault Enterprise models.
//!
//! All sensitive fields (name, data, notes, etc.) are stored as BYTEA
//! containing client-side encrypted blobs. The server never sees plaintext.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Serde helper: deserialize a base64 string into `Vec<u8>` and serialize back.
mod base64_bytes {
    use base64::engine::{general_purpose::STANDARD, Engine};
    use serde::{self, Deserialize, Deserializer, Serializer};

    pub fn serialize<S>(bytes: &Vec<u8>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&STANDARD.encode(bytes))
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Vec<u8>, D::Error>
    where
        D: Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        STANDARD.decode(&s).map_err(serde::de::Error::custom)
    }
}

/// Optional variant of the base64 helper.
mod base64_bytes_opt {
    use base64::engine::{general_purpose::STANDARD, Engine};
    use serde::{self, Deserialize, Deserializer, Serializer};

    pub fn serialize<S>(bytes: &Option<Vec<u8>>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        match bytes {
            Some(b) => serializer.serialize_some(&STANDARD.encode(b)),
            None => serializer.serialize_none(),
        }
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Option<Vec<u8>>, D::Error>
    where
        D: Deserializer<'de>,
    {
        let opt: Option<String> = Option::deserialize(deserializer)?;
        match opt {
            Some(s) => STANDARD.decode(&s).map(Some).map_err(serde::de::Error::custom),
            None => Ok(None),
        }
    }
}

// ---------------------------------------------------------------------------
// Enums (mirror vault schema enums)
// ---------------------------------------------------------------------------

/// Type of vault item.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[sqlx(type_name = "vault.item_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum VaultItemType {
    Login,
    SecureNote,
    Card,
    SshKey,
    ApiToken,
    Identity,
    Passkey,
}

/// Who a share is granted to.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[sqlx(type_name = "vault.share_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum VaultShareType {
    Person,
    Group,
}

/// Access level for a share.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[sqlx(type_name = "vault.access_level", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum VaultAccessLevel {
    Full,
    UseOnly,
    ReadOnly,
}

/// Action recorded in the vault audit log.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[sqlx(type_name = "vault.audit_action", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum VaultAuditAction {
    View,
    Copy,
    Use,
    Browse,
    Create,
    Update,
    Delete,
    Share,
    Unshare,
    TotpGenerate,
}

// ---------------------------------------------------------------------------
// User keys
// ---------------------------------------------------------------------------

/// Encryption key hierarchy record for a single user.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct VaultUserKeys {
    pub id: Uuid,
    pub user_id: Uuid,
    /// AES-256-GCM encrypted symmetric key (wrapped with user's master password derived key).
    #[serde(with = "base64_bytes")]
    pub encrypted_sym_key: Vec<u8>,
    /// RSA/EC private key encrypted with the symmetric key.
    #[serde(with = "base64_bytes")]
    pub encrypted_private_key: Vec<u8>,
    /// PEM-encoded public key (stored in plaintext for sharing).
    pub public_key: String,
    pub kdf_type: Option<String>,
    pub kdf_iterations: Option<i32>,
    pub has_master_password: Option<bool>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Request to initialise or update a user's key bundle.
#[derive(Debug, Clone, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct UpsertVaultUserKeys {
    #[serde(with = "base64_bytes")]
    pub encrypted_sym_key: Vec<u8>,
    #[serde(with = "base64_bytes")]
    pub encrypted_private_key: Vec<u8>,
    pub public_key: String,
    #[serde(default)]
    pub password_hash: Option<String>,
    pub kdf_type: Option<String>,
    pub kdf_iterations: Option<i32>,
    pub has_master_password: Option<bool>,
}

// ---------------------------------------------------------------------------
// Folders
// ---------------------------------------------------------------------------

/// A named folder (name is encrypted).
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct VaultFolder {
    pub id: Uuid,
    pub owner_id: Uuid,
    /// Encrypted folder name.
    #[serde(with = "base64_bytes")]
    pub name: Vec<u8>,
    pub created_at: DateTime<Utc>,
}

/// Request to create a vault folder.
#[derive(Debug, Clone, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CreateVaultFolder {
    #[serde(with = "base64_bytes")]
    pub name: Vec<u8>,
}

/// Request to rename a vault folder.
#[derive(Debug, Clone, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct UpdateVaultFolder {
    #[serde(with = "base64_bytes")]
    pub name: Vec<u8>,
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

/// A vault item (login, card, note, …). All sensitive blobs are encrypted.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct VaultItem {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub folder_id: Option<Uuid>,
    pub item_type: VaultItemType,
    /// Encrypted item name.
    #[serde(with = "base64_bytes")]
    pub name: Vec<u8>,
    /// Encrypted JSON payload (type-specific fields).
    #[serde(with = "base64_bytes")]
    pub data: Vec<u8>,
    #[serde(default, with = "base64_bytes_opt")]
    pub notes: Option<Vec<u8>>,
    /// Encrypted custom fields list.
    #[serde(default, with = "base64_bytes_opt")]
    pub fields: Option<Vec<u8>>,
    /// Per-item encryption key (encrypted with the user's symmetric key).
    #[serde(default, with = "base64_bytes_opt")]
    pub item_key: Option<Vec<u8>>,
    /// Encrypted TOTP secret (base32).
    #[serde(default, with = "base64_bytes_opt")]
    pub totp_secret: Option<Vec<u8>>,
    /// Encrypted password history array.
    #[serde(default, with = "base64_bytes_opt")]
    pub password_history: Option<Vec<u8>>,
    /// Encrypted URI / URL.
    #[serde(default, with = "base64_bytes_opt")]
    pub uri: Option<Vec<u8>>,
    pub favorite: Option<bool>,
    pub reprompt: Option<bool>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Request to create a vault item.
#[derive(Debug, Clone, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CreateVaultItem {
    pub folder_id: Option<Uuid>,
    pub item_type: VaultItemType,
    #[serde(with = "base64_bytes")]
    pub name: Vec<u8>,
    #[serde(with = "base64_bytes")]
    pub data: Vec<u8>,
    #[serde(default, with = "base64_bytes_opt")]
    pub notes: Option<Vec<u8>>,
    #[serde(default, with = "base64_bytes_opt")]
    pub fields: Option<Vec<u8>>,
    #[serde(default, with = "base64_bytes_opt")]
    pub item_key: Option<Vec<u8>>,
    #[serde(default, with = "base64_bytes_opt")]
    pub totp_secret: Option<Vec<u8>>,
    #[serde(default, with = "base64_bytes_opt")]
    pub uri: Option<Vec<u8>>,
    pub favorite: Option<bool>,
    pub reprompt: Option<bool>,
}

/// Request to update a vault item (all fields optional).
#[derive(Debug, Clone, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct UpdateVaultItem {
    pub folder_id: Option<Uuid>,
    #[serde(default, with = "base64_bytes_opt")]
    pub name: Option<Vec<u8>>,
    #[serde(default, with = "base64_bytes_opt")]
    pub data: Option<Vec<u8>>,
    #[serde(default, with = "base64_bytes_opt")]
    pub notes: Option<Vec<u8>>,
    #[serde(default, with = "base64_bytes_opt")]
    pub fields: Option<Vec<u8>>,
    #[serde(default, with = "base64_bytes_opt")]
    pub item_key: Option<Vec<u8>>,
    #[serde(default, with = "base64_bytes_opt")]
    pub totp_secret: Option<Vec<u8>>,
    #[serde(default, with = "base64_bytes_opt")]
    pub password_history: Option<Vec<u8>>,
    #[serde(default, with = "base64_bytes_opt")]
    pub uri: Option<Vec<u8>>,
    pub favorite: Option<bool>,
    pub reprompt: Option<bool>,
}

// ---------------------------------------------------------------------------
// Shares
// ---------------------------------------------------------------------------

/// A share grant — gives a person or group access to a vault item.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct VaultShare {
    pub id: Uuid,
    pub item_id: Uuid,
    pub share_type: VaultShareType,
    pub grantee_id: Uuid,
    pub access_level: VaultAccessLevel,
    /// Item key re-encrypted with the grantee's public key.
    #[serde(with = "base64_bytes")]
    pub encrypted_key: Vec<u8>,
    pub granted_by: Uuid,
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

/// Request to share a vault item.
#[derive(Debug, Clone, Deserialize)]
pub struct CreateVaultShare {
    pub item_id: Uuid,
    pub share_type: VaultShareType,
    pub grantee_id: Uuid,
    pub access_level: VaultAccessLevel,
    #[serde(with = "base64_bytes")]
    pub encrypted_key: Vec<u8>,
    pub expires_at: Option<DateTime<Utc>>,
}

// ---------------------------------------------------------------------------
// Org keys
// ---------------------------------------------------------------------------

/// Per-member encrypted org symmetric key for group-level sharing.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct VaultOrgKey {
    pub id: Uuid,
    pub group_id: Uuid,
    pub member_user_id: Uuid,
    /// Org symmetric key encrypted with the member's public key.
    #[serde(with = "base64_bytes")]
    pub encrypted_org_key: Vec<u8>,
    pub created_at: DateTime<Utc>,
}

/// Request to upsert an org key.
#[derive(Debug, Clone, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct UpsertVaultOrgKey {
    pub group_id: Uuid,
    pub member_user_id: Uuid,
    #[serde(with = "base64_bytes")]
    pub encrypted_org_key: Vec<u8>,
}

// ---------------------------------------------------------------------------
// Browse sessions
// ---------------------------------------------------------------------------

/// A short-lived session allowing the browser proxy to inject credentials.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct VaultBrowseSession {
    pub id: Uuid,
    pub token: String,
    pub item_id: Uuid,
    pub user_id: Uuid,
    pub target_url: String,
    pub injected_username: Option<String>,
    pub injected_password: Option<String>,
    pub injected_totp_secret: Option<String>,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

/// Request to start a browse session.
#[derive(Debug, Clone, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CreateBrowseSession {
    pub item_id: Uuid,
    pub target_url: String,
    pub injected_username: Option<String>,
    pub injected_password: Option<String>,
    pub injected_totp_secret: Option<String>,
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

/// An entry in the vault audit log.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct VaultAuditLog {
    pub id: Uuid,
    pub item_id: Option<Uuid>,
    pub action: VaultAuditAction,
    pub actor_id: Uuid,
    pub actor_ip: Option<String>,
    pub details: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
}
