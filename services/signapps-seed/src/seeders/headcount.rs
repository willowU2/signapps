//! SO3 headcount plans seeder.
//!
//! Seed 8 plans headcount pour Nexus Industries, 1 par OU top, target_date
//! = today + 90j. Deterministic via `acme_uuid`.

use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::uuid::acme_uuid;
use async_trait::async_trait;
use chrono::{Duration, Utc};

/// (ou_slug, target_head_count, notes).
type HeadcountSpec = (&'static str, i32, &'static str);

/// Target dans 90 jours. Volontairement > current pour illustrer
/// le statut "understaffed".
const PLANS: &[HeadcountSpec] = &[
    ("direction", 8, "Élargir comex (+2 VP)"),
    ("engineering", 30, "Ramp-up Q2 + Platform scale"),
    ("sales", 20, "Expansion Americas + EMEA reinforcement"),
    ("marketing", 12, "Demand gen + content team"),
    ("support", 15, "Follow customer growth"),
    ("finance", 8, "Comptabilité + analyste FP&A"),
    ("hr", 7, "Recruitement partner + people ops"),
    ("operations", 18, "IT Ops + Facilities"),
];

/// Seeds 8 headcount plans — 1 per top OU.
pub struct HeadcountSeeder;

#[async_trait]
impl Seeder for HeadcountSeeder {
    fn name(&self) -> &'static str {
        "headcount"
    }

    fn dependencies(&self) -> Vec<&'static str> {
        vec!["org"]
    }

    async fn run(&self, ctx: &SeedContext) -> anyhow::Result<SeedReport> {
        let mut report = SeedReport::default();
        let pool = ctx.db.inner();
        let target_date = (Utc::now() + Duration::days(90)).date_naive();

        for (ou_slug, target_hc, notes) in PLANS {
            let node_id = match resolve_node(ctx, ou_slug).await {
                Some(id) => id,
                None => {
                    report
                        .errors
                        .push(format!("headcount: ou `{ou_slug}` not found"));
                    continue;
                },
            };
            let id = acme_uuid("org-headcount", ou_slug);

            let res = sqlx::query(
                r#"
                INSERT INTO org_headcount_plan
                    (id, tenant_id, node_id, target_head_count, target_date, notes)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (id) DO UPDATE SET
                    target_head_count = EXCLUDED.target_head_count,
                    target_date       = EXCLUDED.target_date,
                    notes             = EXCLUDED.notes,
                    updated_at        = now()
                "#,
            )
            .bind(id)
            .bind(ctx.tenant_id)
            .bind(node_id)
            .bind(*target_hc)
            .bind(target_date)
            .bind(*notes)
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
                Err(e) => report.errors.push(format!("headcount {ou_slug}: {e}")),
            }
        }

        Ok(report)
    }
}

async fn resolve_node(ctx: &SeedContext, slug: &str) -> Option<uuid::Uuid> {
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
