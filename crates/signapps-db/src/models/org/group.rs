//! Canonical `org_groups` table — SO7 groupes transverses.
//!
//! Un **groupe** matérialise une collection de personnes orthogonale
//! à la hiérarchie structurelle `org_nodes`. Exemples : "Développeurs
//! Python", "Comité d'éthique", "All Engineering".
//!
//! Quatre variantes :
//!
//! - [`GroupKind::Static`]   : membership explicite admin-géré (inclusions
//!   dans `org_group_members`).
//! - [`GroupKind::Dynamic`]  : règle JSON (voir matcher côté signapps-org)
//!   évaluée à la volée ; cache moka 5 min.
//! - [`GroupKind::Hybrid`]   : règle + inclusions manuelles + exclusions.
//! - [`GroupKind::Derived`]  : suit automatiquement le sous-arbre
//!   `source_node_id` (axe structure dans `org_assignments`).

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Variante d'un groupe.
///
/// Stored as lowercase `VARCHAR(16)` (`static`, `dynamic`, `hybrid`,
/// `derived`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[sqlx(type_name = "TEXT", rename_all = "snake_case")]
pub enum GroupKind {
    /// Membership explicite via `org_group_members` (include uniquement).
    Static,
    /// Règle JSON évaluée à la volée.
    Dynamic,
    /// Règle JSON + inclusions + exclusions manuelles.
    Hybrid,
    /// Suit automatiquement un sous-arbre via `source_node_id`.
    Derived,
}

impl GroupKind {
    /// Parse a snake_case string back into [`GroupKind`].
    ///
    /// # Errors
    ///
    /// Returns an `Err` for any unrecognized variant.
    pub fn parse(raw: &str) -> Result<Self, String> {
        match raw {
            "static" => Ok(Self::Static),
            "dynamic" => Ok(Self::Dynamic),
            "hybrid" => Ok(Self::Hybrid),
            "derived" => Ok(Self::Derived),
            other => Err(format!("unknown group kind: {other}")),
        }
    }

    /// Snake-case representation of the kind (DB column value).
    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Static => "static",
            Self::Dynamic => "dynamic",
            Self::Hybrid => "hybrid",
            Self::Derived => "derived",
        }
    }
}

/// Kind of `org_group_members` row (include / exclude).
///
/// Stored as lowercase `VARCHAR(16)` (`include`, `exclude`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[sqlx(type_name = "TEXT", rename_all = "snake_case")]
pub enum MembershipKind {
    /// Personne explicitement ajoutée au groupe.
    Include,
    /// Personne explicitement exclue du groupe (pour les groupes `hybrid`
    /// qui combinent règle + exceptions).
    Exclude,
}

/// One `org_groups` row.
///
/// # Examples
///
/// ```ignore
/// let g = OrgGroup {
///     id: uuid::Uuid::new_v4(),
///     tenant_id: uuid::Uuid::new_v4(),
///     slug: "python-devs".into(),
///     name: "Développeurs Python".into(),
///     description: None,
///     kind: GroupKind::Dynamic,
///     rule_json: Some(serde_json::json!({"skill": {"slug": "python"}})),
///     source_node_id: None,
///     attributes: serde_json::json!({}),
///     archived: false,
///     created_by_user_id: None,
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
pub struct OrgGroup {
    /// Identifiant unique (UUID v4).
    pub id: Uuid,
    /// Tenant propriétaire.
    pub tenant_id: Uuid,
    /// Slug unique au sein du tenant.
    pub slug: String,
    /// Libellé affiché.
    pub name: String,
    /// Description markdown optionnelle.
    pub description: Option<String>,
    /// Variante (static | dynamic | hybrid | derived).
    pub kind: GroupKind,
    /// Règle DSL pour dynamic / hybrid (NULL pour static / derived).
    pub rule_json: Option<serde_json::Value>,
    /// Node racine pour derived (NULL sinon).
    pub source_node_id: Option<Uuid>,
    /// Métadonnées extensibles.
    pub attributes: serde_json::Value,
    /// `true` = soft-deleted.
    pub archived: bool,
    /// Utilisateur créateur.
    pub created_by_user_id: Option<Uuid>,
    /// Date de création (UTC).
    pub created_at: DateTime<Utc>,
    /// Date de dernière modification (UTC).
    pub updated_at: DateTime<Utc>,
}

/// One `org_group_members` row.
///
/// # Panics
///
/// Aucun panic.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct OrgGroupMember {
    /// Groupe cible.
    pub group_id: Uuid,
    /// Personne concernée.
    pub person_id: Uuid,
    /// include | exclude.
    pub kind: MembershipKind,
    /// Date de création (UTC).
    pub created_at: DateTime<Utc>,
}
