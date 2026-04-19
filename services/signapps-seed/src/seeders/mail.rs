//! Mail seeder — 15 mail accounts + 30 demo emails between Acme users.

use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::seeders::org::{bump, PERSONS};
use crate::uuid::acme_uuid;
use async_trait::async_trait;
use chrono::{Duration, Utc};

/// Seeds mail accounts (one per user) then 30 inter-user demo messages.
pub struct MailSeeder;

#[async_trait]
impl Seeder for MailSeeder {
    fn name(&self) -> &'static str {
        "mail"
    }

    fn dependencies(&self) -> Vec<&'static str> {
        vec!["org", "identity"]
    }

    async fn run(&self, ctx: &SeedContext) -> anyhow::Result<SeedReport> {
        let mut report = SeedReport::default();
        let pool = ctx.db.inner();

        // 1 mail account per user
        for (username, first_name, last_name, email, _ou, _title) in PERSONS.iter() {
            let account_id = acme_uuid("mail-account", username);
            let user_id = ctx
                .user(username)
                .ok_or_else(|| anyhow::anyhow!("user not registered: {}", username))?;
            let display = format!("{} {}", first_name, last_name);

            let res = sqlx::query(
                r#"
                INSERT INTO mail.accounts
                    (id, user_id, email_address, display_name, provider, status)
                VALUES ($1, $2, $3, $4, 'custom', 'active')
                ON CONFLICT (id) DO NOTHING
                "#,
            )
            .bind(account_id)
            .bind(user_id)
            .bind(email)
            .bind(&display)
            .execute(pool)
            .await;
            bump(&mut report, res, "mail-account");
        }

        // 30 inter-user demo mails (from marie.dupont)
        let from_account = acme_uuid("mail-account", "marie.dupont");
        let to_list = [
            "jean.martin",
            "paul.durand",
            "nicolas.robert",
            "claire.moreau",
            "sophie.leroy",
        ];

        for i in 0..30 {
            let to_user = to_list[i % to_list.len()];
            let to_email = format!("{}@acme.corp", to_user);
            let mail_id = acme_uuid("mail", &format!("m{}", i));
            let sent_at = Utc::now() - Duration::hours((i * 2) as i64);
            let subject = format!("[Démo] Point projet #{}", i + 1);
            let body = format!(
                "Bonjour,\n\nCeci est un mail de démo #{}.\n\nCordialement,\nMarie",
                i + 1
            );

            let res = sqlx::query(
                r#"
                INSERT INTO mail.emails
                    (id, account_id, sender, sender_name, recipient, subject, body_text, sent_at, received_at, is_sent)
                VALUES ($1, $2, 'marie.dupont@acme.corp', 'Marie Dupont', $3, $4, $5, $6, $6, TRUE)
                ON CONFLICT (id) DO NOTHING
                "#,
            )
            .bind(mail_id)
            .bind(from_account)
            .bind(&to_email)
            .bind(&subject)
            .bind(&body)
            .bind(sent_at)
            .execute(pool)
            .await;
            bump(&mut report, res, "mail");
        }
        Ok(report)
    }
}
