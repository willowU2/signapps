//! Canonical `org_headcount_plan` table — SO3 scale & power.
//!
//! Un **headcount plan** représente une cible d'effectifs pour un node
//! à une date donnée (typiquement trimestrielle). Plusieurs plans à
//! horizons différents sur un même node sont autorisés — pas de clé
//! UNIQUE composite.
//!
//! Computation côté repo : `compute_rollup(node)` retourne
//! `{filled, positions_sum, target, gap}` où :
//! - `filled` = COUNT(incumbents active) sous le node
//! - `positions_sum` = SUM(head_count) des positions du node
//! - `target` = plan le plus récent pour (node, target_date futur)
//! - `gap` = target - filled

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// One `org_headcount_plan` row.
///
/// # Examples
///
/// ```ignore
/// let plan = HeadcountPlan {
///     id: uuid::Uuid::new_v4(),
///     tenant_id: uuid::Uuid::new_v4(),
///     node_id: uuid::Uuid::new_v4(),
///     target_head_count: 15,
///     target_date: chrono::NaiveDate::from_ymd_opt(2026, 7, 1).unwrap(),
///     notes: Some("Q2 hiring ramp-up".into()),
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
pub struct HeadcountPlan {
    /// Identifiant unique (UUID v4).
    pub id: Uuid,
    /// Tenant propriétaire.
    pub tenant_id: Uuid,
    /// Noeud ciblé.
    pub node_id: Uuid,
    /// Effectif cible (>= 0).
    pub target_head_count: i32,
    /// Date d'atteinte visée.
    pub target_date: NaiveDate,
    /// Notes libres (raisons, hypothèses, risques).
    pub notes: Option<String>,
    /// Date de création (UTC).
    pub created_at: DateTime<Utc>,
    /// Date de dernière modification (UTC).
    pub updated_at: DateTime<Utc>,
}

/// Rollup computé pour un node donné — agrège positions + incumbents +
/// plan cible pour produire un status `on_track | understaffed | over_plan`.
///
/// # Examples
///
/// ```ignore
/// let r = HeadcountRollup {
///     node_id: uuid::Uuid::new_v4(),
///     filled: 8,
///     positions_sum: 10,
///     target: Some(12),
///     gap: Some(4),
///     status: "understaffed".into(),
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct HeadcountRollup {
    /// Noeud agrégé.
    pub node_id: Uuid,
    /// Nombre d'incumbents actifs sur les positions du node.
    pub filled: i64,
    /// Somme des head_count des positions actives du node.
    pub positions_sum: i64,
    /// Cible la plus proche (plan futur le plus prochain), None si aucun plan.
    pub target: Option<i32>,
    /// Écart target - filled, None si pas de plan.
    pub gap: Option<i32>,
    /// Statut calculé : `on_track` | `understaffed` | `over_plan`.
    pub status: String,
}
