//! Mail seeding — inserts mailboxes and sample emails for all tenant scenarios.

use rand::Rng;
use tracing::info;
use uuid::Uuid;

/// Seeds Acme Corp mailboxes and sample emails.
///
/// Creates one `mail.accounts` per Acme user, then inserts 100 emails with
/// varied subjects, read/unread state, labels, and 5 thread chains of 3–5
/// emails each. Folders are created automatically by the database trigger on
/// account insert.
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
    tenant_id: Uuid,
    user_ids: &[(Uuid, Uuid, String)],
) -> Result<(), Box<dyn std::error::Error>> {
    info!(%tenant_id, users = user_ids.len(), "seeding acme mail");

    if user_ids.is_empty() {
        info!("no users available — skipping mail seed");
        return Ok(());
    }

    let mut rng = rand::thread_rng();

    // ── Mail accounts — one per user ─────────────────────────────────────────
    let domains = ["acme.corp", "acme.internal", "acmecorp.fr"];
    let first_names = [
        "alice", "bob", "charlie", "diana", "etienne", "fanny", "gabriel",
        "helene", "ivan", "juliette", "kevin", "laura", "marc", "nadia",
        "olivier", "pauline", "quentin", "rachel", "sebastien", "thomas",
    ];

    let mut account_ids: Vec<(Uuid, Uuid)> = Vec::with_capacity(user_ids.len());

    for (idx, (user_id, _, _)) in user_ids.iter().enumerate() {
        let account_id = Uuid::new_v4();
        let first = first_names[idx % first_names.len()];
        let domain = domains[idx % domains.len()];
        let email = format!("{}@{}", first, domain);
        let display = format!(
            "{} {}",
            &first[0..1].to_uppercase(),
            &first[1..]
        );

        sqlx::query(
            r#"
            INSERT INTO mail.accounts
                (id, user_id, email_address, display_name, provider,
                 imap_server, imap_port, imap_use_tls,
                 smtp_server, smtp_port, smtp_use_tls,
                 status, created_at, updated_at)
            VALUES
                ($1, $2, $3, $4, 'custom',
                 'imap.acme.corp', 993, TRUE,
                 'smtp.acme.corp', 587, TRUE,
                 'active', NOW(), NOW())
            ON CONFLICT (user_id, email_address) DO NOTHING
            "#,
        )
        .bind(account_id)
        .bind(user_id)
        .bind(&email)
        .bind(&display)
        .execute(pool)
        .await?;

        account_ids.push((account_id, *user_id));
    }

    info!(accounts = account_ids.len(), "mail accounts created");

    // The database trigger creates default folders automatically.
    // We need the inbox folder id for each account to set folder_id on emails.
    // We'll look up or just leave folder_id NULL (the schema allows it).

    // ── Labels per account ────────────────────────────────────────────────────
    let label_defs = [
        ("important", "#EF4444"),
        ("work", "#3B82F6"),
        ("personal", "#10B981"),
    ];

    for (account_id, _) in &account_ids {
        for (label_name, color) in &label_defs {
            sqlx::query(
                r#"
                INSERT INTO mail.labels (id, account_id, name, color, created_at)
                VALUES ($1, $2, $3, $4, NOW())
                ON CONFLICT (account_id, name) DO NOTHING
                "#,
            )
            .bind(Uuid::new_v4())
            .bind(account_id)
            .bind(*label_name)
            .bind(*color)
            .execute(pool)
            .await?;
        }
    }

    // ── Email subjects pool ────────────────────────────────────────────────────
    let subjects = [
        "Re: Planification Sprint 42",
        "Action requise : revue de code avant vendredi",
        "Invitation: Reunion projet migration cloud",
        "Rapport mensuel - Mars 2026",
        "Nouvelle politique de securite informatique",
        "Mise a jour: statut deploiement production",
        "Question sur les specs du module facturation",
        "FWD: Compte-rendu reunion direction",
        "Ticket #4521 - Bug critique en production",
        "Candidature spontanee recue",
        "Newsletter interne - Avril 2026",
        "Demande de conge approuvee",
        "Rappel: Formation securite obligatoire",
        "Presentation resultats Q1",
        "Alerte monitoring: latence elevee detectee",
        "Offre partenariat commercial",
        "Re: Architecture decision - microservices vs monolithe",
        "Invitation afterwork equipe tech",
        "Facture #INV-2026-042 recue",
        "Mise a jour dependances critiques (CVE-2026-xxxx)",
    ];

    let bodies = [
        "Bonjour,\n\nSuite a notre derniere reunion, voici les points d'action identifies.\nCordialement.",
        "Equipe,\n\nJe vous contacte concernant le projet en cours. Merci de bien vouloir prendre connaissance des informations ci-jointes.\nBien cordialement.",
        "Salut,\n\nPetit rappel pour la reunion de demain a 14h. Merci de confirmer votre presence.\nA bientot.",
        "Bonjour a tous,\n\nVeuillez trouver ci-dessous le compte-rendu de notre derniere session de travail.\nN'hesitez pas a me faire part de vos remarques.",
        "Chers collegues,\n\nNous avons detecte une anomalie dans le systeme de monitoring. Les equipes techniques sont informees et travaillent a la resolution.",
    ];

    // ── 5 thread chains of 3–5 emails each ────────────────────────────────────
    let mut email_count = 0usize;

    for thread_idx in 0..5usize {
        let thread_id = Uuid::new_v4();
        let chain_length = 3 + rng.gen_range(0usize..3); // 3, 4, or 5
        let subject = subjects[thread_idx % subjects.len()];
        let (sender_account, sender_user) = account_ids[thread_idx % account_ids.len()];
        let (recip_account, _) = account_ids[(thread_idx + 1) % account_ids.len()];
        let _ = (sender_account, recip_account);

        for msg_in_chain in 0..chain_length {
            let (from_acc, _) = if msg_in_chain % 2 == 0 {
                account_ids[thread_idx % account_ids.len()]
            } else {
                account_ids[(thread_idx + 1) % account_ids.len()]
            };
            let sender_email = format!(
                "{}@acme.corp",
                first_names[thread_idx % first_names.len()]
            );
            let recip_email = format!(
                "{}@acme.corp",
                first_names[(thread_idx + 1) % first_names.len()]
            );
            let is_read = rng.gen_bool(0.7);
            let days_ago: i64 = -(thread_idx as i64 * 3 + msg_in_chain as i64);
            let body = bodies[msg_in_chain % bodies.len()];
            let snippet: String = body.chars().take(200).collect();
            let labels: Vec<&str> = if rng.gen_bool(0.4) {
                vec!["work"]
            } else {
                vec![]
            };
            let labels_pg = format!(
                "{{{}}}",
                labels
                    .iter()
                    .map(|l| format!("\"{}\"", l))
                    .collect::<Vec<_>>()
                    .join(",")
            );

            sqlx::query(
                r#"
                INSERT INTO mail.emails
                    (id, account_id, thread_id, sender, sender_name,
                     recipient, subject, body_text, snippet,
                     is_read, labels, received_at, created_at, updated_at)
                VALUES
                    ($1, $2, $3, $4, $5,
                     $6, $7, $8, $9,
                     $10, $11::TEXT[],
                     NOW() + ($12 || ' days')::INTERVAL,
                     NOW(), NOW())
                ON CONFLICT DO NOTHING
                "#,
            )
            .bind(Uuid::new_v4())
            .bind(from_acc)
            .bind(thread_id)
            .bind(&sender_email)
            .bind(format!(
                "{} {}",
                &first_names[thread_idx % first_names.len()][0..1].to_uppercase(),
                &first_names[thread_idx % first_names.len()][1..]
            ))
            .bind(&recip_email)
            .bind(if msg_in_chain > 0 {
                format!("Re: {}", subject)
            } else {
                subject.to_string()
            })
            .bind(body)
            .bind(&snippet)
            .bind(is_read)
            .bind(&labels_pg)
            .bind(days_ago.to_string())
            .execute(pool)
            .await?;

            email_count += 1;
            let _ = sender_user;
        }
    }

    // ── Remaining standalone emails to reach 100 ─────────────────────────────
    let already = email_count;
    for i in 0..(100usize.saturating_sub(already)) {
        let (from_acc, _) = account_ids[rng.gen_range(0..account_ids.len())];
        let (to_acc, _) = account_ids[rng.gen_range(0..account_ids.len())];
        let _ = to_acc;
        let subject = subjects[i % subjects.len()];
        let body = bodies[i % bodies.len()];
        let snippet: String = body.chars().take(200).collect();
        let is_read = rng.gen_bool(0.6);
        let is_starred = rng.gen_bool(0.1);
        let is_important = rng.gen_bool(0.15);
        let days_ago: i64 = -rng.gen_range(0i64..60);

        // Pick 0–2 labels
        let mut email_labels: Vec<&str> = Vec::new();
        if rng.gen_bool(0.3) {
            email_labels.push("important");
        }
        if rng.gen_bool(0.4) {
            email_labels.push("work");
        }
        if rng.gen_bool(0.2) {
            email_labels.push("personal");
        }
        let labels_pg = format!(
            "{{{}}}",
            email_labels
                .iter()
                .map(|l| format!("\"{}\"", l))
                .collect::<Vec<_>>()
                .join(",")
        );

        let sender_name = first_names[i % first_names.len()];
        let sender_email = format!("{}@acme.corp", sender_name);
        let recip_email = format!("{}@acme.corp", first_names[(i + 1) % first_names.len()]);

        sqlx::query(
            r#"
            INSERT INTO mail.emails
                (id, account_id, sender, sender_name, recipient,
                 subject, body_text, snippet,
                 is_read, is_starred, is_important, labels,
                 received_at, created_at, updated_at)
            VALUES
                ($1, $2, $3, $4, $5,
                 $6, $7, $8,
                 $9, $10, $11, $12::TEXT[],
                 NOW() + ($13 || ' days')::INTERVAL,
                 NOW(), NOW())
            ON CONFLICT DO NOTHING
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(from_acc)
        .bind(&sender_email)
        .bind(format!(
            "{} {}",
            &sender_name[0..1].to_uppercase(),
            &sender_name[1..]
        ))
        .bind(&recip_email)
        .bind(subject)
        .bind(body)
        .bind(&snippet)
        .bind(is_read)
        .bind(is_starred)
        .bind(is_important)
        .bind(&labels_pg)
        .bind(days_ago.to_string())
        .execute(pool)
        .await?;

        email_count += 1;
    }

    info!(emails = email_count, "emails created");

    Ok(())
}

/// Seeds Startup SAS mailboxes and sample emails.
///
/// Creates one `mail.accounts` per startup user with `@startup.signapps.dev`
/// addresses, plus 30 emails covering typical startup communication.
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
    tenant_id: Uuid,
    user_ids: &[(Uuid, Uuid, String)],
) -> Result<(), Box<dyn std::error::Error>> {
    info!(%tenant_id, users = user_ids.len(), "seeding startup mail");

    if user_ids.is_empty() {
        info!("no users available — skipping startup mail seed");
        return Ok(());
    }

    let mut rng = rand::thread_rng();

    let first_names = [
        "lea", "alex", "sofia", "noah", "emma", "lucas", "jade",
        "ethan", "chloe", "liam", "maya", "hugo", "amelia", "leo", "zoe",
    ];

    let mut account_ids: Vec<(Uuid, Uuid)> = Vec::with_capacity(user_ids.len());

    for (idx, (user_id, _, _)) in user_ids.iter().enumerate() {
        let account_id = Uuid::new_v4();
        let first = first_names[idx % first_names.len()];
        let email = format!("{}@startup.signapps.dev", first);
        let display = format!(
            "{} {}",
            &first[0..1].to_uppercase(),
            &first[1..]
        );

        sqlx::query(
            r#"
            INSERT INTO mail.accounts
                (id, user_id, email_address, display_name, provider,
                 imap_server, imap_port, imap_use_tls,
                 smtp_server, smtp_port, smtp_use_tls,
                 status, created_at, updated_at)
            VALUES
                ($1, $2, $3, $4, 'custom',
                 'imap.startup.signapps.dev', 993, TRUE,
                 'smtp.startup.signapps.dev', 587, TRUE,
                 'active', NOW(), NOW())
            ON CONFLICT (user_id, email_address) DO NOTHING
            "#,
        )
        .bind(account_id)
        .bind(user_id)
        .bind(&email)
        .bind(&display)
        .execute(pool)
        .await?;

        account_ids.push((account_id, *user_id));
    }

    info!(accounts = account_ids.len(), "startup mail accounts created");

    // Labels per account
    let label_defs = [
        ("urgent", "#EF4444"),
        ("product", "#8B5CF6"),
        ("growth", "#10B981"),
    ];

    for (account_id, _) in &account_ids {
        for (label_name, color) in &label_defs {
            sqlx::query(
                r#"
                INSERT INTO mail.labels (id, account_id, name, color, created_at)
                VALUES ($1, $2, $3, $4, NOW())
                ON CONFLICT (account_id, name) DO NOTHING
                "#,
            )
            .bind(Uuid::new_v4())
            .bind(account_id)
            .bind(*label_name)
            .bind(*color)
            .execute(pool)
            .await?;
        }
    }

    let subjects = [
        "Sprint planning next week",
        "Investor update — Q1 metrics",
        "User feedback from beta cohort",
        "Hiring: backend engineer needed",
        "Prod incident — 2026-04-10 postmortem",
        "New feature proposal: team dashboard",
        "Re: Partnership with DevTools Co",
        "Budget review Q2",
        "Onboarding checklist for new devs",
        "Security audit scheduled",
    ];

    let bodies = [
        "Hi team,\n\nJust a quick update on this week's priorities. Let's sync tomorrow.\nCheers.",
        "Hey,\n\nFollowing up on our earlier conversation. Please review and share feedback.\nThanks.",
        "All,\n\nHere's the summary of what was discussed. Action items are at the bottom.\nBest.",
        "Team,\n\nFYI — this is time-sensitive. Please respond by EOD.\nThanks.",
        "Hi,\n\nGreat work this week! A few notes before the weekend.\nSee you Monday.",
    ];

    let mut email_count = 0usize;

    // 2 thread chains of 3 emails each
    for thread_idx in 0..2usize {
        let thread_id = Uuid::new_v4();
        let subject = subjects[thread_idx % subjects.len()];
        for msg_in_chain in 0..3usize {
            let (from_acc, _) = account_ids[(thread_idx + msg_in_chain) % account_ids.len()];
            let from_first = first_names[(thread_idx + msg_in_chain) % first_names.len()];
            let to_first = first_names[(thread_idx + msg_in_chain + 1) % first_names.len()];
            let sender_email = format!("{}@startup.signapps.dev", from_first);
            let recip_email = format!("{}@startup.signapps.dev", to_first);
            let is_read = rng.gen_bool(0.6);
            let days_ago: i64 = -(msg_in_chain as i64);
            let body = bodies[msg_in_chain % bodies.len()];
            let snippet: String = body.chars().take(200).collect();

            sqlx::query(
                r#"
                INSERT INTO mail.emails
                    (id, account_id, thread_id, sender, sender_name,
                     recipient, subject, body_text, snippet,
                     is_read, labels, received_at, created_at, updated_at)
                VALUES
                    ($1, $2, $3, $4, $5,
                     $6, $7, $8, $9,
                     $10, '{}', NOW() + ($11 || ' days')::INTERVAL,
                     NOW(), NOW())
                ON CONFLICT DO NOTHING
                "#,
            )
            .bind(Uuid::new_v4())
            .bind(from_acc)
            .bind(thread_id)
            .bind(&sender_email)
            .bind(format!(
                "{} {}",
                &from_first[0..1].to_uppercase(),
                &from_first[1..]
            ))
            .bind(&recip_email)
            .bind(if msg_in_chain > 0 {
                format!("Re: {}", subject)
            } else {
                subject.to_string()
            })
            .bind(body)
            .bind(&snippet)
            .bind(is_read)
            .bind(days_ago.to_string())
            .execute(pool)
            .await?;

            email_count += 1;
        }
    }

    // Standalone emails up to 30 total
    for i in 0..(30usize.saturating_sub(email_count)) {
        let (from_acc, _) = account_ids[i % account_ids.len()];
        let from_first = first_names[i % first_names.len()];
        let to_first = first_names[(i + 1) % first_names.len()];
        let sender_email = format!("{}@startup.signapps.dev", from_first);
        let recip_email = format!("{}@startup.signapps.dev", to_first);
        let subject = subjects[i % subjects.len()];
        let body = bodies[i % bodies.len()];
        let snippet: String = body.chars().take(200).collect();
        let is_read = rng.gen_bool(0.5);
        let is_starred = rng.gen_bool(0.15);
        let days_ago: i64 = -rng.gen_range(0i64..30);

        sqlx::query(
            r#"
            INSERT INTO mail.emails
                (id, account_id, sender, sender_name, recipient,
                 subject, body_text, snippet,
                 is_read, is_starred, labels,
                 received_at, created_at, updated_at)
            VALUES
                ($1, $2, $3, $4, $5,
                 $6, $7, $8,
                 $9, $10, '{}',
                 NOW() + ($11 || ' days')::INTERVAL,
                 NOW(), NOW())
            ON CONFLICT DO NOTHING
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(from_acc)
        .bind(&sender_email)
        .bind(format!(
            "{} {}",
            &from_first[0..1].to_uppercase(),
            &from_first[1..]
        ))
        .bind(&recip_email)
        .bind(subject)
        .bind(body)
        .bind(&snippet)
        .bind(is_read)
        .bind(is_starred)
        .bind(days_ago.to_string())
        .execute(pool)
        .await?;

        email_count += 1;
    }

    info!(emails = email_count, "startup emails created");
    Ok(())
}
