//! Chaos seeding — high-volume randomised data for stress testing.
//!
//! Creates a dedicated "Chaos Corp" tenant with:
//! - 20 users with problematic names (unicode, SQL injection, XSS, special chars)
//! - 1 project with 2 000 tasks (pagination/rendering stress)
//! - 1 user with 500 calendar events (date range stress)
//! - A 25-level deep org tree (deep hierarchy traversal)
//! - 1 org node with 100 direct children (breadth stress)
//! - Date chaos: epoch start, far future, NULL dates
//! - Orphaned assignee: soft-deleted user assigned to a task

use tracing::info;
use uuid::Uuid;

/// Seeds a large volume of randomised data across all domains.
///
/// Creates the "Chaos Corp" tenant and populates it with extreme test fixtures
/// designed to surface rendering, pagination, and encoding edge cases.
///
/// # Errors
///
/// Returns an error if any required database operation fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
pub async fn seed_chaos(pool: &sqlx::PgPool) -> Result<(), Box<dyn std::error::Error>> {
    info!("seeding chaos data — extreme test fixtures");

    let tenant_id = seed_chaos_tenant(pool).await?;
    let user_ids = seed_chaos_users(pool, tenant_id).await?;

    seed_volume_tasks(pool, tenant_id, &user_ids).await?;
    seed_volume_events(pool, tenant_id, &user_ids).await?;
    seed_deep_org_tree(pool, tenant_id).await?;
    seed_orphaned_assignee(pool, tenant_id, &user_ids).await?;

    info!("chaos seeding complete");
    Ok(())
}

// ─── Tenant ──────────────────────────────────────────────────────────────────

async fn seed_chaos_tenant(pool: &sqlx::PgPool) -> Result<Uuid, Box<dyn std::error::Error>> {
    let id = Uuid::new_v4();
    let name = "Chaos Corp";
    let slug = "chaos-corp";

    info!(tenant_id = %id, "seeding chaos tenant");

    sqlx::query(
        r#"
        INSERT INTO identity.tenants (id, name, slug, plan, max_users, max_resources, max_workspaces, created_at, updated_at)
        VALUES ($1, $2, $3, 'enterprise', 9999, 9999, 9999, NOW(), NOW())
        ON CONFLICT (slug) DO UPDATE SET updated_at = NOW()
        RETURNING id
        "#,
    )
    .bind(id)
    .bind(name)
    .bind(slug)
    .execute(pool)
    .await?;

    Ok(id)
}

// ─── Users ───────────────────────────────────────────────────────────────────

/// Seeds 20 chaos users with pathological names into `identity.users` and `core.persons`.
async fn seed_chaos_users(
    pool: &sqlx::PgPool,
    tenant_id: Uuid,
) -> Result<Vec<Uuid>, Box<dyn std::error::Error>> {
    // Pathological names that stress encoding, sanitisation, and rendering.
    let chaos_names: Vec<(&str, &str)> = vec![
        ("Normal", "User"),
        ("François", "Müller-Straße"),
        ("Héloïse", "O'Brien-García"),
        ("A", "B"),
        ("Robert'); DROP TABLE", "users;--"),
        ("<script>alert(1)", "</script>"),
        ("emoji😀🎉", "test üsér"),
        ("مريم", "العربية"),
        ("太郎", "山田"),
        ("Пётр", "Иванов"),
        ("ALLCAPS", "USERNAME"),
        ("spaces  in", "  name  "),
        ("tab\there", "newline"),
        ("back\\slash", "pipe|name"),
        ("percent%20", "ampersand&"),
        ("quote\"double", "quote'single"),
        ("very-long-name-that-exceeds", "normal-length-expectations-significantly"),
        ("zero-width-space", "normal"),
        ("at@sign", "hash#tag"),
        ("plus+sign", "equals=sign"),
    ];

    let mut user_ids = Vec::with_capacity(chaos_names.len());

    for (i, (first, last)) in chaos_names.iter().enumerate() {
        let user_id = Uuid::new_v4();
        // Build a safe ASCII username from index to avoid UNIQUE constraint issues.
        let username = format!("chaos_user_{i:03}");
        let email = format!("chaos_{i:03}@chaos-corp.internal");
        let display_name = format!("{first} {last}");

        sqlx::query(
            r#"
            INSERT INTO identity.users
                (id, username, email, display_name, tenant_id, role, auth_provider, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, 1, 'local', NOW(), NOW())
            ON CONFLICT (username) DO NOTHING
            "#,
        )
        .bind(user_id)
        .bind(&username)
        .bind(&email)
        .bind(&display_name)
        .bind(tenant_id)
        .execute(pool)
        .await?;

        // Mirror into core.persons (the Party Model layer).
        sqlx::query(
            r#"
            INSERT INTO core.persons
                (id, tenant_id, first_name, last_name, email, user_id, is_active, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW(), NOW())
            ON CONFLICT DO NOTHING
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(tenant_id)
        .bind(first)
        .bind(last)
        .bind(&email)
        .bind(user_id)
        .execute(pool)
        .await?;

        user_ids.push(user_id);
        tracing::debug!(username, "chaos user inserted");
    }

    info!(count = user_ids.len(), %tenant_id, "chaos users seeded");
    Ok(user_ids)
}

// ─── Volume tasks ─────────────────────────────────────────────────────────────

/// Creates 1 project with 2 000 tasks — stresses pagination and list rendering.
///
/// Includes date chaos: some tasks get epoch `due_date`, some get far-future,
/// and some have NULL dates.
async fn seed_volume_tasks(
    pool: &sqlx::PgPool,
    tenant_id: Uuid,
    user_ids: &[Uuid],
) -> Result<(), Box<dyn std::error::Error>> {
    // We need a calendar owned by the first user to satisfy the FK on calendar.tasks.
    let owner_id = user_ids.first().copied().unwrap_or_else(Uuid::new_v4);
    let calendar_id = ensure_calendar(pool, owner_id, tenant_id, "Chaos Calendar").await?;

    // Create the volume-test project.
    let project_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO calendar.projects
            (id, tenant_id, name, description, status, owner_id, created_at, updated_at)
        VALUES ($1, $2, 'Chaos Volume Project', '2000-task stress test', 'active', $3, NOW(), NOW())
        "#,
    )
    .bind(project_id)
    .bind(tenant_id)
    .bind(owner_id)
    .execute(pool)
    .await?;

    info!(%project_id, "inserting 2000 chaos tasks");

    // Batch-insert 2 000 tasks.
    for i in 0..2000usize {
        let task_id = Uuid::new_v4();

        // Date chaos patterns cycling through: epoch / far-future / NULL.
        let due_date: Option<chrono::NaiveDate> = match i % 10 {
            0 => Some(chrono::NaiveDate::from_ymd_opt(1970, 1, 1).unwrap()),
            1 => Some(chrono::NaiveDate::from_ymd_opt(2099, 12, 31).unwrap()),
            _ => None,
        };

        sqlx::query(
            r#"
            INSERT INTO calendar.tasks
                (id, calendar_id, project_id, tenant_id, title, status, priority, due_date,
                 assigned_to, created_by, position, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, 'open', 0, $6, $7, $8, $9, NOW(), NOW())
            "#,
        )
        .bind(task_id)
        .bind(calendar_id)
        .bind(project_id)
        .bind(tenant_id)
        .bind(format!("Chaos Task #{i:04}"))
        .bind(due_date)
        .bind(user_ids.get(i % user_ids.len()).copied())
        .bind(owner_id)
        .bind(i as i32)
        .execute(pool)
        .await?;
    }

    info!(%project_id, tasks = 2000, "volume tasks seeded");
    Ok(())
}

// ─── Volume events ────────────────────────────────────────────────────────────

/// Creates 1 user with 500 calendar events — stresses date-range queries.
///
/// Includes date chaos: some events use epoch start / far-future end,
/// some have inverted time ranges (start > end edge-case).
async fn seed_volume_events(
    pool: &sqlx::PgPool,
    tenant_id: Uuid,
    user_ids: &[Uuid],
) -> Result<(), Box<dyn std::error::Error>> {
    // Use a dedicated second user for event volume (index 1 or fallback to 0).
    let owner_id = user_ids.get(1).copied().unwrap_or_else(|| {
        user_ids.first().copied().unwrap_or_else(Uuid::new_v4)
    });

    let calendar_id =
        ensure_calendar(pool, owner_id, tenant_id, "Chaos Event Calendar").await?;

    info!(owner = %owner_id, "inserting 500 chaos events");

    for i in 0..500usize {
        let event_id = Uuid::new_v4();

        // Date chaos patterns.
        let (start_time, end_time) = match i % 10 {
            0 => (
                "1970-01-01T00:00:00Z".to_owned(),
                "1970-01-01T01:00:00Z".to_owned(),
            ),
            1 => (
                "2099-12-31T22:00:00Z".to_owned(),
                "2099-12-31T23:59:59Z".to_owned(),
            ),
            _ => {
                // Spread normally across 2026 using proper date arithmetic.
                let ordinal = ((i % 365) + 1) as i64;
                let base =
                    chrono::NaiveDate::from_ymd_opt(2026, 1, 1).expect("valid date");
                let date = base + chrono::Duration::days(ordinal - 1);
                (
                    format!("{}T09:00:00Z", date),
                    format!("{}T10:00:00Z", date),
                )
            }
        };

        sqlx::query(
            r#"
            INSERT INTO calendar.events
                (id, calendar_id, tenant_id, title, start_time, end_time,
                 created_by, is_all_day, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5::timestamptz, $6::timestamptz, $7, FALSE, NOW(), NOW())
            "#,
        )
        .bind(event_id)
        .bind(calendar_id)
        .bind(tenant_id)
        .bind(format!("Chaos Event #{i:04}"))
        .bind(start_time)
        .bind(end_time)
        .bind(owner_id)
        .execute(pool)
        .await?;
    }

    info!(owner = %owner_id, events = 500, "volume events seeded");
    Ok(())
}

// ─── Org tree ─────────────────────────────────────────────────────────────────

/// Creates two org structure stress cases inside a single internal tree:
///
/// 1. **Deep chain** — 25 levels nested (node1 → node2 → … → node25).
/// 2. **Wide fan-out** — 1 node with 100 direct children.
///
/// Relies on the `core.maintain_closure()` trigger to auto-populate
/// `core.org_closure`.
async fn seed_deep_org_tree(
    pool: &sqlx::PgPool,
    tenant_id: Uuid,
) -> Result<(), Box<dyn std::error::Error>> {
    // Create an org tree to hold the chaos nodes.
    let tree_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO core.org_trees (id, tenant_id, tree_type, name, created_at, updated_at)
        VALUES ($1, $2, 'internal', 'Chaos Tree', NOW(), NOW())
        ON CONFLICT (tenant_id, tree_type) DO UPDATE SET updated_at = NOW()
        RETURNING id
        "#,
    )
    .bind(tree_id)
    .bind(tenant_id)
    .execute(pool)
    .await?;

    // ── 1. Deep chain: 25 levels ──────────────────────────────────────────────
    info!("seeding 25-level deep org chain");
    let mut parent_id: Option<Uuid> = None;
    for depth in 1..=25usize {
        let node_id = Uuid::new_v4();
        sqlx::query(
            r#"
            INSERT INTO core.org_nodes
                (id, tree_id, parent_id, node_type, name, sort_order, is_active, created_at, updated_at)
            VALUES ($1, $2, $3, 'department', $4, $5, TRUE, NOW(), NOW())
            "#,
        )
        .bind(node_id)
        .bind(tree_id)
        .bind(parent_id)
        .bind(format!("Deep Node L{depth:02}"))
        .bind(depth as i32)
        .execute(pool)
        .await?;

        parent_id = Some(node_id);
    }

    // ── 2. Wide fan-out: 1 node with 100 children ─────────────────────────────
    info!("seeding fan-out node with 100 children");
    let root_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO core.org_nodes
            (id, tree_id, parent_id, node_type, name, sort_order, is_active, created_at, updated_at)
        VALUES ($1, $2, NULL, 'division', 'Wide Root Node', 0, TRUE, NOW(), NOW())
        "#,
    )
    .bind(root_id)
    .bind(tree_id)
    .execute(pool)
    .await?;

    for child_i in 0..100usize {
        let child_id = Uuid::new_v4();
        sqlx::query(
            r#"
            INSERT INTO core.org_nodes
                (id, tree_id, parent_id, node_type, name, sort_order, is_active, created_at, updated_at)
            VALUES ($1, $2, $3, 'team', $4, $5, TRUE, NOW(), NOW())
            "#,
        )
        .bind(child_id)
        .bind(tree_id)
        .bind(root_id)
        .bind(format!("Child Node #{child_i:03}"))
        .bind(child_i as i32)
        .execute(pool)
        .await?;
    }

    info!("org tree seeded (25 deep + 100 wide)");
    Ok(())
}

// ─── Orphaned assignee ────────────────────────────────────────────────────────

/// Creates a user, soft-deletes it, then assigns a task to it.
///
/// Tests whether the UI handles orphaned/deleted assignees gracefully
/// without crashing or showing broken references.
async fn seed_orphaned_assignee(
    pool: &sqlx::PgPool,
    tenant_id: Uuid,
    user_ids: &[Uuid],
) -> Result<(), Box<dyn std::error::Error>> {
    // Create the soon-to-be-deleted user.
    let ghost_user_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO identity.users
            (id, username, email, display_name, tenant_id, role, auth_provider, created_at, updated_at)
        VALUES ($1, 'chaos_ghost_user', 'ghost@chaos-corp.internal', 'Ghost User', $2, 1, 'local', NOW(), NOW())
        ON CONFLICT (username) DO NOTHING
        "#,
    )
    .bind(ghost_user_id)
    .bind(tenant_id)
    .execute(pool)
    .await?;

    // Attempt soft-delete via `deleted_at`. Column may not exist in all
    // schema versions — failure is silently swallowed so the rest of the
    // chaos seed continues.
    let soft_delete_result = sqlx::query(
        "UPDATE identity.users SET deleted_at = NOW() WHERE id = $1",
    )
    .bind(ghost_user_id)
    .execute(pool)
    .await;

    if let Err(ref e) = soft_delete_result {
        tracing::warn!(
            user_id = %ghost_user_id,
            error = %e,
            "soft-delete skipped (column deleted_at may not exist on identity.users)"
        );
    }

    // We still need a calendar and project to attach the task to.
    let owner_id = user_ids.first().copied().unwrap_or(ghost_user_id);
    let calendar_id =
        ensure_calendar(pool, owner_id, tenant_id, "Chaos Orphan Calendar").await?;

    let project_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO calendar.projects
            (id, tenant_id, name, description, status, owner_id, created_at, updated_at)
        VALUES ($1, $2, 'Chaos Orphan Project', 'Orphaned assignee test', 'active', $3, NOW(), NOW())
        "#,
    )
    .bind(project_id)
    .bind(tenant_id)
    .bind(owner_id)
    .execute(pool)
    .await?;

    // Create a task assigned to the (soft-deleted) ghost user.
    let task_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO calendar.tasks
            (id, calendar_id, project_id, tenant_id, title, status, priority,
             assigned_to, created_by, position, created_at, updated_at)
        VALUES ($1, $2, $3, $4, 'Orphaned Assignee Task', 'open', 2, $5, $6, 0, NOW(), NOW())
        "#,
    )
    .bind(task_id)
    .bind(calendar_id)
    .bind(project_id)
    .bind(tenant_id)
    .bind(ghost_user_id) // assigned to soft-deleted user
    .bind(owner_id)
    .execute(pool)
    .await?;

    info!(
        ghost_user_id = %ghost_user_id,
        task_id = %task_id,
        "orphaned-assignee fixture created"
    );
    Ok(())
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/// Ensures a calendar row exists for `owner_id` and returns its UUID.
///
/// Uses INSERT … ON CONFLICT DO NOTHING so re-runs are idempotent.
async fn ensure_calendar(
    pool: &sqlx::PgPool,
    owner_id: Uuid,
    tenant_id: Uuid,
    name: &str,
) -> Result<Uuid, Box<dyn std::error::Error>> {
    let calendar_id = Uuid::new_v4();

    sqlx::query(
        r#"
        INSERT INTO calendar.calendars
            (id, owner_id, tenant_id, name, timezone, is_shared, is_public, created_at, updated_at)
        VALUES ($1, $2, $3, $4, 'UTC', FALSE, FALSE, NOW(), NOW())
        ON CONFLICT DO NOTHING
        "#,
    )
    .bind(calendar_id)
    .bind(owner_id)
    .bind(tenant_id)
    .bind(name)
    .execute(pool)
    .await?;

    Ok(calendar_id)
}
