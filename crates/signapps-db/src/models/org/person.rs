//! Canonical `org_persons` table.
//!
//! A person is a human entity known to the tenant. Their `user_id`
//! links to the identity service row when they hold a SignApps
//! account, and `dn` to the LDAP/AD entry when synced from a
//! directory.
//!
//! Persons are the subjects of [`Assignment`](super::assignment::Assignment),
//! `BoardMember`, [`AccessGrant`](super::access_grant::AccessGrant)
//! and `ProvisioningLog`.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// One person in the canonical org model.
///
/// Email is unique within a tenant (`UNIQUE (tenant_id, email)`),
/// `user_id` is globally unique when set.
///
/// # Examples
///
/// ```ignore
/// let p = Person {
///     id: uuid::Uuid::new_v4(),
///     tenant_id: uuid::Uuid::new_v4(),
///     user_id: None,
///     email: "alice@example.com".into(),
///     first_name: Some("Alice".into()),
///     last_name: Some("Wonder".into()),
///     dn: None,
///     attributes: serde_json::json!({}),
///     active: true,
///     created_at: chrono::Utc::now(),
///     updated_at: chrono::Utc::now(),
/// };
/// ```
///
/// # Panics
///
/// Aucun panic.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct Person {
    /// Identifiant unique (UUID v4).
    pub id: Uuid,
    /// Tenant qui possède ce contact.
    pub tenant_id: Uuid,
    /// Lien optionnel vers le compte plateforme (table `users`).
    pub user_id: Option<Uuid>,
    /// Adresse mail principale (unique par tenant).
    pub email: String,
    /// Prénom.
    pub first_name: Option<String>,
    /// Nom.
    pub last_name: Option<String>,
    /// Distinguished Name LDAP/AD (renseigné par le sync W3).
    pub dn: Option<String>,
    /// Attributs extensibles (JSONB).
    pub attributes: serde_json::Value,
    /// `false` = archivé (soft delete).
    pub active: bool,
    /// Date de création (UTC).
    pub created_at: DateTime<Utc>,
    /// Date de dernière modification (UTC).
    pub updated_at: DateTime<Utc>,
    /// Timestamp de la dernière synchronisation AD↔Org (migration 410).
    ///
    /// Rempli par `ad::sync::run_cycle` lorsqu'une mise à jour est
    /// appliquée. Sert de fenêtre de debounce (30 s) côté Org→AD pour
    /// éviter le ping-pong.
    #[sqlx(default)]
    pub last_synced_at: Option<DateTime<Utc>>,
    /// Identifiant de la source qui a appliqué la dernière sync
    /// (`"ad"` | `"org"`).
    #[sqlx(default)]
    pub last_synced_by: Option<String>,
}
