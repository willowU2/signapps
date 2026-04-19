//! SO1 focus & committee nodes + axis='focus'/'group' assignments.
//!
//! Crée 3 projets cross-team (axis='focus') + 2 committees (axis='group'),
//! tous matérialisés comme nodes `kind=unit` avec `attributes.axis_type`
//! pour permettre leur affichage séparé de l'arbre hiérarchique.
//!
//! Dépend de `OrgSeeder` (tenant + persons + assignments structure).

use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::seeders::org::bump;
use crate::uuid::acme_uuid;
use async_trait::async_trait;

/// 3 focus nodes (projects).
///
/// Tuple : (slug, name, axis_type).
const FOCUS_NODES: &[(&str, &str, &str)] = &[
    ("project-phoenix", "Project Phoenix", "project"),
    ("project-titan", "Project Titan", "project"),
    ("project-q2-launch", "Project Q2 Launch", "project"),
];

/// 2 group nodes (committees).
const GROUP_NODES: &[(&str, &str, &str)] = &[
    ("committee-csr", "CSR Committee", "committee"),
    ("committee-ethics", "Ethics Committee", "committee"),
];

/// Cross-team members for each focus project (axis='focus').
/// 5 persons per project, picked from different OUs.
const FOCUS_MEMBERS: &[(&str, &str, &str)] = &[
    // Phoenix — mix eng/sales/marketing
    ("sophie.leroy", "project-phoenix", "Lead"),
    ("emma.rousseau", "project-phoenix", "Frontend"),
    ("raphael.benoit", "project-phoenix", "AI"),
    ("nicolas.robert", "project-phoenix", "GTM"),
    ("elise.vincent", "project-phoenix", "Marketing"),
    // Titan — infra/AI/ops focused
    ("thomas.petit", "project-titan", "Platform"),
    ("zoe.marchand", "project-titan", "ML"),
    ("boris.lambert", "project-titan", "Ops"),
    ("marc.fontaine", "project-titan", "SRE"),
    ("ines.bourdon", "project-titan", "Data"),
    // Q2 Launch — product launch
    ("victor.leblanc", "project-q2-launch", "Sponsor"),
    ("lucas.fournier", "project-q2-launch", "Frontend Lead"),
    ("mathis.muller", "project-q2-launch", "Content"),
    ("jessica.nguyen", "project-q2-launch", "Sales"),
    ("antoine.bonnet", "project-q2-launch", "Support"),
];

/// Committee members (axis='group'). 5 persons per committee.
const GROUP_MEMBERS: &[(&str, &str, &str)] = &[
    // CSR — cross-functional sustainability committee
    ("claire.moreau", "committee-csr", "Chair"),
    ("elise.vincent", "committee-csr", "Marketing"),
    ("benjamin.blanc", "committee-csr", "Finance"),
    ("boris.lambert", "committee-csr", "Ops"),
    ("mia.lecomte", "committee-csr", "HR"),
    // Ethics — compliance + legal
    ("karina.teixeira", "committee-ethics", "Chair"),
    ("manu.brun", "committee-ethics", "Compliance"),
    ("paul.durand", "committee-ethics", "CFO"),
    ("jean.martin", "committee-ethics", "CTO"),
    ("agnes.perrin", "committee-ethics", "COO"),
];

/// Seeds SO1 multi-axes : 3 focus projects + 2 committees + 25 assignments.
pub struct FocusNodesSeeder;

#[async_trait]
impl Seeder for FocusNodesSeeder {
    fn name(&self) -> &'static str {
        "focus_nodes"
    }

    fn dependencies(&self) -> Vec<&'static str> {
        vec!["org"]
    }

    async fn run(&self, ctx: &SeedContext) -> anyhow::Result<SeedReport> {
        let mut report = SeedReport::default();
        let pool = ctx.db.inner();

        // 1. Focus + committee nodes as kind='unit' under root, with
        //    attributes.axis_type = project|committee.
        let root_id = ctx
            .node("root")
            .ok_or_else(|| anyhow::anyhow!("root node not registered — run OrgSeeder first"))?;

        for (slug, name, axis_type) in FOCUS_NODES.iter().chain(GROUP_NODES.iter()) {
            let id = acme_uuid("org-node", slug);
            ctx.register_node(slug, id);

            let slug_norm = slug.replace('-', "_");
            let path = format!("nexus_industries.{}", slug_norm);
            let attributes = serde_json::json!({ "axis_type": axis_type });

            let res = sqlx::query(
                r#"
                INSERT INTO org_nodes (id, tenant_id, kind, parent_id, path, name, slug, attributes, active)
                VALUES ($1, $2, 'unit', $3, $4::ltree, $5, $6, $7::jsonb, TRUE)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    slug = EXCLUDED.slug,
                    path = EXCLUDED.path,
                    attributes = EXCLUDED.attributes
                "#,
            )
            .bind(id)
            .bind(ctx.tenant_id)
            .bind(root_id)
            .bind(&path)
            .bind(name)
            .bind(slug)
            .bind(&attributes)
            .execute(pool)
            .await;
            bump(&mut report, res, "focus-or-committee-node");
        }

        // 2. Assignments axis='focus' (cross-team members).
        for (username, slug, role) in FOCUS_MEMBERS {
            let person_id = acme_uuid("person", username);
            let node_id = match ctx.node(slug) {
                Some(id) => id,
                None => {
                    report
                        .errors
                        .push(format!("focus node `{slug}` not registered"));
                    continue;
                },
            };
            let assignment_id =
                acme_uuid("org-assignment-focus", &format!("{username}-{slug}"));
            let res = sqlx::query(
                r#"
                INSERT INTO org_assignments
                    (id, tenant_id, person_id, node_id, axis, role, is_primary)
                VALUES ($1, $2, $3, $4, 'focus', $5, FALSE)
                ON CONFLICT (id) DO UPDATE SET
                    node_id = EXCLUDED.node_id,
                    role    = EXCLUDED.role
                "#,
            )
            .bind(assignment_id)
            .bind(ctx.tenant_id)
            .bind(person_id)
            .bind(node_id)
            .bind(role)
            .execute(pool)
            .await;
            bump(&mut report, res, "assignment-focus");
        }

        // 3. Assignments axis='group' (committee members).
        for (username, slug, role) in GROUP_MEMBERS {
            let person_id = acme_uuid("person", username);
            let node_id = match ctx.node(slug) {
                Some(id) => id,
                None => {
                    report
                        .errors
                        .push(format!("committee node `{slug}` not registered"));
                    continue;
                },
            };
            let assignment_id =
                acme_uuid("org-assignment-group", &format!("{username}-{slug}"));
            let res = sqlx::query(
                r#"
                INSERT INTO org_assignments
                    (id, tenant_id, person_id, node_id, axis, role, is_primary)
                VALUES ($1, $2, $3, $4, 'group', $5, FALSE)
                ON CONFLICT (id) DO UPDATE SET
                    node_id = EXCLUDED.node_id,
                    role    = EXCLUDED.role
                "#,
            )
            .bind(assignment_id)
            .bind(ctx.tenant_id)
            .bind(person_id)
            .bind(node_id)
            .bind(role)
            .execute(pool)
            .await;
            bump(&mut report, res, "assignment-group");
        }

        Ok(report)
    }
}
