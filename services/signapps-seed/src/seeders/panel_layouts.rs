//! SO6 - panel layouts seeder.
//!
//! Seeds the 6 default panel layouts for the Nexus tenant in an
//! idempotent way. Two of them are customised to showcase admin
//! personalisation :
//!   - `admin`/`node` stores a custom layout with a KPI widget at
//!     position 1, so live demos can show the widget renderer wired.
//!   - `manager`/`person` stores a layout with a markdown note widget
//!     so demos can showcase the markdown renderer.
//!
//! The remaining 4 combinations are materialised from the hardcoded
//! Rust defaults so operators end up with a full 6-row set in DB -
//! matching the SO6 spec "6 layouts seedés" acceptance criteria.

use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use async_trait::async_trait;
use serde_json::json;
use signapps_db::models::org::{PanelEntityType, PanelRole};
use signapps_db::repositories::org::default_layout;

/// Seeds 6 demo panel layouts for the Nexus tenant.
pub struct PanelLayoutsSeeder;

/// (role, entity_type, config) seed entry.
type DemoLayout = (
    &'static str,
    &'static str,
    fn() -> serde_json::Value,
);

fn admin_node_demo() -> serde_json::Value {
    json!({
        "main_tabs": [
            {"type": "builtin", "id": "people", "position": 0},
            {
                "type": "widget",
                "widget_type": "kpi_card",
                "config": {
                    "metric": "headcount",
                    "label": "Effectif live"
                },
                "position": 1
            },
            {"type": "builtin", "id": "positions", "position": 2},
            {"type": "builtin", "id": "governance", "position": 3},
            {"type": "builtin", "id": "headcount", "position": 4},
            {"type": "builtin", "id": "audit", "position": 5},
            {"type": "builtin", "id": "groups", "position": 6},
            {"type": "builtin", "id": "sites", "position": 7},
            {"type": "builtin", "id": "policies", "position": 8},
            {"type": "builtin", "id": "decisions", "position": 9},
            {"type": "builtin", "id": "raci", "position": 10},
            {"type": "builtin", "id": "delegations", "position": 11}
        ],
        "hidden_tabs": [
            "gpo", "kerberos", "dns", "dhcp", "ntp", "certificates", "deployment"
        ],
        "hero_quick_actions": ["add_child", "move", "edit", "delete"],
        "hero_kpis": [
            {"type": "builtin", "id": "headcount"},
            {"type": "builtin", "id": "positions_open"},
            {"type": "builtin", "id": "raci_count"}
        ]
    })
}

fn manager_person_demo() -> serde_json::Value {
    json!({
        "main_tabs": [
            {"type": "builtin", "id": "profile", "position": 0},
            {"type": "builtin", "id": "assignments", "position": 1},
            {"type": "builtin", "id": "skills", "position": 2},
            {
                "type": "widget",
                "widget_type": "markdown_note",
                "config": {
                    "title": "Onboarding manager",
                    "body": "# À faire la 1ère semaine\n\n- Rencontrer son **manager direct**\n- Lire la *charte équipe*\n- Accéder à son poste + ouvrir un ticket IT si besoin"
                },
                "position": 3
            }
        ],
        "hidden_tabs": [
            "gpo", "kerberos", "dns", "dhcp", "ntp", "certificates", "deployment",
            "permissions", "delegations"
        ],
        "hero_quick_actions": ["phone", "mail", "chat", "meet"],
        "hero_kpis": [
            {"type": "builtin", "id": "skills_top"},
            {"type": "builtin", "id": "assignments_active"}
        ]
    })
}

/// The 2 showcase layouts we actively insert. The remaining 4
/// combinations are materialised from the hardcoded Rust default
/// below via [`default_cfg`].
const DEMO_LAYOUTS: &[DemoLayout] = &[
    ("admin", "node", admin_node_demo),
    ("manager", "person", manager_person_demo),
];

/// All 6 (role, entity_type) combinations that must end up in DB.
const ALL_COMBOS: &[(&str, &str)] = &[
    ("admin", "node"),
    ("admin", "person"),
    ("manager", "node"),
    ("manager", "person"),
    ("viewer", "node"),
    ("viewer", "person"),
];

/// Build the JSON config for a combination that has no custom demo.
fn default_cfg(role: PanelRole, entity_type: PanelEntityType) -> serde_json::Value {
    serde_json::to_value(default_layout(role, entity_type))
        .unwrap_or_else(|_| json!({}))
}

#[async_trait]
impl Seeder for PanelLayoutsSeeder {
    fn name(&self) -> &'static str {
        "panel_layouts"
    }

    fn dependencies(&self) -> Vec<&'static str> {
        vec!["org"]
    }

    async fn run(&self, ctx: &SeedContext) -> anyhow::Result<SeedReport> {
        let mut report = SeedReport::default();
        let pool = ctx.db.inner();

        for (role_raw, entity_raw) in ALL_COMBOS {
            // Custom demo takes precedence; otherwise fallback to the
            // hardcoded Rust default so DB ends up with a full 6-row set.
            let cfg = DEMO_LAYOUTS
                .iter()
                .find(|(r, e, _)| r == role_raw && e == entity_raw)
                .map(|(_, _, build)| build())
                .unwrap_or_else(|| {
                    // These parse calls can only fail on programmer error
                    // (typo in ALL_COMBOS); rendering to default keeps the
                    // seed best-effort.
                    let role = PanelRole::parse(role_raw).unwrap_or(PanelRole::Viewer);
                    let entity_type =
                        PanelEntityType::parse(entity_raw).unwrap_or(PanelEntityType::Node);
                    default_cfg(role, entity_type)
                });

            let res = sqlx::query(
                r#"
                INSERT INTO org_panel_layouts (tenant_id, role, entity_type, config)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (tenant_id, role, entity_type) DO UPDATE SET
                    config = EXCLUDED.config,
                    updated_at = now()
                "#,
            )
            .bind(ctx.tenant_id)
            .bind(*role_raw)
            .bind(*entity_raw)
            .bind(&cfg)
            .execute(pool)
            .await;

            match res {
                Ok(r) => {
                    if r.rows_affected() > 0 {
                        report.created += 1;
                    } else {
                        report.skipped += 1;
                    }
                },
                Err(e) => report
                    .errors
                    .push(format!("panel_layout {role_raw}/{entity_raw}: {e}")),
            }
        }

        Ok(report)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn admin_node_demo_has_widget_at_position_1() {
        let cfg = admin_node_demo();
        let arr = cfg["main_tabs"].as_array().expect("array");
        let widget = arr.iter().find(|t| t["type"] == "widget").expect("widget");
        assert_eq!(widget["widget_type"], "kpi_card");
        assert_eq!(widget["position"], 1);
    }

    #[test]
    fn manager_person_demo_has_markdown_widget() {
        let cfg = manager_person_demo();
        let arr = cfg["main_tabs"].as_array().expect("array");
        let widget = arr.iter().find(|t| t["type"] == "widget").expect("widget");
        assert_eq!(widget["widget_type"], "markdown_note");
    }

    #[test]
    fn both_demos_hide_legacy_ad_tabs() {
        for build in [admin_node_demo, manager_person_demo] {
            let cfg = build();
            let hidden: Vec<String> = cfg["hidden_tabs"]
                .as_array()
                .expect("array")
                .iter()
                .map(|s| s.as_str().unwrap_or_default().to_string())
                .collect();
            for legacy in &["gpo", "kerberos", "dns", "dhcp", "ntp"] {
                assert!(
                    hidden.iter().any(|h| h == *legacy),
                    "legacy tab `{legacy}` not hidden in demo layout"
                );
            }
        }
    }
}
