# S2 — PXE+DHCP fonctionnel & Seeding démo cohérent — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Rendre PXE+DHCP opérationnels (auto-discovery, wizard, SSE) et livrer un seeding démo cohérent cross-services (15 services peuplés, binary Rust idempotent).

**Architecture :** Ports non-privileged par défaut (TFTP 6969, DHCP 4011) via `PXE_MODE=user`. Auto-discovery DHCP avec LISTEN/NOTIFY pour SSE live. Binary `signapps-seed` (bin-only) qui accède directement aux repos de `signapps-db` avec UUIDs namespace v5 déterministes pour reproductibilité.

**Tech Stack :** Rust/Axum/SQLx/Tokio, PostgreSQL LISTEN/NOTIFY, reqwest streaming, uuid v5, ldap3, SSE (axum::response::Sse), React hook `useEventSource`, Playwright.

---

## Plan de décomposition

| Wave | Jours | Tâches | Focus |
|------|-------|--------|-------|
| W1 | 3 | T1-T6 | Track B foundation (migration, ports, auto-discovery, endpoints, sim) |
| W2 | 3 | T7-T12 | Track B wizard + SSE (frontend complet, E2E) |
| W3 | 4 | T13-T21 | Track C seeding (15 seeders + CLI + idempotence + E2E) |

**Total : 21 tâches, 10 jours.**

---

## File Structure

**Créations :**
```
migrations/
  427_pxe_autodiscovery_sse.sql

services/signapps-pxe/src/
  sse.rs                      # SSE handler pour deployments stream
  auto_enroll.rs              # Logic auto-discovery MAC
  bin/sim.rs                  # Test client PXE simulé

services/signapps-seed/
  Cargo.toml
  src/
    main.rs                   # CLI entry point
    lib.rs                    # exports
    context.rs                # SeedContext shared state
    seeder.rs                 # Trait Seeder
    uuid.rs                   # acme_uuid() helper namespace v5
    seeders/
      mod.rs
      org.rs                  # tenant + OUs + personnes
      identity.rs             # users
      ad.rs                   # config AD démo
      calendar.rs             # calendriers + events
      mail.rs                 # mailboxes + messages
      chat.rs                 # channels + messages
      docs.rs                 # documents Tiptap
      drive.rs                # buckets + files
      forms.rs                # formulaires
      contacts.rs             # contacts externes
      meet.rs                 # salles pré-configurées
      tasks.rs                # tâches Kanban
      it_assets.rs            # assets IT
      vault.rs                # secrets partagés
      pxe.rs                  # profiles + assets enrôlés

client/src/
  app/pxe/wizard/page.tsx     # Refactor complet 5 étapes
  app/pxe/assets/page.tsx     # Nouveau (tabs Tous | Découverts | Enrôlés)
  app/pxe/debug/page.tsx      # Nouveau (requêtes DHCP récentes)
  hooks/usePxeDeploymentStream.ts  # Hook SSE
  components/pxe/LiveDeploymentTerminal.tsx
  components/pxe/WizardStep1Catalog.tsx
  components/pxe/WizardStep2Profile.tsx
  components/pxe/WizardStep3Target.tsx
  components/pxe/WizardStep4Confirm.tsx
  components/pxe/WizardStep5Progress.tsx

client/e2e/
  s2-pxe.spec.ts
  s2-seeding.spec.ts

docs/product-specs/
  54-pxe-operational.md
  55-seeding-demo.md

.claude/skills/
  pxe-operational-debug/SKILL.md
  seeding-debug/SKILL.md

services/signapps-pxe/tests/
  test_dhcp_flow.rs
  test_sse_stream.rs

services/signapps-seed/tests/
  test_full_seed.rs
  test_reset_then_seed.rs
  test_only_filter.rs
```

**Modifications :**
```
services/signapps-pxe/src/lib.rs              # PXE_MODE, ports non-priv, auto-discovery hook
services/signapps-pxe/src/dhcp_proxy.rs       # ajout ctx + auto-enroll
services/signapps-pxe/src/handlers.rs         # nouveaux endpoints discovered/enroll/dhcp-recent
services/signapps-pxe/Cargo.toml              # ajout [[bin]] sim
services/signapps-pxe/src/openapi.rs          # ajout nouveaux endpoints
Cargo.toml (workspace)                        # ajout signapps-seed
justfile                                      # db-seed, db-seed-reset
CLAUDE.md                                     # 3 lignes refs PXE + seed
scripts/seed-demo-data.sh                     # supprimé (remplacé)
```

---

# WAVE 1 — Track B foundation (T1 à T6, 3 jours)

---

### Task 1 : Migration 427 (auto-discovery + SSE trigger)

**Files :**
- Create : `migrations/427_pxe_autodiscovery_sse.sql`
- Test : `crates/signapps-db/tests/test_migration_427.rs`

- [ ] **Step 1 : Écrire le test d'application de migration**

```rust
// crates/signapps-db/tests/test_migration_427.rs
#[sqlx::test(migrations = "../../migrations")]
async fn test_migration_427_adds_autodiscovery_columns(pool: PgPool) {
    // Vérifie que les colonnes ajoutées sur pxe.assets existent
    let cols = sqlx::query_scalar::<_, String>(
        "SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'pxe' AND table_name = 'assets'
         AND column_name IN ('discovered_via', 'boot_count', 'last_boot_profile_id', 'dhcp_vendor_class', 'arch_detected')",
    )
    .fetch_all(&pool)
    .await
    .unwrap();
    assert_eq!(cols.len(), 5, "5 nouvelles colonnes attendues, {} trouvées", cols.len());

    // Vérifie que pxe.dhcp_requests existe
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables
                        WHERE table_schema = 'pxe' AND table_name = 'dhcp_requests')",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert!(exists, "pxe.dhcp_requests doit exister");

    // Vérifie que le trigger NOTIFY existe
    let trig: Option<String> = sqlx::query_scalar(
        "SELECT tgname FROM pg_trigger WHERE tgname = 'pxe_deployment_progress_notify'",
    )
    .fetch_optional(&pool)
    .await
    .unwrap();
    assert!(trig.is_some(), "trigger pxe_deployment_progress_notify manquant");
}
```

- [ ] **Step 2 : Écrire la migration**

```sql
-- migrations/427_pxe_autodiscovery_sse.sql
-- Migration 427: PXE auto-discovery, DHCP request tracking, SSE NOTIFY trigger

ALTER TABLE pxe.assets
    ADD COLUMN IF NOT EXISTS discovered_via VARCHAR(20) NOT NULL DEFAULT 'manual'
        CHECK (discovered_via IN ('manual', 'dhcp', 'api', 'import')),
    ADD COLUMN IF NOT EXISTS boot_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_boot_profile_id UUID REFERENCES pxe.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS dhcp_vendor_class VARCHAR(255),
    ADD COLUMN IF NOT EXISTS arch_detected VARCHAR(20);

CREATE TABLE IF NOT EXISTS pxe.dhcp_requests (
    id BIGSERIAL PRIMARY KEY,
    mac_address VARCHAR(17) NOT NULL,
    client_ip INET,
    xid BYTEA,
    msg_type VARCHAR(16),
    vendor_class VARCHAR(255),
    arch VARCHAR(20),
    responded BOOLEAN NOT NULL DEFAULT FALSE,
    response_boot_file TEXT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pxe_dhcp_requests_mac ON pxe.dhcp_requests(mac_address);
CREATE INDEX IF NOT EXISTS idx_pxe_dhcp_requests_received_at ON pxe.dhcp_requests(received_at DESC);

CREATE OR REPLACE FUNCTION pxe_deployment_notify() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify(
        'pxe_deployment_progress',
        json_build_object(
            'mac', NEW.asset_mac,
            'progress', NEW.progress,
            'status', NEW.status,
            'step', NEW.current_step
        )::text
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pxe_deployment_progress_notify ON pxe.deployments;
CREATE TRIGGER pxe_deployment_progress_notify
    AFTER UPDATE ON pxe.deployments
    FOR EACH ROW
    WHEN (OLD.progress IS DISTINCT FROM NEW.progress OR OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION pxe_deployment_notify();
```

- [ ] **Step 3 : Run test**

Run : `cargo test -p signapps-db test_migration_427`
Expected : PASS

- [ ] **Step 4 : Commit**

```bash
rtk git add migrations/427_pxe_autodiscovery_sse.sql crates/signapps-db/tests/test_migration_427.rs
rtk git commit -m "feat(pxe): migration 427 auto-discovery columns + DHCP tracking + SSE trigger"
```

---

### Task 2 : PXE_MODE + ports non-privileged

**Files :**
- Modify : `services/signapps-pxe/src/lib.rs`
- Modify : `services/signapps-pxe/src/tftp.rs` (expose port arg)
- Modify : `services/signapps-pxe/src/dhcp_proxy.rs` (expose port arg)
- Test : `services/signapps-pxe/src/lib.rs` (ajout `#[cfg(test)]`)

- [ ] **Step 1 : Test unitaire pour la résolution des ports**

```rust
// services/signapps-pxe/src/lib.rs (à la fin)
#[cfg(test)]
mod mode_tests {
    use super::*;

    #[test]
    fn test_pxe_mode_user_gives_non_privileged_ports() {
        std::env::set_var("PXE_MODE", "user");
        std::env::remove_var("PXE_TFTP_PORT");
        std::env::remove_var("PXE_DHCP_PORT");

        assert_eq!(resolve_tftp_port(), 6969);
        assert_eq!(resolve_dhcp_port(), 4011);
    }

    #[test]
    fn test_pxe_mode_root_gives_privileged_ports() {
        std::env::set_var("PXE_MODE", "root");
        std::env::remove_var("PXE_TFTP_PORT");
        std::env::remove_var("PXE_DHCP_PORT");

        assert_eq!(resolve_tftp_port(), 69);
        assert_eq!(resolve_dhcp_port(), 67);
    }

    #[test]
    fn test_explicit_port_override_wins() {
        std::env::set_var("PXE_MODE", "user");
        std::env::set_var("PXE_TFTP_PORT", "8080");
        assert_eq!(resolve_tftp_port(), 8080);
        std::env::remove_var("PXE_TFTP_PORT");
    }
}
```

- [ ] **Step 2 : Implémentation**

Ajouter dans `services/signapps-pxe/src/lib.rs` :

```rust
/// Mode de déploiement PXE : `user` (ports non privilégiés) ou `root` (standard).
pub fn resolve_tftp_port() -> u16 {
    if let Ok(explicit) = std::env::var("PXE_TFTP_PORT") {
        if let Ok(p) = explicit.parse::<u16>() {
            return p;
        }
    }
    match std::env::var("PXE_MODE").as_deref() {
        Ok("root") => 69,
        _ => 6969,
    }
}

/// ProxyDHCP port (4011 standard, pas :67 pour éviter conflit LAN DHCP).
pub fn resolve_dhcp_port() -> u16 {
    if let Ok(explicit) = std::env::var("PXE_DHCP_PORT") {
        if let Ok(p) = explicit.parse::<u16>() {
            return p;
        }
    }
    match std::env::var("PXE_MODE").as_deref() {
        Ok("root") => 67,
        _ => 4011,
    }
}
```

Puis remplacer `tftp::start_tftp_server(..., 69)` par `tftp::start_tftp_server(..., resolve_tftp_port())` et mettre à jour `ProxyDhcpConfig::default()` pour utiliser `resolve_dhcp_port()`.

Changer défaut `PXE_ENABLE_TFTP` et `PXE_ENABLE_PROXY_DHCP` en `"true"` pour que le mode user soit actif par défaut (les ports non-priv ne requièrent pas root).

- [ ] **Step 3 : Run test**

Run : `rtk cargo test -p signapps-pxe mode_tests`
Expected : 3 PASS

- [ ] **Step 4 : Smoke test boot**

Run :
```bash
just kill-signapps 2>/dev/null || powershell "Stop-Process -Name signapps-platform -Force -ErrorAction SilentlyContinue"
sleep 2
rtk cargo test -p signapps-platform --test boot -- --ignored
```

Expected : boot < 5s avec TFTP :6969 + ProxyDHCP :4011 actifs dans les logs.

- [ ] **Step 5 : Commit**

```bash
rtk git add services/signapps-pxe/src/lib.rs services/signapps-pxe/src/dhcp_proxy.rs services/signapps-pxe/src/tftp.rs
rtk git commit -m "feat(pxe): PXE_MODE user/root + ports non privilégiés par défaut (TFTP 6969, DHCP 4011)"
```

---

### Task 3 : Auto-discovery MAC dans ProxyDHCP

**Files :**
- Create : `services/signapps-pxe/src/auto_enroll.rs`
- Modify : `services/signapps-pxe/src/dhcp_proxy.rs`
- Modify : `services/signapps-pxe/src/lib.rs`
- Test : `services/signapps-pxe/src/auto_enroll.rs` (`#[cfg(test)]`)

- [ ] **Step 1 : Test unitaire — record DHCP request**

```rust
// services/signapps-pxe/src/auto_enroll.rs
use signapps_db::DatabasePool;

/// Enregistre une requête DHCP + upsert l'asset correspondant.
///
/// Idempotent : la MAC unique update `last_seen` si déjà connue, insert sinon.
#[tracing::instrument(skip(pool), fields(mac = %mac))]
pub async fn record_dhcp_request(
    pool: &DatabasePool,
    mac: &str,
    msg_type: &str,
    vendor_class: Option<&str>,
    arch: Option<&str>,
    responded: bool,
    boot_file: Option<&str>,
    auto_enroll: bool,
) -> anyhow::Result<()> {
    // Insert DHCP log row
    sqlx::query(
        "INSERT INTO pxe.dhcp_requests
         (mac_address, msg_type, vendor_class, arch, responded, response_boot_file)
         VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(mac)
    .bind(msg_type)
    .bind(vendor_class)
    .bind(arch)
    .bind(responded)
    .bind(boot_file)
    .execute(pool.inner())
    .await?;

    if auto_enroll {
        sqlx::query(
            "INSERT INTO pxe.assets (mac_address, status, discovered_via, dhcp_vendor_class, arch_detected, last_seen)
             VALUES ($1, 'discovered', 'dhcp', $2, $3, NOW())
             ON CONFLICT (mac_address) DO UPDATE SET
                 last_seen = NOW(),
                 dhcp_vendor_class = COALESCE(EXCLUDED.dhcp_vendor_class, pxe.assets.dhcp_vendor_class),
                 arch_detected = COALESCE(EXCLUDED.arch_detected, pxe.assets.arch_detected)",
        )
        .bind(mac)
        .bind(vendor_class)
        .bind(arch)
        .execute(pool.inner())
        .await?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[sqlx::test(migrations = "../../migrations")]
    async fn test_record_new_mac_creates_asset(pool: sqlx::PgPool) {
        let db = DatabasePool::new(pool.clone());
        record_dhcp_request(&db, "aa:bb:cc:00:00:01", "DISCOVER", Some("PXEClient:Arch:00000"), Some("bios"), true, Some("signapps-boot.ipxe"), true).await.unwrap();

        let status: String = sqlx::query_scalar("SELECT status FROM pxe.assets WHERE mac_address = $1")
            .bind("aa:bb:cc:00:00:01")
            .fetch_one(&pool).await.unwrap();
        assert_eq!(status, "discovered");
    }

    #[sqlx::test(migrations = "../../migrations")]
    async fn test_record_existing_mac_updates_last_seen(pool: sqlx::PgPool) {
        let db = DatabasePool::new(pool.clone());
        record_dhcp_request(&db, "aa:bb:cc:00:00:02", "DISCOVER", None, None, true, None, true).await.unwrap();
        let first_seen: chrono::DateTime<chrono::Utc> = sqlx::query_scalar("SELECT last_seen FROM pxe.assets WHERE mac_address = $1")
            .bind("aa:bb:cc:00:00:02")
            .fetch_one(&pool).await.unwrap();

        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
        record_dhcp_request(&db, "aa:bb:cc:00:00:02", "REQUEST", None, None, true, None, true).await.unwrap();

        let updated_seen: chrono::DateTime<chrono::Utc> = sqlx::query_scalar("SELECT last_seen FROM pxe.assets WHERE mac_address = $1")
            .bind("aa:bb:cc:00:00:02")
            .fetch_one(&pool).await.unwrap();
        assert!(updated_seen > first_seen);

        // Vérifier qu'il n'y a qu'un seul asset
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM pxe.assets WHERE mac_address = $1")
            .bind("aa:bb:cc:00:00:02")
            .fetch_one(&pool).await.unwrap();
        assert_eq!(count, 1);
    }

    #[sqlx::test(migrations = "../../migrations")]
    async fn test_auto_enroll_false_does_not_create_asset(pool: sqlx::PgPool) {
        let db = DatabasePool::new(pool.clone());
        record_dhcp_request(&db, "aa:bb:cc:00:00:03", "DISCOVER", None, None, false, None, false).await.unwrap();
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM pxe.assets WHERE mac_address = $1")
            .bind("aa:bb:cc:00:00:03")
            .fetch_one(&pool).await.unwrap();
        assert_eq!(count, 0);
    }
}
```

- [ ] **Step 2 : Wire auto_enroll dans dhcp_proxy.rs**

Modifier `handle_dhcp_packet` pour recevoir `db: DatabasePool` + `auto_enroll: bool` et appeler `record_dhcp_request` après parse de la MAC. Rendre `start_proxy_dhcp` async et propager `db` via `ProxyDhcpConfig`.

```rust
// ajouter dans ProxyDhcpConfig
pub db: Option<signapps_db::DatabasePool>,
pub auto_enroll: bool,

// dans handle_dhcp_packet, après parse MAC :
let mac = format!("{:02x}:{:02x}:{:02x}:{:02x}:{:02x}:{:02x}",
    chaddr[0], chaddr[1], chaddr[2], chaddr[3], chaddr[4], chaddr[5]);

if let Some(ref db) = db {
    let db = db.clone();
    let mac_c = mac.clone();
    let vc = vendor_class.clone();
    tokio::spawn(async move {
        if let Err(e) = crate::auto_enroll::record_dhcp_request(
            &db, &mac_c, if msg_type == DHCPDISCOVER { "DISCOVER" } else { "REQUEST" },
            vc.as_deref(), None, true, Some(boot_filename), auto_enroll,
        ).await {
            tracing::warn!("Failed to record DHCP request: {}", e);
        }
    });
}
```

- [ ] **Step 3 : Expose PXE_AUTO_ENROLL env flag**

Dans `lib.rs`, passer `env_or("PXE_AUTO_ENROLL", "true").parse().unwrap_or(true)` à la config ProxyDHCP.

- [ ] **Step 4 : Run tests**

Run : `rtk cargo test -p signapps-pxe auto_enroll::tests`
Expected : 3 PASS

- [ ] **Step 5 : Commit**

```bash
rtk git add services/signapps-pxe/src/auto_enroll.rs services/signapps-pxe/src/dhcp_proxy.rs services/signapps-pxe/src/lib.rs
rtk git commit -m "feat(pxe): auto-discovery MAC via ProxyDHCP + DHCP requests tracking"
```

---

### Task 4 : Endpoints assets/discovered + enroll

**Files :**
- Modify : `services/signapps-pxe/src/handlers.rs`
- Modify : `services/signapps-pxe/src/lib.rs` (routes)
- Modify : `services/signapps-pxe/src/openapi.rs`

- [ ] **Step 1 : Écrire le test d'intégration**

```rust
// services/signapps-pxe/tests/test_discovered_endpoints.rs
use signapps_db::DatabasePool;

#[sqlx::test(migrations = "../../migrations")]
async fn test_list_discovered_assets(pool: sqlx::PgPool) {
    let db = DatabasePool::new(pool.clone());
    signapps_pxe::auto_enroll::record_dhcp_request(
        &db, "aa:bb:cc:dd:ee:01", "DISCOVER", None, None, true, None, true,
    ).await.unwrap();
    signapps_pxe::auto_enroll::record_dhcp_request(
        &db, "aa:bb:cc:dd:ee:02", "DISCOVER", None, None, true, None, true,
    ).await.unwrap();

    let rows = signapps_pxe::handlers::list_discovered_impl(&db).await.unwrap();
    assert_eq!(rows.len(), 2);
    assert!(rows.iter().all(|a| a.status == "discovered"));
}

#[sqlx::test(migrations = "../../migrations")]
async fn test_enroll_asset_transitions_status(pool: sqlx::PgPool) {
    let db = DatabasePool::new(pool.clone());
    signapps_pxe::auto_enroll::record_dhcp_request(
        &db, "aa:bb:cc:dd:ee:03", "DISCOVER", None, None, true, None, true,
    ).await.unwrap();

    signapps_pxe::handlers::enroll_asset_impl(&db, "aa:bb:cc:dd:ee:03", None, None).await.unwrap();

    let status: String = sqlx::query_scalar("SELECT status FROM pxe.assets WHERE mac_address = $1")
        .bind("aa:bb:cc:dd:ee:03")
        .fetch_one(&pool).await.unwrap();
    assert_eq!(status, "enrolled");
}
```

- [ ] **Step 2 : Implémentation handlers**

```rust
// services/signapps-pxe/src/handlers.rs (à ajouter)
#[derive(Serialize, utoipa::ToSchema)]
pub struct DiscoveredAsset {
    pub mac_address: String,
    pub status: String,
    pub discovered_via: String,
    pub last_seen: Option<chrono::DateTime<chrono::Utc>>,
    pub dhcp_vendor_class: Option<String>,
    pub arch_detected: Option<String>,
}

pub async fn list_discovered_impl(db: &DatabasePool) -> Result<Vec<DiscoveredAsset>, sqlx::Error> {
    sqlx::query_as!(DiscoveredAsset,
        r#"SELECT mac_address, status, discovered_via, last_seen, dhcp_vendor_class, arch_detected
           FROM pxe.assets WHERE status = 'discovered' ORDER BY last_seen DESC NULLS LAST"#)
        .fetch_all(db.inner()).await
}

#[utoipa::path(
    get,
    path = "/api/v1/pxe/assets/discovered",
    responses((status = 200, body = Vec<DiscoveredAsset>)),
    security(("bearerAuth" = [])),
    tag = "pxe"
)]
pub async fn list_discovered(State(state): State<AppState>) -> Result<Json<Vec<DiscoveredAsset>>, AppError> {
    let rows = list_discovered_impl(&state.db).await
        .map_err(|e| AppError::internal(format!("DB: {e}")))?;
    Ok(Json(rows))
}

#[derive(Deserialize, utoipa::ToSchema)]
pub struct EnrollRequest {
    pub hostname: Option<String>,
    pub profile_id: Option<uuid::Uuid>,
    pub assigned_user_id: Option<uuid::Uuid>,
}

pub async fn enroll_asset_impl(
    db: &DatabasePool,
    mac: &str,
    hostname: Option<&str>,
    profile_id: Option<uuid::Uuid>,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE pxe.assets SET status = 'enrolled', hostname = $2, profile_id = $3, updated_at = NOW()
         WHERE mac_address = $1 AND status = 'discovered'",
    )
    .bind(mac)
    .bind(hostname)
    .bind(profile_id)
    .execute(db.inner()).await?;
    Ok(())
}

#[utoipa::path(
    post,
    path = "/api/v1/pxe/assets/{mac}/enroll",
    params(("mac" = String, Path, description = "MAC address")),
    request_body = EnrollRequest,
    responses((status = 200, description = "Enrolled")),
    security(("bearerAuth" = [])),
    tag = "pxe"
)]
pub async fn enroll_asset(
    State(state): State<AppState>,
    Path(mac): Path<String>,
    Json(req): Json<EnrollRequest>,
) -> Result<StatusCode, AppError> {
    enroll_asset_impl(&state.db, &mac, req.hostname.as_deref(), req.profile_id).await
        .map_err(|e| AppError::internal(format!("DB: {e}")))?;
    Ok(StatusCode::OK)
}
```

Wire dans `create_router` :

```rust
.route("/api/v1/pxe/assets/discovered", get(handlers::list_discovered))
.route("/api/v1/pxe/assets/:mac/enroll", post(handlers::enroll_asset))
```

Ajouter dans openapi.rs les nouveaux paths/schemas.

- [ ] **Step 3 : Run tests**

Run : `rtk cargo test -p signapps-pxe --test test_discovered_endpoints`
Expected : 2 PASS

- [ ] **Step 4 : Commit**

```bash
rtk git add services/signapps-pxe/src/handlers.rs services/signapps-pxe/src/lib.rs services/signapps-pxe/src/openapi.rs services/signapps-pxe/tests/test_discovered_endpoints.rs
rtk git commit -m "feat(pxe): endpoints /assets/discovered + /assets/:mac/enroll"
```

---

### Task 5 : Endpoints DHCP recent + catalog refresh

**Files :**
- Modify : `services/signapps-pxe/src/handlers.rs`
- Modify : `services/signapps-pxe/src/catalog.rs`
- Modify : `services/signapps-pxe/src/lib.rs` (routes)

- [ ] **Step 1 : Test**

```rust
// services/signapps-pxe/tests/test_dhcp_recent.rs
use signapps_db::DatabasePool;

#[sqlx::test(migrations = "../../migrations")]
async fn test_dhcp_recent_returns_last_100(pool: sqlx::PgPool) {
    let db = DatabasePool::new(pool.clone());
    for i in 0..105 {
        signapps_pxe::auto_enroll::record_dhcp_request(
            &db, &format!("aa:bb:cc:00:{:02x}:00", i), "DISCOVER", None, None, true, None, false,
        ).await.unwrap();
    }

    let rows = signapps_pxe::handlers::list_recent_dhcp_impl(&db, 100).await.unwrap();
    assert_eq!(rows.len(), 100);
}
```

- [ ] **Step 2 : Implémentation**

```rust
// services/signapps-pxe/src/handlers.rs
#[derive(Serialize, utoipa::ToSchema)]
pub struct DhcpRequestLog {
    pub id: i64,
    pub mac_address: String,
    pub msg_type: Option<String>,
    pub vendor_class: Option<String>,
    pub responded: bool,
    pub received_at: chrono::DateTime<chrono::Utc>,
}

pub async fn list_recent_dhcp_impl(db: &DatabasePool, limit: i64) -> Result<Vec<DhcpRequestLog>, sqlx::Error> {
    sqlx::query_as!(DhcpRequestLog,
        r#"SELECT id, mac_address, msg_type, vendor_class, responded, received_at
           FROM pxe.dhcp_requests ORDER BY received_at DESC LIMIT $1"#, limit)
        .fetch_all(db.inner()).await
}

#[utoipa::path(
    get,
    path = "/api/v1/pxe/dhcp/recent",
    params(("limit" = Option<i64>, Query, description = "Max rows (default 100)")),
    responses((status = 200, body = Vec<DhcpRequestLog>)),
    security(("bearerAuth" = [])),
    tag = "pxe-debug"
)]
pub async fn list_recent_dhcp(
    State(state): State<AppState>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<Vec<DhcpRequestLog>>, AppError> {
    let limit = params.get("limit").and_then(|s| s.parse::<i64>().ok()).unwrap_or(100).min(500);
    let rows = list_recent_dhcp_impl(&state.db, limit).await
        .map_err(|e| AppError::internal(format!("DB: {e}")))?;
    Ok(Json(rows))
}
```

```rust
// services/signapps-pxe/src/catalog.rs (ajout)
#[utoipa::path(
    post,
    path = "/api/v1/pxe/catalog/refresh",
    responses((status = 200, description = "Catalog sha256 verified"), (status = 500)),
    security(("bearerAuth" = [])),
    tag = "pxe-catalog"
)]
pub async fn refresh_catalog(State(_state): State<AppState>) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let catalog = get_catalog();
    let mut verified = 0;
    let mut missing = 0;
    let mut corrupted = Vec::new();

    for image in catalog.iter().filter(|i| !i.sha256.is_empty()) {
        let filename = format!("{}-{}.iso", image.name.to_lowercase().replace(' ', "_"), image.version);
        let path = std::path::Path::new(IMAGES_DIR).join(&filename);
        if !path.exists() { missing += 1; continue; }

        let bytes = tokio::fs::read(&path).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        let hash = sha2::Sha256::digest(&bytes);
        let hex = hex::encode(hash);
        if hex == image.sha256 { verified += 1; } else { corrupted.push(image.name.clone()); }
    }

    Ok(Json(serde_json::json!({
        "verified": verified, "missing": missing, "corrupted": corrupted,
    })))
}
```

Ajouter `sha2` et `hex` dans `services/signapps-pxe/Cargo.toml`.

Wire routes :
```rust
.route("/api/v1/pxe/dhcp/recent", get(handlers::list_recent_dhcp))
.route("/api/v1/pxe/catalog/refresh", post(catalog::refresh_catalog))
```

- [ ] **Step 3 : Run tests**

Run : `rtk cargo test -p signapps-pxe test_dhcp_recent`
Expected : PASS

- [ ] **Step 4 : Commit**

```bash
rtk git add services/signapps-pxe/src/handlers.rs services/signapps-pxe/src/catalog.rs services/signapps-pxe/Cargo.toml services/signapps-pxe/src/lib.rs services/signapps-pxe/tests/test_dhcp_recent.rs
rtk git commit -m "feat(pxe): endpoints /dhcp/recent + /catalog/refresh"
```

---

### Task 6 : Test client simulé (bin sim.rs) + test E2E DHCP

**Files :**
- Create : `services/signapps-pxe/src/bin/sim.rs`
- Create : `services/signapps-pxe/tests/test_dhcp_flow.rs`
- Modify : `services/signapps-pxe/Cargo.toml`

- [ ] **Step 1 : Test d'intégration du flow DHCPDISCOVER → OFFER**

```rust
// services/signapps-pxe/tests/test_dhcp_flow.rs
use signapps_db::DatabasePool;
use signapps_pxe::dhcp_proxy::{start_proxy_dhcp, ProxyDhcpConfig};
use std::net::{Ipv4Addr, SocketAddr, UdpSocket};
use std::time::Duration;

#[sqlx::test(migrations = "../../migrations")]
async fn test_dhcp_discover_gets_offer(pool: sqlx::PgPool) {
    let db = DatabasePool::new(pool.clone());

    // Bind server on random port
    let server_port: u16 = 40000 + (rand::random::<u16>() % 10000);
    let config = ProxyDhcpConfig {
        tftp_server_ip: Ipv4Addr::new(127, 0, 0, 1),
        boot_filename: "test-boot.ipxe".to_string(),
        bind_addr: format!("127.0.0.1:{}", server_port).parse().unwrap(),
        db: Some(db.clone()),
        auto_enroll: true,
    };

    let server_handle = tokio::spawn(async move {
        let _ = start_proxy_dhcp(config).await;
    });
    tokio::time::sleep(Duration::from_millis(200)).await;

    // Build a PXE DHCPDISCOVER packet
    let mut pkt = vec![0u8; 236];
    pkt[0] = 1; // BOOTREQUEST
    pkt[1] = 1; // Ethernet
    pkt[2] = 6; // MAC len
    pkt[4..8].copy_from_slice(&[0x12, 0x34, 0x56, 0x78]); // xid
    pkt[28..34].copy_from_slice(&[0xAA, 0xBB, 0xCC, 0x00, 0xFF, 0x01]); // MAC
    pkt.extend_from_slice(&[99, 130, 83, 99]); // magic cookie
    pkt.extend_from_slice(&[53, 1, 1]); // DHCPDISCOVER
    pkt.extend_from_slice(&[60, 9]); pkt.extend_from_slice(b"PXEClient"); // class id
    pkt.push(255); // END

    let client = UdpSocket::bind("127.0.0.1:0").unwrap();
    client.set_read_timeout(Some(Duration::from_secs(2))).unwrap();
    client.send_to(&pkt, format!("127.0.0.1:{}", server_port)).unwrap();

    let mut buf = [0u8; 1024];
    let (len, _from) = client.recv_from(&mut buf).expect("should receive OFFER");
    assert!(len >= 240, "OFFER should be >= 240 bytes, got {}", len);

    // Vérifie siaddr = 127.0.0.1
    assert_eq!(&buf[20..24], &[127, 0, 0, 1]);

    // Vérifie boot filename présent
    let fname = std::str::from_utf8(&buf[108..108+16]).unwrap();
    assert!(fname.starts_with("test-boot.ipxe"), "fname: {:?}", fname);

    // Vérifie MAC enregistrée
    tokio::time::sleep(Duration::from_millis(200)).await;
    let mac_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM pxe.assets WHERE mac_address = 'aa:bb:cc:00:ff:01'")
        .fetch_one(&pool).await.unwrap();
    assert_eq!(mac_count, 1);

    server_handle.abort();
}
```

- [ ] **Step 2 : Binary sim.rs**

```rust
// services/signapps-pxe/src/bin/sim.rs
//! Test client PXE qui simule DHCPDISCOVER et affiche la réponse.
//! Usage: PXE_SIM_PORT=4011 cargo run --bin signapps-pxe-sim

use std::net::UdpSocket;
use std::time::Duration;

fn main() -> anyhow::Result<()> {
    let port: u16 = std::env::var("PXE_SIM_PORT").ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(4011);
    let mac = std::env::var("PXE_SIM_MAC").unwrap_or_else(|_| "aa:bb:cc:00:00:99".to_string());
    let mac_bytes: Vec<u8> = mac.split(':')
        .map(|s| u8::from_str_radix(s, 16).unwrap())
        .collect();

    println!("PXE Sim → ProxyDHCP on 127.0.0.1:{} (MAC {})", port, mac);

    let mut pkt = vec![0u8; 236];
    pkt[0] = 1;
    pkt[1] = 1;
    pkt[2] = 6;
    pkt[4..8].copy_from_slice(&[0xDE, 0xAD, 0xBE, 0xEF]);
    pkt[28..34].copy_from_slice(&mac_bytes[..6]);
    pkt.extend_from_slice(&[99, 130, 83, 99]);
    pkt.extend_from_slice(&[53, 1, 1]);
    pkt.extend_from_slice(&[60, 9]);
    pkt.extend_from_slice(b"PXEClient");
    pkt.push(255);

    let client = UdpSocket::bind("127.0.0.1:0")?;
    client.set_read_timeout(Some(Duration::from_secs(3)))?;
    client.send_to(&pkt, format!("127.0.0.1:{}", port))?;
    println!("  → sent DHCPDISCOVER ({} bytes)", pkt.len());

    let mut buf = [0u8; 1024];
    match client.recv_from(&mut buf) {
        Ok((len, from)) => {
            println!("  ← received OFFER from {} ({} bytes)", from, len);
            if len >= 236 {
                let siaddr = &buf[20..24];
                let fname_end = buf[108..108+128].iter().position(|&b| b == 0).unwrap_or(128);
                let fname = std::str::from_utf8(&buf[108..108+fname_end]).unwrap_or("<non-utf8>");
                println!("    TFTP server: {}.{}.{}.{}", siaddr[0], siaddr[1], siaddr[2], siaddr[3]);
                println!("    Boot file: {}", fname);
            }
        }
        Err(e) => {
            eprintln!("  ← no OFFER received: {}", e);
            std::process::exit(1);
        }
    }

    Ok(())
}
```

Ajouter au Cargo.toml :
```toml
[[bin]]
name = "signapps-pxe-sim"
path = "src/bin/sim.rs"
```

- [ ] **Step 3 : Run tests**

Run : `rtk cargo test -p signapps-pxe --test test_dhcp_flow`
Expected : PASS

Run : `rtk cargo build --bin signapps-pxe-sim`
Expected : OK

- [ ] **Step 4 : Commit**

```bash
rtk git add services/signapps-pxe/src/bin/sim.rs services/signapps-pxe/tests/test_dhcp_flow.rs services/signapps-pxe/Cargo.toml
rtk git commit -m "feat(pxe): binary signapps-pxe-sim + test E2E DHCP flow"
```

---

# WAVE 2 — Track B wizard + SSE (T7 à T12, 3 jours)

---

### Task 7 : SSE endpoint deployments/stream

**Files :**
- Create : `services/signapps-pxe/src/sse.rs`
- Modify : `services/signapps-pxe/src/lib.rs`
- Create : `services/signapps-pxe/tests/test_sse_stream.rs`

- [ ] **Step 1 : Test SSE stream**

```rust
// services/signapps-pxe/tests/test_sse_stream.rs
use signapps_db::DatabasePool;
use futures_util::StreamExt;

#[sqlx::test(migrations = "../../migrations")]
async fn test_sse_stream_emits_progress_updates(pool: sqlx::PgPool) {
    let db = DatabasePool::new(pool.clone());

    // Insert deployment in progress
    sqlx::query("INSERT INTO pxe.deployments (asset_mac, status, progress) VALUES ($1, 'running', 0)")
        .bind("aa:bb:cc:11:11:11")
        .execute(&pool).await.unwrap();

    // Start stream
    let stream_task = {
        let db = db.clone();
        tokio::spawn(async move {
            let mut rx = signapps_pxe::sse::subscribe_deployment(&db, "aa:bb:cc:11:11:11").await.unwrap();
            let mut events = Vec::new();
            while let Some(evt) = tokio::time::timeout(std::time::Duration::from_secs(2), rx.next()).await.ok().flatten() {
                events.push(evt);
                if events.len() >= 3 { break; }
            }
            events
        })
    };

    tokio::time::sleep(std::time::Duration::from_millis(200)).await;

    for p in [25, 50, 75] {
        sqlx::query("UPDATE pxe.deployments SET progress = $1 WHERE asset_mac = $2")
            .bind(p).bind("aa:bb:cc:11:11:11")
            .execute(&pool).await.unwrap();
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    }

    let events = stream_task.await.unwrap();
    assert_eq!(events.len(), 3);
    // Progress values embedded
    assert!(events.iter().any(|e| e.contains("25")));
    assert!(events.iter().any(|e| e.contains("50")));
    assert!(events.iter().any(|e| e.contains("75")));
}
```

- [ ] **Step 2 : Implémentation SSE via LISTEN/NOTIFY**

```rust
// services/signapps-pxe/src/sse.rs
use axum::extract::{Path, State};
use axum::response::sse::{Event, KeepAlive, Sse};
use futures_util::stream::{Stream, StreamExt};
use signapps_db::DatabasePool;
use std::convert::Infallible;
use tokio_stream::wrappers::BroadcastStream;

pub async fn subscribe_deployment(
    db: &DatabasePool,
    mac: &str,
) -> anyhow::Result<impl Stream<Item = String>> {
    let mut listener = sqlx::postgres::PgListener::connect_with(db.inner()).await?;
    listener.listen("pxe_deployment_progress").await?;
    let mac_filter = mac.to_string();

    let stream = async_stream::stream! {
        loop {
            match listener.recv().await {
                Ok(notification) => {
                    let payload = notification.payload().to_string();
                    if payload.contains(&format!("\"mac\":\"{}\"", mac_filter)) {
                        yield payload;
                    }
                }
                Err(e) => {
                    tracing::warn!("PgListener error: {}", e);
                    break;
                }
            }
        }
    };

    Ok(stream)
}

#[utoipa::path(
    get,
    path = "/api/v1/pxe/deployments/{mac}/stream",
    params(("mac" = String, Path, description = "MAC address")),
    responses((status = 200, description = "SSE stream of progress updates")),
    security(("bearerAuth" = [])),
    tag = "pxe"
)]
pub async fn stream_deployment(
    State(state): State<crate::AppState>,
    Path(mac): Path<String>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let db = state.db.clone();
    let inner = async_stream::stream! {
        match subscribe_deployment(&db, &mac).await {
            Ok(mut s) => {
                while let Some(payload) = s.next().await {
                    yield Ok::<_, Infallible>(Event::default().data(payload));
                }
            }
            Err(e) => {
                tracing::error!("SSE subscribe failed: {}", e);
                yield Ok(Event::default().event("error").data(format!("{{\"error\":\"{}\"}}", e)));
            }
        }
    };

    Sse::new(inner).keep_alive(KeepAlive::default())
}
```

Ajouter `async-stream` et `tokio-stream` dans `Cargo.toml`.

Wire route dans `lib.rs` :
```rust
.route("/api/v1/pxe/deployments/:mac/stream", get(sse::stream_deployment))
```

- [ ] **Step 3 : Run test**

Run : `rtk cargo test -p signapps-pxe --test test_sse_stream`
Expected : PASS

- [ ] **Step 4 : Commit**

```bash
rtk git add services/signapps-pxe/src/sse.rs services/signapps-pxe/Cargo.toml services/signapps-pxe/src/lib.rs services/signapps-pxe/tests/test_sse_stream.rs
rtk git commit -m "feat(pxe): SSE endpoint /deployments/:mac/stream via LISTEN/NOTIFY"
```

---

### Task 8 : Frontend wizard 5 étapes

**Files :**
- Modify : `client/src/app/pxe/wizard/page.tsx` (refactor complet)
- Create : `client/src/components/pxe/WizardStep1Catalog.tsx`
- Create : `client/src/components/pxe/WizardStep2Profile.tsx`
- Create : `client/src/components/pxe/WizardStep3Target.tsx`
- Create : `client/src/components/pxe/WizardStep4Confirm.tsx`
- Create : `client/src/components/pxe/WizardStep5Progress.tsx`

- [ ] **Step 1 : Refactor page.tsx comme container 5 étapes**

```tsx
// client/src/app/pxe/wizard/page.tsx
'use client';

import { useState } from 'react';
import { WizardStep1Catalog } from '@/components/pxe/WizardStep1Catalog';
import { WizardStep2Profile } from '@/components/pxe/WizardStep2Profile';
import { WizardStep3Target } from '@/components/pxe/WizardStep3Target';
import { WizardStep4Confirm } from '@/components/pxe/WizardStep4Confirm';
import { WizardStep5Progress } from '@/components/pxe/WizardStep5Progress';

export type WizardState = {
  image?: { name: string; version: string; iso_url: string };
  profile?: { id: string; name: string };
  mac?: string;
};

export default function PxeWizardPage() {
  const [step, setStep] = useState(1);
  const [state, setState] = useState<WizardState>({});

  return (
    <div className="container mx-auto max-w-4xl py-8">
      <h1 className="mb-6 text-3xl font-bold">Déploiement PXE</h1>
      <div className="mb-8 flex gap-2">
        {[1,2,3,4,5].map(n => (
          <div key={n}
               className={`h-2 flex-1 rounded ${n <= step ? 'bg-primary' : 'bg-muted'}`} />
        ))}
      </div>

      {step === 1 && <WizardStep1Catalog state={state} setState={setState} next={() => setStep(2)} />}
      {step === 2 && <WizardStep2Profile state={state} setState={setState} back={() => setStep(1)} next={() => setStep(3)} />}
      {step === 3 && <WizardStep3Target state={state} setState={setState} back={() => setStep(2)} next={() => setStep(4)} />}
      {step === 4 && <WizardStep4Confirm state={state} back={() => setStep(3)} next={() => setStep(5)} />}
      {step === 5 && <WizardStep5Progress state={state} reset={() => { setState({}); setStep(1); }} />}
    </div>
  );
}
```

- [ ] **Step 2 : Créer les 5 composants d'étape**

```tsx
// client/src/components/pxe/WizardStep1Catalog.tsx
'use client';
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { WizardState } from '@/app/pxe/wizard/page';

type CatalogImage = {
  name: string; version: string; arch: string; iso_url: string;
  size_bytes: number; os_type: string; category: string; description: string;
};

export function WizardStep1Catalog({ state, setState, next }: {
  state: WizardState;
  setState: (s: WizardState) => void;
  next: () => void;
}) {
  const [catalog, setCatalog] = useState<CatalogImage[]>([]);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get('/api/v1/pxe/catalog').then(r => setCatalog(r.data));
  }, []);

  const filtered = catalog.filter(i =>
    !filter || i.name.toLowerCase().includes(filter.toLowerCase()) || i.os_type.includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Étape 1 — Choisir l'image</h2>
      <Input placeholder="Filtrer par nom ou OS..." value={filter} onChange={e => setFilter(e.target.value)} />
      <div className="max-h-96 overflow-auto grid grid-cols-1 gap-2 md:grid-cols-2">
        {filtered.map((img, idx) => {
          const key = `${img.name}-${img.version}`;
          return (
            <button key={key}
                    onClick={() => {
                      setSelected(key);
                      setState({ ...state, image: { name: img.name, version: img.version, iso_url: img.iso_url } });
                    }}
                    className={`rounded border p-3 text-left hover:bg-muted ${selected === key ? 'border-primary bg-muted' : 'border-border'}`}>
              <div className="font-medium">{img.name} {img.version}</div>
              <div className="text-sm text-muted-foreground">{img.os_type} • {img.arch} • {(img.size_bytes / 1e9).toFixed(1)} GB</div>
              <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{img.description}</div>
            </button>
          );
        })}
      </div>
      <div className="flex justify-end">
        <Button onClick={next} disabled={!state.image}>Suivant</Button>
      </div>
    </div>
  );
}
```

```tsx
// client/src/components/pxe/WizardStep2Profile.tsx
'use client';
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import type { WizardState } from '@/app/pxe/wizard/page';

export function WizardStep2Profile({ state, setState, back, next }: {
  state: WizardState;
  setState: (s: WizardState) => void;
  back: () => void; next: () => void;
}) {
  const [profiles, setProfiles] = useState<{ id: string; name: string; description: string }[]>([]);

  useEffect(() => {
    apiClient.get('/api/v1/pxe/profiles').then(r => setProfiles(r.data));
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Étape 2 — Choisir le profil de boot</h2>
      <div className="space-y-2">
        {profiles.map(p => (
          <button key={p.id}
                  onClick={() => setState({ ...state, profile: { id: p.id, name: p.name } })}
                  className={`w-full rounded border p-3 text-left hover:bg-muted ${state.profile?.id === p.id ? 'border-primary bg-muted' : 'border-border'}`}>
            <div className="font-medium">{p.name}</div>
            <div className="text-sm text-muted-foreground">{p.description}</div>
          </button>
        ))}
      </div>
      <div className="flex justify-between">
        <Button variant="outline" onClick={back}>Retour</Button>
        <Button onClick={next} disabled={!state.profile}>Suivant</Button>
      </div>
    </div>
  );
}
```

```tsx
// client/src/components/pxe/WizardStep3Target.tsx
'use client';
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { WizardState } from '@/app/pxe/wizard/page';

type DiscoveredAsset = { mac_address: string; last_seen?: string; dhcp_vendor_class?: string };

export function WizardStep3Target({ state, setState, back, next }: {
  state: WizardState;
  setState: (s: WizardState) => void;
  back: () => void; next: () => void;
}) {
  const [discovered, setDiscovered] = useState<DiscoveredAsset[]>([]);
  const [manualMac, setManualMac] = useState('');

  useEffect(() => {
    apiClient.get('/api/v1/pxe/assets/discovered').then(r => setDiscovered(r.data));
  }, []);

  const setMac = (mac: string) => setState({ ...state, mac });

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Étape 3 — Choisir la machine cible</h2>
      <div>
        <label className="mb-2 block text-sm font-medium">Assets découverts récemment</label>
        <div className="max-h-64 overflow-auto space-y-2">
          {discovered.length === 0 && <div className="text-sm text-muted-foreground">Aucun asset discover — saisissez une MAC manuellement.</div>}
          {discovered.map(a => (
            <button key={a.mac_address}
                    onClick={() => setMac(a.mac_address)}
                    className={`w-full rounded border p-2 text-left ${state.mac === a.mac_address ? 'border-primary bg-muted' : 'border-border'}`}>
              <span className="font-mono">{a.mac_address}</span>
              {a.dhcp_vendor_class && <span className="ml-2 text-xs text-muted-foreground">{a.dhcp_vendor_class}</span>}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium">Ou saisir une MAC manuellement</label>
        <div className="flex gap-2">
          <Input placeholder="aa:bb:cc:dd:ee:ff"
                 value={manualMac}
                 onChange={e => setManualMac(e.target.value)} />
          <Button variant="secondary" onClick={() => setMac(manualMac)} disabled={!manualMac}>Utiliser</Button>
        </div>
      </div>
      {state.mac && <div className="rounded bg-muted p-2 text-sm">Cible : <span className="font-mono">{state.mac}</span></div>}
      <div className="flex justify-between">
        <Button variant="outline" onClick={back}>Retour</Button>
        <Button onClick={next} disabled={!state.mac}>Suivant</Button>
      </div>
    </div>
  );
}
```

```tsx
// client/src/components/pxe/WizardStep4Confirm.tsx
'use client';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import type { WizardState } from '@/app/pxe/wizard/page';

export function WizardStep4Confirm({ state, back, next }: {
  state: WizardState; back: () => void; next: () => void;
}) {
  const kickoff = async () => {
    await apiClient.post('/api/v1/pxe/deployments', {
      asset_mac: state.mac,
      profile_id: state.profile!.id,
    });
    next();
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Étape 4 — Confirmation</h2>
      <div className="rounded border p-4 space-y-2">
        <div><span className="text-muted-foreground">Image :</span> <strong>{state.image?.name} {state.image?.version}</strong></div>
        <div><span className="text-muted-foreground">Profile :</span> <strong>{state.profile?.name}</strong></div>
        <div><span className="text-muted-foreground">Cible :</span> <code>{state.mac}</code></div>
      </div>
      <div className="rounded border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm">
        Cette opération va booter la machine <strong>{state.mac}</strong> et effacer son disque local.
      </div>
      <div className="flex justify-between">
        <Button variant="outline" onClick={back}>Retour</Button>
        <Button onClick={kickoff}>Lancer le déploiement</Button>
      </div>
    </div>
  );
}
```

```tsx
// client/src/components/pxe/WizardStep5Progress.tsx
'use client';
import { LiveDeploymentTerminal } from './LiveDeploymentTerminal';
import { Button } from '@/components/ui/button';
import type { WizardState } from '@/app/pxe/wizard/page';

export function WizardStep5Progress({ state, reset }: { state: WizardState; reset: () => void }) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Étape 5 — Déploiement en cours</h2>
      <LiveDeploymentTerminal mac={state.mac!} />
      <div className="flex justify-end">
        <Button variant="outline" onClick={reset}>Nouveau déploiement</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3 : Visual check local**

Run : `cd client && npm run dev` puis ouvrir `http://localhost:3000/pxe/wizard` et vérifier que les 5 étapes s'affichent sans erreur console.

- [ ] **Step 4 : Commit**

```bash
rtk git add client/src/app/pxe/wizard/page.tsx client/src/components/pxe
rtk git commit -m "feat(pxe-wizard): refactor 5-step wizard (catalog, profile, target, confirm, progress)"
```

---

### Task 9 : Frontend hook SSE + terminal live

**Files :**
- Create : `client/src/hooks/usePxeDeploymentStream.ts`
- Create : `client/src/components/pxe/LiveDeploymentTerminal.tsx`

- [ ] **Step 1 : Hook**

```ts
// client/src/hooks/usePxeDeploymentStream.ts
'use client';
import { useEffect, useState } from 'react';

export type DeploymentUpdate = {
  mac: string;
  progress: number;
  status: string;
  step?: string;
};

export function usePxeDeploymentStream(mac: string | undefined) {
  const [updates, setUpdates] = useState<DeploymentUpdate[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mac) return;

    const url = `/api/v1/pxe/deployments/${encodeURIComponent(mac)}/stream`;
    const src = new EventSource(url, { withCredentials: true });

    src.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as DeploymentUpdate;
        setUpdates(prev => [...prev, data]);
      } catch (e) {
        console.error('Invalid SSE payload', ev.data);
      }
    };
    src.onerror = () => { setError('Connexion SSE perdue — reconnexion auto…'); };

    return () => src.close();
  }, [mac]);

  return { updates, error };
}
```

- [ ] **Step 2 : Composant terminal**

```tsx
// client/src/components/pxe/LiveDeploymentTerminal.tsx
'use client';
import { usePxeDeploymentStream } from '@/hooks/usePxeDeploymentStream';

export function LiveDeploymentTerminal({ mac }: { mac: string }) {
  const { updates, error } = usePxeDeploymentStream(mac);
  const latest = updates[updates.length - 1];

  return (
    <div className="space-y-4">
      {latest && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{latest.status} — {latest.step ?? '…'}</span>
            <span className="font-mono">{latest.progress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded bg-muted">
            <div className="h-full bg-primary transition-all"
                 style={{ width: `${latest.progress}%` }} />
          </div>
        </div>
      )}

      <div className="rounded bg-black p-4 font-mono text-xs text-green-400 max-h-96 overflow-auto">
        {error && <div className="text-yellow-400">⚠ {error}</div>}
        {updates.length === 0 && <div className="text-muted-foreground">En attente du premier événement…</div>}
        {updates.map((u, i) => (
          <div key={i}>
            <span className="text-muted-foreground">[{new Date().toISOString().slice(11, 19)}]</span>
            {' '}{u.status} → {u.progress}% {u.step && `(${u.step})`}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3 : Build check**

Run : `cd client && npm run build`
Expected : compile OK sans erreur TS.

- [ ] **Step 4 : Commit**

```bash
rtk git add client/src/hooks/usePxeDeploymentStream.ts client/src/components/pxe/LiveDeploymentTerminal.tsx
rtk git commit -m "feat(pxe-wizard): SSE hook + LiveDeploymentTerminal component"
```

---

### Task 10 : Frontend page /pxe/assets + /pxe/debug

**Files :**
- Create : `client/src/app/pxe/assets/page.tsx`
- Create : `client/src/app/pxe/debug/page.tsx`

- [ ] **Step 1 : Page /pxe/assets (tabs)**

```tsx
// client/src/app/pxe/assets/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Asset = { id?: string; mac_address: string; status: string; hostname?: string; last_seen?: string };

export default function PxeAssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [tab, setTab] = useState('all');

  const load = () => apiClient.get('/api/v1/pxe/assets').then(r => setAssets(r.data));
  useEffect(() => { load(); }, []);

  const filtered = (t: string) => t === 'all' ? assets
    : t === 'discovered' ? assets.filter(a => a.status === 'discovered')
    : assets.filter(a => a.status !== 'discovered');

  const enroll = async (mac: string) => {
    await apiClient.post(`/api/v1/pxe/assets/${mac}/enroll`, {});
    load();
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="mb-6 text-3xl font-bold">Assets PXE</h1>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">Tous ({assets.length})</TabsTrigger>
          <TabsTrigger value="discovered">Découverts ({filtered('discovered').length})</TabsTrigger>
          <TabsTrigger value="enrolled">Enrôlés ({filtered('enrolled').length})</TabsTrigger>
        </TabsList>
        {['all', 'discovered', 'enrolled'].map(t => (
          <TabsContent key={t} value={t}>
            <div className="space-y-2">
              {filtered(t).map(a => (
                <div key={a.mac_address} className="flex items-center justify-between rounded border p-3">
                  <div>
                    <div className="font-mono text-sm">{a.mac_address}</div>
                    {a.hostname && <div className="text-xs text-muted-foreground">{a.hostname}</div>}
                    <div className="text-xs text-muted-foreground">Status: {a.status}</div>
                  </div>
                  {a.status === 'discovered' && (
                    <Button size="sm" onClick={() => enroll(a.mac_address)}>Enrôler</Button>
                  )}
                </div>
              ))}
              {filtered(t).length === 0 && <div className="text-muted-foreground">Aucun asset.</div>}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 2 : Page /pxe/debug**

```tsx
// client/src/app/pxe/debug/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';

type DhcpLog = {
  id: number; mac_address: string; msg_type: string;
  vendor_class?: string; responded: boolean; received_at: string;
};

export default function PxeDebugPage() {
  const [logs, setLogs] = useState<DhcpLog[]>([]);

  useEffect(() => {
    const load = () => apiClient.get('/api/v1/pxe/dhcp/recent?limit=100').then(r => setLogs(r.data));
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="container mx-auto py-8">
      <h1 className="mb-6 text-3xl font-bold">Debug PXE — DHCP requests</h1>
      <div className="rounded border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted">
            <tr className="text-left">
              <th className="p-2">Reçu</th>
              <th className="p-2">MAC</th>
              <th className="p-2">Type</th>
              <th className="p-2">Vendor</th>
              <th className="p-2">Réponse</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(l => (
              <tr key={l.id} className="border-b">
                <td className="p-2 text-muted-foreground">{new Date(l.received_at).toLocaleTimeString()}</td>
                <td className="p-2 font-mono">{l.mac_address}</td>
                <td className="p-2">{l.msg_type}</td>
                <td className="p-2 truncate max-w-xs">{l.vendor_class ?? '—'}</td>
                <td className="p-2">{l.responded ? '✓' : '✗'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3 : Build check**

Run : `cd client && npm run build`
Expected : OK

- [ ] **Step 4 : Commit**

```bash
rtk git add client/src/app/pxe/assets client/src/app/pxe/debug
rtk git commit -m "feat(pxe-ui): /pxe/assets (tabs) + /pxe/debug (DHCP requests)"
```

---

### Task 11 : E2E Playwright PXE

**Files :**
- Create : `client/e2e/s2-pxe.spec.ts`

- [ ] **Step 1 : Scénarios E2E**

```ts
// client/e2e/s2-pxe.spec.ts
import { test, expect } from '@playwright/test';

test.describe('S2 — PXE opérationnel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login?auto=admin');
    await expect(page).toHaveURL(/\/(dashboard|home|$)/);
  });

  test('S2-PXE-1: Asset discovered via DHCP → enrôlement', async ({ request, page }) => {
    // Simuler une requête DHCP via API test (injection directe)
    const mac = `aa:bb:cc:${Math.floor(Math.random()*256).toString(16).padStart(2,'0')}:00:01`;
    await request.post(`/api/v1/pxe/_test/simulate-dhcp`, { data: { mac } }).catch(() => null);

    await page.goto('/pxe/assets');
    await page.getByRole('tab', { name: /Découverts/ }).click();
    await expect(page.locator(`text=${mac}`).first()).toBeVisible({ timeout: 5000 });

    // Enrôlement
    await page.getByRole('button', { name: 'Enrôler' }).first().click();
    await page.getByRole('tab', { name: /Enrôlés/ }).click();
    await expect(page.locator(`text=${mac}`).first()).toBeVisible();
  });

  test('S2-PXE-2: Wizard complet 5 étapes', async ({ page }) => {
    await page.goto('/pxe/wizard');

    // Étape 1 — catalog
    await expect(page.getByRole('heading', { name: /Choisir l'image/i })).toBeVisible();
    await page.locator('button:has-text("Ubuntu")').first().click();
    await page.getByRole('button', { name: 'Suivant' }).click();

    // Étape 2 — profile
    await expect(page.getByRole('heading', { name: /profil de boot/i })).toBeVisible();
    await page.locator('button:has-text("Boot")').first().click();
    await page.getByRole('button', { name: 'Suivant' }).click();

    // Étape 3 — target
    await page.getByPlaceholder('aa:bb:cc:dd:ee:ff').fill('aa:bb:cc:12:34:56');
    await page.getByRole('button', { name: 'Utiliser' }).click();
    await page.getByRole('button', { name: 'Suivant' }).click();

    // Étape 4 — confirm
    await expect(page.locator('text=aa:bb:cc:12:34:56')).toBeVisible();
    await page.getByRole('button', { name: /Lancer le déploiement/ }).click();

    // Étape 5 — progress
    await expect(page.getByRole('heading', { name: /en cours/i })).toBeVisible({ timeout: 5000 });
  });

  test('S2-PXE-3: Debug DHCP requests visible', async ({ page }) => {
    await page.goto('/pxe/debug');
    await expect(page.getByRole('heading', { name: /DHCP requests/ })).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
  });
});
```

- [ ] **Step 2 : Ajouter endpoint /api/v1/pxe/_test/simulate-dhcp**

Dans `services/signapps-pxe/src/handlers.rs`, ajouter un endpoint de test (activé uniquement en mode dev) :

```rust
#[cfg(any(test, feature = "testing"))]
pub async fn test_simulate_dhcp(
    State(state): State<AppState>,
    Json(req): Json<serde_json::Value>,
) -> Result<StatusCode, AppError> {
    let mac = req.get("mac").and_then(|v| v.as_str()).ok_or_else(|| AppError::bad_request("mac required"))?;
    crate::auto_enroll::record_dhcp_request(&state.db, mac, "DISCOVER", None, None, true, None, true).await
        .map_err(|e| AppError::internal(e.to_string()))?;
    Ok(StatusCode::OK)
}
```

Activer en dev via `#[cfg(not(feature = "prod"))]` ou via env `PXE_TEST_ENDPOINTS=true`. Le plus simple : toujours exposer en dev (conditional sur debug_assertions).

Wire : `.route("/api/v1/pxe/_test/simulate-dhcp", post(handlers::test_simulate_dhcp))` gated sur `cfg!(debug_assertions)`.

- [ ] **Step 3 : Run E2E**

Run : `cd client && npx playwright test s2-pxe.spec.ts --reporter=list`
Expected : 3 PASS

- [ ] **Step 4 : Commit**

```bash
rtk git add client/e2e/s2-pxe.spec.ts services/signapps-pxe/src/handlers.rs services/signapps-pxe/src/lib.rs
rtk git commit -m "test(pxe): 3 E2E Playwright scenarios (discover/enroll, wizard, debug)"
```

---

### Task 12 : Docs PXE opérationnel

**Files :**
- Create : `docs/product-specs/54-pxe-operational.md`
- Create : `.claude/skills/pxe-operational-debug/SKILL.md`
- Modify : `CLAUDE.md`

- [ ] **Step 1 : Product spec**

```md
# Product Spec 54 — PXE Opérationnel

**Status:** Livré S2
**Owner:** Track B
**Related:** 16-pxe.md (legacy)

## Résumé

PXE+DHCP opérationnels en mode dev (ports non privilégiés) et en prod (ports standard). Auto-discovery de machines via DHCPDISCOVER, wizard 5 étapes, progression live via SSE.

## Configuration

- `PXE_MODE=user` (défaut) : TFTP :6969, ProxyDHCP :4011
- `PXE_MODE=root` : TFTP :69, ProxyDHCP :67
- Overrides : `PXE_TFTP_PORT`, `PXE_DHCP_PORT`
- Auto-discovery : `PXE_AUTO_ENROLL=true` (défaut)

## Endpoints (nouveaux)

- `GET /api/v1/pxe/assets/discovered`
- `POST /api/v1/pxe/assets/:mac/enroll`
- `GET /api/v1/pxe/dhcp/recent?limit=100`
- `POST /api/v1/pxe/catalog/refresh`
- `GET /api/v1/pxe/deployments/:mac/stream` (SSE)

## Frontend

- `/pxe/wizard` — 5 étapes (catalog, profile, target, confirm, live progress)
- `/pxe/assets` — tabs (tous, découverts, enrôlés)
- `/pxe/debug` — table des requêtes DHCP récentes

## Tests

- `cargo test -p signapps-pxe --test test_dhcp_flow`
- `cargo test -p signapps-pxe --test test_sse_stream`
- `cd client && npx playwright test s2-pxe.spec.ts`

## Sécurité

- ProxyDHCP filtre option 60 = "PXEClient" (ignore autres requêtes DHCP)
- Enrôlement exige Bearer + RBAC `pxe.asset.enroll`
- Auto-discovery n'accorde aucun droit utilisateur
- Catalog refresh exige admin

## Observabilité

- Spans tracing : `pxe.dhcp_request`, `pxe.deployment_progress`
- Metrics : `pxe_dhcp_requests_total{msg_type}`, `pxe_assets_discovered_total`, `pxe_deployments_active`
```

- [ ] **Step 2 : Debug skill**

```md
# PXE Operational Debug Skill

Use this skill when the user asks about PXE DHCP/TFTP flow failures, wizard issues, or live stream problems.

## Quick diagnosis flow

1. Check listeners : `PXE_MODE`, `PXE_ENABLE_TFTP`, `PXE_ENABLE_PROXY_DHCP` env vars in service logs
2. Test from sim : `cargo run --bin signapps-pxe-sim` → should print OFFER with TFTP IP
3. Check DHCP logs : `GET /api/v1/pxe/dhcp/recent?limit=50` — latest requests
4. Check SSE : `curl -N http://localhost:3016/api/v1/pxe/deployments/<mac>/stream`
5. Check trigger : `SELECT * FROM pg_trigger WHERE tgname = 'pxe_deployment_progress_notify'`

## Common issues

| Symptom | Root cause | Fix |
|---------|-----------|-----|
| TFTP bind fails | PXE_MODE=root but no privileges | Use `PXE_MODE=user` (defaults to :6969) |
| ProxyDHCP no response | MAC missing option 60 PXEClient | Verify DHCPDISCOVER has class_id |
| SSE disconnects | Reverse proxy buffering | Ensure `X-Accel-Buffering: no` header set |
| Wizard stuck step 1 | `/api/v1/pxe/catalog` returns 401 | Check auth cookie/token |
| Assets not appearing | `PXE_AUTO_ENROLL=false` | Set to `true` or manually `POST /assets/:mac/enroll` |
```

- [ ] **Step 3 : CLAUDE.md mise à jour**

Ajouter dans la section "Key Environment Variables" :

```
PXE_MODE=user                       # user (ports 6969/4011) ou root (69/67)
PXE_AUTO_ENROLL=true                # auto-discovery DHCP
```

Dans la section "Préférences de développement" ajouter :
```
- **PXE démo** : `/pxe/wizard` — wizard 5 étapes pour déploiement réseau
```

- [ ] **Step 4 : Commit**

```bash
rtk git add docs/product-specs/54-pxe-operational.md .claude/skills/pxe-operational-debug CLAUDE.md
rtk git commit -m "docs(pxe): product spec 54 + debug skill + CLAUDE.md refs"
```

---

# WAVE 3 — Track C seeding démo (T13 à T21, 4 jours)

---

### Task 13 : Scaffolding crate signapps-seed

**Files :**
- Create : `services/signapps-seed/Cargo.toml`
- Create : `services/signapps-seed/src/main.rs`
- Create : `services/signapps-seed/src/lib.rs`
- Create : `services/signapps-seed/src/context.rs`
- Create : `services/signapps-seed/src/seeder.rs`
- Create : `services/signapps-seed/src/uuid.rs`
- Create : `services/signapps-seed/src/seeders/mod.rs`
- Modify : `Cargo.toml` (workspace members)

- [ ] **Step 1 : Workspace + Cargo.toml**

Ajouter dans `Cargo.toml` racine :
```toml
[workspace]
members = [
    # ... existing ...
    "services/signapps-seed",
]
```

```toml
# services/signapps-seed/Cargo.toml
[package]
name = "signapps-seed"
version = "0.1.0"
edition = "2021"
rust-version = "1.75"

[dependencies]
tokio = { workspace = true, features = ["rt-multi-thread", "macros"] }
anyhow = { workspace = true }
async-trait = { workspace = true }
clap = { version = "4", features = ["derive"] }
tracing = { workspace = true }
tracing-subscriber = { workspace = true }
sqlx = { workspace = true, features = ["postgres", "uuid", "chrono", "macros"] }
uuid = { workspace = true, features = ["v4", "v5", "serde"] }
chrono = { workspace = true }
serde = { workspace = true }
serde_json = { workspace = true }
signapps-db = { path = "../../crates/signapps-db" }
signapps-common = { path = "../../crates/signapps-common" }
signapps-keystore = { path = "../../crates/signapps-keystore" }
argon2 = "0.5"

[[bin]]
name = "signapps-seed"
path = "src/main.rs"
```

- [ ] **Step 2 : Trait Seeder + Context**

```rust
// services/signapps-seed/src/seeder.rs
use crate::context::SeedContext;
use async_trait::async_trait;

#[derive(Debug, Default)]
pub struct SeedReport {
    pub created: usize,
    pub skipped: usize,
    pub errors: Vec<String>,
}

#[async_trait]
pub trait Seeder: Send + Sync {
    fn name(&self) -> &'static str;
    fn dependencies(&self) -> Vec<&'static str> { Vec::new() }
    async fn run(&self, ctx: &SeedContext) -> anyhow::Result<SeedReport>;
}
```

```rust
// services/signapps-seed/src/context.rs
use signapps_db::DatabasePool;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use uuid::Uuid;

pub struct SeedContext {
    pub db: DatabasePool,
    pub tenant_id: Uuid,
    pub force: bool,
    pub dry_run: bool,
    /// Shared map of logical name → UUID (e.g. "marie.dupont" → Uuid)
    pub users: Arc<Mutex<HashMap<String, Uuid>>>,
    pub nodes: Arc<Mutex<HashMap<String, Uuid>>>,
}

impl SeedContext {
    pub fn register_user(&self, name: &str, id: Uuid) {
        self.users.lock().unwrap().insert(name.to_string(), id);
    }
    pub fn user(&self, name: &str) -> Option<Uuid> {
        self.users.lock().unwrap().get(name).copied()
    }
    pub fn register_node(&self, slug: &str, id: Uuid) {
        self.nodes.lock().unwrap().insert(slug.to_string(), id);
    }
    pub fn node(&self, slug: &str) -> Option<Uuid> {
        self.nodes.lock().unwrap().get(slug).copied()
    }
}
```

- [ ] **Step 3 : UUID helper**

```rust
// services/signapps-seed/src/uuid.rs
use uuid::Uuid;

/// Namespace pour tous les UUIDs du seed Acme Corp.
/// Deterministic : même entrée → même UUID.
pub const ACME_NS: Uuid = Uuid::from_bytes([
    0x00, 0x00, 0x00, 0x00,
    0xac, 0xbe,
    0x50, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01,
]);

pub fn acme_uuid(kind: &str, key: &str) -> Uuid {
    Uuid::new_v5(&ACME_NS, format!("{}:{}", kind, key).as_bytes())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_deterministic() {
        let a = acme_uuid("user", "marie.dupont");
        let b = acme_uuid("user", "marie.dupont");
        assert_eq!(a, b);
    }

    #[test]
    fn test_different_keys_different_uuids() {
        let a = acme_uuid("user", "marie.dupont");
        let b = acme_uuid("user", "jean.martin");
        assert_ne!(a, b);
    }

    #[test]
    fn test_different_kinds_different_uuids() {
        let a = acme_uuid("user", "marie.dupont");
        let b = acme_uuid("contact", "marie.dupont");
        assert_ne!(a, b);
    }
}
```

- [ ] **Step 4 : Main CLI**

```rust
// services/signapps-seed/src/main.rs
use clap::Parser;
use signapps_seed::{run_seed, SeedArgs};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();
    let args = SeedArgs::parse();
    run_seed(args).await
}
```

```rust
// services/signapps-seed/src/lib.rs
pub mod context;
pub mod seeder;
pub mod seeders;
pub mod uuid;

use clap::Parser;
use context::SeedContext;
use seeder::Seeder;
use std::sync::{Arc, Mutex};
use std::collections::HashMap;

#[derive(Parser, Debug)]
#[command(name = "signapps-seed", about = "Seed SignApps demo data (Acme Corp)")]
pub struct SeedArgs {
    #[arg(long, env = "DATABASE_URL")]
    pub database_url: String,
    #[arg(long)]
    pub force: bool,
    #[arg(long, alias = "reset")]
    pub reset: bool,
    #[arg(long, alias = "dry-run")]
    pub dry_run: bool,
    #[arg(long)]
    pub only: Option<String>,
}

pub async fn run_seed(args: SeedArgs) -> anyhow::Result<()> {
    // Safety check : refuse non-localhost without override
    if !args.database_url.contains("localhost") && !args.database_url.contains("127.0.0.1") {
        if std::env::var("SEED_ALLOW_PROD").ok().as_deref() != Some("1") {
            anyhow::bail!("Refusing to seed non-local DB. Set SEED_ALLOW_PROD=1 to override.");
        }
    }

    let pool = signapps_db::create_pool(&args.database_url).await?;

    if args.reset {
        tracing::warn!("--reset: dropping Acme Corp data");
        reset_acme_data(&pool).await?;
    }

    let tenant_id = uuid::acme_uuid("tenant", "acme-corp");
    let ctx = SeedContext {
        db: pool.clone(),
        tenant_id,
        force: args.force,
        dry_run: args.dry_run,
        users: Arc::new(Mutex::new(HashMap::new())),
        nodes: Arc::new(Mutex::new(HashMap::new())),
    };

    let seeders: Vec<Box<dyn Seeder>> = seeders::all();
    for s in seeders {
        if let Some(only) = &args.only {
            if s.name() != *only { continue; }
        }
        tracing::info!("→ Running seeder: {}", s.name());
        let report = s.run(&ctx).await?;
        tracing::info!(
            "  ✓ {}: created={}, skipped={}, errors={}",
            s.name(), report.created, report.skipped, report.errors.len()
        );
    }

    Ok(())
}

async fn reset_acme_data(pool: &signapps_db::DatabasePool) -> anyhow::Result<()> {
    let tenant_id = uuid::acme_uuid("tenant", "acme-corp");
    // Cascade-delete starting from tenant
    sqlx::query("DELETE FROM identity.users WHERE tenant_id = $1 AND username != 'admin'")
        .bind(tenant_id).execute(pool.inner()).await?;
    sqlx::query("DELETE FROM org.org_nodes WHERE tenant_id = $1").bind(tenant_id).execute(pool.inner()).await?;
    // TODO : autres tables quand les seeders sont impl
    Ok(())
}
```

```rust
// services/signapps-seed/src/seeders/mod.rs
use crate::seeder::Seeder;

pub mod org;
pub mod identity;

pub fn all() -> Vec<Box<dyn Seeder>> {
    vec![
        Box::new(org::OrgSeeder),
        Box::new(identity::IdentitySeeder),
        // ... ajouter au fur et à mesure
    ]
}
```

- [ ] **Step 5 : Tests uuid**

Run : `rtk cargo test -p signapps-seed uuid::tests`
Expected : 3 PASS

- [ ] **Step 6 : Commit**

```bash
rtk git add services/signapps-seed Cargo.toml
rtk git commit -m "feat(seed): scaffolding signapps-seed crate (CLI + trait + context + deterministic uuid)"
```

---

### Task 14 : Seeders org + identity + ad

**Files :**
- Create : `services/signapps-seed/src/seeders/org.rs`
- Create : `services/signapps-seed/src/seeders/identity.rs`
- Create : `services/signapps-seed/src/seeders/ad.rs`

- [ ] **Step 1 : OrgSeeder — 4 OUs + 15 personnes**

```rust
// services/signapps-seed/src/seeders/org.rs
use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::uuid::acme_uuid;
use async_trait::async_trait;

pub struct OrgSeeder;

#[async_trait]
impl Seeder for OrgSeeder {
    fn name(&self) -> &'static str { "org" }

    async fn run(&self, ctx: &SeedContext) -> anyhow::Result<SeedReport> {
        let mut report = SeedReport::default();
        let root_id = acme_uuid("org-node", "acme-corp");
        ctx.register_node("root", root_id);

        // Root node
        sqlx::query(r#"
            INSERT INTO org.org_nodes (id, tenant_id, parent_id, slug, name, node_type, path)
            VALUES ($1, $2, NULL, 'acme-corp', 'Acme Corp', 'company', 'acme_corp'::ltree)
            ON CONFLICT (id) DO NOTHING
        "#).bind(root_id).bind(ctx.tenant_id).execute(ctx.db.inner()).await?;
        report.created += 1;

        // 4 OUs
        let ous = [
            ("direction", "Direction", "direction"),
            ("engineering", "Engineering", "engineering"),
            ("sales", "Sales", "sales"),
            ("support", "Support", "support"),
        ];

        for (slug, name, path_seg) in ous.iter() {
            let id = acme_uuid("org-node", slug);
            ctx.register_node(slug, id);
            sqlx::query(r#"
                INSERT INTO org.org_nodes (id, tenant_id, parent_id, slug, name, node_type, path)
                VALUES ($1, $2, $3, $4, $5, 'department', ('acme_corp.' || $6)::ltree)
                ON CONFLICT (id) DO NOTHING
            "#).bind(id).bind(ctx.tenant_id).bind(root_id).bind(slug).bind(name).bind(path_seg)
               .execute(ctx.db.inner()).await?;
            report.created += 1;
        }

        // 15 persons distributed (3 Direction, 6 Engineering, 4 Sales, 2 Support)
        let persons = [
            ("marie.dupont", "Marie Dupont", "marie.dupont@acme.corp", "direction", "Directrice générale"),
            ("paul.durand", "Paul Durand", "paul.durand@acme.corp", "direction", "DAF"),
            ("claire.moreau", "Claire Moreau", "claire.moreau@acme.corp", "direction", "DRH"),
            ("jean.martin", "Jean Martin", "jean.martin@acme.corp", "engineering", "CTO"),
            ("sophie.leroy", "Sophie Leroy", "sophie.leroy@acme.corp", "engineering", "Tech Lead"),
            ("thomas.petit", "Thomas Petit", "thomas.petit@acme.corp", "engineering", "Senior Dev"),
            ("emma.rousseau", "Emma Rousseau", "emma.rousseau@acme.corp", "engineering", "Dev"),
            ("lucas.fournier", "Lucas Fournier", "lucas.fournier@acme.corp", "engineering", "Dev"),
            ("julie.bernard", "Julie Bernard", "julie.bernard@acme.corp", "engineering", "DevOps"),
            ("nicolas.robert", "Nicolas Robert", "nicolas.robert@acme.corp", "sales", "Dir. Sales"),
            ("anne.girard", "Anne Girard", "anne.girard@acme.corp", "sales", "Account Manager"),
            ("pierre.lefebvre", "Pierre Lefebvre", "pierre.lefebvre@acme.corp", "sales", "Business Dev"),
            ("camille.mercier", "Camille Mercier", "camille.mercier@acme.corp", "sales", "SDR"),
            ("antoine.bonnet", "Antoine Bonnet", "antoine.bonnet@acme.corp", "support", "Support Lead"),
            ("isabelle.noel", "Isabelle Noel", "isabelle.noel@acme.corp", "support", "Support Agent"),
        ];

        for (username, full_name, email, ou, title) in persons.iter() {
            let person_id = acme_uuid("person", username);
            let node_id = ctx.node(ou).expect("OU registered");
            sqlx::query(r#"
                INSERT INTO org.org_persons (id, tenant_id, primary_node_id, email, full_name, title)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (id) DO NOTHING
            "#).bind(person_id).bind(ctx.tenant_id).bind(node_id).bind(email).bind(full_name).bind(title)
               .execute(ctx.db.inner()).await?;

            sqlx::query(r#"
                INSERT INTO org.org_assignments (person_id, node_id, axis, role, is_primary)
                VALUES ($1, $2, 'hierarchy', 'member', TRUE)
                ON CONFLICT DO NOTHING
            "#).bind(person_id).bind(node_id).execute(ctx.db.inner()).await?;

            ctx.register_user(username, person_id);
            report.created += 1;
        }

        Ok(report)
    }
}
```

- [ ] **Step 2 : IdentitySeeder — users (alignés avec persons)**

```rust
// services/signapps-seed/src/seeders/identity.rs
use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::uuid::acme_uuid;
use argon2::{password_hash::{rand_core::OsRng, PasswordHasher, SaltString}, Argon2};
use async_trait::async_trait;

pub struct IdentitySeeder;

#[async_trait]
impl Seeder for IdentitySeeder {
    fn name(&self) -> &'static str { "identity" }
    fn dependencies(&self) -> Vec<&'static str> { vec!["org"] }

    async fn run(&self, ctx: &SeedContext) -> anyhow::Result<SeedReport> {
        let mut report = SeedReport::default();
        let salt = SaltString::generate(&mut OsRng);
        let hash = Argon2::default().hash_password(b"Demo1234!", &salt)
            .map_err(|e| anyhow::anyhow!("{}", e))?.to_string();

        let usernames = [
            "marie.dupont", "paul.durand", "claire.moreau",
            "jean.martin", "sophie.leroy", "thomas.petit", "emma.rousseau", "lucas.fournier", "julie.bernard",
            "nicolas.robert", "anne.girard", "pierre.lefebvre", "camille.mercier",
            "antoine.bonnet", "isabelle.noel",
        ];

        for username in usernames.iter() {
            let user_id = acme_uuid("user", username);
            let email = format!("{}@acme.corp", username);
            sqlx::query(r#"
                INSERT INTO identity.users (id, tenant_id, username, email, password_hash, role, auth_provider)
                VALUES ($1, $2, $3, $4, $5, 0, 'local')
                ON CONFLICT (id) DO NOTHING
            "#)
            .bind(user_id)
            .bind(ctx.tenant_id)
            .bind(username)
            .bind(&email)
            .bind(&hash)
            .execute(ctx.db.inner()).await?;
            report.created += 1;
        }

        Ok(report)
    }
}
```

- [ ] **Step 3 : AdSeeder — config AD de démo (unbound)**

```rust
// services/signapps-seed/src/seeders/ad.rs
use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use async_trait::async_trait;

pub struct AdSeeder;

#[async_trait]
impl Seeder for AdSeeder {
    fn name(&self) -> &'static str { "ad" }
    fn dependencies(&self) -> Vec<&'static str> { vec!["org"] }

    async fn run(&self, ctx: &SeedContext) -> anyhow::Result<SeedReport> {
        let mut report = SeedReport::default();
        // Insert a demo AD config row — unbound (enabled=false) for safety
        sqlx::query(r#"
            INSERT INTO org.org_ad_config (tenant_id, server_url, bind_dn, base_dn, enabled, sync_direction)
            VALUES ($1, 'ldap://ad.demo.acme.corp:389', 'CN=signapps-svc,OU=services,DC=acme,DC=corp',
                    'DC=acme,DC=corp', FALSE, 'outbound')
            ON CONFLICT (tenant_id) DO NOTHING
        "#).bind(ctx.tenant_id).execute(ctx.db.inner()).await?;
        report.created += 1;
        Ok(report)
    }
}
```

- [ ] **Step 4 : Wire dans mod.rs**

```rust
// services/signapps-seed/src/seeders/mod.rs
pub mod org;
pub mod identity;
pub mod ad;

pub fn all() -> Vec<Box<dyn crate::seeder::Seeder>> {
    vec![
        Box::new(org::OrgSeeder),
        Box::new(identity::IdentitySeeder),
        Box::new(ad::AdSeeder),
    ]
}
```

- [ ] **Step 5 : Test d'intégration**

```rust
// services/signapps-seed/tests/test_org_identity.rs
#[sqlx::test(migrations = "../../migrations")]
async fn test_org_creates_4_ous_and_15_persons(pool: sqlx::PgPool) {
    let db = signapps_db::DatabasePool::new(pool.clone());
    let ctx = signapps_seed::context::SeedContext {
        db, tenant_id: signapps_seed::uuid::acme_uuid("tenant", "acme-corp"),
        force: false, dry_run: false,
        users: std::sync::Arc::new(std::sync::Mutex::new(std::collections::HashMap::new())),
        nodes: std::sync::Arc::new(std::sync::Mutex::new(std::collections::HashMap::new())),
    };
    use signapps_seed::seeder::Seeder;

    signapps_seed::seeders::org::OrgSeeder.run(&ctx).await.unwrap();

    let n: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM org.org_nodes WHERE tenant_id = $1")
        .bind(ctx.tenant_id).fetch_one(&pool).await.unwrap();
    assert_eq!(n, 5); // root + 4 OUs

    let p: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM org.org_persons WHERE tenant_id = $1")
        .bind(ctx.tenant_id).fetch_one(&pool).await.unwrap();
    assert_eq!(p, 15);
}
```

Run : `rtk cargo test -p signapps-seed --test test_org_identity`
Expected : PASS

- [ ] **Step 6 : Commit**

```bash
rtk git add services/signapps-seed/src/seeders services/signapps-seed/tests
rtk git commit -m "feat(seed): OrgSeeder (4 OUs + 15 persons) + IdentitySeeder + AdSeeder (unbound demo)"
```

---

### Task 15 : Seeders calendar + mail + chat

**Files :**
- Create : `services/signapps-seed/src/seeders/calendar.rs`
- Create : `services/signapps-seed/src/seeders/mail.rs`
- Create : `services/signapps-seed/src/seeders/chat.rs`

- [ ] **Step 1 : CalendarSeeder — 4 calendriers + 20 events semaine**

```rust
// services/signapps-seed/src/seeders/calendar.rs
use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::uuid::acme_uuid;
use async_trait::async_trait;
use chrono::{Datelike, Duration, Utc, Weekday};

pub struct CalendarSeeder;

fn week_date(offset_days: i64, hour: u32) -> chrono::DateTime<Utc> {
    let today = Utc::now().date_naive();
    let monday = today - Duration::days(today.weekday().num_days_from_monday() as i64);
    let d = monday + Duration::days(offset_days);
    d.and_hms_opt(hour, 0, 0).unwrap().and_local_timezone(Utc).unwrap()
}

#[async_trait]
impl Seeder for CalendarSeeder {
    fn name(&self) -> &'static str { "calendar" }
    fn dependencies(&self) -> Vec<&'static str> { vec!["org", "identity"] }

    async fn run(&self, ctx: &SeedContext) -> anyhow::Result<SeedReport> {
        let mut report = SeedReport::default();

        // 1 calendrier par OU
        let cals = [
            ("direction", "Calendrier Direction", "#4285f4"),
            ("engineering", "Calendrier Engineering", "#0b8043"),
            ("sales", "Calendrier Sales", "#f4511e"),
            ("support", "Calendrier Support", "#8e24aa"),
        ];
        for (ou, name, color) in cals.iter() {
            let cal_id = acme_uuid("calendar", ou);
            let owner = ctx.node(ou).unwrap();
            sqlx::query(r#"
                INSERT INTO calendar.calendars (id, tenant_id, name, color, owner_user_id)
                VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING
            "#).bind(cal_id).bind(ctx.tenant_id).bind(name).bind(color).bind(owner)
               .execute(ctx.db.inner()).await?;
            report.created += 1;
        }

        // 20 events réparties (5 par jour Mon–Fri, 4 OUs)
        let eng_cal = acme_uuid("calendar", "engineering");
        let sales_cal = acme_uuid("calendar", "sales");
        let direction_cal = acme_uuid("calendar", "direction");
        let support_cal = acme_uuid("calendar", "support");

        let events = [
            (direction_cal, 0, 9, 10, "Réunion direction hebdo", "Point stratégique"),
            (direction_cal, 2, 14, 15, "Revue budget Q2", "Point finances"),
            (direction_cal, 4, 16, 17, "Board review", "Alignement mensuel"),
            (eng_cal, 0, 10, 11, "Sprint planning", "Planning sprint 14"),
            (eng_cal, 0, 14, 15, "Code review", "Review PRs ouvertes"),
            (eng_cal, 1, 9, 10, "Standup Engineering", "Daily"),
            (eng_cal, 1, 11, 12, "Architecture review", "Décision SSO"),
            (eng_cal, 2, 10, 11, "Pair programming", "Module auth"),
            (eng_cal, 3, 14, 16, "Formation IA", "RAG + OCR SignApps"),
            (eng_cal, 4, 15, 16, "Sprint retro", "Retro sprint 14"),
            (sales_cal, 0, 11, 12, "Pipeline review", "Stage deals"),
            (sales_cal, 1, 14, 15, "Client ACME Industries", "Démo produit"),
            (sales_cal, 2, 10, 11, "Call prospect", "Qualif Durand"),
            (sales_cal, 3, 16, 17, "Forecast meeting", "Q2 commit"),
            (sales_cal, 4, 9, 10, "Team sales", "Partage deals"),
            (support_cal, 0, 14, 15, "Tickets triage", "Backlog review"),
            (support_cal, 2, 11, 12, "Post-mortem incident", "Incident prod 04/17"),
            (support_cal, 4, 10, 11, "KB update", "Nouveaux articles"),
            (eng_cal, 2, 16, 17, "Demo interne", "Feature PXE live"),
            (direction_cal, 1, 15, 16, "RH one-on-one", "Entretiens"),
        ];

        for (i, (cal_id, day_offset, sh, eh, title, desc)) in events.iter().enumerate() {
            let ev_id = acme_uuid("event", &format!("e{}", i));
            sqlx::query(r#"
                INSERT INTO calendar.events (id, calendar_id, title, description, start_time, end_time, timezone)
                VALUES ($1, $2, $3, $4, $5, $6, 'Europe/Paris')
                ON CONFLICT (id) DO NOTHING
            "#).bind(ev_id).bind(cal_id).bind(title).bind(desc)
               .bind(week_date(*day_offset, *sh)).bind(week_date(*day_offset, *eh))
               .execute(ctx.db.inner()).await?;
            report.created += 1;
        }

        Ok(report)
    }
}
```

- [ ] **Step 2 : MailSeeder — 30 mails**

```rust
// services/signapps-seed/src/seeders/mail.rs
use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::uuid::acme_uuid;
use async_trait::async_trait;
use chrono::{Duration, Utc};

pub struct MailSeeder;

#[async_trait]
impl Seeder for MailSeeder {
    fn name(&self) -> &'static str { "mail" }
    fn dependencies(&self) -> Vec<&'static str> { vec!["org", "identity"] }

    async fn run(&self, ctx: &SeedContext) -> anyhow::Result<SeedReport> {
        let mut report = SeedReport::default();
        let from = ctx.user("marie.dupont").unwrap();
        let to_list = ["jean.martin", "paul.durand", "nicolas.robert", "claire.moreau", "sophie.leroy"];

        for i in 0..30 {
            let to_user = to_list[i % to_list.len()];
            let to_id = ctx.user(to_user).unwrap();
            let mail_id = acme_uuid("mail", &format!("m{}", i));
            let sent_at = Utc::now() - Duration::hours((i * 2) as i64);

            sqlx::query(r#"
                INSERT INTO mail.messages (id, tenant_id, from_user_id, to_user_id, subject, body, sent_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (id) DO NOTHING
            "#)
            .bind(mail_id).bind(ctx.tenant_id).bind(from).bind(to_id)
            .bind(format!("[Démo] Point projet #{}", i + 1))
            .bind(format!("Bonjour,\n\nCeci est un mail de démo #{}.\n\nCordialement,\nMarie", i + 1))
            .bind(sent_at)
            .execute(ctx.db.inner()).await?;
            report.created += 1;
        }
        Ok(report)
    }
}
```

- [ ] **Step 3 : ChatSeeder — 5 channels + 40 messages**

```rust
// services/signapps-seed/src/seeders/chat.rs
use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::uuid::acme_uuid;
use async_trait::async_trait;
use chrono::{Duration, Utc};

pub struct ChatSeeder;

#[async_trait]
impl Seeder for ChatSeeder {
    fn name(&self) -> &'static str { "chat" }
    fn dependencies(&self) -> Vec<&'static str> { vec!["org", "identity"] }

    async fn run(&self, ctx: &SeedContext) -> anyhow::Result<SeedReport> {
        let mut report = SeedReport::default();
        let channels = [
            ("general", "Général"),
            ("engineering", "Engineering"),
            ("sales", "Sales"),
            ("support", "Support"),
            ("random", "Random"),
        ];

        for (slug, name) in channels.iter() {
            let ch_id = acme_uuid("chat-channel", slug);
            sqlx::query(r#"
                INSERT INTO chat.channels (id, tenant_id, name, is_public)
                VALUES ($1, $2, $3, TRUE) ON CONFLICT (id) DO NOTHING
            "#).bind(ch_id).bind(ctx.tenant_id).bind(name).execute(ctx.db.inner()).await?;
            report.created += 1;
        }

        // 40 messages répartis
        let users = ["jean.martin", "sophie.leroy", "marie.dupont", "emma.rousseau"];
        for i in 0..40 {
            let ch_id = acme_uuid("chat-channel", channels[i % 5].0);
            let sender = ctx.user(users[i % users.len()]).unwrap();
            let msg_id = acme_uuid("chat-msg", &format!("msg{}", i));
            let sent = Utc::now() - Duration::minutes((i * 13) as i64);
            sqlx::query(r#"
                INSERT INTO chat.messages (id, channel_id, sender_id, body, sent_at)
                VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING
            "#).bind(msg_id).bind(ch_id).bind(sender)
               .bind(format!("Message démo #{} — vous suivez ?", i))
               .bind(sent).execute(ctx.db.inner()).await?;
            report.created += 1;
        }

        Ok(report)
    }
}
```

- [ ] **Step 4 : Wire dans mod.rs**

```rust
pub mod calendar;
pub mod mail;
pub mod chat;

pub fn all() -> Vec<Box<dyn crate::seeder::Seeder>> {
    vec![
        Box::new(org::OrgSeeder),
        Box::new(identity::IdentitySeeder),
        Box::new(ad::AdSeeder),
        Box::new(calendar::CalendarSeeder),
        Box::new(mail::MailSeeder),
        Box::new(chat::ChatSeeder),
    ]
}
```

- [ ] **Step 5 : Tests**

```rust
// services/signapps-seed/tests/test_cross_service.rs
#[sqlx::test(migrations = "../../migrations")]
async fn test_calendar_mail_chat(pool: sqlx::PgPool) {
    // ... setup ctx, run OrgSeeder + IdentitySeeder first
    // ... run CalendarSeeder, MailSeeder, ChatSeeder
    // assert counts : 4 calendars, 20 events, 30 mails, 5 channels, 40 messages
}
```

Run : `rtk cargo test -p signapps-seed`
Expected : PASS

- [ ] **Step 6 : Commit**

```bash
rtk git add services/signapps-seed/src/seeders services/signapps-seed/tests
rtk git commit -m "feat(seed): Calendar (4 cals + 20 events) + Mail (30 msgs) + Chat (5 channels + 40 msgs)"
```

---

### Task 16 : Seeders docs + drive + forms

**Files :**
- Create : `services/signapps-seed/src/seeders/{docs,drive,forms}.rs`

- [ ] **Step 1 : DocsSeeder — 10 documents Tiptap**

```rust
// services/signapps-seed/src/seeders/docs.rs
use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::uuid::acme_uuid;
use async_trait::async_trait;

pub struct DocsSeeder;

#[async_trait]
impl Seeder for DocsSeeder {
    fn name(&self) -> &'static str { "docs" }
    fn dependencies(&self) -> Vec<&'static str> { vec!["identity"] }

    async fn run(&self, ctx: &SeedContext) -> anyhow::Result<SeedReport> {
        let mut report = SeedReport::default();
        let owner = ctx.user("marie.dupont").unwrap();

        let docs = [
            ("roadmap-q2", "Roadmap Q2", "# Roadmap Q2\n\n- S1 livré\n- S2 PXE + seed\n- S3 tests"),
            ("onboarding", "Guide onboarding", "# Onboarding\n\nBienvenue chez Acme Corp..."),
            ("process-recrutement", "Processus recrutement", "# Recrutement\n\n1. CV → 2. Tech → 3. Culture fit"),
            ("archi-produit", "Architecture produit", "# Architecture\n\nMonorepo Rust + Next.js"),
            ("runbook-prod", "Runbook prod", "# Runbook\n\n## Deploy\n\n1. just ci\n2. just build-release"),
            ("style-guide", "Style guide", "# Style guide\n\n- Rust : clippy strict\n- TS : Biome"),
            ("pitch-deck", "Pitch deck outline", "# Pitch\n\n- Vision\n- Produit\n- Équipe"),
            ("okrs-q2", "OKRs Q2", "# OKRs Q2\n\n## O1 — SaaS launch\n- KR1: 10 clients"),
            ("post-mortem-04-17", "Post-mortem incident 04/17", "# Post-mortem\n\n## TLDR\n\nPanne 2h"),
            ("quarterly-review", "Quarterly review Q1", "# Q1 Review\n\nObjectifs atteints à 87%"),
        ];

        for (slug, title, md) in docs.iter() {
            let doc_id = acme_uuid("doc", slug);
            let body = serde_json::json!({ "type": "doc", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": md }] }] });
            sqlx::query(r#"
                INSERT INTO docs.documents (id, tenant_id, owner_user_id, title, body)
                VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING
            "#).bind(doc_id).bind(ctx.tenant_id).bind(owner).bind(title).bind(body)
               .execute(ctx.db.inner()).await?;
            report.created += 1;
        }
        Ok(report)
    }
}
```

- [ ] **Step 2 : DriveSeeder — 3 buckets + 15 fichiers**

```rust
// services/signapps-seed/src/seeders/drive.rs
use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::uuid::acme_uuid;
use async_trait::async_trait;

pub struct DriveSeeder;

#[async_trait]
impl Seeder for DriveSeeder {
    fn name(&self) -> &'static str { "drive" }
    fn dependencies(&self) -> Vec<&'static str> { vec!["org"] }

    async fn run(&self, ctx: &SeedContext) -> anyhow::Result<SeedReport> {
        let mut report = SeedReport::default();
        let buckets = ["documents", "presentations", "archives"];
        for b in buckets.iter() {
            sqlx::query(r#"
                INSERT INTO storage.buckets (tenant_id, name)
                VALUES ($1, $2) ON CONFLICT DO NOTHING
            "#).bind(ctx.tenant_id).bind(b).execute(ctx.db.inner()).await?;
            report.created += 1;
        }

        let files = [
            ("documents", "Budget-Q2.xlsx", 45000, "application/vnd.ms-excel"),
            ("documents", "Rapport-Mensuel.pdf", 120000, "application/pdf"),
            ("documents", "Contrat-ACME.pdf", 230000, "application/pdf"),
            ("documents", "Factures-Fournisseurs.zip", 5_000_000, "application/zip"),
            ("documents", "Politique-RH.docx", 65000, "application/msword"),
            ("presentations", "Pitch-Investisseurs.pptx", 2_500_000, "application/vnd.ms-powerpoint"),
            ("presentations", "Demo-Produit.pptx", 8_000_000, "application/vnd.ms-powerpoint"),
            ("presentations", "Formation-IA.pdf", 1_200_000, "application/pdf"),
            ("presentations", "Kickoff-Q2.pdf", 450000, "application/pdf"),
            ("presentations", "Architecture-Diagram.png", 300000, "image/png"),
            ("archives", "Legacy-Code-2024.tar.gz", 50_000_000, "application/gzip"),
            ("archives", "DB-Backup-2026-01.sql.gz", 15_000_000, "application/gzip"),
            ("archives", "Contract-2024-All.zip", 8_000_000, "application/zip"),
            ("archives", "Logs-2024-Q4.tar.gz", 20_000_000, "application/gzip"),
            ("archives", "Photo-Team-2024.jpg", 4_000_000, "image/jpeg"),
        ];

        for (i, (bucket, name, size, mime)) in files.iter().enumerate() {
            let file_id = acme_uuid("file", &format!("{}-{}", bucket, i));
            sqlx::query(r#"
                INSERT INTO storage.files (id, tenant_id, bucket_name, object_key, filename, size_bytes, mime_type)
                VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING
            "#)
            .bind(file_id).bind(ctx.tenant_id).bind(bucket)
            .bind(format!("demo/{}", name)).bind(name).bind(*size as i64).bind(mime)
            .execute(ctx.db.inner()).await?;
            report.created += 1;
        }
        Ok(report)
    }
}
```

- [ ] **Step 3 : FormsSeeder — 5 formulaires**

```rust
// services/signapps-seed/src/seeders/forms.rs
use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::uuid::acme_uuid;
use async_trait::async_trait;

pub struct FormsSeeder;

#[async_trait]
impl Seeder for FormsSeeder {
    fn name(&self) -> &'static str { "forms" }
    fn dependencies(&self) -> Vec<&'static str> { vec!["identity"] }

    async fn run(&self, ctx: &SeedContext) -> anyhow::Result<SeedReport> {
        let mut report = SeedReport::default();
        let owner = ctx.user("claire.moreau").unwrap();

        let forms = [
            ("candidature", "Candidature spontanée", true, r#"[{"type":"text","label":"Nom"},{"type":"email","label":"Email"},{"type":"file","label":"CV"}]"#),
            ("satisfaction-client", "Satisfaction client", true, r#"[{"type":"rating","label":"Note"},{"type":"textarea","label":"Commentaire"}]"#),
            ("demo-request", "Demande de démo", true, r#"[{"type":"text","label":"Société"},{"type":"email","label":"Email pro"}]"#),
            ("conge-exceptionnel", "Demande congé exceptionnel", false, r#"[{"type":"date","label":"Début"},{"type":"date","label":"Fin"},{"type":"textarea","label":"Motif"}]"#),
            ("note-de-frais", "Note de frais", false, r#"[{"type":"number","label":"Montant"},{"type":"file","label":"Justificatif"}]"#),
        ];

        for (slug, title, public, schema) in forms.iter() {
            let form_id = acme_uuid("form", slug);
            sqlx::query(r#"
                INSERT INTO forms.forms (id, tenant_id, owner_user_id, title, is_public, schema)
                VALUES ($1, $2, $3, $4, $5, $6::jsonb) ON CONFLICT (id) DO NOTHING
            "#).bind(form_id).bind(ctx.tenant_id).bind(owner).bind(title).bind(public).bind(schema)
               .execute(ctx.db.inner()).await?;
            report.created += 1;
        }
        Ok(report)
    }
}
```

- [ ] **Step 4 : Wire + commit**

Ajouter dans `mod.rs` :
```rust
pub mod docs; pub mod drive; pub mod forms;
// dans all() :
Box::new(docs::DocsSeeder),
Box::new(drive::DriveSeeder),
Box::new(forms::FormsSeeder),
```

Run : `rtk cargo build -p signapps-seed`
Expected : OK

```bash
rtk git add services/signapps-seed/src/seeders
rtk git commit -m "feat(seed): Docs (10 docs) + Drive (3 buckets + 15 files) + Forms (5 forms)"
```

---

### Task 17 : Seeders contacts + meet + tasks + it_assets + vault

**Files :**
- Create : `services/signapps-seed/src/seeders/{contacts,meet,tasks,it_assets,vault}.rs`

- [ ] **Step 1 : 5 seeders combinés (chaque ~30 lignes)**

```rust
// services/signapps-seed/src/seeders/contacts.rs
use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::uuid::acme_uuid;
use async_trait::async_trait;

pub struct ContactsSeeder;

#[async_trait]
impl Seeder for ContactsSeeder {
    fn name(&self) -> &'static str { "contacts" }

    async fn run(&self, ctx: &SeedContext) -> anyhow::Result<SeedReport> {
        let mut report = SeedReport::default();
        let contacts = [
            ("Sophie Lefevre", "sophie@acme-clients.fr", "+33611223344", "ACME Clients", "Dir Marketing"),
            ("Thomas Bernard", "thomas@techcorp.fr", "+33612345678", "TechCorp", "Dev Senior"),
            ("Isabelle Moreau", "isabelle@durand.fr", "+33613456789", "Durand SA", "Avocate"),
            ("Nicolas Petit", "nicolas@innovatech.fr", "+33614567890", "InnovaTech", "Chef Projet"),
            ("Camille Roux", "camille@mediaplus.fr", "+33615678901", "MediaPlus", "Comm"),
            ("Antoine Dubois", "antoine@construire.fr", "+33616789012", "Construire", "Architecte"),
            ("Emilie Laurent", "emilie@santeplus.fr", "+33617890123", "SantéPlus", "Médecin"),
            ("Pierre Girard", "pierre@logisys.fr", "+33618901234", "LogiSys", "Admin Sys"),
            ("Julie Bonnet", "julie@creativ.fr", "+33619012345", "Creativ", "Designer"),
            ("Francois Lemaire", "francois@financegroup.fr", "+33620123456", "FinanceGroup", "Analyste"),
        ];
        for (i, (name, email, phone, company, title)) in contacts.iter().enumerate() {
            let cid = acme_uuid("contact", &format!("c{}", i));
            sqlx::query(r#"
                INSERT INTO contacts.contacts (id, tenant_id, display_name, email, phone, company, job_title)
                VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING
            "#).bind(cid).bind(ctx.tenant_id).bind(name).bind(email).bind(phone).bind(company).bind(title)
               .execute(ctx.db.inner()).await?;
            report.created += 1;
        }
        Ok(report)
    }
}
```

```rust
// services/signapps-seed/src/seeders/meet.rs
use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::uuid::acme_uuid;
use async_trait::async_trait;

pub struct MeetSeeder;

#[async_trait]
impl Seeder for MeetSeeder {
    fn name(&self) -> &'static str { "meet" }
    fn dependencies(&self) -> Vec<&'static str> { vec!["identity"] }

    async fn run(&self, ctx: &SeedContext) -> anyhow::Result<SeedReport> {
        let mut report = SeedReport::default();
        let owner = ctx.user("marie.dupont").unwrap();
        let rooms = [
            ("direction-weekly", "Direction Weekly", false),
            ("engineering-standup", "Engineering Standup", false),
            ("all-hands", "All Hands (public)", true),
            ("client-calls", "Client Calls", false),
        ];
        for (slug, name, public) in rooms.iter() {
            let rid = acme_uuid("meet-room", slug);
            sqlx::query(r#"
                INSERT INTO meet.rooms (id, tenant_id, owner_user_id, name, is_public)
                VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING
            "#).bind(rid).bind(ctx.tenant_id).bind(owner).bind(name).bind(public)
               .execute(ctx.db.inner()).await?;
            report.created += 1;
        }
        Ok(report)
    }
}
```

```rust
// services/signapps-seed/src/seeders/tasks.rs (12 tasks répartis sur 3 boards — utilise time_items)
use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::uuid::acme_uuid;
use async_trait::async_trait;

pub struct TasksSeeder;

#[async_trait]
impl Seeder for TasksSeeder {
    fn name(&self) -> &'static str { "tasks" }
    fn dependencies(&self) -> Vec<&'static str> { vec!["identity"] }

    async fn run(&self, ctx: &SeedContext) -> anyhow::Result<SeedReport> {
        let mut report = SeedReport::default();
        let owner = ctx.user("jean.martin").unwrap();

        let tasks = [
            ("Setup CI pipeline", "todo", 3),
            ("Refactor auth module", "in_progress", 2),
            ("Write API docs", "done", 4),
            ("Fix bug #1234", "todo", 2),
            ("Deploy staging", "in_progress", 1),
            ("Benchmark DB queries", "todo", 3),
            ("Onboard new dev", "done", 2),
            ("Review PR #456", "in_progress", 1),
            ("Plan S3 sprint", "todo", 3),
            ("Write postmortem", "done", 2),
            ("Update dependencies", "todo", 2),
            ("Client demo prep", "in_progress", 1),
        ];
        for (i, (title, status, priority)) in tasks.iter().enumerate() {
            let tid = acme_uuid("task", &format!("t{}", i));
            sqlx::query(r#"
                INSERT INTO calendar.time_items (id, tenant_id, owner_user_id, kind, title, status, priority)
                VALUES ($1, $2, $3, 'task', $4, $5, $6) ON CONFLICT (id) DO NOTHING
            "#).bind(tid).bind(ctx.tenant_id).bind(owner).bind(title).bind(status).bind(*priority as i16)
               .execute(ctx.db.inner()).await?;
            report.created += 1;
        }
        Ok(report)
    }
}
```

```rust
// services/signapps-seed/src/seeders/it_assets.rs (20 assets)
use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::uuid::acme_uuid;
use async_trait::async_trait;

pub struct ItAssetsSeeder;

#[async_trait]
impl Seeder for ItAssetsSeeder {
    fn name(&self) -> &'static str { "it-assets" }
    fn dependencies(&self) -> Vec<&'static str> { vec!["identity"] }

    async fn run(&self, ctx: &SeedContext) -> anyhow::Result<SeedReport> {
        let mut report = SeedReport::default();
        let owners = [
            "marie.dupont", "paul.durand", "jean.martin", "sophie.leroy",
            "thomas.petit", "emma.rousseau", "lucas.fournier", "julie.bernard",
            "nicolas.robert", "anne.girard"
        ];
        let types = [
            ("laptop", "MacBook Pro 14 M3"), ("laptop", "Dell XPS 15"),
            ("monitor", "Dell U2723QE 27"), ("phone", "iPhone 15"),
            ("tablet", "iPad Air"), ("desktop", "Mac Studio"),
        ];
        for i in 0..20 {
            let aid = acme_uuid("it-asset", &format!("a{}", i));
            let (typ, model) = &types[i % types.len()];
            let owner_user = ctx.user(owners[i % owners.len()]).unwrap();
            sqlx::query(r#"
                INSERT INTO it_assets.assets (id, tenant_id, asset_type, model, serial_number, assigned_to)
                VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING
            "#).bind(aid).bind(ctx.tenant_id).bind(typ).bind(model)
               .bind(format!("SN-{:06}", i * 37 + 1000)).bind(owner_user)
               .execute(ctx.db.inner()).await?;
            report.created += 1;
        }
        Ok(report)
    }
}
```

```rust
// services/signapps-seed/src/seeders/vault.rs (8 secrets)
use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::uuid::acme_uuid;
use async_trait::async_trait;

pub struct VaultSeeder;

#[async_trait]
impl Seeder for VaultSeeder {
    fn name(&self) -> &'static str { "vault" }
    fn dependencies(&self) -> Vec<&'static str> { vec!["identity"] }

    async fn run(&self, ctx: &SeedContext) -> anyhow::Result<SeedReport> {
        let mut report = SeedReport::default();
        let owner = ctx.user("paul.durand").unwrap();
        let secrets = [
            ("GitHub Deploy Token", "github-deploy"),
            ("AWS Access Key", "aws-prod"),
            ("SMTP Relay Password", "smtp-mailjet"),
            ("API Stripe Test", "stripe-test"),
            ("API Stripe Live", "stripe-live"),
            ("DB Prod Read-only", "db-prod-ro"),
            ("Internal CA Cert", "ca-cert"),
            ("Admin Bastion SSH", "ssh-bastion"),
        ];
        for (i, (name, key)) in secrets.iter().enumerate() {
            let sid = acme_uuid("vault-secret", key);
            sqlx::query(r#"
                INSERT INTO vault.secrets (id, tenant_id, owner_user_id, name, encrypted_value)
                VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING
            "#).bind(sid).bind(ctx.tenant_id).bind(owner).bind(name)
               .bind(format!("enc-placeholder-{}", i))
               .execute(ctx.db.inner()).await?;
            report.created += 1;
        }
        Ok(report)
    }
}
```

- [ ] **Step 2 : Wire + run**

```rust
// mod.rs
pub mod contacts; pub mod meet; pub mod tasks; pub mod it_assets; pub mod vault;
```

Run : `rtk cargo build -p signapps-seed`
Expected : OK. Si colonnes/tables diffèrent, adapter au schéma réel.

- [ ] **Step 3 : Commit**

```bash
rtk git add services/signapps-seed/src/seeders
rtk git commit -m "feat(seed): Contacts (10) + Meet (4 rooms) + Tasks (12) + IT assets (20) + Vault (8 secrets)"
```

---

### Task 18 : Seeder PXE (5 profiles + 3 assets enrôlés)

**Files :**
- Create : `services/signapps-seed/src/seeders/pxe.rs`

- [ ] **Step 1 : PxeSeeder**

```rust
// services/signapps-seed/src/seeders/pxe.rs
use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::uuid::acme_uuid;
use async_trait::async_trait;

pub struct PxeSeeder;

#[async_trait]
impl Seeder for PxeSeeder {
    fn name(&self) -> &'static str { "pxe" }
    fn dependencies(&self) -> Vec<&'static str> { vec!["identity"] }

    async fn run(&self, ctx: &SeedContext) -> anyhow::Result<SeedReport> {
        let mut report = SeedReport::default();

        let profiles = [
            ("ubuntu-24.04-server", "Ubuntu Server 24.04", "linux", "24.04",
             "#!ipxe\nkernel http://{{tftp}}/ubuntu-24.04/vmlinuz\ninitrd http://{{tftp}}/ubuntu-24.04/initrd\nboot"),
            ("debian-12", "Debian 12 Bookworm", "linux", "12",
             "#!ipxe\nkernel http://{{tftp}}/debian-12/linux\ninitrd http://{{tftp}}/debian-12/initrd.gz\nboot"),
            ("windows-pe-11", "Windows PE 11", "windows", "11",
             "#!ipxe\nkernel http://{{tftp}}/winpe/wimboot\ninitrd http://{{tftp}}/winpe/boot.wim\nboot"),
            ("clonezilla", "Clonezilla Live", "linux", "3.1",
             "#!ipxe\nkernel http://{{tftp}}/clonezilla/vmlinuz boot=live\ninitrd http://{{tftp}}/clonezilla/initrd.img\nboot"),
            ("memtest86", "Memtest86+", "tool", "7.0",
             "#!ipxe\nkernel http://{{tftp}}/memtest/mt86plus\nboot"),
        ];

        for (slug, name, os_type, os_version, script) in profiles.iter() {
            let pid = acme_uuid("pxe-profile", slug);
            sqlx::query(r#"
                INSERT INTO pxe.profiles (id, name, description, boot_script, os_type, os_version)
                VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING
            "#).bind(pid).bind(name).bind(format!("Profile démo {}", name))
               .bind(script).bind(os_type).bind(os_version)
               .execute(ctx.db.inner()).await?;
            report.created += 1;
        }

        // 3 assets enrôlés (MAC simulés, liés à des users)
        let assets = [
            ("aa:bb:cc:00:00:01", "poste-jean", "jean.martin", "ubuntu-24.04-server"),
            ("aa:bb:cc:00:00:02", "laptop-marie", "marie.dupont", "windows-pe-11"),
            ("aa:bb:cc:00:00:03", "devbox-sophie", "sophie.leroy", "ubuntu-24.04-server"),
        ];
        for (mac, hostname, user, profile_slug) in assets.iter() {
            let user_id = ctx.user(user).unwrap();
            let profile_id = acme_uuid("pxe-profile", profile_slug);
            sqlx::query(r#"
                INSERT INTO pxe.assets (mac_address, hostname, status, profile_id, assigned_user_id, discovered_via)
                VALUES ($1, $2, 'enrolled', $3, $4, 'import') ON CONFLICT (mac_address) DO NOTHING
            "#).bind(mac).bind(hostname).bind(profile_id).bind(user_id)
               .execute(ctx.db.inner()).await?;
            report.created += 1;
        }
        Ok(report)
    }
}
```

- [ ] **Step 2 : Wire + test**

```rust
// mod.rs : Box::new(pxe::PxeSeeder),
```

Run : `rtk cargo test -p signapps-seed`
Expected : OK

- [ ] **Step 3 : Commit**

```bash
rtk git add services/signapps-seed/src/seeders/pxe.rs services/signapps-seed/src/seeders/mod.rs
rtk git commit -m "feat(seed): PxeSeeder (5 profiles + 3 assets enrôlés)"
```

---

### Task 19 : CLI + just + test idempotence

**Files :**
- Modify : `justfile`
- Create : `services/signapps-seed/tests/test_idempotent.rs`
- Create : `services/signapps-seed/README.md`

- [ ] **Step 1 : Ajouter recettes just**

```make
# À ajouter au justfile
# ─── Seeding démo ────────────────────────────────────────
db-seed:
    cargo run --bin signapps-seed --release

db-seed-reset:
    cargo run --bin signapps-seed --release -- --reset

db-seed-dry:
    cargo run --bin signapps-seed --release -- --dry-run

db-seed-only SERVICE:
    cargo run --bin signapps-seed --release -- --only {{SERVICE}}
```

- [ ] **Step 2 : Test idempotence**

```rust
// services/signapps-seed/tests/test_idempotent.rs
use signapps_seed::{run_seed, SeedArgs};

#[sqlx::test(migrations = "../../migrations")]
async fn test_full_seed_idempotent(pool: sqlx::PgPool) {
    let db_url = std::env::var("DATABASE_URL").unwrap();

    let args1 = SeedArgs {
        database_url: db_url.clone(),
        force: false, reset: false, dry_run: false, only: None,
    };
    run_seed(args1).await.unwrap();

    let count1: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM org.org_nodes")
        .fetch_one(&pool).await.unwrap();
    let persons1: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM org.org_persons")
        .fetch_one(&pool).await.unwrap();
    assert_eq!(count1, 5); // root + 4 OUs
    assert_eq!(persons1, 15);

    // Re-run
    let args2 = SeedArgs {
        database_url: db_url,
        force: false, reset: false, dry_run: false, only: None,
    };
    run_seed(args2).await.unwrap();

    let count2: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM org.org_nodes")
        .fetch_one(&pool).await.unwrap();
    let persons2: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM org.org_persons")
        .fetch_one(&pool).await.unwrap();
    assert_eq!(count2, count1); // No new rows
    assert_eq!(persons2, persons1);
}
```

- [ ] **Step 3 : README**

```md
# signapps-seed

Binary Rust qui peuple une instance SignApps avec des données démo "Acme Corp" cohérentes cross-services.

## Usage

```bash
# Seed complet
just db-seed

# Reset + reseed
just db-seed-reset

# Dry run
just db-seed-dry

# Seed partiel (un service)
just db-seed-only calendar
```

## Contenu

| Service | Items |
|---------|-------|
| Org | 1 tenant + 4 OUs + 15 persons + 4 assignments |
| Identity | 15 users (pwd = Demo1234!) |
| AD | 1 config démo (unbound) |
| Calendar | 4 calendriers + 20 events |
| Mail | 30 messages |
| Chat | 5 channels + 40 messages |
| Docs | 10 documents |
| Drive | 3 buckets + 15 fichiers |
| Forms | 5 formulaires |
| Contacts | 10 contacts externes |
| Meet | 4 salles |
| Tasks | 12 tâches |
| IT Assets | 20 assets |
| Vault | 8 secrets |
| PXE | 5 profiles + 3 assets enrôlés |

## Sécurité

- Refuse si DATABASE_URL ≠ localhost sans `SEED_ALLOW_PROD=1`
- UUIDs namespace v5 → déterministes et reproductibles
- Idempotent : re-run = 0 nouvelle création
```

- [ ] **Step 4 : Run full seed test**

Run : `rtk cargo test -p signapps-seed --test test_idempotent`
Expected : PASS en < 10s

Run : `rtk just db-seed`
Expected : Toutes tables peuplées, sortie "created=N, skipped=0".

Run : `rtk just db-seed` (2e fois)
Expected : "created=0, skipped=N".

- [ ] **Step 5 : Supprimer ancien script bash**

```bash
rm scripts/seed-demo-data.sh
```

- [ ] **Step 6 : Commit**

```bash
rtk git add justfile services/signapps-seed/README.md services/signapps-seed/tests/test_idempotent.rs
rtk git rm scripts/seed-demo-data.sh
rtk git commit -m "feat(seed): just recipes + idempotent test + README + remove legacy bash script"
```

---

### Task 20 : E2E Playwright seeding

**Files :**
- Create : `client/e2e/s2-seeding.spec.ts`

- [ ] **Step 1 : Scénario E2E complet**

```ts
// client/e2e/s2-seeding.spec.ts
import { test, expect } from '@playwright/test';

test.describe('S2 — Seeding démo cohérent', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login?auto=admin');
    await expect(page).toHaveURL(/\/(dashboard|home|$)/);
  });

  test('S2-SEED-1: pages peuplées après seed (Acme Corp)', async ({ page }) => {
    // Calendar
    await page.goto('/calendar');
    await expect(page.locator('text=Réunion direction hebdo').first()).toBeVisible({ timeout: 10_000 });

    // Mail
    await page.goto('/mail');
    await expect(page.locator('text=[Démo] Point projet').first()).toBeVisible();

    // Chat
    await page.goto('/chat');
    await expect(page.locator('text=Général').first()).toBeVisible();
    await expect(page.locator('text=Engineering').first()).toBeVisible();

    // Docs
    await page.goto('/docs');
    await expect(page.locator('text=Roadmap Q2').first()).toBeVisible();

    // Drive
    await page.goto('/drive');
    await expect(page.locator('text=Budget-Q2.xlsx').first()).toBeVisible();

    // Org
    await page.goto('/org');
    await expect(page.locator('text=Acme Corp').first()).toBeVisible();
    await expect(page.locator('text=Engineering').first()).toBeVisible();
    await expect(page.locator('text=Marie Dupont').first()).toBeVisible();

    // PXE
    await page.goto('/pxe/assets');
    await expect(page.locator('text=poste-jean').first()).toBeVisible();
  });

  test('S2-SEED-2: Login en tant que marie.dupont (seed user)', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Nom d\'utilisateur').fill('marie.dupont');
    await page.getByLabel('Mot de passe').fill('Demo1234!');
    await page.getByRole('button', { name: /Connexion/ }).click();
    await expect(page).toHaveURL(/\/(dashboard|home|$)/);
  });
});
```

- [ ] **Step 2 : Run avec seed préalable**

```bash
rtk just db-seed
cd client && npx playwright test s2-seeding.spec.ts --reporter=list
```
Expected : 2 PASS

- [ ] **Step 3 : Commit**

```bash
rtk git add client/e2e/s2-seeding.spec.ts
rtk git commit -m "test(seed): E2E Playwright scenarios (pages peuplées + login marie.dupont)"
```

---

### Task 21 : Docs seeding + merge main

**Files :**
- Create : `docs/product-specs/55-seeding-demo.md`
- Create : `.claude/skills/seeding-debug/SKILL.md`
- Modify : `CLAUDE.md`
- Modify : `README.md` (section Quick Start)

- [ ] **Step 1 : Product spec**

```md
# Product Spec 55 — Seeding démo "Acme Corp"

**Status:** Livré S2
**Owner:** Track C
**Related:** 15-multi-tenant.md, 53-org-rbac-refonte.md (S1)

## Résumé

Binary Rust `signapps-seed` qui peuple une instance SignApps avec des données "Acme Corp" cohérentes cross-services en < 10 secondes. Remplace l'ancien script `scripts/seed-demo-data.sh`.

## Contenu

- Tenant : Acme Corp
- Structure : 4 OUs (Direction, Engineering, Sales, Support)
- 15 personnes avec emails @acme.corp
- 4 calendriers, 20 events semaine en cours
- 30 mails, 5 channels chat + 40 messages
- 10 docs Tiptap, 3 buckets Drive + 15 fichiers
- 5 formulaires (public/internes)
- 10 contacts externes, 4 salles Meet, 12 tasks Kanban
- 20 IT assets, 8 secrets Vault
- 5 profiles PXE, 3 assets enrôlés (liens utilisateurs)

## Usage

```bash
just db-seed             # Full
just db-seed-reset       # Reset + reseed
just db-seed-dry         # Dry run
just db-seed-only calendar  # Un service
```

## Accès utilisateurs

- `admin` / `admin`
- `marie.dupont` / `Demo1234!` (+ 14 autres utilisateurs acme)

## Design

- UUIDs namespace v5 `00000000-acme-5000-...` → déterministes et reproductibles
- Idempotent : re-run = 0 créations
- Transactionnel par seeder
- Trait `Seeder` + `SeedContext` partagé (users/nodes mapping)
- Refuse `DATABASE_URL` non-localhost sans `SEED_ALLOW_PROD=1`

## Tests

- `cargo test -p signapps-seed --test test_idempotent`
- `cd client && npx playwright test s2-seeding.spec.ts`
```

- [ ] **Step 2 : Debug skill**

```md
# Seeding Demo Debug Skill

Use this skill when the user asks about signapps-seed failures, missing demo data, or inconsistent cross-service data.

## Quick diagnosis

1. Check DATABASE_URL : `echo $DATABASE_URL` — must be localhost or `SEED_ALLOW_PROD=1`
2. Check migrations : `just db-migrate` must pass first
3. Dry run : `just db-seed-dry` — shows plan without writes
4. Verbose : `RUST_LOG=signapps_seed=debug just db-seed`

## Common issues

| Symptom | Root cause | Fix |
|---------|-----------|-----|
| `relation "org.org_persons" does not exist` | S1 migrations not applied | Run `just db-migrate` first |
| `duplicate key value violates unique constraint` | Seeded data modified, UUIDs still match | Run `just db-seed-reset` |
| Cross-service data missing (e.g. calendar but no mail) | Seeder order wrong / partial with `--only` | Run full `just db-seed` |
| Passwords don't work | Seeded hash is `Demo1234!` | Use that password, not `admin` |
| Seed takes > 30s | Large pool contention | Reduce parallelism or bump DB_MAX_CONNECTIONS |

## Reseed from scratch

```bash
docker exec -it signapps-pg psql -U signapps -d signapps -c "TRUNCATE identity.users, org.org_persons, org.org_nodes, ... CASCADE"
just db-seed
```
```

- [ ] **Step 3 : CLAUDE.md + README**

CLAUDE.md section "Préférences de développement" :
```
- **Seeding démo** : `just db-seed` (remplace l'ancien script bash)
```

CLAUDE.md "Key Environment Variables" :
```
SEED_ALLOW_PROD=0                   # autorise seed sur DB non-localhost
SEED_ON_BOOT=false                  # auto-seed au boot
```

README.md Quick Start :
```md
## Quick Start

```bash
# 1. Start PostgreSQL
just db-start

# 2. Migrate
just db-migrate

# 3. Seed demo data (Acme Corp)
just db-seed

# 4. Start platform
just dev      # frontend :3000
cargo run -p signapps-platform    # backend single-binary
```

Login : `admin`/`admin` ou `marie.dupont`/`Demo1234!`
```

- [ ] **Step 4 : Boot test final**

```bash
powershell "Stop-Process -Name signapps-platform -Force -ErrorAction SilentlyContinue"; sleep 2
rtk cargo test -p signapps-platform --test boot -- --ignored
```
Expected : boot < 5s (budget S1 maintenu)

- [ ] **Step 5 : Commit + merge main**

```bash
rtk git add docs/product-specs/55-seeding-demo.md .claude/skills/seeding-debug README.md CLAUDE.md
rtk git commit -m "docs(seed): product spec 55 + debug skill + README + CLAUDE.md refs"

# Merge main
rtk git checkout main
rtk git pull origin main
rtk git merge feature/s2-pxe-seeding --no-ff -m "merge: S2 (PXE+DHCP + seeding démo)"
rtk git push origin main
```

---

## Fin du plan S2

**Récapitulatif :**
- 21 tâches en 3 waves sur 10 jours
- Track B : PXE opérationnel avec ports non-priv, auto-discovery, wizard, SSE, E2E
- Track C : Binary `signapps-seed` idempotent, 15 services peuplés, ~200 items

**Exit criteria :**
- [ ] 34 services bootent < 5s
- [ ] `cargo test -p signapps-pxe` tests verts (dhcp_flow, sse_stream, dhcp_recent, discovered_endpoints)
- [ ] `cargo test -p signapps-seed test_idempotent` vert en < 10s
- [ ] 5 scénarios Playwright (`s2-pxe` + `s2-seeding`) verts
- [ ] CHANGELOG + product-specs + debug skills à jour
- [ ] PR mergée sur main sans régression
