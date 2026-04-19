//! SO4 IN3 — webhooks seeder.
//!
//! Seeds 2 demo webhook subscriptions pointing to the public
//! `webhook.site` inspector URLs (a free service used in E2E tests).
//!
//! Each row is keyed by a deterministic UUID so re-runs upsert in place.

use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::uuid::acme_uuid;
use async_trait::async_trait;

/// (slug, url, events).
type DemoWebhook = (&'static str, &'static str, &'static [&'static str]);

const DEMO_WEBHOOKS: &[DemoWebhook] = &[
    (
        "demo-1",
        "https://webhook.site/demo-signapps-1",
        &["org.person.*", "test.webhook"],
    ),
    (
        "demo-2",
        "https://webhook.site/demo-signapps-2",
        &["org.node.*", "test.webhook"],
    ),
];

/// Seeds 2 demo webhooks for the Nexus tenant.
pub struct WebhooksSeeder;

#[async_trait]
impl Seeder for WebhooksSeeder {
    fn name(&self) -> &'static str {
        "webhooks"
    }

    fn dependencies(&self) -> Vec<&'static str> {
        vec!["org"]
    }

    async fn run(&self, ctx: &SeedContext) -> anyhow::Result<SeedReport> {
        let mut report = SeedReport::default();
        let pool = ctx.db.inner();

        for (slug, url, events) in DEMO_WEBHOOKS {
            let id = acme_uuid("org-webhook", slug);
            // Stable secret per slug — derived deterministically so
            // re-runs do not break HMAC verification on the consumer side.
            let secret = stable_secret(slug);
            let events_vec: Vec<String> = events.iter().map(|s| (*s).to_string()).collect();

            let res = sqlx::query(
                r#"
                INSERT INTO org_webhooks
                    (id, tenant_id, url, secret, events, active)
                VALUES ($1, $2, $3, $4, $5, TRUE)
                ON CONFLICT (id) DO UPDATE SET
                    url        = EXCLUDED.url,
                    events     = EXCLUDED.events,
                    active     = TRUE,
                    updated_at = now()
                "#,
            )
            .bind(id)
            .bind(ctx.tenant_id)
            .bind(*url)
            .bind(&secret)
            .bind(&events_vec)
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
                Err(e) => report.errors.push(format!("webhook {slug}: {e}")),
            }
        }

        Ok(report)
    }
}

/// Derive a 64-char hex secret from the slug — deterministic, dev only.
fn stable_secret(slug: &str) -> String {
    let uuid = acme_uuid("org-webhook-secret", slug);
    let bytes = uuid.as_bytes();
    let mut out = String::with_capacity(64);
    // 16 bytes → 32 hex chars; repeat to reach 64.
    for byte in bytes.iter().chain(bytes.iter()) {
        out.push_str(&format!("{byte:02x}"));
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stable_secret_is_64_hex_chars() {
        let s = stable_secret("demo-1");
        assert_eq!(s.len(), 64);
        assert!(s.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn stable_secret_is_deterministic() {
        let a = stable_secret("demo-1");
        let b = stable_secret("demo-1");
        assert_eq!(a, b);
        let c = stable_secret("demo-2");
        assert_ne!(a, c);
    }
}
