//! Mail seeder — 80 mail accounts (1 per person) + ~200 demo messages
//! forming realistic short threads between Nexus Industries collaborators.

use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::seeders::org::{bump, PERSONS};
use crate::uuid::acme_uuid;
use async_trait::async_trait;
use chrono::{Duration, Utc};

/// Seeds mail accounts (one per user) then demo threaded messages.
pub struct MailSeeder;

/// Small set of realistic subject seeds, picked deterministically by idx.
const SUBJECTS: &[&str] = &[
    "Revue de sprint",
    "Proposition roadmap Q2",
    "Question onboarding",
    "Budget équipe",
    "Incident prod 04/17",
    "Démo produit client",
    "Accord partenariat",
    "Nouveau process recrutement",
    "Feedback post-mortem",
    "Planning congés été",
    "Audit SOC2 prep",
    "Review PR #1234",
    "OKRs Q2 validation",
    "Négociation fournisseur",
    "Offre candidat senior",
    "Politique télétravail",
    "Formation obligatoire",
    "Renouvellement contrat",
    "Stratégie pricing",
    "Compte-rendu board",
];

/// Seed body generator — deterministic content based on subject + index.
fn mail_body(subject: &str, idx: usize, from_name: &str) -> String {
    format!(
        "Bonjour,\n\n\
        Petit point concernant \"{}\" (#{}).\n\n\
        Peux-tu me confirmer ta disponibilité pour avancer dessus cette semaine ?\n\n\
        Je joins les éléments habituels, n'hésite pas à revenir vers moi si un détail manque.\n\n\
        Bonne journée,\n{}",
        subject, idx, from_name
    )
}

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

        // 1 mail account per user (80 rows)
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
                ON CONFLICT (id) DO UPDATE SET
                    email_address = EXCLUDED.email_address,
                    display_name = EXCLUDED.display_name
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

        // ~200 inter-user emails — build threads of 2–3 messages
        // Pick deterministic (sender, recipient) pairs from PERSONS.
        let n_persons = PERSONS.len();
        let mut thread_idx = 0usize;
        let mut total = 0usize;
        let target = 200usize;

        while total < target {
            // Rotate across persons; sender i, recipient (i+7) % n to avoid self.
            let sender_pos = thread_idx % n_persons;
            let recipient_pos = (sender_pos + 7 + thread_idx / n_persons) % n_persons;
            if sender_pos == recipient_pos {
                thread_idx += 1;
                continue;
            }

            let sender = &PERSONS[sender_pos];
            let recipient = &PERSONS[recipient_pos];
            let subject = SUBJECTS[thread_idx % SUBJECTS.len()];

            let from_account = acme_uuid("mail-account", sender.0);
            let sender_email = sender.3;
            let sender_name = format!("{} {}", sender.1, sender.2);
            let recipient_email = recipient.3;

            // 2 or 3 messages per thread
            let thread_len = if thread_idx % 3 == 0 { 3 } else { 2 };
            for msg_pos in 0..thread_len {
                if total >= target {
                    break;
                }
                let mail_id = acme_uuid("mail", &format!("m{}-{}", thread_idx, msg_pos));
                let sent_at = Utc::now() - Duration::hours((thread_idx * 4 + msg_pos) as i64);
                // Reply subject prefix after position 0
                let subj = if msg_pos == 0 {
                    format!("[Démo] {} #{}", subject, thread_idx + 1)
                } else {
                    format!("Re: [Démo] {} #{}", subject, thread_idx + 1)
                };
                let body = mail_body(subject, thread_idx, &sender_name);

                // Flip sender/recipient for replies
                let (current_sender_email, current_sender_name, current_recipient_email) =
                    if msg_pos % 2 == 0 {
                        (sender_email, sender_name.clone(), recipient_email)
                    } else {
                        (
                            recipient_email,
                            format!("{} {}", recipient.1, recipient.2),
                            sender_email,
                        )
                    };

                let res = sqlx::query(
                    r#"
                    INSERT INTO mail.emails
                        (id, account_id, sender, sender_name, recipient, subject, body_text, sent_at, received_at, is_sent)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, TRUE)
                    ON CONFLICT (id) DO NOTHING
                    "#,
                )
                .bind(mail_id)
                .bind(from_account)
                .bind(current_sender_email)
                .bind(&current_sender_name)
                .bind(current_recipient_email)
                .bind(&subj)
                .bind(&body)
                .bind(sent_at)
                .execute(pool)
                .await;
                bump(&mut report, res, "mail");
                total += 1;
            }
            thread_idx += 1;
        }
        Ok(report)
    }
}
