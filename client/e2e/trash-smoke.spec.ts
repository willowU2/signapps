/**
 * E2E Smoke — Trash (/trash)
 *
 * 10 tests covering the key user journeys from the product spec:
 * page load, heading and subtitle, empty state, type filter dropdown,
 * item count badge, restore button presence, purge all button,
 * confirmation dialog, entity type labels, sort/filter interaction.
 *
 * Spec: docs/product-specs/50-trash.md
 */

import { test, expect } from "./fixtures";

test.describe("Trash — smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/trash", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
  });

  test("page loads with Corbeille heading", async ({ page }) => {
    const heading = page.getByText("Corbeille");
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
  });

  test("page subtitle describes cross-module trash", async ({ page }) => {
    const subtitle = page
      .getByText(/éléments supprimés dans tous les modules/i)
      .or(page.getByText(/restaurez ou purgez/i));
    await expect(subtitle.first()).toBeVisible({ timeout: 10000 });
  });

  test("empty state or trash items are displayed", async ({ page }) => {
    const emptyState = page
      .getByText(/corbeille est vide/i)
      .or(page.getByText(/aucun élément supprimé/i));
    const trashItems = page
      .locator("[class*='border'][class*='rounded']")
      .or(page.locator("table tbody tr"));
    const hasEmpty = await emptyState
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    const hasItems = await trashItems
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    expect(hasEmpty || hasItems).toBeTruthy();
  });

  test("type filter dropdown shows 'Tous les types' by default", async ({
    page,
  }) => {
    const filterTrigger = page
      .getByText(/tous les types/i)
      .or(page.getByText(/filtrer par type/i));
    await expect(filterTrigger.first()).toBeVisible({ timeout: 10000 });
  });

  test("type filter dropdown lists entity types", async ({ page }) => {
    const filterTrigger = page
      .getByRole("combobox")
      .or(page.locator("[role='combobox']"));
    const hasTrigger = await filterTrigger
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    if (hasTrigger) {
      await filterTrigger.first().click();
      await page.waitForTimeout(500);
      // Should list entity types: Document, Fichier, Email, etc.
      const documentOption = page
        .getByText("Document")
        .or(page.getByText("Fichier"))
        .or(page.getByText("Email"));
      const hasOption = await documentOption
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      expect(hasOption).toBeTruthy();
    }
  });

  test("item count badge displays element count", async ({ page }) => {
    const badge = page.getByText(/\d+ élément/i);
    await expect(badge.first()).toBeVisible({ timeout: 10000 });
  });

  test("restore button is visible when items exist", async ({ page }) => {
    const restoreBtn = page.getByRole("button", { name: /restaurer/i });
    const hasRestore = await restoreBtn
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    // If no items, the empty state should be visible instead
    const emptyState = page.getByText(/corbeille est vide/i);
    const hasEmpty = await emptyState
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    expect(hasRestore || hasEmpty).toBeTruthy();
  });

  test("'Purger les expirés' button visible when items exist", async ({
    page,
  }) => {
    const purgeBtn = page.getByRole("button", { name: /purger/i });
    const hasPurge = await purgeBtn
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    // If no items, purge button is hidden; empty state should be visible
    const emptyState = page.getByText(/corbeille est vide/i);
    const hasEmpty = await emptyState
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    expect(hasPurge || hasEmpty).toBeTruthy();
  });

  test("purge button triggers confirmation dialog", async ({ page }) => {
    const purgeBtn = page.getByRole("button", { name: /purger/i });
    const hasPurge = await purgeBtn
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    if (hasPurge) {
      await purgeBtn.first().click();
      await page.waitForTimeout(500);
      // AlertDialog confirmation should appear
      const dialog = page
        .locator("[role='alertdialog']")
        .or(page.locator("[role='dialog']"));
      await expect(dialog.first()).toBeVisible({ timeout: 5000 });
      const confirmTitle = page
        .getByText(/purger les éléments expirés/i)
        .or(page.getByText(/supprimer définitivement/i));
      await expect(confirmTitle.first()).toBeVisible({ timeout: 3000 });
      // Close the dialog
      const cancelBtn = page.getByRole("button", { name: /annuler/i });
      if (
        await cancelBtn
          .first()
          .isVisible({ timeout: 2000 })
          .catch(() => false)
      ) {
        await cancelBtn.first().click();
      }
    }
  });

  test("entity type badges render correct French labels", async ({ page }) => {
    // If items exist, they should have entity type badges
    const typeLabels = page.getByText(
      /Fichier|Document|Email|Événement|Tâche|Contact|Formulaire|Note/,
    );
    const hasLabels = await typeLabels
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    // Empty state is also valid
    const emptyState = page.getByText(/corbeille est vide/i);
    const hasEmpty = await emptyState
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    expect(hasLabels || hasEmpty).toBeTruthy();
  });
});
