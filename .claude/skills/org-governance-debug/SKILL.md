---
name: org-governance-debug
description: Use when SO2 governance surfaces misbehave — RBAC visualizer empty or returning stale data, simulate always refuses, RACI matrix refuses the only Accountable toggle, "Un seul A par projet" toast triggering incorrectly, boards decisions not listing, votes duplicating, or the Décisions tab missing despite a board existing on the node. Covers the `org_raci`, `org_board_decisions`, `org_board_votes` tables, the 3 SQL audit triggers, the moka visualizer cache (5-min TTL), and the conditional tab injection in `tab-config.ts`.
---

# org-governance-debug

Use this skill when SO2 governance data misbehaves — RBAC viz empty / stale, RACI toggles failing, board decisions or votes not persisting, or the frontend tabs not showing up on the expected nodes.

## Architecture recap

SO2 adds 3 tables + 3 audit triggers + 3 handler families to `signapps-org`.

| Table | Purpose | Seed count |
|---|---|---|
| `org_raci` | Matrix project × person × role (R/A/C/I) | 20 (Project Phoenix + Project Titan) |
| `org_board_decisions` | Décisions d'un board | 4 on the root Nexus board |
| `org_board_votes` | Votes nominatifs sur décisions | 12 (3 per decision) |

The partial unique index `idx_raci_one_accountable ON org_raci(project_id) WHERE role='accountable'` enforces a single Accountable per project — a second INSERT throws a SQLSTATE 23505 that the handler maps to `409 Conflict` with message "only one accountable allowed per project".

`BoardDecisionRepository::upsert_vote` relies on `ON CONFLICT (decision_id, person_id) DO UPDATE` — the returned row id stays the same when a person votes twice.

The RBAC visualizer (`services/signapps-org/src/handlers/rbac.rs`) combines four axes per person :
1. **Direct** (approximated by `identity.users.role` — 0 viewer / 1 editor / 2 admin / 3 superadmin) until a `user_roles` table exists.
2. **Node + Role** — `org_policy_bindings` joined by LTREE path on the ancestors of every node the person is assigned to.
3. **Delegation** — recursive resolution of the delegator's effective map, surfaced as `PermissionSource::Delegation { delegation_id, delegator_name }`.

A process-wide `moka::future::Cache` (5-min TTL, 1000 entries) caches the full map per `person_id`. `handlers::rbac::invalidate_person(pid)` / `invalidate_all()` are wired into `events.rs::invalidate_on_event` so that:
- `org.policy.updated` / `org.assignment.changed` → broad invalidation
- `org.delegation.*` → broad invalidation

## Common issues

- **RBAC panel empty despite seeded data** — check `persons.user_id` is not NULL. Direct perms only fire when the person is linked to a user row (`SELECT id, user_id FROM org_persons WHERE id='…'`). If NULL, only node/role perms show up.
- **"No person rendered with rbac button" in E2E** — the `data-testid="rbac-viz-button"` lives on `people-tab.tsx`. Make sure the seeded users have assignments on the node you opened. Focus the `Direction` root first.
- **Simulate always returns Refusé** — verify :
  1. `resource` input matches something in the map. The matcher supports `*`, `service.*`, or exact. Typing `docs` (no dot) will not match `docs.document` seed.
  2. The person has a non-null `user_id` AND the user.role ≥ 1 (editor). Otherwise they only get `read` on `*`.
  3. The cache hasn't trapped a stale empty map. Hit `POST /api/v1/org/rbac/simulate` twice — the second should be quick but not different.
- **RACI row creation returns 500 instead of 409** — the handler only recognises two constraint names : `idx_raci_one_accountable` and `org_raci_project_id_person_id_role_key`. If Postgres renames them via migration, update `handlers::raci::map_unique_violation`.
- **"Un seul A par projet" toast on the first A click** — inspect `rolesByPerson` in `raci-matrix-tab.tsx` : it uses the `role` enum value, not the upper-case single letter. If you see `role==='A'` somewhere in devtools, the map is wrong. Expected values : `responsible|accountable|consulted|informed`.
- **Decisions tab missing on a board-bearing node** — `detail-panel.tsx` reads the board id via `orgApi.nodes.board(node.id)`. The endpoint returns `{inherited_from_node_id, members, id?}`. If the backend payload omits `id` on an *inherited* board, `setBoardId(maybeId)` stays null. Either fetch the real board row via `/org/boards/by-node/:inherited_from_id` or surface the "Décisions" on the inheriting node.
- **Votes appear twice for the same person** — check the `org_board_votes.UNIQUE(decision_id, person_id)` still exists. If the constraint was dropped, `upsert_vote`'s `ON CONFLICT` silently fails and both rows persist. Run `\d org_board_votes` and verify the unique key.
- **Status change sets `decided_at` to the Unix epoch** — `BoardDecisionRepository::update_status` binds `decided_at` via chrono `Utc::now()` on non-proposed transitions. If you see `1970-01-01`, the field is still getting the default from Postgres because sqlx misparses the enum — confirm `status` query param is lowercase.
- **Frontend shows 0 decisions despite 4 in DB** — the tab is calling `decisions.list(boardId)` but `boardId` is null. Check the React Devtools : `boardId` must be the UUID of `org_boards.id`, not the `node_id`.

## Debug commands

```bash
# Verify migration 501 is applied.
docker exec signapps-postgres psql -U signapps -d signapps -c \
    "SELECT table_name FROM information_schema.tables
     WHERE table_name IN ('org_raci','org_board_decisions','org_board_votes')"

# Count seed data.
docker exec signapps-postgres psql -U signapps -d signapps -c \
    "SELECT 'raci' AS kind, count(*) FROM org_raci
     UNION ALL SELECT 'decisions', count(*) FROM org_board_decisions
     UNION ALL SELECT 'votes', count(*) FROM org_board_votes"

# Inspect a person's node assignments (used by the viz).
docker exec signapps-postgres psql -U signapps -d signapps -c \
    "SELECT a.id, a.node_id, n.name, a.axis
     FROM org_assignments a JOIN org_nodes n ON n.id=a.node_id
     WHERE person_id='<UUID>'"

# Hit the API directly (after login via /login?auto=admin).
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:3026/api/v1/org/rbac/person/$PERSON_ID | jq

curl -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
     -d '{"person_id":"…","action":"read","resource":"docs.*"}' \
     http://localhost:3026/api/v1/org/rbac/simulate | jq

# Force rerun the seed idempotently.
DATABASE_URL=… cargo run -p signapps-seed -- --only raci
DATABASE_URL=… cargo run -p signapps-seed -- --only decisions
```

## Relevant files

Backend
- `migrations/501_so2_governance.sql`
- `crates/signapps-db/src/models/org/{raci,board_decision,board_vote}.rs`
- `crates/signapps-db/src/repositories/org/{raci,board_decision}_repository.rs`
- `services/signapps-org/src/handlers/{rbac,raci,decisions}.rs`
- `services/signapps-org/src/events.rs` — cache invalidation wiring

Frontend
- `client/src/lib/api/org.ts` — sections `rbac`, `raci`, `decisions`
- `client/src/app/admin/org-structure/components/rbac-viz-panel.tsx`
- `client/src/app/admin/org-structure/components/dialogs/simulate-dialog.tsx`
- `client/src/app/admin/org-structure/components/raci-matrix-tab.tsx`
- `client/src/app/admin/org-structure/components/decisions-tab.tsx`
- `client/src/app/admin/org-structure/components/dialogs/new-decision-dialog.tsx`
- `client/src/app/admin/org-structure/components/tab-config.ts` — conditional tab injection

Seed
- `services/signapps-seed/src/seeders/{raci,decisions}.rs`
