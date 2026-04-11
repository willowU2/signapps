# Test Seed Database & Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a Rust seed binary that generates 3 tenants (realistic + chaos) and integrate it into a two-level automated pipeline (pre-push smoke + CI full).

**Architecture:** New workspace member `tools/signapps-seed` with modular seeders per domain. Pre-push hook runs minimal seed + smoke tests. CI workflow runs full seed + all E2E tests.

**Tech Stack:** Rust (sqlx, fake, clap, rand), PostgreSQL, GitHub Actions, Husky pre-push hook, Playwright

---

## File Structure

| File | Responsibility | Action |
|------|---------------|--------|
| `tools/signapps-seed/Cargo.toml` | Crate manifest | Create |
| `tools/signapps-seed/src/main.rs` | CLI + orchestration | Create |
| `tools/signapps-seed/src/tenants.rs` | Tenant + config seeding | Create |
| `tools/signapps-seed/src/users.rs` | Users + auth + roles | Create |
| `tools/signapps-seed/src/companies.rs` | Companies + affiliations + login contexts | Create |
| `tools/signapps-seed/src/org.rs` | Org tree + nodes + assignments + closure | Create |
| `tools/signapps-seed/src/projects.rs` | Projects + members + tasks | Create |
| `tools/signapps-seed/src/calendar.rs` | Events + recurrence + attendees | Create |
| `tools/signapps-seed/src/mail.rs` | Accounts + emails + threads | Create |
| `tools/signapps-seed/src/documents.rs` | Docs + versions + comments | Create |
| `tools/signapps-seed/src/chaos.rs` | Chaos tenant extreme data | Create |
| `tools/signapps-seed/src/verify.rs` | Post-seed integrity assertions | Create |
| `Cargo.toml` | Add workspace member | Modify |
| `.husky/pre-push` | Pre-push hook | Create |
| `.github/workflows/seed-and-test.yml` | CI workflow | Create |
| `client/e2e/chaos-regression.spec.ts` | Chaos E2E tests | Create |

---

## Task 1: Scaffold Seed Binary + Main CLI

**Files:**
- Create: `tools/signapps-seed/Cargo.toml`
- Create: `tools/signapps-seed/src/main.rs`
- Modify: `Cargo.toml` (workspace members)

- [ ] **Step 1: Create Cargo.toml**

```toml
[package]
name = "signapps-seed"
version = "0.1.0"
edition = "2021"

[dependencies]
sqlx = { version = "0.7", features = ["runtime-tokio", "postgres", "uuid", "chrono", "json"] }
tokio = { version = "1", features = ["full"] }
uuid = { version = "1", features = ["v4"] }
chrono = { version = "0.4", features = ["serde"] }
serde_json = "1"
clap = { version = "4", features = ["derive"] }
rand = "0.8"
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
```

- [ ] **Step 2: Create main.rs with CLI**

```rust
//! SignApps Test Database Seeder
//!
//! Generates comprehensive test data for all 34 services.

use clap::Parser;
use sqlx::postgres::PgPoolOptions;

mod tenants;
mod users;
mod companies;
mod org;
mod projects;
mod calendar;
mod mail;
mod documents;
mod chaos;
mod verify;

#[derive(Parser)]
#[command(name = "signapps-seed", about = "Generate test database for SignApps")]
struct Cli {
    /// Seed mode
    #[arg(long, default_value = "full")]
    mode: String, // "minimal", "full", "chaos-only"

    /// Reset database before seeding
    #[arg(long)]
    reset: bool,

    /// Run post-seed verification
    #[arg(long)]
    verify: bool,

    /// Database URL
    #[arg(long, env = "DATABASE_URL", default_value = "postgres://signapps:password@localhost:5432/signapps")]
    database_url: String,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::init();
    let cli = Cli::parse();

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&cli.database_url)
        .await?;

    if cli.reset {
        tracing::info!("Resetting database...");
        sqlx::query("DO $$ DECLARE r RECORD; BEGIN FOR r IN (SELECT schemaname, tablename FROM pg_tables WHERE schemaname IN ('identity','core','scheduling','calendar','mail','mailserver','sharing','workforce','search','keep','help','status','resources','reports','comms','notifications','gamification','collaboration','vault','compliance')) LOOP EXECUTE 'TRUNCATE TABLE ' || r.schemaname || '.' || r.tablename || ' CASCADE'; END LOOP; END $$;")
            .execute(&pool).await?;
        tracing::info!("Database reset complete");
    }

    match cli.mode.as_str() {
        "minimal" => {
            tracing::info!("Seeding minimal data...");
            let tenant_id = tenants::seed_tenant(&pool, "TestCorp", true).await?;
            users::seed_minimal(&pool, tenant_id).await?;
        }
        "full" => {
            tracing::info!("Seeding full data (3 tenants, 200+ users)...");
            // Tenant 1: Acme Corp (80 users)
            let acme_id = tenants::seed_tenant(&pool, "Acme Corp", true).await?;
            let acme_users = users::seed_acme(&pool, acme_id).await?;
            let acme_companies = companies::seed_acme(&pool, acme_id, &acme_users).await?;
            let acme_org = org::seed_acme(&pool, acme_id, &acme_users).await?;
            projects::seed_acme(&pool, acme_id, &acme_users, &acme_org).await?;
            calendar::seed_acme(&pool, acme_id, &acme_users).await?;
            mail::seed_acme(&pool, acme_id, &acme_users).await?;
            documents::seed_acme(&pool, acme_id, &acme_users).await?;

            // Tenant 2: StartupXYZ (15 users)
            let startup_id = tenants::seed_tenant(&pool, "StartupXYZ", false).await?;
            users::seed_startup(&pool, startup_id).await?;

            // Tenant 3: Chaos Industries
            let chaos_id = tenants::seed_tenant(&pool, "Chaos Industries", false).await?;
            chaos::seed_chaos(&pool, chaos_id).await?;
        }
        "chaos-only" => {
            tracing::info!("Seeding chaos data only...");
            let chaos_id = tenants::seed_tenant(&pool, "Chaos Industries", false).await?;
            chaos::seed_chaos(&pool, chaos_id).await?;
        }
        _ => {
            eprintln!("Unknown mode: {}. Use: minimal, full, chaos-only", cli.mode);
            std::process::exit(1);
        }
    }

    if cli.verify {
        tracing::info!("Running verification...");
        verify::run(&pool, &cli.mode).await?;
    }

    tracing::info!("Seed complete.");
    Ok(())
}
```

- [ ] **Step 3: Add workspace member**

Add to root `Cargo.toml` in `[workspace] members`:
```toml
"tools/signapps-seed",
```

- [ ] **Step 4: Create stub modules**

Create empty stub files for each module so it compiles:
```rust
// tools/signapps-seed/src/tenants.rs
use sqlx::PgPool;
use uuid::Uuid;

pub async fn seed_tenant(pool: &PgPool, name: &str, _is_primary: bool) -> Result<Uuid, Box<dyn std::error::Error>> {
    let id = Uuid::new_v4();
    sqlx::query("INSERT INTO identity.tenants (id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING")
        .bind(id).bind(name)
        .execute(pool).await?;
    tracing::info!("Created tenant: {} ({})", name, id);
    Ok(id)
}
```

Create similar stubs for: users.rs, companies.rs, org.rs, projects.rs, calendar.rs, mail.rs, documents.rs, chaos.rs, verify.rs — each with a public async function that returns Ok(()).

- [ ] **Step 5: Verify compilation**

Run: `cargo check -p signapps-seed`

- [ ] **Step 6: Commit**

```bash
git add tools/signapps-seed/ Cargo.toml
git commit -m "feat(seed): scaffold signapps-seed binary with CLI + stub modules"
```

---

## Task 2: Core Seeders (tenants, users, companies, org)

**Files:**
- Modify: `tools/signapps-seed/src/tenants.rs`
- Modify: `tools/signapps-seed/src/users.rs`
- Modify: `tools/signapps-seed/src/companies.rs`
- Modify: `tools/signapps-seed/src/org.rs`

- [ ] **Step 1: Implement tenants.rs**

Full tenant seeder: creates tenant in `identity.tenants`, sets default config.

- [ ] **Step 2: Implement users.rs**

Three functions:
- `seed_minimal(pool, tenant_id)` — 5 users (admin, manager, employee, client_contact, supplier_contact) with fixed UUIDs
- `seed_acme(pool, tenant_id)` — 80 users with realistic French names (accents included), varied roles
- `seed_startup(pool, tenant_id)` — 15 users, flat structure

Each user: INSERT into `identity.users` (username, email, password_hash=argon2 of "password", role, display_name). Return Vec of (user_id, person_id, role) tuples.

Also create corresponding `core.persons` records.

- [ ] **Step 3: Implement companies.rs**

Create companies + person_companies affiliations + login_contexts:
- Acme Corp (internal), TechSupply (supplier), ClientCo (client), PartnerDesign (partner)
- Link persons to companies with roles

- [ ] **Step 4: Implement org.rs**

Create org tree for Acme:
- `core.org_trees` entry
- `workforce_org_nodes`: 5-level hierarchy (company → direction → department → team → position)
- `core.org_closure`: populate closure table for ancestor/descendant queries
- `core.assignments`: assign persons to nodes with roles (holder, member)

- [ ] **Step 5: Verify + commit**

```bash
cargo check -p signapps-seed
git add tools/signapps-seed/src/
git commit -m "feat(seed): implement tenant, user, company, org seeders (Acme 80 users)"
```

---

## Task 3: Domain Seeders (projects, calendar, mail, documents)

**Files:**
- Modify: `tools/signapps-seed/src/projects.rs`
- Modify: `tools/signapps-seed/src/calendar.rs`
- Modify: `tools/signapps-seed/src/mail.rs`
- Modify: `tools/signapps-seed/src/documents.rs`

- [ ] **Step 1: Implement projects.rs**

- 20 projects in `calendar.projects` (varied status, dates, org_node anchoring)
- 500 tasks in `scheduling.time_items` (item_type='task', assignee_id, contributor_ids, varied status/priority)
- `calendar.project_members` linking users to projects with roles

- [ ] **Step 2: Implement calendar.rs**

- 200 events in `scheduling.time_items` (item_type='event')
- Mix of: single events, recurring (daily standup, weekly meeting), all-day (holidays), multi-attendee
- Spread across current month + next month

- [ ] **Step 3: Implement mail.rs**

- Create `mail.accounts` (internal accounts for each Acme user)
- 100 emails in mail tables with threads (in_reply_to chains), labels, read/unread status
- Some with attachments metadata

- [ ] **Step 4: Implement documents.rs**

- 50 documents with titles, content, owners
- Document versions (2-3 versions per doc)
- Comments on documents
- Sharing grants (some shared with teams, some with companies)

- [ ] **Step 5: Verify + commit**

```bash
cargo check -p signapps-seed
git add tools/signapps-seed/src/
git commit -m "feat(seed): implement project, calendar, mail, document seeders"
```

---

## Task 4: Chaos Tenant + Verification

**Files:**
- Modify: `tools/signapps-seed/src/chaos.rs`
- Modify: `tools/signapps-seed/src/verify.rs`

- [ ] **Step 1: Implement chaos.rs**

`seed_chaos(pool, tenant_id)` creates:

**Name chaos users** (20 users with problematic names):
```rust
let chaos_names = vec![
    ("😀🎉", "Test Üsér"),
    ("Robert'); DROP TABLE", "users;--"),
    ("A", "B"),
    (&"X".repeat(255), &"Y".repeat(255)),
    ("<script>alert('xss')", "</script>"),
    ("مريم", "العربية"),
    ("太郎", "山田"),
    ("Пётр", "Иванов"),
    ("Jean\0Pierre", "Null\0Byte"),
    ("   ", "   "),
    ("test@user", "slash/name"),
    ("François", "Müller-Straße"),
    ("", "EmptyFirst"),
    ("Tab\there", "New\nLine"),
    ("UPPER", "lower"),
    ("a]b[c", "d{e}f"),
    ("back\\slash", "pipe|char"),
    ("percent%20encoded", "ampersand&son"),
    ("quote\"double", "quote'single"),
    ("zero-width\u{200B}space", "normal"),
];
```

**Volume chaos**:
- 1 project with 2000 tasks
- 1 user with 1000 calendar events
- 1 org tree 25 levels deep
- 1 org node with 100 children

**Integrity chaos**:
- Task with assignee_id pointing to soft-deleted user
- Insert then soft-delete some referenced entities

**Date chaos**:
- Events with dates: 1970-01-01, 2099-12-31, epoch, far future

- [ ] **Step 2: Implement verify.rs**

```rust
pub async fn run(pool: &PgPool, mode: &str) -> Result<(), Box<dyn std::error::Error>> {
    let mut errors = Vec::new();

    // Row counts
    let check = |table: &str, min: i64| async {
        let count: (i64,) = sqlx::query_as(&format!("SELECT COUNT(*) FROM {}", table))
            .fetch_one(pool).await?;
        if count.0 < min {
            Err(format!("{}: expected >= {}, got {}", table, min, count.0))
        } else {
            Ok(())
        }
    };

    if mode == "full" || mode == "chaos-only" {
        // Verify tenants
        assert_min_count(pool, "identity.tenants", 2, &mut errors).await;
        assert_min_count(pool, "identity.users", 50, &mut errors).await;
        assert_min_count(pool, "core.persons", 50, &mut errors).await;
    }

    if mode == "full" {
        assert_min_count(pool, "core.companies", 3, &mut errors).await;
        assert_min_count(pool, "scheduling.time_items", 500, &mut errors).await;
        assert_min_count(pool, "calendar.projects", 20, &mut errors).await;

        // Referential integrity: no orphaned assignees
        let orphans: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM scheduling.time_items t WHERE t.assignee_id IS NOT NULL AND t.assignee_id NOT IN (SELECT id FROM core.persons)"
        ).fetch_one(pool).await?;
        if orphans.0 > 0 {
            errors.push(format!("Found {} orphaned task assignees", orphans.0));
        }
    }

    if errors.is_empty() {
        tracing::info!("All {} verification checks passed", if mode == "full" { "full" } else { "minimal" });
        Ok(())
    } else {
        for e in &errors {
            tracing::error!("VERIFY FAILED: {}", e);
        }
        Err(format!("{} verification checks failed", errors.len()).into())
    }
}

async fn assert_min_count(pool: &PgPool, table: &str, min: i64, errors: &mut Vec<String>) {
    match sqlx::query_as::<_, (i64,)>(&format!("SELECT COUNT(*) FROM {}", table))
        .fetch_one(pool).await {
        Ok((count,)) if count >= min => {
            tracing::info!("  ✓ {} — {} rows (>= {})", table, count, min);
        }
        Ok((count,)) => {
            errors.push(format!("{}: expected >= {}, got {}", table, min, count));
        }
        Err(e) => {
            errors.push(format!("{}: query failed — {}", table, e));
        }
    }
}
```

- [ ] **Step 3: Test full seed locally**

Run: `cargo run -p signapps-seed -- --mode full --verify`
Expected: Seed completes + verification passes

- [ ] **Step 4: Commit**

```bash
git add tools/signapps-seed/src/chaos.rs tools/signapps-seed/src/verify.rs
git commit -m "feat(seed): add chaos tenant + post-seed verification assertions"
```

---

## Task 5: Pre-Push Hook + CI Workflow + Chaos E2E

**Files:**
- Create: `.husky/pre-push`
- Create: `.github/workflows/seed-and-test.yml`
- Create: `client/e2e/chaos-regression.spec.ts`

- [ ] **Step 1: Create pre-push hook**

Create `.husky/pre-push`:
```bash
#!/bin/sh
echo "🔍 Pre-push: compilation check..."
cargo check --workspace --quiet || { echo "❌ Compilation failed"; exit 1; }

echo "🌱 Pre-push: minimal seed + verify..."
cargo run -p signapps-seed -- --mode minimal --reset --verify 2>/dev/null || { echo "❌ Seed failed"; exit 1; }

echo "✅ Pre-push checks passed."
```

Make it executable: `chmod +x .husky/pre-push`

- [ ] **Step 2: Create CI workflow**

Create `.github/workflows/seed-and-test.yml`:
```yaml
name: Seed & Test

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  seed-and-test:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_USER: signapps
          POSTGRES_PASSWORD: test_password
          POSTGRES_DB: signapps_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 5s
          --health-timeout 5s
          --health-retries 5

    env:
      DATABASE_URL: postgres://signapps:test_password@localhost:5432/signapps_test
      JWT_SECRET: test-secret-key-for-ci-minimum-32chars!
      RUST_LOG: warn

    steps:
      - uses: actions/checkout@v4

      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable

      - name: Cache cargo
        uses: actions/cache@v4
        with:
          path: |
            ~/.cargo/registry
            ~/.cargo/git
            target
          key: cargo-seed-${{ hashFiles('Cargo.lock') }}

      - name: Install sqlx-cli
        run: cargo install sqlx-cli --no-default-features --features postgres

      - name: Apply migrations
        run: sqlx migrate run

      - name: Build workspace
        run: cargo build --workspace

      - name: Seed test database
        run: cargo run -p signapps-seed -- --mode full --verify

      - name: Run Rust tests
        run: cargo test --workspace -- --test-threads=4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Install frontend deps
        working-directory: client
        run: npm ci

      - name: Install Playwright
        working-directory: client
        run: npx playwright install --with-deps chromium

      - name: Start services
        run: |
          bash scripts/start-all.sh --skip-build --skip-frontend &
          sleep 20

      - name: Start frontend
        working-directory: client
        run: |
          PORT=3000 npm run dev &
          sleep 10

      - name: Run E2E tests
        working-directory: client
        run: npx playwright test --reporter=github

      - name: Upload test report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: client/playwright-report/
          retention-days: 7
```

- [ ] **Step 3: Create chaos regression E2E tests**

Create `client/e2e/chaos-regression.spec.ts`:
```typescript
import { test, expect } from "./fixtures";

test.describe("Chaos Tenant Regression", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login?auto=admin", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
  });

  test("pages load without crash on seeded data", async ({ page }) => {
    const routes = ["/docs", "/tasks", "/cal", "/mail", "/storage", "/keep", "/search"];
    for (const route of routes) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2000);
      // Should not show error page
      const errorPage = page.getByText(/erreur critique|500|internal server error/i);
      const hasError = await errorPage.isVisible({ timeout: 1000 }).catch(() => false);
      expect(hasError, `${route} should not crash`).toBe(false);
    }
  });

  test("admin pages load without crash", async ({ page }) => {
    const routes = ["/admin/companies", "/admin/mail-server", "/admin/org-structure", "/admin/persons"];
    for (const route of routes) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2000);
      const errorPage = page.getByText(/erreur critique|500/i);
      const hasError = await errorPage.isVisible({ timeout: 1000 }).catch(() => false);
      expect(hasError, `${route} should not crash`).toBe(false);
    }
  });

  test("my-team page loads without crash", async ({ page }) => {
    await page.goto("/my-team", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const heading = page.getByText(/mon equipe|aucun rapport/i);
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
  });

  test("portal pages load without crash", async ({ page }) => {
    await page.goto("/portal/client", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const content = page.getByText(/portail|client/i);
    await expect(content.first()).toBeVisible({ timeout: 10000 });
  });

  test("status page loads with services", async ({ page }) => {
    await page.goto("/status", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const heading = page.getByText(/status|uptime/i);
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
  });
});
```

- [ ] **Step 4: Commit**

```bash
git add .husky/pre-push .github/workflows/seed-and-test.yml client/e2e/chaos-regression.spec.ts
git commit -m "feat(ci): add pre-push hook + seed-and-test CI workflow + chaos E2E tests"
```

---

## Summary

| Task | Description | Files | Est. |
|------|-------------|-------|------|
| 1 | Scaffold seed binary + CLI + stubs | 14 files | 10 min |
| 2 | Core seeders (tenants, users, companies, org) | 4 files | 20 min |
| 3 | Domain seeders (projects, calendar, mail, docs) | 4 files | 20 min |
| 4 | Chaos tenant + verification | 2 files | 15 min |
| 5 | Pre-push hook + CI workflow + chaos E2E | 3 files | 10 min |
