# S2 — PXE+DHCP fonctionnel & Seeding démo cohérent — Design Spec

**Date :** 2026-04-18
**Scope :** Track B (PXE + DHCP opérationnels) + Track C (seeding démo cross-services cohérent)
**Durée estimée :** 2 semaines (10 jours ouvrés) en 3 waves
**Branche :** `feature/s2-pxe-seeding`
**Dépendances :** S1 mergée (Org+RBAC+AD+provisioning+grants)

---

## 1. Contexte

S1 a livré le modèle canonique org + RBAC + AD sync + provisioning événementiel. Les 34 services bootent en 1.58s avec `OrgPermissionResolver` partagé. La plateforme est prête à recevoir :

1. **Track B** — Rendre PXE+DHCP opérationnels pour l'auto-enrôlement de machines (existant mais gated derrière `PXE_ENABLE_*=false`).
2. **Track C** — Fournir un jeu de données démo cohérent cross-services pour tester le comportement réel (finit le "pas de mocks" du memory `feedback_no_mocks.md`).

Les deux tracks sont techniquement indépendants mais **partagent** :
- Le tenant démo "Acme Corp" seeded par Track C sert aussi de cible pour les assets PXE (machines assignées à des personnes de l'organigramme).
- La création d'une machine PXE via wizard déclenche un event `pxe.asset.enrolled` consommé par le seeding pour peupler inventaire IT.

---

## 2. Objectifs mesurables

### Track B — PXE+DHCP

- **B1.** TFTP + ProxyDHCP listeners activés par défaut en mode dev sur **ports non privilégiés** (TFTP 6969, DHCP 4011), sans nécessiter root/Administrator.
- **B2.** Flow bout-en-bout validé par test Rust simulé : DHCPDISCOVER → ProxyDHCP OFFER → TFTP boot file → iPXE script → asset enregistré en DB.
- **B3.** Auto-discovery : une machine qui envoie DHCPDISCOVER est automatiquement ajoutée à `pxe.assets` avec status `discovered`, sans intervention admin.
- **B4.** Wizard frontend `/pxe/wizard` complet (5 étapes : catalog choice → profile → MAC target → kickoff → live progress).
- **B5.** Progression live via SSE (`GET /api/v1/pxe/deployments/:mac/stream`), reflétée dans le wizard.
- **B6.** Catalog refresh automatique (sha256 verify + re-download si corruption).
- **B7.** Activation prod via un unique flag : `PXE_MODE=root` (ports standard 69/67) ou `PXE_MODE=user` (défaut, ports non privilégiés).

### Track C — Seeding démo

- **C1.** Binary Rust `signapps-seed` (remplace `scripts/seed-demo-data.sh` bash/curl) dans `services/signapps-seed/` — accès direct aux repos de `signapps-db`, transactionnel, idempotent.
- **C2.** Jeu "Acme Corp" complet : 1 tenant, 4 OUs (Direction, Engineering, Sales, Support), 15 personnes, 3 boards, 5 policies, AD config de démo (unbound LDAP).
- **C3.** Données cross-services cohérentes (mêmes `user_id` partout) :
  - Calendar : 20 événements semaine en cours, 4 calendriers (un par OU)
  - Mail : 30 mails entrants/sortants dans boîtes démo
  - Chat : 5 channels, 40 messages
  - Docs : 10 documents Tiptap collaboratifs
  - Drive : 15 fichiers répartis en 3 buckets
  - Forms : 3 formulaires publics + 2 internes
  - Contacts : 10 contacts externes (clients/fournisseurs)
  - Meet : 4 salles pré-configurées
  - Tasks : 12 tâches Kanban réparties sur 3 boards
  - IT-assets : 20 assets (laptops, écrans, téléphones) assignés
  - Vault : 8 secrets partagés par boards
  - PXE : 5 profiles boot + 3 assets enrôlés (liés aux personnes)
- **C4.** Commandes CLI : `--reset` (drop + reseed), `--force` (overwrite), `--dry-run` (plan d'action), `--only <service>` (seed partiel).
- **C5.** Exécution depuis `just db-seed` ou automatiquement au boot si `SEED_ON_BOOT=true`.
- **C6.** Durée totale < 10 secondes pour le seed complet sur PG local.
- **C7.** Reproductible : exécutions multiples sans collision (uuid déterministes via namespace UUID v5).

---

## 3. Architecture

### 3.1 Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│ signapps-platform (single binary :3003..:3099)                  │
│                                                                  │
│  ┌──────────────────┐      ┌─────────────────────────────────┐ │
│  │ signapps-pxe     │      │ signapps-seed (binary Rust)     │ │
│  │ :3016 admin API  │      │ (bin-only, pas de service http) │ │
│  ├──────────────────┤      ├─────────────────────────────────┤ │
│  │ + TFTP :6969     │      │ seeders/org.rs                  │ │
│  │ + ProxyDHCP :4011│      │ seeders/calendar.rs             │ │
│  │ + iPXE script gen│      │ seeders/mail.rs                 │ │
│  │ + SSE stream     │      │ seeders/chat.rs                 │ │
│  │ + auto-discover  │      │ seeders/docs.rs                 │ │
│  └──────────────────┘      │ seeders/drive.rs                │ │
│          ▲                  │ seeders/forms.rs                │ │
│          │ event bus        │ seeders/contacts.rs             │ │
│          │ pxe.asset.*      │ seeders/meet.rs                 │ │
│          │                  │ seeders/tasks.rs                │ │
│          ▼                  │ seeders/it_assets.rs            │ │
│  ┌──────────────────┐      │ seeders/vault.rs                │ │
│  │ provisioning     │      │ seeders/pxe.rs                  │ │
│  │ consumers        │      │ (15 seeders, un par service)    │ │
│  │ (S1 reuse)       │      └─────────────────────────────────┘ │
│  └──────────────────┘                                           │
└─────────────────────────────────────────────────────────────────┘
                        │
                        ▼
                  PostgreSQL (dev:5432)
                  - identity, org, calendar, mail, chat…
                  - pxe.profiles, pxe.assets, pxe.images, pxe.deployments
```

### 3.2 Track B — PXE architecture détaillée

**Ports non-privileged par défaut :**
- `PXE_TFTP_PORT=6969` (au lieu de 69)
- `PXE_DHCP_PORT=4011` (ProxyDHCP standard, pas de DHCP full)
- `PXE_MODE=user|root` — mode root remplace par 69/67 pour prod

**Auto-discovery flow :**
1. Machine PXE-boot → DHCPDISCOVER (broadcast :67 → écouté par DHCP LAN, pas nous)
2. Machine → ProxyDHCP :4011 en parallèle (écouté par nous)
3. ProxyDHCP :4011 → OFFER (TFTP IP + `signapps-boot.ipxe`)
4. **Nouveau** : sur OFFER, on enregistre la MAC dans `pxe.assets` (status=`discovered`, dernière_vue=NOW) si absente, sinon update last_seen.
5. Machine → TFTP :6969 → récupère `signapps-boot.ipxe`
6. iPXE script → HTTP :3016 → `/api/v1/pxe/boot.ipxe?mac=XX:XX...`
7. Handler récupère `pxe.assets.profile_id` → retourne le script du profile

**Test client simulé (Rust) :**
- Binaire `signapps-pxe-sim` dans `services/signapps-pxe/src/bin/sim.rs`
- Construit un DHCPDISCOVER PXE-compatible, envoie en UDP local, attend OFFER, valide `siaddr` + `file` fields.
- Télécharge `signapps-boot.ipxe` via TFTP, parse, suit les instructions HTTP.
- Use case : intégré au test `e2e_pxe_flow.rs` pour valider le boot complet.

**Progression live (SSE) :**
- `pxe.deployments.progress` (INT 0–100) est déjà en DB.
- Nouveau endpoint `GET /api/v1/pxe/deployments/:mac/stream` → SSE qui envoie chaque changement.
- Implémentation : polling DB toutes les 500ms (assez pour démo) OU LISTEN/NOTIFY PG.
- Fallback : polling simple + notification PG-advisory pour réveil.
- Wizard frontend `useEventSource` hook consomme le stream.

**Wizard frontend (5 étapes) :**
- Étape 1 : Catalog (grille d'OS, filtres os_type/category, badge "téléchargé" ou "télécharger")
- Étape 2 : Profile selection/creation (iPXE script prêt, editable pour users avancés)
- Étape 3 : MAC target (saisie manuelle OU liste des assets `status=discovered`)
- Étape 4 : Confirmation + kickoff POST `/api/v1/pxe/deployments`
- Étape 5 : Live progress (SSE + terminal pseudo-output + bouton "terminer / recommencer")

### 3.3 Track C — Seeding architecture détaillée

**Binary `signapps-seed` :**

```rust
// services/signapps-seed/src/main.rs
#[tokio::main]
async fn main() -> Result<()> {
    let args = SeedArgs::parse();
    let pool = signapps_db::create_pool(&args.database_url).await?;
    let keystore = Keystore::init_from_env().await?;
    let eventbus = PgEventBus::new(pool.clone()).await?;
    let ctx = SeedContext { pool, keystore, eventbus, force: args.force, dry_run: args.dry_run };

    let seeders: Vec<Box<dyn Seeder>> = vec![
        Box::new(OrgSeeder::new()),
        Box::new(IdentitySeeder::new()),
        Box::new(CalendarSeeder::new()),
        Box::new(MailSeeder::new()),
        // ... 15 seeders au total
    ];

    for seeder in seeders {
        if let Some(only) = &args.only {
            if seeder.name() != *only { continue; }
        }
        seeder.run(&ctx).await?;
    }

    Ok(())
}
```

**Trait Seeder :**

```rust
#[async_trait]
pub trait Seeder: Send + Sync {
    fn name(&self) -> &'static str;
    fn dependencies(&self) -> Vec<&'static str>;  // noms d'autres seeders à exécuter avant
    async fn run(&self, ctx: &SeedContext) -> Result<SeedReport>;
}

pub struct SeedReport {
    pub created: usize,
    pub skipped: usize,
    pub errors: Vec<String>,
}
```

**UUIDs déterministes (namespace v5) :**

```rust
// Namespace fixe pour tout le seed Acme Corp
const ACME_NS: Uuid = uuid!("00000000-acme-5000-0000-000000000001");

fn acme_uuid(kind: &str, key: &str) -> Uuid {
    Uuid::new_v5(&ACME_NS, format!("{}:{}", kind, key).as_bytes())
}

// Exemples :
acme_uuid("tenant", "acme-corp")     // Toujours le même UUID
acme_uuid("user", "marie.dupont")    // Toujours le même UUID
acme_uuid("org-node", "engineering") // Toujours le même UUID
```

**Cross-service coherence :**
- `OrgSeeder` crée tenant + OUs + personnes, stocke `user_id` en mémoire partagée (`ctx.users: HashMap<String, Uuid>`)
- `CalendarSeeder` crée événements en utilisant `ctx.users.get("marie.dupont")` comme organiser
- `MailSeeder` crée des conversations entre `ctx.users.get("marie.dupont")` et `ctx.users.get("jean.martin")`
- Tous partagent le même `ctx.tenant_id = acme_uuid("tenant", "acme-corp")`

---

## 4. Modèle de données

### 4.1 Track B — Extensions PXE

**Nouvelles colonnes sur `pxe.assets` (migration 427) :**

```sql
-- Migration 427: PXE assets auto-discovery & live stream support
ALTER TABLE pxe.assets
    ADD COLUMN IF NOT EXISTS discovered_via VARCHAR(20) DEFAULT 'manual'
        CHECK (discovered_via IN ('manual', 'dhcp', 'api', 'import')),
    ADD COLUMN IF NOT EXISTS boot_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_boot_profile_id UUID REFERENCES pxe.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS dhcp_vendor_class VARCHAR(255),
    ADD COLUMN IF NOT EXISTS arch_detected VARCHAR(20);

-- Nouvelle table pour tracker les requêtes DHCP (debug + observability)
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

CREATE INDEX idx_pxe_dhcp_requests_mac ON pxe.dhcp_requests(mac_address);
CREATE INDEX idx_pxe_dhcp_requests_received_at ON pxe.dhcp_requests(received_at DESC);

-- LISTEN/NOTIFY pour SSE live stream
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

CREATE TRIGGER pxe_deployment_progress_notify
    AFTER UPDATE ON pxe.deployments
    FOR EACH ROW
    WHEN (OLD.progress IS DISTINCT FROM NEW.progress OR OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION pxe_deployment_notify();
```

### 4.2 Track C — Aucune nouvelle table

Le seeding utilise les tables existantes. Aucune migration schema nécessaire.

---

## 5. API & Surface publique

### 5.1 Track B — Nouveaux endpoints PXE

| Méthode | Route | Description | Auth |
|---------|-------|-------------|------|
| GET | `/api/v1/pxe/deployments/:mac/stream` | SSE stream du déploiement en cours | Bearer |
| GET | `/api/v1/pxe/assets/discovered` | Liste des assets `status=discovered` (non enrôlés) | Bearer |
| POST | `/api/v1/pxe/assets/:mac/enroll` | Enrôlement rapide d'un asset discovered | Bearer |
| GET | `/api/v1/pxe/dhcp/recent` | 100 dernières requêtes DHCP (debug UI) | Bearer admin |
| POST | `/api/v1/pxe/catalog/refresh` | Refresh catalog + verify sha256 | Bearer admin |

### 5.2 Track C — CLI binary

```bash
# Full seed
signapps-seed --database-url $DATABASE_URL

# Reset + seed (drops Acme Corp data only, preserves admin user)
signapps-seed --reset

# Overwrite existing
signapps-seed --force

# Dry run
signapps-seed --dry-run

# Seed only a specific service
signapps-seed --only calendar

# Via just
just db-seed            # = signapps-seed
just db-seed-reset      # = signapps-seed --reset
```

---

## 6. Waves & découpage

**Wave 1 (3 jours) — Track B foundation**
- W1.T1 Migration 427 (colonnes + dhcp_requests + LISTEN/NOTIFY trigger)
- W1.T2 Ports non-privileged par défaut (`PXE_MODE=user`, TFTP :6969, DHCP :4011)
- W1.T3 Auto-discovery dans ProxyDHCP handler → INSERT/UPDATE pxe.assets + INSERT pxe.dhcp_requests
- W1.T4 Endpoints `/api/v1/pxe/assets/discovered` + `/api/v1/pxe/assets/:mac/enroll`
- W1.T5 Endpoints `/api/v1/pxe/dhcp/recent` + `/api/v1/pxe/catalog/refresh`
- W1.T6 Test client simulé `signapps-pxe-sim` (DHCPDISCOVER → OFFER → TFTP → iPXE)

**Wave 2 (3 jours) — Track B wizard + SSE**
- W2.T7 Endpoint SSE `/api/v1/pxe/deployments/:mac/stream` (LISTEN/NOTIFY)
- W2.T8 Frontend : wizard 5 étapes `/pxe/wizard` (refactor complet)
- W2.T9 Frontend : hook `usePxeDeploymentStream` + composant `<LiveDeploymentTerminal>`
- W2.T10 Frontend : page `/pxe/assets` avec tabs "Tous | Découverts | Enrôlés"
- W2.T11 E2E Playwright : scénario complet wizard + SSE mock
- W2.T12 Documentation : product-spec PXE + debug skill

**Wave 3 (4 jours) — Track C seeding**
- W3.T13 Scaffolding crate `signapps-seed` + trait `Seeder` + binary entry
- W3.T14 Seeders org + identity + ad (dépend de S1) — tenant Acme Corp, 4 OUs, 15 personnes
- W3.T15 Seeders calendar + mail + chat — 20 events, 30 mails, 40 messages
- W3.T16 Seeders docs + drive + forms — 10 docs, 15 files, 5 forms
- W3.T17 Seeders contacts + meet + tasks + it_assets + vault — 10+4+12+20+8
- W3.T18 Seeders pxe — 5 profiles + 3 assets enrôlés (MAC simulés)
- W3.T19 CLI `just db-seed`, `just db-seed-reset`, README + test idempotence
- W3.T20 E2E Playwright : scénario "boot vierge → seed → pages peuplées" (5 captures écran)
- W3.T21 Polish : corrections + merge main

**Total : 21 tâches, 10 jours.**

---

## 7. Tests & validation

### 7.1 Track B

**Unit tests :**
- `pxe::dhcp_proxy::tests::test_pxe_discover_builds_valid_offer`
- `pxe::dhcp_proxy::tests::test_non_pxe_discover_ignored`
- `pxe::dhcp_proxy::tests::test_auto_enroll_mac`
- `pxe::dhcp_proxy::tests::test_update_last_seen_on_repeat`

**Integration tests :**
- `services/signapps-pxe/tests/test_dhcp_flow.rs` — lance le ProxyDHCP sur port random, envoie DHCPDISCOVER depuis sim, vérifie OFFER + asset créé.
- `services/signapps-pxe/tests/test_sse_stream.rs` — POST deployment, UPDATE progress, GET stream, vérifie chunks SSE.
- `services/signapps-pxe/tests/test_catalog_refresh.rs` — refresh catalog avec ISO mock, vérifie sha256.

**E2E Playwright (`client/e2e/s2-pxe.spec.ts`) :**
- **Scénario 1** — Découverte + enrôlement : simule DHCPDISCOVER via API test, vérifie apparition dans `/pxe/assets?tab=discovered`, enrôle, vérifie transition vers `enrolled`.
- **Scénario 2** — Wizard complet : `/pxe/wizard` → étape 1 choix Ubuntu 24.04 → étape 2 profile défaut → étape 3 MAC `aa:bb:cc:00:00:01` → kickoff → étape 5 SSE reçoit 0%, 25%, 50%, 75%, 100%.
- **Scénario 3** — Debug DHCP : `/pxe/debug` affiche les 10 dernières requêtes avec timestamps.

### 7.2 Track C

**Unit tests :**
- `signapps_seed::acme_uuid::tests::test_deterministic` — même entrée → même UUID
- `signapps_seed::seeders::org::tests::test_creates_4_ous_and_15_persons`
- `signapps_seed::seeders::tests::test_all_seeders_idempotent` — second run = 0 créations
- `signapps_seed::tests::test_dry_run_no_writes`

**Integration tests :**
- `services/signapps-seed/tests/test_full_seed.rs` — seed complet sur DB de test, vérifie 1 tenant + 4 OUs + 15 users + 20 events + 30 mails etc.
- `services/signapps-seed/tests/test_reset_then_seed.rs` — `--reset` puis seed, aucun conflit.
- `services/signapps-seed/tests/test_only_filter.rs` — `--only calendar` seed uniquement calendar.

**E2E Playwright (`client/e2e/s2-seeding.spec.ts`) :**
- **Scénario 4** — Boot vierge + seed : `just db-reset && just db-seed`, puis naviguer sur `/calendar` (20 events visibles), `/mail` (30 messages), `/chat` (5 channels), `/docs` (10 docs), `/drive` (15 fichiers), `/org` (4 OUs + 15 persons).

---

## 8. Observabilité & Sécurité

**Tracing :**
- `tracing::instrument` sur tous les handlers nouveaux
- Span `pxe.dhcp_request` avec champs `mac`, `msg_type`, `xid`, `responded`
- Span `seeder.run` avec `name`, `duration_ms`, `created`, `skipped`

**Metrics :**
- `pxe_dhcp_requests_total{msg_type}` counter
- `pxe_assets_discovered_total` counter
- `pxe_deployments_active` gauge
- `seeder_runs_total{seeder}` counter

**Sécurité :**
- ProxyDHCP répond UNIQUEMENT aux requêtes avec option 60 = "PXEClient" (filtre strict, déjà en place)
- Auto-enroll ne donne AUCUN droit utilisateur — l'asset est juste "vu", pas "approuvé"
- Enrôlement effectif (`/api/v1/pxe/assets/:mac/enroll`) exige Bearer + RBAC `pxe.asset.enroll`
- Catalog refresh exige admin (protégé par RBAC `pxe.catalog.manage`)
- `signapps-seed` refuse si `DATABASE_URL` pointe sur prod sans `SEED_ALLOW_PROD=1` explicite (garde-fou)
- `signapps-seed` refuse de créer un admin si ADMIN existe déjà sans `--force`

---

## 9. Garde-fous & feature flags

- `PXE_MODE=user` (défaut) vs `PXE_MODE=root` : mode user = ports 6969/4011, mode root = ports 69/67
- `PXE_ENABLE_TFTP`, `PXE_ENABLE_PROXY_DHCP`, `PXE_ENABLE_DC` : restent disponibles pour désactiver individuellement
- `PXE_AUTO_ENROLL=false` (défaut=true) : désactive l'auto-discovery si besoin
- `SEED_ON_BOOT=false` (défaut) : active le seed auto au boot pour environnements démo
- `SEED_ALLOW_PROD=0` : seed refusé sur DATABASE_URL non-localhost sans override explicite

---

## 10. Migration data & rollout

**Backward compatibility :**
- Les env `PXE_ENABLE_*` existants restent respectés. Le nouveau `PXE_MODE=user` est additif.
- Les assets existants sont compatibles (colonnes ajoutées avec DEFAULT).
- Le script `seed-demo-data.sh` est supprimé (remplacé par le binary). Noter dans le CHANGELOG.

**Rollout :**
1. Merge Wave 1 + 2 → PXE+DHCP opérationnels, ne touche pas aux données existantes.
2. Merge Wave 3 → seeding disponible, pas activé automatiquement (opt-in via `SEED_ON_BOOT=true`).
3. Documenter dans README que `just db-seed` est le chemin recommandé pour peupler une instance de démo.

---

## 11. Critères de sortie

- [ ] 34 services bootent en < 5s (budget S1 maintenu)
- [ ] Test `cargo test -p signapps-pxe test_dhcp_flow` vert
- [ ] Test `cargo test -p signapps-seed test_full_seed` vert en < 10s
- [ ] Wizard `/pxe/wizard` fonctionnel avec SSE visible
- [ ] `just db-seed` peuple Acme Corp en < 10s, `just db-seed` re-run = 0 créations
- [ ] 4 scénarios Playwright `s2-*.spec.ts` verts
- [ ] `cargo clippy --workspace -- -D warnings` vert
- [ ] Product-specs `54-pxe-operational.md` + `55-seeding-demo.md` créés
- [ ] Debug skills `pxe-operational-debug` + `seeding-debug` créés
- [ ] CLAUDE.md mis à jour (3 lignes : ports PXE, `signapps-seed`, `SEED_ON_BOOT`)

---

## 12. Risques & mitigations

| Risque | Impact | Mitigation |
|--------|--------|-----------|
| ProxyDHCP conflit avec DHCP LAN | Moyen | Option 60 = "PXEClient" filtre strict ; binder sur `0.0.0.0:4011` pas :67 par défaut |
| TFTP port 6969 bloqué par firewall | Faible | Doc : exposer 6969 uniquement sur LAN interne ; fallback HTTP boot déjà implémenté |
| Seeding Acme Corp écrase données test | Moyen | UUIDs namespace v5 dédiés ; refuse sans `--force` si déjà seeded |
| Volume seed > 10s | Faible | Parallélisation via `tokio::join!` des seeders indépendants |
| LISTEN/NOTIFY rate limit | Faible | Max 10 Hz update (debounce dans handler avant UPDATE) |
| Test DHCP sim flaky sur Windows | Moyen | Bind explicite sur `127.0.0.1` + port random (évite conflit) |

---

## 13. Livrables

1. **Code** :
   - `services/signapps-pxe/src/{handlers,dhcp_proxy,sse,auto_enroll}.rs` (éditions)
   - `services/signapps-pxe/src/bin/sim.rs` (nouveau)
   - `services/signapps-seed/` (nouveau crate)
   - `client/src/app/pxe/{wizard,assets,debug}/*.tsx` (refactor + nouveau)
   - `client/src/hooks/usePxeDeploymentStream.ts` (nouveau)
   - `migrations/427_pxe_autodiscovery_sse.sql`
   - `client/e2e/{s2-pxe,s2-seeding}.spec.ts`

2. **Docs** :
   - `docs/product-specs/54-pxe-operational.md`
   - `docs/product-specs/55-seeding-demo.md`
   - Mise à jour `README.md` (section Quick Start avec `just db-seed`)
   - Mise à jour `CLAUDE.md` (3 lignes)

3. **Skills debug** :
   - `.claude/skills/pxe-operational-debug/SKILL.md`
   - `.claude/skills/seeding-debug/SKILL.md`

---

**Fin de la spec S2.**
