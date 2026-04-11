//! Project seeding — inserts projects and tasks for the Acme Corp scenario.

use rand::Rng;
use tracing::info;
use uuid::Uuid;

/// Seeds Acme Corp projects (boards, tasks, milestones).
///
/// Creates 20 projects in `calendar.projects` with varied statuses and dates,
/// 500 tasks in `scheduling.time_items` distributed across projects, and
/// `calendar.project_members` linking users to projects.
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
    info!(%tenant_id, users = user_ids.len(), "seeding acme projects");

    if user_ids.is_empty() {
        info!("no users available — skipping project seed");
        return Ok(());
    }

    let mut rng = rand::thread_rng();

    // ── 20 projects ──────────────────────────────────────────────────────────
    let project_defs: &[(&str, &str, &str)] = &[
        ("Refonte Backend", "active", "#6366F1"),
        ("Site Web v3", "active", "#10B981"),
        ("App Mobile iOS", "planning", "#F59E0B"),
        ("App Mobile Android", "planning", "#F59E0B"),
        ("Migration Cloud AWS", "active", "#3B82F6"),
        ("Audit Securite", "completed", "#EF4444"),
        ("Formation DevOps", "completed", "#8B5CF6"),
        ("Dashboard Analytics", "active", "#06B6D4"),
        ("API Gateway v2", "active", "#6366F1"),
        ("Onboarding Client", "on_hold", "#D97706"),
        ("Automatisation CI/CD", "active", "#10B981"),
        ("Optimisation Performance", "active", "#3B82F6"),
        ("Module Facturation", "planning", "#EC4899"),
        ("Integration LDAP", "completed", "#8B5CF6"),
        ("Portail RH", "active", "#06B6D4"),
        ("Refonte UI Design System", "active", "#F59E0B"),
        ("Tests End-to-End", "active", "#EF4444"),
        ("Documentation Technique", "on_hold", "#6B7280"),
        ("Monitoring & Alerting", "completed", "#10B981"),
        ("Migration Base de Donnees", "archived", "#6B7280"),
    ];

    let _statuses = ["active", "planning", "on_hold", "completed", "archived"];
    let mut project_ids: Vec<Uuid> = Vec::with_capacity(project_defs.len());

    for (i, (name, status, color)) in project_defs.iter().enumerate() {
        let project_id = Uuid::new_v4();
        project_ids.push(project_id);

        // Spread start/due dates: past, current, future
        let start_offset: i32 = match i % 3 {
            0 => -180, // past project
            1 => -30,  // ongoing
            _ => 7,    // future
        };
        let duration_days: i32 = 30 + (i as i32 % 5) * 30; // 30–150 days

        let owner = user_ids[i % user_ids.len()].0;

        sqlx::query(
            r#"
            INSERT INTO calendar.projects
                (id, tenant_id, name, color, status, start_date, due_date, owner_id, created_at, updated_at)
            VALUES
                ($1, $2, $3, $4, $5,
                 (NOW() + ($6 || ' days')::INTERVAL)::DATE,
                 (NOW() + ($7 || ' days')::INTERVAL)::DATE,
                 $8, NOW(), NOW())
            ON CONFLICT DO NOTHING
            "#,
        )
        .bind(project_id)
        .bind(tenant_id)
        .bind(*name)
        .bind(*color)
        .bind(*status)
        .bind(start_offset.to_string())
        .bind((start_offset + duration_days).to_string())
        .bind(owner)
        .execute(pool)
        .await?;

        // ── project members (2–5 random users per project) ───────────────────
        let member_count = 2 + (i % 4);
        let mut added: std::collections::HashSet<Uuid> = std::collections::HashSet::new();
        // Always add owner
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
        added.insert(owner);

        for _ in 0..member_count {
            let candidate = user_ids[rng.gen_range(0..user_ids.len())].0;
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

    info!(projects = project_ids.len(), "projects created");

    // ── 500 tasks in scheduling.time_items ───────────────────────────────────
    let task_titles = [
        "Analyser les exigences",
        "Conception architecture",
        "Setup environnement dev",
        "Implementation API",
        "Revue de code",
        "Tests unitaires",
        "Tests integration",
        "Documentation API",
        "Deploy en staging",
        "Validation QA",
        "Correction bugs critiques",
        "Optimisation requetes SQL",
        "Mise a jour dependances",
        "Configuration CI/CD",
        "Audit securite code",
        "Refactoring module auth",
        "Migration schema DB",
        "Redaction specs techniques",
        "Formation equipe",
        "Reunion planification sprint",
        "Retrospective sprint",
        "Demo client",
        "Livraison release",
        "Monitoring post-deploy",
        "Bilan de projet",
    ];

    let task_statuses = ["todo", "in_progress", "done", "cancelled"];
    let task_priorities = ["low", "medium", "high", "urgent"];
    let task_status_weights = [40u32, 30, 25, 5]; // probabilities in %

    for task_idx in 0..500usize {
        let project_id = project_ids[task_idx % project_ids.len()];
        let title = task_titles[task_idx % task_titles.len()];
        let owner = user_ids[rng.gen_range(0..user_ids.len())].0;
        let assignee = user_ids[rng.gen_range(0..user_ids.len())].0;

        // Weighted status selection
        let status_roll: u32 = rng.gen_range(0..100);
        let mut cumul = 0u32;
        let mut status_idx = 0usize;
        for (i, &w) in task_status_weights.iter().enumerate() {
            cumul += w;
            if status_roll < cumul {
                status_idx = i;
                break;
            }
        }
        let status = task_statuses[status_idx];

        let priority = task_priorities[rng.gen_range(0..task_priorities.len())];

        // Deadline: 30% past (overdue), 50% future, 20% none
        let deadline_sql: Option<String> = match rng.gen_range(0u8..10) {
            0..=2 => {
                // past: 1–60 days ago
                let days: i32 = -(rng.gen_range(1i32..61));
                Some(format!(
                    "NOW() + INTERVAL '{days} days'"
                ))
            }
            3..=7 => {
                // future: 1–90 days ahead
                let days: i32 = rng.gen_range(1i32..91);
                Some(format!("NOW() + INTERVAL '{days} days'"))
            }
            _ => None,
        };

        // start_time: some tasks have one, some don't
        let has_start = rng.gen_bool(0.6);
        let start_offset: i32 = rng.gen_range(-30i32..30);

        if let Some(ref _deadline) = deadline_sql {
            // Insert with deadline (use two separate queries to avoid dynamic SQL complexity)
            if has_start {
                sqlx::query(
                    r#"
                    INSERT INTO scheduling.time_items
                        (id, item_type, title, tenant_id, owner_id, created_by,
                         project_id, status, priority, scope, visibility,
                         start_time, deadline, created_at, updated_at)
                    VALUES
                        ($1, 'task', $2, $3, $4, $5,
                         $6, $7, $8, 'nous', 'group',
                         NOW() + ($9 || ' days')::INTERVAL,
                         NOW() + ($10 || ' days')::INTERVAL,
                         NOW(), NOW())
                    ON CONFLICT DO NOTHING
                    "#,
                )
                .bind(Uuid::new_v4())
                .bind(format!("{} #{}", title, task_idx + 1))
                .bind(tenant_id)
                .bind(assignee)
                .bind(owner)
                .bind(project_id)
                .bind(status)
                .bind(priority)
                .bind(start_offset.to_string())
                .bind(
                    match rng.gen_range(0u8..10) {
                        0..=2 => -(rng.gen_range(1i32..61)),
                        _ => rng.gen_range(1i32..91),
                    }
                    .to_string(),
                )
                .execute(pool)
                .await?;
            } else {
                sqlx::query(
                    r#"
                    INSERT INTO scheduling.time_items
                        (id, item_type, title, tenant_id, owner_id, created_by,
                         project_id, status, priority, scope, visibility,
                         deadline, created_at, updated_at)
                    VALUES
                        ($1, 'task', $2, $3, $4, $5,
                         $6, $7, $8, 'nous', 'group',
                         NOW() + ($9 || ' days')::INTERVAL,
                         NOW(), NOW())
                    ON CONFLICT DO NOTHING
                    "#,
                )
                .bind(Uuid::new_v4())
                .bind(format!("{} #{}", title, task_idx + 1))
                .bind(tenant_id)
                .bind(assignee)
                .bind(owner)
                .bind(project_id)
                .bind(status)
                .bind(priority)
                .bind(
                    match rng.gen_range(0u8..10) {
                        0..=2 => -(rng.gen_range(1i32..61)),
                        _ => rng.gen_range(1i32..91),
                    }
                    .to_string(),
                )
                .execute(pool)
                .await?;
            }
        } else if has_start {
            sqlx::query(
                r#"
                INSERT INTO scheduling.time_items
                    (id, item_type, title, tenant_id, owner_id, created_by,
                     project_id, status, priority, scope, visibility,
                     start_time, created_at, updated_at)
                VALUES
                    ($1, 'task', $2, $3, $4, $5,
                     $6, $7, $8, 'nous', 'group',
                     NOW() + ($9 || ' days')::INTERVAL,
                     NOW(), NOW())
                ON CONFLICT DO NOTHING
                "#,
            )
            .bind(Uuid::new_v4())
            .bind(format!("{} #{}", title, task_idx + 1))
            .bind(tenant_id)
            .bind(assignee)
            .bind(owner)
            .bind(project_id)
            .bind(status)
            .bind(priority)
            .bind(start_offset.to_string())
            .execute(pool)
            .await?;
        } else {
            sqlx::query(
                r#"
                INSERT INTO scheduling.time_items
                    (id, item_type, title, tenant_id, owner_id, created_by,
                     project_id, status, priority, scope, visibility,
                     created_at, updated_at)
                VALUES
                    ($1, 'task', $2, $3, $4, $5,
                     $6, $7, $8, 'nous', 'group',
                     NOW(), NOW())
                ON CONFLICT DO NOTHING
                "#,
            )
            .bind(Uuid::new_v4())
            .bind(format!("{} #{}", title, task_idx + 1))
            .bind(tenant_id)
            .bind(assignee)
            .bind(owner)
            .bind(project_id)
            .bind(status)
            .bind(priority)
            .execute(pool)
            .await?;
        }
    }

    info!(tasks = 500, "tasks created");

    Ok(())
}
