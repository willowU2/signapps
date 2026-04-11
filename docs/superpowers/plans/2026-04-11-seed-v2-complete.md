# Seed Database v2 — Complete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a fully functional seed with 3 complete tenants, 13 modules, platform-level admin, and zero FK violations.

**Architecture:** Rewrite broken modules (calendar, projects, chaos) to use `scheduling.time_items` exclusively. Add 6 new modules (drive, chat, billing, gamification, notifications, sharing). Extract shared helpers. Admin user gets `tenant_id = NULL` for platform-level tenant switching.

**Tech Stack:** Rust, sqlx, tokio, chrono, uuid, tracing

---

## File Structure

```
tools/signapps-seed/src/
  main.rs              — CLI + orchestration (MODIFY: add new modules, admin NULL tenant)
  helpers.rs           — CREATE: ensure_calendar(), random picks, date generators
  tenants.rs           — unchanged
  users.rs             — MODIFY: remove admin password special case (use ADMIN_PASSWORD_HASH always)
  companies.rs         — unchanged
  org.rs               — MODIFY: add seed_startup(), seed_chaos() functions
  calendars.rs         — CREATE: replaces calendar.rs + projects.rs, uses scheduling.time_items
  calendar.rs          — DELETE (replaced by calendars.rs)
  projects.rs          — DELETE (merged into calendars.rs)
  mail.rs              — unchanged
  documents.rs         — unchanged
  drive.rs             — CREATE: folder tree + files + ACLs
  chat.rs              — CREATE: channels + messages (replaces empty chat.rs if exists)
  billing.rs           — CREATE: invoices + line_items + payments
  gamification.rs      — CREATE: badges + user_xp + xp_events
  notifications.rs     — CREATE: notification items + preferences
  sharing.rs           — CREATE: grants + policies
  chaos.rs             — MODIFY: fix all FK violations, use helpers
  verify.rs            — MODIFY: add all new assertions + integrity checks
```

---

### Task 1: Create helpers.rs — Shared Seed Utilities

**Files:**
- Create: `tools/signapps-seed/src/helpers.rs`
- Modify: `tools/signapps-seed/src/main.rs` (add `mod helpers;`)

- [ ] **Step 1: Create helpers.rs with ensure_calendar and time_item helper**

```rust
//! Shared helpers for seed modules.

use chrono::{DateTime, NaiveDate, Utc};
use uuid::Uuid;

/// Creates a calendar in `calendar.calendars` if it doesn't already exist.
/// Returns the calendar_id (existing or newly created).
pub async fn ensure_calendar(
    pool: &sqlx::PgPool,
    owner_id: Uuid,
    name: &str,
) -> Result<Uuid, Box<dyn std::error::Error>> {
    let existing: Option<(Uuid,)> = sqlx::query_as(
        "SELECT id FROM calendar.calendars WHERE owner_id = $1 AND name = $2 LIMIT 1",
    )
    .bind(owner_id)
    .bind(name)
    .fetch_optional(pool)
    .await?;

    if let Some((id,)) = existing {
        return Ok(id);
    }

    let id = Uuid::new_v4();
    sqlx::query(
        r#"INSERT INTO calendar.calendars (id, owner_id, name, timezone, color, is_shared, is_public)
           VALUES ($1, $2, $3, 'Europe/Paris', '#3b82f6', FALSE, FALSE)
           ON CONFLICT DO NOTHING"#,
    )
    .bind(id)
    .bind(owner_id)
    .bind(name)
    .execute(pool)
    .await?;

    Ok(id)
}

/// Parameters for inserting a time_item into scheduling.time_items.
pub struct TimeItemParams<'a> {
    pub tenant_id: Uuid,
    pub owner_id: Uuid,
    pub created_by: Uuid,
    pub item_type: &'a str,
    pub title: &'a str,
    pub start_time: Option<DateTime<Utc>>,
    pub end_time: Option<DateTime<Utc>>,
    pub all_day: bool,
    pub status: &'a str,
    pub priority: i16,
    pub project_id: Option<Uuid>,
    pub scope: &'a str,
    pub visibility: &'a str,
}

/// Inserts a row into scheduling.time_items. Returns the generated id.
pub async fn insert_time_item(
    pool: &sqlx::PgPool,
    p: &TimeItemParams<'_>,
) -> Result<Uuid, Box<dyn std::error::Error>> {
    let id = Uuid::new_v4();
    let duration = match (p.start_time, p.end_time) {
        (Some(s), Some(e)) => Some((e - s).num_minutes() as i32),
        _ => None,
    };

    sqlx::query(
        r#"INSERT INTO scheduling.time_items
            (id, item_type, title, tenant_id, owner_id, created_by,
             start_time, end_time, duration_minutes, all_day,
             status, priority, project_id, scope, visibility,
             created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())"#,
    )
    .bind(id)
    .bind(p.item_type)
    .bind(p.title)
    .bind(p.tenant_id)
    .bind(p.owner_id)
    .bind(p.created_by)
    .bind(p.start_time)
    .bind(p.end_time)
    .bind(duration)
    .bind(p.all_day)
    .bind(p.status)
    .bind(p.priority)
    .bind(p.project_id)
    .bind(p.scope)
    .bind(p.visibility)
    .execute(pool)
    .await?;

    Ok(id)
}

/// Pick a random element from a slice.
pub fn pick<'a, T>(items: &'a [T], index: usize) -> &'a T {
    &items[index % items.len()]
}

/// Generate a date in 2026 from an ordinal day (1-365).
pub fn date_2026(ordinal: u32) -> NaiveDate {
    NaiveDate::from_ymd_opt(2026, 1, 1).unwrap() + chrono::Duration::days((ordinal - 1) as i64)
}

/// Generate a DateTime<Utc> for a given date at a given hour.
pub fn datetime_at(date: NaiveDate, hour: u32) -> DateTime<Utc> {
    date.and_hms_opt(hour, 0, 0)
        .unwrap()
        .and_utc()
}
```

- [ ] **Step 2: Add `mod helpers;` to main.rs**

In `tools/signapps-seed/src/main.rs`, add `mod helpers;` after the existing module declarations.

- [ ] **Step 3: Verify compilation**

Run: `cargo check -p signapps-seed`
Expected: 0 errors (warnings OK for unused)

- [ ] **Step 4: Commit**

```bash
git add tools/signapps-seed/src/helpers.rs tools/signapps-seed/src/main.rs
git commit -m "feat(seed): add shared helpers (ensure_calendar, insert_time_item, date utils)"
```

---

### Task 2: Rewrite calendars.rs — Unified Calendar + Projects + Time Items

**Files:**
- Create: `tools/signapps-seed/src/calendars.rs`
- Delete: `tools/signapps-seed/src/calendar.rs`
- Delete: `tools/signapps-seed/src/projects.rs`
- Modify: `tools/signapps-seed/src/main.rs` (replace `mod calendar; mod projects;` with `mod calendars;`)

This task replaces the broken `calendar.rs` (missing tenant_id) and `projects.rs` (fake calendar_id FK) with a single correct module.

- [ ] **Step 1: Create calendars.rs with Acme seed**

The module must:
1. Create 1 personal calendar per user via `helpers::ensure_calendar()`
2. Create 20 projects in `calendar.projects` with proper `tenant_id` and `owner_id`
3. Create project members in `calendar.project_members`
4. Insert 200 events into `scheduling.time_items` (item_type='event')
5. Insert 500 tasks into `scheduling.time_items` (item_type='task') linked to projects via `project_id`

```rust
//! Calendar, project, and time-item seeding.
//!
//! Uses `scheduling.time_items` exclusively for events and tasks.
//! Creates `calendar.calendars` as containers and `calendar.projects` + members.

use crate::helpers::{self, TimeItemParams};
use chrono::{Duration, NaiveDate, Utc};
use tracing::info;
use uuid::Uuid;

// ─── Project definitions ────────────────────────────────────────────────────

const ACME_PROJECTS: &[(&str, &str, &str)] = &[
    ("Backend Refonte", "#3b82f6", "active"),
    ("Site Web v3", "#10b981", "active"),
    ("App Mobile", "#8b5cf6", "active"),
    ("Migration Cloud", "#f59e0b", "active"),
    ("Refonte UX", "#ec4899", "active"),
    ("API Gateway", "#06b6d4", "active"),
    ("Microservices", "#84cc16", "active"),
    ("Data Pipeline", "#6366f1", "active"),
    ("DevOps CI/CD", "#14b8a6", "active"),
    ("Securite Audit", "#ef4444", "active"),
    ("Formation Interne", "#a855f7", "active"),
    ("Recrutement Q2", "#f97316", "active"),
    ("Budget 2027", "#64748b", "planning"),
    ("Partenariat TechSupply", "#0ea5e9", "active"),
    ("Integration ClientCo", "#d946ef", "active"),
    ("Marketing Digital", "#22c55e", "active"),
    ("Support Automatisation", "#eab308", "active"),
    ("Documentation Technique", "#78716c", "active"),
    ("Tests de Charge", "#dc2626", "active"),
    ("Conformite RGPD", "#7c3aed", "active"),
];

const STARTUP_PROJECTS: &[(&str, &str, &str)] = &[
    ("MVP Launch", "#3b82f6", "active"),
    ("Marketing Site", "#10b981", "active"),
    ("Seed Round", "#f59e0b", "planning"),
];

// ─── Public API ─────────────────────────────────────────────────────────────

/// Seeds calendars, projects, events, and tasks for Acme Corp.
pub async fn seed_acme(
    pool: &sqlx::PgPool,
    tenant_id: Uuid,
    user_ids: &[(Uuid, Uuid, String)],
) -> Result<(), Box<dyn std::error::Error>> {
    info!("seeding Acme calendars + projects + events + tasks");

    // 1. Create personal calendars for each user
    for (user_id, _, _) in user_ids {
        helpers::ensure_calendar(pool, *user_id, "Calendrier personnel").await?;
    }

    // 2. Create projects
    let project_ids = create_projects(pool, tenant_id, user_ids, ACME_PROJECTS).await?;

    // 3. Seed events (200)
    seed_events(pool, tenant_id, user_ids, 200).await?;

    // 4. Seed tasks (500 across 20 projects)
    seed_tasks(pool, tenant_id, user_ids, &project_ids, 500).await?;

    info!(projects = project_ids.len(), events = 200, tasks = 500, "Acme calendars seeded");
    Ok(())
}

/// Seeds calendars, projects, events, and tasks for Startup SAS.
pub async fn seed_startup(
    pool: &sqlx::PgPool,
    tenant_id: Uuid,
    user_ids: &[(Uuid, Uuid, String)],
) -> Result<(), Box<dyn std::error::Error>> {
    info!("seeding Startup calendars + projects + events + tasks");

    for (user_id, _, _) in user_ids {
        helpers::ensure_calendar(pool, *user_id, "Calendrier personnel").await?;
    }

    let project_ids = create_projects(pool, tenant_id, user_ids, STARTUP_PROJECTS).await?;
    seed_events(pool, tenant_id, user_ids, 30).await?;
    seed_tasks(pool, tenant_id, user_ids, &project_ids, 50).await?;

    info!(projects = project_ids.len(), events = 30, tasks = 50, "Startup calendars seeded");
    Ok(())
}

// ─── Internal helpers ───────────────────────────────────────────────────────

async fn create_projects(
    pool: &sqlx::PgPool,
    tenant_id: Uuid,
    user_ids: &[(Uuid, Uuid, String)],
    definitions: &[(&str, &str, &str)],
) -> Result<Vec<Uuid>, Box<dyn std::error::Error>> {
    let mut project_ids = Vec::new();

    for (i, (name, color, status)) in definitions.iter().enumerate() {
        let project_id = Uuid::new_v4();
        let owner_id = user_ids[i % user_ids.len()].0;

        sqlx::query(
            r#"INSERT INTO calendar.projects
                (id, tenant_id, name, color, status, owner_id, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
               ON CONFLICT DO NOTHING"#,
        )
        .bind(project_id)
        .bind(tenant_id)
        .bind(name)
        .bind(color)
        .bind(status)
        .bind(owner_id)
        .execute(pool)
        .await?;

        // Add 2-5 members per project
        let member_count = 2 + (i % 4);
        for j in 0..member_count {
            let member_id = user_ids[(i * 3 + j) % user_ids.len()].0;
            let role = if j == 0 { "owner" } else { "member" };
            sqlx::query(
                r#"INSERT INTO calendar.project_members (id, project_id, user_id, role, joined_at)
                   VALUES ($1, $2, $3, $4, NOW())
                   ON CONFLICT DO NOTHING"#,
            )
            .bind(Uuid::new_v4())
            .bind(project_id)
            .bind(member_id)
            .bind(role)
            .execute(pool)
            .await?;
        }

        project_ids.push(project_id);
    }

    Ok(project_ids)
}

async fn seed_events(
    pool: &sqlx::PgPool,
    tenant_id: Uuid,
    user_ids: &[(Uuid, Uuid, String)],
    count: usize,
) -> Result<(), Box<dyn std::error::Error>> {
    let event_titles = [
        "Standup quotidien", "Réunion d'équipe", "Point projet", "1-on-1 Manager",
        "Revue de sprint", "Démo client", "Rétrospective", "Planning poker",
        "Comité de direction", "Formation sécurité", "Afterwork", "All-hands",
        "Entretien recrutement", "Revue de code", "Atelier UX",
        "Point budget", "Sync inter-équipes", "Workshop innovation",
        "Présentation technique", "Réunion commerciale",
    ];

    let statuses = ["scheduled", "scheduled", "scheduled", "completed", "cancelled"];

    for i in 0..count {
        let owner = &user_ids[i % user_ids.len()];
        let day = helpers::date_2026(((i % 300) + 1) as u32);
        let hour = 8 + (i % 10) as u32;
        let start = helpers::datetime_at(day, hour);
        let end = start + Duration::hours(1);

        helpers::insert_time_item(pool, &TimeItemParams {
            tenant_id,
            owner_id: owner.0,
            created_by: owner.0,
            item_type: "event",
            title: event_titles[i % event_titles.len()],
            start_time: Some(start),
            end_time: Some(end),
            all_day: i % 20 == 0,
            status: statuses[i % statuses.len()],
            priority: 0,
            project_id: None,
            scope: "equipe",
            visibility: "team",
        }).await?;
    }
    Ok(())
}

async fn seed_tasks(
    pool: &sqlx::PgPool,
    tenant_id: Uuid,
    user_ids: &[(Uuid, Uuid, String)],
    project_ids: &[Uuid],
    count: usize,
) -> Result<(), Box<dyn std::error::Error>> {
    let task_prefixes = [
        "Implémenter", "Corriger", "Tester", "Documenter", "Refactorer",
        "Optimiser", "Déployer", "Configurer", "Analyser", "Concevoir",
        "Migrer", "Valider", "Automatiser", "Auditer", "Monitorer",
    ];
    let task_suffixes = [
        "l'API REST", "le composant UI", "la base de données", "le pipeline CI",
        "les tests E2E", "la documentation", "le module auth", "le cache",
        "les permissions", "le dashboard", "les notifications", "le formulaire",
        "l'export PDF", "la recherche", "le webhook",
    ];

    let statuses = ["completed", "completed", "in_progress", "in_progress", "in_progress",
                    "todo", "todo", "todo", "scheduled", "cancelled"];
    let priorities: &[i16] = &[0, 1, 1, 2, 2, 2, 2, 3, 3, 4];

    for i in 0..count {
        let owner = &user_ids[i % user_ids.len()];
        let project_id = project_ids[i % project_ids.len()];
        let title = format!("{} {}", task_prefixes[i % task_prefixes.len()], task_suffixes[(i / task_prefixes.len()) % task_suffixes.len()]);

        let deadline = if i % 3 == 0 {
            Some(helpers::datetime_at(helpers::date_2026(((i % 300) + 30) as u32), 18))
        } else {
            None
        };

        helpers::insert_time_item(pool, &TimeItemParams {
            tenant_id,
            owner_id: owner.0,
            created_by: owner.0,
            item_type: "task",
            title: &title,
            start_time: None,
            end_time: deadline,
            all_day: false,
            status: statuses[i % statuses.len()],
            priority: priorities[i % priorities.len()],
            project_id: Some(project_id),
            scope: "moi",
            visibility: "team",
        }).await?;
    }
    Ok(())
}
```

- [ ] **Step 2: Delete old files and update main.rs**

Remove `calendar.rs` and `projects.rs`. In `main.rs`:
- Replace `mod calendar; mod projects;` with `mod calendars;`
- In `seed_acme()`: replace `projects::seed_acme(...)` and `calendar::seed_acme(...)` with `calendars::seed_acme(pool, tenant_id, &user_ids).await?;`
- In `seed_startup()`: add `calendars::seed_startup(pool, tenant_id, &user_ids).await?;`

- [ ] **Step 3: Verify compilation**

Run: `cargo check -p signapps-seed`
Expected: 0 errors

- [ ] **Step 4: Test seed runs without FK violations**

Run: `DATABASE_URL="postgres://signapps:signapps_dev@localhost:5432/signapps" cargo run -p signapps-seed -- --mode acme --reset`
Expected: no errors, logs show "Acme calendars seeded" with projects=20, events=200, tasks=500

- [ ] **Step 5: Commit**

```bash
git add -A tools/signapps-seed/src/
git commit -m "feat(seed): rewrite calendars module — unified scheduling.time_items, fix FK violations"
```

---

### Task 3: Add org seed for Startup + fix Chaos org

**Files:**
- Modify: `tools/signapps-seed/src/org.rs`

- [ ] **Step 1: Add `seed_startup()` function to org.rs**

Startup has a flat org — 1 root node, all users assigned directly:

```rust
/// Seeds a flat org tree for Startup SAS (1 level, all users direct reports of founder).
pub async fn seed_startup(
    pool: &sqlx::PgPool,
    tenant_id: Uuid,
    user_ids: &[(Uuid, Uuid, String)],
) -> Result<(), Box<dyn std::error::Error>> {
    info!("seeding Startup flat org");

    // Create tree
    let tree_id = Uuid::new_v4();
    sqlx::query(
        r#"INSERT INTO core.org_trees (id, tenant_id, name, description, is_active, created_at, updated_at)
           VALUES ($1, $2, 'Startup SAS', 'Flat organization', TRUE, NOW(), NOW())
           ON CONFLICT DO NOTHING"#,
    )
    .bind(tree_id)
    .bind(tenant_id)
    .execute(pool)
    .await?;

    // Create root node
    let root_id = Uuid::new_v4();
    sqlx::query(
        r#"INSERT INTO core.org_nodes (id, tree_id, tenant_id, parent_id, name, node_type, level, sort_order, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, NULL, 'Startup SAS', 'company', 0, 0, TRUE, NOW(), NOW())
           ON CONFLICT DO NOTHING"#,
    )
    .bind(root_id)
    .bind(tree_id)
    .bind(tenant_id)
    .execute(pool)
    .await?;

    // Assign all users to root node
    for (user_id, person_id, _) in user_ids {
        sqlx::query(
            r#"INSERT INTO core.assignments (id, org_node_id, person_id, tenant_id, role, is_primary, start_date, created_at, updated_at)
               VALUES ($1, $2, $3, $4, 'member', TRUE, CURRENT_DATE, NOW(), NOW())
               ON CONFLICT DO NOTHING"#,
        )
        .bind(Uuid::new_v4())
        .bind(root_id)
        .bind(person_id)
        .bind(tenant_id)
        .execute(pool)
        .await?;
    }

    // Self-referencing closure entry for root
    sqlx::query(
        r#"INSERT INTO core.org_closure (ancestor_id, descendant_id, depth)
           VALUES ($1, $1, 0)
           ON CONFLICT DO NOTHING"#,
    )
    .bind(root_id)
    .execute(pool)
    .await?;

    info!(tree_id = %tree_id, nodes = 1, assignments = user_ids.len(), "Startup org seeded");
    Ok(())
}
```

- [ ] **Step 2: Update main.rs to call org::seed_startup()**

In `seed_startup()` in main.rs, add after users:
```rust
org::seed_startup(pool, tenant_id, &user_ids).await?;
```

- [ ] **Step 3: Verify compilation and test**

Run: `cargo check -p signapps-seed`
Run: `DATABASE_URL="postgres://signapps:signapps_dev@localhost:5432/signapps" cargo run -p signapps-seed -- --mode startup --reset`
Expected: "Startup org seeded" in logs

- [ ] **Step 4: Commit**

```bash
git add tools/signapps-seed/src/org.rs tools/signapps-seed/src/main.rs
git commit -m "feat(seed): add flat org tree for Startup tenant"
```

---

### Task 4: Create drive.rs — File/Folder Tree + ACLs

**Files:**
- Create: `tools/signapps-seed/src/drive.rs`
- Modify: `tools/signapps-seed/src/main.rs` (add `mod drive;` + calls)

- [ ] **Step 1: Create drive.rs**

```rust
//! Drive seeding — folders, files, and ACLs.

use tracing::info;
use uuid::Uuid;

/// Seeds drive data for Acme Corp: 5 root folders, subfolders, ~100 files, ACLs.
pub async fn seed_acme(
    pool: &sqlx::PgPool,
    tenant_id: Uuid,
    user_ids: &[(Uuid, Uuid, String)],
) -> Result<(), Box<dyn std::error::Error>> {
    info!("seeding Acme drive");
    let admin_id = user_ids[0].0;

    // Root folders
    let shared_id = insert_folder(pool, None, "Documents Partagés", admin_id).await?;
    let projets_id = insert_folder(pool, Some(shared_id), "Projets", admin_id).await?;
    let rh_id = insert_folder(pool, Some(shared_id), "RH", admin_id).await?;
    let finance_id = insert_folder(pool, Some(shared_id), "Finance", admin_id).await?;
    let templates_id = insert_folder(pool, Some(shared_id), "Templates", admin_id).await?;

    // Subfolders
    let backend_id = insert_folder(pool, Some(projets_id), "Backend Refonte", admin_id).await?;
    let web_id = insert_folder(pool, Some(projets_id), "Site Web v3", admin_id).await?;
    let contrats_id = insert_folder(pool, Some(rh_id), "Contrats", admin_id).await?;
    let formations_id = insert_folder(pool, Some(rh_id), "Formations", admin_id).await?;
    let factures_id = insert_folder(pool, Some(finance_id), "Factures 2026", admin_id).await?;

    // Files in subfolders
    let file_defs: &[(&str, Uuid, &str, i64)] = &[
        ("architecture.md", backend_id, "text/markdown", 4500),
        ("api-spec.yaml", backend_id, "application/yaml", 12000),
        ("migration-plan.md", backend_id, "text/markdown", 3200),
        ("schema-v2.sql", backend_id, "application/sql", 8700),
        ("benchmark-results.json", backend_id, "application/json", 15000),
        ("wireframes-v3.fig", web_id, "application/figma", 250000),
        ("mockup-homepage.png", web_id, "image/png", 450000),
        ("design-system.md", web_id, "text/markdown", 6200),
        ("contrat-cdi-template.docx", contrats_id, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 35000),
        ("reglement-interieur.pdf", contrats_id, "application/pdf", 120000),
        ("formation-securite.pptx", formations_id, "application/vnd.openxmlformats-officedocument.presentationml.presentation", 890000),
        ("facture-2026-001.pdf", factures_id, "application/pdf", 45000),
        ("facture-2026-002.pdf", factures_id, "application/pdf", 42000),
        ("budget-template.xlsx", templates_id, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 28000),
        ("rapport-template.docx", templates_id, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 18000),
    ];

    for (name, parent, mime, size) in file_defs {
        insert_file(pool, Some(*parent), name, mime, *size, admin_id).await?;
    }

    // Personal folders + files for first 20 users
    for (i, (user_id, _, _)) in user_ids.iter().take(20).enumerate() {
        let personal_id = insert_folder(pool, None, &format!("Mon Drive"), *user_id).await?;
        insert_file(pool, Some(personal_id), "notes.md", "text/markdown", 1200, *user_id).await?;
        if i % 3 == 0 {
            insert_file(pool, Some(personal_id), "todo.md", "text/markdown", 800, *user_id).await?;
        }
    }

    // ACL: shared folder accessible by all
    for (user_id, _, _) in user_ids.iter().take(10) {
        insert_acl(pool, shared_id, "user", Some(*user_id), "viewer", admin_id).await?;
    }

    info!("Acme drive seeded (~100 files, 15 folders)");
    Ok(())
}

/// Seeds drive data for Startup SAS: minimal flat structure.
pub async fn seed_startup(
    pool: &sqlx::PgPool,
    _tenant_id: Uuid,
    user_ids: &[(Uuid, Uuid, String)],
) -> Result<(), Box<dyn std::error::Error>> {
    info!("seeding Startup drive");
    let admin_id = user_ids[0].0;

    let docs_id = insert_folder(pool, None, "Docs", admin_id).await?;
    let design_id = insert_folder(pool, None, "Design", admin_id).await?;
    let admin_folder = insert_folder(pool, None, "Admin", admin_id).await?;

    let files: &[(&str, Uuid, &str, i64)] = &[
        ("pitch-deck.pdf", docs_id, "application/pdf", 2500000),
        ("business-plan.docx", docs_id, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 45000),
        ("roadmap.md", docs_id, "text/markdown", 3200),
        ("logo-final.svg", design_id, "image/svg+xml", 12000),
        ("brand-guidelines.pdf", design_id, "application/pdf", 890000),
        ("statuts.pdf", admin_folder, "application/pdf", 120000),
    ];

    for (name, parent, mime, size) in files {
        insert_file(pool, Some(*parent), name, mime, *size, admin_id).await?;
    }

    // Personal folders for each user
    for (user_id, _, _) in user_ids {
        let personal = insert_folder(pool, None, "Mon Drive", *user_id).await?;
        insert_file(pool, Some(personal), "notes.md", "text/markdown", 500, *user_id).await?;
    }

    info!("Startup drive seeded (18 files, 3 folders + personal)");
    Ok(())
}

// ─── Internal ───────────────────────────────────────────────────────────────

async fn insert_folder(
    pool: &sqlx::PgPool,
    parent_id: Option<Uuid>,
    name: &str,
    owner_id: Uuid,
) -> Result<Uuid, Box<dyn std::error::Error>> {
    let id = Uuid::new_v4();
    sqlx::query(
        r#"INSERT INTO drive.nodes (id, parent_id, name, node_type, owner_id, size, created_at, updated_at)
           VALUES ($1, $2, $3, 'folder', $4, 0, NOW(), NOW())
           ON CONFLICT DO NOTHING"#,
    )
    .bind(id)
    .bind(parent_id)
    .bind(name)
    .bind(owner_id)
    .execute(pool)
    .await?;
    Ok(id)
}

async fn insert_file(
    pool: &sqlx::PgPool,
    parent_id: Option<Uuid>,
    name: &str,
    mime_type: &str,
    size: i64,
    owner_id: Uuid,
) -> Result<Uuid, Box<dyn std::error::Error>> {
    let id = Uuid::new_v4();
    sqlx::query(
        r#"INSERT INTO drive.nodes (id, parent_id, name, node_type, owner_id, size, mime_type, created_at, updated_at)
           VALUES ($1, $2, $3, 'file', $4, $5, $6, NOW(), NOW())
           ON CONFLICT DO NOTHING"#,
    )
    .bind(id)
    .bind(parent_id)
    .bind(name)
    .bind(owner_id)
    .bind(size)
    .bind(mime_type)
    .execute(pool)
    .await?;
    Ok(id)
}

async fn insert_acl(
    pool: &sqlx::PgPool,
    node_id: Uuid,
    grantee_type: &str,
    grantee_id: Option<Uuid>,
    role: &str,
    granted_by: Uuid,
) -> Result<(), Box<dyn std::error::Error>> {
    sqlx::query(
        r#"INSERT INTO drive.acl (id, node_id, grantee_type, grantee_id, role, granted_by, created_at, updated_at)
           VALUES ($1, $2, $3::drive.acl_grantee_type, $4, $5::drive.acl_role, $6, NOW(), NOW())
           ON CONFLICT DO NOTHING"#,
    )
    .bind(Uuid::new_v4())
    .bind(node_id)
    .bind(grantee_type)
    .bind(grantee_id)
    .bind(role)
    .bind(granted_by)
    .execute(pool)
    .await?;
    Ok(())
}
```

- [ ] **Step 2: Add mod + calls in main.rs**

Add `mod drive;` and call `drive::seed_acme(pool, tenant_id, &user_ids).await?;` in `seed_acme()`, `drive::seed_startup(...)` in `seed_startup()`.

- [ ] **Step 3: Verify compilation and test**

Run: `cargo check -p signapps-seed`
Run: `DATABASE_URL="postgres://signapps:signapps_dev@localhost:5432/signapps" cargo run -p signapps-seed -- --mode acme --reset`

- [ ] **Step 4: Commit**

```bash
git add tools/signapps-seed/src/drive.rs tools/signapps-seed/src/main.rs
git commit -m "feat(seed): add drive module — folders, files, ACLs for Acme + Startup"
```

---

### Task 5: Create chat.rs — Channels + Messages

**Files:**
- Create: `tools/signapps-seed/src/chat.rs`
- Modify: `tools/signapps-seed/src/main.rs`

- [ ] **Step 1: Create chat.rs**

```rust
//! Chat seeding — channels and messages.

use chrono::{Duration, Utc};
use tracing::info;
use uuid::Uuid;

pub async fn seed_acme(
    pool: &sqlx::PgPool,
    _tenant_id: Uuid,
    user_ids: &[(Uuid, Uuid, String)],
) -> Result<(), Box<dyn std::error::Error>> {
    info!("seeding Acme chat");
    let admin_id = user_ids[0].0;

    let channels: &[(&str, &str, bool)] = &[
        ("général", "Discussions générales de l'entreprise", false),
        ("dev", "Équipe technique — questions, partages, PR reviews", false),
        ("commercial", "Équipe ventes et marketing", false),
        ("rh", "Ressources humaines — annonces et questions", true),
        ("random", "Tout et n'importe quoi", false),
    ];

    let messages_fr: &[&str] = &[
        "Bonjour à tous ! Comment ça va aujourd'hui ?",
        "Quelqu'un a vu le mail de Pierre concernant la deadline ?",
        "La PR #142 est prête pour review si quelqu'un a 5 min",
        "Je serai en retard au standup, commencez sans moi",
        "Qui est dispo pour un café à 15h ?",
        "Le déploiement de vendredi s'est bien passé",
        "N'oubliez pas la rétrospective à 14h",
        "J'ai pushé les corrections sur la branche feature/calendar",
        "Est-ce qu'on peut décaler la réunion de demain à 10h ?",
        "Merci pour le coup de main sur le bug de prod !",
        "Le client a validé les maquettes, on peut lancer le dev",
        "Attention : maintenance du serveur ce soir à 22h",
        "Nouvelle version du design system disponible sur Figma",
        "Qui gère l'astreinte ce weekend ?",
        "Les tests passent tous en vert sur la CI",
        "Super présentation ce matin, bravo !",
        "On a atteint les 1000 utilisateurs actifs",
        "Je prends mon après-midi, à demain",
        "Le nouveau stagiaire commence lundi, pensez à préparer son poste",
        "Résultats du sondage : 73% préfèrent le format hybride",
    ];

    let message_counts = [80usize, 50, 30, 20, 20];

    for (idx, (name, topic, is_private)) in channels.iter().enumerate() {
        let channel_id = Uuid::new_v4();
        sqlx::query(
            r#"INSERT INTO chat.channels (id, name, topic, is_private, created_by, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
               ON CONFLICT DO NOTHING"#,
        )
        .bind(channel_id)
        .bind(name)
        .bind(topic)
        .bind(is_private)
        .bind(admin_id)
        .execute(pool)
        .await?;

        // Insert messages
        let count = message_counts[idx];
        let now = Utc::now();
        for i in 0..count {
            let user = &user_ids[i % user_ids.len()];
            let username = &user_ids[i % user_ids.len()].2;
            let display_name = username.replace('.', " ");
            let ts = now - Duration::hours((count - i) as i64);

            sqlx::query(
                r#"INSERT INTO chat.messages (id, channel_id, user_id, username, content, created_at, updated_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $6)
                   ON CONFLICT DO NOTHING"#,
            )
            .bind(Uuid::new_v4())
            .bind(channel_id)
            .bind(user.0)
            .bind(&display_name)
            .bind(messages_fr[i % messages_fr.len()])
            .bind(ts)
            .execute(pool)
            .await?;
        }
    }

    info!(channels = 5, messages = 200, "Acme chat seeded");
    Ok(())
}

pub async fn seed_startup(
    pool: &sqlx::PgPool,
    _tenant_id: Uuid,
    user_ids: &[(Uuid, Uuid, String)],
) -> Result<(), Box<dyn std::error::Error>> {
    info!("seeding Startup chat");
    let admin_id = user_ids[0].0;

    let channels: &[(&str, bool, usize)] = &[
        ("général", false, 20),
        ("produit", false, 10),
    ];

    let messages: &[&str] = &[
        "Hey team ! Standup dans 5 min",
        "Le MVP est live, testez et remontez les bugs",
        "J'ai fix le bug de login",
        "On a 50 inscriptions depuis hier !",
        "Qui peut review ma PR ?",
    ];

    for (name, is_private, count) in channels {
        let channel_id = Uuid::new_v4();
        sqlx::query(
            r#"INSERT INTO chat.channels (id, name, is_private, created_by, created_at, updated_at)
               VALUES ($1, $2, $3, $4, NOW(), NOW())
               ON CONFLICT DO NOTHING"#,
        )
        .bind(channel_id)
        .bind(name)
        .bind(is_private)
        .bind(admin_id)
        .execute(pool)
        .await?;

        let now = Utc::now();
        for i in 0..*count {
            let user = &user_ids[i % user_ids.len()];
            let display_name = user.2.replace('.', " ");
            sqlx::query(
                r#"INSERT INTO chat.messages (id, channel_id, user_id, username, content, created_at, updated_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $6)
                   ON CONFLICT DO NOTHING"#,
            )
            .bind(Uuid::new_v4())
            .bind(channel_id)
            .bind(user.0)
            .bind(&display_name)
            .bind(messages[i % messages.len()])
            .bind(now - Duration::hours((count - i) as i64))
            .execute(pool)
            .await?;
        }
    }

    info!(channels = 2, messages = 30, "Startup chat seeded");
    Ok(())
}
```

- [ ] **Step 2: Add mod + calls in main.rs**

- [ ] **Step 3: Test and commit**

```bash
git commit -m "feat(seed): add chat module — channels + messages for Acme + Startup"
```

---

### Task 6: Create billing.rs — Invoices + Line Items + Payments

**Files:**
- Create: `tools/signapps-seed/src/billing.rs`
- Modify: `tools/signapps-seed/src/main.rs`

- [ ] **Step 1: Create billing.rs**

Note: `billing.invoices` only has an `id` column per migration 084. The seed inserts just the id. `billing.line_items` and `billing.payments` have full schemas.

```rust
//! Billing seeding — invoices, line items, payments.

use chrono::{Duration, Utc};
use tracing::info;
use uuid::Uuid;

pub async fn seed_acme(
    pool: &sqlx::PgPool,
    _tenant_id: Uuid,
    _user_ids: &[(Uuid, Uuid, String)],
) -> Result<(), Box<dyn std::error::Error>> {
    info!("seeding Acme billing");

    let descriptions = [
        "Licence logicielle annuelle", "Support technique mensuel",
        "Développement sur mesure", "Formation utilisateurs",
        "Hébergement cloud", "Maintenance préventive",
        "Consulting architecture", "Audit sécurité",
    ];

    for i in 0..20usize {
        let invoice_id = Uuid::new_v4();

        // Insert invoice (only id column exists per migration)
        sqlx::query("INSERT INTO billing.invoices (id) VALUES ($1) ON CONFLICT DO NOTHING")
            .bind(invoice_id)
            .execute(pool)
            .await?;

        // 2-4 line items per invoice
        let line_count = 2 + (i % 3);
        let mut total_cents = 0i32;
        for j in 0..line_count {
            let qty = 1 + (j as i32 % 3);
            let unit_price = ((i + j + 1) * 2500) as i32; // 25€ to 125€
            let line_total = qty * unit_price;
            total_cents += line_total;

            sqlx::query(
                r#"INSERT INTO billing.line_items (id, invoice_id, description, quantity, unit_price_cents, total_cents, sort_order, created_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                   ON CONFLICT DO NOTHING"#,
            )
            .bind(Uuid::new_v4())
            .bind(invoice_id)
            .bind(descriptions[(i + j) % descriptions.len()])
            .bind(qty)
            .bind(unit_price)
            .bind(line_total)
            .bind(j as i32)
            .execute(pool)
            .await?;
        }

        // Payment for first 8 invoices (paid)
        if i < 8 {
            let methods = ["bank_transfer", "card", "bank_transfer", "check"];
            sqlx::query(
                r#"INSERT INTO billing.payments (id, invoice_id, amount_cents, currency, method, reference, paid_at, created_at)
                   VALUES ($1, $2, $3, 'EUR', $4, $5, $6, NOW())
                   ON CONFLICT DO NOTHING"#,
            )
            .bind(Uuid::new_v4())
            .bind(invoice_id)
            .bind(total_cents)
            .bind(methods[i % methods.len()])
            .bind(format!("PAY-2026-{:04}", i + 1))
            .bind(Utc::now() - Duration::days((20 - i) as i64))
            .execute(pool)
            .await?;
        }
    }

    info!(invoices = 20, "Acme billing seeded");
    Ok(())
}

pub async fn seed_startup(
    pool: &sqlx::PgPool,
    _tenant_id: Uuid,
    _user_ids: &[(Uuid, Uuid, String)],
) -> Result<(), Box<dyn std::error::Error>> {
    info!("seeding Startup billing");

    for i in 0..5usize {
        let invoice_id = Uuid::new_v4();
        sqlx::query("INSERT INTO billing.invoices (id) VALUES ($1) ON CONFLICT DO NOTHING")
            .bind(invoice_id)
            .execute(pool)
            .await?;

        let unit_price = ((i + 1) * 5000) as i32;
        sqlx::query(
            r#"INSERT INTO billing.line_items (id, invoice_id, description, quantity, unit_price_cents, total_cents, sort_order, created_at)
               VALUES ($1, $2, 'Abonnement mensuel', 1, $3, $3, 0, NOW())
               ON CONFLICT DO NOTHING"#,
        )
        .bind(Uuid::new_v4())
        .bind(invoice_id)
        .bind(unit_price)
        .execute(pool)
        .await?;

        if i < 3 {
            sqlx::query(
                r#"INSERT INTO billing.payments (id, invoice_id, amount_cents, currency, method, paid_at, created_at)
                   VALUES ($1, $2, $3, 'EUR', 'card', NOW(), NOW())
                   ON CONFLICT DO NOTHING"#,
            )
            .bind(Uuid::new_v4())
            .bind(invoice_id)
            .bind(unit_price)
            .execute(pool)
            .await?;
        }
    }

    info!(invoices = 5, "Startup billing seeded");
    Ok(())
}
```

- [ ] **Step 2: Add mod + calls in main.rs**
- [ ] **Step 3: Test and commit**

```bash
git commit -m "feat(seed): add billing module — invoices, line items, payments"
```

---

### Task 7: Create gamification.rs — Badges + XP + Events

**Files:**
- Create: `tools/signapps-seed/src/gamification.rs`
- Modify: `tools/signapps-seed/src/main.rs`

- [ ] **Step 1: Create gamification.rs**

```rust
//! Gamification seeding — badges, XP, events.

use chrono::{Duration, Utc};
use tracing::info;
use uuid::Uuid;

const BADGE_TYPES: &[&str] = &[
    "premier_pas", "contributeur_actif", "maitre_du_code", "reviewer_expert",
    "marathonien", "mentor", "innovateur", "bug_hunter", "documentation_hero",
    "team_player", "early_bird", "night_owl", "streak_master", "top_reviewer", "legende",
];

const XP_ACTIONS: &[(&str, i32)] = &[
    ("task_completed", 10),
    ("review_done", 15),
    ("bug_fixed", 20),
    ("doc_written", 12),
    ("streak_day", 5),
    ("badge_earned", 50),
    ("helped_colleague", 8),
    ("meeting_organized", 5),
];

pub async fn seed_acme(
    pool: &sqlx::PgPool,
    _tenant_id: Uuid,
    user_ids: &[(Uuid, Uuid, String)],
) -> Result<(), Box<dyn std::error::Error>> {
    info!("seeding Acme gamification");

    // XP per user (varying levels)
    for (i, (user_id, _, _)) in user_ids.iter().enumerate() {
        let total_xp = ((i + 1) * 50 + (i * 17) % 500) as i32;
        let level = 1 + total_xp / 200;
        let streak = (i % 30) as i32;

        sqlx::query(
            r#"INSERT INTO gamification.user_xp (id, user_id, total_xp, level, streak_days, last_activity_date, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, NOW(), NOW())
               ON CONFLICT (user_id) DO NOTHING"#,
        )
        .bind(Uuid::new_v4())
        .bind(user_id)
        .bind(total_xp)
        .bind(level)
        .bind(streak)
        .execute(pool)
        .await?;
    }

    // Badges (distribute among first 40 users)
    for (i, (user_id, _, _)) in user_ids.iter().take(40).enumerate() {
        // Each user gets 1-4 badges
        let badge_count = 1 + (i % 4);
        for j in 0..badge_count {
            let badge_type = BADGE_TYPES[(i + j) % BADGE_TYPES.len()];
            sqlx::query(
                r#"INSERT INTO gamification.badges (id, user_id, badge_type, earned_at)
                   VALUES ($1, $2, $3, $4)
                   ON CONFLICT DO NOTHING"#,
            )
            .bind(Uuid::new_v4())
            .bind(user_id)
            .bind(badge_type)
            .bind(Utc::now() - Duration::days((30 - i as i64).max(1)))
            .execute(pool)
            .await?;
        }
    }

    // XP events (200)
    let now = Utc::now();
    for i in 0..200usize {
        let user_id = user_ids[i % user_ids.len()].0;
        let (action, xp) = XP_ACTIONS[i % XP_ACTIONS.len()];

        sqlx::query(
            r#"INSERT INTO gamification.xp_events (id, user_id, action, xp_amount, source_module, created_at)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT DO NOTHING"#,
        )
        .bind(Uuid::new_v4())
        .bind(user_id)
        .bind(action)
        .bind(xp)
        .bind("calendar")
        .bind(now - Duration::hours(i as i64))
        .execute(pool)
        .await?;
    }

    info!(xp_users = user_ids.len(), badges_awarded = 40, xp_events = 200, "Acme gamification seeded");
    Ok(())
}

pub async fn seed_startup(
    pool: &sqlx::PgPool,
    _tenant_id: Uuid,
    user_ids: &[(Uuid, Uuid, String)],
) -> Result<(), Box<dyn std::error::Error>> {
    info!("seeding Startup gamification");

    for (i, (user_id, _, _)) in user_ids.iter().enumerate() {
        let total_xp = ((i + 1) * 30) as i32;
        sqlx::query(
            r#"INSERT INTO gamification.user_xp (id, user_id, total_xp, level, streak_days, created_at, updated_at)
               VALUES ($1, $2, $3, 1, 0, NOW(), NOW())
               ON CONFLICT (user_id) DO NOTHING"#,
        )
        .bind(Uuid::new_v4())
        .bind(user_id)
        .bind(total_xp)
        .execute(pool)
        .await?;

        if i < 5 {
            sqlx::query(
                r#"INSERT INTO gamification.badges (id, user_id, badge_type, earned_at)
                   VALUES ($1, $2, $3, NOW())
                   ON CONFLICT DO NOTHING"#,
            )
            .bind(Uuid::new_v4())
            .bind(user_id)
            .bind(BADGE_TYPES[i])
            .execute(pool)
            .await?;
        }
    }

    info!("Startup gamification seeded");
    Ok(())
}
```

- [ ] **Step 2: Add mod + calls in main.rs**
- [ ] **Step 3: Test and commit**

```bash
git commit -m "feat(seed): add gamification module — badges, XP, events"
```

---

### Task 8: Create notifications.rs — Items + Preferences

**Files:**
- Create: `tools/signapps-seed/src/notifications.rs`
- Modify: `tools/signapps-seed/src/main.rs`

- [ ] **Step 1: Create notifications.rs**

Table is `notifications.items` (migration 265), NOT `notifications.notifications`.

```rust
//! Notification seeding — items and preferences.

use chrono::{Duration, Utc};
use tracing::info;
use uuid::Uuid;

const NOTIFICATION_TEMPLATES: &[(&str, &str, &str, &str)] = &[
    ("assignment", "Nouvelle tâche assignée", "Vous avez été assigné à", "calendar"),
    ("mention", "Vous avez été mentionné", "Dans le canal #général", "chat"),
    ("reminder", "Rappel : réunion dans 15min", "Point projet Backend Refonte", "calendar"),
    ("approval", "Demande d'approbation", "Congés du 15 au 22 mars", "calendar"),
    ("share", "Document partagé avec vous", "Architecture v2.md", "documents"),
    ("comment", "Nouveau commentaire", "Sur votre document", "documents"),
    ("system", "Mise à jour disponible", "Version 2.5.0 déployée", "system"),
    ("reaction", "Réaction à votre message", "👍 sur votre message", "chat"),
];

pub async fn seed_acme(
    pool: &sqlx::PgPool,
    _tenant_id: Uuid,
    user_ids: &[(Uuid, Uuid, String)],
) -> Result<(), Box<dyn std::error::Error>> {
    info!("seeding Acme notifications");

    let now = Utc::now();

    // 50 notifications spread across users
    for i in 0..50usize {
        let user_id = user_ids[i % user_ids.len()].0;
        let (ntype, title, body, module) = NOTIFICATION_TEMPLATES[i % NOTIFICATION_TEMPLATES.len()];
        let is_read = i % 5 < 3; // 60% read

        sqlx::query(
            r#"INSERT INTO notifications.items
                (id, user_id, type, title, body, module, read, read_at, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
               ON CONFLICT DO NOTHING"#,
        )
        .bind(Uuid::new_v4())
        .bind(user_id)
        .bind(ntype)
        .bind(title)
        .bind(body)
        .bind(module)
        .bind(is_read)
        .bind(if is_read { Some(now - Duration::hours(i as i64)) } else { None })
        .bind(now - Duration::hours((50 - i) as i64))
        .execute(pool)
        .await?;
    }

    // Preferences for each user
    for (user_id, _, _) in user_ids {
        sqlx::query(
            r#"INSERT INTO notifications.preferences (id, user_id, channels, digest_frequency, created_at, updated_at)
               VALUES ($1, $2, '{"in_app": true, "email": true, "push": false}'::jsonb, 'none', NOW(), NOW())
               ON CONFLICT (user_id) DO NOTHING"#,
        )
        .bind(Uuid::new_v4())
        .bind(user_id)
        .execute(pool)
        .await?;
    }

    info!(notifications = 50, preferences = user_ids.len(), "Acme notifications seeded");
    Ok(())
}

pub async fn seed_startup(
    pool: &sqlx::PgPool,
    _tenant_id: Uuid,
    user_ids: &[(Uuid, Uuid, String)],
) -> Result<(), Box<dyn std::error::Error>> {
    info!("seeding Startup notifications");

    let now = Utc::now();
    for i in 0..10usize {
        let user_id = user_ids[i % user_ids.len()].0;
        let (ntype, title, body, module) = NOTIFICATION_TEMPLATES[i % NOTIFICATION_TEMPLATES.len()];

        sqlx::query(
            r#"INSERT INTO notifications.items (id, user_id, type, title, body, module, read, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, FALSE, $7)
               ON CONFLICT DO NOTHING"#,
        )
        .bind(Uuid::new_v4())
        .bind(user_id)
        .bind(ntype)
        .bind(title)
        .bind(body)
        .bind(module)
        .bind(now - Duration::hours(i as i64))
        .execute(pool)
        .await?;
    }

    for (user_id, _, _) in user_ids {
        sqlx::query(
            r#"INSERT INTO notifications.preferences (id, user_id, channels, digest_frequency, created_at, updated_at)
               VALUES ($1, $2, '{"in_app": true, "email": false, "push": false}'::jsonb, 'daily', NOW(), NOW())
               ON CONFLICT (user_id) DO NOTHING"#,
        )
        .bind(Uuid::new_v4())
        .bind(user_id)
        .execute(pool)
        .await?;
    }

    info!("Startup notifications seeded");
    Ok(())
}
```

- [ ] **Step 2: Add mod + calls in main.rs**
- [ ] **Step 3: Test and commit**

```bash
git commit -m "feat(seed): add notifications module — items + preferences"
```

---

### Task 9: Create sharing.rs — Grants + Policies

**Files:**
- Create: `tools/signapps-seed/src/sharing.rs`
- Modify: `tools/signapps-seed/src/main.rs`

- [ ] **Step 1: Create sharing.rs**

```rust
//! Sharing seeding — grants and policies.

use tracing::info;
use uuid::Uuid;

pub async fn seed_acme(
    pool: &sqlx::PgPool,
    tenant_id: Uuid,
    user_ids: &[(Uuid, Uuid, String)],
) -> Result<(), Box<dyn std::error::Error>> {
    info!("seeding Acme sharing");

    let resource_types = ["document", "folder", "calendar", "file"];
    let roles = ["viewer", "editor", "viewer", "manager"];

    // 30 sharing grants between users
    for i in 0..30usize {
        let granter = user_ids[i % user_ids.len()].0;
        let grantee = user_ids[(i + 5) % user_ids.len()].0;
        let resource_type = resource_types[i % resource_types.len()];
        let role = roles[i % roles.len()];

        sqlx::query(
            r#"INSERT INTO sharing.grants
                (id, tenant_id, resource_type, resource_id, grantee_type, grantee_id, role, can_reshare, inherit, granted_by, created_at, updated_at)
               VALUES ($1, $2, $3, $4, 'user', $5, $6, $7, TRUE, $8, NOW(), NOW())
               ON CONFLICT DO NOTHING"#,
        )
        .bind(Uuid::new_v4())
        .bind(tenant_id)
        .bind(resource_type)
        .bind(Uuid::new_v4()) // resource_id — placeholder, valid UUID
        .bind(grantee)
        .bind(role)
        .bind(i % 4 == 0) // can_reshare for every 4th
        .bind(granter)
        .execute(pool)
        .await?;
    }

    // 3 policies
    let policies: &[(&str, &str)] = &[
        ("folder", "viewer"),
        ("folder", "editor"),
        ("calendar", "viewer"),
    ];
    for (container_type, default_role) in policies {
        sqlx::query(
            r#"INSERT INTO sharing.policies
                (id, tenant_id, container_type, container_id, grantee_type, default_role, can_reshare, apply_to_existing, created_by, created_at, updated_at)
               VALUES ($1, $2, $3, $4, 'everyone', $5, FALSE, FALSE, $6, NOW(), NOW())
               ON CONFLICT DO NOTHING"#,
        )
        .bind(Uuid::new_v4())
        .bind(tenant_id)
        .bind(container_type)
        .bind(Uuid::new_v4())
        .bind(default_role)
        .bind(user_ids[0].0)
        .execute(pool)
        .await?;
    }

    info!(grants = 30, policies = 3, "Acme sharing seeded");
    Ok(())
}

pub async fn seed_startup(
    pool: &sqlx::PgPool,
    tenant_id: Uuid,
    user_ids: &[(Uuid, Uuid, String)],
) -> Result<(), Box<dyn std::error::Error>> {
    info!("seeding Startup sharing");

    // 5 grants — everything shared openly
    for i in 0..5usize {
        let granter = user_ids[0].0;
        sqlx::query(
            r#"INSERT INTO sharing.grants
                (id, tenant_id, resource_type, resource_id, grantee_type, role, can_reshare, inherit, granted_by, created_at, updated_at)
               VALUES ($1, $2, 'folder', $3, 'everyone', 'editor', TRUE, TRUE, $4, NOW(), NOW())
               ON CONFLICT DO NOTHING"#,
        )
        .bind(Uuid::new_v4())
        .bind(tenant_id)
        .bind(Uuid::new_v4())
        .bind(granter)
        .execute(pool)
        .await?;
    }

    info!(grants = 5, "Startup sharing seeded");
    Ok(())
}
```

- [ ] **Step 2: Add mod + calls in main.rs**
- [ ] **Step 3: Test and commit**

```bash
git commit -m "feat(seed): add sharing module — grants + policies"
```

---

### Task 10: Rewrite chaos.rs — Use helpers, fix all FK violations

**Files:**
- Modify: `tools/signapps-seed/src/chaos.rs`

- [ ] **Step 1: Rewrite chaos.rs to use helpers**

Key changes:
- Replace all `calendar.tasks` inserts with `helpers::insert_time_item(item_type="task")`
- Replace all `calendar.events` inserts with `helpers::insert_time_item(item_type="event")`
- Call `helpers::ensure_calendar()` before inserting events
- Add `tenant_id` to all queries that were missing it
- Add chaos data for new modules (drive, chat, billing, gamification, notifications, sharing)

The chaos module should call the existing `seed_chaos_users()` then add stress data via `scheduling.time_items`.

- [ ] **Step 2: Verify no FK violations**

Run: `DATABASE_URL="postgres://signapps:signapps_dev@localhost:5432/signapps" cargo run -p signapps-seed -- --mode chaos --reset`
Expected: no errors, logs show chaos seeding complete

- [ ] **Step 3: Commit**

```bash
git commit -m "fix(seed): rewrite chaos module — use helpers, fix FK violations, add new domains"
```

---

### Task 11: Update main.rs — Full Orchestration + Admin Platform-Level

**Files:**
- Modify: `tools/signapps-seed/src/main.rs`

- [ ] **Step 1: Update module declarations and orchestration**

Replace the current module list and seed functions with:

```rust
mod billing;
mod calendars;
mod chaos;
mod chat;
mod companies;
mod documents;
mod drive;
mod gamification;
mod helpers;
mod mail;
mod notifications;
mod org;
mod sharing;
mod tenants;
mod users;
mod verify;
```

Update `seed_acme()`:
```rust
async fn seed_acme(pool: &sqlx::PgPool) -> Result<(), Box<dyn std::error::Error>> {
    info!("mode=acme: seeding Acme Corp full scenario");
    let tenant_id = tenants::seed_tenant(pool, "Acme Corp", true).await?;
    let user_ids = users::seed_acme(pool, tenant_id).await?;
    companies::seed_acme(pool, tenant_id).await?;
    org::seed_acme(pool, tenant_id, &user_ids).await?;
    calendars::seed_acme(pool, tenant_id, &user_ids).await?;
    mail::seed_acme(pool, tenant_id, &user_ids).await?;
    documents::seed_acme(pool, tenant_id, &user_ids).await?;
    drive::seed_acme(pool, tenant_id, &user_ids).await?;
    chat::seed_acme(pool, tenant_id, &user_ids).await?;
    billing::seed_acme(pool, tenant_id, &user_ids).await?;
    gamification::seed_acme(pool, tenant_id, &user_ids).await?;
    notifications::seed_acme(pool, tenant_id, &user_ids).await?;
    sharing::seed_acme(pool, tenant_id, &user_ids).await?;
    Ok(())
}
```

Update `seed_startup()` similarly with all modules.

Update `seed_full()` to set admin as platform-level:
```rust
SeedMode::Full => {
    info!("mode=full: seeding all 3 tenants");
    seed_acme(&pool).await?;
    seed_startup(&pool).await?;
    seed_chaos(&pool).await?;

    // Make admin platform-level (no fixed tenant)
    info!("setting admin as platform-level user (tenant_id = NULL)");
    sqlx::query("UPDATE identity.users SET tenant_id = NULL WHERE username = 'admin'")
        .execute(&pool)
        .await?;
}
```

- [ ] **Step 2: Update reset to include new tables**

Add to the `tables` array in `reset_seed_data()`:
```rust
// New modules
"sharing.grants",
"sharing.policies",
"notifications.items",
"notifications.preferences",
"gamification.xp_events",
"gamification.badges",
"gamification.user_xp",
"billing.payments",
"billing.line_items",
"billing.invoices",
"chat.messages",
"chat.channels",
"drive.acl",
"drive.nodes",
```

- [ ] **Step 3: Full test**

Run: `DATABASE_URL="postgres://signapps:signapps_dev@localhost:5432/signapps" cargo run -p signapps-seed -- --mode full --reset --verify`
Expected: all 3 tenants seed successfully, verify passes

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(seed): full orchestration — 13 modules, admin platform-level, reset v2"
```

---

### Task 12: Update verify.rs — Comprehensive Assertions

**Files:**
- Modify: `tools/signapps-seed/src/verify.rs`

- [ ] **Step 1: Add all new assertions**

Add checks for full mode:
```rust
// New module assertions (full mode)
check_table_count(pool, "drive.nodes", 130, &mut errors).await;
check_table_count(pool, "chat.channels", 10, &mut errors).await;
check_table_count(pool, "chat.messages", 200, &mut errors).await;
check_table_count(pool, "billing.invoices", 25, &mut errors).await;
check_table_count(pool, "gamification.user_xp", 80, &mut errors).await;
check_table_count(pool, "gamification.xp_events", 200, &mut errors).await;
check_table_count(pool, "notifications.items", 50, &mut errors).await;
check_table_count(pool, "notifications.preferences", 80, &mut errors).await;
check_table_count(pool, "sharing.grants", 30, &mut errors).await;
```

Add integrity check:
```rust
// Admin is platform-level
if mode == "full" {
    let admin_tenant: Option<(Option<Uuid>,)> = sqlx::query_as(
        "SELECT tenant_id FROM identity.users WHERE username = 'admin'"
    )
    .fetch_optional(pool)
    .await
    .unwrap_or(None);

    match admin_tenant {
        Some((None,)) => tracing::info!("  OK  admin.tenant_id = NULL (platform-level)"),
        Some((Some(tid),)) => errors.push(format!("admin.tenant_id = {tid}, expected NULL")),
        None => errors.push("admin user not found".to_string()),
    }
}
```

- [ ] **Step 2: Test verify in full mode**

Run: `DATABASE_URL="postgres://signapps:signapps_dev@localhost:5432/signapps" cargo run -p signapps-seed -- --mode full --reset --verify`
Expected: "all verification checks passed"

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(seed): verify v2 — comprehensive assertions for all 13 modules + admin check"
```

---

### Task 13: Final Integration Test — Full seed end-to-end

**Files:** None (verification only)

- [ ] **Step 1: Clean seed from scratch**

```bash
DATABASE_URL="postgres://signapps:signapps_dev@localhost:5432/signapps" cargo run -p signapps-seed -- --mode full --reset --verify
```

Expected output:
- 3 tenants created
- ~116 users (80 Acme + 15 Startup + 20 Chaos + 1 admin)
- All module logs show success
- Verify passes all checks
- Admin has `tenant_id = NULL`
- No FK violations, no constraint errors
- Total time < 30 seconds

- [ ] **Step 2: Verify admin login returns 3 tenant contexts**

```bash
curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq '.requires_context, (.contexts | length)'
```

Expected: `true` and `3`

- [ ] **Step 3: Verify select-context works for each tenant**

```bash
# Get token and first context id, then select it
TOKEN=$(curl -s ... | jq -r '.access_token')
CTX_ID=$(curl -s ... | jq -r '.contexts[0].id')
curl -s -X POST http://localhost:3001/api/v1/auth/select-context \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"context_id\":\"$CTX_ID\"}" | jq '.context.label'
```

Expected: returns tenant name (e.g., "Acme Corp")

- [ ] **Step 4: Final commit**

```bash
git commit --allow-empty -m "test(seed): verified full seed end-to-end — 3 tenants, 13 modules, admin platform-level"
```
