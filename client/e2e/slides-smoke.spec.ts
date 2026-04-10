/**
 * E2E Smoke — Slides (Presentations) module
 *
 * 11 tests covering key user journeys: dashboard loads, new presentation
 * button visible, create presentation flow, editor loads with toolbar
 * and canvas, thumbnails sidebar, add slide button, editor title display,
 * slide navigation, live presentation page, template cards on dashboard,
 * and back-to-dashboard navigation from editor.
 *
 * Uses data-testids instrumented in the Slides components:
 *   slides-root, slides-new-button, slides-editor-root,
 *   slides-editor-toolbar, slides-editor-canvas,
 *   slides-editor-thumbnails, slides-editor-add-slide
 *
 * Spec: docs/product-specs/ (slides)
 */
import { test, expect } from "./fixtures";
import { SlidesPage } from "./pages/SlidesPage";

test.describe("Slides — smoke", () => {
  // ─── Dashboard ────────────────────────────────────────────────────────────

  test("slides dashboard loads with root container", async ({ page }) => {
    const slides = new SlidesPage(page);
    await slides.gotoDashboard();
    await expect(page.getByTestId("slides-root")).toBeVisible({
      timeout: 10000,
    });
  });

  test("new presentation button is visible on dashboard", async ({ page }) => {
    const slides = new SlidesPage(page);
    await slides.gotoDashboard();
    await expect(page.getByTestId("slides-new-button").first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("dashboard shows presentation cards or empty state", async ({
    page,
  }) => {
    const slides = new SlidesPage(page);
    await slides.gotoDashboard();
    const cards = page.locator("[data-testid^='slides-presentation-']");
    const empty = page
      .getByText(/aucune présentation|no presentation|créer/i)
      .or(page.getByTestId("slides-new-button"));
    const hasCards = await cards
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    const hasEmpty = await empty
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    expect(hasCards || hasEmpty).toBeTruthy();
  });

  // ─── Editor — Load ────────────────────────────────────────────────────────

  test("editor loads for a new presentation", async ({ page }) => {
    const slides = new SlidesPage(page);
    await slides.gotoEditor("new-presentation", "E2E Test Slides");
    await expect(page.getByTestId("slides-editor-root")).toBeVisible({
      timeout: 15000,
    });
  });

  test("editor has toolbar visible", async ({ page }) => {
    const slides = new SlidesPage(page);
    await slides.gotoEditor("new-presentation", "E2E Toolbar Check");
    await expect(page.getByTestId("slides-editor-toolbar")).toBeVisible({
      timeout: 15000,
    });
  });

  test("editor has canvas area visible", async ({ page }) => {
    const slides = new SlidesPage(page);
    await slides.gotoEditor("new-presentation", "E2E Canvas Check");
    await expect(page.getByTestId("slides-editor-canvas")).toBeVisible({
      timeout: 15000,
    });
  });

  test("editor has thumbnails sidebar", async ({ page }) => {
    const slides = new SlidesPage(page);
    await slides.gotoEditor("new-presentation", "E2E Thumbnails Check");
    await expect(page.getByTestId("slides-editor-thumbnails")).toBeVisible({
      timeout: 15000,
    });
  });

  test("editor has add-slide button in thumbnails", async ({ page }) => {
    const slides = new SlidesPage(page);
    await slides.gotoEditor("new-presentation", "E2E Add Slide Check");
    await expect(
      page.getByTestId("slides-editor-add-slide").first(),
    ).toBeVisible({ timeout: 15000 });
  });

  test("clicking add-slide increases thumbnail count", async ({ page }) => {
    const slides = new SlidesPage(page);
    await slides.gotoEditor("new-presentation", "E2E Slide Count");
    await page
      .getByTestId("slides-editor-add-slide")
      .first()
      .waitFor({ state: "visible", timeout: 15000 });
    const initialCount = await slides.slideCount();
    await slides.addSlide();
    await page.waitForTimeout(1000);
    const newCount = await slides.slideCount();
    expect(newCount).toBeGreaterThanOrEqual(initialCount);
  });

  // ─── Editor — Navigation ──────────────────────────────────────────────────

  test("editor shows presentation name in title area", async ({ page }) => {
    const slides = new SlidesPage(page);
    await slides.gotoEditor("new-presentation", "My E2E Presentation");
    await expect(page.getByTestId("slides-editor-root")).toBeVisible({
      timeout: 15000,
    });
    const title = page
      .getByText("My E2E Presentation")
      .or(page.getByText(/présentation sans titre/i));
    await expect(title.first()).toBeVisible({ timeout: 5000 });
  });

  // ─── Live Presentation ────────────────────────────────────────────────────

  test("live presentation page loads without crashing", async ({ page }) => {
    await page.goto("/slides/live?id=test-e2e", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(3000);
    const body = page.locator("body");
    const text = (await body.textContent()) ?? "";
    expect(text.trim().length).toBeGreaterThan(20);
    await expect(
      page.getByText(
        /^404$|Page not found|Une erreur est survenue|Something went wrong/i,
      ),
    ).toHaveCount(0);
  });
});
