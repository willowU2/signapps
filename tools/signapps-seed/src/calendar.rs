//! Calendar seeding — inserts events for the Acme Corp scenario.

use rand::Rng;
use tracing::info;
use uuid::Uuid;

/// Seeds Acme Corp calendar events (meetings, leaves, shifts).
///
/// Creates ~200 events in `scheduling.time_items` (item_type='event') spread
/// across the current and next month, including recurring standup instances,
/// weekly team meetings, all-hands, 1:1s, reviews, trainings, and all-day
/// events.
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
    info!(%tenant_id, users = user_ids.len(), "seeding acme calendar");

    if user_ids.is_empty() {
        info!("no users available — skipping calendar seed");
        return Ok(());
    }

    let mut rng = rand::thread_rng();
    let mut event_count = 0usize;

    // Helper: pick a random user id
    let pick_user = |rng: &mut rand::rngs::ThreadRng| user_ids[rng.gen_range(0..user_ids.len())].0;

    // ── Daily standup — 20 instances (Mon–Fri for ~4 weeks) ─────────────────
    for day_offset in 0..28i32 {
        // Only Mon–Fri (0=Mon…6=Sun offset from today)
        // We approximate: skip every 5th and 6th day in a rolling week pattern
        if day_offset % 7 == 5 || day_offset % 7 == 6 {
            continue;
        }
        if event_count >= 20 {
            break;
        }
        let owner = pick_user(&mut rng);
        insert_timed_event(
            pool,
            tenant_id,
            owner,
            "Daily Standup",
            day_offset,
            9,
            0,
            30,
            false,
            "nous",
            "group",
        )
        .await?;
        event_count += 1;
    }

    // ── Weekly team meeting — 4 instances (every Monday for 4 weeks) ────────
    for week in 0i32..4 {
        let owner = pick_user(&mut rng);
        insert_timed_event(
            pool,
            tenant_id,
            owner,
            "Weekly Team Meeting",
            week * 7,
            14,
            0,
            60,
            false,
            "nous",
            "group",
        )
        .await?;
        event_count += 1;
    }

    // ── Monthly all-hands — 2 instances ─────────────────────────────────────
    for month_offset in [0i32, 30] {
        let owner = pick_user(&mut rng);
        insert_timed_event(
            pool,
            tenant_id,
            owner,
            "All-Hands Company Meeting",
            month_offset,
            10,
            0,
            120,
            false,
            "nous",
            "company",
        )
        .await?;
        event_count += 1;
    }

    // ── 1:1 meetings — 30 instances ──────────────────────────────────────────
    for i in 0..30i32 {
        let owner = pick_user(&mut rng);
        let day = rng.gen_range(-10i32..60);
        let hour = rng.gen_range(9u32..17);
        insert_timed_event(
            pool,
            tenant_id,
            owner,
            &format!("1:1 Meeting #{}", i + 1),
            day,
            hour,
            0,
            30,
            false,
            "moi",
            "private",
        )
        .await?;
        event_count += 1;
    }

    // ── Sprint reviews — 8 instances (bi-weekly) ────────────────────────────
    for sprint in 0..8i32 {
        let owner = pick_user(&mut rng);
        insert_timed_event(
            pool,
            tenant_id,
            owner,
            &format!("Sprint {} Review", sprint + 1),
            sprint * 14,
            15,
            0,
            90,
            false,
            "nous",
            "group",
        )
        .await?;
        event_count += 1;
    }

    // ── Training sessions — 10 instances ────────────────────────────────────
    let training_topics = [
        "Formation Rust Avance",
        "Workshop Docker & Kubernetes",
        "Securite Applicative",
        "Clean Code & TDD",
        "Architecture Microservices",
        "Formation React & TypeScript",
        "DevOps Best Practices",
        "PostgreSQL Performance",
        "Leadership & Management",
        "Communication Efficace",
    ];
    for (i, topic) in training_topics.iter().enumerate() {
        let owner = pick_user(&mut rng);
        let day = rng.gen_range(0i32..60);
        insert_timed_event(
            pool,
            tenant_id,
            owner,
            topic,
            day,
            9,
            0,
            240,
            false,
            "nous",
            "group",
        )
        .await?;
        event_count += 1;
        let _ = i;
    }

    // ── All-day events — 15 instances (holidays, team building) ─────────────
    let all_day_events = [
        "Journee Team Building",
        "Conge Collectif",
        "Fete Nationale",
        "Hackathon Interne",
        "Journee Portes Ouvertes",
        "Seminaire Direction",
        "Conge Pont",
        "Journee RSE",
        "Offsite Equipe Tech",
        "Journee Innovation",
        "Bilan Annuel",
        "Celebration Lancement Produit",
        "Journee Formation Obligatoire",
        "Inventaire",
        "Audit Interne",
    ];
    for (i, name) in all_day_events.iter().enumerate() {
        let owner = pick_user(&mut rng);
        let day = rng.gen_range(-15i32..60);
        insert_all_day_event(pool, tenant_id, owner, name, day).await?;
        event_count += 1;
        let _ = i;
    }

    // ── Miscellaneous events to reach ~200 total ─────────────────────────────
    let misc_events = [
        "Demo Produit Client",
        "Reunion Budget",
        "Point Projet",
        "Kick-off Projet",
        "Retrospective Sprint",
        "Code Review Session",
        "Architecture Decision Meeting",
        "Onboarding Nouveau Membre",
        "Reunion Marketing",
        "Comite de Pilotage",
        "Revue Securite",
        "Mise en Production",
        "Bilan Mensuel",
        "Reunion Strategie",
        "Atelier UX/UI",
    ];
    let current_count = event_count;
    let remaining = 200usize.saturating_sub(current_count);
    for i in 0..remaining {
        let owner = pick_user(&mut rng);
        let day = rng.gen_range(-20i32..60);
        let hour = rng.gen_range(8u32..18);
        let duration = [30u32, 45, 60, 90, 120][rng.gen_range(0..5)];
        insert_timed_event(
            pool,
            tenant_id,
            owner,
            &format!("{} #{}", misc_events[i % misc_events.len()], i + 1),
            day,
            hour,
            0,
            duration,
            false,
            "nous",
            "group",
        )
        .await?;
        event_count += 1;
    }

    info!(events = event_count, "calendar events created");

    Ok(())
}

/// Inserts a single timed (non-all-day) event into `scheduling.time_items`.
async fn insert_timed_event(
    pool: &sqlx::PgPool,
    tenant_id: Uuid,
    owner_id: Uuid,
    title: &str,
    day_offset: i32,
    hour: u32,
    minute: u32,
    duration_minutes: u32,
    _all_day: bool,
    scope: &str,
    visibility: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let start_expr = format!(
        "DATE_TRUNC('day', NOW()) + INTERVAL '{day_offset} days' + INTERVAL '{hour}:{minute:02}:00'"
    );
    let end_expr = format!(
        "DATE_TRUNC('day', NOW()) + INTERVAL '{day_offset} days' + INTERVAL '{hour}:{minute:02}:00' + INTERVAL '{duration_minutes} minutes'"
    );

    // Build a single SQL string to avoid dynamic binding of computed timestamps
    let sql = format!(
        r#"
        INSERT INTO scheduling.time_items
            (id, item_type, title, tenant_id, owner_id, created_by,
             start_time, end_time, duration_minutes, all_day,
             scope, visibility, status, priority,
             created_at, updated_at)
        VALUES
            ($1, 'event', $2, $3, $4, $4,
             {start_expr},
             {end_expr},
             $5, FALSE,
             $6, $7, 'confirmed', 'medium',
             NOW(), NOW())
        ON CONFLICT DO NOTHING
        "#
    );

    sqlx::query(&sql)
        .bind(Uuid::new_v4())
        .bind(title)
        .bind(tenant_id)
        .bind(owner_id)
        .bind(duration_minutes as i32)
        .bind(scope)
        .bind(visibility)
        .execute(pool)
        .await?;

    Ok(())
}

/// Inserts a single all-day event into `scheduling.time_items`.
async fn insert_all_day_event(
    pool: &sqlx::PgPool,
    tenant_id: Uuid,
    owner_id: Uuid,
    title: &str,
    day_offset: i32,
) -> Result<(), Box<dyn std::error::Error>> {
    let start_expr =
        format!("DATE_TRUNC('day', NOW()) + INTERVAL '{day_offset} days'");
    let end_expr =
        format!("DATE_TRUNC('day', NOW()) + INTERVAL '{day_offset} days' + INTERVAL '1 day'");

    let sql = format!(
        r#"
        INSERT INTO scheduling.time_items
            (id, item_type, title, tenant_id, owner_id, created_by,
             start_time, end_time, all_day,
             scope, visibility, status, priority,
             created_at, updated_at)
        VALUES
            ($1, 'event', $2, $3, $4, $4,
             {start_expr},
             {end_expr},
             TRUE,
             'nous', 'company', 'confirmed', 'medium',
             NOW(), NOW())
        ON CONFLICT DO NOTHING
        "#
    );

    sqlx::query(&sql)
        .bind(Uuid::new_v4())
        .bind(title)
        .bind(tenant_id)
        .bind(owner_id)
        .execute(pool)
        .await?;

    Ok(())
}
