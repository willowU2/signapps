//! Drive seeder — 15 storage.files rows split across 3 buckets.
//!
//! The real schema has `storage.files(user_id, bucket, key, size, content_type)`
//! — no separate bucket table, buckets are just a string column.

use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::seeders::org::bump;
use crate::uuid::acme_uuid;
use async_trait::async_trait;

/// Seeds 15 demo files across 3 virtual buckets.
pub struct DriveSeeder;

const FILES: &[(&str, &str, u64, &str)] = &[
    ("documents", "Budget-Q2.xlsx", 45_000, "application/vnd.ms-excel"),
    ("documents", "Rapport-Mensuel.pdf", 120_000, "application/pdf"),
    ("documents", "Contrat-ACME.pdf", 230_000, "application/pdf"),
    ("documents", "Factures-Fournisseurs.zip", 5_000_000, "application/zip"),
    ("documents", "Politique-RH.docx", 65_000, "application/msword"),
    ("presentations", "Pitch-Investisseurs.pptx", 2_500_000, "application/vnd.ms-powerpoint"),
    ("presentations", "Demo-Produit.pptx", 8_000_000, "application/vnd.ms-powerpoint"),
    ("presentations", "Formation-IA.pdf", 1_200_000, "application/pdf"),
    ("presentations", "Kickoff-Q2.pdf", 450_000, "application/pdf"),
    ("presentations", "Architecture-Diagram.png", 300_000, "image/png"),
    ("archives", "Legacy-Code-2024.tar.gz", 50_000_000, "application/gzip"),
    ("archives", "DB-Backup-2026-01.sql.gz", 15_000_000, "application/gzip"),
    ("archives", "Contract-2024-All.zip", 8_000_000, "application/zip"),
    ("archives", "Logs-2024-Q4.tar.gz", 20_000_000, "application/gzip"),
    ("archives", "Photo-Team-2024.jpg", 4_000_000, "image/jpeg"),
];

#[async_trait]
impl Seeder for DriveSeeder {
    fn name(&self) -> &'static str {
        "drive"
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

        for (i, (bucket, name, size, mime)) in FILES.iter().enumerate() {
            let file_id = acme_uuid("file", &format!("{}-{}", bucket, i));
            let key = format!("demo/{}", name);

            let res = sqlx::query(
                r#"
                INSERT INTO storage.files (id, user_id, bucket, key, size, content_type)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (id) DO NOTHING
                "#,
            )
            .bind(file_id)
            .bind(owner)
            .bind(bucket)
            .bind(&key)
            .bind(*size as i64)
            .bind(mime)
            .execute(pool)
            .await;
            bump(&mut report, res, "file");
        }
        Ok(report)
    }
}
