//! Chat seeder — 5 channels + 40 messages.

use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::seeders::org::bump;
use crate::uuid::acme_uuid;
use async_trait::async_trait;

/// Seeds 5 public chat channels and 40 demo messages from various users.
pub struct ChatSeeder;

#[async_trait]
impl Seeder for ChatSeeder {
    fn name(&self) -> &'static str {
        "chat"
    }

    fn dependencies(&self) -> Vec<&'static str> {
        vec!["org", "identity"]
    }

    async fn run(&self, ctx: &SeedContext) -> anyhow::Result<SeedReport> {
        let mut report = SeedReport::default();
        let pool = ctx.db.inner();

        let channels = [
            ("general", "Général", "Canal général de toute l'entreprise"),
            ("engineering", "Engineering", "Discussions techniques"),
            ("sales", "Sales", "Deals, prospects, démos"),
            ("support", "Support", "Tickets, KB, escalades"),
            ("random", "Random", "Hors sujet, café, mèmes"),
        ];

        let created_by = ctx
            .user("marie.dupont")
            .ok_or_else(|| anyhow::anyhow!("marie.dupont not registered"))?;

        for (slug, name, topic) in channels.iter() {
            let ch_id = acme_uuid("chat-channel", slug);
            let res = sqlx::query(
                r#"
                INSERT INTO chat.channels (id, name, topic, is_private, created_by)
                VALUES ($1, $2, $3, FALSE, $4)
                ON CONFLICT (id) DO NOTHING
                "#,
            )
            .bind(ch_id)
            .bind(name)
            .bind(topic)
            .bind(created_by)
            .execute(pool)
            .await;
            bump(&mut report, res, "chat-channel");
        }

        // 40 messages from rotating users across the 5 channels
        let users = [
            "jean.martin",
            "sophie.leroy",
            "marie.dupont",
            "emma.rousseau",
            "nicolas.robert",
        ];
        let slugs = ["general", "engineering", "sales", "support", "random"];

        for i in 0..40 {
            let ch_id = acme_uuid("chat-channel", slugs[i % 5]);
            let username = users[i % users.len()];
            let sender = ctx
                .user(username)
                .ok_or_else(|| anyhow::anyhow!("user not registered: {}", username))?;
            let msg_id = acme_uuid("chat-msg", &format!("msg{}", i));
            let content = format!("Message démo #{} — vous suivez ?", i);
            let res = sqlx::query(
                r#"
                INSERT INTO chat.messages (id, channel_id, user_id, username, content)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (id) DO NOTHING
                "#,
            )
            .bind(msg_id)
            .bind(ch_id)
            .bind(sender)
            .bind(username)
            .bind(&content)
            .execute(pool)
            .await;
            bump(&mut report, res, "chat-msg");
        }

        Ok(report)
    }
}
