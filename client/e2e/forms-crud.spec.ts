import { test, expect } from "./fixtures";
import { FormsPage } from "./pages/FormsPage";

/**
 * Forms CRUD E2E tests.
 *
 * Covers the most critical user journeys for the Forms module:
 *  - Create form via dialog
 *  - List forms and filter by status
 *  - Open editor, add fields, set labels, save
 *  - Toggle publish state
 *  - Delete form
 *
 * Spec: docs/product-specs/08-forms.md
 * Debug skill: .claude/skills/forms-debug/SKILL.md
 */
test.describe("Forms — CRUD and builder", () => {
  test("listing page loads with the new form button", async ({ page }) => {
    const forms = new FormsPage(page);
    await forms.gotoListing();
    await expect(page.getByTestId("forms-new-button")).toBeVisible();
  });

  test("create a form via the dialog", async ({ page }) => {
    const forms = new FormsPage(page);
    await forms.gotoListing();
    const title = `E2E Form ${Date.now()}`;
    const id = await forms.createForm(title, "Created by Playwright");
    expect(id).toBeTruthy();
    // After creation the app redirects to the editor page.
    await expect(page.getByTestId("form-editor-root")).toBeVisible();
  });

  test("editor loads after creation with empty field list", async ({
    page,
  }) => {
    const forms = new FormsPage(page);
    await forms.gotoListing();
    const id = await forms.createForm(`E2E Editor ${Date.now()}`);
    // The app already redirected to editor after creation.
    await expect(page.getByTestId("form-editor-root")).toBeVisible();
    await expect(page.getByTestId("form-field-list")).toBeVisible();
    expect(await forms.fieldCount()).toBe(0);
  });

  test("add fields of multiple types and verify count", async ({ page }) => {
    const forms = new FormsPage(page);
    await forms.gotoListing();
    const id = await forms.createForm(`E2E Builder ${Date.now()}`);
    // createForm redirects to editor — we're already there.
    await expect(page.getByTestId("form-editor-root")).toBeVisible();

    await forms.addField("text");
    await forms.addField("email");
    await forms.addField("singlechoice");

    expect(await forms.fieldCount()).toBe(3);
    expect(await forms.fieldType(0)).toBe("Text");
    expect(await forms.fieldType(1)).toBe("Email");
    expect(await forms.fieldType(2)).toBe("SingleChoice");
  });

  test("set a field label and save", async ({ page }) => {
    const forms = new FormsPage(page);
    await forms.gotoListing();
    const id = await forms.createForm(`E2E Label ${Date.now()}`);
    // Already on editor page after create.
    await expect(page.getByTestId("form-editor-root")).toBeVisible();
    await forms.addField("text");
    await forms.setFieldLabel(0, "What is your name?");
    await forms.save();
    // Reload and verify persistence.
    await forms.gotoEditor(id);
    expect(await forms.fieldCount()).toBe(1);
    expect(await forms.fieldType(0)).toBe("Text");
  });

  test("delete a field from the builder", async ({ page }) => {
    const forms = new FormsPage(page);
    await forms.gotoListing();
    const id = await forms.createForm(`E2E Delete Field ${Date.now()}`);
    // Already on editor page.
    await expect(page.getByTestId("form-editor-root")).toBeVisible();
    await forms.addField("text");
    await forms.addField("email");
    expect(await forms.fieldCount()).toBe(2);
    await forms.deleteField(0);
    expect(await forms.fieldCount()).toBe(1);
  });

  test("toggle publish state of a form", async ({ page }) => {
    const forms = new FormsPage(page);
    await forms.gotoListing();
    const id = await forms.createForm(`E2E Publish ${Date.now()}`);
    // Navigate back to listing to toggle publish.
    await forms.gotoListing();
    await expect(forms.formCard(id)).toBeVisible({ timeout: 5000 });
    expect(await forms.formStatus(id)).toBe("draft");
    await forms.togglePublish(id);
    await expect
      .poll(() => forms.formStatus(id), { timeout: 5000 })
      .toBe("published");
    await forms.togglePublish(id);
    await expect
      .poll(() => forms.formStatus(id), { timeout: 5000 })
      .toBe("draft");
  });

  test("delete a form from the listing", async ({ page }) => {
    const forms = new FormsPage(page);
    await forms.gotoListing();
    const id = await forms.createForm(`E2E Delete ${Date.now()}`);
    // Navigate back to listing to delete.
    await forms.gotoListing();
    await expect(forms.formCard(id)).toBeVisible({ timeout: 5000 });
    await forms.deleteForm(id);
    await expect(forms.formCard(id)).toBeHidden();
  });

  test("switch between editor tabs", async ({ page }) => {
    const forms = new FormsPage(page);
    await forms.gotoListing();
    const id = await forms.createForm(`E2E Tabs ${Date.now()}`);
    // Already on editor page after create.
    await expect(page.getByTestId("form-editor-root")).toBeVisible();
    await forms.switchTab("analytics");
    await forms.switchTab("branding");
    await forms.switchTab("settings");
    await forms.switchTab("builder");
    await expect(page.getByTestId("form-field-list")).toBeVisible();
  });
});
