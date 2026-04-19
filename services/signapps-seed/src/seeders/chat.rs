//! Chat seeder — 12 channels + 500 messages from rotating Nexus Industries users.

use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::seeders::org::{bump, PERSONS};
use crate::uuid::acme_uuid;
use async_trait::async_trait;

/// Seeds 12 chat channels and ~500 demo messages from a rotating user pool.
pub struct ChatSeeder;

/// Channels catalog (slug, display_name, topic).
const CHANNELS: &[(&str, &str, &str)] = &[
    ("general", "Général", "Canal général de toute l'entreprise"),
    ("engineering", "Engineering", "Discussions techniques transverses"),
    ("platform-team", "Platform Team", "Backend, DevOps, SRE"),
    ("frontend-team", "Frontend Team", "React, Next.js, UI/UX eng"),
    ("ai-team", "AI Team", "ML, LLM, RAG"),
    ("sales-emea", "Sales EMEA", "Deals EMEA"),
    ("sales-us", "Sales US", "Deals Americas"),
    ("marketing", "Marketing", "Campagnes, contenu, growth"),
    ("support", "Support", "Tickets, KB, escalades"),
    ("random", "Random", "Hors sujet, café, mèmes"),
    ("announcements", "Announcements", "Communications officielles"),
    ("ceo-office", "CEO Office", "Canal CEO + direction"),
];

/// Message templates — picked deterministically per channel + index.
const MESSAGES: &[&str] = &[
    "Bonjour à tous, bonne journée !",
    "On avance bien sur le sprint ?",
    "Petit rappel: standup à 9h30",
    "J'ai besoin d'un review sur cette PR",
    "Le build prod est passé",
    "Nouveau client signé 🎉",
    "Post-mortem programmé demain",
    "Feedback bienvenu sur la roadmap",
    "Qui est dispo pour un pairing ?",
    "Demo prête pour mardi",
    "Ticket support #4521 résolu",
    "Déploiement staging OK",
    "Alerte monitoring sur eu-west-3",
    "Nouveaux KPIs disponibles",
    "Onboarding complété pour 5 personnes",
    "Revue budget prévue jeudi",
    "Voici les notes de la réunion",
    "Merci pour le support !",
    "Bon weekend à tous",
    "Rappel: forecast à compléter",
    "Incident P1 déclaré",
    "Mise à jour de sécurité en cours",
    "Beau travail sur la feature Auth",
    "On va accélérer sur la sortie",
    "Pensez à pousser vos timesheets",
];

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

        // CEO creates the channels
        let created_by = ctx
            .user("marie.dupont")
            .ok_or_else(|| anyhow::anyhow!("marie.dupont not registered"))?;

        for (slug, name, topic) in CHANNELS.iter() {
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

        // Pick a deterministic user pool (first 40 of PERSONS rotate the chat)
        let n_persons = PERSONS.len();
        let target = 500usize;
        let n_channels = CHANNELS.len();

        for i in 0..target {
            let ch_slug = CHANNELS[i % n_channels].0;
            let ch_id = acme_uuid("chat-channel", ch_slug);
            let user_idx = (i * 7 + 3) % n_persons;
            let person = &PERSONS[user_idx];
            let username = person.0;
            let sender = ctx
                .user(username)
                .ok_or_else(|| anyhow::anyhow!("user not registered: {}", username))?;
            let msg_id = acme_uuid("chat-msg", &format!("msg{}", i));
            let content = MESSAGES[i % MESSAGES.len()];

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
            .bind(content)
            .execute(pool)
            .await;
            bump(&mut report, res, "chat-msg");
        }

        Ok(report)
    }
}
