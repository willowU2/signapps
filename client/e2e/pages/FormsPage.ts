import { type Locator, expect } from "@playwright/test";
import { BasePage } from "./BasePage";

/**
 * FormsPage — Page Object for the Forms (form builder) module.
 *
 * Covers:
 *  - Listing at `/forms`
 *  - Editor at `/forms/[id]`
 *  - Public respond page at `/f/[id]` (lightweight helpers)
 *
 * Relies on data-testids instrumented in:
 *  - client/src/app/forms/page.tsx
 *  - client/src/app/forms/[id]/page.tsx
 *
 * Debug skill: .claude/skills/forms-debug/SKILL.md
 * Spec: docs/product-specs/08-forms.md
 */
export class FormsPage extends BasePage {
  get path(): string {
    return "/forms";
  }

  get readyIndicator(): Locator {
    return this.page.getByTestId("forms-new-button");
  }

  // ---- Listing ----------------------------------------------------------

  /** Navigate to the listing page and wait for it to be ready. */
  async gotoListing(): Promise<void> {
    await this.goto();
  }

  /** Open the "new form" dialog. */
  async openCreateDialog(): Promise<void> {
    await this.page.getByTestId("forms-new-button").click();
    await expect(this.page.getByTestId("form-create-dialog")).toBeVisible();
  }

  /** Fill the create-form dialog and submit, returning the new form's id. */
  async createForm(title: string, description = ""): Promise<string> {
    await this.openCreateDialog();
    await this.page.getByTestId("form-create-dialog-title").fill(title);
    if (description) {
      await this.page
        .getByTestId("form-create-dialog-description")
        .fill(description);
    }
    // Intercept the POST response to extract the new id.
    const [response] = await Promise.all([
      this.page.waitForResponse(
        (r) =>
          r.url().includes("/api/v1/forms") &&
          r.request().method() === "POST" &&
          r.ok(),
      ),
      this.page.getByTestId("form-create-dialog-submit").click(),
    ]);
    const body = (await response.json()) as { id: string };
    // After creation, the app navigates to the editor (/forms/{id}).
    // Wait for either the editor to load OR the listing to show the card.
    await expect(
      this.page.getByTestId("form-editor-root").or(this.formCard(body.id)),
    ).toBeVisible({ timeout: 10000 });
    return body.id;
  }

  /** Locator for a specific form card in the listing. */
  formCard(formId: string): Locator {
    return this.page.getByTestId(`forms-list-item-${formId}`);
  }

  /** Returns the count of forms currently displayed. */
  async formCount(): Promise<number> {
    return this.page.locator("[data-testid^='forms-list-item-']").count();
  }

  /** Returns the title text of a form card. */
  async formTitle(formId: string): Promise<string | null> {
    return this.formCard(formId).getAttribute("data-form-title");
  }

  /** Returns the status ('draft' | 'published') of a form card. */
  async formStatus(formId: string): Promise<"draft" | "published"> {
    const status = await this.formCard(formId).getAttribute("data-form-status");
    return status as "draft" | "published";
  }

  /** Click the editor button on a form card and wait for the editor to load. */
  async openEditor(formId: string): Promise<void> {
    await this.formCard(formId)
      .getByTestId(`forms-list-item-edit-${formId}`)
      .click();
    await expect(this.page.getByTestId("form-editor-root")).toBeVisible();
  }

  /** Click the publish/unpublish button on a form card. */
  async togglePublish(formId: string): Promise<void> {
    await this.formCard(formId)
      .getByTestId(`forms-list-item-publish-${formId}`)
      .click();
  }

  /** Delete a form from the listing (with confirmation). */
  async deleteForm(formId: string): Promise<void> {
    await this.formCard(formId)
      .getByTestId(`forms-list-item-delete-${formId}`)
      .click();
    await this.page.getByTestId("forms-delete-confirm").click();
    await expect(this.formCard(formId)).toBeHidden();
  }

  // ---- Editor -----------------------------------------------------------

  /** Navigate directly to the editor for a form and wait for it to load. */
  async gotoEditor(formId: string): Promise<void> {
    await this.page.goto(`/forms/${formId}`);
    await expect(this.page.getByTestId("form-editor-root")).toBeVisible();
  }

  /** Click a palette button to add a field of a given type. */
  async addField(
    type:
      | "text"
      | "textarea"
      | "singlechoice"
      | "multiplechoice"
      | "number"
      | "email"
      | "date"
      | "file"
      | "signature"
      | "pagebreak",
  ): Promise<void> {
    const before = await this.fieldCount();
    await this.page.getByTestId(`form-field-palette-${type}`).click();
    // Wait for the field-list count to increment.
    await expect
      .poll(() => this.fieldCount(), { timeout: 2000 })
      .toBe(before + 1);
  }

  /** Count the fields currently in the builder. */
  async fieldCount(): Promise<number> {
    return this.page.locator("[data-testid^='form-field-item-']").count();
  }

  /** Locator for a field in the builder by index. */
  fieldItem(index: number): Locator {
    return this.page.getByTestId(`form-field-item-${index}`);
  }

  /** Set the label of a field by index. */
  async setFieldLabel(index: number, label: string): Promise<void> {
    await this.page.getByTestId(`form-field-label-${index}`).fill(label);
  }

  /** Get the data-field-type of a field by index. */
  async fieldType(index: number): Promise<string | null> {
    return this.fieldItem(index).getAttribute("data-field-type");
  }

  /** Delete a field by index. */
  async deleteField(index: number): Promise<void> {
    const before = await this.fieldCount();
    await this.page.getByTestId(`form-field-delete-${index}`).click();
    await expect
      .poll(() => this.fieldCount(), { timeout: 2000 })
      .toBe(before - 1);
  }

  /** Click the save button and wait for the request to complete. */
  async save(): Promise<void> {
    const [response] = await Promise.all([
      this.page.waitForResponse(
        (r) =>
          r.url().includes("/api/v1/forms/") &&
          r.request().method() === "PUT" &&
          r.ok(),
      ),
      this.page.getByTestId("form-editor-save").click(),
    ]);
    expect(response.ok()).toBe(true);
  }

  /** Switch to one of the editor tabs. */
  async switchTab(
    tab: "builder" | "analytics" | "branding" | "settings",
  ): Promise<void> {
    await this.page.getByTestId(`form-editor-tab-${tab}`).click();
  }

  // ---- Public respond (read-only helper) --------------------------------

  /** Navigate to the public respond page for a form. */
  async gotoRespond(formId: string): Promise<void> {
    await this.page.goto(`/f/${formId}`);
  }
}
