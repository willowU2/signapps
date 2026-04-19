//! SO7 G1 — groupes transverses seeder (enriched Nexus demo).
//!
//! Seeds ~25 canonical groups for the Nexus tenant covering the 4 kinds
//! (static, dynamic, hybrid, derived), reflecting realistic enterprise
//! communities (communities-of-practice, committees, all-hands circles,
//! site-based groups). Idempotent via `ON CONFLICT` on `(tenant_id, slug)`.
//!
//! Layout :
//! - 12 dynamic  : skill / title / site / language based communities
//! - 8  static   : named committees and boards
//! - 3  hybrid   : rule + explicit includes/excludes
//! - 4  derived  : follow a whole sub-tree

use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::uuid::acme_uuid;
use async_trait::async_trait;
use serde_json::{json, Value};

/// Lightweight spec for a group — resolved against `SeedContext` at run-time.
///
/// `rule` is serialized verbatim into `org_groups.rule_json`. `source_node`
/// is the optional `org_nodes.slug` used for `kind='derived'`.
struct GroupSpec {
    slug: &'static str,
    name: &'static str,
    description: &'static str,
    kind: &'static str,
    rule: Option<Value>,
    source_node: Option<&'static str>,
    includes: &'static [&'static str],
    excludes: &'static [&'static str],
}

/// Seeds ~25 demo groups spanning the 4 group kinds.
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

        // Resolve the 4 source nodes lazily — derived groups refer to them.
        let specs = build_specs();

        for spec in &specs {
            let source_id = match spec.source_node {
                Some(slug) => resolve_node(ctx, slug).await,
                None => None,
            };
            if spec.kind == "derived" && source_id.is_none() {
                report
                    .errors
                    .push(format!("group {}: source_node missing", spec.slug));
                continue;
            }
            let group_id = upsert(
                ctx,
                &mut report,
                spec.slug,
                spec.name,
                Some(spec.description),
                spec.kind,
                spec.rule.clone(),
                source_id,
            )
            .await;
            for slug in spec.includes {
                add_member(ctx, &mut report, group_id, slug, "include").await;
            }
            for slug in spec.excludes {
                add_member(ctx, &mut report, group_id, slug, "exclude").await;
            }
        }

        Ok(report)
    }
}

/// Build the full list of ~25 group specs. Kept as a function to keep the
/// `Value`s cheap to clone only once and avoid the `Sync` issue on
/// `serde_json::Value` constants.
fn build_specs() -> Vec<GroupSpec> {
    let paris_site = acme_uuid("org-site", "paris-hq");
    let amsterdam_site = acme_uuid("org-site", "amsterdam-hub");

    vec![
        // ─── Dynamic : communities of practice (12) ───────────────────────
        GroupSpec {
            slug: "python-devs",
            name: "Développeurs Python",
            description: "Tous les développeurs avec la compétence Python niveau 2+.",
            kind: "dynamic",
            rule: Some(json!({"skill": {"slug": "python", "level_min": 2}})),
            source_node: None,
            includes: &[],
            excludes: &[],
        },
        GroupSpec {
            slug: "rust-devs",
            name: "Développeurs Rust",
            description: "Communauté Rust — niveau 2+ sur la compétence rust.",
            kind: "dynamic",
            rule: Some(json!({"skill": {"slug": "rust", "level_min": 2}})),
            source_node: None,
            includes: &[],
            excludes: &[],
        },
        GroupSpec {
            slug: "typescript-devs",
            name: "Développeurs TypeScript",
            description: "TypeScript practitioners — niveau 2+.",
            kind: "dynamic",
            rule: Some(json!({"skill": {"slug": "typescript", "level_min": 2}})),
            source_node: None,
            includes: &[],
            excludes: &[],
        },
        GroupSpec {
            slug: "ai-researchers",
            name: "AI Researchers",
            description: "Équipe AI + toute personne avec python niveau 4+.",
            kind: "dynamic",
            rule: Some(json!({"or": [
                {"node_path": "nexus_industries.engineering.eng_ai"},
                {"skill": {"slug": "python", "level_min": 4}},
            ]})),
            source_node: None,
            includes: &[],
            excludes: &[],
        },
        GroupSpec {
            slug: "frontend-guild",
            name: "Frontend Guild",
            description: "Toute personne avec react 2+ ou rattachée à l'équipe Frontend.",
            kind: "dynamic",
            rule: Some(json!({"or": [
                {"skill": {"slug": "react", "level_min": 2}},
                {"node_path": "nexus_industries.engineering.eng_frontend"},
            ]})),
            source_node: None,
            includes: &[],
            excludes: &[],
        },
        GroupSpec {
            slug: "devops-guild",
            name: "DevOps Guild",
            description: "Tout profil maîtrisant au moins un outil DevOps (kubernetes, docker, terraform).",
            kind: "dynamic",
            rule: Some(json!({"or": [
                {"skill": {"slug": "kubernetes", "level_min": 2}},
                {"skill": {"slug": "docker", "level_min": 3}},
                {"skill": {"slug": "terraform", "level_min": 3}},
            ]})),
            source_node: None,
            includes: &[],
            excludes: &[],
        },
        GroupSpec {
            slug: "security-champions",
            name: "Security Champions",
            description: "Référents sécurité — skill security niveau 3+.",
            kind: "dynamic",
            rule: Some(json!({"skill": {"slug": "security", "level_min": 3}})),
            source_node: None,
            includes: &[],
            excludes: &[],
        },
        GroupSpec {
            slug: "data-enthusiasts",
            name: "Data Enthusiasts",
            description: "Profils data — SQL 3+ ou data engineering.",
            kind: "dynamic",
            rule: Some(json!({"or": [
                {"skill": {"slug": "sql", "level_min": 3}},
                {"skill": {"slug": "data_engineering", "level_min": 2}},
            ]})),
            source_node: None,
            includes: &[],
            excludes: &[],
        },
        GroupSpec {
            slug: "english-speakers",
            name: "English Speakers",
            description: "Toute personne parlant anglais niveau 3+.",
            kind: "dynamic",
            rule: Some(json!({"skill": {"slug": "english", "level_min": 3}})),
            source_node: None,
            includes: &[],
            excludes: &[],
        },
        GroupSpec {
            slug: "all-managers",
            name: "Leads & Managers",
            description: "Toutes les personnes avec un rôle Lead/Director/Manager/VP.",
            kind: "dynamic",
            rule: Some(json!({"or": [
                {"title_contains": "Lead"},
                {"title_contains": "Director"},
                {"title_contains": "Manager"},
                {"title_contains": "VP"},
                {"title_contains": "CEO"},
                {"title_contains": "CTO"},
                {"title_contains": "CFO"},
                {"title_contains": "CMO"},
                {"title_contains": "COO"},
                {"title_contains": "CHRO"},
            ]})),
            source_node: None,
            includes: &[],
            excludes: &[],
        },
        GroupSpec {
            slug: "paris-office",
            name: "Équipe Paris HQ",
            description: "Dynamic — toute personne rattachée au building Paris HQ.",
            kind: "dynamic",
            rule: Some(json!({"site_id": paris_site})),
            source_node: None,
            includes: &[],
            excludes: &[],
        },
        GroupSpec {
            slug: "amsterdam-office",
            name: "Équipe Amsterdam Tech Hub",
            description: "Dynamic — toute personne rattachée au building Amsterdam Tech Hub.",
            kind: "dynamic",
            rule: Some(json!({"site_id": amsterdam_site})),
            source_node: None,
            includes: &[],
            excludes: &[],
        },
        // ─── Static : named committees (8) ────────────────────────────────
        GroupSpec {
            slug: "ethics-committee",
            name: "Comité d'éthique",
            description: "Comité d'éthique — 5 personnes nommées.",
            kind: "static",
            rule: None,
            source_node: None,
            includes: &[
                "marie.dupont",
                "claire.moreau",
                "paul.durand",
                "isabelle.noel",
                "sophie.leroy",
            ],
            excludes: &[],
        },
        GroupSpec {
            slug: "csr-committee",
            name: "Comité RSE",
            description: "Responsabilité Sociétale — 6 représentants métiers.",
            kind: "static",
            rule: None,
            source_node: None,
            includes: &[
                "marie.dupont",
                "claire.moreau",
                "victor.leblanc",
                "elise.vincent",
                "iris.delmas",
                "manu.brun",
            ],
            excludes: &[],
        },
        GroupSpec {
            slug: "diversity-inclusion-council",
            name: "Conseil Diversité & Inclusion",
            description: "Conseil D&I — 7 ambassadeurs issus de chaque métier.",
            kind: "static",
            rule: None,
            source_node: None,
            includes: &[
                "claire.moreau",
                "mia.lecomte",
                "emma.rousseau",
                "sarah.lopez",
                "jessica.nguyen",
                "raphael.benoit",
                "ambre.boyer",
            ],
            excludes: &[],
        },
        GroupSpec {
            slug: "security-review-board",
            name: "Security Review Board",
            description: "SRB — tech leads + CTO pour revue sécurité.",
            kind: "static",
            rule: None,
            source_node: None,
            includes: &[
                "jean.martin",
                "sophie.leroy",
                "marc.fontaine",
                "raphael.benoit",
                "emma.rousseau",
            ],
            excludes: &[],
        },
        GroupSpec {
            slug: "architecture-review-board",
            name: "Architecture Review Board",
            description: "ARB — architectes seniors qui valident les ADR.",
            kind: "static",
            rule: None,
            source_node: None,
            includes: &[
                "jean.martin",
                "sophie.leroy",
                "thomas.petit",
                "emma.rousseau",
                "raphael.benoit",
                "marc.fontaine",
            ],
            excludes: &[],
        },
        GroupSpec {
            slug: "crisis-response-team",
            name: "Crisis Response Team",
            description: "CRT — cellule de crise activable 24/7.",
            kind: "static",
            rule: None,
            source_node: None,
            includes: &[
                "jean.martin",
                "agnes.perrin",
                "claire.moreau",
                "antoine.bonnet",
            ],
            excludes: &[],
        },
        GroupSpec {
            slug: "all-hands-speakers",
            name: "All-Hands Speakers",
            description: "Rotation des intervenants du all-hands mensuel.",
            kind: "static",
            rule: None,
            source_node: None,
            includes: &["marie.dupont", "jean.martin", "victor.leblanc"],
            excludes: &[],
        },
        GroupSpec {
            slug: "board-advisors",
            name: "Board Advisors",
            description: "Board + 1 advisor externe simulé (représenté par la COO).",
            kind: "static",
            rule: None,
            source_node: None,
            includes: &[
                "marie.dupont",
                "paul.durand",
                "jean.martin",
                "agnes.perrin",
            ],
            excludes: &[],
        },
        // ─── Hybrid : rule + explicit includes/excludes (3) ───────────────
        GroupSpec {
            slug: "manager-council",
            name: "Manager Council",
            description: "Managers (title Lead) + inclusions C-level + exclusion 1 junior.",
            kind: "hybrid",
            rule: Some(json!({"title_contains": "Lead"})),
            source_node: None,
            includes: &["marie.dupont", "paul.durand", "agnes.perrin"],
            excludes: &["hugo.dumont"],
        },
        GroupSpec {
            slug: "new-joiners-2026",
            name: "Nouveaux arrivants 2026",
            description: "Juniors (title Junior) + inclusions seniors mentors.",
            kind: "hybrid",
            rule: Some(json!({"title_contains": "Junior"})),
            source_node: None,
            includes: &["thomas.petit", "emma.rousseau"],
            excludes: &[],
        },
        GroupSpec {
            slug: "diversity-lunch",
            name: "Lunch diversité & inclusion",
            description: "Hybrid — Managers + inclusions volontaires + exclusions.",
            kind: "hybrid",
            rule: Some(json!({"title_contains": "Manager"})),
            source_node: None,
            includes: &["emma.rousseau", "raphael.benoit"],
            excludes: &["marie.dupont"],
        },
        // ─── Derived : follow a whole sub-tree (4) ────────────────────────
        GroupSpec {
            slug: "all-engineering",
            name: "Tous Engineering",
            description: "Dérivé — suit automatiquement le sous-arbre Engineering.",
            kind: "derived",
            rule: None,
            source_node: Some("engineering"),
            includes: &[],
            excludes: &[],
        },
        GroupSpec {
            slug: "all-sales",
            name: "Tous Sales",
            description: "Dérivé — suit le sous-arbre Sales (EMEA + Americas).",
            kind: "derived",
            rule: None,
            source_node: Some("sales"),
            includes: &[],
            excludes: &[],
        },
        GroupSpec {
            slug: "all-direction",
            name: "Toute la direction",
            description: "Dérivé — Direction (CEO / CTO / CFO / CMO / COO).",
            kind: "derived",
            rule: None,
            source_node: Some("direction"),
            includes: &[],
            excludes: &[],
        },
        GroupSpec {
            slug: "all-hr",
            name: "Toute l'équipe HR",
            description: "Dérivé — suit automatiquement le sous-arbre HR.",
            kind: "derived",
            rule: None,
            source_node: Some("hr"),
            includes: &[],
            excludes: &[],
        },
        // Legacy alias preserved so existing e2e fixtures continue to pass.
        GroupSpec {
            slug: "engineering-broad",
            name: "Tous Engineering (alias)",
            description: "Alias historique — identique à all-engineering.",
            kind: "derived",
            rule: None,
            source_node: Some("engineering"),
            includes: &[],
            excludes: &[],
        },
    ]
}

async fn resolve_node(ctx: &SeedContext, slug: &str) -> Option<uuid::Uuid> {
    if let Some(id) = ctx.node(slug) {
        return Some(id);
    }
    let row: Result<Option<(uuid::Uuid,)>, _> = sqlx::query_as(
        "SELECT id FROM org_nodes WHERE tenant_id = $1 AND slug = $2 LIMIT 1",
    )
    .bind(ctx.tenant_id)
    .bind(slug)
    .fetch_optional(ctx.db.inner())
    .await;
    row.ok().flatten().map(|(id,)| id)
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
