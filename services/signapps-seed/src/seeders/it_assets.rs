//! IT assets seeder — 80 configuration items (laptops, phones, tablets,
//! monitors, desktops) assigned to a rotating set of Nexus users.

use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::seeders::org::{bump, PERSONS};
use crate::uuid::acme_uuid;
use async_trait::async_trait;

/// Seeds 80 hardware/device CIs owned by rotating Nexus Industries users.
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

        let types: &[(&str, &str)] = &[
            ("laptop", "MacBook Pro 14 M3"),
            ("laptop", "MacBook Air 15 M3"),
            ("laptop", "Dell XPS 15"),
            ("laptop", "Dell Latitude 7440"),
            ("laptop", "Lenovo ThinkPad X1 Carbon"),
            ("monitor", "Dell U2723QE 27"),
            ("monitor", "LG UltraFine 4K"),
            ("monitor", "Apple Studio Display"),
            ("phone", "iPhone 15 Pro"),
            ("phone", "Samsung Galaxy S24"),
            ("tablet", "iPad Air M2"),
            ("tablet", "iPad Pro 12.9"),
            ("desktop", "Mac Studio M2"),
            ("desktop", "Mac Mini M2"),
        ];

        // One asset per person (80), picking equipment round-robin from `types`.
        // That gives us exactly PERSONS.len() rows.
        for (i, person) in PERSONS.iter().enumerate() {
            let owner_name = person.0;
            let (ci_type, model) = &types[i % types.len()];
            let owner_id = ctx
                .user(owner_name)
                .ok_or_else(|| anyhow::anyhow!("owner not registered: {}", owner_name))?;

            let aid = acme_uuid("it-asset", &format!("a{}", i));
            let metadata = serde_json::json!({
                "model": model,
                "serial_number": format!("NEX-{:06}", i * 37 + 1000),
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
