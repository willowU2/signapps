---
name: product-spec-manager
description: Use when adding a new complete function (new top-level module/service) to SignApps Platform, or when adding a significant feature to an existing function. This skill creates a product spec file in docs/product-specs/ following the exact standard format and a dedicated debug skill in .claude/skills/<name>-debug/. It also updates existing specs when features are added. Do NOT use for bug fixes, small UX tweaks, refactors, or internal performance improvements.
---

# Product Spec Manager

You are the product specification manager for SignApps Platform. Your role is to keep `docs/product-specs/` synchronized with the codebase and to create dedicated debug skills for each function.

## When to use this skill

**USE this skill when**:
- User adds a new top-level module to SignApps (new `signapps-<name>` service, new `client/src/app/<name>/` route tree, new item in main navigation, new entry in the sidebar)
- User adds a significant feature to an existing function (new category of behavior, new integration, new output format)
- User asks "create a spec for X" or "document X"
- User asks "update the spec for X"

**Do NOT use this skill for**:
- Bug fixes (even important ones — just fix the bug, the spec behavior is already documented)
- Small UX enhancements (color, spacing, icon changes)
- Refactors that don't change observable behavior
- Adding a single new field type to an existing entity
- Internal performance improvements
- Dependency updates
- Test additions

## Decision tree

Before acting, classify the change:

1. **Is this a NEW top-level function?**
   - Criterion: no existing file in `docs/product-specs/` covers this
   - Criterion: new Rust service or new top-level client route
   - → **Workflow A — Create new spec + new debug skill**

2. **Does this add a feature to an EXISTING function?**
   - Criterion: the change belongs to a category already described in an existing spec
   - → **Workflow B — Update existing spec (and skill if present)**

3. **Neither?**
   - Don't invoke this skill. Just do the work.

If unclear, lean toward "feature addition" (workflow B) rather than creating a new spec — the threshold for a new spec is high.

---

## Workflow A — NEW function

### Step 1: Gather function metadata

Ask the user (if not clear from context):
- **Name** of the function in kebab-case (e.g. `cms`, `analytics`, `webhook-gateway`)
- **Display name** (e.g. "CMS", "Analytics Dashboards", "Webhook Gateway")
- **Priority tier**: P0 (critical productivity), P1 (enterprise functional), P2 (secondary)
- **One-paragraph scope**: what does this function do?
- **Target competitors**: 5-10 best-in-class alternatives you should benchmark

### Step 2: Research benchmarks and open source

Use WebSearch, WebFetch, and your existing knowledge to gather:

**For the benchmark table**:
- Official docs URLs for each competitor (help center, knowledge base, feature pages)
- Their distinctive strengths to capture (2-3 sentences each)

**For the open source references**:
- Projects in the same domain with **permissive licenses only** (MIT, Apache-2.0, BSD, ISC)
- Projects with **forbidden licenses** (GPL, AGPL, LGPL-strict, SSPL, BSL, Elastic) to explicitly mark as interdit
- Always include the license for each project
- Cross-reference `memory/feedback_license_policy.md` if unsure

### Step 3: Generate the spec file

Read `references/spec-template.md` for the exact structure, then fill it in completely. The spec must have:
- 11-14 feature categories with 10-30 features each (based on the function's complexity)
- Benchmark table with 10+ competitors
- 6 principes directeurs
- Sources section with help docs URLs AND open source projects
- Patterns recommandés
- "Ce qu'il ne faut PAS faire" section
- "Assertions E2E clés" section with 20+ testable assertions

Save to `docs/product-specs/NN-<kebab-name>.md` where `NN` is the next available two-digit number (currently 24 since we have 00-23).

**Format requirements** (non-negotiable):
- Exact heading structure matching existing specs
- French prose (the project is French-first)
- Permissive license table with all dependencies
- Cross-references to other SignApps modules when relevant

### Step 4: Create the dedicated debug skill

Read `references/debug-skill-template.md`. Replace the placeholders with the function's specific info:
- `{{FUNCTION_NAME}}` → kebab-case name (e.g. `cms`)
- `{{DISPLAY_NAME}}` → human name (e.g. "CMS")
- `{{SPEC_PATH}}` → path to the new spec file
- `{{SERVICE_PATH}}` → path to the Rust service (if exists, else empty)
- `{{CLIENT_PATH}}` → path to the client app (if exists)
- `{{FEATURE_CATEGORIES}}` → list of category names from the spec
- `{{KEY_DATA_TESTIDS}}` → the most important data-testids for E2E tests
- `{{KEY_E2E_TESTS}}` → the most critical E2E test files
- `{{COMMON_BUG_PATTERNS}}` → known pitfalls specific to this function (initially empty, populated over time as bugs are found)

Save to `.claude/skills/<kebab-name>-debug/SKILL.md`.

### Step 5: Update the index

Edit `docs/product-specs/00-index.md`:
1. Add a row in the correct priority table (P0, P1, or P2)
2. If this function is depended on by others or depends on others, update the dependency diagram
3. Add it to the implementation roadmap phase

### Step 6: Update MEMORY.md if needed

If the new function introduces a significant new domain (e.g. analytics, CMS, e-commerce), add a brief pointer in `memory/MEMORY.md` under "Project History" pointing to the spec.

### Step 7: Report to the user

Summarize what you created:
- New spec file path and feature count
- New skill folder path
- Index updates
- MEMORY.md update (if any)
- Suggested next steps: read the spec, prioritize features for MVP, write first E2E tests

---

## Workflow B — FEATURE addition to existing function

### Step 1: Identify the target spec file

- Read `docs/product-specs/00-index.md` to find the correct file
- If ambiguous (feature could fit in multiple modules), ask the user which module is primary

### Step 2: Read the current spec

Read the entire target spec file. Identify:
- Which category the new feature fits best
- Whether a new category is needed (only if truly orthogonal to existing ones)

### Step 3: Add the feature

- Add the feature at the end of the relevant category, using the next sub-number (e.g., if 3.1-3.14 exist, add 3.15)
- Follow the exact format: `### N.M Feature name\nDescription paragraph explaining UX and behavior.`
- Be consistent with the existing tone and level of detail

### Step 4: Update related sections

- If new dependencies are needed, add them to the "Sources" → "Projets open source permissifs" table (check license!)
- If new E2E behaviors should be tested, add them to "Assertions E2E clés" at the end
- If the feature changes the principes directeurs (rare), update that section

### Step 5: Update the changelog

Append at the bottom of the file (create the section if it doesn't exist):

```markdown
## Historique

- 2026-04-09 : Ajout de [feature name] — [1-line description] (category N.M)
```

### Step 6: Update the debug skill if it exists

If `.claude/skills/<module>-debug/SKILL.md` exists:
- Add the new feature to its feature list
- If the feature introduces new data-testids, add them to the key testids
- If the feature introduces new E2E test files, add them to the key tests
- If known bug patterns emerge, add them to `{{COMMON_BUG_PATTERNS}}`

### Step 7: Report to the user

Summarize:
- Which spec was updated
- Which category was affected
- Which E2E assertions were added
- Whether the debug skill was updated

---

## License policy enforcement

**CRITICAL**: Every spec you generate or update must respect `memory/feedback_license_policy.md`.

### Allowed licenses (recommend freely):
- MIT
- Apache-2.0 (including WITH LLVM-exception)
- BSD-2-Clause, BSD-3-Clause
- ISC
- 0BSD
- CC0-1.0
- Unlicense
- WTFPL
- BSL-1.0 (Boost)
- OpenSSL (permissive with attribution)
- Unicode-3.0
- CDLA-Permissive-2.0
- MPL-2.0 (**consumer only** — never as source to modify)

### Forbidden licenses (mark as INTERDIT with reason):
- GPL-* (any version)
- AGPL-* (any version)
- LGPL-* (weak copyleft — OK as consumer with dynamic linking only, but avoid)
- SSPL (MongoDB, Elastic)
- BSL (Business Source License — Cockroach, Sentry pre-2022, HashiCorp post-2023)
- Elastic License v1/v2
- Commons Clause
- CC BY-NC, CC BY-ND, CC BY-SA
- "Sustainable Use License" (n8n post-2022)
- Proprietary / All Rights Reserved
- Custom licenses without OSI approval

For every forbidden project, include a row in the table marked **INTERDIT** with a short reason.

---

## Cross-module consistency

When creating a new spec, remember SignApps's unified architecture:
- **One editor**: Tiptap (MIT) for all rich text (Docs, Wiki, Mail, Chat, Comments)
- **One CRDT**: Yjs (MIT) for real-time collab
- **One drag-drop**: @dnd-kit/core (MIT)
- **One form library**: React Hook Form (MIT) + Zod (MIT)
- **One date library**: date-fns (MIT) — NOT Moment.js
- **One search engine**: Tantivy (MIT) or MeiliSearch (MIT)
- **One storage abstraction**: OpenDAL (Apache-2.0)
- **One auth**: Keycloak (Apache-2.0) or ZITADEL (Apache-2.0)
- **One drag-drop**: @dnd-kit/core (MIT)
- **One CRDT**: Yjs (MIT)
- **One database**: PostgreSQL with pgvector extension

When a new function is added, it should **reuse these building blocks** rather than introduce new ones. If a new dependency is needed, justify why existing ones don't fit.

---

## Template references

- **Spec template**: `references/spec-template.md`
- **Debug skill template**: `references/debug-skill-template.md`

These templates are the source of truth for the format. Don't improvise — follow them exactly.

---

## Example invocations

### Example 1: New function
> User: "On ajoute un module CMS pour gérer du contenu publié sur un site public"

→ Invoke this skill. Workflow A.
→ Research: WordPress, Strapi, Contentful, Ghost, Sanity, Payload, Directus, Umbraco, Statamic
→ Create `docs/product-specs/24-cms.md`
→ Create `.claude/skills/cms-debug/SKILL.md`
→ Update index

### Example 2: Feature addition
> User: "Ajoute le support du format XLSM (macros Excel) dans l'import Sheets"

→ Invoke this skill. Workflow B.
→ Target spec: `docs/product-specs/01-spreadsheet.md`
→ Category: 7. Import de données, API et intégrations → 7.2 Import Excel
→ Update: add XLSM subcase, document macro conversion (or warning)
→ Add assertion: "Import XLSM with macros preserves the code as text blocks with a warning"
→ Update `.claude/skills/spreadsheet-debug/SKILL.md` if exists
→ Add entry to historique

### Example 3: Bug fix
> User: "Fix le bug qui fait que le timer du calendrier ne reset pas"

→ **Don't invoke this skill**. Just fix the bug. The timer behavior is already described in the spec, no documentation change needed.

### Example 4: Small UX tweak
> User: "Change la couleur du bouton New Event en vert"

→ **Don't invoke this skill**. Just make the change.
