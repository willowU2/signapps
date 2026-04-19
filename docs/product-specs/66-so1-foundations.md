# 66 — SO1 Fondations data org avancée

**Status:** Implémenté (2026-04-19)
**Owner:** Platform team
**Spec:** `docs/superpowers/specs/2026-04-19-so1-foundations-data-design.md`

## Vue d'ensemble

SO1 pose les 4 fondations data manquantes pour scaler l'org Nexus :

1. **Multi-axes enrichis** — `org_assignments.axis ∈ {structure, focus, group}` est maintenant peuplé pour les 3 axes. 81 structure + 15 focus + 10 group.
2. **Positions & incumbents** — séparation siège (`org_positions`) / occupant (`org_position_incumbents`). 8 positions seed, 16 incumbents, 4 sièges vacants pour démo.
3. **Historique / time-travel** — `org_audit_log` auto-alimenté par trigger SQL sur les 5 tables org_* ; `?at=YYYY-MM-DD` sur `/org/nodes` + `/org/persons` reconstruit l'état passé via reverse-apply.
4. **Délégations temporaires** — `org_delegations` avec scope (`manager`|`rbac`|`all`) + période. Cron tokio 15 min auto-expire + event `org.delegation.expired`. RBAC resolver étend les permissions du delegate via branche 5.

## Routes backend (signapps-org port 3026, prefix `/api/v1`)

| Méthode | Path | Description |
|---|---|---|
| GET | `/org/positions?tenant_id=X&node_id=Y` | Liste positions + occupancy |
| POST | `/org/positions` | Créer un poste |
| PATCH | `/org/positions/:id` | Modifier (title/head_count/active) |
| DELETE | `/org/positions/:id` | Hard delete (cascade) |
| GET | `/org/positions/:id/incumbents` | Lister incumbents |
| POST | `/org/positions/:id/incumbents` | Pourvoir un poste |
| DELETE | `/org/positions/:id/incumbents/:iid` | Retirer un incumbent |
| GET | `/org/delegations?tenant_id=X&active_only=true` | Lister |
| POST | `/org/delegations` | Créer (scope + start_at + end_at + reason) |
| POST | `/org/delegations/:id/revoke` | Soft revoke |
| DELETE | `/org/delegations/:id` | Hard delete |
| GET | `/org/history?entity_type=X&entity_id=Y` | Timeline d'une entité |
| GET | `/org/history/tenant?tenant_id=X&since=&limit=` | Timeline tenant |
| GET | `/org/nodes?tenant_id=X&at=YYYY-MM-DD` | Snapshot passé (time-travel) |
| GET | `/org/persons?tenant_id=X&at=YYYY-MM-DD` | Idem persons |
| GET | `/org/assignments?tenant_id=X&axis=focus` | Filtre axis |
| GET | `/org/assignments/axes/summary?tenant_id=X` | Counts + focus/group nodes |

## Modèle de données (migration 500)

4 nouvelles tables + 5 triggers d'audit :
- `org_positions` (node_id, title, head_count, attributes, active)
- `org_position_incumbents` (position_id, person_id, start/end_date, active)
- `org_audit_log` (tenant_id, entity_type, entity_id, action, diff_json, at)
- `org_delegations` (delegator/delegate_person_id, scope, start_at/end_at, active)

Fonction PL/pgSQL `org_audit_trigger()` branchée sur :
- `org_nodes`, `org_persons`, `org_assignments`, `org_positions`, `org_position_incumbents`.

Chaque INSERT/UPDATE/DELETE écrit un row dans `org_audit_log` avec :
- `insert` / `delete` : snapshot complet (`to_jsonb(NEW|OLD)`)
- `update` : `{before: ..., after: ...}`

## Frontend (`/admin/org-structure`)

- **Toolbar** : `AxisFilterChip` (Tous | Structure | Focus | Comités) avec pastilles couleur ; `TimeTravelSlider` (`input[type=date]` + badge "Vue YYYY-MM-DD" + bouton "Aujourd'hui").
- **Mode read-only** : quand `atDate !== today`, le bouton "Ajouter" est disabled avec tooltip "Vue historique, pas d'édition".
- **Onglet "Postes"** sur le detail-panel : liste positions avec "N/M pourvus · K ouvert(s)", bouton "Pourvoir" par poste vacant, chips incumbents avec bouton retirer.
- **Bouton "Déléguer"** (Share2 icon) sur la fiche personne dans people-tab, à côté du crayon Edit.
- **Panel "Délégations actives"** dans le gutter gauche, polling 60 s ; delegator → delegate avec avatars, scope badge, "Expire dans N h", bouton Révoquer.

## RBAC — branche 5 : délégation

`OrgClient::check` ajoute une 5e étape après direct grant / policy / board / admin :

```
if delegate_person_id = who AND active AND now() ∈ [start_at, end_at] AND scope ∈ {rbac, all}:
    retry steps 1-3 with delegator identity
    if allow → Decision::Allow { source: Delegation { delegation_id, delegator_person_id } }
```

Cache moka 60 s invalidé par le listener `org.delegation.expired`.

## Seeds Nexus Industries

- **OrgSeeder** (81 persons, 14 OUs)
- **FocusNodesSeeder** (3 projets + 2 committees + 25 assignments focus/group)
- **PositionsSeeder** (8 postes + 15 incumbents actifs)
- **DelegationsSeeder** (5 délégations : 2 actives, 3 expirées)

Vérification :
```sql
SELECT axis, count(*) FROM org_assignments WHERE tenant_id=... GROUP BY axis;
-- structure 81, focus 15, group 10
SELECT count(*) FROM org_positions WHERE tenant_id=...;  -- 8
SELECT count(*) FROM org_position_incumbents WHERE tenant_id=...;  -- 16
SELECT count(*), sum(CASE WHEN active THEN 1 ELSE 0 END) FROM org_delegations WHERE tenant_id=...;
-- 5 total, 2 actives
```

## Limites connues

- Le time-travel reverse-apply est coûteux sur gros tenants (>10k events) — pas de cache côté repo, à prévoir en SO2 si la latence dépasse 500 ms.
- Les délégations ne supportent pas la chaînage (delegate d'une délégation ne peut pas re-déléguer).
- `DecisionSource::Delegation` carrie `delegator_person_id` mais pas le scope — l'UI admin doit re-lookup pour afficher le détail.

## Critères de sortie ✅

- [x] Migration 500 appliquée, 4 nouvelles tables
- [x] 5 entités auditées automatiquement
- [x] Time-travel `/org/nodes?at=...` retourne état passé
- [x] 8 positions + 5 délégations seed
- [x] Boot < 5s maintenu
- [x] Clippy workspace clean
- [x] tsc strict clean
- [x] Playwright 3 specs (smoke-level)
- [x] Merge feature/so1-foundations-data → main

## Voir aussi

- `.claude/skills/org-foundations-debug/SKILL.md`
- `docs/superpowers/specs/2026-04-19-so1-foundations-data-design.md`
- `docs/superpowers/plans/2026-04-19-so1-foundations-data.md`
