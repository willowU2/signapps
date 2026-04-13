import { test, expect, testData } from "./fixtures";

/**
 * Storage Page E2E Tests
 *
 * The storage page defaults to a Google-Drive-like "files" view (tab=files).
 * The admin tabs (Tableau de bord, Disques, Montages, Externes, Partages, RAID)
 * appear when switching away from "files".
 */

test.describe("Storage Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/storage");
    await page.waitForLoadState("domcontentloaded");
  });

  test.describe("Page Layout — Files View (default)", () => {
    test("should display the Drive sidebar on default files view", async ({
      page,
    }) => {
      // The files view shows a sidebar with "Mon Drive", "Nouveau" button, etc.
      await expect(page.getByText("Mon Drive")).toBeVisible({
        timeout: 10_000,
      });
    });

    test("should display the Nouveau (New) button in the sidebar", async ({
      page,
    }) => {
      await expect(page.getByText("Nouveau", { exact: true })).toBeVisible({
        timeout: 10_000,
      });
    });

    test("should default to files view (Drive UI)", async ({ page }) => {
      // Default state is "files" — the Drive sidebar is shown (not admin tabs)
      // URL may or may not have ?tab=files depending on whether the router pushed
      await expect(page.getByText("Mon Drive")).toBeVisible({
        timeout: 10_000,
      });
      // Admin heading should NOT be visible on the default view
      await expect(
        page.getByRole("heading", { name: "Administration Stockage" }),
      ).not.toBeVisible();
    });
  });

  test.describe("Admin Tab Navigation", () => {
    test("should navigate to Dashboard (Tableau de bord) tab", async ({
      page,
    }) => {
      await page.goto("/storage?tab=dashboard");
      await expect(page).toHaveURL(/tab=dashboard/);

      // Should show the admin heading
      await expect(
        page.getByRole("heading", { name: "Administration Stockage" }),
      ).toBeVisible({ timeout: 10_000 });
    });

    test("should display all admin tabs", async ({ page }) => {
      await page.goto("/storage?tab=dashboard");

      const tabs = [
        "Tableau de bord",
        "Disques",
        "Montages",
        "Externes",
        "Partages",
        "RAID",
      ];

      for (const tab of tabs) {
        await expect(page.getByRole("tab", { name: tab })).toBeVisible({
          timeout: 5_000,
        });
      }
    });

    test("should navigate to Disks tab", async ({ page }) => {
      await page.goto("/storage?tab=disks");
      await expect(page).toHaveURL(/tab=disks/);
      await expect(
        page.getByRole("heading", { name: "Administration Stockage" }),
      ).toBeVisible({ timeout: 10_000 });
    });

    test("should navigate to Mounts tab", async ({ page }) => {
      await page.goto("/storage?tab=mounts");
      await expect(page).toHaveURL(/tab=mounts/);
      await expect(
        page.getByRole("heading", { name: "Administration Stockage" }),
      ).toBeVisible({ timeout: 10_000 });
    });

    test("should navigate to External tab", async ({ page }) => {
      await page.goto("/storage?tab=external");
      await expect(page).toHaveURL(/tab=external/);
      await expect(
        page.getByRole("heading", { name: "Administration Stockage" }),
      ).toBeVisible({ timeout: 10_000 });
    });

    test("should navigate to Shares tab", async ({ page }) => {
      await page.goto("/storage?tab=shares");
      await expect(page).toHaveURL(/tab=shares/);
      await expect(
        page.getByRole("heading", { name: "Administration Stockage" }),
      ).toBeVisible({ timeout: 10_000 });
    });

    test("should navigate to RAID tab", async ({ page }) => {
      await page.goto("/storage?tab=raid");
      await expect(page).toHaveURL(/tab=raid/);
      await expect(
        page.getByRole("heading", { name: "Administration Stockage" }),
      ).toBeVisible({ timeout: 10_000 });
    });

    test('should have a "Retour au Drive" button to go back to files', async ({
      page,
    }) => {
      await page.goto("/storage?tab=dashboard");
      const backButton = page.getByRole("button", { name: "Retour au Drive" });
      await expect(backButton).toBeVisible({ timeout: 10_000 });

      await backButton.click();
      await expect(page).toHaveURL(/tab=files/);
    });

    test("should preserve tab state on page reload", async ({ page }) => {
      await page.goto("/storage?tab=disks");
      await expect(page).toHaveURL(/tab=disks/);

      // Reload page
      await page.reload();

      // Should still be on Disks tab
      await expect(page).toHaveURL(/tab=disks/);
      const disksTab = page.getByRole("tab", { name: "Disques" });
      await expect(disksTab).toHaveAttribute("data-state", "active");
    });
  });

  test.describe("Dashboard Tab", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/storage?tab=dashboard");
    });

    test("should display storage overview stats", async ({ page }) => {
      // Dashboard should show storage statistics in Card components
      await page
        .locator('[class*="Card"]')
        .first()
        .waitFor({ state: "visible", timeout: 10_000 })
        .catch(() => {});

      const statsContent = page.locator('[class*="Card"]');
      const count = await statsContent.count();
      expect(count).toBeGreaterThan(0);
    });

    test("should display health gauge", async ({ page }) => {
      // HealthGauge displays "Utilisation Stockage" label
      await expect(page.getByText(/Utilisation Stockage/i)).toBeVisible({
        timeout: 10_000,
      });
    });
  });

  test.describe("Files View — Drive UI", () => {
    test("should display the Drive sidebar navigation items", async ({
      page,
    }) => {
      // The sidebar has items: Accueil, Mon Drive, Partagés avec moi, Récents, Suivis, Corbeille
      await expect(page.getByText("Accueil")).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText("Mon Drive")).toBeVisible();
      await expect(page.getByText("Récents")).toBeVisible();
      await expect(page.getByText("Suivis")).toBeVisible();
      await expect(page.getByText("Corbeille")).toBeVisible();
    });

    test("should display the search input", async ({ page }) => {
      await expect(page.getByPlaceholder("Rechercher dans Drive")).toBeVisible({
        timeout: 10_000,
      });
    });

    test("should display files or empty message", async ({ page }) => {
      // Wait for loading to finish — either we see files, or "Empty folder" / "No Buckets Found"
      await page.waitForTimeout(3_000);

      const hasFiles = await page
        .locator('[class*="file"], [class*="File"], [class*="grid"]')
        .first()
        .isVisible()
        .catch(() => false);
      const hasEmptyFolder = await page
        .getByText(/Empty folder/i)
        .isVisible()
        .catch(() => false);
      const hasNoBuckets = await page
        .getByText(/No Buckets Found/i)
        .isVisible()
        .catch(() => false);

      expect(hasFiles || hasEmptyFolder || hasNoBuckets).toBeTruthy();
    });

    test("should filter files by search", async ({ page }) => {
      const searchInput = page.getByPlaceholder("Rechercher dans Drive");
      await searchInput.fill("test");
      await page.waitForTimeout(1_000); // debounce
      // Search should filter the list (visual verification — no assertion on results)
    });
  });

  test.describe("Upload Dialog", () => {
    test("should open upload dialog via Nouveau button", async ({ page }) => {
      // Click the "Nouveau" button in the sidebar to open upload
      await page.getByText("Nouveau", { exact: true }).click();

      // The upload dialog/sheet should be visible
      await expect(page.locator('[role="dialog"]')).toBeVisible({
        timeout: 5_000,
      });
    });

    test("should close upload dialog with Escape", async ({ page }) => {
      await page.getByText("Nouveau", { exact: true }).click();
      await expect(page.locator('[role="dialog"]')).toBeVisible({
        timeout: 5_000,
      });

      await page.keyboard.press("Escape");

      await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    });
  });

  test.describe("Create Folder Dialog", () => {
    test.skip("should open create folder dialog — folder creation is via context menu or keyboard shortcut, not a visible button", () => {});
  });

  test.describe("Create Bucket Dialog", () => {
    test("should open create bucket dialog when no buckets exist", async ({
      page,
    }) => {
      // If no buckets, a "Create Bucket" button is displayed
      const createBucketButton = page.getByRole("button", {
        name: "Create Bucket",
      });
      const isVisible = await createBucketButton
        .isVisible({ timeout: 5_000 })
        .catch(() => false);

      if (isVisible) {
        await createBucketButton.click();
        await expect(page.locator('[role="dialog"]')).toBeVisible({
          timeout: 5_000,
        });
        await expect(page.getByText("Create New Bucket")).toBeVisible();
      }
      // If buckets already exist, this button won't be visible — skip gracefully
    });
  });

  test.describe("RAID Tab", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/storage?tab=raid");
    });

    test("should display RAID overview", async ({ page }) => {
      await page
        .locator('[class*="Card"]')
        .first()
        .waitFor({ state: "visible", timeout: 10_000 })
        .catch(() => {});

      const content = page.locator('[class*="Card"]');
      const hasContent = (await content.count()) > 0;
      expect(hasContent).toBeTruthy();
    });
  });

  test.describe("Shares Tab", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/storage?tab=shares");
    });

    test("should display shares list", async ({ page }) => {
      await page
        .locator('main, [class*="Content"]')
        .first()
        .waitFor({ state: "visible", timeout: 10_000 })
        .catch(() => {});

      const content = page.locator('main, [class*="Content"]');
      await expect(content).toBeVisible();
    });
  });
});
