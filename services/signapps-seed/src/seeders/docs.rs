//! Docs seeder — 30 documents across quick_notes + public.documents.
//!
//! Real schema: `public.documents` has a required `doc_binary BYTEA`
//! column for Yjs CRDT state. We insert an empty Yjs state (single zero
//! byte) which is valid for subsequent client-driven content sync.

use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::seeders::org::bump;
use crate::uuid::acme_uuid;
use async_trait::async_trait;

/// Seeds demo documents for docs/quick_notes pages.
pub struct DocsSeeder;

/// 30 documents spanning all functional domains.
const DOCS: &[(&str, &str, &str)] = &[
    // Leadership & strategy
    ("roadmap-q2", "Roadmap Q2", "Roadmap stratégique Q2 Nexus Industries."),
    ("okrs-q2", "OKRs Q2 Nexus", "O1 — SaaS launch. KR1: 10 nouveaux clients."),
    ("okrs-q1-review", "OKRs Q1 Review", "Bilan : 87% d'atteinte des objectifs."),
    ("company-vision-2030", "Vision 2030", "Devenir la référence européenne des SaaS internes."),
    ("pitch-deck", "Pitch Deck Nexus", "Vision, Produit, Équipe, Traction."),
    ("board-deck-q1", "Board Deck Q1", "Slides Board trimestriel Q1."),
    // Engineering
    ("architecture-platform", "Architecture Platform", "Monorepo Rust + Next.js, single binary."),
    ("architecture-ai", "Architecture IA", "Pipeline RAG, embeddings, vector store."),
    ("runbook-prod", "Runbook prod", "Deploy: just ci, just build-release."),
    ("runbook-incident", "Runbook Incident", "Escalade P0/P1/P2."),
    ("post-mortem-incident", "Post-mortem incident 04/17", "TLDR: panne 2h due à un bug DNS."),
    ("api-v3-spec", "API v3 Spec", "OpenAPI 3.1, JWT auth, pagination."),
    ("style-guide-rust", "Style Guide Rust", "Clippy strict. Zéro unwrap en prod."),
    ("style-guide-ts", "Style Guide TypeScript", "Biome lint. Types stricts."),
    ("onboarding-engineering", "Onboarding Engineering", "Setup IDE, repos, accès."),
    // Sales & Marketing
    ("customer-personas", "Customer Personas", "Persona 1: CTO mid-market, Persona 2: Ops Director."),
    ("pricing-strategy", "Pricing Strategy Q2", "Starter €49, Pro €149, Enterprise custom."),
    ("sales-playbook", "Sales Playbook EMEA", "SDR → AE → AM flow."),
    ("marketing-calendar", "Marketing Calendar", "Events, campagnes, contenus."),
    ("content-strategy", "Content Strategy", "Blog, case studies, whitepapers."),
    // People / HR
    ("employee-handbook", "Employee Handbook", "Règlement intérieur Nexus."),
    ("hiring-plan-h1", "Hiring Plan H1", "20 recrutements prévus H1."),
    ("onboarding-general", "Onboarding général", "Bienvenue chez Nexus Industries."),
    ("performance-review-q2", "Performance Review Q2", "Template + process."),
    ("remote-work-policy", "Remote Work Policy", "2 jours TT/semaine min onsite."),
    // Operations
    ("compliance-audit", "Compliance Audit SOC2", "Checklist contrôles."),
    ("vendor-list", "Vendor List", "Fournisseurs référencés + contrats."),
    ("office-move-plan", "Office Move Plan", "Déménagement Q3, étapes."),
    ("brand-refresh", "Brand Refresh", "Nouveau logo + charte Q3."),
    ("quarterly-review", "Quarterly Review Q1", "Objectifs atteints à 87%."),
];

#[async_trait]
impl Seeder for DocsSeeder {
    fn name(&self) -> &'static str {
        "docs"
    }

    fn dependencies(&self) -> Vec<&'static str> {
        vec!["identity"]
    }

    async fn run(&self, ctx: &SeedContext) -> anyhow::Result<SeedReport> {
        let mut report = SeedReport::default();
        let pool = ctx.db.inner();

        let owner = ctx
            .user("marie.dupont")
            .ok_or_else(|| anyhow::anyhow!("marie.dupont not registered"))?;

        for (slug, title, content) in DOCS.iter() {
            // docs.quick_notes — simple rich text
            let note_id = acme_uuid("quick-note", slug);
            let res = sqlx::query(
                r#"
                INSERT INTO docs.quick_notes (id, user_id, title, content)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (id) DO NOTHING
                "#,
            )
            .bind(note_id)
            .bind(owner)
            .bind(title)
            .bind(content)
            .execute(pool)
            .await;
            bump(&mut report, res, "quick-note");

            // public.documents — Tiptap-like collaborative doc with minimal Yjs state
            let doc_id = acme_uuid("doc", slug);
            let empty_yjs: Vec<u8> = vec![0];
            let res = sqlx::query(
                r#"
                INSERT INTO documents (id, name, doc_type, doc_binary, created_by)
                VALUES ($1, $2, 'text', $3, $4)
                ON CONFLICT (id) DO NOTHING
                "#,
            )
            .bind(doc_id)
            .bind(title)
            .bind(&empty_yjs)
            .bind(owner)
            .execute(pool)
            .await;
            bump(&mut report, res, "document");
        }
        Ok(report)
    }
}
