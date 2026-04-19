//! Forms seeder — 10 demo forms covering HR, Sales, Support, Internal ops.

use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::seeders::org::bump;
use crate::uuid::acme_uuid;
use async_trait::async_trait;

/// Seeds 10 demo forms.
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
                "Satisfaction client trimestrielle",
                "Votre feedback nous aide à progresser",
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
                "nps",
                "Enquête NPS",
                "Recommanderiez-vous Nexus à un confrère ?",
                true,
                serde_json::json!([
                    {"type": "rating", "label": "Score 0-10", "required": true},
                    {"type": "textarea", "label": "Pourquoi ?"}
                ]),
            ),
            (
                "support-ticket",
                "Ouvrir un ticket support",
                "Décrivez votre problème",
                true,
                serde_json::json!([
                    {"type": "text", "label": "Sujet", "required": true},
                    {"type": "textarea", "label": "Description", "required": true},
                    {"type": "select", "label": "Priorité", "options": ["P0","P1","P2","P3"]}
                ]),
            ),
            (
                "feature-request",
                "Feature request",
                "Suggérez une nouvelle fonctionnalité",
                true,
                serde_json::json!([
                    {"type": "text", "label": "Titre", "required": true},
                    {"type": "textarea", "label": "Use case"}
                ]),
            ),
            (
                "bug-report",
                "Signaler un bug",
                "Aidez-nous à améliorer le produit",
                true,
                serde_json::json!([
                    {"type": "text", "label": "Résumé", "required": true},
                    {"type": "textarea", "label": "Étapes", "required": true},
                    {"type": "file", "label": "Capture d'écran"}
                ]),
            ),
            (
                "event-signup",
                "Inscription événement",
                "All-Hands mensuel",
                true,
                serde_json::json!([
                    {"type": "text", "label": "Nom", "required": true},
                    {"type": "checkbox", "label": "Participera en présentiel"}
                ]),
            ),
            (
                "performance-review",
                "Revue de performance Q2",
                "Auto-évaluation trimestrielle",
                false,
                serde_json::json!([
                    {"type": "textarea", "label": "Succès", "required": true},
                    {"type": "textarea", "label": "Axes d'amélioration"},
                    {"type": "rating", "label": "Auto-note", "required": true}
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
