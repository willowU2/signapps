# SO3 — Scale & Power tools — Plan

> Spec : `docs/superpowers/specs/2026-04-19-so3-scale-power-design.md`. Branche `feature/so3-scale-power`.

---

## T1 — Migration 502 + FTS indexes

**Files :** `migrations/502_so3_scale_power.sql` + `crates/signapps-db/tests/test_migration_502.rs`
- [ ] Test : 4 tables + 3 triggers + 2 GIN indexes présents, contrainte level 1-5, contrainte category enum
- [ ] SQL spec §2
- [ ] Commit `feat(org): migration 502 templates + headcount + skills + FTS`

## T2 — Models + repos

**Files :** `crates/signapps-db/src/models/org/{template,headcount,skill,person_skill}.rs` + `repositories/org/{template,headcount,skill}_repository.rs`
- [ ] Structs FromRow + rustdoc + utoipa::ToSchema
- [ ] SkillCategory enum (Tech/Soft/Language/Domain)
- [ ] TemplateRepository : list + get_by_slug + clone_to_node (accepte target_node_id, crée sous-nodes + positions depuis spec_json, transactionnel)
- [ ] HeadcountRepository : list_by_tenant + upsert + `compute_rollup(tenant, node)` qui retourne `{filled, positions_sum, target, gap}`
- [ ] SkillRepository : list + by_person + tag/untag + endorse
- [ ] Tests unitaires
- [ ] Commit `feat(org): models + repos templates + headcount + skills`

## T3 — Handlers templates + headcount

**Files :** `services/signapps-org/src/handlers/{templates,headcount}.rs`

Endpoints :
- `GET /org/templates` + `GET /org/templates/:slug`
- `POST /org/templates/:slug/clone` body `{target_node_id, name_prefix?}` → liste nodes+positions créés
- `GET /org/headcount?tenant_id=X` → rollup par node
- `POST /org/headcount` → create plan
- `PUT /org/headcount/:id` → update

- [ ] Handlers + utoipa + tracing + tests
- [ ] Commit `feat(org): templates clone + headcount plan API`

## T4 — Handlers skills + search

**Files :** `services/signapps-org/src/handlers/{skills,search}.rs`

Endpoints :
- `GET /org/skills?category=X&tenant_id=Y` → list
- `POST /org/skills` → create custom skill
- `GET /org/persons/:id/skills` → list tagged
- `POST /org/persons/:id/skills` body `{skill_id, level}` → upsert
- `DELETE /org/persons/:id/skills/:skill_id`
- `POST /org/persons/:id/skills/:skill_id/endorse`
- `GET /org/search?q=X&tenant_id=Y&limit=20` → persons+nodes+skills (FTS) avec ranking

- [ ] FTS query utilise `ts_rank` sur les indexes GIN créés, prefix-match en fallback avec `LIKE`
- [ ] Result shape `{persons:[], nodes:[], skills:[], total}`
- [ ] Tests
- [ ] Commit `feat(org): skills + global search API`

## T5 — Seed templates + skills

**Files :** `services/signapps-seed/src/seeders/{templates,skills}.rs`

- [ ] Templates : 4 specs JSON dans `services/signapps-seed/data/templates/*.json` → chargés et seedés (slug, name, description, industry, spec_json)
  - `startup-20` : 1 root, 4 units (Direction, Engineering, Sales, Ops), 5 positions
  - `scale-up-saas-80` : 1 root, 6 units, 15 positions (template plus riche)
  - `eti-industrielle-300` : 1 root, 8 units + 12 sub-units, 25 positions
  - `agency-50` : 1 root, 5 units (Creative, Tech, Account, Production, Ops), 10 positions
- [ ] Skills catalog : 40 skills globaux (tenant_id NULL, is_public via pas de RLS) répartis en 4 catégories
- [ ] Person-skills : tag 30 persons Nexus avec 3-5 skills chacune (deterministic : acme_uuid, même personne → même skills à chaque run)
- [ ] Headcount plans : 8 plans à +90 jours
- [ ] Test idempotence
- [ ] Commit `feat(seed): 4 templates + 40 skills + 30 persons tagged + 8 headcount plans`

## T6 — Handler bulk + API client

**Files :** `services/signapps-org/src/handlers/bulk.rs` + `client/src/lib/api/org.ts` extensions

Endpoints :
- `POST /org/bulk/move` body `{person_ids: [uuid], target_node_id: uuid, axis: 'structure'|'focus'|'group'}` → creates/updates assignments in transaction
- `POST /org/bulk/export` body `{person_ids: []}` → returns CSV file
- `POST /org/bulk/assign-role` body `{person_ids, role}` → update role in attributes

- [ ] Handlers + tests
- [ ] Commit `feat(org): bulk move + export + assign-role API`

## T7 — Frontend omnibox ⌘K

**Files :**
- `client/src/hooks/useGlobalSearch.ts` (debounced query)
- `client/src/components/common/command-palette.tsx` (shadcn Command component)
- Wiring global via `app-layout.tsx` : écouteur `Ctrl/Cmd+K` ouvre palette

- [ ] Palette : input + 3 sections (persons/nodes/skills) avec icônes + clic navigate
- [ ] Highlight match dans results
- [ ] Kbd shortcut affiché dans toolbar
- [ ] Commit `feat(ui): global command palette Cmd+K omnibox`

## T8 — Frontend skills + headcount UI

**Files :**
- `client/src/app/admin/org-structure/components/skills-section.tsx` (section sur person card)
- `client/src/app/admin/org-structure/components/headcount-tab.tsx` (tab sur node card)
- `client/src/app/admin/org-structure/components/dialogs/template-clone-dialog.tsx`

- [ ] Skills : liste avec level slider 1-5, add via combobox, endorse button
- [ ] Headcount : tableau filled/head_count/target/gap + édition inline
- [ ] Template dialog : preview spec, pick target parent, go → appelle clone API
- [ ] Commit `feat(ui): skills + headcount + template-clone`

## T9 — Dashboard headcount + bulk persons

**Files :**
- `client/src/app/admin/headcount/page.tsx` (nouveau)
- `client/src/app/admin/persons/page.tsx` extension (bulk select + actions footer)

- [ ] Dashboard : cards par OU avec filled/target/gap, bar chart via Recharts, liste "open positions" global
- [ ] Persons page : row checkboxes + footer sticky "N selected · Move · Export · Mail", actions via orgApi.bulk.*
- [ ] Commit `feat(admin): headcount dashboard + bulk ops persons`

## T10 — E2E + docs + merge

**Files :**
- `client/e2e/so3-omnibox.spec.ts`
- `client/e2e/so3-bulk-move.spec.ts`
- `client/e2e/so3-template-clone.spec.ts`
- `client/e2e/so3-skills.spec.ts`
- `docs/product-specs/68-so3-scale-power.md`
- `.claude/skills/org-scale-debug/SKILL.md`

- [ ] 4 specs Playwright (skip gracieux si backend non up)
- [ ] Product spec + debug skill
- [ ] Clippy + tsc + build OK
- [ ] Boot < 5s
- [ ] Merge `feature/so3-scale-power → main --no-ff` (local)
- [ ] Commit `docs(so3): product spec + debug skill`

---

**Fin plan SO3.**
