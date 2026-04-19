//! Canonical `org_templates` table — SO3 scale & power.
//!
//! Un **template** représente une hiérarchie d'org prête à cloner
//! (nodes + positions, éventuellement RACI). Les 4 templates built-in
//! (`startup-20`, `scale-up-saas-80`, `eti-industrielle-300`, `agency-50`)
//! sont seedés au boot par `signapps-seed`. Les tenants peuvent également
//! créer leurs propres templates privés (`created_by_tenant_id` non NULL
//! et `is_public = false`).
//!
//! Le format de `spec_json` est détaillé dans le module
//! [`template_spec`](self::template_spec).

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// One `org_templates` row.
///
/// # Examples
///
/// ```ignore
/// let t = Template {
///     id: uuid::Uuid::new_v4(),
///     slug: "startup-20".into(),
///     name: "Startup 20 personnes".into(),
///     description: Some("Structure minimaliste pour startup early-stage".into()),
///     industry: Some("saas".into()),
///     size_range: Some("5-20".into()),
///     spec_json: serde_json::json!({"nodes": [], "positions": []}),
///     is_public: true,
///     created_by_tenant_id: None,
///     created_at: chrono::Utc::now(),
/// };
/// ```
///
/// # Panics
///
/// Aucun panic.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct Template {
    /// Identifiant unique (UUID v4).
    pub id: Uuid,
    /// Slug unique, lisible humainement (`startup-20`, `agency-50`, …).
    pub slug: String,
    /// Nom affiché à l'utilisateur.
    pub name: String,
    /// Description markdown.
    pub description: Option<String>,
    /// Industrie cible (`saas`, `industrial`, `agency`, …).
    pub industry: Option<String>,
    /// Fourchette de taille (`5-20`, `50-100`, `200-500`, …).
    pub size_range: Option<String>,
    /// Spec JSON décrivant l'arbo + positions + RACI patterns.
    pub spec_json: serde_json::Value,
    /// `true` = visible par tous les tenants. `false` = privé.
    pub is_public: bool,
    /// Tenant créateur (NULL pour les built-in publics).
    pub created_by_tenant_id: Option<Uuid>,
    /// Date de création (UTC).
    pub created_at: DateTime<Utc>,
}

/// Structure attendue d'un `spec_json` de template.
///
/// Forme DFS simple : une liste plate de `nodes` (chaque node référence
/// son `parent_slug` ou NULL pour la racine) + une liste de `positions`
/// liées au node via `node_slug`. Cette forme est suffisante pour un
/// clone transactionnel sans récursion lourde.
///
/// # Examples
///
/// ```ignore
/// let spec = TemplateSpec {
///     nodes: vec![
///         TemplateNode { slug: "eng".into(), name: "Engineering".into(), kind: "unit".into(), parent_slug: None },
///         TemplateNode { slug: "eng-platform".into(), name: "Platform".into(), kind: "unit".into(), parent_slug: Some("eng".into()) },
///     ],
///     positions: vec![
///         TemplatePosition { node_slug: "eng".into(), title: "VP Engineering".into(), head_count: 1 },
///     ],
/// };
/// ```
pub mod template_spec {
    use serde::{Deserialize, Serialize};

    /// Un node dans le spec (slug + parent_slug pour la hiérarchie).
    #[derive(Debug, Clone, Serialize, Deserialize)]
    #[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
    pub struct TemplateNode {
        /// Slug local (unique au sein du template).
        pub slug: String,
        /// Nom lisible.
        pub name: String,
        /// `root` | `entity` | `unit` | `position` | `role`.
        pub kind: String,
        /// Slug du parent, ou None pour la racine du template.
        pub parent_slug: Option<String>,
    }

    /// Une position dans le spec (liée à un node via son slug).
    #[derive(Debug, Clone, Serialize, Deserialize)]
    #[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
    pub struct TemplatePosition {
        /// Slug du node parent.
        pub node_slug: String,
        /// Libellé du poste.
        pub title: String,
        /// Nombre de sièges ouverts.
        pub head_count: i32,
    }

    /// Spec complet d'un template : nodes + positions.
    #[derive(Debug, Clone, Serialize, Deserialize)]
    #[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
    pub struct TemplateSpec {
        /// Nodes à créer (ordre DFS-safe : parent avant enfants).
        pub nodes: Vec<TemplateNode>,
        /// Positions à créer sous les nodes.
        pub positions: Vec<TemplatePosition>,
    }
}
