//! Notifications seeding — inserts notification items and preferences.
//!
//! Tables: `notifications.items`, `notifications.preferences`.

use rand::Rng;
use tracing::info;
use uuid::Uuid;

const NOTIFICATION_TYPES: &[&str] = &[
    "mention",
    "assignment",
    "reminder",
    "approval",
    "share",
    "comment",
    "reaction",
    "system",
];

const MODULES: &[&str] = &[
    "calendar",
    "mail",
    "drive",
    "chat",
    "docs",
    "forms",
    "tasks",
];

const ENTITY_TYPES: &[&str] = &[
    "task",
    "document",
    "email",
    "event",
    "file",
    "form",
    "channel",
];

/// Seeds Acme Corp notifications (50 items, preferences for all users).
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
    info!(users = user_ids.len(), "seeding acme notifications");

    if user_ids.is_empty() {
        info!("no users — skipping acme notifications seed");
        return Ok(());
    }

    seed_notifications(pool, user_ids, 50).await?;
    Ok(())
}

/// Seeds Startup SAS notifications (10 items, preferences for all users).
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
    info!(users = user_ids.len(), "seeding startup notifications");

    if user_ids.is_empty() {
        info!("no users — skipping startup notifications seed");
        return Ok(());
    }

    seed_notifications(pool, user_ids, 10).await?;
    Ok(())
}

// ── Private helpers ───────────────────────────────────────────────────────────

async fn seed_notifications(
    pool: &sqlx::PgPool,
    user_ids: &[(Uuid, Uuid, String)],
    item_count: usize,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut rng = rand::thread_rng();

    // ── Notification items ────────────────────────────────────────────────
    for i in 0..item_count {
        let (user_id, _, _) = crate::helpers::pick(user_ids, rng.gen_range(0..user_ids.len()));
        let notif_type = *crate::helpers::pick(NOTIFICATION_TYPES, i);
        let module = *crate::helpers::pick(MODULES, i);
        let entity_type = *crate::helpers::pick(ENTITY_TYPES, i);
        let entity_id = Uuid::new_v4();
        let is_read = rng.gen_bool(0.4);
        let created_at_offset: i64 = -(rng.gen_range(0i64..=30));

        let title = format!(
            "Nouvelle notification : {} dans {}",
            notif_type, module
        );
        let body = format!(
            "Vous avez une nouvelle activité sur votre {} dans le module {}.",
            entity_type, module
        );
        let deep_link = format!("/app/{}/{}", module, entity_id);

        if is_read {
            sqlx::query(
                r#"
                INSERT INTO notifications.items
                    (id, user_id, type, title, body, module, entity_type, entity_id,
                     deep_link, read, read_at, created_at)
                VALUES
                    ($1, $2, $3, $4, $5, $6, $7, $8,
                     $9, TRUE, NOW() + ($10 || ' days')::INTERVAL + INTERVAL '1 hour',
                     NOW() + ($10 || ' days')::INTERVAL)
                ON CONFLICT DO NOTHING
                "#,
            )
            .bind(Uuid::new_v4())
            .bind(user_id)
            .bind(notif_type)
            .bind(&title)
            .bind(&body)
            .bind(module)
            .bind(entity_type)
            .bind(entity_id)
            .bind(&deep_link)
            .bind(created_at_offset.to_string())
            .execute(pool)
            .await?;
        } else {
            sqlx::query(
                r#"
                INSERT INTO notifications.items
                    (id, user_id, type, title, body, module, entity_type, entity_id,
                     deep_link, read, created_at)
                VALUES
                    ($1, $2, $3, $4, $5, $6, $7, $8,
                     $9, FALSE, NOW() + ($10 || ' days')::INTERVAL)
                ON CONFLICT DO NOTHING
                "#,
            )
            .bind(Uuid::new_v4())
            .bind(user_id)
            .bind(notif_type)
            .bind(&title)
            .bind(&body)
            .bind(module)
            .bind(entity_type)
            .bind(entity_id)
            .bind(&deep_link)
            .bind(created_at_offset.to_string())
            .execute(pool)
            .await?;
        }
    }
    info!(count = item_count, "notification items created");

    // ── Preferences for all users ─────────────────────────────────────────
    let digest_options = ["none", "daily", "weekly"];
    for (i, (user_id, _, _)) in user_ids.iter().enumerate() {
        let digest = *crate::helpers::pick(&digest_options, i);
        let quiet_start = if rng.gen_bool(0.5) { Some("22:00") } else { None };
        let quiet_end = if quiet_start.is_some() { Some("07:00") } else { None };

        if let (Some(qs), Some(qe)) = (quiet_start, quiet_end) {
            sqlx::query(
                r#"
                INSERT INTO notifications.preferences
                    (id, user_id, channels, quiet_hours_start, quiet_hours_end,
                     digest_frequency, muted_modules, created_at, updated_at)
                VALUES
                    ($1, $2,
                     '{"in_app": true, "email": true, "push": false}'::jsonb,
                     $3::TIME, $4::TIME, $5, '{}',
                     NOW(), NOW())
                ON CONFLICT (user_id) DO NOTHING
                "#,
            )
            .bind(Uuid::new_v4())
            .bind(user_id)
            .bind(qs)
            .bind(qe)
            .bind(digest)
            .execute(pool)
            .await?;
        } else {
            sqlx::query(
                r#"
                INSERT INTO notifications.preferences
                    (id, user_id, channels, digest_frequency, muted_modules,
                     created_at, updated_at)
                VALUES
                    ($1, $2,
                     '{"in_app": true, "email": true, "push": false}'::jsonb,
                     $3, '{}',
                     NOW(), NOW())
                ON CONFLICT (user_id) DO NOTHING
                "#,
            )
            .bind(Uuid::new_v4())
            .bind(user_id)
            .bind(digest)
            .execute(pool)
            .await?;
        }
    }
    info!(count = user_ids.len(), "notification preferences created");

    Ok(())
}
