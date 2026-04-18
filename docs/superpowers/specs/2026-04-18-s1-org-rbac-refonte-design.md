# S1 — Refonte holistique Org + RBAC + AD sync + Provisioning + Sharing — Design Spec

**Date :** 2026-04-18
**Statut :** Design validé, prêt pour writing-plans
**Auteurs :** Brainstorming Claude + Étienne
**Référence interne :** consolide les 9 specs org/AD existantes (2026-04-04 → 2026-04-11). Partie 1 du Track A→B→C→D validé (S1 → S2 → S3).

---

## 1. Contexte & Objectifs

### 1.1 Problème

La plateforme a 9 specs org/AD dispersées (org-structure-enterprise, org-governance-boards, org-ad-fusion, org-ad-sync, ad-org-aware, all-services-org-aware, mail-org-aware, org-role-aware-views, projects-org-aware) et du code fragmenté dans 3 endroits (`signapps-org`, `signapps-workforce::ad*`, `signapps-identity::oauth`). Aucune de ces specs n'est pleinement opérationnelle end-to-end :

- **Source de vérité ambiguë** : qui entre un user — `signapps-identity` (OAuth users), `signapps-workforce` (employees), `signapps-org` (org_nodes), AD/LDAP ? Les 4 existent et divergent.
- **RBAC fragmenté** : chaque service a sa propre logique de check (admin middleware, tenant_id, rôle local, ACL locale). Pas de résolveur unique.
- **AD sync partiel** : `signapps-workforce::ad_sync.rs` existe mais n'est pas activé par défaut ; direction non configurable ; conflits non résolus.
- **Provisioning manuel** : créer un user = opération sur `signapps-identity` seul ; mailbox/drive/calendar ne se créent pas en cascade.
- **Pas de sharing ponctuel** : pas de token signé pour donner accès temporaire à une ressource.

### 1.2 Objectifs mesurables

| Axe | Baseline (2026-04-18) | Cible post-S1 |
|---|---|---|
| Sources de vérité users/org | 4 (identity, workforce, org, AD) | **1** (`signapps-org`, AD miroir) |
| RBAC resolvers uniques | ~34 (un par service, ad-hoc) | **1** (`signapps-common::rbac`) |
| Services consommant le résolveur unifié | 0 | **34** |
| AD sync direction configurable | non | **oui** (org→AD, AD→org, bidirectional) |
| Provisioning user cross-service | manuel | **automatique** (événement `user.created` → mailbox, drive, calendar, quotas) |
| Access grants (tokens signés) | 0 | **opérationnels** (tenants, ressources, perms, expiration) |
| Couverture E2E org→RBAC | 0 test | **8 scénarios Playwright** |
| Dégraissage workforce (retour à HR pur) | workforce porte AD+GPO+org | **workforce = HR pur** |

### 1.3 Non-goals

- Pas de nouveau UI admin org massif (l'existant `/admin/org-structure` reste).
- Pas de migration des user existants cross-tenant en live (les dumps SQL restent).
- Pas d'intégration SAML/OIDC nouvelle (SSO actuel conservé).
- Pas de refonte `signapps-identity` OAuth (reste en place).
- Pas de feature flags LDAP custom (Kanidm + AD natif via crate ldap3).
- Pas de GPOs poussées vers AD natif (bridge P3 — stay org-managed côté SignApps).

---

## 2. Paramètres validés

| Axe | Choix |
|---|---|
| Niveau | **B — Refonte holistique** (5 semaines, J1-J25) |
| Ordonnancement | **B.1 Top-down** (modèle → API → AD → RBAC → sharing) |
| Source de vérité | **signapps-org** (PostgreSQL canonique) ; AD = miroir |
| Workforce | réduit à HR pur (absences, paie, learning, reviews) |
| RBAC | 1 trait unique `OrgPermissionResolver` dans `signapps-common::rbac` |
| Sync AD | bidirectionnel configurable par tenant (`AD_SYNC_MODE = org_to_ad | ad_to_org | bidirectional`) |
| Provisioning | événementiel via `PgEventBus` (topic `org.user.*`) |
| Access grants | tokens HMAC-signés, validés par le resolver |
| Gouvernance | **Auto-chain** (cf. `feedback_auto_chain.md`) |

---

## 3. Architecture cible

```
┌──────────────────────────────────────────────────────────────────┐
│  signapps-db  (shared crate)                                     │
│  ├── models/org/                  (modèle canonique unifié)      │
│  │   ├── node.rs                  (OrgNode, Entity, Unit, …)     │
│  │   ├── person.rs                (Person = human entity)         │
│  │   ├── assignment.rs            (3-axis: structure/focus/grp)   │
│  │   ├── board.rs                 (gouvernance)                   │
│  │   ├── gpo.rs                   (Policy, PolicyBinding)         │
│  │   └── access_grant.rs          (sharing signé)                 │
│  ├── repositories/org/            (repos R/W)                     │
│  └── migrations/400-425_org_*.sql (refonte schéma)                │
└──────────────────────────────────────────────────────────────────┘
                              │
      ┌───────────────────────┼───────────────────────────────────┐
      ▼                       ▼                                   ▼
┌────────────────────┐  ┌──────────────────────┐   ┌─────────────────────┐
│ signapps-org :3026 │  │ signapps-common      │   │ signapps-workforce  │
│ ├── nodes          │  │ ├── rbac/            │   │ ├── absences        │
│ ├── assignments    │  │ │   ├── resolver.rs  │   │ ├── payroll         │
│ ├── boards         │  │ │   ├── matcher.rs   │   │ ├── learning        │
│ ├── policies (GPO) │  │ │   ├── middleware.rs│   │ └── reviews         │
│ ├── ad_sync        │  │ │   └── cache.rs     │   │  (HR pur — le reste │
│ ├── access_grants  │  │ └── active_stack     │   │   migré vers org)   │
│ └── provisioning   │  └──────────┬───────────┘   └─────────────────────┘
└──────────┬─────────┘             │
           │ events (PgEventBus)   │
           │ topics: org.user.*    │
           │         org.policy.*  │
           │         org.grant.*   │
           ▼                       ▼
┌──────────────────────────────────────────────────────────┐
│  34 services (identity, mail, drive, calendar, …)        │
│  chaque handler :                                        │
│    1. middleware `rbac::require(resource, perm)`         │
│    2. handler logique métier                             │
│    3. événements entrants : créer/supprimer sub-state    │
└──────────────────────────────────────────────────────────┘
           │
           ▼ ldap3 (Rust)
┌──────────────────────────────────────────────────────────┐
│  AD / LDAP / Kanidm                                      │
│  miroir bidirectionnel ; direction par tenant            │
└──────────────────────────────────────────────────────────┘
```

---

## 4. Semaine 1 — Modèle canonique unifié (J1-J5)

### 4.1 Schéma SQL

Nouvelles tables (remplacent/consolident workforce_org_nodes, identity_users partiel, assignments existants) :

```sql
-- Migration 400: canonical org nodes
CREATE TABLE IF NOT EXISTS org_nodes (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    kind          TEXT NOT NULL,          -- 'root' | 'entity' | 'unit' | 'position' | 'role'
    parent_id     UUID REFERENCES org_nodes(id) ON DELETE SET NULL,
    path          LTREE NOT NULL,         -- materialized path for fast subtree queries
    name          TEXT NOT NULL,
    slug          TEXT,
    attributes    JSONB NOT NULL DEFAULT '{}',
    active        BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_org_nodes_tenant_kind ON org_nodes(tenant_id, kind);
CREATE INDEX IF NOT EXISTS idx_org_nodes_path ON org_nodes USING GIST (path);

-- Migration 401: canonical persons (human entities)
CREATE TABLE IF NOT EXISTS org_persons (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    user_id       UUID UNIQUE,            -- link to identity.users when applicable
    email         TEXT NOT NULL,
    first_name    TEXT,
    last_name     TEXT,
    dn            TEXT,                   -- AD Distinguished Name (mirror)
    attributes    JSONB NOT NULL DEFAULT '{}',
    active        BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Migration 402: assignments (3-axis: structure/focus/group)
CREATE TABLE IF NOT EXISTS org_assignments (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    person_id     UUID NOT NULL REFERENCES org_persons(id) ON DELETE CASCADE,
    node_id       UUID NOT NULL REFERENCES org_nodes(id) ON DELETE CASCADE,
    axis          TEXT NOT NULL,          -- 'structure' | 'focus' | 'group'
    role          TEXT,                   -- free text ("manager", "member", …)
    is_primary    BOOLEAN NOT NULL DEFAULT false,
    start_date    DATE,
    end_date      DATE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_org_assignments_person ON org_assignments(person_id, axis);
CREATE INDEX IF NOT EXISTS idx_org_assignments_node ON org_assignments(node_id);

-- Migration 403: GPOs (Group Policy Objects — SignApps native, not AD)
CREATE TABLE IF NOT EXISTS org_policies (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    name          TEXT NOT NULL,
    description   TEXT,
    permissions   JSONB NOT NULL,         -- [{resource, actions[]}]
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org_policy_bindings (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id     UUID NOT NULL REFERENCES org_policies(id) ON DELETE CASCADE,
    node_id       UUID NOT NULL REFERENCES org_nodes(id) ON DELETE CASCADE,
    inherit       BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Migration 404: boards (governance) — migrated from workforce_org_boards
CREATE TABLE IF NOT EXISTS org_boards (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id       UUID NOT NULL REFERENCES org_nodes(id) ON DELETE CASCADE UNIQUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS org_board_members (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id          UUID NOT NULL REFERENCES org_boards(id) ON DELETE CASCADE,
    person_id         UUID NOT NULL REFERENCES org_persons(id) ON DELETE CASCADE,
    role              TEXT NOT NULL,
    is_decision_maker BOOLEAN NOT NULL DEFAULT false,
    sort_order        INT NOT NULL DEFAULT 0
);

-- Migration 405: access grants (shared links, invites with scope)
CREATE TABLE IF NOT EXISTS org_access_grants (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    granted_by    UUID NOT NULL REFERENCES org_persons(id),
    granted_to    UUID REFERENCES org_persons(id),      -- nullable for public links
    resource_type TEXT NOT NULL,                         -- 'document' | 'folder' | 'calendar' | …
    resource_id   UUID NOT NULL,
    permissions   JSONB NOT NULL,                        -- ["read", "comment"]
    token_hash    TEXT NOT NULL UNIQUE,                  -- HMAC of grant JSON
    expires_at    TIMESTAMPTZ,
    revoked_at    TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_grants_resource ON org_access_grants(resource_type, resource_id);
```

### 4.2 Types Rust dans `signapps-db/src/models/org/`

Un fichier par entité : `OrgNode`, `Person`, `Assignment` (enum `Axis`), `Policy`, `PolicyBinding`, `Board`, `BoardMember`, `AccessGrant`. Tous `#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, utoipa::ToSchema)]` avec rustdoc.

### 4.3 Repositories

`org_node_repository.rs`, `person_repository.rs`, etc. — pattern CRUD + queries par tenant/subtree/axis. Tests unitaires avec `sqlx::test`.

---

## 5. Semaine 2 — API Org consolidée (J6-J10)

### 5.1 Migration code

- **Vers `signapps-org`** : déplacer depuis `signapps-workforce` les fichiers `ad*.rs`, `boards.rs`, `groups.rs`, `policies.rs`, `delegations.rs`, `org/`, `employees/`. Les handlers deviennent CRUD sur les nouvelles tables.
- **Dans `signapps-workforce`** : il ne reste que `attendance.rs`, `expenses.rs`, `learning.rs`, `lms.rs`, `my_team.rs` (pure HR), plus la partie `coverage.rs` si elle lit du HR.

### 5.2 Endpoints principaux (tous `/api/v1/org/...`)

```
POST   /nodes                        créer un nœud (entity/unit/position)
GET    /nodes?tenant_id=&kind=       lister avec filtre
GET    /nodes/:id                    détail
PATCH  /nodes/:id                    update
DELETE /nodes/:id                    archive

POST   /persons                      créer personne (événement emit)
GET    /persons/:id/assignments      3-axis assignments
POST   /persons/:id/assignments      attacher à un nœud

POST   /policies                     créer GPO
POST   /policies/:id/bindings        lier à un nœud (avec inherit)

POST   /grants                       issue access grant (signed token)
GET    /grants/verify?token=         valider un token
DELETE /grants/:id                   revoke
```

### 5.3 OpenAPI + tests

Tous décorés `#[utoipa::path]`, response schemas dérivés. Tests intégration `cargo test -p signapps-org`.

---

## 6. Semaine 3 — AD sync bidirectionnel (J11-J15)

### 6.1 Module `signapps-org::ad_sync`

Configuration par tenant :

```rust
pub struct AdSyncConfig {
    pub tenant_id: Uuid,
    pub mode: AdSyncMode,                         // OrgToAd | AdToOrg | Bidirectional | Off
    pub ldap_url: String,                         // "ldap://10.0.0.10:389"
    pub bind_dn: String,
    pub bind_password: EncryptedField,            // via signapps-keystore
    pub base_dn: String,                          // "DC=acme,DC=local"
    pub user_filter: Option<String>,              // default: "(objectClass=user)"
    pub ou_filter: Option<String>,                // default: "(objectClass=organizationalUnit)"
    pub sync_interval_sec: u64,                   // default: 300
    pub conflict_strategy: ConflictStrategy,      // OrgWins | AdWins | Manual
}
```

### 6.2 Cycle sync

1. **Fetch AD** : via `ldap3` crate, paginé. Timestamp `uSNChanged` pour incrémental.
2. **Diff** : comparer aux entries `org_persons` / `org_nodes` (via `dn` column).
3. **Appliquer** : selon `mode` + `conflict_strategy`.
4. **Journaliser** : table `org_ad_sync_log` (avant/après par entry, décision).
5. **Émettre** : événements `org.person.synced_from_ad`, `org.policy.pushed_to_ad`.

### 6.3 Sécurité

- `bind_password` chiffré via `signapps-keystore`.
- Audit log complet (qui / quand / quoi).
- Limite débits pour éviter DoS sur l'AD.
- Bouton "dry-run" dans UI admin avant activation.

---

## 7. Semaine 4 — RBAC partout (J16-J20)

### 7.1 Trait unique `OrgPermissionResolver`

```rust
// crates/signapps-common/src/rbac/resolver.rs
#[async_trait]
pub trait OrgPermissionResolver: Send + Sync {
    async fn check(
        &self,
        who: PersonRef,
        resource: ResourceRef,
        action: Action,
    ) -> Result<Decision, RbacError>;

    async fn grants_for(
        &self,
        who: PersonRef,
        resource: ResourceRef,
    ) -> Result<Vec<Grant>, RbacError>;
}

pub enum Decision {
    Allow { source: DecisionSource },     // policy binding, board member, access grant, owner
    Deny { reason: DenyReason },
}

pub enum DecisionSource {
    OwnerOfResource,
    BoardOfContainingNode(Uuid),
    PolicyBinding { policy_id: Uuid, node_id: Uuid },
    AccessGrant { grant_id: Uuid },
    Admin,
}
```

### 7.2 Implémentation canonique : `OrgClient`

Impl du trait dans `signapps-org::rbac_client` qui appelle en local (single-binary via `ServiceHub`) ou HTTP legacy. Cache moka 60s par `(who, resource, action)`.

### 7.3 Middleware Axum

```rust
// signapps-common::rbac::middleware::require
pub fn require(
    action: Action,
    resource_extractor: impl Fn(&Request) -> ResourceRef,
) -> impl tower::Layer<...>
```

Usage dans chaque service :

```rust
Router::new()
    .route("/api/v1/documents/:id", get(get_doc))
    .layer(rbac::require(Action::Read, |req| ResourceRef::Document(path_id(req))));
```

### 7.4 Migration des 34 services

Remplacer les middleware ad-hoc (`require_admin`, `check_tenant`, etc.) par `rbac::require(...)`. Les middlewares custom spécifiques au service (ex: rate limits) restent.

### 7.5 Tests

- Unit : `OrgPermissionResolver` mock dans `signapps-common`.
- Integration : un test par combinaison `(decision_source × action × resource_type)` dans `signapps-org`.
- Cross-service : 1 scénario E2E par batch de 5 services (8 scénarios).

---

## 8. Semaine 5 — Sharing + Provisioning (J21-J25)

### 8.1 Access grants API

```
POST   /api/v1/org/grants
  body: { resource_type, resource_id, granted_to?, permissions, expires_at? }
  res:  { id, token, url: "https://host/g/<token>" }

GET    /g/:token
  → redirige vers la ressource avec cookie `grant_token` signé, consommé par le resolver au check suivant.
```

Token = HMAC-SHA256 sur `{id, resource, perms, expires_at}` avec secret tenant.

### 8.2 Provisioning événementiel

Topic `org.user.created` :

```
signapps-org publishes { person_id, email, tenant_id }
  ↓
signapps-identity  → create identity.user row + default tenant role
signapps-mail      → create mailbox + default folders
signapps-storage   → create home folder + quota
signapps-calendar  → create default calendar
signapps-chat      → add to #general
signapps-gamification → init XP/badges
```

Chaque service abonné à `PgEventBus`. Échec non bloquant (retry par `webhook-dispatcher`). Les services sans état spécifique (metrics, notifications) n'ont pas besoin d'abonnement.

Topic `org.person.deactivated` : suspend mailbox, freeze drive quota, retire membres board, invalidates access grants actifs.

### 8.3 Dashboard admin

Page `/admin/org-ops` (déjà existante) étendue :
- Activity feed AD sync
- Pending provisioning jobs + retry UI
- Active access grants table + revoke
- Policy bindings visualizer

---

## 9. Data flow (3 flows clés)

### 9.1 Create user

1. Admin appelle `POST /api/v1/org/persons` (via UI `/admin/org-structure`).
2. `signapps-org` crée `org_persons`, `org_assignments` (axis=structure), publie `org.user.created`.
3. `signapps-identity` crée `identity.users` row avec défaut tenant role.
4. `signapps-mail`/`storage`/`calendar`/`chat` consomment l'événement → créent mailbox/drive/calendar/canal.
5. Si `AdSyncMode::OrgToAd` actif : `signapps-org::ad_sync` pousse l'user vers AD (worker asynchrone).
6. UI admin reçoit notification temps réel via WebSocket.

### 9.2 Request check

1. Requête client `GET /api/v1/documents/:id`.
2. Middleware `rbac::require(Action::Read, Document(id))` dans `signapps-docs`.
3. Appelle `OrgPermissionResolver::check(claims.person, doc, Read)`.
4. Resolver :
   - Cache hit (60s) ? Return.
   - Check owner → OK.
   - Check node path → policies appliquent ?
   - Check active `access_grants` ?
   - Board member du nœud parent ?
   - Else `Deny`.
5. Handler continue ou retourne 403.

### 9.3 Share document

1. User clique "Partager" UI docs.
2. `POST /api/v1/org/grants { resource_type: document, resource_id, permissions: [read], expires_at: now+7d }`.
3. `signapps-org` crée `org_access_grants`, génère token HMAC.
4. Retour URL `https://host/g/<token>`.
5. Destinataire clique → handler `/g/:token` valide + set cookie `grant_token`.
6. Requête suivante sur ressource → resolver voit le cookie, check grant → allow.

---

## 10. Error handling

- **RBAC deny** : renvoi `403 Forbidden` RFC 7807 avec `reason` (sans fuite d'info sensible).
- **AD down** : sync tente 3× puis parking en `org_ad_sync_log` avec `status=pending_retry`. Pas de blocage des autres flux.
- **Provisioning partiel** : si mailbox création échoue, log + retry via dispatcher ; user reste fonctionnel sans mailbox.
- **Access grant expiré/révoqué** : `403` avec `reason=GrantExpired` ou `GrantRevoked`.
- **Conflit AD bidirectionnel** : selon `ConflictStrategy`, applique la politique ; si `Manual`, row mis en pending pour décision admin.
- **Resolver timeout** : fail-open configurable (`RBAC_FAIL_OPEN=false` par défaut → deny).

---

## 11. Migration données

Pas de dual-write : aucun environnement de production à préserver à ce stade.
On fait un **hard-cut** en fin de Semaine 2 :

### 11.1 Hard-cut (fin Sem 2, J10)

- Script `migrations/426_migrate_workforce_to_org.sql` (idempotent) :
  - Copie `workforce_org_nodes` → `org_nodes`.
  - Copie `workforce_org_boards` + members → `org_boards` + `org_board_members`.
  - Copie `workforce_employees` (en tant que persons) → `org_persons`.
  - Mappe les assignments existants dans `org_assignments` (axis = `structure`).
- Les tables workforce legacy sont **droppées** dans le même migration (pas de dual-write, pas de coexistence).
- Les endpoints workforce RBAC (`/workforce/org/*`, `/workforce/boards/*`, etc.) sont supprimés du routeur — retour 404 natif Axum.
- Scripts de seeding (`scripts/seed-demo-data.sh`) mis à jour pour alimenter les nouvelles tables (sera repris en S2 Track C).

### 11.2 Validation post-cut

- `just test --workspace` vert.
- Smoke manuel sur `/admin/org-structure` + login admin.
- Boot test `signapps-platform --test boot` vert (aucun service ne crashe au démarrage).

---

## 12. Testing

| Couche | Test | Cible |
|---|---|---|
| Modèle | `cargo test -p signapps-db --test org_models` | 100% CRUD OK |
| RBAC unit | `cargo test -p signapps-common --test rbac` | matrice `source × action × resource` |
| Org API | `cargo test -p signapps-org` | tous endpoints ok |
| AD sync | `cargo test -p signapps-org --test ad_sync -- --ignored` | dry-run + bidirectional + conflict |
| Provisioning | `cargo test --test provisioning_e2e -- --ignored` | create user → mailbox/drive apparaissent |
| E2E Playwright | `client/e2e/s1-org-rbac.spec.ts` | 8 scénarios cross-service |

Les 8 scénarios E2E :
1. Admin crée user → mailbox + drive visibles < 5 s.
2. User A share doc à User B → B accède sans inviter.
3. Admin change org node policy → revoke accès ancien manager.
4. User external reçoit grant via URL → accès lecture seule, expire J+7.
5. AD sync ajoute user AD → apparaît dans org, pas de duplicata.
6. Board member → droits automatiques sur sub-nodes.
7. Move user cross-unit → RBAC se met à jour sans logout.
8. Revoke access grant → ancien utilisateur bloqué < 60 s (cache TTL).

---

## 13. Risques & mitigations

| Risque | Proba | Impact | Mitigation |
|---|---|---|---|
| Migration workforce → org casse les handlers qui lisent workforce | Moyen | Moyen | Hard-cut fin Sem 2 + rebuild workspace + tests E2E verts avant commit |
| Cache RBAC 60 s ralentit les révocations | Moyen | Faible | Invalidation par pattern sur événements org.* |
| AD bidirectionnel boucle infinie (sync ping-pong) | Faible | Élevé | Timestamp `uSNChanged` + marker `last_synced_by_us` |
| Resolver trop lent (SQL pathologique) | Moyen | Moyen | Index GIST sur `path`, profilage, cache moka |
| Provisioning échoue silencieusement | Moyen | Élevé | Dispatcher retry + alerting sur `org_provisioning_log.status=failed` |
| Access grant leak via URL partagé publiquement | Faible | Élevé | Rate limit + expiration courte par défaut (7 j) + audit log |
| Grosses tenants (10k+ users) → perf | Moyen | Moyen | LTREE index + pagination par défaut |
| Migration casse scripts de seeding | Moyen | Faible | Seeding refait en S2 (Track C) sur nouveau modèle |

---

## 14. Séquencement (5 semaines)

```
Sem 1 (J1-J5)   : modèle canonique SQL + types Rust + repositories + tests
Sem 2 (J6-J10)  : migration code workforce→org + API consolidée + OpenAPI
Sem 3 (J11-J15) : AD sync bidirectionnel + config par tenant + dry-run UI
Sem 4 (J16-J20) : OrgPermissionResolver + middleware + migration 34 services
Sem 5 (J21-J25) : access grants + provisioning événementiel + dashboard admin
```

**Auto-chain** : chaque semaine enchaîne après tests verts.

**Debug skills à créer :**
- `.claude/skills/org-rbac-debug/` — diagnostiquer decisions RBAC, cache misses, query pathologiques.
- `.claude/skills/ad-sync-debug/` — triage conflits AD, bind failures, pagination.
- `.claude/skills/provisioning-debug/` — tracer événements org.* et pending jobs.

**Product spec** : `docs/product-specs/53-org-rbac-refonte.md`.

---

## 15. Non-fonctionnel

- Perf cible `OrgPermissionResolver::check` : p95 < 10 ms avec cache chaud, p95 < 50 ms cache froid.
- Perf cible AD sync (1k users) : < 30 s.
- Perf cible provisioning (1 user → 5 services) : < 5 s.
- Observabilité : tracing spans `rbac.check`, `ad.sync.cycle`, `provisioning.fan_out`.
- Sécurité : secrets AD chiffrés via keystore ; tokens HMAC par tenant ; audit log inaltérable.

---

## 16. Références

- Specs pré-existantes à consolider : `2026-04-04-org-structure-enterprise-design.md`, `2026-04-04-org-governance-boards-design.md`, `2026-04-05-org-ad-fusion-design.md`, `2026-04-06-org-ad-sync-design.md`, `2026-04-11-{ad-org-aware,all-services-org-aware,mail-org-aware,org-role-aware-views,projects-org-aware}-design.md`.
- Memoire : `feedback_auto_chain.md`, `project_org_enterprise.md`.
- CLAUDE.md : conventions tracing, erreur (AppError), utoipa, Conventional Commits.
- `feedback_shared_code_extraction.md` : extraction dans crates partagés (signapps-common::rbac).
- `feedback_design_patterns.md` : Strategy (ResolverImpl), Observer (PgEventBus), Facade (OrgClient).
- Kanidm patterns (inspiration) : https://kanidm.com/
- Axum middleware : https://docs.rs/axum/latest/axum/middleware/index.html
- sqlx LTREE : extension PostgreSQL pour hiérarchie (https://www.postgresql.org/docs/current/ltree.html)
