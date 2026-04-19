//! Docs seeder — 10 documents in `docs.quick_notes` + 10 in `public.documents`.
//!
//! Real schema: `public.documents` has a required `doc_binary BYTEA`
//! column for Yjs CRDT state. We insert an empty Yjs state update
//! (single zero byte = empty state vector) which is valid for
//! subsequent client-driven content sync.

use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::seeders::org::bump;
use crate::uuid::acme_uuid;
use async_trait::async_trait;

/// Seeds demo documents for docs/quick_notes pages.
pub struct DocsSeeder;

const DOCS: &[(&str, &str, &str)] = &[
    ("roadmap-q2", "Roadmap Q2", "Roadmap Q2 : S1 livré, S2 PXE + seed, S3 tests."),
    ("onboarding", "Guide onboarding", "Bienvenue chez Acme Corp — lisez ce guide."),
    ("process-recrutement", "Processus recrutement", "1. CV, 2. Tech, 3. Culture fit."),
    ("archi-produit", "Architecture produit", "Monorepo Rust + Next.js."),
    ("runbook-prod", "Runbook prod", "Deploy: just ci, just build-release."),
    ("style-guide", "Style guide", "Rust: clippy strict. TS: Biome."),
    ("pitch-deck", "Pitch deck outline", "Vision, Produit, Équipe."),
    ("okrs-q2", "OKRs Q2", "O1 — SaaS launch. KR1: 10 clients."),
    ("post-mortem-04-17", "Post-mortem incident 04/17", "TLDR: panne 2h."),
    ("quarterly-review", "Quarterly review Q1", "Objectifs atteints à 87%."),
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
