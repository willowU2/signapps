//! Canonical `org_acl` table — SO9 ACL universelle ReBAC-style.
//!
//! Chaque row définit une permission explicite : un **sujet** (personne,
//! groupe, rôle global, tout le monde, tout utilisateur authentifié) a le
//! droit (ou l'interdiction, en mode `deny`) de faire une **action** sur
//! un **type de ressource** (éventuellement ciblé par un UUID précis).
//!
//! La résolution est faite par `signapps-common::rbac::acl::AclResolver`
//! avec une règle **deny wins** :
//!
//! 1. Collecte toutes les ACLs applicables au couple (user, action, resource)
//! 2. Si une seule ACL `deny` match → refuse
//! 3. Sinon, au moins une `allow` → autorise
//! 4. Sinon, implicit deny

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Type de sujet d'une ACL.
///
/// Stored as lowercase `VARCHAR(16)`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[sqlx(type_name = "VARCHAR", rename_all = "snake_case")]
pub enum AclSubjectType {
    /// Individu — `org_persons.id` dans `subject_id`.
    Person,
    /// Groupe transverse — `org_groups.id` dans `subject_id`.
    Group,
    /// Rôle global — nom du rôle dans `subject_ref` (e.g. "vehicle_manager").
    Role,
    /// Tout le monde (même non authentifié). `subject_id` = NULL.
    Everyone,
    /// Tout utilisateur authentifié. `subject_id` = NULL.
    AuthUser,
}

impl AclSubjectType {
    /// Parse a snake_case string.
    ///
    /// # Errors
    ///
    /// Returns `Err` for unknown variants.
    pub fn parse(raw: &str) -> Result<Self, String> {
        match raw {
            "person" => Ok(Self::Person),
            "group" => Ok(Self::Group),
            "role" => Ok(Self::Role),
            "everyone" => Ok(Self::Everyone),
            "auth_user" => Ok(Self::AuthUser),
            other => Err(format!("unknown ACL subject type: {other}")),
        }
    }

    /// Snake-case DB value.
    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Person => "person",
            Self::Group => "group",
            Self::Role => "role",
            Self::Everyone => "everyone",
            Self::AuthUser => "auth_user",
        }
    }

    /// Does this subject type require a non-NULL `subject_id`?
    #[must_use]
    pub fn requires_subject_id(self) -> bool {
        matches!(self, Self::Person | Self::Group)
    }
}

/// Effect d'une ACL (`allow` | `deny`).
///
/// Stored as lowercase `VARCHAR(8)`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[sqlx(type_name = "VARCHAR", rename_all = "snake_case")]
pub enum AclEffect {
    /// Autorise l'action.
    Allow,
    /// Interdit l'action (prioritaire sur tout `Allow`).
    Deny,
}

impl AclEffect {
    /// Parse a string.
    ///
    /// # Errors
    ///
    /// Returns `Err` for unknown variants.
    pub fn parse(raw: &str) -> Result<Self, String> {
        match raw {
            "allow" => Ok(Self::Allow),
            "deny" => Ok(Self::Deny),
            other => Err(format!("unknown ACL effect: {other}")),
        }
    }

    /// Snake-case DB value.
    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Allow => "allow",
            Self::Deny => "deny",
        }
    }
}

/// One `org_acl` row.
///
/// # Examples
///
/// ```ignore
/// // Allow "vehicle_manager" role to do anything on every vehicle:
/// let acl = Acl {
///     id: uuid::Uuid::new_v4(),
///     tenant_id: uuid::Uuid::new_v4(),
///     subject_type: AclSubjectType::Role,
///     subject_id: None,
///     subject_ref: Some("vehicle_manager".into()),
///     action: "*".into(),
///     resource_type: "resource".into(),
///     resource_id: None,
///     effect: AclEffect::Allow,
///     reason: Some("Fleet manager blanket permission".into()),
///     valid_from: None,
///     valid_until: None,
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
pub struct Acl {
    /// Identifiant unique (UUID v4).
    pub id: Uuid,
    /// Tenant propriétaire.
    pub tenant_id: Uuid,
    /// Type de sujet.
    pub subject_type: AclSubjectType,
    /// UUID du sujet (NULL pour role/everyone/auth_user).
    pub subject_id: Option<Uuid>,
    /// Nom de rôle quand `subject_type = role` (ignore pour autres types).
    pub subject_ref: Option<String>,
    /// Action. `'*'` = toutes les actions.
    pub action: String,
    /// Type de ressource (`'resource'`, `'site'`, ... ou `'*'`).
    pub resource_type: String,
    /// UUID de ressource ou NULL pour wildcard.
    pub resource_id: Option<Uuid>,
    /// Effect (`allow` | `deny`).
    pub effect: AclEffect,
    /// Raison libre (documentation).
    pub reason: Option<String>,
    /// Début de validité (UTC).
    pub valid_from: Option<DateTime<Utc>>,
    /// Fin de validité (UTC).
    pub valid_until: Option<DateTime<Utc>>,
    /// User ayant créé la règle (audit).
    pub created_by_user_id: Option<Uuid>,
    /// Date de création (UTC).
    pub created_at: DateTime<Utc>,
}

impl Acl {
    /// Return `true` if the row is currently within its validity window.
    ///
    /// Rows with no bounds (`valid_from` = `valid_until` = `None`) are
    /// always valid.
    #[must_use]
    pub fn is_valid_at(&self, now: DateTime<Utc>) -> bool {
        let after_from = self.valid_from.map_or(true, |from| now >= from);
        let before_until = self.valid_until.map_or(true, |until| now <= until);
        after_from && before_until
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Duration;

    #[test]
    fn subject_type_roundtrip() {
        for s in [
            AclSubjectType::Person,
            AclSubjectType::Group,
            AclSubjectType::Role,
            AclSubjectType::Everyone,
            AclSubjectType::AuthUser,
        ] {
            assert_eq!(AclSubjectType::parse(s.as_str()).unwrap(), s);
        }
    }

    #[test]
    fn effect_roundtrip() {
        for e in [AclEffect::Allow, AclEffect::Deny] {
            assert_eq!(AclEffect::parse(e.as_str()).unwrap(), e);
        }
    }

    #[test]
    fn requires_subject_id_matrix() {
        assert!(AclSubjectType::Person.requires_subject_id());
        assert!(AclSubjectType::Group.requires_subject_id());
        assert!(!AclSubjectType::Role.requires_subject_id());
        assert!(!AclSubjectType::Everyone.requires_subject_id());
        assert!(!AclSubjectType::AuthUser.requires_subject_id());
    }

    fn stub() -> Acl {
        Acl {
            id: Uuid::nil(),
            tenant_id: Uuid::nil(),
            subject_type: AclSubjectType::Everyone,
            subject_id: None,
            subject_ref: None,
            action: "read".into(),
            resource_type: "resource".into(),
            resource_id: None,
            effect: AclEffect::Allow,
            reason: None,
            valid_from: None,
            valid_until: None,
            created_by_user_id: None,
            created_at: Utc::now(),
        }
    }

    #[test]
    fn is_valid_at_no_bounds() {
        assert!(stub().is_valid_at(Utc::now()));
    }

    #[test]
    fn is_valid_at_within_window() {
        let now = Utc::now();
        let mut a = stub();
        a.valid_from = Some(now - Duration::hours(1));
        a.valid_until = Some(now + Duration::hours(1));
        assert!(a.is_valid_at(now));
    }

    #[test]
    fn is_valid_at_before_window() {
        let now = Utc::now();
        let mut a = stub();
        a.valid_from = Some(now + Duration::hours(1));
        assert!(!a.is_valid_at(now));
    }

    #[test]
    fn is_valid_at_after_window() {
        let now = Utc::now();
        let mut a = stub();
        a.valid_until = Some(now - Duration::hours(1));
        assert!(!a.is_valid_at(now));
    }
}
