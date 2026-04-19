//! Canonical `org_skills` table — SO3 scale & power.
//!
//! Un **skill** est une compétence référencée dans le catalogue. Les
//! skills globaux ont `tenant_id = NULL` (40 skills seedés au boot), les
//! tenants peuvent également créer leurs propres skills privés. UNIQUE
//! sur `(tenant_id, slug)` — un skill global et un skill privé avec le
//! même slug coexistent.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Catégorie d'un skill.
///
/// Stored as lowercase `VARCHAR(32)` (`tech`, `soft`, `language`, `domain`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[sqlx(type_name = "TEXT", rename_all = "snake_case")]
pub enum SkillCategory {
    /// Compétence technique (Python, Rust, React, AWS, Docker…).
    Tech,
    /// Compétence transverse (Leadership, Communication, Mentoring…).
    Soft,
    /// Langue parlée (English, German, Spanish…).
    Language,
    /// Domaine métier (SaaS, Healthcare, FinTech…).
    Domain,
}

/// One `org_skills` row.
///
/// # Examples
///
/// ```ignore
/// let s = Skill {
///     id: uuid::Uuid::new_v4(),
///     tenant_id: None,
///     slug: "rust".into(),
///     name: "Rust".into(),
///     category: SkillCategory::Tech,
///     description: Some("Systems programming language".into()),
///     created_at: chrono::Utc::now(),
/// };
/// ```
///
/// # Panics
///
/// Aucun panic.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct Skill {
    /// Identifiant unique (UUID v4).
    pub id: Uuid,
    /// Tenant propriétaire — NULL pour le catalogue global partagé.
    pub tenant_id: Option<Uuid>,
    /// Slug unique au sein de `(tenant_id, …)`.
    pub slug: String,
    /// Libellé affiché à l'utilisateur.
    pub name: String,
    /// Catégorie.
    pub category: SkillCategory,
    /// Description markdown optionnelle.
    pub description: Option<String>,
    /// Date de création (UTC).
    pub created_at: DateTime<Utc>,
}
