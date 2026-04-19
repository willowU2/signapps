//! Canonical `org_delegations` table.
//!
//! Une délégation permet à une **delegator** de transférer temporairement
//! ses responsabilités de manager et/ou ses permissions RBAC à un
//! **delegate**. Stockée avec période explicite (`start_at`/`end_at`) et
//! `scope` (enum `manager` | `rbac` | `all`).
//!
//! Expiration automatique via le cron `so1_expire_delegations` (tick 15
//! minutes) qui passe `active = false` quand `end_at < now()`.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Portée d'une délégation.
///
/// - `Manager` — reprend le rôle de responsable hiérarchique (validations,
///   approbations RH, routage d'escalations).
/// - `Rbac` — étend les permissions applicatives (OrgClient résolveur).
/// - `All` — couvre les deux.
///
/// Stored as lowercase `TEXT` (`manager`, `rbac`, `all`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[sqlx(type_name = "TEXT", rename_all = "snake_case")]
pub enum DelegationScope {
    /// Responsable hiérarchique uniquement.
    Manager,
    /// Permissions RBAC uniquement.
    Rbac,
    /// Les deux (manager + rbac).
    All,
}

/// One `org_delegations` row.
///
/// # Examples
///
/// ```ignore
/// let d = Delegation {
///     id: uuid::Uuid::new_v4(),
///     tenant_id: uuid::Uuid::new_v4(),
///     delegator_person_id: uuid::Uuid::new_v4(),
///     delegate_person_id: uuid::Uuid::new_v4(),
///     node_id: None,
///     scope: DelegationScope::Manager,
///     start_at: chrono::Utc::now(),
///     end_at: chrono::Utc::now() + chrono::Duration::days(7),
///     reason: Some("Parental leave".into()),
///     active: true,
///     created_by: None,
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
pub struct Delegation {
    /// Identifiant unique (UUID v4).
    pub id: Uuid,
    /// Tenant propriétaire.
    pub tenant_id: Uuid,
    /// Personne qui délègue (source des responsabilités).
    pub delegator_person_id: Uuid,
    /// Personne qui reçoit la délégation.
    pub delegate_person_id: Uuid,
    /// Noeud optionnel — restreint la délégation à un sous-arbre.
    pub node_id: Option<Uuid>,
    /// Scope (`manager` | `rbac` | `all`).
    pub scope: DelegationScope,
    /// Début de validité (UTC).
    pub start_at: DateTime<Utc>,
    /// Fin de validité (UTC). La base enforce `start_at < end_at`.
    pub end_at: DateTime<Utc>,
    /// Raison libre (congés, sabbat, ...).
    pub reason: Option<String>,
    /// `false` = révoquée ou expirée.
    pub active: bool,
    /// User qui a créé la délégation (audit).
    pub created_by: Option<Uuid>,
    /// Date de création (UTC).
    pub created_at: DateTime<Utc>,
    /// Date de dernière modification (UTC).
    pub updated_at: DateTime<Utc>,
}
