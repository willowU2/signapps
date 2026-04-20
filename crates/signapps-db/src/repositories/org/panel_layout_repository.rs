//! CRUD for `org_panel_layouts` — SO6 refonte DetailPanel.
//!
//! Lookup par `(tenant_id, role, entity_type)`. Si aucune row custom
//! existe, [`default_layout`] renvoie un layout hardcoded issu des 6
//! combinaisons (3 rôles × 2 entity_types) pensées par la spec SO6.
//!
//! Les tabs dits « legacy AD » (gpo, kerberos, dns, dhcp, ntp,
//! certificates, deployment) sont listés dans `hidden_tabs` par défaut
//! pour tous les rôles.

use anyhow::Result;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::org::{
    PanelEntityType, PanelLayout, PanelLayoutConfig, PanelRole, PanelTabItem,
};

/// Ids de tabs legacy AD masqués par défaut pour tous les rôles.
///
/// L'admin peut les réactiver via la page `/admin/settings/panel-layout`.
pub const LEGACY_HIDDEN_TABS: &[&str] = &[
    "gpo",
    "kerberos",
    "dns",
    "dhcp",
    "ntp",
    "certificates",
    "deployment",
];

/// Repository for the canonical `org_panel_layouts` table.
pub struct PanelLayoutRepository<'a> {
    pool: &'a PgPool,
}

impl<'a> PanelLayoutRepository<'a> {
    /// Construct a new repository bound to the given pool.
    pub fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    /// Fetch a custom layout for `(tenant, role, entity_type)` if one exists.
    ///
    /// Returns `None` when no custom row has been inserted — callers are
    /// expected to fall back on [`default_layout`] in that case.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn get(
        &self,
        tenant_id: Uuid,
        role: PanelRole,
        entity_type: PanelEntityType,
    ) -> Result<Option<PanelLayout>> {
        let row = sqlx::query_as::<_, PanelLayout>(
            "SELECT id, tenant_id, role, entity_type, config,
                    updated_by_user_id, updated_at
               FROM org_panel_layouts
              WHERE tenant_id = $1 AND role = $2 AND entity_type = $3",
        )
        .bind(tenant_id)
        .bind(role.as_str())
        .bind(entity_type.as_str())
        .fetch_optional(self.pool)
        .await?;
        Ok(row)
    }

    /// Upsert the custom layout for `(tenant, role, entity_type)`.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn upsert(
        &self,
        tenant_id: Uuid,
        role: PanelRole,
        entity_type: PanelEntityType,
        config: serde_json::Value,
        updated_by_user_id: Option<Uuid>,
    ) -> Result<PanelLayout> {
        let row = sqlx::query_as::<_, PanelLayout>(
            "INSERT INTO org_panel_layouts
                (tenant_id, role, entity_type, config, updated_by_user_id)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (tenant_id, role, entity_type) DO UPDATE SET
                config = EXCLUDED.config,
                updated_by_user_id = EXCLUDED.updated_by_user_id,
                updated_at = now()
             RETURNING id, tenant_id, role, entity_type, config,
                       updated_by_user_id, updated_at",
        )
        .bind(tenant_id)
        .bind(role.as_str())
        .bind(entity_type.as_str())
        .bind(config)
        .bind(updated_by_user_id)
        .fetch_one(self.pool)
        .await?;
        Ok(row)
    }

    /// Delete the custom layout, falling back to the default on next fetch.
    ///
    /// Returns the number of rows deleted (0 or 1).
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn delete(
        &self,
        tenant_id: Uuid,
        role: PanelRole,
        entity_type: PanelEntityType,
    ) -> Result<u64> {
        let res = sqlx::query(
            "DELETE FROM org_panel_layouts
              WHERE tenant_id = $1 AND role = $2 AND entity_type = $3",
        )
        .bind(tenant_id)
        .bind(role.as_str())
        .bind(entity_type.as_str())
        .execute(self.pool)
        .await?;
        Ok(res.rows_affected())
    }
}

/// Build the hardcoded default layout for a `(role, entity_type)` combo.
///
/// Called by the handler when no custom row is present in DB. The 6
/// combinations are:
///
/// | Role    | Entity | Main tabs                                               |
/// |---------|--------|---------------------------------------------------------|
/// | admin   | node   | people, positions, governance, headcount, audit         |
/// | admin   | person | profile, assignments, skills, permissions, delegations  |
/// | manager | node   | people, positions, headcount                            |
/// | manager | person | profile, assignments, skills                            |
/// | viewer  | node   | people                                                  |
/// | viewer  | person | profile, skills                                         |
#[must_use]
pub fn default_layout(role: PanelRole, entity_type: PanelEntityType) -> PanelLayoutConfig {
    let (main_ids, hidden_ids, quick_actions, kpi_ids): (
        &[&str],
        Vec<&str>,
        &[&str],
        &[&str],
    ) = match (role, entity_type) {
        // ── Admin / Node ────────────────────────────────────────────
        (PanelRole::Admin, PanelEntityType::Node) => (
            &[
                "people",
                "positions",
                "governance",
                "headcount",
                "audit",
                // Extras below go into the "..." overflow menu (after MAX_MAIN_TABS=5).
                "groups",
                "sites",
                // SO8 — resources right after sites so admin can pivot from
                // physical space to the assets based there.
                "resources",
                "policies",
                "decisions",
                "raci",
                "delegations",
            ],
            LEGACY_HIDDEN_TABS.to_vec(),
            &["add_child", "move", "edit", "delete"],
            &["headcount", "positions_open", "raci_count"],
        ),

        // ── Admin / Person ──────────────────────────────────────────
        (PanelRole::Admin, PanelEntityType::Person) => (
            &[
                "profile",
                "assignments",
                "skills",
                "permissions",
                "delegations",
                // Overflow "..." menu.
                "groups",
                "sites",
                // SO8 — after sites so admin can see the person's assigned
                // resources next to their physical location.
                "resources",
                "audit",
            ],
            LEGACY_HIDDEN_TABS.to_vec(),
            &["phone", "mail", "chat", "meet", "edit"],
            &["skills_top", "assignments_active", "permissions_level"],
        ),

        // ── Manager / Node ──────────────────────────────────────────
        (PanelRole::Manager, PanelEntityType::Node) => (
            &["people", "positions", "headcount"],
            {
                let mut v = LEGACY_HIDDEN_TABS.to_vec();
                v.extend_from_slice(&["governance", "audit", "policies"]);
                v
            },
            &["add_child", "edit"],
            &["headcount", "positions_open"],
        ),

        // ── Manager / Person ────────────────────────────────────────
        (PanelRole::Manager, PanelEntityType::Person) => (
            &["profile", "assignments", "skills"],
            {
                let mut v = LEGACY_HIDDEN_TABS.to_vec();
                v.extend_from_slice(&["permissions", "delegations"]);
                v
            },
            &["phone", "mail", "chat", "meet"],
            &["skills_top", "assignments_active"],
        ),

        // ── Viewer / Node ───────────────────────────────────────────
        (PanelRole::Viewer, PanelEntityType::Node) => (
            &["people"],
            {
                let mut v = LEGACY_HIDDEN_TABS.to_vec();
                v.extend_from_slice(&[
                    "positions",
                    "governance",
                    "headcount",
                    "audit",
                    "policies",
                ]);
                v
            },
            &[],
            &["headcount"],
        ),

        // ── Viewer / Person ─────────────────────────────────────────
        (PanelRole::Viewer, PanelEntityType::Person) => (
            &["profile", "skills"],
            {
                let mut v = LEGACY_HIDDEN_TABS.to_vec();
                v.extend_from_slice(&[
                    "assignments",
                    "permissions",
                    "delegations",
                ]);
                v
            },
            &["phone", "mail"],
            &["skills_top"],
        ),
    };

    let main_tabs: Vec<PanelTabItem> = main_ids
        .iter()
        .enumerate()
        .map(|(idx, id)| PanelTabItem::Builtin {
            id: (*id).to_string(),
            position: i32::try_from(idx).unwrap_or(i32::MAX),
        })
        .collect();

    let hidden_tabs: Vec<String> = hidden_ids.into_iter().map(ToString::to_string).collect();
    let hero_quick_actions: Vec<String> = quick_actions.iter().map(|s| (*s).to_string()).collect();
    let hero_kpis: Vec<crate::models::org::PanelHeroKpi> = kpi_ids
        .iter()
        .map(|id| crate::models::org::PanelHeroKpi::Builtin {
            id: (*id).to_string(),
        })
        .collect();

    PanelLayoutConfig {
        main_tabs,
        hidden_tabs,
        hero_quick_actions,
        hero_kpis,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn legacy_hidden_tabs_cover_all_legacy_ids() {
        // Smoke check that the list matches what the spec demands.
        assert!(LEGACY_HIDDEN_TABS.contains(&"gpo"));
        assert!(LEGACY_HIDDEN_TABS.contains(&"kerberos"));
        assert!(LEGACY_HIDDEN_TABS.contains(&"dns"));
        assert!(LEGACY_HIDDEN_TABS.contains(&"dhcp"));
        assert!(LEGACY_HIDDEN_TABS.contains(&"ntp"));
        assert!(LEGACY_HIDDEN_TABS.contains(&"certificates"));
        assert!(LEGACY_HIDDEN_TABS.contains(&"deployment"));
    }

    fn tab_ids(cfg: &PanelLayoutConfig) -> Vec<String> {
        cfg.main_tabs
            .iter()
            .filter_map(|t| match t {
                PanelTabItem::Builtin { id, .. } => Some(id.clone()),
                PanelTabItem::Widget { .. } => None,
            })
            .collect()
    }

    #[test]
    fn admin_node_default_has_5_main_tabs() {
        let cfg = default_layout(PanelRole::Admin, PanelEntityType::Node);
        let ids = tab_ids(&cfg);
        // Hero 5 + overflow — we assert the first 5 since MAX_MAIN_TABS=5
        // on the UI side. Overflow lives in `...` menu.
        assert!(ids.len() >= 5, "admin/node must carry at least 5 tabs");
        assert_eq!(
            &ids[0..5],
            &[
                "people".to_string(),
                "positions".to_string(),
                "governance".to_string(),
                "headcount".to_string(),
                "audit".to_string(),
            ]
        );
        // SO8 addition — `resources` must be in overflow.
        assert!(
            ids.contains(&"resources".to_string()),
            "admin/node must include 'resources' in overflow"
        );
        assert!(cfg.hidden_tabs.iter().any(|s| s == "gpo"));
    }

    #[test]
    fn admin_person_default_has_5_main_tabs() {
        let cfg = default_layout(PanelRole::Admin, PanelEntityType::Person);
        let ids = tab_ids(&cfg);
        assert!(
            ids.len() >= 5,
            "admin/person must carry at least 5 tabs"
        );
        assert_eq!(
            &ids[0..5],
            &[
                "profile".to_string(),
                "assignments".to_string(),
                "skills".to_string(),
                "permissions".to_string(),
                "delegations".to_string(),
            ]
        );
        // SO8 addition — `resources` must be in overflow.
        assert!(ids.contains(&"resources".to_string()));
    }

    #[test]
    fn manager_node_omits_governance_and_audit() {
        let cfg = default_layout(PanelRole::Manager, PanelEntityType::Node);
        let ids = tab_ids(&cfg);
        assert!(!ids.contains(&"governance".to_string()));
        assert!(!ids.contains(&"audit".to_string()));
        // Manager must see headcount to plan capacity.
        assert!(ids.contains(&"headcount".to_string()));
    }

    #[test]
    fn manager_person_omits_permissions_and_delegations() {
        let cfg = default_layout(PanelRole::Manager, PanelEntityType::Person);
        let ids = tab_ids(&cfg);
        assert_eq!(ids, vec!["profile", "assignments", "skills"]);
    }

    #[test]
    fn viewer_node_has_people_only() {
        let cfg = default_layout(PanelRole::Viewer, PanelEntityType::Node);
        let ids = tab_ids(&cfg);
        assert_eq!(ids, vec!["people"]);
    }

    #[test]
    fn viewer_person_has_profile_and_skills_only() {
        let cfg = default_layout(PanelRole::Viewer, PanelEntityType::Person);
        let ids = tab_ids(&cfg);
        assert_eq!(ids, vec!["profile", "skills"]);
    }

    #[test]
    fn all_defaults_have_hero_kpis() {
        for role in [PanelRole::Admin, PanelRole::Manager, PanelRole::Viewer] {
            for entity in [PanelEntityType::Node, PanelEntityType::Person] {
                let cfg = default_layout(role, entity);
                assert!(
                    !cfg.hero_kpis.is_empty(),
                    "missing hero_kpis for {role:?} / {entity:?}"
                );
            }
        }
    }
}
