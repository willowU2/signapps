//! Kerberos principal key model.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;
use uuid::Uuid;

/// A Kerberos encryption key for a principal.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AdPrincipalKey {
    pub id: Uuid,
    pub domain_id: Uuid,
    pub principal_name: String,
    pub principal_type: String,
    pub key_version: i32,
    pub enc_type: i32,
    pub key_data: Vec<u8>,
    pub salt: Option<String>,
    pub entity_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

/// Request to create a new principal key.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CreatePrincipalKey {
    /// AD domain ID.
    pub domain_id: Uuid,
    /// Kerberos principal name.
    pub principal_name: String,
    /// Principal type (user, computer, service, krbtgt).
    pub principal_type: String,
    /// Key version number.
    pub key_version: i32,
    /// Encryption type (17=AES128, 18=AES256, 23=RC4).
    pub enc_type: i32,
    /// Encrypted key data.
    pub key_data: Vec<u8>,
    /// Kerberos salt.
    pub salt: Option<String>,
    /// Linked entity ID.
    pub entity_id: Option<Uuid>,
}
