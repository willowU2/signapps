# SO1 — Fondations data — Implementation Plan

> Exécution subagent-driven. TDD partout faisable. Conventional Commits. Boot budget < 5s maintenu.

**Spec :** `docs/superpowers/specs/2026-04-19-so1-foundations-data-design.md`

**Branche :** `feature/so1-foundations-data` (à créer depuis `main`)

---

## Task 1 — Migration 500 + tests

**Files :** `migrations/500_so1_foundations.sql` (voir spec §3.1 pour le SQL complet) + `crates/signapps-db/tests/test_migration_500.rs`

Steps :
- [ ] Écrire test qui vérifie : `org_positions`, `org_position_incumbents`, `org_audit_log`, `org_delegations` existent ; 5 triggers audit attachés ; `org_audit_trigger()` function présente
- [ ] Écrire migration (SQL de la spec, ~180 lignes)
- [ ] `rtk cargo test -p signapps-db test_migration_500` vert
- [ ] Commit `feat(org): migration 500 positions + audit + delegations`

## Task 2 — Models + repos Rust

**Files :**
- `crates/signapps-db/src/models/org/position.rs` (struct Position + FromRow)
- `crates/signapps-db/src/models/org/position_incumbent.rs` (struct PositionIncumbent)
- `crates/signapps-db/src/models/org/audit.rs` (struct AuditLogEntry)
- `crates/signapps-db/src/models/org/delegation.rs` (struct Delegation + Scope enum : Manager|Rbac|All)
- `crates/signapps-db/src/repositories/org/{position,audit,delegation}_repository.rs`

Steps :
- [ ] Models avec `#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, utoipa::ToSchema)]`, rustdoc `///`, champs publics
- [ ] PositionRepository : create, get, list_by_node, update, delete, list_incumbents (JOIN)
- [ ] AuditRepository : list_for_entity(type, id, limit), snapshot_at(tenant, at) — ce dernier fait un SELECT état courant + reverse-apply diff en mémoire
- [ ] DelegationRepository : create, get, revoke, list_active_for_delegator, list_active_for_delegate, expire_due(now)
- [ ] Tests unitaires sqlx::test pour chaque repo (idempotence + queries clés)
- [ ] `rtk cargo test -p signapps-db` vert
- [ ] Commit `feat(org): models + repos for positions, audit, delegations`

## Task 3 — Seed enrichi SO1

**Files :**
- `services/signapps-seed/src/seeders/focus_nodes.rs` (3 projects + 2 committees sous parent "projects" ou comme root-siblings avec kind="entity" et attributes.kind_soft="project|committee")
- `services/signapps-seed/src/seeders/positions.rs` (8 positions)
- `services/signapps-seed/src/seeders/delegations.rs` (5 délégations : 2 actives, 3 expirées pour montrer l'historique)

Steps :
- [ ] focus_nodes : créer "Project Phoenix", "Project Titan", "Project Q2-Launch" (kind=entity, attributes.axis_type="project"), "CSR Committee", "Ethics Committee" (kind=entity, attributes.axis_type="committee")
- [ ] Créer assignments axis='focus' (5 persons × 3 projects) et axis='group' (10 persons × 2 committees) — réutiliser persons existantes
- [ ] 8 positions : CEO/Marie (1 pourvu), CTO/Jean (1 pourvu), Senior Platform Eng (head_count=3, 2 pourvus → 1 vacant), Frontend Eng (head_count=4, 3 pourvus → 1 vacant), Account Exec EMEA (head_count=2, 2 pourvus), ML Eng (head_count=3, 2 pourvus → 1 vacant), Support Agent (head_count=5, 4 pourvus → 1 vacant), Designer (head_count=2, 1 pourvu → 1 vacant)
- [ ] 5 délégations : Marie→Paul (manager, active, jusqu'à +7j), Jean→Sophie (rbac, active, jusqu'à +14j), Marie→Claire (all, expirée -7j), Nicolas→Anne (manager, expirée -30j), Victor→Marie (rbac, expirée -2j)
- [ ] Ajouter au mod.rs et à `seeders::all()`
- [ ] Idempotent test ok (re-run = 0 creates)
- [ ] Commit `feat(seed): focus nodes, 8 positions, 5 delegations demo`

## Task 4 — Handler positions

**Files :** `services/signapps-org/src/handlers/positions.rs` + wire dans `lib.rs` routes

Endpoints :
- `GET /org/positions?node_id=X` → list
- `GET /org/positions/:id` → single
- `POST /org/positions` → create
- `PUT /org/positions/:id` → update
- `DELETE /org/positions/:id`
- `GET /org/positions/:id/incumbents` → list
- `POST /org/positions/:id/incumbents` body `{person_id, start_date?}` → assign
- `DELETE /org/positions/:id/incumbents/:incumbent_id` → revoke

Steps :
- [ ] Handlers avec `#[utoipa::path]` + `#[tracing::instrument]`
- [ ] Tests intégration `services/signapps-org/tests/test_positions.rs`
- [ ] Commit `feat(org): positions + incumbents API`

## Task 5 — Handler history + time-travel middleware

**Files :** `services/signapps-org/src/handlers/history.rs` + extension sur `nodes.rs` et `persons.rs` handlers

Endpoints :
- `GET /org/history?entity_type=node|person|assignment&entity_id=X&limit=50` → list
- `GET /org/history/tenant?tenant_id=X&since=&limit=` → audit timeline
- Existing `/org/nodes` et `/org/persons` : si `?at=<iso8601>` présent, redirige vers `AuditRepository::snapshot_at(tenant, at)` au lieu de la lecture live.

Steps :
- [ ] Handler `history.rs` avec utoipa
- [ ] Extension Nodes/Persons handlers : parser param `at`, appeler snapshot si présent
- [ ] Cache moka sur snapshot (5min TTL, key = (tenant_id, at_bucket_5min))
- [ ] Tests intégration scénarios : (1) modify node → GET ?at=<avant modif> retourne ancienne valeur, (2) audit list pour un node
- [ ] Commit `feat(org): history endpoint + time-travel via ?at=`

## Task 6 — Handler delegations + cron

**Files :** `services/signapps-org/src/handlers/delegations.rs` + scheduler job

Endpoints :
- `GET /org/delegations?person_id=X&active=true` → list
- `POST /org/delegations` → create
- `POST /org/delegations/:id/revoke` → soft-revoke
- `DELETE /org/delegations/:id` → hard delete (admin)

Cron : `services/signapps-scheduler/src/jobs/org_delegations_expire.rs` — tick 15min, appelle `DelegationRepository::expire_due(now)`, émet event `org.delegation.expired`.

Steps :
- [ ] Handler + utoipa
- [ ] Scheduler job enregistré au boot
- [ ] Tests intégration : create/revoke/expire
- [ ] Commit `feat(org): delegations API + 15min expire cron`

## Task 7 — RBAC extension delegation

**Files :** `services/signapps-org/src/rbac_client.rs`

Steps :
- [ ] Dans `OrgClient::resolve`, avant la check standard, query `DelegationRepository::list_active_for_delegate(person_id of user)` filtré sur scope IN ('rbac','all')
- [ ] Pour chaque délégation active, ajouter les permissions du delegator_person à l'union
- [ ] Cache invalidation : s'abonner à event `org.delegation.expired` pour drop le cache entry
- [ ] Test : `services/signapps-integration-tests/tests/delegation_rbac.rs` — Jean reçoit délégation rbac de Marie (CEO), vérifie que Jean peut accéder à /admin/users pendant la délégation
- [ ] Commit `feat(rbac): delegation-aware permission resolver`

## Task 8 — Multi-axes API + seed

**Files :** `services/signapps-org/src/handlers/canonical_assignments.rs` extension

Steps :
- [ ] Ajouter query param `?axis=structure|focus|group` à `GET /org/assignments`
- [ ] Créer 5 assignments axis='focus' (persons cross-team sur projects) + 10 axis='group' (persons dans committees) dans le seeder focus_nodes
- [ ] Endpoint `GET /org/axes/summary?tenant_id=X` → counts par axe + liste nodes focus/group
- [ ] Tests
- [ ] Commit `feat(org): multi-axis API filter + axes summary`

## Task 9 — Frontend : time-travel slider + axis chip

**Files :**
- `client/src/app/admin/org-structure/components/time-travel-slider.tsx`
- `client/src/app/admin/org-structure/components/axis-filter-chip.tsx`
- Intégration dans `org-toolbar.tsx`
- `client/src/lib/api/org.ts` extensions (history, delegations, positions)

Steps :
- [ ] Slider date HTML5 en toolbar + label "Vue du YYYY-MM-DD" quand !== today
- [ ] Chip filter axe (All/Structure/Focus/Group) avec couleurs cohérentes avec les liserés d'avatars
- [ ] Passer `atDate` + `axisFilter` au `fetchNodes`/`fetchPersons` du store → query param
- [ ] Mode read-only quand `atDate !== today` : boutons Add/Edit/Delete grisés, tooltip "Vue historique, pas d'édition"
- [ ] Commit `feat(org-ui): time-travel slider + axis filter chip`

## Task 10 — Frontend : positions tab + dialog

**Files :**
- `client/src/app/admin/org-structure/components/positions-tab.tsx`
- `client/src/app/admin/org-structure/components/dialogs/create-position-dialog.tsx`
- `client/src/app/admin/org-structure/components/dialogs/fill-position-dialog.tsx`

Steps :
- [ ] Nouvel onglet "Postes" dans le DetailPanel d'un node
- [ ] Liste des positions : "Senior Dev · 2/3 pourvus · 1 ouvert" + liste incumbents avec avatars
- [ ] Bouton "Nouveau poste" → dialog title/head_count/description
- [ ] Bouton "Pourvoir" sur poste vacant → dialog picker person + start_date
- [ ] Bouton X sur un incumbent → dialog confirmation end_date
- [ ] Commit `feat(org-ui): positions tab with create/fill flows`

## Task 11 — Frontend : delegation dialog

**Files :**
- `client/src/app/admin/org-structure/components/dialogs/delegation-dialog.tsx`
- `client/src/app/admin/org-structure/components/active-delegations-panel.tsx`
- Integration dans `people-tab.tsx` (bouton "Déléguer" à côté du crayon)
- Badge "Délégation" orange sur l'avatar du delegator dans tree + orgchart (extension `tree-node-item.tsx`)

Steps :
- [ ] Dialog : choisir delegate (picker parmi persons), scope radio, date range, reason
- [ ] Panel dans sidebar : "Délégations actives" liste compacte (delegator → delegate, expires_in)
- [ ] Fetch via orgApi.delegations.listActive + realtime via PgEventBus (polling 60s ok)
- [ ] Commit `feat(org-ui): delegation dialog + active delegations panel`

## Task 12 — E2E + docs + merge

**Files :**
- `client/e2e/so1-positions.spec.ts` (créer position, pourvoir, retirer)
- `client/e2e/so1-time-travel.spec.ts` (modifier node, slider passé, vérifier ancien état)
- `client/e2e/so1-delegations.spec.ts` (déléguer Marie→Paul, badge visible, expiration après +15min en test via injection SQL)
- `docs/product-specs/56-so1-foundations.md`
- `.claude/skills/org-foundations-debug/SKILL.md`
- CLAUDE.md (3 lignes : positions, délégations, time-travel)

Steps :
- [ ] 3 specs Playwright
- [ ] Product-spec doc + debug skill
- [ ] `rtk cargo clippy --workspace -- -D warnings` clean
- [ ] `cd client && rtk npx tsc --noEmit` clean
- [ ] `rtk cargo test -p signapps-platform --test boot -- --ignored` < 5s
- [ ] Merge `feature/so1-foundations-data` → `main` avec `--no-ff`
- [ ] **NE PAS PUSH ORIGIN** (le runtime le flaggue comme risque — le controller pousse manuellement)
- [ ] Commit `docs(so1): product spec + debug skill + CLAUDE refs`

---

**Fin plan SO1.**
