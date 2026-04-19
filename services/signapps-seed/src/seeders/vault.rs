//! Vault seeder — 20 demo secrets with placeholder encrypted payloads.
//!
//! The real `vault.items` schema uses BYTEA for name/data (encrypted
//! per-user). We seed plaintext-ish placeholders so the items are
//! visible in the UI — decryption will naturally fail until the real
//! per-user keys are set up, which is acceptable for a demo dataset.

use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::seeders::org::bump;
use crate::uuid::acme_uuid;
use async_trait::async_trait;

/// Seeds 20 placeholder secrets owned by finance/ops leads.
pub struct VaultSeeder;

/// (item_type, name, key, owner_username)
const SECRETS: &[(&str, &str, &str, &str)] = &[
    // Production credentials
    ("api_token", "GitHub Deploy Token", "github-deploy", "paul.durand"),
    ("api_token", "AWS Access Key Prod", "aws-prod", "paul.durand"),
    ("api_token", "AWS Access Key Staging", "aws-staging", "paul.durand"),
    ("api_token", "SMTP Mailjet Prod", "smtp-mailjet", "paul.durand"),
    ("api_token", "Stripe Live API", "stripe-live", "paul.durand"),
    ("api_token", "Stripe Test API", "stripe-test", "paul.durand"),
    ("login", "DB Prod Read-only", "db-prod-ro", "paul.durand"),
    ("login", "DB Prod Admin", "db-prod-admin", "paul.durand"),
    ("login", "DB Staging Admin", "db-staging-admin", "jean.martin"),
    ("ssh_key", "Admin Bastion SSH", "ssh-bastion", "julie.bernard"),
    ("ssh_key", "Deploy Key GitHub", "ssh-github", "julie.bernard"),
    ("secure_note", "Internal CA Cert", "ca-cert", "marc.fontaine"),
    ("secure_note", "TLS Wildcard Prod", "tls-wildcard", "marc.fontaine"),
    // Third-party integrations
    ("api_token", "Slack Bot Token", "slack-bot", "jean.martin"),
    ("api_token", "Datadog API Key", "datadog-key", "marc.fontaine"),
    ("api_token", "Sentry DSN Prod", "sentry-prod", "marc.fontaine"),
    ("api_token", "HubSpot CRM API", "hubspot", "nicolas.robert"),
    ("api_token", "SendGrid Transactional", "sendgrid", "elise.vincent"),
    // Office / ops
    ("login", "Office WiFi Admin", "wifi-admin", "iris.delmas"),
    ("login", "Badge System Admin", "badge-admin", "iris.delmas"),
];

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

        for (i, (item_type, name, key, owner_username)) in SECRETS.iter().enumerate() {
            let owner = ctx
                .user(owner_username)
                .ok_or_else(|| anyhow::anyhow!("owner not registered: {}", owner_username))?;

            let sid = acme_uuid("vault-secret", key);
            let name_bytes = name.as_bytes();
            let data_bytes = format!("seed-placeholder-{}", i).into_bytes();

            let res = sqlx::query(
                r#"
                INSERT INTO vault.items (id, owner_id, item_type, name, data)
                VALUES ($1, $2, $3::vault.item_type, $4, $5)
                ON CONFLICT (id) DO NOTHING
                "#,
            )
            .bind(sid)
            .bind(owner)
            .bind(item_type)
            .bind(name_bytes)
            .bind(&data_bytes)
            .execute(pool)
            .await;
            bump(&mut report, res, "vault-item");
        }
        Ok(report)
    }
}
