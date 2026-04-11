# Test Seed Database & Automated Pipeline — Design Spec

## Summary

Create a comprehensive test database seeding system (`signapps-seed` Rust binary) that generates realistic + stress-test data across all 34 services, integrated into a two-level automated pipeline: pre-push smoke tests locally and full E2E + regression in CI.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Data realism | **Multi-tenant stress test** — 3 tenants, 200 users, 5000+ records, chaos tenant | Maximum bug coverage including edge cases |
| Seed engine | **Rust binary** — compiles against same models as services | Schema changes break the seed at compile time |
| Edge cases | **Mixed + dedicated chaos tenant** — realistic data with accents + chaos tenant for extremes | Catches daily bugs + rare critical bugs |
| Pipeline | **Two levels** — pre-push smoke (30s) + CI full (5min) | Fast local feedback + thorough CI gate |

## Seed Binary: `tools/signapps-seed`

### Workspace member

```toml
# tools/signapps-seed/Cargo.toml
[package]
name = "signapps-seed"
version.workspace = true
edition = "2021"

[dependencies]
signapps-db = { path = "../../crates/signapps-db" }
signapps-common = { path = "../../crates/signapps-common" }
sqlx = { workspace = true }
tokio = { workspace = true }
uuid = { workspace = true }
chrono = { workspace = true }
serde_json = { workspace = true }
clap = { version = "4", features = ["derive"] }
fake = { version = "3", features = ["chrono", "uuid"] }
rand = "0.8"
tracing = { workspace = true }
tracing-subscriber = { workspace = true }
```

### CLI interface

```
signapps-seed [OPTIONS]

OPTIONS:
  --mode <MODE>       Seed mode: minimal | full | chaos-only [default: full]
  --reset             DROP and recreate all schemas before seeding
  --verify            Run post-seed integrity assertions
  --database-url <URL> PostgreSQL connection [env: DATABASE_URL]
```

### Seed modules

```
tools/signapps-seed/src/
  main.rs              — CLI parsing, database connection, orchestration
  tenants.rs           — Create tenants + initial config
  users.rs             — Users with varied roles + LDAP/local auth
  companies.rs         — Companies (internal, client, supplier) + affiliations
  org.rs               — Org tree (20-level deep for chaos), nodes, assignments
  persons.rs           — Persons with cross-company affiliations + login contexts
  projects.rs          — Projects with members, tasks, milestones, sprints
  calendar.rs          — Events (recurring, multi-attendee, all-day, multi-tz)
  mail.rs              — Accounts, emails, threads, attachments, labels
  documents.rs         — Docs, versions, comments, shares
  drive.rs             — Folders, files, quotas, shares
  chat.rs              — Channels, messages, threads, reactions
  helpdesk.rs          — Tickets (open, closed, escalated, SLA breach)
  billing.rs           — Invoices (paid, pending, overdue), subscriptions
  forms.rs             — Forms with questions, logic, responses
  gamification.rs      — XP, badges, streaks, leaderboard data
  workforce.rs         — Timesheets, expenses, leave requests, attendance
  ad.rs                — AD domains, OUs, user accounts, GPO, DNS, DHCP
  notifications.rs     — Notification items across all types
  sharing.rs           — Sharing grants (user, group, company, org_node)
  search.rs            — Search history, saved searches
  chaos.rs             — Chaos tenant: extreme data, edge cases, stress
  verify.rs            — Post-seed integrity assertions
```

## Tenant 1: "Acme Corp" (realistic enterprise, 80 users)

### Organization

```
Acme Corp (company_type: internal)
├── Direction Generale
│   └── CEO: Pierre Durand (role: 3, admin)
├── Direction Technique
│   ├── Directeur: Marie-Claire Béranger
│   ├── Equipe Backend
│   │   ├── Manager: François Müller
│   │   ├── Dev: Héloïse O'Brien
│   │   ├── Dev: José García-López
│   │   └── Dev: Amélie Château-Renard
│   ├── Equipe Frontend
│   │   ├── Manager: Jean-Baptiste Lefèvre
│   │   └── 5 devs
│   └── Equipe DevOps (3 people)
├── Direction Commerciale
│   ├── Directeur: Nathalie Straße
│   ├── Equipe Ventes (8 people)
│   └── Equipe Marketing (5 people)
├── Direction RH
│   ├── Directrice: Ève Saint-André
│   └── Equipe RH (4 people)
├── Direction Finance
│   ├── Directeur: André Noël
│   └── Equipe Compta (4 people)
└── Support Client
    ├── Manager: Rachid Ben-Saïd
    └── 10 agents
```

### Linked companies

- **TechSupply SARL** (supplier): 5 contact persons, portal_access=true
- **ClientCo SAS** (client): 3 contact persons, portal_access=true
- **PartnerDesign** (partner): 2 contact persons

### Cross-module data

- 20 projects (Backend Refonte, Site Web v3, App Mobile, Migration Cloud, ...)
- 500 tasks across projects with assignees + contributors
- 200 calendar events (meetings, sprints, deadlines, recurring standups)
- 100 emails with threads (internal + portal messages)
- 50 documents with versions and comments
- 30 helpdesk tickets (with SLA tracking)
- 20 invoices (TechSupply → Acme, Acme → ClientCo)
- 10 forms with 200 responses
- Timesheets for current + last month
- Leave requests (approved, pending, rejected)
- Expense reports (draft, submitted, approved)
- Gamification: XP events, 15 badges unlocked, streaks
- AD: domain acme.local, OUs mirroring org, user accounts synced

### Names with realistic edge cases

All names use real French patterns with accents:
- François, Héloïse, José, Amélie, Ève, André, Noël, Rachid
- Compound names: Jean-Baptiste, Marie-Claire, Château-Renard
- Apostrophes: O'Brien, D'Angelo
- Special chars: Müller (umlaut), Straße (eszett), García (accent)
- Arabic: Ben-Saïd, El Amrani

## Tenant 2: "StartupXYZ" (flat structure, 15 users)

- 1 founder (admin), 14 employees (no managers)
- 3 projects, 50 tasks
- Flat org: 1 level, no hierarchy
- Tests: what happens when there are no managers, no N-1, no org_closure depth

## Tenant 3: "Chaos Industries" (stress test, 100+ users)

### Name chaos

```
"😀🎉 Test Üsér"                    — emojis in name
"Robert'); DROP TABLE users;--"      — SQL injection attempt
"A"                                  — single character name
"AAAA...500 chars...AAAA"            — max length name
""                                   — empty string (if allowed)
"Jean\x00Pierre"                     — null byte injection
"   "                                — whitespace only
"<script>alert('xss')</script>"      — XSS attempt
"مريم"                               — Arabic
"太郎"                                — Japanese
"Пётр"                               — Cyrillic
"test@user"                          — @ in name
"user/with/slashes"                  — path traversal attempt
```

### Email chaos

```
"test+tag@sub.domain.co.uk"
"very.long.email.address.that.exceeds@normal.expectations.example.com"
"user@localhost"
"user@192.168.1.1"
"UPPERCASE@EXAMPLE.COM"
```

### Date chaos

```
1970-01-01T00:00:00Z          — Unix epoch
2099-12-31T23:59:59Z          — far future
NULL                           — missing date
2026-02-29T12:00:00Z          — invalid date (2026 is not leap year)
2000-01-01T00:00:00+14:00     — extreme timezone offset
```

### Volume chaos

```
1 project with 2000 tasks                — pagination stress
1 user with 1000 calendar events          — rendering stress
1 email with 100 recipients               — expansion stress
1 document with 500 versions              — history stress
1 org node with 100 direct children       — tree rendering stress
1 org tree with 25 levels deep            — closure table stress
1 sharing grant with 200 grantees         — permission resolution stress
```

### Integrity chaos

```
Task assigned to deleted user (soft-deleted)
Project in a moved org node
Email referencing non-existent attachment
Circular org reference attempt (blocked by constraint)
Duplicate unique key attempts (caught by ON CONFLICT)
Foreign key to wrong tenant (cross-tenant leak test)
```

## Post-Seed Verification (`--verify`)

The seed binary runs assertions after inserting:

```rust
async fn verify(pool: &PgPool) -> Result<()> {
    // 1. Row counts
    assert_count(pool, "identity.users", 200, ">=").await?;
    assert_count(pool, "core.persons", 200, ">=").await?;
    assert_count(pool, "core.companies", 6, ">=").await?;
    assert_count(pool, "scheduling.time_items", 2500, ">=").await?;
    assert_count(pool, "calendar.projects", 23, ">=").await?;

    // 2. Referential integrity
    assert_no_orphans(pool, "scheduling.time_items", "assignee_id", "core.persons", "id").await?;
    assert_no_orphans(pool, "calendar.project_members", "person_id", "core.persons", "id").await?;
    assert_no_orphans(pool, "core.person_companies", "company_id", "core.companies", "id").await?;

    // 3. Tenant isolation
    assert_no_cross_tenant(pool, "scheduling.time_items", "calendar.projects").await?;

    // 4. Uniqueness
    assert_unique(pool, "identity.users", "username").await?;
    assert_unique(pool, "identity.users", "email").await?;

    // 5. Chaos tenant exists
    assert_count(pool, "identity.tenants", 3, ">=").await?;

    Ok(())
}
```

## Pre-Push Hook (~30 seconds)

### Hook: `.husky/pre-push`

```bash
#!/bin/sh
echo "Running pre-push checks..."

# 1. Cargo check (compilation only, no tests)
cargo check --workspace --quiet || exit 1

# 2. Quick seed + smoke
DATABASE_URL="postgres://signapps:password@localhost:5432/signapps_test" \
  cargo run -p signapps-seed -- --mode minimal --reset --verify || exit 1

# 3. Critical smoke tests (10 key tests)
cd client && npx playwright test --grep "@critical" --reporter=dot || exit 1

echo "Pre-push checks passed."
```

### Critical test tag

E2E specs tagged `@critical` run in pre-push:
```typescript
test("login works @critical", async ({ page }) => { ... });
test("create document @critical", async ({ page }) => { ... });
test("task CRUD @critical", async ({ page }) => { ... });
// ~10 tests covering core flows
```

## CI Pipeline (GitHub Actions, ~5 minutes)

### Workflow: `.github/workflows/seed-and-test.yml`

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
      JWT_SECRET: test-secret-key-for-ci-only-32chars

    steps:
      - uses: actions/checkout@v4

      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable

      - name: Cache cargo
        uses: actions/cache@v4
        with:
          path: |
            ~/.cargo/registry
            target
          key: cargo-${{ hashFiles('Cargo.lock') }}

      - name: Apply migrations
        run: cargo install sqlx-cli --no-default-features --features postgres && sqlx migrate run

      - name: Build workspace
        run: cargo build --workspace

      - name: Seed test database (full + chaos)
        run: cargo run -p signapps-seed -- --mode full --verify

      - name: Run Rust tests
        run: cargo test --workspace

      - name: Start all services
        run: bash scripts/start-all.sh --skip-build &
        env:
          RUST_LOG: warn

      - name: Wait for services
        run: sleep 15

      - name: Install Playwright
        working-directory: client
        run: npm ci && npx playwright install --with-deps chromium

      - name: Run E2E tests
        working-directory: client
        run: npx playwright test --reporter=github

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: client/playwright-report/
```

### Failure conditions

The CI job fails (blocking merge) if:
1. Workspace doesn't compile
2. Seed binary doesn't compile (schema mismatch)
3. Seed fails to insert (constraint violations)
4. Post-seed verification assertions fail
5. Rust unit/integration tests fail
6. E2E Playwright tests fail

## Chaos-Specific Regression Tests

New E2E spec: `client/e2e/chaos-regression.spec.ts`

Tests that run against the chaos tenant data:

```typescript
test.describe("Chaos tenant regression", () => {
  // Auth as chaos tenant admin

  test("unicode names render without crash", ...);
  test("SQL injection in name is harmless", ...);
  test("XSS in name is escaped", ...);
  test("empty fields don't crash list views", ...);
  test("2000-task project loads within 5 seconds", ...);
  test("25-level org tree renders without stack overflow", ...);
  test("orphaned references return 404 not 500", ...);
  test("max-length fields don't break layout", ...);
  test("special email addresses display correctly", ...);
  test("far-future dates display correctly", ...);
});
```

## E2E Assertions

- Seed binary compiles with 0 errors
- `--mode minimal` completes in <10 seconds
- `--mode full` completes in <2 minutes
- `--verify` passes all integrity checks
- All 94+ existing E2E specs pass with seeded data
- Chaos regression tests pass (unicode, injection, volumes)
- Pre-push hook runs in <30 seconds
- CI pipeline completes in <5 minutes
- Schema change without seed update breaks compilation
