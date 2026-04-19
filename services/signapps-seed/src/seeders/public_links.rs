//! SO4 IN2 — public links seeder.
//!
//! Seeds 1 active public link `nexus-public` on the Nexus root node,
//! visibility = `anon`, expires in 90 days. Idempotent : the slug is
//! deterministic from `acme_uuid` and the row is upserted on conflict.

use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::uuid::acme_uuid;
use async_trait::async_trait;
use chrono::Duration;

/// Slug used for the public sample link (kept stable for E2E).
pub const PUBLIC_LINK_SLUG: &str = "nexus-public";

/// Seeds 1 public link on the Nexus root node.
pub struct PublicLinksSeeder;

#[async_trait]
impl Seeder for PublicLinksSeeder {
    fn name(&self) -> &'static str {
        "public_links"
    }

    fn dependencies(&self) -> Vec<&'static str> {
        vec!["org"]
    }

    async fn run(&self, ctx: &SeedContext) -> anyhow::Result<SeedReport> {
        let mut report = SeedReport::default();
        let pool = ctx.db.inner();

        let id = acme_uuid("org-public-link", PUBLIC_LINK_SLUG);
        let root_id = acme_uuid("org-node", "acme-corp");
        let expires_at = chrono::Utc::now() + Duration::days(90);

        let res = sqlx::query(
            r#"
            INSERT INTO org_public_links
                (id, tenant_id, root_node_id, slug, visibility,
                 allowed_origins, expires_at, created_by_user_id)
            VALUES ($1, $2, $3, $4, 'anon', ARRAY[]::TEXT[], $5, NULL)
            ON CONFLICT (slug) DO UPDATE SET
                tenant_id    = EXCLUDED.tenant_id,
                root_node_id = EXCLUDED.root_node_id,
                visibility   = EXCLUDED.visibility,
                expires_at   = EXCLUDED.expires_at,
                revoked_at   = NULL
            "#,
        )
        .bind(id)
        .bind(ctx.tenant_id)
        .bind(root_id)
        .bind(PUBLIC_LINK_SLUG)
        .bind(expires_at)
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
            Err(e) => report.errors.push(format!("public link {PUBLIC_LINK_SLUG}: {e}")),
        }

        Ok(report)
    }
}
