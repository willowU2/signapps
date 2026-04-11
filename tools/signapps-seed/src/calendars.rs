//! Calendar & project seeding — replaces the legacy `calendar.rs` and `projects.rs`.
//!
//! Inserts calendars (`calendar.calendars`), projects (`calendar.projects`),
//! and scheduling items (`scheduling.time_items`) for events and tasks.

use rand::Rng;
use tracing::info;
use uuid::Uuid;

use crate::helpers;

// ── Shared data ──────────────────────────────────────────────────────────────

const EVENT_TITLES: &[&str] = &[
    "Réunion d'équipe",
    "Daily Standup",
    "Revue de sprint",
    "Démo produit",
    "Comité de pilotage",
    "1:1 avec le manager",
    "All-Hands mensuel",
    "Atelier UX/UI",
    "Formation interne",
    "Réunion stratégie",
    "Point projet",
    "Kick-off nouveau projet",
    "Rétrospective",
    "Code review session",
    "Architecture decision meeting",
    "Bilan mensuel",
    "Réunion budget",
    "Séminaire direction",
    "Session de planification",
    "Réunion client",
];

const TASK_TITLES: &[&str] = &[
    "Analyser les exigences métier",
    "Concevoir l'architecture technique",
    "Configurer l'environnement de dev",
    "Implémenter l'API REST",
    "Rédiger les tests unitaires",
    "Effectuer la revue de code",
    "Documenter l'API",
    "Déployer en staging",
    "Valider la QA",
    "Corriger les bugs critiques",
    "Optimiser les requêtes SQL",
    "Mettre à jour les dépendances",
    "Configurer le CI/CD",
    "Effectuer l'audit sécurité",
    "Refactoriser le module auth",
    "Migrer le schéma BDD",
    "Rédiger les specs techniques",
    "Former l'équipe",
    "Planifier la release",
    "Monitorer post-déploiement",
    "Rédiger la documentation utilisateur",
    "Créer les maquettes UI",
    "Préparer la démo client",
    "Effectuer les tests de charge",
    "Livrer la release",
];

const PROJECT_NAMES_ACME: &[(&str, &str)] = &[
    ("Refonte Backend", "active"),
    ("Site Web v3", "active"),
    ("App Mobile iOS", "planning"),
    ("App Mobile Android", "planning"),
    ("Migration Cloud AWS", "active"),
    ("Audit Sécurité", "completed"),
    ("Formation DevOps", "completed"),
    ("Dashboard Analytics", "active"),
    ("API Gateway v2", "active"),
    ("Onboarding Client", "on_hold"),
    ("Automatisation CI/CD", "active"),
    ("Optimisation Performance", "active"),
    ("Module Facturation", "planning"),
    ("Intégration LDAP", "completed"),
    ("Portail RH", "active"),
    ("Refonte Design System", "active"),
    ("Tests End-to-End", "active"),
    ("Documentation Technique", "on_hold"),
    ("Monitoring & Alerting", "completed"),
    ("Migration Base de Données", "archived"),
];

const PROJECT_NAMES_STARTUP: &[(&str, &str)] = &[
    ("MVP v1", "completed"),
    ("Application Mobile", "active"),
    ("Tableau de Bord Analytics", "planning"),
];

const STATUSES: &[&str] = &["todo", "in_progress", "done", "cancelled"];
const PRIORITIES: &[&str] = &["low", "medium", "high", "urgent"];

// ── Acme Corp ────────────────────────────────────────────────────────────────

/// Seeds Acme Corp calendars, projects, events, and tasks.
///
/// Creates:
/// - 80 personal calendars (one per user)
/// - 20 projects with project members
/// - 200 events in `scheduling.time_items` (item_type='event')
/// - 500 tasks in `scheduling.time_items` (item_type='task')
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
    info!(%tenant_id, users = user_ids.len(), "seeding acme calendars + projects");

    if user_ids.is_empty() {
        info!("no users — skipping acme calendar seed");
        return Ok(());
    }

    let mut rng = rand::thread_rng();

    // ── 80 personal calendars ──────────────────────────────────────────────
    let mut cal_ids: Vec<Uuid> = Vec::with_capacity(user_ids.len());
    for (user_id, _, username) in user_ids.iter() {
        let cal_name = format!("Agenda de {username}");
        let cal_id = helpers::ensure_calendar(pool, *user_id, &cal_name).await?;
        cal_ids.push(cal_id);
    }
    info!(count = cal_ids.len(), "personal calendars created");

    // ── 20 projects ────────────────────────────────────────────────────────
    let mut project_ids: Vec<Uuid> = Vec::with_capacity(PROJECT_NAMES_ACME.len());

    for (i, (name, status)) in PROJECT_NAMES_ACME.iter().enumerate() {
        let project_id = Uuid::new_v4();
        project_ids.push(project_id);
        let owner = helpers::pick(user_ids, i).0;
        let start_offset: i32 = match i % 3 {
            0 => -180,
            1 => -30,
            _ => 7,
        };
        let duration_days: i32 = 30 + (i as i32 % 5) * 30;

        sqlx::query(
            r#"
            INSERT INTO calendar.projects
                (id, tenant_id, name, status, start_date, due_date, owner_id, created_at, updated_at)
            VALUES
                ($1, $2, $3, $4,
                 (NOW() + ($5 || ' days')::INTERVAL)::DATE,
                 (NOW() + ($6 || ' days')::INTERVAL)::DATE,
                 $7, NOW(), NOW())
            ON CONFLICT DO NOTHING
            "#,
        )
        .bind(project_id)
        .bind(tenant_id)
        .bind(*name)
        .bind(*status)
        .bind(start_offset.to_string())
        .bind((start_offset + duration_days).to_string())
        .bind(owner)
        .execute(pool)
        .await?;

        // Owner member
        sqlx::query(
            r#"
            INSERT INTO calendar.project_members (id, project_id, user_id, role, joined_at)
            VALUES ($1, $2, $3, 'owner', NOW())
            ON CONFLICT DO NOTHING
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(project_id)
        .bind(owner)
        .execute(pool)
        .await?;

        // 2–4 additional members
        let member_count = 2 + (i % 3);
        let mut added = std::collections::HashSet::new();
        added.insert(owner);
        for _ in 0..member_count {
            let candidate = helpers::pick(user_ids, rng.gen_range(0..user_ids.len())).0;
            if added.contains(&candidate) {
                continue;
            }
            added.insert(candidate);
            sqlx::query(
                r#"
                INSERT INTO calendar.project_members (id, project_id, user_id, role, joined_at)
                VALUES ($1, $2, $3, 'member', NOW())
                ON CONFLICT DO NOTHING
                "#,
            )
            .bind(Uuid::new_v4())
            .bind(project_id)
            .bind(candidate)
            .execute(pool)
            .await?;
        }
    }
    info!(count = project_ids.len(), "projects created");

    // ── 200 events ─────────────────────────────────────────────────────────
    let mut event_count = 0usize;

    // Daily standups (20)
    for day_offset in 0..28i32 {
        if day_offset % 7 == 5 || day_offset % 7 == 6 {
            continue;
        }
        if event_count >= 20 {
            break;
        }
        let owner = helpers::pick(user_ids, rng.gen_range(0..user_ids.len())).0;
        let cal_id = *helpers::pick(&cal_ids, rng.gen_range(0..cal_ids.len()));
        helpers::insert_time_item(
            pool,
            helpers::TimeItemParams {
                item_type: "event",
                title: "Daily Standup",
                tenant_id,
                owner_id: owner,
                created_by: owner,
                start_day_offset: Some(day_offset),
                start_hour: Some(9),
                duration_minutes: 30,
                all_day: false,
                scope: "nous",
                visibility: "group",
                status: "confirmed",
                priority: "medium",
                project_id: None,
                calendar_id: Some(cal_id),
                deadline_day_offset: None,
            },
        )
        .await?;
        event_count += 1;
    }

    // Fill remaining 180 events with varied types
    let scopes = ["nous", "moi", "nous"];
    let visibilities = ["group", "private", "company"];
    while event_count < 200 {
        let idx = event_count;
        let title = helpers::pick(EVENT_TITLES, idx);
        let owner = helpers::pick(user_ids, rng.gen_range(0..user_ids.len())).0;
        let cal_id = *helpers::pick(&cal_ids, rng.gen_range(0..cal_ids.len()));
        let day_offset: i32 = rng.gen_range(-20i32..60);
        let hour: i32 = rng.gen_range(8i32..18);
        let duration = *helpers::pick(&[30i32, 45, 60, 90, 120], idx);
        let scope = helpers::pick(&scopes, idx);
        let visibility = helpers::pick(&visibilities, idx);
        helpers::insert_time_item(
            pool,
            helpers::TimeItemParams {
                item_type: "event",
                title,
                tenant_id,
                owner_id: owner,
                created_by: owner,
                start_day_offset: Some(day_offset),
                start_hour: Some(hour),
                duration_minutes: duration,
                all_day: false,
                scope,
                visibility,
                status: "confirmed",
                priority: "medium",
                project_id: None,
                calendar_id: Some(cal_id),
                deadline_day_offset: None,
            },
        )
        .await?;
        event_count += 1;
    }
    info!(count = event_count, "events created");

    // ── 500 tasks ──────────────────────────────────────────────────────────
    let status_weights: &[(usize, u32)] = &[(0, 40), (1, 30), (2, 25), (3, 5)];
    for task_idx in 0..500usize {
        let project_id = *helpers::pick(&project_ids, task_idx);
        let title = helpers::pick(TASK_TITLES, task_idx);
        let owner = helpers::pick(user_ids, rng.gen_range(0..user_ids.len())).0;
        let assignee = helpers::pick(user_ids, rng.gen_range(0..user_ids.len())).0;
        let priority = helpers::pick(PRIORITIES, rng.gen_range(0..PRIORITIES.len()));

        let roll: u32 = rng.gen_range(0..100);
        let mut cumul = 0u32;
        let mut status_idx = 0usize;
        for &(i, w) in status_weights {
            cumul += w;
            if roll < cumul {
                status_idx = i;
                break;
            }
        }
        let status = STATUSES[status_idx];

        let deadline_offset: Option<i32> = match rng.gen_range(0u8..10) {
            0..=2 => Some(-(rng.gen_range(1i32..61))),
            3..=7 => Some(rng.gen_range(1i32..91)),
            _ => None,
        };

        let start_offset: Option<i32> = if rng.gen_bool(0.6) {
            Some(rng.gen_range(-30i32..30))
        } else {
            None
        };

        helpers::insert_time_item(
            pool,
            helpers::TimeItemParams {
                item_type: "task",
                title: &format!("{} #{}", title, task_idx + 1),
                tenant_id,
                owner_id: assignee,
                created_by: owner,
                start_day_offset: start_offset,
                start_hour: start_offset.map(|_| 9i32),
                duration_minutes: 0,
                all_day: false,
                scope: "nous",
                visibility: "group",
                status,
                priority,
                project_id: Some(project_id),
                calendar_id: None,
                deadline_day_offset: deadline_offset,
            },
        )
        .await?;
    }
    info!(count = 500, "tasks created");

    Ok(())
}

// ── Startup SAS ───────────────────────────────────────────────────────────────

/// Seeds Startup SAS calendars, projects, events, and tasks.
///
/// Creates:
/// - 15 personal calendars
/// - 3 projects with members
/// - 30 events
/// - 50 tasks
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
    info!(%tenant_id, users = user_ids.len(), "seeding startup calendars + projects");

    if user_ids.is_empty() {
        info!("no users — skipping startup calendar seed");
        return Ok(());
    }

    let mut rng = rand::thread_rng();

    // ── Calendars ──────────────────────────────────────────────────────────
    let mut cal_ids: Vec<Uuid> = Vec::with_capacity(user_ids.len());
    for (user_id, _, username) in user_ids.iter() {
        let cal_id =
            helpers::ensure_calendar(pool, *user_id, &format!("Agenda de {username}")).await?;
        cal_ids.push(cal_id);
    }
    info!(count = cal_ids.len(), "startup calendars created");

    // ── Projects ───────────────────────────────────────────────────────────
    let mut project_ids: Vec<Uuid> = Vec::with_capacity(PROJECT_NAMES_STARTUP.len());
    for (i, (name, status)) in PROJECT_NAMES_STARTUP.iter().enumerate() {
        let project_id = Uuid::new_v4();
        project_ids.push(project_id);
        let owner = helpers::pick(user_ids, i).0;

        sqlx::query(
            r#"
            INSERT INTO calendar.projects
                (id, tenant_id, name, status, start_date, due_date, owner_id, created_at, updated_at)
            VALUES
                ($1, $2, $3, $4,
                 (NOW() - INTERVAL '60 days')::DATE,
                 (NOW() + INTERVAL '120 days')::DATE,
                 $5, NOW(), NOW())
            ON CONFLICT DO NOTHING
            "#,
        )
        .bind(project_id)
        .bind(tenant_id)
        .bind(*name)
        .bind(*status)
        .bind(owner)
        .execute(pool)
        .await?;

        sqlx::query(
            r#"
            INSERT INTO calendar.project_members (id, project_id, user_id, role, joined_at)
            VALUES ($1, $2, $3, 'owner', NOW())
            ON CONFLICT DO NOTHING
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(project_id)
        .bind(owner)
        .execute(pool)
        .await?;

        // Add all other users as members
        for (user_id, _, _) in user_ids.iter() {
            if *user_id == owner {
                continue;
            }
            sqlx::query(
                r#"
                INSERT INTO calendar.project_members (id, project_id, user_id, role, joined_at)
                VALUES ($1, $2, $3, 'member', NOW())
                ON CONFLICT DO NOTHING
                "#,
            )
            .bind(Uuid::new_v4())
            .bind(project_id)
            .bind(user_id)
            .execute(pool)
            .await?;
        }
    }
    info!(count = project_ids.len(), "startup projects created");

    // ── 30 events ──────────────────────────────────────────────────────────
    for i in 0..30usize {
        let title = helpers::pick(EVENT_TITLES, i);
        let owner = helpers::pick(user_ids, rng.gen_range(0..user_ids.len())).0;
        let cal_id = *helpers::pick(&cal_ids, rng.gen_range(0..cal_ids.len()));
        let day_offset: i32 = rng.gen_range(-10i32..30);
        let hour: i32 = rng.gen_range(9i32..17);
        helpers::insert_time_item(
            pool,
            helpers::TimeItemParams {
                item_type: "event",
                title,
                tenant_id,
                owner_id: owner,
                created_by: owner,
                start_day_offset: Some(day_offset),
                start_hour: Some(hour),
                duration_minutes: 60,
                all_day: false,
                scope: "nous",
                visibility: "group",
                status: "confirmed",
                priority: "medium",
                project_id: None,
                calendar_id: Some(cal_id),
                deadline_day_offset: None,
            },
        )
        .await?;
    }
    info!(count = 30, "startup events created");

    // ── 50 tasks ───────────────────────────────────────────────────────────
    for task_idx in 0..50usize {
        let project_id = *helpers::pick(&project_ids, task_idx);
        let title = helpers::pick(TASK_TITLES, task_idx);
        let owner = helpers::pick(user_ids, rng.gen_range(0..user_ids.len())).0;
        let priority = helpers::pick(PRIORITIES, rng.gen_range(0..PRIORITIES.len()));
        let status = helpers::pick(STATUSES, rng.gen_range(0..STATUSES.len()));
        helpers::insert_time_item(
            pool,
            helpers::TimeItemParams {
                item_type: "task",
                title: &format!("{} #{}", title, task_idx + 1),
                tenant_id,
                owner_id: owner,
                created_by: owner,
                start_day_offset: None,
                start_hour: None,
                duration_minutes: 0,
                all_day: false,
                scope: "nous",
                visibility: "group",
                status,
                priority,
                project_id: Some(project_id),
                calendar_id: None,
                deadline_day_offset: Some(rng.gen_range(1i32..60)),
            },
        )
        .await?;
    }
    info!(count = 50, "startup tasks created");

    Ok(())
}
