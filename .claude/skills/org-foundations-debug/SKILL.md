---
name: org-foundations-debug
description: Use when SO1 positions / delegations / time-travel / multi-axes behaviour is unexpected — empty positions list despite seed, incumbents occupancy counter off, delegations never expiring, time-travel returning current state instead of past snapshot, or RBAC refusing access to a delegate with an active rbac-scope delegation. Covers the `org_positions`, `org_position_incumbents`, `org_audit_log`, `org_delegations` tables, the 5 SQL audit triggers, the 15-min tokio cron, and the 5-step `OrgClient::check` resolver.
---

# org-foundations-debug

Use this skill when SO1 foundations data misbehaves — positions stuck, audit log empty, delegations not expiring, time-travel returning wrong state, or RBAC refusing access despite an active delegation.

## Architecture recap

SO1 adds 4 tables to the canonical `org_*` schema and one tokio cron in `signapps-org`:

| Table | Purpose | Seed count |
|---|---|---|
| `org_positions` | Siège typé par node (title + head_count + attributes) | 8 |
| `org_position_incumbents` | Occupants (temporal : start/end_date, active) | 16 (15 actifs) |
| `org_audit_log` | Journal auto-alimenté via 5 triggers SQL | ~2000+ après seed |
| `org_delegations` | Délégations temporaires (scope manager/rbac/all) | 5 (2 actives) |

Les 5 tables auditées sont : `org_nodes`, `org_persons`, `org_assignments`, `org_positions`, `org_position_incumbents`. La fonction PL/pgSQL `org_audit_trigger()` écrit :
- `insert` / `delete` → snapshot complet (`to_jsonb(NEW|OLD)`)
- `update` → `{before: ..., after: ...}`

Le cron `spawn_delegation_expire_worker` (`services/signapps-org/src/lib.rs`) tick toutes les 15 min et flipe `active = false` sur les rows dont `end_at < NOW()`. Chaque flip publie `org.delegation.expired` sur le `PgEventBus`.

`OrgClient::check` (rbac_client.rs) évalue 5 rules dans l'ordre :
1. `direct_grant` (org_access_grants)
2. `policy_binding` (org_policy_bindings avec LTREE join)
3. `board_member` (org_board_members)
4. Admin role (JWT claim)
5. **SO1 Delegation** — si caller est delegate actif scope ∈ {rbac, all}, re-run 1-3 avec identité du delegator

## Common issues

- **Positions tab vide malgré seed 8 positions** — vérifier que `PositionsSeeder` a tourné (le binaire cherche `node(slug)` dans la `SeedContext`, qui n'est peuplé QUE si `OrgSeeder` tourne avant). Re-run `./target/debug/signapps-seed --force --database-url=...`. Si dev env : les tables sont en `public.*`, pas de préfixe schema.
- **Occupancy compteur faux (filled > head_count)** — contrainte applicative, pas DB. Regarder `PositionRepository::occupancy(position_id)` : il fait `SELECT count(*) FROM org_position_incumbents WHERE active AND position_id=...`. Si une personne est incumbent sur plusieurs positions, chaque poste compte séparément. Inspect avec : `SELECT pos.title, count(inc.*) FILTER (WHERE inc.active) FROM org_positions pos LEFT JOIN org_position_incumbents inc ON inc.position_id=pos.id GROUP BY pos.id`.
- **Audit log vide après une modification** — les triggers sont absents. Check : `SELECT tgname FROM pg_trigger WHERE tgname LIKE 'org_%_audit'` doit retourner 5 lignes. Sinon, migration 500 n'a pas été appliquée — restart backend pour déclencher `sqlx::migrate!()`.
- **Time-travel retourne l'état courant** — le param `?at=` n'a pas transité. Vérifier :
  1. Le frontend passe bien l'ISO timestamp (`YYYY-MM-DDTHH:mm:ssZ`, pas juste `YYYY-MM-DD`).
  2. La query query param `at` est parsé comme `DateTime<Utc>` dans `ListQuery`. Un `NaiveDate` à la place casse sans erreur visible.
  3. `AuditRepository::snapshot_at` a des events postérieurs à `at` à reverse-apply ; sinon retourne l'état courant directement.
- **Time-travel retourne trop peu de rows** — `current_rows_as_json` filtre `WHERE tenant_id = $1`, donc si des rows ont été supprimées côté DB (`delete` action dans l'audit), elles ne sont ré-incluses QUE si leur DELETE event est postérieur à `at`. Bien : les inserts postérieurs sont retirés (OK). Mauvais : un UPDATE `before` peut être perdu si la row a été delete ensuite — limitation connue.
- **Délégation créée mais le delegate ne peut rien faire** — 3 causes possibles :
  1. `scope = 'manager'` → ne donne PAS de permissions RBAC. Créer avec `scope = 'rbac'` ou `'all'`.
  2. `now()` hors fenêtre `[start_at, end_at]`. Check : `SELECT id, now() BETWEEN start_at AND end_at FROM org_delegations WHERE id=...`.
  3. Cache RBAC moka 60 s pas encore expiré — attendre ou forcer via invalidation event.
- **Cron expire ne fait rien** — le worker skippe le premier tick (évite le boot cost). Après 15 min, `DelegationRepository::expire_due(NOW)` flip. Tracer via `RUST_LOG=info,signapps_org=debug`. Log attendu : `delegation expire worker: expired count=N`.
- **Clippy warning sur `check_via_delegation`** — cette fn appelle `direct_grant` / `policy_binding` / `board_member` qui sont `async`. Si tu les wrappes dans un `futures::join_all` ou un `try_join_all` pour paralléliser, attention à la sqlx::PgPool semaphore (50 slots par défaut) — tu peux drainer la pool si plusieurs délégations actives par user.

## SQL snippets utiles

```sql
-- Voir toutes les positions avec occupancy pour un tenant.
SELECT pos.title, pos.head_count,
       count(inc.*) FILTER (WHERE inc.active) AS filled,
       pos.head_count - count(inc.*) FILTER (WHERE inc.active) AS vacant
  FROM org_positions pos
  LEFT JOIN org_position_incumbents inc ON inc.position_id = pos.id
 WHERE pos.tenant_id = '6a16dd8c-dca6-4d7a-af3a-a9ebb4247934'
 GROUP BY pos.id
 ORDER BY pos.title;

-- Délégations actives.
SELECT d.id, p1.email AS delegator, p2.email AS delegate, d.scope, d.end_at
  FROM org_delegations d
  JOIN org_persons p1 ON p1.id = d.delegator_person_id
  JOIN org_persons p2 ON p2.id = d.delegate_person_id
 WHERE d.tenant_id = '6a16dd8c-dca6-4d7a-af3a-a9ebb4247934'
   AND d.active = true
   AND now() BETWEEN d.start_at AND d.end_at;

-- Audit log pour un node.
SELECT at, action, diff_json->'before'->>'name' AS before_name,
       diff_json->'after'->>'name' AS after_name
  FROM org_audit_log
 WHERE entity_type = 'org_nodes'
   AND entity_id = '<node-uuid>'
 ORDER BY at DESC
 LIMIT 20;

-- Forcer expire cron (dev only).
UPDATE org_delegations SET active=false, updated_at=now()
 WHERE active=true AND end_at < now()
 RETURNING id;
```

## Fichiers clés

- `migrations/500_so1_foundations.sql` — schema + triggers + function
- `crates/signapps-db/src/models/org/{position,position_incumbent,audit,delegation}.rs`
- `crates/signapps-db/src/repositories/org/{position,audit,delegation}_repository.rs`
- `services/signapps-org/src/handlers/{positions,history,delegations}.rs`
- `services/signapps-org/src/rbac_client.rs` (branche 5 delegation)
- `services/signapps-org/src/lib.rs` (`spawn_delegation_expire_worker`)
- `services/signapps-seed/src/seeders/{focus_nodes,positions,delegations}.rs`
- `client/src/app/admin/org-structure/components/{positions-tab,time-travel-slider,axis-filter-chip,active-delegations-panel}.tsx`

## Tests

- `cargo test -p signapps-db --test test_migration_500 -- --ignored` — schema vérifié
- `cargo test -p signapps-db --test so1_repos -- --ignored` — repos CRUD
- `cargo test -p signapps-org --test delegation_rbac -- --ignored` — RBAC transitive
- `cd client && npx playwright test so1-positions so1-time-travel so1-delegations`

Boot budget : `cargo test -p signapps-platform --test boot -- --ignored` doit rester < 5 s. Le cron tokio + la fonction PL/pgSQL ajoutent ~30 ms au boot, plus dans le budget.
