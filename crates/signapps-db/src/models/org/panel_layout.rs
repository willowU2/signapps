//! Canonical `org_panel_layouts` table — SO6 refonte DetailPanel.
//!
//! Un **panel layout** stocke la personnalisation admin du panneau
//! droit `/admin/org-structure` pour une combinaison (tenant, role,
//! entity_type). Si aucune row n'existe pour une combinaison donnée,
//! le backend renvoie un layout hardcoded (voir
//! [`crate::repositories::org::panel_layout_repository::default_layout`]).
//!
//! Le champ `config` est un JSONB libre dont le schéma est défini par
//! [`PanelLayoutConfig`] — validé côté handler avant insertion.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Rôle applicable à un layout.
///
/// Stored as lowercase `VARCHAR(16)` (`admin`, `manager`, `viewer`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type, Hash)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[sqlx(type_name = "TEXT", rename_all = "snake_case")]
pub enum PanelRole {
    /// Administrateur tenant — voit tous les tabs par défaut.
    Admin,
    /// Manager/editor — tabs réduits (pas de gouvernance/audit).
    Manager,
    /// Viewer lecture-seule — tabs minimaux.
    Viewer,
}

impl PanelRole {
    /// Parse a string back into [`PanelRole`].
    ///
    /// # Errors
    ///
    /// Returns an `Err` for any unrecognized variant.
    pub fn parse(raw: &str) -> Result<Self, String> {
        match raw {
            "admin" => Ok(Self::Admin),
            "manager" => Ok(Self::Manager),
            "viewer" => Ok(Self::Viewer),
            other => Err(format!("unknown role: {other}")),
        }
    }

    /// Convert back to the canonical lowercase slug used in the DB.
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Admin => "admin",
            Self::Manager => "manager",
            Self::Viewer => "viewer",
        }
    }
}

/// Type d'entité ciblée par un layout.
///
/// Stored as lowercase `VARCHAR(16)` (`node`, `person`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type, Hash)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[sqlx(type_name = "TEXT", rename_all = "snake_case")]
pub enum PanelEntityType {
    /// Noeud organisationnel (tree node : group, department, team…).
    Node,
    /// Personne (employé, membre).
    Person,
}

impl PanelEntityType {
    /// Parse a string back into [`PanelEntityType`].
    ///
    /// # Errors
    ///
    /// Returns an `Err` for any unrecognized variant.
    pub fn parse(raw: &str) -> Result<Self, String> {
        match raw {
            "node" => Ok(Self::Node),
            "person" => Ok(Self::Person),
            other => Err(format!("unknown entity_type: {other}")),
        }
    }

    /// Convert back to the canonical lowercase slug used in the DB.
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Node => "node",
            Self::Person => "person",
        }
    }
}

/// One `org_panel_layouts` row.
///
/// # Examples
///
/// ```ignore
/// let layout = PanelLayout {
///     id: uuid::Uuid::new_v4(),
///     tenant_id: uuid::Uuid::new_v4(),
///     role: PanelRole::Admin,
///     entity_type: PanelEntityType::Node,
///     config: serde_json::json!({
///         "main_tabs": [],
///         "hidden_tabs": [],
///         "hero_quick_actions": [],
///         "hero_kpis": []
///     }),
///     updated_by_user_id: None,
///     updated_at: chrono::Utc::now(),
/// };
/// ```
///
/// # Panics
///
/// Aucun panic.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct PanelLayout {
    /// Identifiant unique (UUID v4).
    pub id: Uuid,
    /// Tenant propriétaire.
    pub tenant_id: Uuid,
    /// Rôle cible (admin | manager | viewer).
    pub role: PanelRole,
    /// Type d'entité cible (node | person).
    pub entity_type: PanelEntityType,
    /// Config JSONB libre — schéma défini par [`PanelLayoutConfig`].
    pub config: serde_json::Value,
    /// Utilisateur qui a modifié le layout.
    pub updated_by_user_id: Option<Uuid>,
    /// Date de dernière mise à jour (UTC).
    pub updated_at: DateTime<Utc>,
}

/// Schéma attendu du champ `config` d'un `PanelLayout`.
///
/// Utilisé pour la validation côté handler avant insertion, et pour
/// typer les default layouts hardcoded. Les champs sont tous optionnels
/// pour permettre la montée en puissance progressive — si un champ
/// manque dans la config DB, le renderer frontend retombe sur le default
/// correspondant.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct PanelLayoutConfig {
    /// Tabs principaux ordonnés (max 5 affichés, le reste va en overflow).
    #[serde(default)]
    pub main_tabs: Vec<PanelTabItem>,
    /// Ids de tabs cachés (ne jamais afficher, ni principaux ni overflow).
    #[serde(default)]
    pub hidden_tabs: Vec<String>,
    /// Liste ordonnée d'ids de quick actions du hero card.
    #[serde(default)]
    pub hero_quick_actions: Vec<String>,
    /// Liste ordonnée de KPI items affichés dans le hero.
    #[serde(default)]
    pub hero_kpis: Vec<PanelHeroKpi>,
}

/// Un item de la liste `main_tabs`.
///
/// Peut être soit un tab builtin (identifié par `id`), soit un widget
/// custom (identifié par `widget_type` + `config` libre).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum PanelTabItem {
    /// Tab standard (People, Positions, Governance…).
    Builtin {
        /// Identifiant du tab builtin.
        id: String,
        /// Position d'affichage (ordre croissant).
        #[serde(default)]
        position: i32,
    },
    /// Widget custom configuré par l'admin.
    Widget {
        /// Type de widget (kpi_card | iframe_embed | link_list | markdown_note).
        widget_type: String,
        /// Config libre JSONB spécifique au widget.
        #[serde(default)]
        config: serde_json::Value,
        /// Position d'affichage (ordre croissant).
        #[serde(default)]
        position: i32,
    },
}

/// Un item de la liste `hero_kpis`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum PanelHeroKpi {
    /// KPI built-in (headcount | positions_open | raci_count | skills_top …).
    Builtin {
        /// Identifiant du KPI builtin.
        id: String,
    },
    /// KPI custom (expression SQL + label).
    Custom {
        /// Expression libre (interprétée côté backend via l'endpoint metrics).
        expression: String,
        /// Libellé affiché à l'utilisateur.
        #[serde(default)]
        label: String,
    },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn role_roundtrips() {
        for r in [PanelRole::Admin, PanelRole::Manager, PanelRole::Viewer] {
            let parsed = PanelRole::parse(r.as_str()).expect("valid");
            assert_eq!(parsed, r);
        }
        assert!(PanelRole::parse("root").is_err());
    }

    #[test]
    fn entity_type_roundtrips() {
        for e in [PanelEntityType::Node, PanelEntityType::Person] {
            let parsed = PanelEntityType::parse(e.as_str()).expect("valid");
            assert_eq!(parsed, e);
        }
        assert!(PanelEntityType::parse("widget").is_err());
    }

    #[test]
    fn config_default_is_empty() {
        let c = PanelLayoutConfig::default();
        assert!(c.main_tabs.is_empty());
        assert!(c.hidden_tabs.is_empty());
        assert!(c.hero_quick_actions.is_empty());
        assert!(c.hero_kpis.is_empty());
    }

    #[test]
    fn tab_item_roundtrips() {
        let builtin = PanelTabItem::Builtin {
            id: "people".into(),
            position: 0,
        };
        let json = serde_json::to_string(&builtin).expect("serialize");
        assert!(json.contains("builtin"));
        let back: PanelTabItem = serde_json::from_str(&json).expect("deserialize");
        match back {
            PanelTabItem::Builtin { id, position } => {
                assert_eq!(id, "people");
                assert_eq!(position, 0);
            },
            PanelTabItem::Widget { .. } => panic!("wrong variant"),
        }
    }

    #[test]
    fn widget_item_roundtrips() {
        let widget = PanelTabItem::Widget {
            widget_type: "kpi_card".into(),
            config: serde_json::json!({"metric": "headcount"}),
            position: 1,
        };
        let json = serde_json::to_string(&widget).expect("serialize");
        let back: PanelTabItem = serde_json::from_str(&json).expect("deserialize");
        match back {
            PanelTabItem::Widget {
                widget_type,
                position,
                ..
            } => {
                assert_eq!(widget_type, "kpi_card");
                assert_eq!(position, 1);
            },
            PanelTabItem::Builtin { .. } => panic!("wrong variant"),
        }
    }
}
