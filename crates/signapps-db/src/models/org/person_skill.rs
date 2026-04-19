//! Canonical `org_person_skills` table — SO3 scale & power.
//!
//! Associe une personne à un skill avec un niveau 1-5 et une éventuelle
//! endorsement (quelqu'un qui atteste du niveau). Clé primaire composite
//! `(person_id, skill_id)` → un upsert simple remplace le niveau.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// One `org_person_skills` row.
///
/// # Examples
///
/// ```ignore
/// let ps = PersonSkill {
///     person_id: uuid::Uuid::new_v4(),
///     skill_id: uuid::Uuid::new_v4(),
///     level: 4,
///     endorsed_by_person_id: Some(uuid::Uuid::new_v4()),
///     created_at: chrono::Utc::now(),
/// };
/// ```
///
/// # Panics
///
/// Aucun panic.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct PersonSkill {
    /// Personne taguée.
    pub person_id: Uuid,
    /// Skill tagué.
    pub skill_id: Uuid,
    /// Niveau 1 (beginner) → 5 (expert). Contrainte SQL `BETWEEN 1 AND 5`.
    pub level: i16,
    /// Endorsement optionnel (qui atteste du niveau).
    pub endorsed_by_person_id: Option<Uuid>,
    /// Date de création (UTC).
    pub created_at: DateTime<Utc>,
}

/// Combinaison skill + niveau pour l'UI — utilisé par le handler
/// `GET /api/v1/org/persons/:id/skills` qui renvoie le join.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct PersonSkillWithName {
    /// Skill id.
    pub skill_id: Uuid,
    /// Skill slug.
    pub slug: String,
    /// Skill name.
    pub name: String,
    /// Skill category.
    pub category: String,
    /// Level 1-5.
    pub level: i16,
    /// Endorser (optionnel).
    pub endorsed_by_person_id: Option<Uuid>,
}
