---
name: {{FUNCTION_NAME}}-debug
description: Use when debugging or verifying the {{DISPLAY_NAME}} module of SignApps Platform. This skill references the product spec at {{SPEC_PATH}} as the source of truth for expected behavior. It provides a complete debug checklist (code paths, data-testids, E2E tests, OSS dependencies, common pitfalls) to systematically investigate issues with {{DISPLAY_NAME}}.
---

# {{DISPLAY_NAME}} — Debug Skill

This skill is the **dedicated debugging companion** for the `{{DISPLAY_NAME}}` module of SignApps Platform. It is paired with the product spec `{{SPEC_PATH}}` which defines the expected behavior, and exists to make issue investigation fast, systematic, and complete.

## Source of truth

The source of truth for **expected behavior** of this module is:
**`{{SPEC_PATH}}`**

Always read the spec first before starting to debug. If an observed behavior contradicts the spec, either:
1. The code is wrong → fix the code
2. The spec is wrong/outdated → update the spec (invoke `product-spec-manager` with workflow B)

## Code map

### Backend (Rust)
- **Service**: `{{SERVICE_PATH}}` (ex: `services/signapps-{{FUNCTION_NAME}}/`)
- **Crate(s)**: `{{CRATE_PATHS}}` (ex: `crates/signapps-db-{{FUNCTION_NAME}}/`)
- **Main handlers**: `{{SERVICE_PATH}}/src/handlers/`
- **DB migrations**: `migrations/` (search for `{{FUNCTION_NAME}}`)
- **Port**: `{{PORT_NUMBER}}` (see `CLAUDE.md` workspace layout)

### Frontend (Next.js + React)
- **App route**: `{{CLIENT_PATH}}` (ex: `client/src/app/{{FUNCTION_NAME}}/`)
- **Components**: `client/src/components/{{FUNCTION_NAME}}/`
- **Stores**: `client/src/stores/{{FUNCTION_NAME}}-store.ts` (if any)
- **API client**: `client/src/lib/api/{{FUNCTION_NAME}}.ts`
- **Types**: `client/src/types/{{FUNCTION_NAME}}.ts`

### E2E tests
- `client/e2e/{{FUNCTION_NAME}}-*.spec.ts`
- Page Object: `client/e2e/pages/{{DISPLAY_NAME}}Page.ts` (if exists)
- Helpers: `client/e2e/helpers/{{FUNCTION_NAME}}.ts` (if exists)

## Feature categories (from the spec)

The spec defines these categories. When debugging, identify which category the issue belongs to:

{{FEATURE_CATEGORIES}}

## Key data-testids

When debugging UI issues, these are the critical data-testids to look for:

{{KEY_DATA_TESTIDS}}

If the issue involves a UI element without a data-testid, **add one** — instrument the code before testing. See `feedback_learn_from_mistakes.md`.

## Key E2E tests

These are the most important E2E tests for this module:

{{KEY_E2E_TESTS}}

### Running tests

```bash
cd client
# Run all tests for this module
npx playwright test {{FUNCTION_NAME}} --project=chromium

# Run a single test in headed mode for visual debugging
npx playwright test {{FUNCTION_NAME}} -g "specific test name" --headed

# Run with workers=1 if there are parallelism issues
npx playwright test {{FUNCTION_NAME}} --project=chromium --workers=1
```

## Debug workflow

### Step 1: Reproduce
Get a clear reproduction:
- What the user did
- What they expected (cross-reference with the spec)
- What actually happened
- Browser console errors (Network tab, Console tab)
- Backend logs (`tracing` output of the relevant service)

### Step 2: Classify the bug

1. **Is this a known behavior in the spec?**
   - Yes → it's a regression or broken implementation
   - No → it's either an undocumented edge case OR the spec needs updating

2. **Where is the breakage?**
   - **UI/UX**: component, data-testid, stale state, missing handler
   - **Logic**: hook, store, API request/response handling
   - **Backend**: handler, DB query, migration, event bus
   - **Integration**: cross-module call, auth, permissions

### Step 3: Narrow down with tests

Write the smallest failing E2E test that reproduces the bug. This gives:
- A permanent regression test
- A precise assertion the bug can be debugged against
- A before/after comparison for verifying the fix

### Step 4: Read the code (not just error messages)

Read the actual code path:
- Frontend: from the data-testid clicked to the API call made
- Backend: from the handler signature to the DB query
- Event bus: what events are emitted/consumed

### Step 5: Fix + regression test + update spec

1. **Fix** the code
2. **Ensure the E2E test passes** after the fix
3. **Add a regression test** if not already present
4. **If the spec was ambiguous/wrong**, update it (invoke `product-spec-manager` workflow B)
5. **Add the root cause to this skill's "Common bug patterns"** (below) so future debugs don't repeat the same investigation

## Common bug patterns

Known pitfalls specific to `{{DISPLAY_NAME}}`:

{{COMMON_BUG_PATTERNS}}

*(This section grows over time as bugs are found and fixed. Always add new patterns here after a bug resolution.)*

## Dependencies check (license compliance)

This module uses the following third-party dependencies. Verify none introduce forbidden licenses (see `memory/feedback_license_policy.md`):

{{DEPENDENCIES_LIST}}

Run before committing any dependency change:
```bash
just deny-licenses
cd client && npm run license-check:strict
```

## Cross-module interactions

This module interacts with:

{{CROSS_MODULE_INTERACTIONS}}

When debugging, consider whether the issue is in `{{FUNCTION_NAME}}` itself or in one of its dependencies.

## Spec coverage checklist

Use this checklist to verify that an implementation matches the spec:

- [ ] All feature categories listed in the spec have at least one implementation
- [ ] All "Assertions E2E clés" at the bottom of the spec have a corresponding E2E test
- [ ] All data-testids mentioned in the spec are present in the source code
- [ ] All recommended dependencies are actually used (or an equivalent with a permissive license)
- [ ] "Principes directeurs" are respected (check UX/perf/accessibility)
- [ ] No forbidden (GPL/AGPL/BSL) dependency is used

## How to update this skill

When a new feature is added to `{{DISPLAY_NAME}}`:
1. Update the spec at `{{SPEC_PATH}}` via `product-spec-manager` workflow B
2. Update this skill's `{{FEATURE_CATEGORIES}}`, `{{KEY_DATA_TESTIDS}}`, `{{KEY_E2E_TESTS}}` sections accordingly
3. If the feature introduces a new bug-prone area, pre-populate the "Common bug patterns" section

When a bug is fixed in `{{DISPLAY_NAME}}`:
1. Add the pattern to "Common bug patterns" below
2. Include: symptoms, root cause, diagnostic, fix
3. This turns each incident into durable knowledge for future sessions
