# SO2 — Gouvernance & Permissions — Plan

> Exécution subagent-driven. Spec : `docs/superpowers/specs/2026-04-19-so2-governance-design.md`. Branche : `feature/so2-governance`.

---

## T1 — Migration 501

**Files :** `migrations/501_so2_governance.sql` + `crates/signapps-db/tests/test_migration_501.rs`
- [ ] Test : 3 tables existent + 3 triggers attachés + contrainte "1 accountable par projet" fonctionne
- [ ] SQL : voir spec §2
- [ ] Commit `feat(org): migration 501 raci + board decisions + votes`

## T2 — Models + repos

**Files :** `crates/signapps-db/src/models/org/{raci,board_decision,board_vote}.rs` + `src/repositories/org/{raci,board_decision}_repository.rs`
- [ ] Structs avec FromRow, rustdoc, utoipa::ToSchema
- [ ] Enums Rust : `RaciRole` (Responsible/Accountable/Consulted/Informed), `DecisionStatus`, `VoteKind`
- [ ] RaciRepository : list_by_project, create, delete, bulk_set (transaction : supprime l'existant pour (project, person) puis insert)
- [ ] BoardDecisionRepository : list_by_board, create, update_status (+ set decided_at/by)
- [ ] BoardVoteRepository : list_by_decision, upsert (one vote per person)
- [ ] Tests unitaires sqlx::test pour chaque repo
- [ ] Commit `feat(org): models + repos raci + decisions + votes`

## T3 — Handler RBAC

**Files :** `services/signapps-org/src/handlers/rbac.rs` + wire dans lib.rs

Endpoints :
- `GET /org/rbac/person/:id` → full effective map
- `GET /org/rbac/effective?user_id=X&resource=Y` → filtered
- `POST /org/rbac/simulate` body `{user_id, action, resource}` → `{allowed, reason, chain}`

- [ ] Implémentation algo §3 spec
- [ ] Cache moka TTL 5min par person_id (reset sur event `org.assignment.changed` + `org.policy.updated` + `org.delegation.*`)
- [ ] Tests intégration `services/signapps-org/tests/test_rbac_visualizer.rs`
- [ ] Commit `feat(org): rbac effective/simulate API with source chain`

## T4 — Handler RACI

**Files :** `services/signapps-org/src/handlers/raci.rs` + wire

Endpoints :
- `GET /org/raci?project_id=X` → list
- `POST /org/raci/bulk` body `[{project_id, person_id, role}]` → bulk upsert
- `DELETE /org/raci/:id`

- [ ] Validation : `role='accountable'` max 1 par projet (géré par contrainte SQL + 400 lisible côté handler)
- [ ] Tests intégration avec seed 2 projets
- [ ] Commit `feat(org): raci matrix API`

## T5 — Handler decisions

**Files :** `services/signapps-org/src/handlers/decisions.rs` + wire

Endpoints :
- `GET /org/boards/:board_id/decisions` → list (filter status optionnel)
- `POST /org/boards/:board_id/decisions` → create
- `PUT /org/boards/:board_id/decisions/:id/status` → update status + décide_at/by
- `GET /org/decisions/:id/votes` → list
- `POST /org/decisions/:id/votes` body `{person_id, vote, rationale?}` → upsert
- `DELETE /org/decisions/:id/votes/:vote_id` → remove

- [ ] Handlers + utoipa + tracing
- [ ] Tests intégration
- [ ] Commit `feat(org): board decisions + votes API`

## T6 — Seed

**Files :** `services/signapps-seed/src/seeders/{raci,decisions}.rs`

- [ ] RaciSeeder : pour "Project Phoenix" → Marie=A, Jean=R, Sophie+Thomas=R, Emma+Lucas=C, Paul+Claire+Nicolas+Victor=I ; idem pour "Project Titan" avec autres persons
- [ ] DecisionsSeeder : sur le board du root "Nexus Industries" → 4 décisions (2 approved, 1 rejected, 1 deferred), 3 votes par decision de persons direction
- [ ] Vérifier qu'un board existe bien sur le root (sinon en créer un auto)
- [ ] Ajouter à seeders::all()
- [ ] Test idempotent
- [ ] Commit `feat(seed): RACI + 4 decisions + 12 votes demo`

## T7 — Frontend RBAC visualizer

**Files :**
- `client/src/app/admin/org-structure/components/rbac-viz-panel.tsx`
- `client/src/app/admin/org-structure/components/dialogs/simulate-dialog.tsx`
- Intégration dans `detail-panel.tsx` (nouveau tab "Permissions" quand entité = person)
- `client/src/lib/api/org.ts` extension `rbac.effective` + `rbac.simulate`

- [ ] Tree view collapsible par resource category (org.*, docs.*, mail.*, etc.), badge source (node/role/delegation/direct) avec tooltip "hérité de X"
- [ ] Bouton "Simuler" ouvre dialog : dropdown action + input resource + bouton Go → chain card avec green/red
- [ ] Commit `feat(rbac-ui): effective permissions panel + simulate dialog`

## T8 — Frontend RACI matrix

**Files :**
- `client/src/app/admin/org-structure/components/raci-matrix-tab.tsx`
- Intégration conditionnelle : onglet "RACI" visible uniquement si `node.attributes.axis_type === 'project'`

- [ ] Grid person × role : chaque cell = bouton radio R/A/C/I/none, toggle désactive la selection précédente de cette person sur ce projet
- [ ] Alert si tentative de 2 accountable : toast error "Un seul A par projet"
- [ ] Bouton "Exporter CSV" qui dump la matrix
- [ ] Commit `feat(raci-ui): matrix tab on project nodes`

## T9 — Frontend decisions timeline

**Files :**
- `client/src/app/admin/org-structure/components/decisions-tab.tsx`
- `client/src/app/admin/org-structure/components/dialogs/new-decision-dialog.tsx`
- Intégration : tab "Décisions" sur un node qui a un board attaché

- [ ] Timeline vertical : badge status coloré + titre + "décidée le X par Y" + mini-liste votes (pour/contre/abstention)
- [ ] Nouvelle décision dialog : title + description + status initial 'proposed'
- [ ] Vote UI inline : pour chaque person du board, 3 boutons (pour/contre/abstention) avec counts
- [ ] Commit `feat(board-ui): decisions timeline + vote inline`

## T10 — E2E + docs + merge

**Files :**
- `client/e2e/so2-rbac-viz.spec.ts` (visualiser permissions de marie, simuler action refusée)
- `client/e2e/so2-raci.spec.ts` (assigner R/A/C/I, vérifier contrainte accountable unique)
- `client/e2e/so2-decisions.spec.ts` (créer décision, voter, status change)
- `docs/product-specs/57-so2-governance.md` + `.claude/skills/org-governance-debug/SKILL.md`

- [ ] 3 specs Playwright
- [ ] Product spec + debug skill
- [ ] Clippy workspace clean (skip env deps pré-existantes comme en SO1)
- [ ] tsc + build OK
- [ ] Boot < 5s
- [ ] Merge local `feature/so2-governance → main --no-ff` (**ne pas push origin**)
- [ ] Commit `docs(so2): product spec + debug skill`

---

**Fin plan SO2.**
