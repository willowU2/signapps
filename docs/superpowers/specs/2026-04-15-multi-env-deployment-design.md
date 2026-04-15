# Multi-Environment Deployment — Prod + Dev avec mises à jour sans impact utilisateur

**Date :** 2026-04-15
**Statut :** Design validé, prêt pour planification d'implémentation
**Auteurs :** Brainstorming Claude + Étienne

---

## 1. Contexte & Objectifs

### 1.1 Problème

SignApps Platform est une plateforme de 33 microservices Rust + frontend Next.js 16. Aujourd'hui, les déploiements se font manuellement via `scripts/start-all.sh` et `docker-compose.prod.yml`, sans distinction claire entre un environnement de production et un environnement de pré-production. Les mises à jour interrompent brutalement les utilisateurs.

### 1.2 Objectifs

1. **Deux environnements distincts** : `prod` (utilisateurs réels) et `dev/staging` (tests avant promotion)
2. **Mises à jour sans impact utilisateur non planifié** : le POC accepte une fenêtre de maintenance annoncée, l'architecture doit permettre d'évoluer vers du zero-downtime (Blue/Green) sans refonte
3. **Gestion administrative future** : tous les hooks architecturaux nécessaires pour piloter les déploiements, versions, feature flags, maintenance, configuration et clients on-premise depuis une UI admin
4. **Support du on-premise** : permettre l'installation SignApps chez des clients avec leur propre gestion d'environnements

### 1.3 Non-objectifs (POC)

- **Zero-downtime strict** : une fenêtre de maintenance (< 2 min) est acceptable
- **Migrations DB backward-compatible systématiques** : on accepte une fenêtre de maintenance pour les migrations lourdes
- **Canary deployments** : reporté à une phase post-Blue/Green
- **Admin UI fonctionnelle** : les APIs sont prêtes mais l'UI est reportée à la Phase 3

---

## 2. Décisions d'architecture

### 2.1 Topologie

| Phase | Topologie | Quand |
|---|---|---|
| **POC (phase A)** | 1 machine hébergeant prod + dev côte à côte | Immédiat |
| **Phase B** | 2 machines séparées (prod / dev) | Quand trafic réel justifie |
| **Phase E (en parallèle de A ou B)** | On-premise chez clients via installeur | Après Phase 1 stabilisée |

### 2.2 Séparation des environnements (POC)

| Axe | Choix | Motivation |
|---|---|---|
| **Domaines** | Sous-domaines : `app.signapps.io` (prod), `staging.signapps.io` (dev) | Propre, géré par `signapps-proxy`, compatible TLS |
| **Base de données** | Une instance PostgreSQL, deux bases : `signapps_prod`, `signapps_staging` | Économe en RAM pour POC, migration vers 2 instances en phase B |
| **Données dev** | Seed data via `scripts/seed-demo-data.sh` | RGPD-safe, reproductible |
| **Networks Docker** | Deux bridges distincts : `signapps-prod`, `signapps-staging` | Isolation réseau, seuls `proxy`, `postgres`, `deploy` sont dans les deux |
| **Ports** | prod : 3000-3099, dev : 4000-4099 | Évite les collisions sur la même machine |

### 2.3 Stratégie de déploiement

**POC (actif par défaut)** : maintenance window automatique lors du redémarrage.
- Déclenchement via CLI : `just deploy-prod v1.2.3`
- Durée typique : 30 s à 2 min
- Rollback automatique sur échec

**Phase B (évolution)** : Blue/Green sur 2 machines, activé via flag `DEPLOY_STRATEGY=blue_green`.

**Futur (post-POC)** : Canary avec feature flags pondérés, activé dans un 3e temps.

### 2.4 Migrations DB

Pas de contrainte backward-compatible strict. On accepte la fenêtre de maintenance pour les migrations lourdes.
Les migrations sont exécutées **dans une transaction atomique** : soit tout passe, soit rien.

⚠ **Limite acceptée** : si une migration n'est pas rétrocompatible, le rollback simple est impossible. Procédure manuelle de restauration backup DB documentée.

---

## 3. Composants

### 3.1 Nouveau service : `signapps-deploy` (port 3033)

**Rôle :** Orchestrateur de déploiement. Parle à Docker (via `bollard`), à la DB, au proxy, et expose une API pour l'admin UI future.

**Modes de fonctionnement :**
- **Mode CLI** (actif au POC) : commandes `deploy`, `rollback`, `status`
- **Mode API** (dormant par défaut, activé via `DEPLOY_API_ENABLED=true`) : REST endpoints protégés par rôle `superadmin`

**API REST (v1) :**

```
GET  /api/v1/deploy/envs                         → état des environnements
GET  /api/v1/deploy/envs/{env}/health            → santé détaillée (33 services)
GET  /api/v1/deploy/versions                     → versions déployables (tags ghcr.io)
POST /api/v1/deploy/envs/{env}/deploy            → déclenche un déploiement
POST /api/v1/deploy/envs/{env}/rollback          → rollback vers version précédente
POST /api/v1/deploy/envs/{env}/maintenance       → active/désactive maintenance
GET  /api/v1/deploy/history                      → historique
POST /api/v1/deploy/promote                      → promouvoir dev → prod
```

**Actions sous le capot :**
- Exécution via API Docker (`bollard`, déjà utilisé par `signapps-containers`)
- Écriture dans la table `deployments` et `deployment_audit_log`
- Émission d'événements via `PgEventBus`
- Lecture/écriture des feature flags via `signapps-tenant-config`

**Sécurité :** middleware `signapps-common::auth::require_role("superadmin")` sur toutes les routes API. Double confirmation textuelle requise pour actions prod (taper `"DEPLOY PROD v1.2.3"`).

### 3.2 Extension de `signapps-proxy`

**a) Middleware "maintenance mode"** : lit `cache:deploy:maintenance:{env}` (via `signapps-cache`). Si `true`, retourne HTTP 503 avec page HTML statique `/maintenance`.

**b) Routing par hostname** :
- `app.signapps.io` → backend prod (ports 3xxx)
- `staging.signapps.io` → backend dev (ports 4xxx)

### 3.3 Extension de `signapps-tenant-config`

**Deux nouvelles tables :**

```sql
CREATE TABLE feature_flags (
    id UUID PRIMARY KEY,
    key TEXT NOT NULL,
    env TEXT NOT NULL,              -- "prod" | "dev" | "all"
    enabled BOOLEAN DEFAULT false,
    rollout_percent INT DEFAULT 100,
    target_orgs UUID[],
    target_users UUID[],
    UNIQUE (key, env)
);

CREATE TABLE runtime_config (
    id UUID PRIMARY KEY,
    key TEXT NOT NULL,
    env TEXT NOT NULL,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    UNIQUE (key, env)
);
```

**Nouveau crate `signapps-feature-flags`** (dans `crates/`) exposant :
```rust
ff::is_enabled("deploy.enabled", &ctx)  // ctx = { env, user_id, org_id }
ff::variant("calendar.layout", &ctx)     // pour A/B futur
```

Cache local TTL 60s (via `signapps-cache`) + invalidation par `PgEventBus` quand un flag change.

### 3.4 Endpoint `/version` sur chaque service

Ajouté dans `signapps-common` comme middleware réutilisable. Généré au compile-time via `build.rs` et `vergen`.

```
GET /version
{
  "service": "signapps-identity",
  "version": "1.2.3",
  "git_sha": "8d6ea845",
  "build_time": "2026-04-15T10:30:00Z",
  "env": "prod"
}
```

### 3.5 Tables `deployments` et `deployment_audit_log` (DB prod)

```sql
CREATE TABLE deployments (
    id UUID PRIMARY KEY,
    env TEXT NOT NULL,
    version TEXT NOT NULL,
    git_sha TEXT NOT NULL,
    triggered_by UUID REFERENCES users(id),
    triggered_at TIMESTAMPTZ NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    status TEXT NOT NULL,  -- "pending" | "running" | "success" | "failed" | "rolled_back"
    previous_version TEXT,
    migrations_applied TEXT[],
    duration_seconds INT,
    error_message TEXT,
    logs_path TEXT
);

CREATE INDEX idx_deployments_env_time ON deployments (env, triggered_at DESC);

CREATE TABLE deployment_audit_log (
    id UUID PRIMARY KEY,
    deployment_id UUID REFERENCES deployments(id),
    action TEXT NOT NULL,
    actor_id UUID REFERENCES users(id),
    actor_ip INET,
    actor_user_agent TEXT,
    payload JSONB,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_deployment ON deployment_audit_log (deployment_id);
CREATE INDEX idx_audit_actor_time ON deployment_audit_log (actor_id, timestamp DESC);
```

**Conservation audit log :** 7 ans (aligné `signapps-compliance`). Réplication vers fichier texte `data/logs/deploy-audit-YYYY-MM.log` pour robustesse.

### 3.6 Page frontend `/maintenance`

**Route :** `client/src/app/maintenance/page.tsx`

- Page statique pré-rendue, aucune dépendance API backend
- Servie **directement** par le proxy (contourne Next.js) pendant un déploiement
- Auto-refresh toutes les 30 s
- Fallback sans JS via `<meta http-equiv="refresh" content="30">`

### 3.7 Binaire `signapps-installer` (Phase 4)

Binaire Rust unique pour installation on-premise :

```bash
signapps-installer init           # crée /etc/signapps/config.toml
signapps-installer start          # lance docker-compose prod
signapps-installer update v1.2.3  # met à jour vers version précise
signapps-installer status         # santé des 33 services
signapps-installer backup         # backup DB + volumes
```

Embarque le `docker-compose.prod.yml` dans le binaire, utilise l'API Docker locale.

---

## 4. Flux de données

### 4.1 Flux de déploiement basique (POC, actif par défaut)

Déclenché via CLI : `just deploy-prod v1.2.3`

```
1. INSERT deployments (status=pending)
2. docker pull ghcr.io/.../signapps-platform:v1.2.3
3. cache:deploy:maintenance:prod = true
4. signapps-proxy sert /maintenance
5. docker compose up -d (recrée les 33 services)
6. Attend healthchecks verts (polling 2s, timeout 5 min)
7. sqlx migrate run sur signapps_prod
8. cache:deploy:maintenance:prod = false
9. UPDATE deployments SET status=success, completed_at=now()
10. Log final → data/logs/deploy-v1.2.3.log
```

**Sur échec** à n'importe quel step :
- Rollback automatique vers `previous_version`
- Maintenance reste ON jusqu'à retour healthy
- `UPDATE deployments SET status=failed, error_message=...`
- Notification admin via `signapps-notifications`

### 4.2 Flux de promotion dev → prod (Phase 3)

Activé via feature flag `FEATURE_PROMOTION_ENABLED=true`.

1. Admin clique "Promouvoir dev v1.2.3 → prod"
2. `signapps-deploy` vérifie que dev est healthy
3. Vérifie que `v1.2.3` existe sur ghcr.io
4. Vérifie qu'aucun déploiement prod n'est en cours (lock advisory PG)
5. Crée une "release approval request"
6. Attend N approbations (N configurable, 1 par défaut)
7. Exécute le flux 4.1 sur `env=prod`
8. Émet `deployment.promoted` sur `PgEventBus`

### 4.3 Flux de rollback (Phase 3)

1. Admin clique "Rollback prod (v1.2.3 → v1.2.2)"
2. Lit `deployments.previous_version` pour l'env courant
3. Déclenche flux 4.1 avec `v1.2.2`
4. `UPDATE deployments SET status=rolled_back WHERE id = current`

⚠ **Si migrations non-rétrocompatibles** : UI affiche avertissement explicite, procédure manuelle de restauration backup.

### 4.4 Flux d'activation feature flag (Phase 3)

1. Admin modifie : `calendar.new_ui` = ON pour 10% des users en dev
2. `PATCH /api/v1/feature-flags/calendar.new_ui`
3. UPDATE `feature_flags`
4. `PgEventBus` émet `feature_flag.updated`
5. Tous les services invalident cache local (TTL remis à 0)
6. Prochaine requête : `ff::is_enabled()` évalue `hash(user_id) % 100 < 10`

Changement propagé en < 1 s sur les 33 services. Pas de redéploiement.

### 4.5 Flux de maintenance planifiée (Phase 3)

1. Admin programme maintenance : date, durée, message
2. `INSERT scheduled_maintenance`
3. `signapps-notifications` prévient users 24h avant (bannière UI)
4. À l'heure dite, `signapps-deploy` active automatiquement le flag maintenance
5. Après la durée, désactive automatiquement
6. Admin peut terminer plus tôt via "fin anticipée"

### 4.6 Préservation des sessions utilisateur

**Principe :** Les JWT restent valides tant que `JWT_PUBLIC_KEY_PEM` ne change pas.

| Scénario | Comportement |
|---|---|
| User connecté pendant maintenance | Voit page `/maintenance`, auto-refresh, retour à l'app avec session reconnectée |
| WebSocket ouvert (chat, docs, meet) | Se coupe, reconnexion auto côté client avec jitter |
| Upload en cours | Échoue, affiche "réessayer", resume si supporté |
| Tâche longue backend | Stockée en DB (`jobs` table), reprise au restart du service |

**Prérequis frontend (à valider dans le plan d'implémentation) :**
- Intercepteur Axios sur 503 : toast "Mise à jour en cours" + retry exponentiel
- WebSocket clients : reconnexion avec jitter (évite thundering herd)

---

## 5. Sécurité & Gestion d'erreurs

### 5.1 Matrice des erreurs au déploiement

| Erreur | Détection | Réaction | Impact user |
|---|---|---|---|
| Pull image échoue | `docker pull` exit code | Abort, maintenance OFF | ~0 |
| Timeout healthcheck (> 5 min) | Polling `/health` | Rollback auto | +1 min maintenance |
| Échec migration DB | `sqlx migrate` exit code | Rollback auto (transaction atomique) | Maintenance prolongée |
| Disque plein | `df` check pré-deploy | Abort, alerte | ~0 |
| RAM insuffisante | `free -m` (< 20% libre) | Abort, propose de kill env dev | ~0 |
| Corruption PostgreSQL | `pg_isready` échoue | Arrêt total, alerte critique | Downtime manuel |
| Race condition (2 deploys) | `pg_try_advisory_lock(1337)` | 2e reçoit `409 Conflict` | ~0 |
| Secrets invalides | Service refuse boot | Rollback auto | Maintenance prolongée |

**Principe :** toute erreur met l'env en maintenance et alerte l'admin.

### 5.2 Rôles & permissions

| Action | Rôle minimum | Double confirmation |
|---|---|---|
| Voir état des envs | `admin` | Non |
| Déployer **dev** | `admin` | Non |
| Déployer **prod** | `superadmin` | Oui (`"DEPLOY PROD v1.2.3"`) |
| Rollback **dev** | `admin` | Non |
| Rollback **prod** | `superadmin` | Oui |
| Activer maintenance | `superadmin` | Non |
| Modifier feature flag | `admin` | Non |
| Approuver release | `superadmin` | Oui |

### 5.3 Protection contre accidents

- **Double confirmation textuelle** pour actions prod
- **Rate limit** : max 3 déploiements prod / heure / admin
- **Lock advisory PG** : un seul déploiement simultané par env

### 5.4 Secrets

| Secret | Stockage | Rotation |
|---|---|---|
| `JWT_*_KEY_PEM` | `.env.prod` (mode 600) | Manuelle |
| `POSTGRES_PASSWORD` | `.env.prod` | Manuelle |
| `GHCR_TOKEN` | Env machine hôte, jamais en base | À chaque rotation GitHub PAT |
| `LDAP_ENCRYPTION_KEY` | `signapps-keystore` | Procédure keystore |
| Webhooks deploy | `signapps-keystore` | Auto 90 jours |

Aucun secret ne transite via l'admin UI ou l'API `signapps-deploy`.

### 5.5 Observabilité

Chaque déploiement émet :
- **Logs structurés** : `tracing::info` avec span `deployment_id`
- **Métriques Prometheus** (via `signapps-metrics`) :
  - `deployment_duration_seconds{env, version, status}` (histogram)
  - `deployment_total{env, status}` (counter)
  - `deployment_in_progress{env}` (gauge)
- **Événements `PgEventBus`** : `deployment.started`, `deployment.maintenance_on`, `deployment.completed`, `deployment.failed`
- **Notifications admin** (via `signapps-notifications`) : échec → email + toast UI

---

## 6. Tests

### 6.1 Tests unitaires (Rust)

| Cible | Approche |
|---|---|
| Logique orchestration | Tests purs `#[cfg(test)]` |
| Interaction Docker API | `wiremock` (mock HTTP bollard) |
| Feature flag evaluation | Distribution hash sur 10k user_ids, dérive < 2% |
| Migration runner | `testcontainers-rs` (Postgres éphémère) |

**Couverture cible `signapps-deploy` :** > 80%.

### 6.2 Tests d'intégration

| Scénario | Outil | Fréquence |
|---|---|---|
| Déploiement dev complet | `cargo nextest` + docker-compose test | Chaque PR |
| Rollback auto simulé | Tests dédiés | Chaque PR |
| Promotion dev → prod | E2E 2 stacks compose test | Chaque PR |
| Double confirmation + rate limit | Tests API | Chaque PR |
| Migration backward/forward | Fixtures SQL | Chaque PR migrations |

### 6.3 Tests E2E (Playwright)

| Scénario | Fréquence |
|---|---|
| Admin voit état des envs | Chaque PR frontend |
| Admin déclenche deploy dev, suit progression | Nightly |
| User voit page `/maintenance` | Chaque PR |
| WebSocket reconnecte après maintenance | Nightly |

### 6.4 Tests de charge (avant phase B)

- 100 users connectés pendant maintenance → reconnexion < 3s
- 1000 uploads simultanés interrompus → reprise propre
- Durée réelle d'un déploiement sans migration → cible < 2 min

Outils : `k6` + scripts WebSocket custom.

### 6.5 Mutation testing

Sur `signapps-deploy` et `signapps-tenant-config::feature_flags` : > 70% mutants tués.

---

## 7. Phasing

### Phase 1 — Socle minimum (POC, ~1 sprint)

**Objectif :** Déployer en prod avec maintenance window via CLI.

1. Migrations SQL `deployments` + `deployment_audit_log`
2. Endpoint `/version` dans `signapps-common`
3. Middleware "maintenance mode" + page `/maintenance`
4. Service `signapps-deploy` en mode CLI uniquement :
   - `deploy --env prod --version v1.2.3`
   - `rollback --env prod`
   - `status --env prod`
5. Recette `just deploy-prod v1.2.3`
6. Rollback auto sur échec
7. Tests unitaires + 2 E2E (happy path + rollback)

**Critère de fin :** `just deploy-prod v1.2.3` end-to-end sur machine test, maintenance window propre.

### Phase 2 — Environnement dev + promotion (~1 sprint)

1. `docker-compose.staging.yml` (ports 4xxx)
2. Routage hostname dans proxy
3. Seed data pour dev (extension `seed-demo-data.sh`)
4. Recettes `just deploy-dev`, `just promote-to-prod`
5. Table `scheduled_maintenance` + worker
6. CI/CD : `main` → push ghcr.io + tag `git-cliff`

**Critère de fin :** workflow "dev d'abord → promote to prod" via CLI.

### Phase 3 — Admin UI

1. Activation API `signapps-deploy` (`DEPLOY_API_ENABLED=true`)
2. 6 pages admin : Environnements, Versions, Feature Flags, Maintenance, Config runtime, Clients on-premise
3. WebSocket streaming logs en direct
4. Double confirmation UI actions prod
5. Feature flags via UI

**Critère de fin :** admin gère tout via UI, CLI en secondaire.

### Phase 4 — On-premise (indépendante de 2 et 3)

1. Binaire `signapps-installer`
2. Embed `docker-compose.prod.yml`
3. Commandes `init`, `start`, `update`, `status`, `backup`
4. Doc installation on-premise
5. (Plus tard) télémétrie anonymisée

**Critère de fin :** client installe SignApps en 10 min.

### Phase 5 — Blue/Green (post-POC, phase B infra)

- `signapps-deploy` pilote 2 machines via SSH + Docker API distante
- Double stack avec bascule proxy
- Activé via `DEPLOY_STRATEGY=blue_green`

---

## 8. Dépendances entre phases

```
Phase 1 (socle)
    ↓
    ├──→ Phase 2 (dev + promotion)
    │        ↓
    │        └──→ Phase 3 (admin UI)
    │
    └──→ Phase 4 (on-premise) — indépendante dès Phase 1 stable

Phase 5 (Blue/Green) — démarre après Phase 3 + passage infra phase B
```

---

## 9. Risques & Mitigations

| Risque | Probabilité | Mitigation |
|---|---|---|
| Migrations non rétrocompatibles cassent rollback | Moyenne | Alerte UI, doc procédure backup/restore |
| Rate limit `ghcr.io` | Faible | Cache local `/var/lib/docker` + retry exponentiel |
| Deploy consomme toute la RAM (POC) | Moyenne | Check `free -m` pré-deploy, abort si < 20% libre |
| User bloqué sans JS | Faible | `<meta refresh>` en fallback |
| Rollback en boucle | Faible | Rate limit API + lock advisory |
| Feature flag mal configuré | Moyenne | Preview UI "X users affectés" avant save |
| Perte audit trail (DB corruption) | Faible | Réplication vers fichier texte `data/logs/deploy-audit-YYYY-MM.log` |

---

## 10. Glossaire

- **Env** : environnement. Valeurs : `prod`, `dev` (alias `staging`).
- **Stack** : ensemble des 33 services + frontend pour un env donné.
- **Deploy** : action de déployer une version sur un env.
- **Promote** : copier la version de dev vers prod.
- **Rollback** : revenir à la version précédente.
- **Feature flag** : drapeau runtime pour activer/désactiver une feature.
- **Maintenance mode** : page statique servie pendant qu'un deploy est en cours.
- **POC phase A** : 1 machine (prod + dev).
- **Phase B** : 2 machines séparées.
- **Phase E** : on-premise chez client.

---

## 11. Références

- `docker-compose.prod.yml` (existant)
- `docker-compose.dev.yml` (existant)
- `docs/architecture/inter-service-communication.md` (PgEventBus)
- CLAUDE.md section "Inter-service communication"
- `crates/signapps-common` (middleware auth, AppError)
- `crates/signapps-cache` (cache TTL, maintenance flag)
- `crates/signapps-keystore` (secrets)
- `services/signapps-proxy` (routing hostname, TLS/ACME)
- `services/signapps-tenant-config` (extension feature flags)
- `services/signapps-notifications` (alertes admin, bannières users)
- `services/signapps-compliance` (audit log 7 ans)
