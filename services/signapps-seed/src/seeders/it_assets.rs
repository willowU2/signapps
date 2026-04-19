//! IT assets seeder — 20 configuration items (laptops, phones, servers).

use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::seeders::org::bump;
use crate::uuid::acme_uuid;
use async_trait::async_trait;

/// Seeds 20 hardware/device CIs owned by rotating Acme users.
pub struct ItAssetsSeeder;

#[async_trait]
impl Seeder for ItAssetsSeeder {
    fn name(&self) -> &'static str {
        "it-assets"
    }

    fn dependencies(&self) -> Vec<&'static str> {
        vec!["identity"]
    }

    async fn run(&self, ctx: &SeedContext) -> anyhow::Result<SeedReport> {
        let mut report = SeedReport::default();
        let pool = ctx.db.inner();

        let owners = [
            "marie.dupont",
            "paul.durand",
            "jean.martin",
            "sophie.leroy",
            "thomas.petit",
            "emma.rousseau",
            "lucas.fournier",
            "julie.bernard",
            "nicolas.robert",
            "anne.girard",
        ];

        let types: &[(&str, &str)] = &[
            ("laptop", "MacBook Pro 14 M3"),
            ("laptop", "Dell XPS 15"),
            ("monitor", "Dell U2723QE 27"),
            ("phone", "iPhone 15"),
            ("tablet", "iPad Air"),
            ("desktop", "Mac Studio"),
        ];

        for i in 0..20usize {
            let aid = acme_uuid("it-asset", &format!("a{}", i));
            let (ci_type, model) = &types[i % types.len()];
            let owner_name = owners[i % owners.len()];
            let owner_id = ctx
                .user(owner_name)
                .ok_or_else(|| anyhow::anyhow!("owner not registered: {}", owner_name))?;

            let metadata = serde_json::json!({
                "model": model,
                "serial_number": format!("SN-{:06}", i * 37 + 1000),
                "assigned_to_username": owner_name,
            });
            let name = format!("{} de {}", model, owner_name.replace('.', " "));

            let res = sqlx::query(
                r#"
                INSERT INTO it.configuration_items (id, name, ci_type, status, owner_id, metadata)
                VALUES ($1, $2, $3, 'active', $4, $5::jsonb)
                ON CONFLICT (id) DO NOTHING
                "#,
            )
            .bind(aid)
            .bind(&name)
            .bind(ci_type)
            .bind(owner_id)
            .bind(&metadata)
            .execute(pool)
            .await;
            bump(&mut report, res, "it-asset");
        }
        Ok(report)
    }
}
