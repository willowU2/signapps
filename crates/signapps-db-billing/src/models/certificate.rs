//! Proxy certificate models.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// TLS certificate stored in the database.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct Certificate {
    pub id: Uuid,
    pub domain: String,
    pub cert_pem: String,
    pub key_pem: String,
    pub issuer: Option<String>,
    pub not_before: DateTime<Utc>,
    pub not_after: DateTime<Utc>,
    pub auto_renew: bool,
    pub acme_account_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Request to upload a certificate manually.
#[derive(Debug, Clone, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CreateCertificate {
    pub domain: String,
    pub cert_pem: String,
    pub key_pem: String,
    pub issuer: Option<String>,
    pub not_before: DateTime<Utc>,
    pub not_after: DateTime<Utc>,
    #[serde(default = "default_true")]
    pub auto_renew: bool,
}

fn default_true() -> bool {
    true
}

/// ACME account for Let's Encrypt.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AcmeAccount {
    pub id: Uuid,
    pub email: String,
    pub directory_url: String,
    pub account_credentials: serde_json::Value,
    pub created_at: DateTime<Utc>,
}
