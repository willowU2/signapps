# S3 — Track D tests intégrés cross-services + polish — Design Spec

**Date :** 2026-04-18
**Scope :** Tests d'intégration cross-services, full Playwright suite avec données seedées, polish (clippy, schémas, docs)
**Durée estimée :** 5 jours ouvrés en 2 waves
**Branche :** `feature/s3-integration-tests`
**Dépendances :** S1 mergée (org+RBAC+AD+provisioning+grants), S2 mergée (PXE+DHCP opérationnels, seeding Acme Corp)

---

## 1. Contexte

S1 + S2 ont livré un backend opérationnel avec 34 services, RBAC unifié, seed démo cohérent. Les tests unitaires par service sont en place, mais il manque :

1. **Tests d'intégration cross-services** — vérifier que les events PgEventBus (org.user.created, org.grant.created, pxe.asset.enrolled) déclenchent bien les consumers dans les services cibles
2. **E2E Playwright full** — la suite S1+S2 contient 11 scénarios, dont certains ont été skippés au moment du dev car les dépendances n'étaient pas prêtes. Tout exécuter avec un seed frais.
3. **Polish** — clippy pré-existant (`needless_borrows_for_generic_args` dans `signapps-db-shared/src/repositories/automation_repository.rs:470`), ajustements schéma découverts pendant S2 (tables en `public.*` vs `org.*`, alias `crm.leads` vs `contacts.*`), documentation consolidée.

---

## 2. Objectifs mesurables

### D1 — Tests d'intégration cross-services Rust

- **D1.1** Test suite `services/signapps-integration-tests/tests/` au niveau workspace (nouveau crate) qui lance le backend réel + seed Acme Corp + exécute des scénarios cross-services.
- **D1.2** Scénario "provisioning end-to-end" : création d'un user via POST `/api/v1/org/persons` → vérifier qu'il est provisionné dans mail/storage/calendar/chat dans les 3 secondes.
- **D1.3** Scénario "grant & redirect" : créer un HMAC grant, l'utiliser pour accéder à une ressource partagée, vérifier le redirect + audit log.
- **D1.4** Scénario "RBAC cross-service" : user A avec permission `docs.read` sur le node Engineering → peut lire les docs Engineering mais pas ceux de Sales.
- **D1.5** Scénario "AD sync dry-run" : configurer un AD config mock, déclencher un dry-run, vérifier que `org_ad_sync_log` contient les opérations proposées sans écritures réelles.
- **D1.6** Scénario "PXE auto-enrollment → asset" : simuler DHCPDISCOVER, vérifier que l'asset apparaît, l'enrôler via API, vérifier que le boot script correct est servi.

### D2 — E2E Playwright full suite

- **D2.1** Fixture de seed Playwright (global setup) qui s'assure que le seed est exécuté avant le test run via `signapps-seed` (binary natif) — pas de child_process, utiliser un spawn Playwright approprié ou déclencher manuellement via justfile avant `playwright test`.
- **D2.2** Re-exécuter les 11 scénarios S1 + S2 existants avec backend seedé, débloquer ceux qui étaient skippés (notamment S2-PXE-2 wizard complet).
- **D2.3** 4 nouveaux scénarios cross-services :
  - **S3-PLAY-1** : user non-admin marie.dupont tente d'accéder à `/admin/users` → 403
  - **S3-PLAY-2** : user Engineering peut créer un event sur calendrier Engineering mais pas Sales
  - **S3-PLAY-3** : flow complet "partage document via grant HMAC" (créer grant → copier URL → ouvrir en incognito → doc visible)
  - **S3-PLAY-4** : flow PXE wizard avec seed → déploiement kickoff → progress stream visible

### D3 — Polish

- **D3.1** Fix clippy `needless_borrows_for_generic_args` dans `automation_repository.rs:470` (résolution de la dette inherited)
- **D3.2** Documenter la convention schéma : `docs/architecture/database-schemas.md` qui note "Tables org_* vivent en `public.*` (héritage S1), aliases crm.leads pour contacts" — pas de migration destructive.
- **D3.3** Pass clippy strict sur tout le workspace : `cargo clippy --workspace --all-features -- -D warnings` doit être 100% clean.
- **D3.4** Documentation consolidée : `docs/architecture/overview.md` qui référence S1 + S2 + S3 et décrit l'architecture cible.
- **D3.5** Audit `/health` endpoints cross-services : tous doivent répondre < 50ms.

### D4 — Performance baseline (optionnel, si temps)

- **D4.1** Script `scripts/bench-baseline.sh` qui mesure :
  - Boot time single-binary (cible : < 5s)
  - Seed full time (cible : < 15s)
  - Login round-trip (cible : < 300ms)
  - Page `/calendar` fetch + render (cible : < 500ms)
- **D4.2** Commit un rapport `docs/benchmarks/2026-04-18-baseline.md`

---

## 3. Architecture

### 3.1 Tests d'intégration Rust

Nouveau crate interne `signapps-integration-tests` dans le workspace :

```
services/signapps-integration-tests/
  Cargo.toml                # crate de tests, pas de lib/bin
  tests/
    common/
      mod.rs                # helpers : spawn backend, seed, get auth token
    provisioning_flow.rs    # D1.2
    grants_redirect.rs      # D1.3
    rbac_enforcement.rs     # D1.4
    ad_sync_dryrun.rs       # D1.5
    pxe_enrollment.rs       # D1.6
```

**Fonctionnement :**
- Chaque test `#[tokio::test]` démarre `signapps-platform` dans un subprocess sur des ports dynamiques
- Exécute `signapps-seed` en amont
- Obtient un token admin via `/api/v1/auth/login`
- Exécute le scénario en parallèle ou séquentiel selon le cas
- Teardown : kill subprocess + `TRUNCATE ... CASCADE`

**Isolation :**
- PG local avec base dédiée par test suite (`signapps_test`) pour éviter les conflits avec la DB dev
- OU : un seul test run unique avec `#[serial_test::serial]` sur la DB dev

### 3.2 Playwright fixture de seed

**Décision** : pas de global setup Node.js qui spawn Rust. À la place :
- Ajout d'une recette `just e2e` qui chaîne `db-seed-reset` puis `playwright test` en bash
- Documenter dans README que l'ordre est important
- Le CI (GitHub Actions) aura un step `- run: just e2e` qui garantit l'ordre

Tous les scénarios Playwright bénéficient automatiquement des données Acme Corp.

### 3.3 Schema normalization (D3.2)

S2 a révélé que les tables org vivent en `public.*` (pas `org.*`) car les migrations S1 ont utilisé le schéma par défaut. Deux options :

**Option A — Keep `public.*`** (moins de churn)
- Accepter l'incohérence nommage vs schéma réel
- Documenter dans `docs/architecture/database-schemas.md` : "Tables legacy-named `org_*` vivent en `public.*`"

**Option B — Migration vers `org.*`** (cohérence)
- Migration 428 : `ALTER TABLE public.org_nodes SET SCHEMA org; ...` pour 9 tables
- Adapter tous les `FROM org_nodes` en `FROM org.org_nodes` (environ 50 occurrences)
- Risque : casser les tests + migrations de S1

**Décision : Option A** (pragmatique). Documenter dans overview.md. Pas de migration destructive en S3.

### 3.4 Clippy fix (D3.1)

```rust
// AVANT (automation_repository.rs:470)
.bind(&tenant_id)  // needless_borrows_for_generic_args
```

Après inspection : `.bind()` consomme `T: Encode`, Uuid est Copy, le `&` est redondant. Fix :

```rust
.bind(tenant_id)
```

Un liner. Vérifier qu'il n'y a pas d'autres occurrences identiques.

---

## 4. Waves & découpage

### Wave 1 (3 jours) — Tests d'intégration Rust + polish

- W1.T1 Scaffolding `signapps-integration-tests` crate + helpers common (spawn backend + seed + token)
- W1.T2 Test D1.2 provisioning end-to-end
- W1.T3 Test D1.3 grants redirect
- W1.T4 Test D1.4 RBAC cross-service
- W1.T5 Test D1.5 AD sync dry-run + D1.6 PXE enrollment
- W1.T6 Fix clippy `needless_borrows_for_generic_args` + passe `cargo clippy --workspace -- -D warnings` full clean
- W1.T7 Documentation `docs/architecture/overview.md` + `docs/architecture/database-schemas.md`

### Wave 2 (2 jours) — E2E Playwright full + performance

- W2.T8 Recette `just e2e` (seed-reset + playwright) + re-exécuter les 11 scénarios S1+S2 existants
- W2.T9 Nouveaux scénarios S3-PLAY-1 à S3-PLAY-4 (4 scénarios cross-services)
- W2.T10 Audit `/health` latency cross-services + fix si > 50ms
- W2.T11 Script `bench-baseline.sh` + rapport `docs/benchmarks/2026-04-18-baseline.md` (optionnel — si temps)
- W2.T12 Merge main

**Total : 12 tâches, 5 jours.**

---

## 5. Tests & validation

**Rust integration :**
- `cargo test -p signapps-integration-tests --tests --release` — tous verts en < 60s

**Playwright :**
- `just e2e` — tous scénarios verts (S1 + S2 + S3)

**Clippy :**
- `cargo clippy --workspace --all-features --tests -- -D warnings` — 0 warning

**Boot + benchmark :**
- Boot test < 5s (maintenu)
- Seed < 15s (maintenu)
- Playwright full run < 3 minutes (cible)

---

## 6. Critères de sortie

- [ ] 5 tests intégration Rust (provisioning, grants, RBAC, AD dry-run, PXE) verts
- [ ] Playwright full suite (S1 + S2 + S3 = ~15 scénarios) verte
- [ ] `cargo clippy --workspace -- -D warnings` clean
- [ ] Boot test < 5s maintenu
- [ ] `docs/architecture/overview.md` créé
- [ ] Branche S3 mergée sur main
- [ ] CHANGELOG généré et commité

---

## 7. Livrables

1. **Code** :
   - `services/signapps-integration-tests/` (nouveau crate)
   - `justfile` ajout recette `e2e`
   - `client/e2e/s3-cross-service.spec.ts` (4 scénarios)
   - Fix clippy `crates/signapps-db-shared/src/repositories/automation_repository.rs:470`
   - `scripts/bench-baseline.sh` (si temps)

2. **Docs** :
   - `docs/architecture/overview.md` (consolidation S1+S2+S3)
   - `docs/architecture/database-schemas.md` (note sur `public.*` vs convention `org.*`)
   - `docs/benchmarks/2026-04-18-baseline.md` (si temps)

---

**Fin spec S3.**
