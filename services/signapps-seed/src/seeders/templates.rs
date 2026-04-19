//! SO3 templates seeder.
//!
//! Seed les 4 templates built-in (`startup-20`, `scale-up-saas-80`,
//! `eti-industrielle-300`, `agency-50`) dans `org_templates`. Idempotent :
//! l'upsert par slug écrase si la spec a changé.
//!
//! Les specs JSON sont embeddées via `include_bytes!` depuis
//! `services/signapps-seed/data/templates/`.

use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use async_trait::async_trait;
use serde_json::Value as JsonValue;

/// Spec d'un template built-in.
struct BuiltInTemplate {
    slug: &'static str,
    name: &'static str,
    description: &'static str,
    industry: &'static str,
    size_range: &'static str,
    spec_json: &'static str,
}

const STARTUP_20: &str = include_str!("../../data/templates/startup-20.json");
const SCALE_UP_SAAS_80: &str = include_str!("../../data/templates/scale-up-saas-80.json");
const ETI_INDUSTRIELLE_300: &str = include_str!("../../data/templates/eti-industrielle-300.json");
const AGENCY_50: &str = include_str!("../../data/templates/agency-50.json");

const BUILT_INS: &[BuiltInTemplate] = &[
    BuiltInTemplate {
        slug: "startup-20",
        name: "Startup 20 personnes",
        description: "Structure minimaliste pour startup early-stage (4 unités, 5 postes).",
        industry: "saas",
        size_range: "5-20",
        spec_json: STARTUP_20,
    },
    BuiltInTemplate {
        slug: "scale-up-saas-80",
        name: "Scale-up SaaS 80 personnes",
        description: "Structure typique d'une scale-up SaaS : Engineering scindé, Product, Sales, Marketing, Customer Success.",
        industry: "saas",
        size_range: "50-100",
        spec_json: SCALE_UP_SAAS_80,
    },
    BuiltInTemplate {
        slug: "eti-industrielle-300",
        name: "ETI industrielle 300 personnes",
        description: "ETI industrielle : production multi-ateliers, R&D, qualité, logistique, ventes France/Export.",
        industry: "industrial",
        size_range: "200-500",
        spec_json: ETI_INDUSTRIELLE_300,
    },
    BuiltInTemplate {
        slug: "agency-50",
        name: "Agence créative 50 personnes",
        description: "Agence digitale / créative : Creative, Tech, Account, Production, Ops.",
        industry: "agency",
        size_range: "30-80",
        spec_json: AGENCY_50,
    },
];

/// Seeds 4 built-in templates.
pub struct TemplatesSeeder;

#[async_trait]
impl Seeder for TemplatesSeeder {
    fn name(&self) -> &'static str {
        "templates"
    }

    fn dependencies(&self) -> Vec<&'static str> {
        vec![]
    }

    async fn run(&self, ctx: &SeedContext) -> anyhow::Result<SeedReport> {
        let mut report = SeedReport::default();
        let pool = ctx.db.inner();

        for tpl in BUILT_INS {
            let spec_json: JsonValue = match serde_json::from_str(tpl.spec_json) {
                Ok(v) => v,
                Err(e) => {
                    report
                        .errors
                        .push(format!("template {}: invalid JSON: {e}", tpl.slug));
                    continue;
                },
            };

            let res = sqlx::query(
                r#"
                INSERT INTO org_templates
                    (slug, name, description, industry, size_range, spec_json,
                     is_public, created_by_tenant_id)
                VALUES ($1, $2, $3, $4, $5, $6, TRUE, NULL)
                ON CONFLICT (slug) DO UPDATE SET
                    name        = EXCLUDED.name,
                    description = EXCLUDED.description,
                    industry    = EXCLUDED.industry,
                    size_range  = EXCLUDED.size_range,
                    spec_json   = EXCLUDED.spec_json,
                    is_public   = TRUE
                "#,
            )
            .bind(tpl.slug)
            .bind(tpl.name)
            .bind(tpl.description)
            .bind(tpl.industry)
            .bind(tpl.size_range)
            .bind(&spec_json)
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
                Err(e) => report.errors.push(format!("templates {}: {e}", tpl.slug)),
            }
        }

        Ok(report)
    }
}
