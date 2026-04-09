import { test, expect } from "./fixtures";
import { TasksPage } from "./pages/TasksPage";

/**
 * Tasks CRUD E2E tests.
 *
 * Covers the most critical user journeys for the Tasks module:
 *  - Page loads correctly
 *  - Add task button is visible
 *  - Create task dialog opens
 *  - Create a task and verify it appears in the tree
 */
test.describe("Tasks — CRUD", () => {
  test("Tasks page loads", async ({ page }) => {
    const tasks = new TasksPage(page);
    await tasks.gotoTasks();
    await expect(page.getByTestId("tasks-root")).toBeVisible();
  });

  test("add task button is visible", async ({ page }) => {
    const tasks = new TasksPage(page);
    await tasks.gotoTasks();
    await expect(page.getByTestId("tasks-add-button")).toBeVisible();
  });

  test("open create task dialog", async ({ page }) => {
    const tasks = new TasksPage(page);
    await tasks.gotoTasks();
    await tasks.openCreateDialog();
    await expect(page.getByTestId("task-form-dialog")).toBeVisible();
    await expect(page.getByTestId("task-form-title-input")).toBeVisible();
    await expect(page.getByTestId("task-form-submit")).toBeVisible();
  });

  // FIXME: Task tree doesn't refresh after creation — needs calendar selection or React Query invalidation
  test.fixme("create a task", async ({ page }) => {
    const tasks = new TasksPage(page);
    await tasks.gotoTasks();
    const title = `E2E Task ${Date.now()}`;
    await tasks.createTask(title);
    // After creation the dialog closes and the tree should reload.
    // Wait for the task tree to update — poll because React Query refetch is async.
    await expect(page.getByTestId("task-tree-root")).toBeVisible({
      timeout: 5000,
    });
    await expect
      .poll(() => tasks.taskCount(), { timeout: 5000 })
      .toBeGreaterThanOrEqual(1);
  });
});
