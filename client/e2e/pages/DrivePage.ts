import { type Locator, expect } from "@playwright/test";
import { BasePage } from "./BasePage";

/**
 * DrivePage — Page Object for the Drive (file storage) module.
 *
 * Covers:
 *  - File listing at `/drive`
 *  - Create folder, upload, navigate, search, delete
 *
 * Relies on data-testids instrumented in:
 *  - client/src/app/drive/page.tsx
 *
 * Debug skill: .claude/skills/drive-debug/SKILL.md
 * Spec: docs/product-specs/05-drive.md
 */
export class DrivePage extends BasePage {
  get path(): string {
    return "/drive";
  }

  get readyIndicator(): Locator {
    return this.page.getByTestId("drive-root");
  }

  /** Navigate to the drive root. */
  async gotoDrive(): Promise<void> {
    await this.goto();
  }

  // ---- Sidebar / New menu -----------------------------------------------

  /** Open the "Nouveau" dropdown menu. */
  async openNewMenu(): Promise<void> {
    await this.page.getByTestId("drive-new-button").click();
  }

  /** Create a new folder. */
  async createFolder(name: string): Promise<void> {
    await this.openNewMenu();
    await this.page.getByTestId("drive-new-folder-button").click();
    await expect(this.page.getByTestId("drive-folder-dialog")).toBeVisible();
    await this.page.getByTestId("drive-folder-name-input").fill(name);
    await this.page.getByTestId("drive-folder-create-button").click();
    await expect(this.page.getByTestId("drive-folder-dialog")).toBeHidden();
  }

  /** Click the upload button (triggers hidden file input). */
  async clickUpload(): Promise<void> {
    await this.openNewMenu();
    await this.page.getByTestId("drive-upload-button").click();
  }

  // ---- File list --------------------------------------------------------

  /** Count of file/folder items currently displayed. */
  async fileCount(): Promise<number> {
    return this.page.locator("[data-testid^='drive-file-item-']").count();
  }

  /** Locator for a specific file/folder by node ID. */
  fileItem(nodeId: string): Locator {
    return this.page.getByTestId(`drive-file-item-${nodeId}`);
  }

  /** Find a file/folder by name (first match). */
  fileByName(name: string): Locator {
    return this.page.locator(`[data-file-name="${name}"]`).first();
  }

  /** Double-click a file/folder to open it. */
  async openByName(name: string): Promise<void> {
    await this.fileByName(name).dblclick();
  }

  // ---- Search -----------------------------------------------------------

  /** Type in the search box. */
  async search(query: string): Promise<void> {
    await this.page.getByTestId("drive-search-input").fill(query);
  }

  /** Clear search. */
  async clearSearch(): Promise<void> {
    await this.page.getByTestId("drive-search-input").fill("");
  }

  // ---- Delete -----------------------------------------------------------

  /** Delete a node by opening its context menu and confirming. */
  async deleteByName(name: string): Promise<void> {
    const row = this.fileByName(name);
    // Hover to reveal the menu button, then click "Supprimer".
    await row.hover();
    const menuBtn = row.locator("button").filter({ hasText: "" }).last();
    await menuBtn.click();
    await this.page.getByText("Supprimer").click();
    await this.page.getByTestId("drive-delete-confirm").click();
  }
}
