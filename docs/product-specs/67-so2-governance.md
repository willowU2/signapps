# 67 — SO2 Gouvernance & Permissions

**Status:** Implémenté (2026-04-19)
**Owner:** Platform team
**Spec:** `docs/superpowers/specs/2026-04-19-so2-governance-design.md`
**Plan:** `docs/superpowers/plans/2026-04-19-so2-governance.md`

## Vue d'ensemble

SO2 étend SO1 avec trois briques de gouvernance visibles côté UI :

1. **RBAC Visualizer** — pour chaque personne, la liste explicite de ses
   permissions effectives + la source (direct / node / role / delegation)
   + un simulateur "est-ce que X peut faire Y sur Z ?" avec verdict
   coloré et chain des preuves.
2. **RACI Matrix** — matrix Projet × Personne × Rôle (R/A/C/I) avec
   contrainte SQL "un seul Accountable par projet" et export CSV.
3. **Boards enrichis** — timeline des décisions d'un board
   (proposed/approved/rejected/deferred) avec votes nominatifs
   (for/against/abstain) et upsert idempotent par personne.

## Modèle de données (migration 501)

Trois nouvelles tables :

- `org_raci(id, tenant_id, project_id, person_id, role, created_at)` —
  `UNIQUE(project_id, person_id, role)` + partial unique index
  `idx_raci_one_accountable ON (project_id) WHERE role='accountable'`.
- `org_board_decisions(id, tenant_id, board_id, title, description,
  status, decided_at, decided_by_person_id, attributes, created_at,
  updated_at)`.
- `org_board_votes(id, tenant_id, decision_id, person_id, vote,
  rationale, voted_at)` — `UNIQUE(decision_id, person_id)`.

Les 3 tables reçoivent un trigger `org_audit_trigger()` défini par la
migration 500 (SO1) → chaque INSERT/UPDATE/DELETE est loggé dans
`org_audit_log`.

## Routes backend (signapps-org port 3026, prefix `/api/v1`)

### RBAC visualizer

| Méthode | Path | Description |
|---|---|---|
| GET  | `/org/rbac/person/:id` | Full map des permissions pour une personne |
| GET  | `/org/rbac/effective?user_id=&person_id=&resource=` | Map filtrée |
| POST | `/org/rbac/simulate` | `{person_id, action, resource}` → `{allowed, reason, chain}` |

**Cache** — `moka::future::Cache` TTL 5 min, clé `person_id`. Invalidé
par les events `org.policy.updated`, `org.assignment.changed`,
`org.delegation.*`.

**Approximation direct** — en l'absence d'une table `user_roles` le
visualizer se rabat sur `identity.users.role` (0=viewer, 1=editor,
2=admin, 3=superadmin). Quand cette table arrivera il suffira de
remplacer `collect_direct` dans
`services/signapps-org/src/handlers/rbac.rs`.

### RACI

| Méthode | Path | Description |
|---|---|---|
| GET    | `/org/raci?project_id=X` | Liste |
| POST   | `/org/raci` | Créer une entrée |
| POST   | `/org/raci/bulk` | Remplacer les rôles de `(project, person)` en transaction |
| DELETE | `/org/raci/:id` | Retirer une entrée |

Violation du partial unique → `409 Conflict` "only one accountable
allowed per project".

### Decisions + votes

| Méthode | Path | Description |
|---|---|---|
| GET    | `/org/boards/:board_id/decisions?status=` | Liste décisions |
| POST   | `/org/boards/:board_id/decisions` | Créer |
| PUT    | `/org/boards/:board_id/decisions/:id/status` | Changer statut + décide_at/by |
| DELETE | `/org/boards/:board_id/decisions/:id` | Supprimer |
| GET    | `/org/decisions/:decision_id/votes` | Liste votes |
| POST   | `/org/decisions/:decision_id/votes` | Upsert vote (une ligne par personne) |
| DELETE | `/org/decisions/:decision_id/votes/:vote_id` | Retirer un vote |

## Frontend

- `components/rbac-viz-panel.tsx` — panneau collapsible par catégorie
  de resource, badges source colorés avec tooltips "hérité de …",
  bouton "Simuler".
- `components/dialogs/simulate-dialog.tsx` — dropdown action + input
  resource, card verdict vert/rouge + chain des sources.
- `components/raci-matrix-tab.tsx` — grid Personne × R/A/C/I avec
  toggle, export CSV, filtre nom.
- `components/decisions-tab.tsx` +
  `components/dialogs/new-decision-dialog.tsx` — timeline vertical,
  select statut, votes inline.

Les tabs RACI/Décisions sont injectés conditionnellement par
`tab-config.ts::getVisibleTabs(nodeType, schema, { axisType, hasBoard })`.

## Seed demo

- `services/signapps-seed/src/seeders/raci.rs` — 20 RACI rows sur
  Project Phoenix + Project Titan (2 Accountable uniques :
  Marie=Phoenix, Jean=Titan).
- `services/signapps-seed/src/seeders/decisions.rs` — crée un board sur
  root Nexus si absent, 4 décisions (2 approved, 1 rejected, 1
  deferred) + 12 votes.

## Commandes utiles

```bash
# Rejouer juste les seeders SO2 (idempotent).
DATABASE_URL=… cargo run -p signapps-seed -- --only raci
DATABASE_URL=… cargo run -p signapps-seed -- --only decisions

# Vérifier les counts post-seed.
docker exec signapps-postgres psql -U signapps -d signapps -c \
    "SELECT 'raci', count(*) FROM org_raci
     UNION ALL SELECT 'decisions', count(*) FROM org_board_decisions
     UNION ALL SELECT 'votes', count(*) FROM org_board_votes"

# Tests.
cargo test -p signapps-db --test test_migration_501 -- --ignored --nocapture
cargo test -p signapps-db --test so2_repos          -- --ignored --nocapture
npx playwright test e2e/so2-*.spec.ts
```

## Limites connues

- Le visualizer "direct" approxime via `users.role` tant que la table
  `user_roles` n'existe pas.
- Le simulate se contente d'un match linéaire sur la map (pas de
  wildcard avancé). Le matching wildcard courant couvre `*`,
  `service.*` et `service.resource`.
- Le cache moka n'est pas sharded par tenant — une invalidation
  `org.policy.updated` évince tout. Acceptable à l'échelle actuelle.
