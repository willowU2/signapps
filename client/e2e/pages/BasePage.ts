import { type Page, type Locator, expect } from "@playwright/test";

/**
 * BasePage — parent class for all Page Objects.
 *
 * Provides navigation, waits, and common interactions used across pages.
 * Sub-classes should expose domain-specific locators and actions.
 */
export abstract class BasePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /** Root URL path this page lives at. Override in sub-class. */
  abstract get path(): string;

  /** Locator that must be visible to consider the page "ready". Override in sub-class. */
  abstract get readyIndicator(): Locator;

  /** Navigate to the page and wait for it to be ready. */
  async goto(queryString = ""): Promise<void> {
    const url = queryString ? `${this.path}?${queryString}` : this.path;
    await this.page.goto(url, { waitUntil: "domcontentloaded" });
    await this.waitReady();
  }

  /** Wait until the readyIndicator is visible. */
  async waitReady(timeoutMs = 30_000): Promise<void> {
    await expect(this.readyIndicator).toBeVisible({ timeout: timeoutMs });
  }

  /** Press a keyboard shortcut (e.g. 'c', 'Control+z'). */
  async pressShortcut(key: string): Promise<void> {
    await this.page.keyboard.press(key);
  }

  /** Convenience: screenshot-friendly pause (use sparingly — prefer locator waits). */
  protected async waitForNetworkIdle(): Promise<void> {
    await this.page.waitForLoadState("networkidle");
  }
}
