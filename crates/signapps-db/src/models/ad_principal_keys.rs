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
