/**
 * E2E Smoke — Supply Chain module
 *
 * 9 pages covering inventory management, product catalog, purchase orders,
 * receiving/shipping, delivery tracking, stock alerts, the supplier portal,
 * and the warehouse map visualisation.
 */

import { test } from "./fixtures";
import {
  assertPageLoadsCleanly,
  suppressOnboardingModals,
} from "./helpers/smoke";

const SUPPLY_CHAIN_PAGES: Array<{ path: string; label: string }> = [
  { path: "/supply-chain", label: "Supply chain hub" },
  { path: "/supply-chain/inventory", label: "Inventory" },
  { path: "/supply-chain/product-catalog", label: "Product catalog" },
  { path: "/supply-chain/purchase-orders", label: "Purchase orders" },
  { path: "/supply-chain/receiving-shipping", label: "Receiving / shipping" },
  { path: "/supply-chain/delivery-tracking", label: "Delivery tracking" },
  { path: "/supply-chain/stock-alerts", label: "Stock alerts" },
  { path: "/supply-chain/supplier-portal", label: "Supplier portal" },
  { path: "/supply-chain/warehouse-map", label: "Warehouse map" },
];

test.describe("Supply Chain — smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(suppressOnboardingModals());
  });

  for (const { path, label } of SUPPLY_CHAIN_PAGES) {
    test(`${label} (${path}) loads without crashing`, async ({ page }) => {
      await assertPageLoadsCleanly(page, path);
    });
  }
});
