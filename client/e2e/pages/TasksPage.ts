import { type Locator, expect } from "@playwright/test";
import { BasePage } from "./BasePage";

/**
 * TasksPage — Page Object for the Tasks module.
 *
 * Covers:
 *  - Task listing at `/tasks`
 *  - Task creation via the form dialog
 *  - View switching (list / board / custom-board)
 *
 * Relies on data-testids instrumented in:
 *  - client/src/app/tasks/page.tsx
 *  - client/src/components/tasks/tasks-header.tsx
 *  - client/src/components/tasks/TaskTree.tsx
 *  - client/src/components/tasks/TaskForm.tsx
 */
export class TasksPage extends BasePage {
  get path(): string {
    return "/tasks";
  }

  get readyIndicator(): Locator {
    return this.page.getByTestId("tasks-root");
  }

  // ---- Navigation --------------------------------------------------------

  /** Navigate to the tasks page and wait for it to be ready. */
  async gotoTasks(): Promise<void> {
    await this.goto();
  }

  // ---- Create task -------------------------------------------------------

  /** Open the create-task dialog by clicking the add button. */
  async openCreateDialog(): Promise<void> {
    await this.page.getByTestId("tasks-add-button").click();
    await expect(this.page.getByTestId("task-form-dialog")).toBeVisible();
  }

  /** Fill the task title and submit the form. */
  async createTask(title: string): Promise<void> {
    await this.openCreateDialog();
    await this.page.getByTestId("task-form-title-input").fill(title);
    await this.page.getByTestId("task-form-submit").click();
    // Wait for the dialog to close after submission.
    await expect(this.page.getByTestId("task-form-dialog")).toBeHidden({
      timeout: 5000,
    });
  }

  // ---- Tree interactions -------------------------------------------------

  /** Returns the number of task items currently visible in the tree. */
  async taskCount(): Promise<number> {
    return this.page.locator("[data-testid^='task-tree-item-']").count();
  }

  /** Locator for a specific task item by id. */
  taskItem(id: string): Locator {
    return this.page.getByTestId(`task-tree-item-${id}`);
  }

  // ---- View switching ----------------------------------------------------

  /** Switch the view mode (list, board, custom-board). */
  async switchView(view: "list" | "board" | "custom-board"): Promise<void> {
    await this.page.getByTestId(`tasks-view-selector-${view}`).click();
  }
}
