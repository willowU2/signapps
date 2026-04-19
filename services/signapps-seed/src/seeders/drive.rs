//! Drive seeder — 50 storage.files rows split across 4 buckets.
//!
//! The real schema has `storage.files(user_id, bucket, key, size, content_type)`
//! — buckets are just a string column on the row.

use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::seeders::org::{bump, PERSONS};
use crate::uuid::acme_uuid;
use async_trait::async_trait;

/// Seeds 50 demo files across 4 virtual buckets.
pub struct DriveSeeder;

/// (bucket, name, size, mime)
const FILES: &[(&str, &str, u64, &str)] = &[
    // documents bucket (15)
    ("documents", "Budget-Q2.xlsx", 45_000, "application/vnd.ms-excel"),
    ("documents", "Rapport-Mensuel-Mars.pdf", 120_000, "application/pdf"),
    ("documents", "Rapport-Mensuel-Avril.pdf", 118_000, "application/pdf"),
    ("documents", "Contrat-ACME.pdf", 230_000, "application/pdf"),
    ("documents", "Contrat-TechCorp.pdf", 212_000, "application/pdf"),
    ("documents", "Contrat-DurandSA.pdf", 198_000, "application/pdf"),
    ("documents", "Factures-Fournisseurs-Q1.zip", 5_000_000, "application/zip"),
    ("documents", "Politique-RH-2026.docx", 65_000, "application/msword"),
    ("documents", "Comptes-2025.pdf", 820_000, "application/pdf"),
    ("documents", "Bilan-Social-2025.pdf", 410_000, "application/pdf"),
    ("documents", "Reglement-Interieur.pdf", 180_000, "application/pdf"),
    ("documents", "Livret-Onboarding.pdf", 240_000, "application/pdf"),
    ("documents", "Audit-SOC2-Rapport.pdf", 1_100_000, "application/pdf"),
    ("documents", "Contrat-Bail-Bureaux.pdf", 520_000, "application/pdf"),
    ("documents", "Assurance-RC-2026.pdf", 90_000, "application/pdf"),
    // presentations bucket (10)
    ("presentations", "Pitch-Investisseurs-Series-B.pptx", 2_500_000, "application/vnd.ms-powerpoint"),
    ("presentations", "Demo-Produit-V3.pptx", 8_000_000, "application/vnd.ms-powerpoint"),
    ("presentations", "Formation-IA-RAG.pdf", 1_200_000, "application/pdf"),
    ("presentations", "Kickoff-Q2.pdf", 450_000, "application/pdf"),
    ("presentations", "Architecture-Diagram.png", 300_000, "image/png"),
    ("presentations", "Board-Meeting-Q1.pptx", 3_200_000, "application/vnd.ms-powerpoint"),
    ("presentations", "All-Hands-Avril.pptx", 2_900_000, "application/vnd.ms-powerpoint"),
    ("presentations", "Strategy-2030.pptx", 4_100_000, "application/vnd.ms-powerpoint"),
    ("presentations", "Brand-Refresh-Preview.pptx", 5_300_000, "application/vnd.ms-powerpoint"),
    ("presentations", "Roadmap-Q2.pptx", 2_100_000, "application/vnd.ms-powerpoint"),
    // archives bucket (10)
    ("archives", "Legacy-Code-2024.tar.gz", 50_000_000, "application/gzip"),
    ("archives", "DB-Backup-2026-01.sql.gz", 15_000_000, "application/gzip"),
    ("archives", "DB-Backup-2026-02.sql.gz", 16_200_000, "application/gzip"),
    ("archives", "DB-Backup-2026-03.sql.gz", 17_500_000, "application/gzip"),
    ("archives", "Contract-2024-All.zip", 8_000_000, "application/zip"),
    ("archives", "Logs-2024-Q4.tar.gz", 20_000_000, "application/gzip"),
    ("archives", "Logs-2026-Q1.tar.gz", 22_000_000, "application/gzip"),
    ("archives", "Photo-Team-2024.jpg", 4_000_000, "image/jpeg"),
    ("archives", "Photo-Team-2025.jpg", 4_200_000, "image/jpeg"),
    ("archives", "Offsite-Annecy-2025.zip", 340_000_000, "application/zip"),
    // customer-data bucket (15)
    ("customer-data", "ACME-Industries-Proposal.pdf", 620_000, "application/pdf"),
    ("customer-data", "TechCorp-SOW.pdf", 420_000, "application/pdf"),
    ("customer-data", "Durand-SA-Assessment.pdf", 710_000, "application/pdf"),
    ("customer-data", "InnovaTech-Requirements.docx", 220_000, "application/msword"),
    ("customer-data", "MediaPlus-Onboarding.pdf", 340_000, "application/pdf"),
    ("customer-data", "Construire-Contract.pdf", 530_000, "application/pdf"),
    ("customer-data", "SantePlus-Audit.pdf", 890_000, "application/pdf"),
    ("customer-data", "LogiSys-Migration-Plan.pdf", 1_100_000, "application/pdf"),
    ("customer-data", "Creativ-Mockups.zip", 12_000_000, "application/zip"),
    ("customer-data", "FinanceGroup-Compliance.pdf", 1_300_000, "application/pdf"),
    ("customer-data", "Leads-Export-Mars.csv", 200_000, "text/csv"),
    ("customer-data", "Leads-Export-Avril.csv", 240_000, "text/csv"),
    ("customer-data", "NPS-Results-Q1.xlsx", 85_000, "application/vnd.ms-excel"),
    ("customer-data", "Churn-Analysis-Q1.xlsx", 120_000, "application/vnd.ms-excel"),
    ("customer-data", "Support-Tickets-Export.csv", 330_000, "text/csv"),
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

        // Rotate the file ownership across the first 20 PERSONS so the
        // files aren't all owned by a single user (more realistic).
        let n_persons = PERSONS.len().min(20);

        for (i, (bucket, name, size, mime)) in FILES.iter().enumerate() {
            let owner_username = PERSONS[i % n_persons].0;
            let owner = ctx
                .user(owner_username)
                .ok_or_else(|| anyhow::anyhow!("owner not registered: {}", owner_username))?;

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
