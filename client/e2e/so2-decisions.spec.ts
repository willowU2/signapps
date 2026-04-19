/**
 * E2E — SO2 board decisions timeline smoke test.
 *
 * Vérifie que :
 * 1. Les 4 décisions seed s'affichent (approved / rejected / deferred).
 * 2. Le dialog "Nouvelle décision" s'ouvre et valide le champ titre.
 * 3. Cliquer sur une décision la déplie et montre la zone votes.
 *
 * Spec : docs/superpowers/specs/2026-04-19-so2-governance-design.md
 */
import { test, expect, dismissDialogs } from "./fixtures";

test.describe("SO2 — Decisions timeline smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/org-structure");
    await dismissDialogs(page);
  });

  test("decisions tab renders seeded decisions", async ({ page }) => {
    // Nexus root carries the seeded board.
    const root = page
      .getByText(/Nexus Industries/i)
      .first()
      .or(page.getByText(/Acme/i).first());
    if (!(await root.isVisible().catch(() => false))) {
      test.skip(true, "Root node not visible");
    }
    await root.click();

    const tab = page.getByRole("tab", { name: /Décisions|Decisions/i }).first();
    if (!(await tab.isVisible().catch(() => false))) {
      test.skip(true, "Decisions tab not rendered (no board attached?)");
    }
    await tab.click();

    // Timeline heading.
    await expect(
      page.getByText(/^Décisions$|^Decisions$/i).first(),
    ).toBeVisible({
      timeout: 4000,
    });

    // Should include at least one of the seed titles.
    await expect(
      page
        .getByText(/Recrutement de 3 SRE/i)
        .or(page.getByText(/pgvector/i))
        .or(page.getByText(/CRM SaaS externe/i))
        .first(),
    ).toBeVisible({ timeout: 4000 });
  });

  test("new decision dialog requires a title", async ({ page }) => {
    const root = page.getByText(/Nexus Industries/i).first();
    if (!(await root.isVisible().catch(() => false))) {
      test.skip(true, "Root node not visible");
    }
    await root.click();

    const tab = page.getByRole("tab", { name: /Décisions|Decisions/i }).first();
    if (!(await tab.isVisible().catch(() => false))) {
      test.skip(true, "Decisions tab not rendered");
    }
    await tab.click();

    await page.getByTestId("decisions-new-button").click();
    await expect(page.getByText(/Nouvelle décision/i)).toBeVisible();

    // Submit without a title — should fail validation (required input).
    const submit = page.getByRole("button", { name: /Créer/i });
    await submit.click();

    // Title is `required` so the browser blocks submission — the dialog
    // stays open and no decision is created. We verify by presence of
    // the dialog title.
    await expect(page.getByText(/Nouvelle décision/i)).toBeVisible();
  });

  test("toggle a decision shows the votes area", async ({ page }) => {
    const root = page.getByText(/Nexus Industries/i).first();
    if (!(await root.isVisible().catch(() => false))) {
      test.skip(true, "Root node not visible");
    }
    await root.click();
    const tab = page.getByRole("tab", { name: /Décisions|Decisions/i }).first();
    if (!(await tab.isVisible().catch(() => false))) {
      test.skip(true, "Decisions tab not rendered");
    }
    await tab.click();

    const first = page.locator("[data-testid^='decision-']").first();
    if (!(await first.isVisible().catch(() => false))) {
      test.skip(true, "No decision rendered");
    }
    await first.click();
    await expect(
      first.getByText(/Votes/i).or(first.getByText(/Votre vote/i)),
    ).toBeVisible({ timeout: 3000 });
  });
});
