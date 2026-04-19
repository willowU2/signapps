---
name: org-scale-debug
description: Use when SO3 scale & power features misbehave — templates cloning failing with "parent_slug not yet created", headcount rollup returning 0 filled despite active incumbents, skills catalog not listing global rows, ⌘K omnibox returning empty, or bulk move reporting errors. Covers `org_templates`, `org_headcount_plan`, `org_skills`, `org_person_skills` tables, FTS GIN indexes, the cmdk palette + debounced hook, and the AssignmentRepository batch writes.
---

# org-scale-debug

Use this skill when SO3 surfaces break — template clone, headcount rollup, skills tagging, omnibox search, or bulk operations.

## Architecture recap

| Table | Purpose | Seed count |
|---|---|---|
| `org_templates` | Built-in + custom org structures (spec_json) | 4 (startup-20, scale-up-saas-80, eti-industrielle-300, agency-50) |
| `org_headcount_plan` | Target head_count per (node, date) | 8 (1 per Nexus top OU) |
| `org_skills` | Global + per-tenant skills catalog | 40 globaux (tech/soft/language/domain) |
| `org_person_skills` | Tag (person, skill) with level 1-5 + endorsement | ~130 rows (30 persons × 3-5 skills) |

Indexes :
- `idx_persons_fts` GIN on `tsvector('simple', first_name + last_name + email)`.
- `idx_nodes_fts` GIN on `tsvector('simple', name + slug)`.

Templates use a bespoke audit trigger (`org_templates_audit_trigger()`) that skips the write when `created_by_tenant_id IS NULL` (built-in globals shouldn't pollute tenant audit logs).

`SkillRepository::upsert` emulates `ON CONFLICT` manually because Postgres treats `UNIQUE(tenant_id NULL, slug)` as `NULL != NULL` — two rows with `tenant_id = NULL` and same slug would not collide. Watch out if you add a new upsert path.

## Common issues

- **`POST /org/templates/:slug/clone` returns 500 "parent_slug X not yet created"** — the spec_json nodes must be in DFS order: every node referencing `parent_slug` must appear after its parent. Re-check the template JSON or regenerate via `services/signapps-seed/src/seeders/templates.rs`.
- **Clone succeeds but positions count is 0** — the `node_slug` in each position must match one of the `nodes[*].slug`. Check `spec_json.positions[].node_slug` vs `spec_json.nodes[].slug`.
- **LTREE `invalid syntax for type ltree` on clone** — the template slug contains a character that LTREE rejects (`-`, `&`, `!`…). `sanitize_ltree_segment` in `template_repository.rs` already replaces non-alphanumeric chars with `_`. If the target node path itself is invalid, fix it first.
- **Headcount rollup returns `filled=0` despite active incumbents** — the rollup counts only incumbents on **positions attached to the node itself**, not to descendants. For a tenant-wide view use `GET /org/headcount?tenant_id=X` which lists per-node rollups, then aggregate client-side.
- **Headcount rollup `status='no_plan'` but plan exists** — plans with `target_date < CURRENT_DATE` are ignored (the rollup picks only future plans). Update the plan's date or create a new one.
- **Skills catalog `GET /org/skills` returns empty** — without `tenant_id` query, only global skills are returned. Check with `SELECT COUNT(*) FROM org_skills WHERE tenant_id IS NULL` → must be ≥ 40.
- **Cannot endorse a skill (`404 person_skill not found`)** — endorsement requires the (person, skill) tuple to already exist (`POST /org/persons/:id/skills` first). The UI `SkillsSection` enforces this.
- **Omnibox ⌘K returns empty for single-letter query** — the handler uses FTS for queries ≥ 3 chars, `ILIKE` fallback below. For 1-2 chars, only prefix-match applies and matches may be sparse. Type more.
- **Omnibox takes 100+ ms on every keystroke** — the `useGlobalSearch` hook debounces by 150 ms. If it still feels slow, check that `idx_persons_fts` and `idx_nodes_fts` exist (`\di+ idx_*_fts` in psql). A cold GIN scan on the first query is slower.
- **Bulk move reports `errors`** — partial failures per person_id are reported in the response. Common cause: the target node doesn't exist or the person_id is in another tenant. Inspect `response.data.errors[]`.
- **Bulk export CSV download empty** — axios `responseType: "blob"` must be set on the request, which the client does. If the Blob is not a real Blob (some axios versions stringify), the fallback `new Blob([String(payload)])` catches it. If you see an empty file: check `POST /org/bulk/export` body — `person_ids` must not be empty.

## Debug commands

```bash
# Verify migration 502 is applied.
docker exec signapps-postgres psql -U signapps -d signapps -c \
    "SELECT table_name FROM information_schema.tables
     WHERE table_name IN ('org_templates','org_headcount_plan','org_skills','org_person_skills')"

# Count seeds.
docker exec signapps-postgres psql -U signapps -d signapps -c \
    "SELECT 'templates' AS kind, count(*) FROM org_templates
     UNION ALL SELECT 'skills', count(*) FROM org_skills
     UNION ALL SELECT 'person_skills', count(*) FROM org_person_skills
     UNION ALL SELECT 'headcount', count(*) FROM org_headcount_plan"

# Verify FTS indexes.
docker exec signapps-postgres psql -U signapps -d signapps -c \
    "SELECT indexname FROM pg_indexes WHERE indexname IN ('idx_persons_fts','idx_nodes_fts')"

# Smoke test the endpoints.
curl -s http://localhost:3026/api/v1/org/templates | jq 'length'
curl -s 'http://localhost:3026/api/v1/org/skills?category=tech' | jq 'length'
curl -s 'http://localhost:3026/api/v1/org/search?q=marie&tenant_id=6a16dd8c-dca6-4d7a-af3a-a9ebb4247934' | jq '.total'
```

## Relevant source files

- `migrations/502_so3_scale_power.sql`
- `crates/signapps-db/src/models/org/{template,headcount,skill,person_skill}.rs`
- `crates/signapps-db/src/repositories/org/{template,headcount,skill}_repository.rs`
- `services/signapps-org/src/handlers/{templates,headcount,skills,search,bulk}.rs`
- `services/signapps-seed/src/seeders/{templates,skills,headcount}.rs`
- `services/signapps-seed/data/templates/*.json`
- `client/src/lib/api/org.ts` (extensions SO3)
- `client/src/hooks/use-global-search.ts`
- `client/src/components/common/command-palette.tsx`
- `client/src/app/admin/headcount/page.tsx`
- `client/src/app/admin/persons/page.tsx` (bulk)
