# 68 — SO3 Scale & Power tools

**Status:** Implémenté (2026-04-19)
**Owner:** Platform team
**Spec:** `docs/superpowers/specs/2026-04-19-so3-scale-power-design.md`
**Plan:** `docs/superpowers/plans/2026-04-19-so3-scale-power.md`

## Vue d'ensemble

SO3 apporte les outils de **mise à l'échelle** par-dessus SO1 + SO2 :

1. **Templates d'organisation** — 4 built-in seedés (`startup-20`,
   `scale-up-saas-80`, `eti-industrielle-300`, `agency-50`). Chaque
   template porte un `spec_json` de hiérarchie + postes clonable sous un
   noeud existant en une seule transaction.
2. **Headcount planning** — plans trimestriels/annuels par OU, avec
   rollup automatique `{filled, positions_sum, target, gap, status}` et
   statut calculé (`on_track`, `understaffed`, `over_plan`).
3. **Skills & compétences** — catalog global (40 skills seedés) réparti
   en 4 catégories (`tech`, `soft`, `language`, `domain`), plus
   tagging individuel 1-5 avec endorsements optionnels.
4. **Recherche globale (omnibox ⌘K)** — full-text PostgreSQL via GIN
   `tsvector` sur persons et nodes + `ILIKE` fallback. Palette de
   commandes shadcn (`cmdk`) montée globalement dans `AppLayout`.
5. **Bulk operations** — sélection multiple sur `/admin/persons` avec
   footer sticky et 3 actions (move vers OU, export CSV, assign-role).

## Modèle de données (migration 502)

Quatre nouvelles tables + 2 index GIN FTS :

- `org_templates(id, slug UNIQUE, name, description, industry,
  size_range, spec_json JSONB, is_public, created_by_tenant_id)`.
- `org_headcount_plan(id, tenant_id, node_id, target_head_count,
  target_date, notes)` — plusieurs plans par node autorisés.
- `org_skills(id, tenant_id NULL allowed, slug, name, category, …)`
  avec `UNIQUE(tenant_id, slug)`.
- `org_person_skills(person_id, skill_id, level 1-5,
  endorsed_by_person_id, …)` — PK composite.
- Indexes : `idx_persons_fts` + `idx_nodes_fts` GIN sur tsvector.

Les tables `org_headcount_plan`, `org_skills`, `org_templates` ont un
trigger d'audit (pour les tenants non-null).

## Routes backend (signapps-org port 3026, prefix `/api/v1`)

### Templates
- `GET    /org/templates?industry=` → list publics
- `GET    /org/templates/:slug` → detail
- `POST   /org/templates/:slug/clone` → clone sous `target_node_id`

### Headcount
- `GET    /org/headcount?tenant_id=X&node_id=?` → plans + rollups
- `GET    /org/headcount/rollup?tenant_id=X&node_id=Y` → rollup unique
- `POST   /org/headcount` → create
- `PUT    /org/headcount/:id` → update
- `DELETE /org/headcount/:id`

### Skills
- `GET    /org/skills?tenant_id=?&category=?` → list
- `POST   /org/skills` → upsert custom
- `GET    /org/persons/:id/skills` → tagged
- `POST   /org/persons/:id/skills` → upsert tag
- `DELETE /org/persons/:id/skills/:skill_id` → untag
- `POST   /org/persons/:id/skills/:skill_id/endorse` → endorsement

### Search
- `GET    /org/search?q=X&tenant_id=Y&limit=20` → persons + nodes + skills

### Bulk
- `POST   /org/bulk/move` → batch `AssignmentRepository::create`
- `POST   /org/bulk/export` → CSV `attachment; filename=persons.csv`
- `POST   /org/bulk/assign-role` → `jsonb_set(attributes.title)`

## Seeds

`signapps-seed` ajoute 3 nouveaux seeders :

- `TemplatesSeeder` — charge 4 fichiers JSON depuis
  `services/signapps-seed/data/templates/`.
- `SkillsSeeder` — 40 skills globaux + ~130 person-skill tags pour 30
  persons Nexus.
- `HeadcountSeeder` — 8 plans à +90 jours, 1 par OU top-level.

Tous idempotents via `ON CONFLICT DO UPDATE` et `acme_uuid`.

## Frontend

- `client/src/lib/api/org.ts` — extensions `orgApi.templates.*`,
  `orgApi.headcount.*`, `orgApi.skills.*`, `orgApi.search`,
  `orgApi.bulk.*`.
- `client/src/hooks/use-global-search.ts` — hook debounced (150 ms).
- `client/src/components/common/command-palette.tsx` — palette montée
  globalement via `AppLayout`.
- `client/src/app/admin/org-structure/components/skills-section.tsx` —
  section compétences sur la fiche person.
- `client/src/app/admin/org-structure/components/headcount-tab.tsx` —
  onglet "Effectifs" sur la fiche node.
- `client/src/app/admin/org-structure/components/dialogs/template-clone-dialog.tsx`.
- `client/src/app/admin/headcount/page.tsx` — dashboard tenant-wide avec
  Recharts.
- `client/src/app/admin/persons/page.tsx` — bulk checkboxes + sticky
  footer + dialogs.

## Exit criteria atteints

- [x] Migration 502 appliquée, 4 tables + 2 FTS indexes.
- [x] 4 templates + 40 skills + 30 persons tagged + 8 headcount plans seedés.
- [x] ⌘K search retourne persons + nodes + skills.
- [x] Bulk move fonctionne (batch assignment creation).
- [x] `cargo clippy` + `tsc` + `next build` clean.
- [x] 4 E2E Playwright (skip gracieux si backend down).
- [x] Merge local `feature/so3-scale-power → main --no-ff`.
