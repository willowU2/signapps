---
name: team-debug
description: Debug skill for the Hub Equipe (/team). Org chart tree view with hierarchy visualization, expand/collapse, tree switcher, historical date picker, node type colors, person assignments, vacant positions. Uses signapps-workforce service. Redirect /team to /team/org-chart.
---

# Hub Equipe — Debug Skill

## Source of truth

**`docs/product-specs/53-team.md`** — read spec first.

## Code map

### Backend (Rust)

- **Service**: `services/signapps-workforce/` (via identity routing)
- **API client uses**: `ServiceName.WORKFORCE` — resolved by API factory
- **Key endpoints**:
  - `GET /workforce/org/tree` — list all root nodes (trees)
  - `GET /workforce/org/orgchart?tree_id=X&date=Y` — full orgchart with nested nodes + assignments + persons
  - `GET /workforce/org/nodes/{id}/children` — children of a node
  - `GET /workforce/org/nodes/{id}/descendants` — full subtree
  - `GET /workforce/org/nodes/{id}/assignments` — assignments for a node
  - `GET /workforce/employees` — list persons (filterable by role, node, site, active)
  - `GET /workforce/org/context` — current user's org context (assignments, groups, permissions)
- **DB models**: `OrgNode`, `OrgTree`, `Person`, `Assignment`, `OrgChartNode` — in `crates/signapps-db/`

### Frontend (Next.js)

- **Redirect**: `client/src/app/team/page.tsx` — `router.replace('/team/org-chart')` on mount
- **Org Chart**: `client/src/app/team/org-chart/page.tsx` — main org chart visualization
- **API module**: `client/src/lib/api/org.ts` — `orgApi` with trees, nodes, persons, assignments, sites, orgchart, context, groups, policies, delegations, audit sub-objects
- **Types**: `client/src/types/org.ts` — 25+ type definitions (OrgNode, OrgTree, OrgChartNode, Person, Assignment, etc.)

### Org Chart UI structure

- **Tree switcher**: `Select` dropdown to pick which org tree to display (internal, clients, suppliers)
- **Historical date picker**: `Input type="date"` to view org structure at a past date; empty = current
- **Expand/Collapse controls**: "Tout deplier" / "Tout replier" buttons
- **OrgCard** component (recursive): renders each node with:
  - Color-coded border by `node_type` (11 types with distinct colors)
  - Badge showing node type label (Groupe, Filiale, BU, Departement, Service, Equipe, Poste, etc.)
  - Person avatars for position nodes (shows up to 3 with "+N autres")
  - "Poste vacant" indicator for position nodes with no filled assignments
  - Child count badge (absolute positioned circle)
  - Click to expand/collapse children
- **State**: `trees`, `selectedTreeId`, `chartNodes`, `currentTree`, `loading`, `date`, `expanded` (Set<string>)

### Node type colors

| node_type | Border/BG color |
|---|---|
| group | purple |
| subsidiary | blue |
| bu | indigo |
| department | green |
| service | teal |
| team | amber |
| position | orange |
| client_group | slate |
| client_company | cyan |
| supplier_group | rose |
| supplier_company | pink |

### Tree types

| tree_type | Label |
|---|---|
| internal | Interne |
| clients | Clients |
| suppliers | Fournisseurs |

## Key data-testids (to add)

| data-testid | Element |
|---|---|
| `team-orgchart-root` | Org chart page container |
| `team-tree-select` | Tree switcher dropdown |
| `team-date-picker` | Historical date input |
| `team-expand-all` | "Tout deplier" button |
| `team-collapse-all` | "Tout replier" button |
| `team-node-{id}` | OrgCard node card |
| `team-node-toggle-{id}` | Expand/collapse click area |
| `team-person-{assignmentId}` | Person avatar in position node |
| `team-vacant-{id}` | Vacant position indicator |
| `team-tree-badge` | Current tree type badge |
| `team-empty-state` | Empty chart indicator |
| `team-loading` | Loading indicator |

## Key E2E journeys

1. **View org chart** — navigate to /team, verify redirect to /team/org-chart, verify tree loads with root nodes
2. **Expand/collapse** — click a node with children, verify children appear; click "Tout deplier" to expand all
3. **Switch tree** — select a different tree from dropdown, verify chart reloads
4. **Historical view** — pick a past date, verify "Vue au {date}" badge appears, verify chart shows historical state
5. **Vacant positions** — verify position nodes without assignments show "Poste vacant" with dashed border
6. **Person display** — verify position nodes show avatars with initials, verify "+N autres" for many assignments

## Common bug patterns

1. **Redirect flash** — `/team/page.tsx` renders `null` and calls `router.replace`; brief white flash before redirect completes
2. **Tree list empty** — `orgApi.trees.list()` calls `GET /workforce/org/tree`; if workforce service is not running or no trees created, `setTrees([])` and `selectedTreeId` stays empty, showing empty state
3. **Auto-expand root only** — `loadChart` expands only first 5 root IDs; deep hierarchies start collapsed, requiring manual expansion
4. **Node click handler overlap** — `onClick={() => hasChildren && onToggle(node.id)}` is on the entire card; clicking anywhere (including person avatars) toggles expansion
5. **Date picker timezone** — `new Date(date).toLocaleDateString('fr-FR')` for display; API sends date string as-is; timezone mismatch could query wrong day
6. **OrgCard max-width constraint** — `min-w-[180px] max-w-[220px]` causes long node names to truncate without tooltip
7. **Recursive rendering depth** — deeply nested org structures can cause React performance issues; no virtualization or depth limit
8. **Missing error handling** — `loadChart` catches errors and sets `chartNodes` to empty array; no error toast or retry mechanism
9. **Tree type label mismatch** — `TREE_TYPE_LABELS` maps from `TreeType` but tree switcher uses `node_type` field which may differ from `tree_type`

## Debug checklist

- [ ] Workforce service running? Check the service port via API factory resolution
- [ ] Trees exist? `curl http://localhost:{port}/workforce/org/tree` should return root nodes
- [ ] Orgchart endpoint works? `curl http://localhost:{port}/workforce/org/orgchart?tree_id=X`
- [ ] `selectedTreeId` populated? Check React DevTools state — should be set after trees load
- [ ] `chartNodes` populated? Should have nested `OrgChartNode[]` with `node`, `assignments`, `children`
- [ ] `expanded` Set correct? Check which node IDs are in the Set
- [ ] Persons loaded in assignments? Each assignment should have optional `person` object with `first_name`/`last_name`
- [ ] Redirect working? Navigate to /team, verify URL changes to /team/org-chart

## Dependencies (license check)

- **Backend**: axum, sqlx — Apache-2.0/MIT
- **Frontend**: react, next, lucide-react — MIT
- Verify: `just deny-licenses && cd client && npm run license-check:strict`
