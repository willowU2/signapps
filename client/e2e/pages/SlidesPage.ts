import { type Locator } from "@playwright/test";
import { BasePage } from "./BasePage";

/**
 * SlidesPage — Page Object for the Slides (presentations) module.
 *
 * Covers:
 *  - Presentation dashboard at `/slides`
 *  - Slide editor at `/slides/editor?id=...`
 *
 * Relies on data-testids instrumented in:
 *  - client/src/app/slides/page.tsx
 *  - client/src/app/slides/editor/page.tsx
 *  - client/src/components/slides/dashboard.tsx
 *  - client/src/components/slides/slide-toolbar.tsx
 *  - client/src/components/slides/slide-canvas.tsx
 *  - client/src/components/slides/slide-sidebar.tsx
 */
export class SlidesPage extends BasePage {
  get path(): string {
    return "/slides";
  }

  get readyIndicator(): Locator {
    return this.page.getByTestId("slides-root");
  }

  // ---- Dashboard ---------------------------------------------------------

  /** Navigate to the slides dashboard. */
  async gotoDashboard(): Promise<void> {
    await this.goto();
  }

  /** Click the "new presentation" button (blank card in template ribbon). */
  async createPresentation(): Promise<void> {
    await this.page.getByTestId("slides-new-button").first().click();
  }

  /** Count of presentation cards currently displayed. */
  async presentationCount(): Promise<number> {
    return this.page.locator("[data-testid^='slides-presentation-']").count();
  }

  // ---- Editor ------------------------------------------------------------

  /** Navigate to the editor for a given presentation id. */
  async gotoEditor(id: string, name = "Untitled"): Promise<void> {
    await this.page.goto(
      `/slides/editor?id=${id}&name=${encodeURIComponent(name)}`,
    );
    await this.page
      .getByTestId("slides-editor-root")
      .waitFor({ state: "visible", timeout: 15_000 });
  }

  /** Click the "add slide" button in the thumbnails sidebar. */
  async addSlide(): Promise<void> {
    await this.page.getByTestId("slides-editor-add-slide").first().click();
  }

  /** Count of slide thumbnails in the sidebar. */
  async slideCount(): Promise<number> {
    return this.page
      .getByTestId("slides-editor-thumbnails")
      .locator(".group.flex.gap-3")
      .count();
  }
}
