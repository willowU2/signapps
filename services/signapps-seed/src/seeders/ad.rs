//! AD config seeder — adds an unbound (mode=off) demo config for the tenant.

use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::seeders::org::bump;
use async_trait::async_trait;

/// Inserts one `org_ad_config` row with mode='off' — safe, won't sync.
pub struct AdSeeder;

#[async_trait]
impl Seeder for AdSeeder {
    fn name(&self) -> &'static str {
        "ad"
    }

    fn dependencies(&self) -> Vec<&'static str> {
        vec!["org"]
    }

    async fn run(&self, ctx: &SeedContext) -> anyhow::Result<SeedReport> {
        let mut report = SeedReport::default();
        let pool = ctx.db.inner();

        let res = sqlx::query(
            r#"
            INSERT INTO org_ad_config
                (tenant_id, mode, ldap_url, bind_dn, base_dn, user_filter, sync_interval_sec, conflict_strategy)
            VALUES ($1, 'off', 'ldap://ad.demo.acme.corp:389',
                    'CN=signapps-svc,OU=services,DC=acme,DC=corp',
                    'DC=acme,DC=corp',
                    '(objectClass=user)', 300, 'org_wins')
            ON CONFLICT (tenant_id) DO NOTHING
            "#,
        )
        .bind(ctx.tenant_id)
        .execute(pool)
        .await;
        bump(&mut report, res, "ad-config");
        Ok(report)
    }
}
