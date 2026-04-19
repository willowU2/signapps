//! Meet seeder — 4 persistent meeting rooms.

use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::seeders::org::bump;
use crate::uuid::acme_uuid;
use async_trait::async_trait;

/// Seeds 4 demo rooms (direction/engineering/all-hands/client).
pub struct MeetSeeder;

#[async_trait]
impl Seeder for MeetSeeder {
    fn name(&self) -> &'static str {
        "meet"
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

        let rooms: &[(&str, &str, &str, &str, bool)] = &[
            ("direction-weekly", "Direction Weekly", "Point hebdomadaire direction", "ACME-DIR1", true),
            ("engineering-standup", "Engineering Standup", "Daily eng", "ACME-ENG1", true),
            ("all-hands", "All Hands", "All Hands mensuel", "ACME-ALL1", false),
            ("client-calls", "Client Calls", "Salle pour appels client", "ACME-CLI1", true),
        ];

        for (slug, name, description, room_code, is_private) in rooms.iter() {
            let rid = acme_uuid("meet-room", slug);
            let res = sqlx::query(
                r#"
                INSERT INTO meet.rooms
                    (id, name, description, created_by, room_code, status, is_private)
                VALUES ($1, $2, $3, $4, $5, 'scheduled', $6)
                ON CONFLICT (id) DO NOTHING
                "#,
            )
            .bind(rid)
            .bind(name)
            .bind(description)
            .bind(owner)
            .bind(room_code)
            .bind(*is_private)
            .execute(pool)
            .await;
            bump(&mut report, res, "meet-room");
        }
        Ok(report)
    }
}
