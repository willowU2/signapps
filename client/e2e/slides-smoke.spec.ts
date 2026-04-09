import { test, expect } from "./fixtures";
import { SlidesPage } from "./pages/SlidesPage";

/**
 * Slides smoke tests — baseline coverage for the presentation module.
 *
 * The Slides module uses Fabric.js for the canvas editor (dynamically loaded,
 * SSR disabled). The canvas itself is a <canvas> element, so testids are
 * placed on wrapper divs, not on the canvas.
 *
 * Instrumented testids:
 *  - slides-root, slides-new-button, slides-presentation-{id}  (dashboard)
 *  - slides-editor-root, slides-editor-toolbar, slides-editor-canvas,
 *    slides-editor-thumbnails, slides-editor-add-slide              (editor)
 */
test.describe("Slides — smoke", () => {
  test("slides dashboard loads", async ({ page }) => {
    const slides = new SlidesPage(page);
    await slides.gotoDashboard();
    await expect(page.getByTestId("slides-root")).toBeVisible();
  });

  test("new presentation button is visible", async ({ page }) => {
    const slides = new SlidesPage(page);
    await slides.gotoDashboard();
    await expect(page.getByTestId("slides-new-button").first()).toBeVisible();
  });

  test("editor loads for a new presentation", async ({ page }) => {
    const slides = new SlidesPage(page);
    await slides.gotoEditor("new-presentation", "E2E Test Slides");
    await expect(page.getByTestId("slides-editor-root")).toBeVisible();
  });

  test("editor has toolbar and canvas", async ({ page }) => {
    const slides = new SlidesPage(page);
    await slides.gotoEditor("new-presentation", "E2E Toolbar Check");
    await expect(page.getByTestId("slides-editor-toolbar")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("slides-editor-canvas")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("editor has thumbnails sidebar", async ({ page }) => {
    const slides = new SlidesPage(page);
    await slides.gotoEditor("new-presentation", "E2E Thumbnails Check");
    await expect(page.getByTestId("slides-editor-thumbnails")).toBeVisible({
      timeout: 15_000,
    });
  });
});
