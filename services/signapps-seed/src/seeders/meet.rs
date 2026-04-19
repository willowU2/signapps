//! Meet seeder — 10 persistent meeting rooms (physical + virtual).

use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::seeders::org::bump;
use crate::uuid::acme_uuid;
use async_trait::async_trait;

/// Seeds 10 demo rooms covering physical meeting rooms + virtual spaces.
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
            ("boardroom", "Boardroom", "Salle conseil d'administration", "NEX-BOR1", true),
            ("salle-einstein", "Salle Einstein", "Salle réunion 12 pers (R+2)", "NEX-EIN1", false),
            ("salle-curie", "Salle Curie", "Salle réunion 8 pers (R+2)", "NEX-CUR1", false),
            ("salle-turing", "Salle Turing", "Salle réunion 6 pers (R+3)", "NEX-TUR1", false),
            ("salle-ada", "Salle Ada", "Salle réunion 4 pers (R+1)", "NEX-ADA1", false),
            ("salle-hopper", "Salle Hopper", "Salle phone-booth solo (R+3)", "NEX-HOP1", false),
            ("engineering-standup", "Engineering Standup", "Daily eng virtuel", "NEX-ENG1", false),
            ("all-hands", "All Hands", "All Hands mensuel virtuel", "NEX-ALL1", false),
            ("client-calls", "Client Calls", "Salle virtuelle pour calls client", "NEX-CLI1", true),
            ("interviews", "Interviews", "Salle virtuelle recrutement", "NEX-INT1", true),
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
