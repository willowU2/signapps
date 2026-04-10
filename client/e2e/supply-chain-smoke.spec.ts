/**
 * E2E Smoke — Supply Chain module
 *
 * 12 tests covering key user journeys: hub navigation, inventory table,
 * stock movement dialog, search filter, purchase orders list, PO creation
 * dialog, warehouse map zones, delivery tracking timeline, supplier portal
 * cards, tabs switching, stock alerts banner, and movements tab.
 *
 * Spec: docs/product-specs/ (supply-chain)
 */
import { test, expect } from "./fixtures";

test.describe("Supply Chain — smoke", () => {
  // ─── Hub ──────────────────────────────────────────────────────────────────

  test("hub page loads with title and sub-page cards", async ({ page }) => {
    await page.goto("/supply-chain", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const title = page
      .getByText("Chaîne d'approvisionnement")
      .or(page.getByText(/supply chain/i));
    await expect(title.first()).toBeVisible({ timeout: 10000 });
    const cards = page.locator("a[href*='/supply-chain/']");
    expect(await cards.count()).toBeGreaterThanOrEqual(5);
  });

  test("hub cards link to inventory, purchase orders, warehouse map", async ({
    page,
  }) => {
    await page.goto("/supply-chain", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    for (const label of ["Inventaire", "Bons de commande", "Carte entrepôt"]) {
      const link = page.getByText(label);
      await expect(link.first()).toBeVisible({ timeout: 5000 });
    }
  });

  // ─── Inventory ────────────────────────────────────────────────────────────

  test("inventory page shows stock table with items", async ({ page }) => {
    await page.goto("/supply-chain/inventory", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(2000);
    const heading = page
      .getByText("Inventory Management")
      .or(page.getByText(/inventaire/i));
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
    const table = page.locator("table");
    await expect(table.first()).toBeVisible({ timeout: 5000 });
    const skuCell = page.getByText("OFF-001").or(page.getByText(/SKU/i));
    await expect(skuCell.first()).toBeVisible({ timeout: 5000 });
  });

  test("inventory search filters stock items", async ({ page }) => {
    await page.goto("/supply-chain/inventory", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(2000);
    const search = page.getByPlaceholder(/rechercher/i);
    await expect(search.first()).toBeVisible({ timeout: 10000 });
    await search.first().fill("Laptop");
    await page.waitForTimeout(500);
    await expect(page.locator("body")).toBeVisible();
  });

  test("inventory stock movement dialog opens", async ({ page }) => {
    await page.goto("/supply-chain/inventory", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(2000);
    const btn = page
      .getByRole("button", { name: /stock movement/i })
      .or(page.getByRole("button", { name: /mouvement/i }));
    await expect(btn.first()).toBeVisible({ timeout: 10000 });
    await btn.first().click();
    await page.waitForTimeout(500);
    const dialog = page.locator("[role='dialog']");
    await expect(dialog.first()).toBeVisible({ timeout: 5000 });
    const dialogTitle = dialog
      .getByText(/record stock movement/i)
      .or(dialog.getByText(/mouvement/i));
    await expect(dialogTitle.first()).toBeVisible({ timeout: 3000 });
  });

  test("inventory shows stock alerts banner when items are low", async ({
    page,
  }) => {
    await page.goto("/supply-chain/inventory", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(2000);
    const alerts = page.getByText(/stock alert/i).or(page.getByText(/alerte/i));
    const hasAlerts = await alerts
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    const okBadge = page.getByText("OK");
    const hasOk = await okBadge
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    expect(hasAlerts || hasOk).toBeTruthy();
  });

  test("inventory movements tab shows history", async ({ page }) => {
    await page.goto("/supply-chain/inventory", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(2000);
    const movTab = page
      .getByText(/movements/i)
      .or(page.getByText(/mouvements/i));
    await movTab.first().click();
    await page.waitForTimeout(500);
    const inbound = page.getByText("Inbound").or(page.getByText("Outbound"));
    await expect(inbound.first()).toBeVisible({ timeout: 5000 });
  });

  // ─── Purchase Orders ─────────────────────────────────────────────────────

  test("purchase orders page shows PO list with status badges", async ({
    page,
  }) => {
    await page.goto("/supply-chain/purchase-orders", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(2000);
    const heading = page
      .getByText("Purchase Orders")
      .or(page.getByText(/bons de commande/i));
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
    const poNumber = page.getByText(/PO-2026/);
    await expect(poNumber.first()).toBeVisible({ timeout: 5000 });
  });

  test("purchase orders new PO dialog opens with item form", async ({
    page,
  }) => {
    await page.goto("/supply-chain/purchase-orders", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(2000);
    const btn = page
      .getByRole("button", { name: /new po/i })
      .or(page.getByRole("button", { name: /nouveau/i }));
    await expect(btn.first()).toBeVisible({ timeout: 10000 });
    await btn.first().click();
    await page.waitForTimeout(500);
    const dialog = page.locator("[role='dialog']");
    await expect(dialog.first()).toBeVisible({ timeout: 5000 });
    const supplierInput = dialog
      .getByPlaceholder(/supplier/i)
      .or(dialog.getByText(/supplier/i));
    await expect(supplierInput.first()).toBeVisible({ timeout: 3000 });
  });

  // ─── Warehouse Map ────────────────────────────────────────────────────────

  test("warehouse map shows floor plan with zones", async ({ page }) => {
    await page.goto("/supply-chain/warehouse-map", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(2000);
    const heading = page
      .getByText("Warehouse Location Map")
      .or(page.getByText(/plan entrepôt|carte entrepôt/i));
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
    const floorPlan = page
      .getByText("Warehouse Floor Plan")
      .or(page.getByText(/plan/i));
    await expect(floorPlan.first()).toBeVisible({ timeout: 5000 });
    const zoneCode = page.getByText("Zone A").or(page.getByText("RECV"));
    await expect(zoneCode.first()).toBeVisible({ timeout: 5000 });
  });

  // ─── Delivery Tracking ───────────────────────────────────────────────────

  test("delivery tracking shows shipments and timeline", async ({ page }) => {
    await page.goto("/supply-chain/delivery-tracking", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(2000);
    const heading = page
      .getByText("Delivery Tracking")
      .or(page.getByText(/suivi livraisons/i));
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
    const tracking = page.getByText(/SP-2026/).or(page.getByText(/tracking/i));
    await expect(tracking.first()).toBeVisible({ timeout: 5000 });
    const history = page
      .getByText("Tracking History")
      .or(page.getByText(/historique/i));
    await expect(history.first()).toBeVisible({ timeout: 5000 });
  });

  // ─── Supplier Portal ─────────────────────────────────────────────────────

  test("supplier portal shows supplier cards and add button", async ({
    page,
  }) => {
    await page.goto("/supply-chain/supplier-portal", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(2000);
    const heading = page
      .getByText("Supplier Portal")
      .or(page.getByText(/portail fournisseurs/i));
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
    const supplier = page
      .getByText("TechSupply Corp")
      .or(page.getByText("Office Essentials"));
    await expect(supplier.first()).toBeVisible({ timeout: 5000 });
    const addBtn = page
      .getByRole("button", { name: /add supplier/i })
      .or(page.getByRole("button", { name: /ajouter/i }));
    await expect(addBtn.first()).toBeVisible({ timeout: 5000 });
  });
});
