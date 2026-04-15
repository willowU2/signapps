//! Gamification seeding — inserts XP, badges, and XP events.
//!
//! Tables: `gamification.user_xp`, `gamification.badges`, `gamification.xp_events`.

use rand::Rng;
use tracing::info;
use uuid::Uuid;

const BADGE_TYPES: &[&str] = &[
    "first_login",
    "first_task_done",
    "team_player",
    "speed_demon",
    "perfectionist",
    "marathon_runner",
    "early_bird",
    "night_owl",
    "collaborator",
    "mentor",
];

const XP_ACTIONS: &[(&str, &str, i32)] = &[
    ("task_completed", "calendar", 10),
    ("event_created", "calendar", 5),
    ("document_shared", "drive", 8),
    ("message_sent", "chat", 2),
    ("login_streak", "system", 15),
    ("project_completed", "calendar", 50),
    ("first_login", "system", 100),
    ("review_submitted", "docs", 20),
    ("report_generated", "analytics", 30),
    ("onboarding_complete", "system", 200),
];

/// Seeds Acme Corp gamification (user_xp for 80 users, badges for 40, 200 xp_events).
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
    info!(users = user_ids.len(), "seeding acme gamification");

    if user_ids.is_empty() {
        info!("no users — skipping acme gamification seed");
        return Ok(());
    }

    seed_gamification(pool, user_ids, 40, 200).await?;
    Ok(())
}

/// Seeds Startup SAS gamification (user_xp for all, 5 badges).
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
    info!(users = user_ids.len(), "seeding startup gamification");

    if user_ids.is_empty() {
        info!("no users — skipping startup gamification seed");
        return Ok(());
    }

    seed_gamification(pool, user_ids, user_ids.len().min(5), 30).await?;
    Ok(())
}

// ── Private helpers ───────────────────────────────────────────────────────────

async fn seed_gamification(
    pool: &sqlx::PgPool,
    user_ids: &[(Uuid, Uuid, String)],
    badge_user_count: usize,
    xp_event_count: usize,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut rng = rand::thread_rng();

    // ── user_xp for all users ─────────────────────────────────────────────
    for (user_id, _, _) in user_ids.iter() {
        let total_xp: i32 = rng.gen_range(0i32..=5000);
        let level: i32 = 1 + total_xp / 500;
        let streak_days: i32 = rng.gen_range(0i32..=30);
        let last_activity_offset: i32 = -(rng.gen_range(0i32..=7));

        sqlx::query(
            r#"
            INSERT INTO gamification.user_xp
                (id, user_id, total_xp, level, streak_days,
                 last_activity_date, created_at, updated_at)
            VALUES
                ($1, $2, $3, $4, $5,
                 (CURRENT_DATE + ($6 || ' days')::INTERVAL)::DATE,
                 NOW(), NOW())
            ON CONFLICT (user_id) DO NOTHING
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(user_id)
        .bind(total_xp)
        .bind(level)
        .bind(streak_days)
        .bind(last_activity_offset.to_string())
        .execute(pool)
        .await?;
    }
    info!(count = user_ids.len(), "user_xp rows created");

    // ── badges for subset of users ────────────────────────────────────────
    for i in 0..badge_user_count {
        let (user_id, _, _) = crate::helpers::pick(user_ids, i);
        let badge_type = crate::helpers::pick(BADGE_TYPES, i);
        let earned_at_offset: i64 = -(rng.gen_range(0i64..=90));

        sqlx::query(
            r#"
            INSERT INTO gamification.badges
                (id, user_id, badge_type, earned_at)
            VALUES
                ($1, $2, $3, NOW() + ($4 || ' days')::INTERVAL)
            ON CONFLICT DO NOTHING
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(user_id)
        .bind(*badge_type)
        .bind(earned_at_offset.to_string())
        .execute(pool)
        .await?;
    }
    info!(count = badge_user_count, "badges created");

    // ── xp_events ─────────────────────────────────────────────────────────
    for evt_idx in 0..xp_event_count {
        let (user_id, _, _) = crate::helpers::pick(user_ids, rng.gen_range(0..user_ids.len()));
        let (action, source_module, xp_amount) = crate::helpers::pick(XP_ACTIONS, evt_idx);
        let source_id = if rng.gen_bool(0.6) {
            Some(Uuid::new_v4())
        } else {
            None
        };
        let created_at_offset: i64 = -(rng.gen_range(0i64..=90));

        sqlx::query(
            r#"
            INSERT INTO gamification.xp_events
                (id, user_id, action, xp_amount, source_module, source_id, created_at)
            VALUES
                ($1, $2, $3, $4, $5, $6, NOW() + ($7 || ' days')::INTERVAL)
            ON CONFLICT DO NOTHING
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(user_id)
        .bind(*action)
        .bind(*xp_amount)
        .bind(*source_module)
        .bind(source_id)
        .bind(created_at_offset.to_string())
        .execute(pool)
        .await?;
    }
    info!(count = xp_event_count, "xp_events created");

    Ok(())
}
