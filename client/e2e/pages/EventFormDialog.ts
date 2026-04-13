import { type Page, type Locator, expect } from "@playwright/test";

/**
 * Page Object for the EventForm dialog (shadcn Dialog).
 *
 * Opened by: clicking "+ Nouveau" on CalendarHub, clicking an empty slot,
 * or double-clicking an existing event to edit.
 */
export class EventFormDialog {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  get root(): Locator {
    // Dialog title is "Créer un événement" (new) or "Modifier l'événement" (edit).
    return this.page.getByRole("dialog").filter({ hasText: /événement/i });
  }

  get titleInput(): Locator {
    return this.root.getByLabel(/Titre/i);
  }

  get descriptionInput(): Locator {
    return this.root.getByLabel(/Description/i);
  }

  get startDateInput(): Locator {
    return this.root.getByLabel(/Début|Date de début/i);
  }

  get endDateInput(): Locator {
    return this.root.getByLabel(/Fin|Date de fin/i);
  }

  get allDayCheckbox(): Locator {
    return this.root.getByLabel(/Toute la journée/i);
  }

  get eventTypeSelect(): Locator {
    // shadcn/ui Select renders the trigger with id="event_type"
    return this.root.locator("#event_type");
  }

  /**
   * Change the event type in the dialog's Type dropdown.
   * Accepts the visible French label: "Événement", "Tâche",
   * "Demande de congé", "Horaire / shift", "Réservation".
   */
  async selectEventType(label: string): Promise<void> {
    await this.eventTypeSelect.click();
    // Radix Select renders options in a portal outside the dialog
    await this.page.getByRole("option", { name: label }).click();
  }

  get saveButton(): Locator {
    // Button label depends on mode: "Créer" (new), "Mettre à jour" (edit),
    // "Soumettre la demande" (leave), "Enregistrement…" (while saving).
    return this.root.getByRole("button", {
      name: /Créer|Mettre à jour|Soumettre|Enregistrer|Sauvegarder/i,
    });
  }

  get cancelButton(): Locator {
    return this.root.getByRole("button", { name: /Annuler/i });
  }

  get deleteButton(): Locator {
    return this.root.getByRole("button", { name: /Supprimer/i });
  }

  // ─────────────────────────────── Actions ────────────────────────────────

  async waitOpen(timeoutMs = 5000): Promise<void> {
    await expect(this.root).toBeVisible({ timeout: timeoutMs });
  }

  async waitClosed(timeoutMs = 5000): Promise<void> {
    await expect(this.root).toBeHidden({ timeout: timeoutMs });
  }

  async fillTitle(title: string): Promise<void> {
    await this.titleInput.fill(title);
  }

  async fillDescription(text: string): Promise<void> {
    await this.descriptionInput.fill(text);
  }

  async save(): Promise<void> {
    await this.saveButton.click();
    await this.waitClosed(10_000);
  }

  async cancel(): Promise<void> {
    await this.cancelButton.click();
    await this.waitClosed();
  }

  async delete(): Promise<void> {
    await this.deleteButton.click();
    // Confirm dialog may appear — handle if present.
    const confirm = this.page.getByRole("button", {
      name: /^(Confirmer|Supprimer)$/i,
    });
    if (await confirm.isVisible({ timeout: 1000 }).catch(() => false)) {
      await confirm.click();
    }
    await this.waitClosed();
  }

  /** Create an event in one call. */
  async createSimpleEvent(title: string, description?: string): Promise<void> {
    await this.waitOpen();
    await this.fillTitle(title);
    if (description) await this.fillDescription(description);
    await this.save();
  }
}
