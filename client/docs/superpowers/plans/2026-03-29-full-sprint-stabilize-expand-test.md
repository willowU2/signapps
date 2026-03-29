# Full Sprint: Stabilize, Expand, Test — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize 800+ dark theme issues via design token migration, add missing features, and expand E2E test coverage from 39 to 55+ specs.

**Architecture:** Bulk find-and-replace of hardcoded Tailwind colors (`bg-white`, `text-gray-900`, `border-gray-200`, etc.) with shadcn semantic tokens (`bg-card`, `text-foreground`, `border-border`). These tokens auto-switch between light/dark via CSS custom properties defined in `globals.css`. E2E tests use Playwright with authenticated fixtures.

**Tech Stack:** Next.js 16, Tailwind CSS 4, shadcn/ui design tokens, Playwright E2E

---

## File Structure

### Phase 1 — Dark Theme Token Migration
- **Modify:** ~150 files across `src/components/` and `src/app/` (bulk replacements)
- **No new files** — only modifying className strings

### Phase 2 — Missing Features
- **Modify:** `src/app/(app)/cal/page.tsx` (routing alias)
- **Create:** `src/app/cal/page.tsx` (redirect to `/(app)/cal`)

### Phase 3 — E2E Test Fixes & Expansion
- **Modify:** `e2e/platform-smoke.spec.ts` (replace waitForTimeout, add pages)
- **Modify:** `e2e/office-collaboration.spec.ts` (fix always-pass assertions)
- **Modify:** `e2e/docs.spec.ts` (fix silent .catch)
- **Modify:** `e2e/sheets.spec.ts` (fix silent .catch)
- **Create:** `e2e/extended-smoke.spec.ts` (50+ uncovered pages)
- **Create:** `e2e/dark-theme.spec.ts` (dark mode visual validation)

---

## Phase 1: Dark Theme Token Migration

### Task 1: Bulk replace `bg-white` → `bg-card` in components

Token mapping: `bg-white` maps to shadcn `bg-card` (light: `#ffffff`, dark: `#1a2133`).

**Files:** All `.tsx` files in `src/components/` containing `bg-white` without an existing `dark:` variant.

- [ ] **Step 1: Run bulk replacement script**

```bash
cd /c/Prog/signapps-platform/client
# Find and replace bg-white that is NOT part of bg-white/XX (opacity), NOT already followed by dark:
# Target: standalone bg-white in className strings in components
find src/components -name "*.tsx" -exec grep -l "bg-white" {} \; | while read f; do
  sed -i 's/bg-white\b/bg-card/g' "$f"
done
```

Important exceptions to manually revert after:
- Toggle switch knobs (`bg-white` is intentional for the circle dot)
- `bg-white/XX` opacity variants (e.g. `bg-white/20`) — the regex `\b` should skip these

- [ ] **Step 2: Run the same for `src/app/` pages**

```bash
find src/app -name "*.tsx" -exec grep -l "bg-white" {} \; | while read f; do
  sed -i 's/bg-white\b/bg-card/g' "$f"
done
```

- [ ] **Step 3: Manually fix toggle knobs**

Files to check: `src/app/admin/feature-flags/page.tsx`, `src/app/notifications/preferences/page.tsx`
These use `bg-white` for the toggle circle — replace with `bg-white dark:bg-zinc-200` or keep `bg-white` (always white knob on colored track is acceptable).

```tsx
// feature-flags — toggle knob should stay white
// Revert: bg-card → bg-white for toggle knobs only
```

- [ ] **Step 4: Verify build compiles**

```bash
cd /c/Prog/signapps-platform/client
npx next build 2>&1 | tail -5
```

Expected: Build succeeds without errors.

- [ ] **Step 5: Commit**

```bash
git add src/components src/app
git commit -m "fix: replace bg-white with bg-card token for dark theme (150+ files)"
```

---

### Task 2: Bulk replace `text-gray-900` → `text-foreground`

Token mapping: `text-gray-900` maps to `text-foreground` (light: `#1a1a2e`, dark: `#e2e8f0`).

- [ ] **Step 1: Run bulk replacement**

```bash
cd /c/Prog/signapps-platform/client
find src/components -name "*.tsx" -exec grep -l "text-gray-900" {} \; | while read f; do
  sed -i 's/text-gray-900/text-foreground/g' "$f"
done
find src/app -name "*.tsx" -exec grep -l "text-gray-900" {} \; | while read f; do
  sed -i 's/text-gray-900/text-foreground/g' "$f"
done
```

- [ ] **Step 2: Also replace `text-slate-900` → `text-foreground`**

```bash
find src -name "*.tsx" -exec grep -l "text-slate-900" {} \; | while read f; do
  sed -i 's/text-slate-900/text-foreground/g' "$f"
done
```

- [ ] **Step 3: Verify build**

```bash
npx next build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add src/
git commit -m "fix: replace text-gray-900/text-slate-900 with text-foreground token (70+ files)"
```

---

### Task 3: Bulk replace `bg-gray-50` → `bg-muted` and `bg-gray-100` → `bg-muted`

Token mapping: `bg-gray-50`/`bg-gray-100` map to `bg-muted` (light: `#f1f3f4`, dark: `#1e293b`).

- [ ] **Step 1: Run bulk replacement**

```bash
cd /c/Prog/signapps-platform/client
find src -name "*.tsx" -exec grep -l "bg-gray-50" {} \; | while read f; do
  sed -i 's/bg-gray-50/bg-muted/g' "$f"
done
find src -name "*.tsx" -exec grep -l "bg-gray-100" {} \; | while read f; do
  sed -i 's/bg-gray-100/bg-muted/g' "$f"
done
```

- [ ] **Step 2: Verify build**

```bash
npx next build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add src/
git commit -m "fix: replace bg-gray-50/bg-gray-100 with bg-muted token (100+ files)"
```

---

### Task 4: Bulk replace `border-gray-200` → `border-border`

Token mapping: `border-gray-200` maps to `border-border` (light: `#e0e0e0`, dark: `rgba(255,255,255,0.12)`).

- [ ] **Step 1: Run bulk replacement**

```bash
cd /c/Prog/signapps-platform/client
find src -name "*.tsx" -exec grep -l "border-gray-200" {} \; | while read f; do
  sed -i 's/border-gray-200/border-border/g' "$f"
done
```

- [ ] **Step 2: Also handle `border-gray-300` → `border-border`**

```bash
find src -name "*.tsx" -exec grep -l "border-gray-300" {} \; | while read f; do
  sed -i 's/border-gray-300/border-border/g' "$f"
done
```

- [ ] **Step 3: Verify build**

```bash
npx next build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add src/
git commit -m "fix: replace border-gray-200/300 with border-border token (40+ files)"
```

---

### Task 5: Fix remaining hardcoded color patterns

Catch-all for patterns not covered above.

- [ ] **Step 1: Replace secondary text colors**

```bash
cd /c/Prog/signapps-platform/client
# text-gray-500/600/700 → text-muted-foreground
for color in "text-gray-500" "text-gray-600" "text-gray-700"; do
  find src -name "*.tsx" -exec grep -l "$color" {} \; 2>/dev/null | while read f; do
    sed -i "s/$color/text-muted-foreground/g" "$f"
  done
done
```

- [ ] **Step 2: Replace `text-black` → `text-foreground`**

```bash
find src -name "*.tsx" -exec grep -l "text-black" {} \; | while read f; do
  sed -i 's/text-black/text-foreground/g' "$f"
done
```

- [ ] **Step 3: Verify build**

```bash
npx next build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add src/
git commit -m "fix: replace remaining hardcoded text colors with semantic tokens"
```

---

### Task 6: Full dark theme verification

- [ ] **Step 1: Count remaining hardcoded colors**

```bash
echo "=== Remaining hardcoded colors ==="
echo -n "bg-white: "; grep -r "bg-white" src/ --include="*.tsx" | grep -v "bg-white/" | wc -l
echo -n "text-gray-900: "; grep -r "text-gray-900" src/ --include="*.tsx" | wc -l
echo -n "text-slate-900: "; grep -r "text-slate-900" src/ --include="*.tsx" | wc -l
echo -n "border-gray-200: "; grep -r "border-gray-200" src/ --include="*.tsx" | wc -l
echo -n "bg-gray-50: "; grep -r "bg-gray-50" src/ --include="*.tsx" | wc -l
echo -n "bg-gray-100: "; grep -r "bg-gray-100" src/ --include="*.tsx" | wc -l
```

Expected: All counts should be 0 (or near-0 for intentional exceptions like toggle knobs).

- [ ] **Step 2: Fix any remaining instances manually**

Review and fix each remaining instance case-by-case.

- [ ] **Step 3: Commit final cleanup**

```bash
git add src/
git commit -m "fix: dark theme token migration complete — 0 remaining hardcoded colors"
```

---

## Phase 2: Missing Features

### Task 7: Fix `/cal` route mismatch

The sidebar links to `/cal` but the page exists at `/(app)/cal/page.tsx`. Create a redirect.

- [ ] **Step 1: Create redirect page**

Create `src/app/cal/page.tsx`:

```tsx
import { redirect } from 'next/navigation';

export default function CalRedirect() {
  redirect('/(app)/cal');
}
```

Note: If Next.js App Router already resolves `/(app)/cal` at `/cal` (the `(app)` group is transparent), this step may be unnecessary. Verify first:

```bash
# Check if /cal already works by looking at the route group
ls src/app/\(app\)/cal/
```

If the `(app)` group is transparent (standard Next.js behavior), `/cal` already works and no redirect is needed. Skip this step if so.

- [ ] **Step 2: Verify**

```bash
npx next build 2>&1 | tail -5
```

- [ ] **Step 3: Commit if changes were made**

```bash
git add src/app/cal/ 2>/dev/null
git diff --cached --quiet || git commit -m "fix: add /cal route redirect to /(app)/cal"
```

---

## Phase 3: E2E Test Fixes & Expansion

### Task 8: Fix always-pass assertions in existing tests

**File:** `e2e/office-collaboration.spec.ts` — has `expect(true).toBeTruthy()` placeholders.

- [ ] **Step 1: Read the file and identify all always-pass assertions**

```bash
grep -n "expect(true)" e2e/office-collaboration.spec.ts
```

- [ ] **Step 2: Replace with real assertions**

For each `expect(true).toBeTruthy()`, replace with an assertion that checks actual page state. Example pattern:

```typescript
// Before (always passes):
expect(true).toBeTruthy();

// After (validates real content):
const content = await page.textContent('body');
expect(content?.length).toBeGreaterThan(100);
```

- [ ] **Step 3: Fix same pattern in docs.spec.ts**

```bash
grep -n "expect(true)" e2e/docs.spec.ts
```

Replace each instance with meaningful assertion.

- [ ] **Step 4: Fix sheets.spec.ts always-pass**

```bash
grep -n "|| true" e2e/sheets.spec.ts
```

Replace `expect(hasGrid || true)` with `expect(hasGrid).toBeTruthy()`.

- [ ] **Step 5: Run fixed tests**

```bash
npx playwright test e2e/office-collaboration.spec.ts e2e/docs.spec.ts e2e/sheets.spec.ts --reporter=list 2>&1 | tail -20
```

- [ ] **Step 6: Commit**

```bash
git add e2e/
git commit -m "fix: replace always-pass assertions with real validations in E2E tests"
```

---

### Task 9: Fix fragile waitForTimeout in platform-smoke

**File:** `e2e/platform-smoke.spec.ts` — uses `waitForTimeout(2000)` instead of proper waits.

- [ ] **Step 1: Replace waitForTimeout with waitForLoadState**

In `platform-smoke.spec.ts`, for each page test, replace:

```typescript
// Before:
await page.goto(`${BASE}${p.path}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);

// After:
await page.goto(p.path, { waitUntil: 'domcontentloaded' });
await page.waitForLoadState('networkidle').catch(() => {});
```

Note: Remove `BASE` prefix — Playwright config already sets `baseURL`.

- [ ] **Step 2: Replace dialog dismissal pattern with reusable helper**

At top of file, add:

```typescript
async function dismissDialogs(page: Page) {
  await page.keyboard.press('Escape');
  const skipBtn = page.locator('button:has-text("Passer")');
  if (await skipBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await skipBtn.click();
  }
}
```

Replace all 3 duplicate dialog dismissal blocks with `await dismissDialogs(page)`.

- [ ] **Step 3: Run tests**

```bash
npx playwright test e2e/platform-smoke.spec.ts --reporter=list 2>&1 | tail -20
```

- [ ] **Step 4: Commit**

```bash
git add e2e/platform-smoke.spec.ts
git commit -m "fix: replace waitForTimeout with proper waits in platform-smoke"
```

---

### Task 10: Fix silent .catch patterns in docs and sheets tests

- [ ] **Step 1: Fix docs.spec.ts**

Replace:
```typescript
await page.waitForSelector('.tiptap, .ProseMirror, [contenteditable="true"]', { timeout: 10000 }).catch(() => {});
```
With:
```typescript
await page.waitForSelector('.tiptap, .ProseMirror, [contenteditable="true"]', { timeout: 10000 });
```

If the selector genuinely may not exist, use a conditional instead:
```typescript
const editor = page.locator('.tiptap, .ProseMirror, [contenteditable="true"]');
const editorVisible = await editor.isVisible({ timeout: 10000 }).catch(() => false);
// Then branch on editorVisible
```

- [ ] **Step 2: Fix sheets.spec.ts**

Same pattern — replace `.catch(() => {})` with proper conditional checks.

- [ ] **Step 3: Run tests**

```bash
npx playwright test e2e/docs.spec.ts e2e/sheets.spec.ts --reporter=list 2>&1 | tail -20
```

- [ ] **Step 4: Commit**

```bash
git add e2e/docs.spec.ts e2e/sheets.spec.ts
git commit -m "fix: remove silent .catch in docs/sheets E2E tests, add proper conditionals"
```

---

### Task 11: Create extended smoke tests for uncovered pages

**Create:** `e2e/extended-smoke.spec.ts` covering the ~50 pages not in `platform-smoke.spec.ts`.

- [ ] **Step 1: Create the test file**

```typescript
import { test, expect } from './fixtures';

/**
 * Extended Smoke Tests — Pages not covered by platform-smoke.spec.ts
 */

const PAGES = [
  // Accounting & Finance
  { path: '/accounting', expect: 'Compta', group: 'finance' },
  { path: '/billing', expect: 'Factur', group: 'finance' },

  // CRM & Contacts
  { path: '/crm', expect: 'CRM', group: 'crm' },
  { path: '/contacts', expect: 'Contact', group: 'crm' },

  // Supply Chain
  { path: '/supply-chain/inventory', expect: 'Inventaire', group: 'supply-chain' },
  { path: '/supply-chain/purchase-orders', expect: 'Commande', group: 'supply-chain' },
  { path: '/supply-chain/stock-alerts', expect: 'Stock', group: 'supply-chain' },
  { path: '/supply-chain/delivery-tracking', expect: 'Livraison', group: 'supply-chain' },
  { path: '/supply-chain/receiving-shipping', expect: 'Réception', group: 'supply-chain' },
  { path: '/supply-chain/product-catalog', expect: 'Produit', group: 'supply-chain' },
  { path: '/supply-chain/supplier-portal', expect: 'Fournisseur', group: 'supply-chain' },
  { path: '/supply-chain/warehouse-map', expect: 'Entrepôt', group: 'supply-chain' },

  // LMS
  { path: '/lms/catalog', expect: 'Formation', group: 'lms' },
  { path: '/lms/certificates', expect: 'Certificat', group: 'lms' },
  { path: '/lms/learning-paths', expect: 'Parcours', group: 'lms' },
  { path: '/lms/progress', expect: 'Progression', group: 'lms' },
  { path: '/lms/quiz-builder', expect: 'Quiz', group: 'lms' },
  { path: '/lms/discussions', expect: 'Discussion', group: 'lms' },

  // Communications
  { path: '/comms/announcements', expect: 'Annonce', group: 'comms' },
  { path: '/comms/digital-signage', expect: 'Affichage', group: 'comms' },
  { path: '/comms/polls', expect: 'Sondage', group: 'comms' },
  { path: '/comms/suggestions', expect: 'Suggestion', group: 'comms' },

  // Collaboration & Projects
  { path: '/collaboration', expect: 'Collaboration', group: 'collab' },
  { path: '/projects', expect: 'Projet', group: 'collab' },

  // Admin
  { path: '/admin/audit', expect: 'Audit', group: 'admin' },
  { path: '/admin/backup', expect: 'Sauvegarde', group: 'admin' },
  { path: '/admin/groups', expect: 'Groupe', group: 'admin' },
  { path: '/admin/roles', expect: 'Rôle', group: 'admin' },
  { path: '/admin/ldap', expect: 'LDAP', group: 'admin' },
  { path: '/admin/email-templates', expect: 'Template', group: 'admin' },
  { path: '/admin/logs', expect: 'Log', group: 'admin' },
  { path: '/admin/webhooks', expect: 'Webhook', group: 'admin' },
  { path: '/admin/api-docs', expect: 'API', group: 'admin' },
  { path: '/admin/api-platform', expect: 'API', group: 'admin' },
  { path: '/admin/gdpr', expect: 'RGPD', group: 'admin' },
  { path: '/admin/i18n', expect: 'Langue', group: 'admin' },
  { path: '/admin/import-export', expect: 'Import', group: 'admin' },
  { path: '/admin/container-resources', expect: 'Ressource', group: 'admin' },
  { path: '/admin/feature-flags', expect: 'Feature', group: 'admin' },
  { path: '/admin/developer-tools', expect: 'Développeur', group: 'admin' },

  // Settings
  { path: '/settings/appearance', expect: 'Thème', group: 'settings' },
  { path: '/settings/profile', expect: 'Profil', group: 'settings' },
  { path: '/settings/security', expect: 'Sécurité', group: 'settings' },
  { path: '/settings/notifications', expect: 'Notification', group: 'settings' },
  { path: '/settings/data-export', expect: 'Export', group: 'settings' },

  // Misc
  { path: '/analytics', expect: 'Analyse', group: 'misc' },
  { path: '/bookmarks', expect: 'Favoris', group: 'misc' },
  { path: '/compliance', expect: 'Conformité', group: 'misc' },
  { path: '/data-management', expect: 'Données', group: 'misc' },
  { path: '/gamification', expect: 'Gamification', group: 'misc' },
  { path: '/integrations', expect: 'Intégration', group: 'misc' },
  { path: '/reports', expect: 'Rapport', group: 'misc' },
  { path: '/search', expect: 'Recherche', group: 'misc' },
  { path: '/slides', expect: 'Présentation', group: 'misc' },
  { path: '/trash', expect: 'Corbeille', group: 'misc' },
  { path: '/voice', expect: 'Voix', group: 'misc' },
  { path: '/print', expect: 'Imprimer', group: 'misc' },
  { path: '/team/org-chart', expect: 'Organigramme', group: 'misc' },
  { path: '/drive', expect: 'Drive', group: 'misc' },
  { path: '/it-assets/scan', expect: 'Asset', group: 'misc' },
  { path: '/workforce/hr', expect: 'RH', group: 'misc' },
];

test.describe('Extended Smoke Tests — Uncovered Pages', () => {
  for (const p of PAGES) {
    test(`[${p.group}] ${p.path} loads without crash`, async ({ page }) => {
      test.setTimeout(30_000);

      await page.goto(p.path, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => {});

      // Page rendered meaningful content
      const content = await page.textContent('body');
      expect(content?.length, `${p.path} should render >50 chars`).toBeGreaterThan(50);

      // No error boundary
      const error = page.locator('.error-boundary, [data-nextjs-error]');
      await expect(error).not.toBeVisible();
    });
  }
});
```

- [ ] **Step 2: Run tests**

```bash
npx playwright test e2e/extended-smoke.spec.ts --reporter=list 2>&1 | tail -30
```

- [ ] **Step 3: Fix any failing tests** (pages that load with different text)

Adjust the `expect` field for pages that use different French labels.

- [ ] **Step 4: Commit**

```bash
git add e2e/extended-smoke.spec.ts
git commit -m "test: add extended smoke tests for 55+ uncovered pages"
```

---

### Task 12: Create dark theme validation test

**Create:** `e2e/dark-theme.spec.ts` — validates that key pages render correctly in dark mode.

- [ ] **Step 1: Create the test file**

```typescript
import { test, expect } from './fixtures';

/**
 * Dark Theme E2E Tests
 * Validates that pages render without white-background artifacts in dark mode.
 */

const DARK_TEST_PAGES = [
  '/dashboard',
  '/docs',
  '/mail',
  '/contacts',
  '/admin/settings',
  '/accounting',
  '/workforce',
  '/ai/studio',
];

test.describe('Dark Theme Rendering', () => {
  test.beforeEach(async ({ page }) => {
    // Enable dark mode via localStorage before navigation
    await page.addInitScript(() => {
      localStorage.setItem('theme', 'dark');
      document.documentElement.classList.add('dark');
    });
  });

  for (const path of DARK_TEST_PAGES) {
    test(`${path} renders in dark mode without white artifacts`, async ({ page }) => {
      test.setTimeout(30_000);

      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => {});

      // Verify dark class is applied
      const isDark = await page.evaluate(() =>
        document.documentElement.classList.contains('dark')
      );
      expect(isDark).toBe(true);

      // Check that no large elements have hardcoded white backgrounds
      const whiteElements = await page.evaluate(() => {
        const elements = document.querySelectorAll('main *, [role="main"] *');
        let count = 0;
        elements.forEach(el => {
          const bg = getComputedStyle(el).backgroundColor;
          const rect = el.getBoundingClientRect();
          // Only flag visible elements > 100px wide with pure white bg
          if (bg === 'rgb(255, 255, 255)' && rect.width > 100 && rect.height > 50) {
            count++;
          }
        });
        return count;
      });

      expect(
        whiteElements,
        `${path}: found ${whiteElements} element(s) with hardcoded white background in dark mode`
      ).toBeLessThanOrEqual(2); // Allow small tolerance for intentional elements
    });
  }
});
```

- [ ] **Step 2: Run tests**

```bash
npx playwright test e2e/dark-theme.spec.ts --reporter=list 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add e2e/dark-theme.spec.ts
git commit -m "test: add dark theme validation E2E tests for 8 key pages"
```

---

### Task 13: Final verification and summary commit

- [ ] **Step 1: Run full E2E suite**

```bash
npx playwright test --reporter=list 2>&1 | tail -30
```

- [ ] **Step 2: Count remaining issues**

```bash
echo "=== Dark theme status ==="
grep -r "bg-white\b" src/ --include="*.tsx" | grep -v "bg-white/" | wc -l
grep -r "text-gray-900" src/ --include="*.tsx" | wc -l
echo "=== E2E status ==="
echo -n "Always-pass: "; grep -r "expect(true)" e2e/ --include="*.ts" | wc -l
echo -n "Silent catch: "; grep -r ".catch(() => {})" e2e/ --include="*.ts" | wc -l
```

- [ ] **Step 3: Address any remaining items**

Fix outstanding issues found in steps 1-2.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: full sprint complete — dark theme, features, E2E tests"
```
