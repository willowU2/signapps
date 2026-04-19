//! Vault seeder — 8 demo secrets with placeholder encrypted payloads.
//!
//! The real `vault.items` schema uses BYTEA for name/data (encrypted
//! per-user). We seed plaintext-ish placeholders so the items are
//! visible in the UI — decryption will naturally fail until the real
//! per-user keys are set up, which is acceptable for demo.

use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::seeders::org::bump;
use crate::uuid::acme_uuid;
use async_trait::async_trait;

/// Seeds 8 placeholder secrets owned by `paul.durand`.
pub struct VaultSeeder;

#[async_trait]
impl Seeder for VaultSeeder {
    fn name(&self) -> &'static str {
        "vault"
    }

    fn dependencies(&self) -> Vec<&'static str> {
        vec!["identity"]
    }

    async fn run(&self, ctx: &SeedContext) -> anyhow::Result<SeedReport> {
        let mut report = SeedReport::default();
        let pool = ctx.db.inner();

        let owner = ctx
            .user("paul.durand")
            .ok_or_else(|| anyhow::anyhow!("paul.durand not registered"))?;

        let secrets: &[(&str, &str)] = &[
            ("GitHub Deploy Token", "github-deploy"),
            ("AWS Access Key", "aws-prod"),
            ("SMTP Relay Password", "smtp-mailjet"),
            ("API Stripe Test", "stripe-test"),
            ("API Stripe Live", "stripe-live"),
            ("DB Prod Read-only", "db-prod-ro"),
            ("Internal CA Cert", "ca-cert"),
            ("Admin Bastion SSH", "ssh-bastion"),
        ];

        for (i, (name, key)) in secrets.iter().enumerate() {
            let sid = acme_uuid("vault-secret", key);
            let name_bytes = name.as_bytes();
            let data_bytes = format!("seed-placeholder-{}", i).into_bytes();

            let res = sqlx::query(
                r#"
                INSERT INTO vault.items (id, owner_id, item_type, name, data)
                VALUES ($1, $2, 'secure_note'::vault.item_type, $3, $4)
                ON CONFLICT (id) DO NOTHING
                "#,
            )
            .bind(sid)
            .bind(owner)
            .bind(name_bytes)
            .bind(&data_bytes)
            .execute(pool)
            .await;
            bump(&mut report, res, "vault-item");
        }
        Ok(report)
    }
}
