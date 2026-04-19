//! Canonical `org_public_links` table — SO4 integrations.
//!
//! Un **public link** matérialise un partage non-authentifié d'un
//! sous-arbre d'organisation via un slug URL. La visibilité est
//! progressive : `full` (toutes données), `anon` (initiales seulement),
//! `compact` (juste counts).
//!
//! Chaque GET sur `/public/org/:slug` incrémente `access_count` et
//! sert de garde-fou anti-abuse.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Niveau d'anonymisation d'un public link.
///
/// Stored as lowercase `VARCHAR(16)` (`full`, `anon`, `compact`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[sqlx(type_name = "TEXT", rename_all = "snake_case")]
pub enum Visibility {
    /// Noms complets, emails, titres — exposition totale.
    Full,
    /// Initiales uniquement, pas d'email, titres conservés.
    Anon,
    /// Juste nom du node + count persons, aucune donnée person.
    Compact,
}

impl Visibility {
    /// Parse a string back into [`Visibility`].
    ///
    /// # Errors
    ///
    /// Returns an `Err` for any unrecognized variant.
    pub fn parse(raw: &str) -> Result<Self, String> {
        match raw {
            "full" => Ok(Self::Full),
            "anon" => Ok(Self::Anon),
            "compact" => Ok(Self::Compact),
            other => Err(format!("unknown visibility: {other}")),
        }
    }
}

/// One `org_public_links` row.
///
/// # Examples
///
/// ```ignore
/// let link = PublicLink {
///     id: uuid::Uuid::new_v4(),
///     tenant_id: uuid::Uuid::new_v4(),
///     root_node_id: uuid::Uuid::new_v4(),
///     slug: "nexus-public".into(),
///     visibility: Visibility::Anon,
///     allowed_origins: vec![],
///     expires_at: None,
///     access_count: 0,
///     created_by_user_id: None,
///     created_at: chrono::Utc::now(),
///     revoked_at: None,
/// };
/// ```
///
/// # Panics
///
/// Aucun panic.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct PublicLink {
    /// Identifiant unique (UUID v4).
    pub id: Uuid,
    /// Tenant propriétaire du lien.
    pub tenant_id: Uuid,
    /// Node racine du sous-arbre exposé.
    pub root_node_id: Uuid,
    /// Slug unique servant d'URL public (`/public/org/:slug`).
    pub slug: String,
    /// Niveau d'anonymisation (`full` | `anon` | `compact`).
    pub visibility: Visibility,
    /// Origines autorisées pour CORS / iframe (vide = `*`).
    pub allowed_origins: Vec<String>,
    /// Expiration optionnelle (UTC).
    pub expires_at: Option<DateTime<Utc>>,
    /// Compteur d'accès (incrémenté à chaque GET).
    pub access_count: i32,
    /// Utilisateur qui a créé le lien.
    pub created_by_user_id: Option<Uuid>,
    /// Date de création (UTC).
    pub created_at: DateTime<Utc>,
    /// Date de révocation (NULL = actif).
    pub revoked_at: Option<DateTime<Utc>>,
}

impl PublicLink {
    /// `true` si le lien est utilisable (non-révoqué, non-expiré).
    #[must_use]
    pub fn is_active(&self) -> bool {
        if self.revoked_at.is_some() {
            return false;
        }
        if let Some(exp) = self.expires_at {
            if Utc::now() >= exp {
                return false;
            }
        }
        true
    }
}
