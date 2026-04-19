//! Canonical `org_access_grants` table — signed, time-boxed share
//! tokens issued by a [`Person`](super::person::Person) on a specific
//! resource.
//!
//! The grant carries a permission set and a `token_hash` (SHA-256
//! of the HMAC-signed token returned to the consumer). Lookups are
//! made by hash, never by raw token, so a database leak does not
//! reveal the live tokens.
//!
//! Grants are consumed by the W5 sharing flow (`/g/<token>`).

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// One access-grant row.
///
/// `granted_to` is `Some` when the grant is nominative, `None` when
/// it targets anyone holding the token (anonymous link). `revoked_at`
/// is set on explicit revocation; `expires_at` on the natural TTL.
///
/// # Examples
///
/// ```ignore
/// let g = AccessGrant {
///     id: uuid::Uuid::new_v4(),
///     tenant_id: uuid::Uuid::new_v4(),
///     granted_by: uuid::Uuid::new_v4(),
///     granted_to: None,
///     resource_type: "drive.file".into(),
///     resource_id: uuid::Uuid::new_v4(),
///     permissions: serde_json::json!({"actions":["read"]}),
///     token_hash: "sha256:...".into(),
///     expires_at: None,
///     revoked_at: None,
///     created_at: chrono::Utc::now(),
///     last_used_at: None,
/// };
/// ```
///
/// # Panics
///
/// Aucun panic.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AccessGrant {
    /// Identifiant unique (UUID v4).
    pub id: Uuid,
    /// Tenant émetteur.
    pub tenant_id: Uuid,
    /// Personne qui a accordé le grant.
    pub granted_by: Uuid,
    /// Personne destinataire (`None` pour un lien anonyme).
    pub granted_to: Option<Uuid>,
    /// Type de ressource (`<service>.<resource>`).
    pub resource_type: String,
    /// Identifiant de la ressource ciblée.
    pub resource_id: Uuid,
    /// Permissions accordées (JSONB structuré).
    pub permissions: serde_json::Value,
    /// Hash SHA-256 du token HMAC distribué (UNIQUE).
    pub token_hash: String,
    /// Date d'expiration naturelle (UTC).
    pub expires_at: Option<DateTime<Utc>>,
    /// Date de révocation explicite (UTC).
    pub revoked_at: Option<DateTime<Utc>>,
    /// Date de création (UTC).
    pub created_at: DateTime<Utc>,
    /// Dernière utilisation (UTC).
    pub last_used_at: Option<DateTime<Utc>>,
}
