//! Canonical `org_resource_assignments` table — SO9 multi-assign.
//!
//! Chaque row = un lien N:N entre une ressource (`org_resources`) et un
//! sujet (`person` | `node` | `group` | `site`) avec un **rôle** :
//!
//! | Role            | Description                                     |
//! |-----------------|-------------------------------------------------|
//! | owner           | Responsable légal/financier                     |
//! | primary_user    | Utilisateur principal (quotidien)               |
//! | secondary_user  | Co-utilisateur occasionnel                      |
//! | caretaker       | Gère la maintenance et la logistique            |
//! | maintainer      | Fait les mises à jour techniques                |
//!
//! Historique bi-temporel léger : update = close `end_at` + insert new row.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Type de sujet auquel une ressource est assignée.
///
/// Stored as lowercase `VARCHAR(16)`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[sqlx(type_name = "VARCHAR", rename_all = "snake_case")]
pub enum AssignmentSubjectType {
    /// Individu — `org_persons.id`.
    Person,
    /// Node organisationnel — `org_nodes.id`.
    Node,
    /// Groupe transverse — `org_groups.id`.
    Group,
    /// Site physique — `org_sites.id`.
    Site,
}

impl AssignmentSubjectType {
    /// Parse a snake_case string.
    ///
    /// # Errors
    ///
    /// Returns `Err` for unknown variants.
    pub fn parse(raw: &str) -> Result<Self, String> {
        match raw {
            "person" => Ok(Self::Person),
            "node" => Ok(Self::Node),
            "group" => Ok(Self::Group),
            "site" => Ok(Self::Site),
            other => Err(format!("unknown assignment subject type: {other}")),
        }
    }

    /// Snake-case DB value.
    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Person => "person",
            Self::Node => "node",
            Self::Group => "group",
            Self::Site => "site",
        }
    }
}

/// Rôle d'un sujet sur une ressource.
///
/// Stored as lowercase `VARCHAR(24)`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[sqlx(type_name = "VARCHAR", rename_all = "snake_case")]
pub enum AssignmentRole {
    /// Responsable légal/financier (signe le contrat, paie).
    Owner,
    /// Utilise au quotidien.
    PrimaryUser,
    /// Co-utilise occasionnellement.
    SecondaryUser,
    /// Gère la maintenance et la logistique.
    Caretaker,
    /// Fait les mises à jour techniques (DSI pour MacBook, vendor pour licence).
    Maintainer,
}

impl AssignmentRole {
    /// Parse a snake_case string.
    ///
    /// # Errors
    ///
    /// Returns `Err` for unknown variants.
    pub fn parse(raw: &str) -> Result<Self, String> {
        match raw {
            "owner" => Ok(Self::Owner),
            "primary_user" => Ok(Self::PrimaryUser),
            "secondary_user" => Ok(Self::SecondaryUser),
            "caretaker" => Ok(Self::Caretaker),
            "maintainer" => Ok(Self::Maintainer),
            other => Err(format!("unknown assignment role: {other}")),
        }
    }

    /// Snake-case DB value.
    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Owner => "owner",
            Self::PrimaryUser => "primary_user",
            Self::SecondaryUser => "secondary_user",
            Self::Caretaker => "caretaker",
            Self::Maintainer => "maintainer",
        }
    }
}

/// One `org_resource_assignments` row.
///
/// # Examples
///
/// ```ignore
/// let a = ResourceAssignment {
///     id: uuid::Uuid::new_v4(),
///     tenant_id: uuid::Uuid::new_v4(),
///     resource_id: uuid::Uuid::new_v4(),
///     subject_type: AssignmentSubjectType::Person,
///     subject_id: uuid::Uuid::new_v4(),
///     role: AssignmentRole::Owner,
///     is_primary: true,
///     start_at: chrono::Utc::now(),
///     end_at: None,
///     reason: None,
///     created_by_user_id: None,
///     created_at: chrono::Utc::now(),
/// };
/// ```
///
/// # Panics
///
/// Aucun panic.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct ResourceAssignment {
    /// Identifiant unique (UUID v4).
    pub id: Uuid,
    /// Tenant propriétaire.
    pub tenant_id: Uuid,
    /// Ressource cible (FK `org_resources.id`).
    pub resource_id: Uuid,
    /// Type de sujet.
    pub subject_type: AssignmentSubjectType,
    /// Identifiant du sujet.
    pub subject_id: Uuid,
    /// Rôle sur la ressource.
    pub role: AssignmentRole,
    /// `true` si ce sujet est désigné comme primaire (marqueur UX).
    pub is_primary: bool,
    /// Début de validité (UTC).
    pub start_at: DateTime<Utc>,
    /// Fin de validité (UTC). `None` = actif.
    pub end_at: Option<DateTime<Utc>>,
    /// Raison libre (transfert, congé, ...).
    pub reason: Option<String>,
    /// User ayant créé l'assignment (audit).
    pub created_by_user_id: Option<Uuid>,
    /// Date de création (UTC).
    pub created_at: DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn subject_type_roundtrip() {
        for s in [
            AssignmentSubjectType::Person,
            AssignmentSubjectType::Node,
            AssignmentSubjectType::Group,
            AssignmentSubjectType::Site,
        ] {
            assert_eq!(AssignmentSubjectType::parse(s.as_str()).unwrap(), s);
        }
    }

    #[test]
    fn role_roundtrip() {
        for r in [
            AssignmentRole::Owner,
            AssignmentRole::PrimaryUser,
            AssignmentRole::SecondaryUser,
            AssignmentRole::Caretaker,
            AssignmentRole::Maintainer,
        ] {
            assert_eq!(AssignmentRole::parse(r.as_str()).unwrap(), r);
        }
    }

    #[test]
    fn subject_type_rejects_unknown() {
        assert!(AssignmentSubjectType::parse("garbage").is_err());
    }

    #[test]
    fn role_rejects_unknown() {
        assert!(AssignmentRole::parse("garbage").is_err());
    }
}
