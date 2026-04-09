import { test, expect } from "./fixtures";
import { DrivePage } from "./pages/DrivePage";

/**
 * Drive smoke tests — baseline coverage for the file storage module.
 *
 * The Drive module has a complete backend (signapps-storage, 24 handlers)
 * and a rich frontend but previously had zero data-testids.
 * This spec tests the most critical journeys based on the spec.
 *
 * Spec: docs/product-specs/05-drive.md
 * Debug skill: .claude/skills/drive-debug/SKILL.md
 */
test.describe("Drive — smoke", () => {
  test("drive page loads with root visible", async ({ page }) => {
    const drive = new DrivePage(page);
    await drive.gotoDrive();
    await expect(page.getByTestId("drive-root")).toBeVisible();
  });

  test("new button opens dropdown with folder and upload options", async ({
    page,
  }) => {
    const drive = new DrivePage(page);
    await drive.gotoDrive();
    await drive.openNewMenu();
    await expect(page.getByTestId("drive-new-folder-button")).toBeVisible();
    await expect(page.getByTestId("drive-upload-button")).toBeVisible();
  });

  test("create a folder via dialog", async ({ page }) => {
    const drive = new DrivePage(page);
    await drive.gotoDrive();
    const name = `E2E Folder ${Date.now()}`;
    await drive.createFolder(name);
    // Verify folder appears in the file list.
    await expect(drive.fileByName(name)).toBeVisible();
  });

  test("search filters files by name", async ({ page }) => {
    const drive = new DrivePage(page);
    await drive.gotoDrive();
    // Create a folder to ensure at least one item exists.
    const name = `Searchable ${Date.now()}`;
    await drive.createFolder(name);
    await drive.search("Searchable");
    await expect(drive.fileByName(name)).toBeVisible();
    await drive.clearSearch();
  });

  test("file container is visible", async ({ page }) => {
    const drive = new DrivePage(page);
    await drive.gotoDrive();
    await expect(page.getByTestId("drive-file-container")).toBeVisible();
  });
});
