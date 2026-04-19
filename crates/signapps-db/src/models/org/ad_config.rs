//! Canonical `org_ad_config` table — per-tenant LDAP/AD synchronization
//! configuration consumed by the W3 `signapps-org::ad::*` engine.
//!
//! The bind password is stored as ciphertext (BYTEA), encrypted by the
//! `signapps-keystore` AES-256-GCM master key. The plaintext is never
//! materialised in this struct — the AD client decrypts it on the fly.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Direction / activation mode of the AD synchronization loop.
///
/// Stored as lowercase `TEXT` (`off`, `pull`, `push`, `bidirectional`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[sqlx(type_name = "TEXT", rename_all = "snake_case")]
pub enum AdSyncMode {
    /// Désactivé.
    Off,
    /// AD → SignApps uniquement.
    Pull,
    /// SignApps → AD uniquement.
    Push,
    /// Synchronisation bidirectionnelle.
    Bidirectional,
}

/// Conflict resolution rule applied when AD and SignApps diverge.
///
/// Stored as lowercase `TEXT` (`org_wins`, `ad_wins`, `manual`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[sqlx(type_name = "TEXT", rename_all = "snake_case")]
pub enum ConflictStrategy {
    /// La version SignApps gagne.
    OrgWins,
    /// La version AD gagne.
    AdWins,
    /// Stoppe la sync, journalise pour décision humaine.
    Manual,
}

/// One AD configuration row, keyed on `tenant_id`.
///
/// # Examples
///
/// ```ignore
/// let cfg = AdConfig {
///     tenant_id: uuid::Uuid::new_v4(),
///     mode: AdSyncMode::Pull,
///     ldap_url: Some("ldap://dc.example.com:389".into()),
///     bind_dn: Some("CN=svc,DC=example,DC=com".into()),
///     bind_password_enc: None,
///     base_dn: Some("DC=example,DC=com".into()),
///     user_filter: None,
///     ou_filter: None,
///     sync_interval_sec: 300,
///     conflict_strategy: ConflictStrategy::OrgWins,
///     updated_at: chrono::Utc::now(),
/// };
/// ```
///
/// # Panics
///
/// Aucun panic.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AdConfig {
    /// Tenant propriétaire (clé primaire).
    pub tenant_id: Uuid,
    /// Mode de synchronisation.
    pub mode: AdSyncMode,
    /// URL LDAP (`ldap://...` ou `ldaps://...`).
    pub ldap_url: Option<String>,
    /// DN du compte de service utilisé pour le bind.
    pub bind_dn: Option<String>,
    /// Mot de passe du bind, chiffré AES-256-GCM par signapps-keystore.
    pub bind_password_enc: Option<Vec<u8>>,
    /// Base DN à scanner (recherche par défaut).
    pub base_dn: Option<String>,
    /// Filtre LDAP appliqué à la liste des utilisateurs.
    pub user_filter: Option<String>,
    /// Filtre LDAP appliqué à la liste des OU.
    pub ou_filter: Option<String>,
    /// Période entre deux cycles (secondes).
    pub sync_interval_sec: i32,
    /// Politique de résolution de conflit.
    pub conflict_strategy: ConflictStrategy,
    /// Date de dernière modification (UTC).
    pub updated_at: DateTime<Utc>,
}
