//! SO1 positions + incumbents seeder.
//!
//! 8 positions démo dont 5 avec incumbents ; 3 positions ont des sièges
//! vacants pour illustrer "N/M pourvus · K ouvert(s)".
//!
//! Dépend de `OrgSeeder` (persons + nodes).

use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::seeders::org::bump;
use crate::uuid::acme_uuid;
use async_trait::async_trait;

/// Tuple layout : (position_slug, node_slug, title, head_count, incumbent_usernames).
///
/// `incumbent_usernames` peut contenir moins d'entrées que `head_count`
/// → les sièges restants sont vacants.
type PositionSpec = (&'static str, &'static str, &'static str, i32, &'static [&'static str]);

const POSITIONS: &[PositionSpec] = &[
    // 1. CEO — 1 siège, 1 pourvu.
    (
        "pos-ceo",
        "direction",
        "CEO",
        1,
        &["marie.dupont"],
    ),
    // 2. CTO — 1/1.
    (
        "pos-cto",
        "direction",
        "CTO",
        1,
        &["jean.martin"],
    ),
    // 3. Senior Platform Eng — 3 sièges, 2 pourvus → 1 vacant.
    (
        "pos-senior-platform",
        "eng-platform",
        "Senior Platform Engineer",
        3,
        &["thomas.petit", "leo.garnier"],
    ),
    // 4. Frontend Eng — 4 sièges, 3 pourvus → 1 vacant.
    (
        "pos-frontend",
        "eng-frontend",
        "Frontend Engineer",
        4,
        &["chloe.henry", "axel.morin", "hugo.dumont"],
    ),
    // 5. Account Exec EMEA — 2/2.
    (
        "pos-ae-emea",
        "sales-emea",
        "Account Executive EMEA",
        2,
        &["theo.brunet", "sarah.lopez"],
    ),
    // 6. ML Engineer — 3 sièges, 2 pourvus → 1 vacant.
    (
        "pos-ml-eng",
        "eng-ai",
        "ML Engineer",
        3,
        &["zoe.marchand", "sacha.riviere"],
    ),
    // 7. Support Agent — 5 sièges, 4 pourvus → 1 vacant.
    (
        "pos-support-agent",
        "support",
        "Support Agent",
        5,
        &["maxime.rey", "lucie.sanchez", "baptiste.leroux", "maya.prevost"],
    ),
    // 8. Designer — 2 sièges, 1 pourvu → 1 vacant.
    (
        "pos-designer",
        "marketing",
        "Designer",
        2,
        &["gabriel.lemoine"],
    ),
];

/// Seeds 8 demo positions with 15 incumbents across them.
pub struct PositionsSeeder;

#[async_trait]
impl Seeder for PositionsSeeder {
    fn name(&self) -> &'static str {
        "positions"
    }

    fn dependencies(&self) -> Vec<&'static str> {
        vec!["org"]
    }

    async fn run(&self, ctx: &SeedContext) -> anyhow::Result<SeedReport> {
        let mut report = SeedReport::default();
        let pool = ctx.db.inner();

        for (pos_slug, node_slug, title, head_count, incumbents) in POSITIONS {
            let pos_id = acme_uuid("org-position", pos_slug);
            let node_id = match ctx.node(node_slug) {
                Some(id) => id,
                None => {
                    report
                        .errors
                        .push(format!("position `{pos_slug}` node `{node_slug}` not registered"));
                    continue;
                },
            };
            let attributes = serde_json::json!({});

            let res = sqlx::query(
                r#"
                INSERT INTO org_positions
                    (id, tenant_id, node_id, title, head_count, attributes, active)
                VALUES ($1, $2, $3, $4, $5, $6::jsonb, TRUE)
                ON CONFLICT (id) DO UPDATE SET
                    node_id     = EXCLUDED.node_id,
                    title       = EXCLUDED.title,
                    head_count  = EXCLUDED.head_count,
                    attributes  = EXCLUDED.attributes,
                    updated_at  = now()
                "#,
            )
            .bind(pos_id)
            .bind(ctx.tenant_id)
            .bind(node_id)
            .bind(title)
            .bind(head_count)
            .bind(&attributes)
            .execute(pool)
            .await;
            bump(&mut report, res, "position");

            // Incumbents (deterministic IDs per (position, person)).
            for username in *incumbents {
                let person_id = acme_uuid("person", username);
                let inc_id = acme_uuid("org-incumbent", &format!("{pos_slug}-{username}"));
                let res = sqlx::query(
                    r#"
                    INSERT INTO org_position_incumbents
                        (id, tenant_id, position_id, person_id, start_date, active)
                    VALUES ($1, $2, $3, $4, CURRENT_DATE - INTERVAL '30 days', TRUE)
                    ON CONFLICT (id) DO UPDATE SET
                        active     = TRUE,
                        tenant_id  = EXCLUDED.tenant_id
                    "#,
                )
                .bind(inc_id)
                .bind(ctx.tenant_id)
                .bind(pos_id)
                .bind(person_id)
                .execute(pool)
                .await;
                bump(&mut report, res, "incumbent");
            }
        }

        Ok(report)
    }
}
