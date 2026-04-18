# Phase D2 P1 — Follow-up issues

Issues à créer (non-bloquantes pour le merge de la PR). Textes prêts à copier dans `gh issue create` une fois authentifié, ou manuellement via l'UI GitHub.

---

## Issue #1 — Audit des DROP CASCADE dans migrations 084, 235, 265

**Title:** `Phase D2 P1 follow-up: audit DROP CASCADE migrations (084, 235, 265)`

**Labels:** `tech-debt`, `database`, `risk`

**Body:**

Les migrations suivantes contiennent `DROP TABLE ... CASCADE` :
- `migrations/084_missing_schemas_billing_tables.sql`
- `migrations/235_*.sql`
- `migrations/265_*.sql`

Idempotentes au sens sqlx (elles ne font pas planter le 2e boot), mais **destructives** : si une DB prod a déjà des données dans les tables cibles, l'exécution les efface.

### Actions

- [ ] Identifier les tenants/déploiements où ces migrations ont déjà tourné.
- [ ] Wrapper chaque `DROP` dans un guard structure-check (`IF NOT EXISTS (… condition de presence de la nouvelle colonne …)`).
- [ ] Documenter dans `docs/runbooks/migrations-destructives.md` la procédure avant/après déploiement.

### Référence

Final review PR Phase D2 P1 single-binary. Spec : `docs/superpowers/specs/2026-04-18-phase-d2-architectural-perf-design.md`.

---

## Issue #2 — Retirer `Keystore::init` redondant dans signapps-mail

**Title:** `Phase D2 P1 follow-up: signapps-mail calls Keystore::init despite shared-state guardrail`

**Labels:** `tech-debt`, `refactor`

**Body:**

`services/signapps-mail/src/lib.rs` (ligne ~100-106) appelle `Keystore::init(KeystoreBackend::EnvVar)` alors que le shared state (`SharedState::init_once`) a déjà unlocké le keystore. La doc du `services/signapps-platform/src/services.rs::spec_vault` précise qu'aucun service ne doit réinitialiser.

### Pourquoi c'est non-bloquant

Idempotent en mode EnvVar (relecture pure de l'env, pas d'effet de bord). Si le backend change (File/RemoteKMS), risque de double-unlock ou de collision.

### Fix

Remplacer la construction locale du keystore par `shared.keystore.clone()` et adapter l'`AppState` mail.

### Référence

Final review PR Phase D2 P1. Spec §4.2.

---

## Issue #3 — Décider du sort de `SharedState.event_bus`

**Title:** `Phase D2 P1 follow-up: shared.event_bus is built but rarely reused`

**Labels:** `tech-debt`, `observability`

**Body:**

`SharedState::event_bus` est construit avec `source = "signapps-platform"` (cf. `crates/signapps-service/src/shared_state.rs::PLATFORM_SOURCE`), mais la plupart des services (billing, calendar, mail, notifications, social…) **créent leur propre `PgEventBus`** avec un source tag dédié à leur service pour la traçabilité.

### Options

1. **Garder** `shared.event_bus` et documenter la convention : il est utilisé uniquement par le platform lui-même (health, supervisor), chaque service construit le sien avec son nom.
2. **Retirer** le champ de `SharedState` et laisser chaque service instancier.
3. **Ajouter un helper** `SharedState::event_bus_for(name: &str) -> Arc<PgEventBus>` qui factorise la construction typée.

### Référence

Final review PR Phase D2 P1, §shared_state discipline.

---

## Issue #4 — `run_migrations` dans platform/main.rs swallow errors

**Title:** `Phase D2 P1 follow-up: single-binary swallows migration errors as warnings`

**Labels:** `tech-debt`, `reliability`

**Body:**

`services/signapps-platform/src/main.rs:25` :

```rust
run_migrations(&shared.pool)
    .await
    .unwrap_or_else(|e| tracing::warn!(?e, "migrations warning (non-fatal)"));
```

Cette défensive swallow les **erreurs** de migration en warning — si la DB est dans un état partiel, le platform démarre quand même. Les warnings "already exists" (idempotence naturelle) sont OK mais les vraies erreurs devraient fail-fast.

### Fix

Différencier :
- Warnings « already exists » → continue (attendu pour idempotence sur DBs partielles).
- Toute autre erreur → `?` pour propager et abort le boot.

Alternative : logger `tracing::error!` et retourner explicitement avec un code d'exit dédié.

---

## Issue #5 — Nettoyer les `#![allow(...)]` globaux introduits par le refactor

**Title:** `Phase D2 P1 follow-up: audit & narrow crate-level clippy allows`

**Labels:** `tech-debt`, `code-quality`

**Body:**

Pendant le refactor simple-bin → lib+bin, plusieurs services ont ajouté des `#![allow(clippy::...)]` ou `#![allow(dead_code, unused_imports, …)]` au niveau crate pour masquer des lints pré-existants qui n'étaient pas bloquants en mode binaire uniquement.

Exemples : `signapps-ai/src/lib.rs:19`, `signapps-workforce/src/lib.rs`, `signapps-calendar/src/lib.rs`, `signapps-docs/src/lib.rs`.

### Actions

- [ ] Pour chaque crate, identifier les allows ajoutés.
- [ ] Réduire le scope (allow ciblé au module / item plutôt qu'au crate).
- [ ] Fixer les vraies violations quand possible (type_complexity, new_without_default, redundant_closure).

### Référence

Final review PR Phase D2 P1.

---

## Issue #6 — signapps-nexus (stub vide) et signapps-agent (CLI client) : implémenter ou supprimer

**Title:** `Phase D2 P1 follow-up: decide fate of signapps-nexus and signapps-agent`

**Labels:** `tech-debt`, `scope`

**Body:**

Deux services du workspace n'ont pas été wirés dans `signapps-platform` :

- **`signapps-nexus`** : `src/main.rs` est un `fn main() {}` stub. Pas enregistré dans Cargo.toml workspace. Handler files référencent `crate::AppState` inexistant.
- **`signapps-agent`** : binaire CLI client (clap subcommands `enroll/run/status`), pas un serveur HTTP. Port 9999 est une interface status locale. Wirer dans le platform aurait le serveur qui enrollent avec lui-même — architecturalement inapproprié.

### Décision à prendre

- **nexus** : (a) finir l'implémentation et wirer, ou (b) supprimer le dossier et nettoyer les refs.
- **agent** : garder tel quel (binaire standalone shipped à part) ; mettre un README qui clarifie qu'il n'est PAS un service du platform.

### Référence

Batch #3 escalation (commit b81df014 notes).

---
