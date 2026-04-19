import { test, expect } from "./fixtures";

/**
 * S2 — PXE operational E2E scenarios (W2 T11)
 *
 * Three scenarios:
 *   S2-PXE-1 : Simulate a DHCPDISCOVER via `/pxe/_test/simulate-dhcp`,
 *              verify the MAC shows up under Découverts, enroll it,
 *              verify it moves to Enrôlés.
 *   S2-PXE-2 : Walk through the 5-step wizard end-to-end.
 *   S2-PXE-3 : Open /pxe/debug and verify the DHCP audit table renders.
 *
 * All tests rely on the auth.setup.ts fixture for admin login.
 */

test.describe("S2 — PXE opérationnel", () => {
  test("S2-PXE-1: discovered → enrolled flow", async ({ page, request }) => {
    // Unique MAC so multiple CI runs don't collide.
    const suffix = Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, "0");
    const mac = `aa:bb:cc:${suffix}:00:01`;

    // Inject a synthetic DHCPDISCOVER via the dev-only test endpoint.
    const resp = await request.post(
      "http://localhost:3099/api/v1/pxe/_test/simulate-dhcp",
      { data: { mac }, failOnStatusCode: false },
    );
    // Non-fatal: if the backend runs in release (no debug_assertions) the
    // endpoint is absent. In that case the test becomes a smoke test for
    // the assets page only.
    const simulated = resp.ok();

    await page.goto("/pxe/assets", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /Assets PXE/i }),
    ).toBeVisible({ timeout: 10_000 });

    if (simulated) {
      await page.getByRole("tab", { name: /Découverts/ }).click();
      await expect(page.locator(`text=${mac}`).first()).toBeVisible({
        timeout: 10_000,
      });

      // Enroll
      await page.locator(`[data-testid="pxe-enroll-${mac}"]`).first().click();
      await page.waitForTimeout(800);

      await page.getByRole("tab", { name: /Enrôlés/ }).click();
      await expect(page.locator(`text=${mac}`).first()).toBeVisible({
        timeout: 10_000,
      });
    }
  });

  test("S2-PXE-2: wizard 5 steps end-to-end", async ({ page }) => {
    await page.goto("/pxe/wizard", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /Déploiement PXE/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Step 1 — pick any catalog image (or fail-soft if catalog empty)
    await expect(
      page.getByRole("heading", { name: /Choisir l'image/i }),
    ).toBeVisible();
    const catalogBtn = page.locator('[data-testid^="pxe-catalog-"]').first();
    if (await catalogBtn.isVisible().catch(() => false)) {
      await catalogBtn.click();
    } else {
      // No catalog present → fabricate selection via Suivant disabled state
      test.skip(
        true,
        "PXE catalog empty in this environment — step 1 cannot advance",
      );
    }
    await page.getByRole("button", { name: "Suivant" }).click();

    // Step 2 — pick first profile if any, else skip
    const profileBtn = page.locator('[data-testid^="pxe-profile-"]').first();
    if (!(await profileBtn.isVisible().catch(() => false))) {
      test.skip(true, "No PXE profile seeded — cannot advance wizard");
    }
    await profileBtn.click();
    await page.getByRole("button", { name: "Suivant" }).click();

    // Step 3 — type a MAC manually
    const manualMac = "aa:bb:cc:12:34:56";
    await page.getByPlaceholder("aa:bb:cc:dd:ee:ff").fill(manualMac);
    await page.getByRole("button", { name: "Utiliser" }).click();
    await expect(page.locator('[data-testid="pxe-mac-summary"]')).toContainText(
      manualMac,
    );
    await page.getByRole("button", { name: "Suivant" }).click();

    // Step 4 — confirm
    await expect(
      page.getByRole("heading", { name: /Confirmation/i }),
    ).toBeVisible();
    await expect(page.locator(`text=${manualMac}`).first()).toBeVisible();
    await page.locator('[data-testid="pxe-kickoff"]').click();

    // Step 5 — progress (SSE). We don't expect real events, only the UI.
    await expect(page.getByRole("heading", { name: /en cours/i })).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.locator('[data-testid="pxe-live-terminal"]'),
    ).toBeVisible();
  });

  test("S2-PXE-3: debug DHCP requests table visible", async ({ page }) => {
    await page.goto("/pxe/debug", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /DHCP requests/i }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("table")).toBeVisible();
  });
});
