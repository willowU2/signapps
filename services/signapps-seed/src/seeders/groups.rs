//! SO7 G1 — groupes transverses seeder.
//!
//! Seeds 6 canonical groups for the Nexus tenant covering the 4 kinds
//! (static, dynamic, hybrid, derived). Idempotent via ON CONFLICT on
//! `(tenant_id, slug)`.

use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::uuid::acme_uuid;
use async_trait::async_trait;
use serde_json::json;

/// Seeds 6 demo groups.
pub struct GroupsSeeder;

#[async_trait]
impl Seeder for GroupsSeeder {
    fn name(&self) -> &'static str {
        "groups"
    }

    fn dependencies(&self) -> Vec<&'static str> {
        vec!["org", "sites", "skills"]
    }

    async fn run(&self, ctx: &SeedContext) -> anyhow::Result<SeedReport> {
        let mut report = SeedReport::default();

        // ─── 1 · python-devs (dynamic) ────────────────────────────────
        upsert(
            ctx,
            &mut report,
            "python-devs",
            "Développeurs Python",
            Some("Tous les développeurs avec la compétence Python niveau 3+."),
            "dynamic",
            Some(json!({"skill": {"slug": "python", "level_min": 3}})),
            None,
        )
        .await;

        // ─── 2 · all-managers (dynamic) ───────────────────────────────
        upsert(
            ctx,
            &mut report,
            "all-managers",
            "Leads & Managers",
            Some("Toutes les personnes avec un rôle Lead/Director/Manager."),
            "dynamic",
            Some(json!({"or": [
                {"title_contains": "Lead"},
                {"title_contains": "Director"},
                {"title_contains": "Manager"},
                {"title_contains": "VP"},
            ]})),
            None,
        )
        .await;

        // ─── 3 · ethics-committee (static) ────────────────────────────
        let ethics_id = upsert(
            ctx,
            &mut report,
            "ethics-committee",
            "Comité d'éthique",
            Some("5 personnes nommées — statique."),
            "static",
            None,
            None,
        )
        .await;
        for slug in ["marie.dupont", "claire.moreau", "paul.durand", "isabelle.noel", "sophie.leroy"] {
            add_include(ctx, &mut report, ethics_id, slug).await;
        }

        // ─── 4 · engineering-broad (derived) ─────────────────────────
        // Lookup engineering node either from the context map (full seed)
        // or via a direct DB query (when running --only groups).
        let eng_node = match ctx.node("engineering") {
            Some(id) => Some(id),
            None => {
                let row: Result<Option<(uuid::Uuid,)>, _> = sqlx::query_as(
                    "SELECT id FROM org_nodes
                      WHERE tenant_id = $1 AND slug = 'engineering' LIMIT 1",
                )
                .bind(ctx.tenant_id)
                .fetch_optional(ctx.db.inner())
                .await;
                row.ok().flatten().map(|(id,)| id)
            },
        };
        if let Some(eng_id) = eng_node {
            upsert(
                ctx,
                &mut report,
                "engineering-broad",
                "Tous Engineering",
                Some("Dérivé — suit automatiquement le sous-arbre Engineering."),
                "derived",
                None,
                Some(eng_id),
            )
            .await;
        } else {
            report
                .errors
                .push("groups seeder: engineering node missing".to_string());
        }

        // ─── 5 · diversity-lunch (hybrid) ─────────────────────────────
        let div_id = upsert(
            ctx,
            &mut report,
            "diversity-lunch",
            "Lunch diversité & inclusion",
            Some("Hybrid — rôle Manager + inclusions + exclusions."),
            "hybrid",
            Some(json!({"title_contains": "Manager"})),
            None,
        )
        .await;
        add_include(ctx, &mut report, div_id, "emma.rousseau").await;
        add_include(ctx, &mut report, div_id, "raphael.benoit").await;
        add_exclude(ctx, &mut report, div_id, "marie.dupont").await;

        // ─── 6 · paris-office (dynamic, site-based) ───────────────────
        let paris_site = acme_uuid("org-site", "paris-hq");
        upsert(
            ctx,
            &mut report,
            "paris-office",
            "Équipe Paris HQ",
            Some("Dynamic — toute personne rattachée au building Paris HQ."),
            "dynamic",
            Some(json!({"site_id": paris_site})),
            None,
        )
        .await;

        Ok(report)
    }
}

async fn upsert(
    ctx: &SeedContext,
    report: &mut SeedReport,
    slug: &str,
    name: &str,
    description: Option<&str>,
    kind: &str,
    rule_json: Option<serde_json::Value>,
    source_node_id: Option<uuid::Uuid>,
) -> uuid::Uuid {
    let id = acme_uuid("org-group", slug);
    let pool = ctx.db.inner();
    let res = sqlx::query(
        r#"INSERT INTO org_groups
            (id, tenant_id, slug, name, description, kind, rule_json,
             source_node_id, attributes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '{}'::jsonb)
           ON CONFLICT (tenant_id, slug) DO UPDATE SET
             name           = EXCLUDED.name,
             description    = EXCLUDED.description,
             kind           = EXCLUDED.kind,
             rule_json      = EXCLUDED.rule_json,
             source_node_id = EXCLUDED.source_node_id,
             archived       = FALSE,
             updated_at     = now()"#,
    )
    .bind(id)
    .bind(ctx.tenant_id)
    .bind(slug)
    .bind(name)
    .bind(description)
    .bind(kind)
    .bind(rule_json)
    .bind(source_node_id)
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
        Err(e) => report.errors.push(format!("group {slug}: {e}")),
    }
    id
}

async fn add_include(
    ctx: &SeedContext,
    report: &mut SeedReport,
    group_id: uuid::Uuid,
    person_slug: &str,
) {
    add_member(ctx, report, group_id, person_slug, "include").await;
}

async fn add_exclude(
    ctx: &SeedContext,
    report: &mut SeedReport,
    group_id: uuid::Uuid,
    person_slug: &str,
) {
    add_member(ctx, report, group_id, person_slug, "exclude").await;
}

async fn add_member(
    ctx: &SeedContext,
    report: &mut SeedReport,
    group_id: uuid::Uuid,
    person_slug: &str,
    kind: &str,
) {
    let person_id = acme_uuid("person", person_slug);
    let res = sqlx::query(
        r#"INSERT INTO org_group_members (group_id, person_id, kind)
           VALUES ($1, $2, $3)
           ON CONFLICT (group_id, person_id) DO UPDATE SET
             kind = EXCLUDED.kind"#,
    )
    .bind(group_id)
    .bind(person_id)
    .bind(kind)
    .execute(ctx.db.inner())
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
            .push(format!("group member {person_slug}/{kind}: {e}")),
    }
}
