//! Chat seeding — inserts channels and messages.
//!
//! Tables: `chat.channels`, `chat.messages`.
//! Neither table has a `tenant_id` column.

use rand::Rng;
use tracing::info;
use uuid::Uuid;

const MESSAGE_CONTENTS: &[&str] = &[
    "Bonjour à tous, quelqu'un a vu le dernier rapport ?",
    "J'ai terminé la review du PR #42. LGTM !",
    "La démo de demain est confirmée à 14h.",
    "Attention, la prod est en train de ramer depuis ce matin.",
    "Est-ce qu'on peut se faire un point rapide aujourd'hui ?",
    "J'ai poussé le fix sur la branche feature/auth. À revoir.",
    "Les tests de charge sont terminés. Résultats en pièce jointe.",
    "Qui s'occupe du ticket JIRA-1234 ?",
    "La réunion client est décalée à jeudi.",
    "Merci à tous pour le boulot sur le sprint 12 !",
    "Quelqu'un a les accès AWS pour le bucket S3 ?",
    "La migration de base de données a réussi sans erreur.",
    "Le certificat SSL expire dans 7 jours, penser à le renouveler.",
    "Je prends le ticket de refactoring sur le module auth.",
    "Nouvelle release déployée en prod : v2.4.1.",
    "Point hebdo annulé cette semaine, à la place vendredi.",
    "Les métriques Prometheus montrent une hausse des latences.",
    "J'ai créé la PR pour la feature de notifications push.",
    "Quelqu'un peut m'aider sur l'erreur CORS en dev ?",
    "Le design system a été mis à jour, voir Figma.",
];

/// Seeds Acme Corp chat (5 channels, 200 messages).
///
/// # Errors
///
/// Returns an error if any database operation fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
pub async fn seed_acme(
    pool: &sqlx::PgPool,
    _tenant_id: Uuid,
    user_ids: &[(Uuid, Uuid, String)],
) -> Result<(), Box<dyn std::error::Error>> {
    info!(users = user_ids.len(), "seeding acme chat");

    if user_ids.is_empty() {
        info!("no users — skipping acme chat seed");
        return Ok(());
    }

    let channel_defs: &[(&str, &str, bool)] = &[
        ("général", "Canal général de l'entreprise", false),
        ("tech", "Discussions techniques et architecture", false),
        ("random", "Discussions informelles", false),
        ("annonces", "Annonces officielles de la direction", false),
        ("support", "Support interne et questions", false),
    ];

    seed_channels(pool, user_ids, channel_defs, 200).await?;

    Ok(())
}

/// Seeds Startup SAS chat (2 channels, 30 messages).
///
/// # Errors
///
/// Returns an error if any database operation fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
pub async fn seed_startup(
    pool: &sqlx::PgPool,
    _tenant_id: Uuid,
    user_ids: &[(Uuid, Uuid, String)],
) -> Result<(), Box<dyn std::error::Error>> {
    info!(users = user_ids.len(), "seeding startup chat");

    if user_ids.is_empty() {
        info!("no users — skipping startup chat seed");
        return Ok(());
    }

    let channel_defs: &[(&str, &str, bool)] = &[
        ("équipe", "Canal principal de l'équipe", false),
        ("dev", "Développement et code", false),
    ];

    seed_channels(pool, user_ids, channel_defs, 30).await?;

    Ok(())
}

// ── Private helpers ───────────────────────────────────────────────────────────

async fn seed_channels(
    pool: &sqlx::PgPool,
    user_ids: &[(Uuid, Uuid, String)],
    channel_defs: &[(&str, &str, bool)],
    total_messages: usize,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut rng = rand::thread_rng();
    let mut channel_ids: Vec<Uuid> = Vec::with_capacity(channel_defs.len());

    for &(name, topic, is_private) in channel_defs {
        let created_by = crate::helpers::pick(user_ids, rng.gen_range(0..user_ids.len())).0;
        let channel_id = Uuid::new_v4();

        sqlx::query(
            r#"
            INSERT INTO chat.channels
                (id, name, topic, is_private, created_by, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
            ON CONFLICT DO NOTHING
            "#,
        )
        .bind(channel_id)
        .bind(name)
        .bind(topic)
        .bind(is_private)
        .bind(created_by)
        .execute(pool)
        .await?;

        channel_ids.push(channel_id);
    }
    info!(count = channel_ids.len(), "channels created");

    // Distribute messages across channels
    for msg_idx in 0..total_messages {
        let channel_id = *crate::helpers::pick(&channel_ids, msg_idx);
        let (user_id, _, username) =
            crate::helpers::pick(user_ids, rng.gen_range(0..user_ids.len()));
        let content = crate::helpers::pick(MESSAGE_CONTENTS, msg_idx);
        let day_offset: i64 = rng.gen_range(-30i64..1);

        sqlx::query(
            r#"
            INSERT INTO chat.messages
                (id, channel_id, user_id, username, content, created_at, updated_at)
            VALUES
                ($1, $2, $3, $4, $5,
                 NOW() + ($6 || ' days')::INTERVAL,
                 NOW() + ($6 || ' days')::INTERVAL)
            ON CONFLICT DO NOTHING
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(channel_id)
        .bind(user_id)
        .bind(username.as_str())
        .bind(*content)
        .bind(day_offset.to_string())
        .execute(pool)
        .await?;
    }
    info!(count = total_messages, "messages created");

    Ok(())
}
