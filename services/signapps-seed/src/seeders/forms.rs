//! Forms seeder — 5 demo forms.

use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::seeders::org::bump;
use crate::uuid::acme_uuid;
use async_trait::async_trait;

/// Seeds 5 demo forms (candidacy, satisfaction, demo request, leave, expense).
pub struct FormsSeeder;

#[async_trait]
impl Seeder for FormsSeeder {
    fn name(&self) -> &'static str {
        "forms"
    }

    fn dependencies(&self) -> Vec<&'static str> {
        vec!["identity"]
    }

    async fn run(&self, ctx: &SeedContext) -> anyhow::Result<SeedReport> {
        let mut report = SeedReport::default();
        let pool = ctx.db.inner();

        let owner = ctx
            .user("claire.moreau")
            .ok_or_else(|| anyhow::anyhow!("claire.moreau not registered"))?;

        let forms: &[(&str, &str, &str, bool, serde_json::Value)] = &[
            (
                "candidature",
                "Candidature spontanée",
                "Envoyez votre CV pour une candidature libre",
                true,
                serde_json::json!([
                    {"type": "text", "label": "Nom", "required": true},
                    {"type": "email", "label": "Email", "required": true},
                    {"type": "file", "label": "CV", "required": true}
                ]),
            ),
            (
                "satisfaction-client",
                "Satisfaction client",
                "Questionnaire trimestriel",
                true,
                serde_json::json!([
                    {"type": "rating", "label": "Note", "required": true},
                    {"type": "textarea", "label": "Commentaire"}
                ]),
            ),
            (
                "demo-request",
                "Demande de démo",
                "Réservez une démo produit",
                true,
                serde_json::json!([
                    {"type": "text", "label": "Société", "required": true},
                    {"type": "email", "label": "Email pro", "required": true}
                ]),
            ),
            (
                "conge-exceptionnel",
                "Demande congé exceptionnel",
                "Interne — validée par le manager",
                false,
                serde_json::json!([
                    {"type": "date", "label": "Début", "required": true},
                    {"type": "date", "label": "Fin", "required": true},
                    {"type": "textarea", "label": "Motif"}
                ]),
            ),
            (
                "note-de-frais",
                "Note de frais",
                "Interne — validée par la compta",
                false,
                serde_json::json!([
                    {"type": "number", "label": "Montant", "required": true},
                    {"type": "file", "label": "Justificatif"}
                ]),
            ),
        ];

        for (slug, title, description, is_published, fields) in forms.iter() {
            let form_id = acme_uuid("form", slug);
            let res = sqlx::query(
                r#"
                INSERT INTO forms.forms
                    (id, title, description, owner_id, fields, is_published)
                VALUES ($1, $2, $3, $4, $5::jsonb, $6)
                ON CONFLICT (id) DO NOTHING
                "#,
            )
            .bind(form_id)
            .bind(title)
            .bind(description)
            .bind(owner)
            .bind(fields)
            .bind(*is_published)
            .execute(pool)
            .await;
            bump(&mut report, res, "form");
        }

        Ok(report)
    }
}
