//! SO2 RACI matrix seeder.
//!
//! Peuple `org_raci` pour 2 projets Nexus (Project Phoenix, Project Titan)
//! avec une répartition R/A/C/I réaliste. Chaque projet a un **accountable
//! unique** (garantit par le partial unique index SQL).
//!
//! Dépend de `FocusNodesSeeder` (focus nodes `project-phoenix`,
//! `project-titan`) et `OrgSeeder` (persons).

use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::seeders::org::bump;
use crate::uuid::acme_uuid;
use async_trait::async_trait;

/// (project_slug, person_username, role).
type RaciSpec = (&'static str, &'static str, &'static str);

const RACI_ROWS: &[RaciSpec] = &[
    // ── Project Phoenix ─────────────────────────────────────────────
    ("project-phoenix", "marie.dupont", "accountable"), // CEO = A unique
    ("project-phoenix", "jean.martin", "responsible"),
    ("project-phoenix", "sophie.leroy", "responsible"),
    ("project-phoenix", "thomas.petit", "responsible"),
    ("project-phoenix", "emma.rousseau", "consulted"),
    ("project-phoenix", "lucas.fournier", "consulted"),
    ("project-phoenix", "paul.durand", "informed"),
    ("project-phoenix", "claire.moreau", "informed"),
    ("project-phoenix", "nicolas.robert", "informed"),
    ("project-phoenix", "victor.leblanc", "informed"),
    // ── Project Titan ───────────────────────────────────────────────
    ("project-titan", "jean.martin", "accountable"), // CTO = A unique
    ("project-titan", "thomas.petit", "responsible"),
    ("project-titan", "boris.lambert", "responsible"),
    ("project-titan", "marc.fontaine", "responsible"),
    ("project-titan", "raphael.benoit", "consulted"),
    ("project-titan", "zoe.marchand", "consulted"),
    ("project-titan", "marie.dupont", "informed"),
    ("project-titan", "paul.durand", "informed"),
    ("project-titan", "ines.bourdon", "informed"),
    ("project-titan", "agnes.perrin", "informed"),
];

/// Seeds 20 RACI rows across 2 projects.
pub struct RaciSeeder;

#[async_trait]
impl Seeder for RaciSeeder {
    fn name(&self) -> &'static str {
        "raci"
    }

    fn dependencies(&self) -> Vec<&'static str> {
        vec!["org", "focus_nodes"]
    }

    async fn run(&self, ctx: &SeedContext) -> anyhow::Result<SeedReport> {
        let mut report = SeedReport::default();
        let pool = ctx.db.inner();

        for (project_slug, username, role) in RACI_ROWS {
            let project_id = match resolve_project_id(ctx, project_slug).await {
                Some(id) => id,
                None => {
                    report
                        .errors
                        .push(format!("project node `{project_slug}` not found"));
                    continue;
                },
            };
            let person_id = acme_uuid("person", username);
            let id = acme_uuid("org-raci", &format!("{project_slug}-{username}-{role}"));

            let res = sqlx::query(
                r#"
                INSERT INTO org_raci (id, tenant_id, project_id, person_id, role)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (project_id, person_id, role) DO NOTHING
                "#,
            )
            .bind(id)
            .bind(ctx.tenant_id)
            .bind(project_id)
            .bind(person_id)
            .bind(role)
            .execute(pool)
            .await;
            bump(&mut report, res, "raci");
        }

        Ok(report)
    }
}

/// Look up a project node by slug, falling back to a DB lookup if the
/// `SeedContext` hasn't been populated (typical when this seeder runs
/// with `--only raci`).
async fn resolve_project_id(ctx: &SeedContext, slug: &str) -> Option<uuid::Uuid> {
    if let Some(id) = ctx.node(slug) {
        return Some(id);
    }
    let pool = ctx.db.inner();
    sqlx::query_scalar::<_, uuid::Uuid>(
        "SELECT id FROM org_nodes WHERE tenant_id = $1 AND slug = $2 LIMIT 1",
    )
    .bind(ctx.tenant_id)
    .bind(slug)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()
}
