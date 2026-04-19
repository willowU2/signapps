//! Org structure seeder — Acme Corp tenant + 4 OUs + 15 persons.
//!
//! Real schema notes (differs from plan):
//! - `public.org_nodes` (not `org.org_nodes`)
//! - columns: `id, tenant_id, kind, parent_id, path, name, slug, attributes, active`
//! - `public.org_persons`: `id, tenant_id, user_id, email, first_name, last_name, dn, attributes, active`
//! - `public.org_assignments`: `id, tenant_id, person_id, node_id, axis, role, is_primary, ...`

use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::uuid::acme_uuid;
use async_trait::async_trait;

/// Seeds the Acme Corp tenant row, org tree, and persons with assignments.
pub struct OrgSeeder;

/// Tuple layout: (username, first_name, last_name, email, ou_slug, title).
pub type Person = (
    &'static str,
    &'static str,
    &'static str,
    &'static str,
    &'static str,
    &'static str,
);

/// Flat list of all 4 Acme Corp OUs (slug, display name).
pub const OUS: &[(&str, &str)] = &[
    ("direction", "Direction"),
    ("engineering", "Engineering"),
    ("sales", "Sales"),
    ("support", "Support"),
];

/// Flat list of all 15 Acme Corp persons. Shared with other seeders.
pub const PERSONS: &[Person] = &[
    ("marie.dupont", "Marie", "Dupont", "marie.dupont@acme.corp", "direction", "Directrice générale"),
    ("paul.durand", "Paul", "Durand", "paul.durand@acme.corp", "direction", "DAF"),
    ("claire.moreau", "Claire", "Moreau", "claire.moreau@acme.corp", "direction", "DRH"),
    ("jean.martin", "Jean", "Martin", "jean.martin@acme.corp", "engineering", "CTO"),
    ("sophie.leroy", "Sophie", "Leroy", "sophie.leroy@acme.corp", "engineering", "Tech Lead"),
    ("thomas.petit", "Thomas", "Petit", "thomas.petit@acme.corp", "engineering", "Senior Dev"),
    ("emma.rousseau", "Emma", "Rousseau", "emma.rousseau@acme.corp", "engineering", "Dev"),
    ("lucas.fournier", "Lucas", "Fournier", "lucas.fournier@acme.corp", "engineering", "Dev"),
    ("julie.bernard", "Julie", "Bernard", "julie.bernard@acme.corp", "engineering", "DevOps"),
    ("nicolas.robert", "Nicolas", "Robert", "nicolas.robert@acme.corp", "sales", "Dir. Sales"),
    ("anne.girard", "Anne", "Girard", "anne.girard@acme.corp", "sales", "Account Manager"),
    ("pierre.lefebvre", "Pierre", "Lefebvre", "pierre.lefebvre@acme.corp", "sales", "Business Dev"),
    ("camille.mercier", "Camille", "Mercier", "camille.mercier@acme.corp", "sales", "SDR"),
    ("antoine.bonnet", "Antoine", "Bonnet", "antoine.bonnet@acme.corp", "support", "Support Lead"),
    ("isabelle.noel", "Isabelle", "Noel", "isabelle.noel@acme.corp", "support", "Support Agent"),
];

#[async_trait]
impl Seeder for OrgSeeder {
    fn name(&self) -> &'static str {
        "org"
    }

    async fn run(&self, ctx: &SeedContext) -> anyhow::Result<SeedReport> {
        let mut report = SeedReport::default();
        let pool = ctx.db.inner();

        // Tenant row is created in lib::resolve_or_create_tenant before this
        // seeder runs, so ctx.tenant_id is always valid.

        // Root org node
        let root_id = acme_uuid("org-node", "acme-corp");
        ctx.register_node("root", root_id);
        let res = sqlx::query(
            r#"
            INSERT INTO org_nodes (id, tenant_id, kind, parent_id, path, name, slug, active)
            VALUES ($1, $2, 'company', NULL, 'acme_corp'::ltree, 'Acme Corp', 'acme-corp', TRUE)
            ON CONFLICT (id) DO NOTHING
            "#,
        )
        .bind(root_id)
        .bind(ctx.tenant_id)
        .execute(pool)
        .await;
        bump(&mut report, res, "root-node");

        // 4 OUs
        for (slug, name) in OUS.iter() {
            let id = acme_uuid("org-node", slug);
            ctx.register_node(slug, id);
            let path = format!("acme_corp.{}", slug.replace('-', "_"));
            let res = sqlx::query(
                r#"
                INSERT INTO org_nodes (id, tenant_id, kind, parent_id, path, name, slug, active)
                VALUES ($1, $2, 'ou', $3, $4::ltree, $5, $6, TRUE)
                ON CONFLICT (id) DO NOTHING
                "#,
            )
            .bind(id)
            .bind(ctx.tenant_id)
            .bind(root_id)
            .bind(&path)
            .bind(name)
            .bind(slug)
            .execute(pool)
            .await;
            bump(&mut report, res, "ou");
        }

        // 15 persons + primary assignments
        for (username, first_name, last_name, email, ou, title) in PERSONS.iter() {
            let person_id = acme_uuid("person", username);
            let user_id = acme_uuid("user", username);
            let node_id = ctx
                .node(ou)
                .ok_or_else(|| anyhow::anyhow!("OU not registered: {}", ou))?;

            let attributes = serde_json::json!({
                "title": title,
                "username": username,
            });

            let res = sqlx::query(
                r#"
                INSERT INTO org_persons (id, tenant_id, user_id, email, first_name, last_name, attributes, active)
                VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, TRUE)
                ON CONFLICT (id) DO NOTHING
                "#,
            )
            .bind(person_id)
            .bind(ctx.tenant_id)
            .bind(user_id)
            .bind(email)
            .bind(first_name)
            .bind(last_name)
            .bind(&attributes)
            .execute(pool)
            .await;
            bump(&mut report, res, "person");

            let assignment_id = acme_uuid("org-assignment", username);
            let res = sqlx::query(
                r#"
                INSERT INTO org_assignments (id, tenant_id, person_id, node_id, axis, role, is_primary)
                VALUES ($1, $2, $3, $4, 'hierarchy', 'member', TRUE)
                ON CONFLICT (id) DO NOTHING
                "#,
            )
            .bind(assignment_id)
            .bind(ctx.tenant_id)
            .bind(person_id)
            .bind(node_id)
            .execute(pool)
            .await;
            bump(&mut report, res, "assignment");

            ctx.register_user(username, user_id);
        }

        Ok(report)
    }
}

/// Helper: bump the report counters based on a SQLx query result.
pub(crate) fn bump(
    report: &mut SeedReport,
    res: Result<sqlx::postgres::PgQueryResult, sqlx::Error>,
    kind: &str,
) {
    match res {
        Ok(r) => {
            if r.rows_affected() > 0 {
                report.created += r.rows_affected() as usize;
            } else {
                report.skipped += 1;
            }
        }
        Err(e) => report.errors.push(format!("{kind}: {e}")),
    }
}
