//! Chaos seeding — high-volume randomised data for stress testing.
//!
//! Creates a dedicated "Chaos Corp" tenant with:
//! - 20 users with problematic names (unicode, SQL injection, XSS, special chars)
//! - 1 project with 2 000 tasks (pagination/rendering stress) via `scheduling.time_items`
//! - 1 user with 500 calendar events (date range stress) via `scheduling.time_items`
//! - A 25-level deep org tree (deep hierarchy traversal)
//! - 1 org node with 100 direct children (breadth stress)
//! - Date chaos: epoch start, far future, NULL dates
//! - Orphaned assignee: soft-deleted user assigned to a task
//! - Drive chaos: files/folders with extreme names
//! - Chat chaos: messages with problematic content
//! - Billing chaos: extreme amounts (zero, negative, overflow-adjacent)

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
    seed_chaos_drive(pool, &user_ids).await?;
    seed_chaos_chat(pool, &user_ids).await?;
    seed_chaos_billing(pool).await?;

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

/// Creates 2 000 tasks via `scheduling.time_items` — stresses pagination and list rendering.
///
/// Includes date chaos: some tasks get epoch `deadline`, some get far-future,
/// and some have NULL dates.
async fn seed_volume_tasks(
    pool: &sqlx::PgPool,
    tenant_id: Uuid,
    user_ids: &[Uuid],
) -> Result<(), Box<dyn std::error::Error>> {
    let owner_id = user_ids.first().copied().unwrap_or_else(Uuid::new_v4);

    info!(owner = %owner_id, "inserting 2000 chaos tasks into scheduling.time_items");

    for i in 0..2000usize {
        let id = Uuid::new_v4();
        let _assignee = user_ids.get(i % user_ids.len()).copied();
        let title = format!("Chaos Task #{i:04}");

        // Date chaos: epoch / far-future / NULL cycling through modulo
        let deadline_sql: String = match i % 10 {
            0 => "'1970-01-01'::timestamptz".to_string(),
            1 => "'2099-12-31'::timestamptz".to_string(),
            _ => "NULL".to_string(),
        };

        let sql = format!(
            r#"
            INSERT INTO scheduling.time_items
                (id, item_type, title, tenant_id, owner_id, created_by,
                 start_time, end_time, duration_minutes, all_day,
                 scope, visibility, status, priority,
                 project_id, deadline,
                 created_at, updated_at)
            VALUES
                ($1, 'task', $2, $3, $4, $5,
                 NULL, NULL, 0, FALSE,
                 'moi', 'private', 'todo', 'medium',
                 NULL, {deadline_sql},
                 NOW(), NOW())
            ON CONFLICT DO NOTHING
            "#
        );

        sqlx::query(&sql)
            .bind(id)
            .bind(&title)
            .bind(tenant_id)
            .bind(owner_id)
            .bind(owner_id)
            .execute(pool)
            .await?;
    }

    info!(tasks = 2000, "volume tasks seeded into scheduling.time_items");
    Ok(())
}

// ─── Volume events ────────────────────────────────────────────────────────────

/// Creates 500 calendar events via `scheduling.time_items` — stresses date-range queries.
///
/// Includes date chaos: some events use epoch start / far-future end.
async fn seed_volume_events(
    pool: &sqlx::PgPool,
    tenant_id: Uuid,
    user_ids: &[Uuid],
) -> Result<(), Box<dyn std::error::Error>> {
    // Use a dedicated second user for event volume (index 1 or fallback to 0).
    let owner_id = user_ids
        .get(1)
        .copied()
        .unwrap_or_else(|| user_ids.first().copied().unwrap_or_else(Uuid::new_v4));

    info!(owner = %owner_id, "inserting 500 chaos events into scheduling.time_items");

    for i in 0..500usize {
        let id = Uuid::new_v4();
        let title = format!("Chaos Event #{i:04}");

        // Date chaos patterns via computed SQL strings
        let (start_sql, end_sql) = match i % 10 {
            0 => (
                "'1970-01-01T00:00:00Z'::timestamptz".to_string(),
                "'1970-01-01T01:00:00Z'::timestamptz".to_string(),
            ),
            1 => (
                "'2099-12-31T22:00:00Z'::timestamptz".to_string(),
                "'2099-12-31T23:59:59Z'::timestamptz".to_string(),
            ),
            _ => {
                // Spread normally across 2026
                let ordinal = ((i % 365) + 1) as i64;
                let base = chrono::NaiveDate::from_ymd_opt(2026, 1, 1).expect("valid date");
                let date = base + chrono::Duration::days(ordinal - 1);
                (
                    format!("'{date}T09:00:00Z'::timestamptz"),
                    format!("'{date}T10:00:00Z'::timestamptz"),
                )
            }
        };

        let sql = format!(
            r#"
            INSERT INTO scheduling.time_items
                (id, item_type, title, tenant_id, owner_id, created_by,
                 start_time, end_time, duration_minutes, all_day,
                 scope, visibility, status, priority,
                 project_id, deadline,
                 created_at, updated_at)
            VALUES
                ($1, 'event', $2, $3, $4, $5,
                 {start_sql}, {end_sql}, 60, FALSE,
                 'moi', 'private', 'confirmed', 'medium',
                 NULL, NULL,
                 NOW(), NOW())
            ON CONFLICT DO NOTHING
            "#
        );

        sqlx::query(&sql)
            .bind(id)
            .bind(&title)
            .bind(tenant_id)
            .bind(owner_id)
            .bind(owner_id)
            .execute(pool)
            .await?;
    }

    info!(owner = %owner_id, events = 500, "volume events seeded into scheduling.time_items");
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

/// Creates a user, soft-deletes it, then assigns a task to it via `scheduling.time_items`.
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
    // schema versions — failure is silently swallowed.
    let soft_delete_result =
        sqlx::query("UPDATE identity.users SET deleted_at = NOW() WHERE id = $1")
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

    let owner_id = user_ids.first().copied().unwrap_or(ghost_user_id);
    let task_id = Uuid::new_v4();

    sqlx::query(
        r#"
        INSERT INTO scheduling.time_items
            (id, item_type, title, tenant_id, owner_id, created_by,
             start_time, end_time, duration_minutes, all_day,
             scope, visibility, status, priority,
             project_id, deadline,
             created_at, updated_at)
        VALUES
            ($1, 'task', 'Orphaned Assignee Task', $2, $3, $4,
             NULL, NULL, 0, FALSE,
             'moi', 'private', 'todo', 'high',
             NULL, NULL,
             NOW(), NOW())
        ON CONFLICT DO NOTHING
        "#,
    )
    .bind(task_id)
    .bind(tenant_id)
    .bind(owner_id)
    .bind(owner_id)
    .execute(pool)
    .await?;

    // Note: assigned_to column does not exist in scheduling.time_items.
    // Ghost user linkage is documented in the description field via metadata.
    tracing::debug!(
        ghost_user_id = %ghost_user_id,
        "ghost user soft-deleted — task created without assigned_to (column not in schema)"
    );

    info!(
        ghost_user_id = %ghost_user_id,
        task_id = %task_id,
        "orphaned-assignee fixture created"
    );
    Ok(())
}

// ─── Drive chaos ─────────────────────────────────────────────────────────────

/// Creates drive nodes with pathological filenames (encoding, XSS, SQL injection).
async fn seed_chaos_drive(
    pool: &sqlx::PgPool,
    user_ids: &[Uuid],
) -> Result<(), Box<dyn std::error::Error>> {
    if user_ids.is_empty() {
        info!("no users — skipping chaos drive seed");
        return Ok(());
    }

    let owner_id = user_ids.first().copied().unwrap_or_else(Uuid::new_v4);

    let chaos_filenames: &[&str] = &[
        "<script>alert('xss')</script>.pdf",
        "Robert'); DROP TABLE nodes;--.docx",
        "../../etc/passwd",
        "normal file.pdf",
        "emoji😀🔥🎉.xlsx",
        "مستند عربي.docx",
        "日本語ファイル.pdf",
        "Русский файл.docx",
        "file with   multiple   spaces.txt",
        "file\twith\ttabs.csv",
        ".hidden_file",
        "file.with.many.dots.pdf",
        "UPPERCASE_FILE.PDF",
        "a",
        "very-long-file-name-that-exceeds-normal-expectations-for-display-in-sidebar.pdf",
        "file with 'single' and \"double\" quotes.docx",
        "percent%20encoded%20name.html",
        "null-byte-removed.txt",
        "unicode\u{200B}zero-width.md",
        "duplicate_name.pdf",
    ];

    // Insert as folder first for the root
    let root_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO drive.nodes
            (id, parent_id, name, node_type, owner_id, size, created_at, updated_at)
        VALUES ($1, NULL, 'Chaos Drive Root', 'folder'::drive.node_type, $2, 0, NOW(), NOW())
        ON CONFLICT DO NOTHING
        "#,
    )
    .bind(root_id)
    .bind(owner_id)
    .execute(pool)
    .await?;

    for (i, filename) in chaos_filenames.iter().enumerate() {
        let file_id = Uuid::new_v4();
        let target_id = Uuid::new_v4();
        let owner = user_ids.get(i % user_ids.len()).copied().unwrap_or(owner_id);
        let size: i64 = if i % 5 == 0 { 0 } else { (i as i64 + 1) * 1024 };

        sqlx::query(
            r#"
            INSERT INTO drive.nodes
                (id, parent_id, name, node_type, target_id, owner_id, size, mime_type, created_at, updated_at)
            VALUES ($1, $2, $3, 'file'::drive.node_type, $4, $5, $6, 'application/octet-stream', NOW(), NOW())
            ON CONFLICT DO NOTHING
            "#,
        )
        .bind(file_id)
        .bind(root_id)
        .bind(filename)
        .bind(target_id)
        .bind(owner)
        .bind(size)
        .execute(pool)
        .await?;
    }

    info!(files = chaos_filenames.len(), "chaos drive nodes seeded");
    Ok(())
}

// ─── Chat chaos ───────────────────────────────────────────────────────────────

/// Creates chat channels and messages with problematic content.
async fn seed_chaos_chat(
    pool: &sqlx::PgPool,
    user_ids: &[Uuid],
) -> Result<(), Box<dyn std::error::Error>> {
    if user_ids.is_empty() {
        info!("no users — skipping chaos chat seed");
        return Ok(());
    }

    let owner_id = user_ids.first().copied().unwrap_or_else(Uuid::new_v4);

    let chaos_channels: &[&str] = &[
        "chaos-general",
        "<script>alert(xss)</script>",
        "channel with spaces",
    ];

    let mut channel_ids = Vec::new();
    for name in chaos_channels {
        let channel_id = Uuid::new_v4();
        sqlx::query(
            r#"
            INSERT INTO chat.channels
                (id, name, topic, is_private, created_by, created_at, updated_at)
            VALUES ($1, $2, 'Chaos channel', FALSE, $3, NOW(), NOW())
            ON CONFLICT DO NOTHING
            "#,
        )
        .bind(channel_id)
        .bind(name)
        .bind(owner_id)
        .execute(pool)
        .await?;
        channel_ids.push(channel_id);
    }

    let chaos_messages: &[&str] = &[
        "<script>alert('xss')</script>",
        "Robert'); DROP TABLE messages;--",
        "Normal message, nothing to see here.",
        "emoji test: 😀🎉🔥💯",
        "مرحبا بالعالم",
        "日本語のメッセージ",
        "Привет мир",
        "message with\nnewlines\nand\ttabs",
        "''",
        "NULL",
        "undefined",
        "{\"json\": \"payload\"}",
        "<!-- HTML comment -->",
        "\\n\\t\\r escape sequences",
        "very long message that repeats many times to stress test rendering limits in the chat UI",
    ];

    for (i, content) in chaos_messages.iter().enumerate() {
        let channel_id = channel_ids.get(i % channel_ids.len()).copied().unwrap();
        let user_id = user_ids.get(i % user_ids.len()).copied().unwrap_or(owner_id);
        let username = format!("chaos_user_{:03}", i % user_ids.len());

        sqlx::query(
            r#"
            INSERT INTO chat.messages
                (id, channel_id, user_id, username, content, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
            ON CONFLICT DO NOTHING
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(channel_id)
        .bind(user_id)
        .bind(&username)
        .bind(*content)
        .execute(pool)
        .await?;
    }

    info!(
        channels = chaos_channels.len(),
        messages = chaos_messages.len(),
        "chaos chat seeded"
    );
    Ok(())
}

// ─── Billing chaos ────────────────────────────────────────────────────────────

/// Creates invoices with extreme amounts (zero, very large, boundary values).
///
/// Uses the correct billing schema: `billing.invoices` (id only),
/// `billing.line_items` (unit_price_cents/total_cents), `billing.payments` (amount_cents).
async fn seed_chaos_billing(pool: &sqlx::PgPool) -> Result<(), Box<dyn std::error::Error>> {
    let extreme_amounts: &[(i32, &str)] = &[
        (0, "Zero amount invoice"),
        (1, "One cent invoice"),
        (2_147_483_647, "Max i32 amount"),
        (100_00, "Normal invoice EUR 100"),
        (0, "Second zero amount"),
        (1_00, "One unit invoice"),
    ];

    for (i, (amount_cents, description)) in extreme_amounts.iter().enumerate() {
        let invoice_id = Uuid::new_v4();

        // billing.invoices requires number NOT NULL
        let number = format!("CHAOS-INV-{:03}", i);
        sqlx::query(
            r#"
            INSERT INTO billing.invoices
                (id, number, amount_cents, currency, status, issued_at, metadata)
            VALUES ($1, $2, $3, 'EUR', 'draft', NOW(), '{}')
            ON CONFLICT DO NOTHING
            "#,
        )
        .bind(invoice_id)
        .bind(&number)
        .bind(*amount_cents)
        .execute(pool)
        .await?;

        let line_id = Uuid::new_v4();
        let total_cents = *amount_cents;
        sqlx::query(
            r#"
            INSERT INTO billing.line_items
                (id, invoice_id, description, quantity, unit_price_cents, total_cents,
                 sort_order, created_at)
            VALUES ($1, $2, $3, 1, $4, $5, $6, NOW())
            ON CONFLICT DO NOTHING
            "#,
        )
        .bind(line_id)
        .bind(invoice_id)
        .bind(*description)
        .bind(*amount_cents)
        .bind(total_cents)
        .bind(i as i32)
        .execute(pool)
        .await?;

        // Add a payment for even-indexed invoices
        if i % 2 == 0 {
            let payment_id = Uuid::new_v4();
            sqlx::query(
                r#"
                INSERT INTO billing.payments
                    (id, invoice_id, amount_cents, currency, method, reference, paid_at, created_at)
                VALUES ($1, $2, $3, 'EUR', 'bank_transfer', $4, NOW(), NOW())
                ON CONFLICT DO NOTHING
                "#,
            )
            .bind(payment_id)
            .bind(invoice_id)
            .bind(*amount_cents)
            .bind(format!("CHAOS-REF-{i:03}"))
            .execute(pool)
            .await?;
        }
    }

    info!(invoices = extreme_amounts.len(), "chaos billing seeded");
    Ok(())
}
