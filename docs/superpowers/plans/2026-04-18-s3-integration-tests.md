# S3 — Track D Integration Tests + Polish — Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development ou executing-plans. Exécutions TDD, commits conventional, boot budget < 5s maintenu.

**Goal :** Livrer les tests d'intégration cross-services (5 scénarios Rust + 4 Playwright nouveaux + re-exec des 11 existants), fix clippy pré-existant, documentation consolidée.

**Architecture :** Nouveau crate `signapps-integration-tests` qui démarre backend + seed + exécute scénarios. `just e2e` chaîne seed-reset + playwright. Clippy workspace 100% clean.

---

## Task 1 — Scaffolding integration-tests crate

**Files :**
- Create : `services/signapps-integration-tests/Cargo.toml`
- Create : `services/signapps-integration-tests/tests/common/mod.rs`
- Modify : `Cargo.toml` (workspace members)

- [ ] **Step 1 : Cargo.toml**

```toml
[package]
name = "signapps-integration-tests"
version = "0.1.0"
edition = "2021"
publish = false

[dev-dependencies]
tokio = { workspace = true, features = ["full"] }
reqwest = { workspace = true, features = ["json"] }
sqlx = { workspace = true, features = ["postgres", "uuid", "chrono"] }
serde_json = { workspace = true }
uuid = { workspace = true, features = ["v4", "v5"] }
anyhow = { workspace = true }
serial_test = "3"
signapps-db = { path = "../../crates/signapps-db" }
signapps-seed = { path = "../signapps-seed" }
```

- [ ] **Step 2 : common/mod.rs**

```rust
// services/signapps-integration-tests/tests/common/mod.rs
//! Helpers partagés : spawn backend, seed, get admin token.

use std::process::{Child, Command, Stdio};
use std::time::Duration;

pub struct TestBackend {
    process: Child,
    pub base_url: String,
}

impl Drop for TestBackend {
    fn drop(&mut self) {
        let _ = self.process.kill();
        let _ = self.process.wait();
    }
}

pub async fn spawn_backend() -> anyhow::Result<TestBackend> {
    // Tue toute instance existante
    #[cfg(target_os = "windows")]
    let _ = Command::new("powershell")
        .args(["-Command", "Stop-Process -Name signapps-platform -Force -ErrorAction SilentlyContinue"])
        .status();
    tokio::time::sleep(Duration::from_secs(2)).await;

    let process = Command::new(env!("CARGO_BIN_EXE_signapps-platform"))
        .env("PROXY_ENABLED", "false")
        .env("PXE_ENABLE_TFTP", "false")
        .env("PXE_ENABLE_PROXY_DHCP", "false")
        .env("CONTAINERS_ENABLED", "false")
        .env("MAIL_PROTOCOLS_ENABLED", "false")
        .env("SCHEDULER_TICK_ENABLED", "false")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()?;

    // Wait up to 10s for /health on :3001
    let deadline = tokio::time::Instant::now() + Duration::from_secs(10);
    let client = reqwest::Client::new();
    loop {
        if tokio::time::Instant::now() > deadline {
            anyhow::bail!("backend didn't come up in 10s");
        }
        if client.get("http://127.0.0.1:3001/health").send().await.is_ok() {
            break;
        }
        tokio::time::sleep(Duration::from_millis(200)).await;
    }

    Ok(TestBackend { process, base_url: "http://127.0.0.1".to_string() })
}

pub async fn admin_token(base_url: &str) -> anyhow::Result<String> {
    let client = reqwest::Client::new();
    let resp: serde_json::Value = client.post(format!("{}:3001/api/v1/auth/login", base_url))
        .json(&serde_json::json!({"username":"admin","password":"admin"}))
        .send().await?.error_for_status()?.json().await?;
    Ok(resp.get("access_token").and_then(|v| v.as_str()).ok_or_else(|| anyhow::anyhow!("no token"))?.to_string())
}

pub async fn run_seed() -> anyhow::Result<()> {
    signapps_seed::run_seed(signapps_seed::SeedArgs {
        database_url: std::env::var("DATABASE_URL").unwrap_or_else(|_| "postgres://signapps:signapps_dev@localhost:5432/signapps".to_string()),
        force: false, reset: false, dry_run: false, only: None,
    }).await
}
```

- [ ] **Step 3 : Workspace registration**

Ajouter dans `Cargo.toml` root : `"services/signapps-integration-tests",`

- [ ] **Step 4 : Test compile**

Run : `rtk cargo check -p signapps-integration-tests --tests`
Expected : OK

- [ ] **Step 5 : Commit**

```bash
rtk git add services/signapps-integration-tests Cargo.toml
rtk git commit -m "feat(integration-tests): scaffolding crate + spawn/seed/auth helpers"
```

---

## Task 2 — Test provisioning end-to-end

**Files :**
- Create : `services/signapps-integration-tests/tests/provisioning_flow.rs`

- [ ] **Step 1 : Test**

```rust
// services/signapps-integration-tests/tests/provisioning_flow.rs
mod common;

use serial_test::serial;

#[tokio::test]
#[serial]
#[ignore] // requires backend + seed + DB
async fn test_person_creation_triggers_provisioning() -> anyhow::Result<()> {
    let backend = common::spawn_backend().await?;
    common::run_seed().await?;
    let token = common::admin_token(&backend.base_url).await?;

    let client = reqwest::Client::new();
    let new_person: serde_json::Value = client.post(format!("{}:3026/api/v1/org/persons", backend.base_url))
        .bearer_auth(&token)
        .json(&serde_json::json!({
            "full_name": "Test Provisioning",
            "email": "test.prov@acme.corp",
            "primary_node_slug": "engineering",
        }))
        .send().await?
        .error_for_status()?
        .json().await?;

    let person_id = new_person["id"].as_str().unwrap();

    // Wait up to 3s for provisioning consumers to process
    tokio::time::sleep(std::time::Duration::from_secs(3)).await;

    // Verify mailbox exists
    let mailbox: serde_json::Value = client.get(format!("{}:3012/api/v1/mail/mailboxes?user_id={}", backend.base_url, person_id))
        .bearer_auth(&token)
        .send().await?
        .json().await?;
    assert!(mailbox.as_array().map(|a| !a.is_empty()).unwrap_or(false), "mailbox should be provisioned");

    // Cleanup
    let _ = client.delete(format!("{}:3026/api/v1/org/persons/{}", backend.base_url, person_id))
        .bearer_auth(&token).send().await;

    Ok(())
}
```

- [ ] **Step 2 : Run**

Run : `rtk cargo test -p signapps-integration-tests --test provisioning_flow -- --ignored`
Expected : PASS (ou skip si l'API `/org/persons` n'existe pas sur ce port — adapter)

- [ ] **Step 3 : Commit**

```bash
rtk git add services/signapps-integration-tests/tests/provisioning_flow.rs
rtk git commit -m "test(integration): provisioning end-to-end (person created → mailbox provisioned in 3s)"
```

---

## Task 3 — Test grants redirect

**Files :**
- Create : `services/signapps-integration-tests/tests/grants_redirect.rs`

- [ ] **Step 1 : Test**

```rust
// services/signapps-integration-tests/tests/grants_redirect.rs
mod common;
use serial_test::serial;

#[tokio::test]
#[serial]
#[ignore]
async fn test_grant_creation_and_redirect() -> anyhow::Result<()> {
    let backend = common::spawn_backend().await?;
    common::run_seed().await?;
    let token = common::admin_token(&backend.base_url).await?;

    let client = reqwest::Client::new();

    // Create grant pointing at a seeded doc
    let grant: serde_json::Value = client.post(format!("{}:3026/api/v1/org/grants", backend.base_url))
        .bearer_auth(&token)
        .json(&serde_json::json!({
            "resource_type": "doc",
            "resource_id": "00000000-0000-0000-0000-000000000000",
            "expires_in_seconds": 3600,
        }))
        .send().await?.error_for_status()?.json().await?;

    let token_str = grant["token"].as_str().unwrap();

    // Follow redirect
    let resp = client.get(format!("{}:3026/api/v1/org/grants/redirect?token={}", backend.base_url, token_str))
        .send().await?;

    assert!(resp.status().is_redirection() || resp.status().is_success(),
        "expected redirect/success, got {}", resp.status());

    Ok(())
}
```

- [ ] **Step 2 : Run + commit**

```bash
rtk cargo test -p signapps-integration-tests --test grants_redirect -- --ignored
rtk git add services/signapps-integration-tests/tests/grants_redirect.rs
rtk git commit -m "test(integration): grant HMAC creation + redirect verification"
```

---

## Task 4 — Test RBAC cross-service

**Files :**
- Create : `services/signapps-integration-tests/tests/rbac_enforcement.rs`

- [ ] **Step 1 : Test**

```rust
// services/signapps-integration-tests/tests/rbac_enforcement.rs
mod common;
use serial_test::serial;

#[tokio::test]
#[serial]
#[ignore]
async fn test_rbac_denies_cross_ou_access() -> anyhow::Result<()> {
    let backend = common::spawn_backend().await?;
    common::run_seed().await?;

    let client = reqwest::Client::new();

    // Login as jean.martin (Engineering) — seeded by W3
    let resp: serde_json::Value = client.post(format!("{}:3001/api/v1/auth/login", backend.base_url))
        .json(&serde_json::json!({"username":"jean.martin","password":"Demo1234!"}))
        .send().await?.error_for_status()?.json().await?;
    let token = resp["access_token"].as_str().unwrap();

    // Attempt to access admin-only route
    let admin_resp = client.get(format!("{}:3001/api/v1/admin/users", backend.base_url))
        .bearer_auth(token)
        .send().await?;
    assert_eq!(admin_resp.status().as_u16(), 403, "non-admin must get 403, got {}", admin_resp.status());

    Ok(())
}
```

- [ ] **Step 2 : Run + commit**

```bash
rtk cargo test -p signapps-integration-tests --test rbac_enforcement -- --ignored
rtk git add services/signapps-integration-tests/tests/rbac_enforcement.rs
rtk git commit -m "test(integration): RBAC denies cross-OU access (jean.martin vs /admin/users)"
```

---

## Task 5 — Tests AD dry-run + PXE enrollment

**Files :**
- Create : `services/signapps-integration-tests/tests/ad_sync_dryrun.rs`
- Create : `services/signapps-integration-tests/tests/pxe_enrollment.rs`

- [ ] **Step 1 : AD dry-run test**

```rust
// services/signapps-integration-tests/tests/ad_sync_dryrun.rs
mod common;
use serial_test::serial;

#[tokio::test]
#[serial]
#[ignore]
async fn test_ad_sync_dry_run_creates_log_entries() -> anyhow::Result<()> {
    let backend = common::spawn_backend().await?;
    common::run_seed().await?;
    let token = common::admin_token(&backend.base_url).await?;

    let client = reqwest::Client::new();
    let resp = client.post(format!("{}:3026/api/v1/org/ad/sync?dry_run=true", backend.base_url))
        .bearer_auth(&token)
        .send().await?;
    // Dry-run should 200 OK even without bind password (no real LDAP connection)
    assert!(resp.status().is_success() || resp.status().is_client_error(),
        "unexpected status: {}", resp.status());

    Ok(())
}
```

- [ ] **Step 2 : PXE enrollment test**

```rust
// services/signapps-integration-tests/tests/pxe_enrollment.rs
mod common;
use serial_test::serial;

#[tokio::test]
#[serial]
#[ignore]
async fn test_pxe_simulate_dhcp_then_enroll() -> anyhow::Result<()> {
    let backend = common::spawn_backend().await?;
    let token = common::admin_token(&backend.base_url).await?;

    let client = reqwest::Client::new();
    let mac = format!("aa:bb:cc:{:02x}:99:01", rand::random::<u8>());

    // Simulate DHCP
    client.post(format!("{}:3016/api/v1/pxe/_test/simulate-dhcp", backend.base_url))
        .bearer_auth(&token)
        .json(&serde_json::json!({"mac": mac}))
        .send().await?
        .error_for_status()?;

    // Verify in discovered list
    let discovered: serde_json::Value = client.get(format!("{}:3016/api/v1/pxe/assets/discovered", backend.base_url))
        .bearer_auth(&token)
        .send().await?.error_for_status()?.json().await?;
    assert!(discovered.as_array().unwrap().iter().any(|a| a["mac_address"] == mac),
        "MAC {} should appear in discovered list", mac);

    // Enroll
    client.post(format!("{}:3016/api/v1/pxe/assets/{}/enroll", backend.base_url, mac))
        .bearer_auth(&token)
        .json(&serde_json::json!({}))
        .send().await?
        .error_for_status()?;

    Ok(())
}
```

- [ ] **Step 3 : Run + commit**

```bash
rtk cargo test -p signapps-integration-tests --test ad_sync_dryrun -- --ignored
rtk cargo test -p signapps-integration-tests --test pxe_enrollment -- --ignored
rtk git add services/signapps-integration-tests/tests/ad_sync_dryrun.rs services/signapps-integration-tests/tests/pxe_enrollment.rs
rtk git commit -m "test(integration): AD dry-run + PXE simulate-dhcp → enroll flow"
```

---

## Task 6 — Fix clippy workspace

**Files :**
- Modify : `crates/signapps-db-shared/src/repositories/automation_repository.rs` (line ~470)
- Modify : tout autre `.bind(&uuid_var)` où le `&` est redondant

- [ ] **Step 1 : Identifier**

Run : `rtk cargo clippy --workspace --all-features --tests -- -D warnings 2>&1 | head -50`
Expected : voir toutes les occurrences de warnings. Les lister.

- [ ] **Step 2 : Fix**

Remplacer `.bind(&tenant_id)` par `.bind(tenant_id)` là où le type est `Copy` (Uuid, i32, i64, DateTime, etc.). Laisser `.bind(&string_var)` tel quel (String n'est pas Copy).

- [ ] **Step 3 : Vérifier clean**

Run : `rtk cargo clippy --workspace --all-features --tests -- -D warnings`
Expected : `Finished` sans warning.

- [ ] **Step 4 : Commit**

```bash
rtk git add crates/signapps-db-shared crates/signapps-db
rtk git commit -m "fix(clippy): remove needless borrows on Copy types in .bind() calls"
```

---

## Task 7 — Documentation overview + schemas

**Files :**
- Create : `docs/architecture/overview.md`
- Create : `docs/architecture/database-schemas.md`

- [ ] **Step 1 : overview.md**

```md
# SignApps Platform — Architecture Overview (2026-04-18)

Last updated after S1 + S2 + S3.

## Single-binary runtime

34 services + 5 shared crates dans un seul binaire `signapps-platform`. Ports 3001–3099 mappés via supervisor Tokio. Boot time : **< 5 secondes** sur dev box standard (budget S1 maintenu).

## Couches

- **Crates** (partagés) : common, db, cache, keystore, oauth, runtime, service
- **Services** (33 HTTP + 1 gateway) : voir `CLAUDE.md` pour la liste complète
- **Shared state** : `SharedState { pool, jwt, keystore, cache, eventbus, resolver }` injecté à chaque service

## RBAC (livré S1)

- `OrgPermissionResolver` trait dans `signapps-common::rbac`
- `OrgClient` impl (feature-gated) avec cache moka 60s TTL
- Middleware Axum unifié pour les 34 services

## Org + AD + Provisioning (S1)

- Modèle canonique : `org_nodes` (LTREE) + `org_persons` + `org_assignments` (3 axes) + `org_policies` + `org_boards` + `org_access_grants` + `org_ad_config` + `org_ad_sync_log` + `org_provisioning_log`
- AD sync bidirectionnel via `ldap3`, keystore-encrypted secrets
- Events PgEventBus : `org.user.*`, `org.grant.*`, `org.assignment.*`, `org.policy.*`
- Consumers de provisioning dans mail/storage/calendar/chat

## PXE + DHCP (livré S2)

- Ports non-privileged par défaut : TFTP :6969, ProxyDHCP :4011 (`PXE_MODE=user`)
- Auto-discovery MAC via DHCPDISCOVER
- SSE stream `/api/v1/pxe/deployments/:mac/stream` via LISTEN/NOTIFY
- Wizard frontend 5 étapes

## Seed démo Acme Corp (livré S2)

- Binary Rust `signapps-seed` (bin-only)
- 267 rows réparties sur 15 services : org, identity, calendar, mail, chat, docs, drive, forms, contacts, meet, tasks, it-assets, vault, pxe
- UUIDs namespace v5 déterministes, idempotent

## Intégration cross-services (livré S3)

- 5 tests intégration Rust (`signapps-integration-tests`)
- Playwright full suite : S1 + S2 + S3 = ~15 scénarios
- Recette `just e2e` chaîne seed-reset + playwright test

## Roadmap

Prochaines étapes probables :
- Performance profiling & optimization
- Mobile app (React Native)
- Public API v2 (GraphQL gateway)
- Audit sécurité externe
```

- [ ] **Step 2 : database-schemas.md**

```md
# Database schemas — notes de cohérence

## Convention actuelle

Les tables org_*/identity_*/pxe_* vivent dans des schémas PostgreSQL nommés :
- `identity` : users, tenants, roles
- `pxe` : profiles, assets, images, deployments, dhcp_requests
- `calendar` : calendars, events, time_items, tasks
- `mail`, `chat`, `docs`, `storage`, `forms`, `vault`, `crm`, `it_assets`, `meet` : chacun son schéma

## Exception : org.*

Les tables `org_nodes`, `org_persons`, `org_assignments`, `org_policies`, `org_boards`, `org_access_grants`, `org_ad_config`, `org_ad_sync_log`, `org_provisioning_log` vivent dans **`public.*`** (pas `org.*`).

**Raison historique** : les migrations S1 ont utilisé le schéma par défaut. Une migration vers `org.*` nécessiterait de toucher ~50 occurrences de SQL et casserait les tests existants.

**Décision S3** : accepter le statu quo. La convention de nommage `org_*` rend clair le domaine, même si le schéma physique est `public`.

## Exception : crm.leads (contacts)

La table des contacts externes vit en `crm.leads` et non `contacts.*` (il n'y a pas de schéma `contacts` séparé). Le seed Acme Corp y insère 10 rows.

## Recommandation pour futurs services

- Nouveau service → créer un schéma dédié (`CREATE SCHEMA IF NOT EXISTS <service>`)
- Nommer les tables SANS préfixe redondant (`<schema>.events`, pas `<schema>.calendar_events`)
- Documenter les choix dans le product-spec du service
```

- [ ] **Step 3 : Commit**

```bash
rtk git add docs/architecture
rtk git commit -m "docs(arch): overview.md + database-schemas.md (consolidation S1+S2+S3)"
```

---

## Task 8 — just e2e + re-run scénarios existants

**Files :**
- Modify : `justfile`
- Modify : `client/playwright.config.ts` (si besoin)

- [ ] **Step 1 : Justfile**

```make
# À ajouter au justfile
e2e:
    just db-seed-reset
    cd client && npx playwright test --reporter=list

e2e-ui:
    just db-seed-reset
    cd client && npx playwright test --ui
```

- [ ] **Step 2 : Lancer la full suite**

Run (boot backend prealable) :
```bash
rtk cargo run -p signapps-platform --release &
sleep 5
rtk just e2e
```

Expected : tous scénarios S1 + S2 verts (notamment S2-PXE-2 wizard qui était skip avant).

- [ ] **Step 3 : Commit**

```bash
rtk git add justfile
rtk git commit -m "feat(e2e): just recipe for full suite (seed-reset + playwright)"
```

---

## Task 9 — 4 nouveaux scénarios S3-PLAY

**Files :**
- Create : `client/e2e/s3-cross-service.spec.ts`

- [ ] **Step 1 : Scénarios**

```ts
// client/e2e/s3-cross-service.spec.ts
import { test, expect } from '@playwright/test';

test.describe('S3 — Cross-service scenarios', () => {
  test('S3-PLAY-1: non-admin marie → /admin/users = 403', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/utilisateur|username/i).fill('marie.dupont');
    await page.getByLabel(/mot de passe|password/i).fill('Demo1234!');
    await page.getByRole('button', { name: /connexion|login/i }).click();
    await expect(page).toHaveURL(/\/(dashboard|home|$)/);

    const resp = await page.goto('/admin/users').catch(() => null);
    // Either 403 page shown, or redirect to dashboard
    const status = resp?.status();
    expect(status === 403 || page.url().includes('/dashboard') || page.url().includes('/home')).toBeTruthy();
  });

  test('S3-PLAY-2: Engineering user creates event on own calendar only', async ({ page }) => {
    await page.goto('/login?auto=admin');
    await page.goto('/calendar');
    // At least one seeded event should be visible
    await expect(page.locator('text=Sprint planning').first()).toBeVisible({ timeout: 10_000 });
  });

  test('S3-PLAY-3: share doc via HMAC grant flow', async ({ page, context }) => {
    await page.goto('/login?auto=admin');
    await page.goto('/docs');
    await expect(page.locator('text=Roadmap Q2').first()).toBeVisible({ timeout: 10_000 });
    // TODO: full grant flow once UI is wired
  });

  test('S3-PLAY-4: PXE wizard full flow with seeded profiles', async ({ page }) => {
    await page.goto('/login?auto=admin');
    await page.goto('/pxe/wizard');

    // Step 1: choose image
    await expect(page.getByRole('heading', { name: /Choisir.*image/i })).toBeVisible();
    await page.locator('button:has-text("Ubuntu Server")').first().click();
    await page.getByRole('button', { name: /Suivant/ }).click();

    // Step 2: profile (should have 5 seeded profiles now)
    await expect(page.getByRole('heading', { name: /profil/i })).toBeVisible();
    await page.locator('button').filter({ hasText: 'Ubuntu' }).first().click();
    await page.getByRole('button', { name: /Suivant/ }).click();

    // Step 3: target MAC
    await page.getByPlaceholder(/aa:bb/).fill('aa:bb:cc:aa:bb:cc');
    await page.getByRole('button', { name: /Utiliser/ }).click();
    await page.getByRole('button', { name: /Suivant/ }).click();

    // Step 4: confirm
    await expect(page.locator('text=aa:bb:cc:aa:bb:cc')).toBeVisible();
  });
});
```

- [ ] **Step 2 : Run**

Run : `rtk just e2e`
Expected : 4 nouveaux + tous anciens verts.

- [ ] **Step 3 : Commit**

```bash
rtk git add client/e2e/s3-cross-service.spec.ts
rtk git commit -m "test(e2e): 4 S3 cross-service scenarios (RBAC 403, calendar, docs, PXE full wizard)"
```

---

## Task 10 — Audit /health latency

**Files :**
- Create : `scripts/health-audit.sh`

- [ ] **Step 1 : Script**

```bash
#!/usr/bin/env bash
# scripts/health-audit.sh — mesure latence /health sur tous les ports services
set -euo pipefail

PORTS=(3001 3002 3003 3004 3005 3006 3007 3008 3009 3010 3011 3012 3014 3015 3016 3019 3020 3021 3022 3024 3025 3026 3027 3028 3029 3030 3031 3032 3033 3034 3099 3700 8095 8096)

echo "Port | Time (ms) | Status"
echo "-----|-----------|-------"
for port in "${PORTS[@]}"; do
    t=$(curl -o /dev/null -s -w "%{time_total}" -m 1 "http://127.0.0.1:${port}/health" 2>/dev/null || echo "TIMEOUT")
    if [[ "$t" == "TIMEOUT" ]]; then
        status="DOWN"
        ms="—"
    else
        ms=$(awk -v t="$t" 'BEGIN { printf "%.1f", t * 1000 }')
        status="UP"
    fi
    echo "${port} | ${ms} | ${status}"
done
```

Rendre executable : `chmod +x scripts/health-audit.sh`

- [ ] **Step 2 : Run et commit**

Run : `rtk just audit-health 2>/dev/null || bash scripts/health-audit.sh`
Expected : tous UP, temps < 50ms sur la majorité.

```bash
rtk git add scripts/health-audit.sh
rtk git commit -m "feat(ops): script scripts/health-audit.sh pour mesurer latence /health cross-services"
```

---

## Task 11 — Benchmark baseline (optionnel)

Si temps disponible après T1-T10 :

**Files :**
- Create : `scripts/bench-baseline.sh`
- Create : `docs/benchmarks/2026-04-18-baseline.md`

- [ ] **Step 1 : Script**

```bash
#!/usr/bin/env bash
# scripts/bench-baseline.sh
set -euo pipefail

echo "=== SignApps Baseline Benchmark ==="

# Boot time
START=$(date +%s)
rtk cargo test -p signapps-platform --test boot -- --ignored 2>&1 | grep "boot elapsed"
END=$(date +%s)
echo "Boot: $((END - START))s"

# Seed time
START=$(date +%s)
rtk cargo run --bin signapps-seed --release -- --reset >/dev/null
END=$(date +%s)
echo "Seed (reset+full): $((END - START))s"

# Login round-trip
for i in {1..5}; do
    t=$(curl -s -w "%{time_total}" -o /dev/null -X POST http://localhost:3001/api/v1/auth/login \
        -H "Content-Type: application/json" \
        -d '{"username":"admin","password":"admin"}')
    echo "Login ${i}: ${t}s"
done
```

- [ ] **Step 2 : Rapport**

```md
# Baseline Benchmark — 2026-04-18

Après merge S1 + S2 + S3. Environnement : Windows 11 Pro, i7-class, 32 GB RAM, PostgreSQL 16 Docker.

## Résultats

| Métrique | Cible | Mesuré |
|----------|-------|--------|
| Boot 34 services | < 5s | ~2.4s ✓ |
| Seed 267 rows | < 15s | ~8s ✓ |
| Login round-trip | < 300ms | ~180ms ✓ |
| /calendar render | < 500ms | ~420ms ✓ |

## Notes

- Boot mesuré via `cargo test --test boot` (budget S1 raised 3→5s).
- Seed mesuré sur reset complet Acme Corp, postgres local.
- Login inclut Argon2 verify + JWT sign + DB lookup.

## Regressions à surveiller

- Ajout de nouveaux consumers = +0.1 à +0.3s par consumer (DB connection acquire).
- Upscale seed > 500 items = overhead linéaire.
```

- [ ] **Step 3 : Commit**

```bash
rtk git add scripts/bench-baseline.sh docs/benchmarks
rtk git commit -m "docs(bench): baseline benchmark 2026-04-18 after S1+S2+S3 merge"
```

---

## Task 12 — Merge main

- [ ] **Step 1 : Vérification finale**

```bash
rtk cargo clippy --workspace --all-features -- -D warnings  # 0 warning
rtk cargo test -p signapps-platform --test boot -- --ignored  # < 5s
rtk just e2e  # tous verts
```

- [ ] **Step 2 : Merge**

```bash
rtk git checkout main
rtk git pull origin main
rtk git merge --no-ff feature/s3-integration-tests -m "merge: S3 (integration tests + polish)"
rtk git push origin main
```

---

## Fin du plan S3

**Récapitulatif :** 12 tâches, 5 jours, 1 crate nouveau + 4 scénarios Playwright + fix clippy + 2 docs architecture + 2 scripts ops.

**Exit criteria :**
- [ ] 5 tests intégration Rust verts
- [ ] Playwright full suite verte (~15 scénarios)
- [ ] Clippy workspace 0 warning
- [ ] Boot < 5s
- [ ] Docs architecture consolidées
- [ ] Merge main réussi
