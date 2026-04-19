# 53 — Org + RBAC + AD + Provisioning + Sharing (S1 refonte)

## Contexte

Avant la S1, SignApps vivait avec **deux sources de vérité** pour la structure organisationnelle :

- `signapps-workforce` portait une version simplifiée (orgs + members) utilisée par HR/Timesheet.
- `signapps-identity` exposait un modèle différent pour l'authentification + le RBAC par rôle.

Conséquences : doublons `user` ↔ `person`, RBAC éclaté en 34 implémentations maison (chaque service faisait sa propre vérif à partir des `Claims`), pas de single source of truth pour les noeuds d'org (`org_nodes` dupliqué dans deux services), aucun concept de grant lien partagé signé. L'AD était miroir-lecture uniquement, et la création d'un user ne provisionnait aucune ressource automatiquement.

## Ce qui change

### Pour l'équipe dev

- **Org source of truth** : `signapps-org` (PostgreSQL canonique). Tous les `person_id`, `node_id`, `assignment_id`, `policy_id`, `board_id`, `access_grant_id` vivent dans `org_*` et sont immuables. `signapps-workforce` est dégraissé en HR pur (contrats, timesheets, congés).
- **RBAC unifié** : un trait `OrgPermissionResolver` dans `signapps-common::rbac` (feature `rbac`), avec une seule implémentation `OrgClient` dans `signapps-org`. Cache moka 60 s TTL. Middleware `rbac::require(action, resource_extractor)` câblé dans chaque service protégé (mail, storage, calendar, chat, forms, docs, tasks, contacts, slides, ...).
- **AD sync par tenant** : config `org_ad_config` avec `AdSyncMode = Off | OrgToAd | AdToOrg | Bidirectional`. Un supervisor tokio cycle toutes les 60 s, décrypte le `bind_password` via `Keystore::dek("org-ad-bind-password-v1")`, applique une politique de conflit (`PreferOrg | PreferAd | LastWriteWins`) et une fenêtre debounce 30 s anti-ping-pong. Chaque cycle écrit dans `org_ad_sync_log`.
- **Provisioning événementiel** : `signapps-org::handlers::persons::create` publie `org.user.created` sur le `PgEventBus`. Des consumers dédiés (mail, storage, calendar, chat) lisent le topic et écrivent une trace dans `org_provisioning_log`. Archivage publie `org.user.deactivated`. Admin endpoint `/api/v1/org/provisioning/pending` + `POST /:id/retry` pour relancer une ligne échouée.
- **Sharing via HMAC** : grants signés par `HMAC-SHA256` avec le DEK tenant `"org-grants-v1"` + salt tenant. Endpoint public `/g/:token` valide la signature + la DB (révocation + expiration) puis redirige vers la ressource avec cookie `grant_token`.
- **Hard-cut migration 426** : le schéma legacy de `workforce` vers `org_*` est consolidé par la migration `426_workforce_to_org_cutover.sql` (down non fourni — c'est un cutover one-shot).
- **Pool DB dimensionné** : le pool monte à 50 connexions par défaut pour absorber les 34 services en single-binary + les workers. Override via `DB_MAX_CONNECTIONS`. Boot test budget 5 s.

### Pour l'utilisateur final

- **Admin org dashboard enrichi** : un seul écran `/admin/org-structure` couvre arbres, noeuds, affectations, policies, boards, grants, AD sync, provisioning pending. Les pages HR legacy de `workforce` basculent en lecture seule (follow-up : les retirer définitivement en S2).
- **Cascade automatique à la création** : créer un user depuis l'admin fait apparaître mailbox + drive + calendrier + accès chat en < 5 s (cible ; actuellement les consumers écrivent un log `succeeded` stub — la création matérielle des ressources arrive en follow-up).
- **Partage via URL signée** : un partage génère une URL `/g/<token>`. Le destinataire peut ne pas avoir de compte SignApps et accéder en lecture. Le lien expire (défaut configurable) et peut être révoqué à tout moment (`DELETE /api/v1/org/grants/:id`).

## État à la livraison

### Entièrement câblé

- Modèle SQL canonique (migrations 400-410 + 426) et types Rust dans `signapps-db/src/models/org/`.
- Repositories (`PersonRepository`, `NodeRepository`, `AssignmentRepository`, `PolicyRepository`, `BoardRepository`, `AccessGrantRepository`, `AdConfigRepository`).
- Handlers complets : `/api/v1/org/{persons,nodes,assignments,policies,policies/bindings,boards,grants,ad,ad/sync-log,provisioning}` — tous avec `#[utoipa::path]` + `#[instrument]` + auth middleware.
- Trait `OrgPermissionResolver` + impl `OrgClient` + middleware `rbac::require` déployé sur 34 services.
- Supervisor AD sync + debounce + conflict resolution.
- Publisher `org.user.created | org.user.deactivated | org.policy.binding_changed | org.grant.revoked`.
- Endpoint `/g/:token` + verify API.
- 3 tests Rust d'intégration (`boot`, `service_count`, `migrations_idempotent`) + 1 test E2E login/me.
- 8 scénarios Playwright `client/e2e/s1-org-rbac.spec.ts` — **5 actifs, 3 skip** (LDAP, board UI, cross-unit move UI).

### Stubs / follow-ups à surveiller

- **Provisioning bodies** — les consumers `signapps-{mail,storage,calendar,chat}` écrivent aujourd'hui un log `succeeded` sans créer la ressource. Les handlers métier (mailbox create, drive root create, ...) sont le prochain chantier.
- **`OrgToAd` push** — la branche de `AdSyncMode::OrgToAd` est un no-op ; seul `AdToOrg | Bidirectional-inbound` pull effectivement.
- **Board admin UI** — les endpoints `/api/v1/org/boards` existent mais la page `/admin/org-structure → boards` reste à construire (scénario Playwright 6 skip).
- **Cross-unit move UI** — déplacer un user d'une unité à une autre côté UI n'a pas de page dédiée. L'API assignment `POST /api/v1/org/assignments` + `PATCH` le fait (scénario Playwright 7 skip).
- **LDAP test container CI** — aucun conteneur LDAP n'est démarré dans le pipeline ; le scénario Playwright 5 (`AD sync adds user`) reste en skip.

## Prochaines optimisations potentielles

1. **S2 — seeding démo** : un script `just seed-org-demo` qui charge 3 tenants, 20 users, 5 boards, 10 grants, pour démo commerciale / QA manuelle.
2. **S3 — tests intégrés cross-services** : E2E Playwright qui crée un user → attend mailbox → ouvre un doc dans drive → partage via grant → vérifie côté destinataire. Nécessite que les consumers de provisioning écrivent vraiment leurs ressources.
3. **Follow-ups identifiés** :
   - Implémenter `OrgToAd` (push vers LDAP via `ldap3` client).
   - Écrire les bodies réels des consumers provisioning (mailbox/drive/calendar/chat).
   - Construire les pages admin board + cross-unit move + lifter les 3 skip Playwright.
   - Retirer le schéma HR legacy de `workforce` devenu lecture seule.

## Références

- Design : `docs/superpowers/specs/2026-04-18-s1-org-rbac-refonte-design.md`
- Plan : `docs/superpowers/plans/2026-04-18-s1-org-rbac-refonte.md`
- Debug skills : `.claude/skills/org-rbac-debug/`, `.claude/skills/ad-sync-debug/`, `.claude/skills/provisioning-debug/`
- Migrations : `400_enable_ltree.sql`, `401_org_nodes.sql`, `402_org_persons.sql`, `403_org_assignments.sql`, `404_org_policies.sql`, `405_org_boards.sql`, `406_org_access_grants.sql`, `407_org_ad_sync_log.sql`, `408_org_ad_config.sql`, `409_org_provisioning_log.sql`, `410_org_persons_sync_markers.sql`, `426_workforce_to_org_cutover.sql`
- Code :
  - Shared trait : `crates/signapps-common/src/rbac/{mod,resolver,middleware,cache,types}.rs`
  - Canonical service : `services/signapps-org/src/{lib,ad/,event_publisher.rs,grants/,handlers/,rbac_client.rs}`
  - Models / repos : `crates/signapps-db/src/models/org/`, `crates/signapps-db/src/repositories/org/`
- Tests : `services/signapps-platform/tests/e2e_s1_scenarios.rs`, `client/e2e/s1-org-rbac.spec.ts`
- CLAUDE.md : section Préférences de développement (6 lignes ajoutées)
