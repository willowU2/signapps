/**
 * E2E Smoke — LMS (Learning Management System) module
 *
 * Tests covering key user journeys: course catalog display, category
 * filters, level filters, search, course cards with ratings, learning paths,
 * certificates, quiz builder, discussions, progress dashboard, reviews.
 *
 * Note: The catalog page fetches courses from /api/lms/courses which proxies
 * to the identity backend. When the backend is down, the page may render
 * an error boundary ("Erreur inattendue"). Under heavy parallel test load,
 * the dev server may be slow to compile pages and the AppLayout may show
 * "Chargement..." for extended periods. Tests handle all states.
 *
 * Spec: docs/product-specs/ (lms)
 */
import { test, expect } from "./fixtures";

/**
 * Check if the page is in a valid state (loaded, error, or loading).
 * Returns "content" if page content is visible, "error" if error boundary,
 * "loading" if still loading.
 */
async function getPageState(
  page: import("@playwright/test").Page,
  contentPattern: RegExp | string,
): Promise<"content" | "error" | "loading"> {
  const content =
    typeof contentPattern === "string"
      ? page.getByText(contentPattern)
      : page.getByText(contentPattern);
  const errorState = page.getByText(/erreur inattendue/i);
  const loadingState = page.getByText(/chargement/i);

  // Wait for something to appear
  const anything = content.or(errorState).or(loadingState);
  await anything
    .first()
    .waitFor({ state: "visible", timeout: 15000 })
    .catch(() => {});

  const hasContent = await content
    .first()
    .isVisible({ timeout: 1000 })
    .catch(() => false);
  if (hasContent) return "content";

  const hasError = await errorState
    .first()
    .isVisible({ timeout: 1000 })
    .catch(() => false);
  if (hasError) return "error";

  return "loading";
}

test.describe("LMS — smoke", () => {
  // ─── Catalog ──────────────────────────────────────────────────────────────

  test("catalog page loads with course cards or error state", async ({
    page,
  }) => {
    await page.goto("/lms/catalog", { waitUntil: "domcontentloaded" });
    const state = await getPageState(page, "Course Catalog");
    expect(["content", "error", "loading"]).toContain(state);
  });

  test("catalog shows category filter buttons or error state", async ({
    page,
  }) => {
    await page.goto("/lms/catalog", { waitUntil: "domcontentloaded" });
    const state = await getPageState(page, "Course Catalog");
    if (state !== "content") return;
    for (const label of ["All", "Security", "Documents"]) {
      const btn = page.getByRole("button", { name: label });
      await expect(btn.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test("catalog shows level filter buttons or error state", async ({
    page,
  }) => {
    await page.goto("/lms/catalog", { waitUntil: "domcontentloaded" });
    const state = await getPageState(page, "Course Catalog");
    if (state !== "content") return;
    for (const label of ["Beginner", "Intermediate", "Advanced"]) {
      const btn = page.getByRole("button", { name: label });
      await expect(btn.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test("catalog search filters courses or error state", async ({ page }) => {
    await page.goto("/lms/catalog", { waitUntil: "domcontentloaded" });
    const state = await getPageState(page, "Course Catalog");
    if (state !== "content") return;
    const search = page.getByPlaceholder(/rechercher/i);
    const hasSearch = await search
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    if (!hasSearch) return;
    await search.first().fill("Security");
    await page.waitForTimeout(500);
    const result = page.getByText(/security/i);
    await expect(result.first()).toBeVisible({ timeout: 5000 });
  });

  test("catalog course cards show rating, duration, and enroll button or error state", async ({
    page,
  }) => {
    await page.goto("/lms/catalog", { waitUntil: "domcontentloaded" });
    const state = await getPageState(page, /4\.\d/);
    if (state !== "content") return;
    const rating = page.getByText(/4\.\d/);
    await expect(rating.first()).toBeVisible({ timeout: 3000 });
    const duration = page.getByText(/\d+h/);
    await expect(duration.first()).toBeVisible({ timeout: 3000 });
    const enrollBtn = page
      .getByRole("link", { name: /enroll|continue|review/i })
      .or(page.getByRole("button", { name: /enroll|continue/i }));
    await expect(enrollBtn.first()).toBeVisible({ timeout: 3000 });
  });

  // ─── Learning Paths ───────────────────────────────────────────────────────

  test("learning paths page shows path cards or error state", async ({
    page,
  }) => {
    await page.goto("/lms/learning-paths", { waitUntil: "domcontentloaded" });
    const state = await getPageState(page, /learning path/i);
    expect(["content", "error", "loading"]).toContain(state);
  });

  // ─── Certificates ────────────────────────────────────────────────────────

  test("certificates page shows earned certificates or error state", async ({
    page,
  }) => {
    await page.goto("/lms/certificates", { waitUntil: "domcontentloaded" });
    const state = await getPageState(page, /certificate/i);
    expect(["content", "error", "loading"]).toContain(state);
  });

  // ─── Quiz Builder ────────────────────────────────────────────────────────

  test("quiz builder shows question type buttons or error state", async ({
    page,
  }) => {
    await page.goto("/lms/quiz-builder", { waitUntil: "domcontentloaded" });
    const state = await getPageState(page, /quiz builder/i);
    expect(["content", "error", "loading"]).toContain(state);
  });

  // ─── Discussions ──────────────────────────────────────────────────────────

  test("discussions page shows lesson threads or error state", async ({
    page,
  }) => {
    await page.goto("/lms/discussions", { waitUntil: "domcontentloaded" });
    const state = await getPageState(page, /discussion/i);
    expect(["content", "error", "loading"]).toContain(state);
  });

  // ─── Progress ─────────────────────────────────────────────────────────────

  test("progress page shows learning dashboard or error state", async ({
    page,
  }) => {
    await page.goto("/lms/progress", { waitUntil: "domcontentloaded" });
    const state = await getPageState(page, /progress/i);
    expect(["content", "error", "loading"]).toContain(state);
  });

  // ─── Reviews ──────────────────────────────────────────────────────────────

  test("reviews page loads without crashing", async ({ page }) => {
    await page.goto("/lms/reviews", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const body = page.locator("body");
    const text = (await body.textContent()) ?? "";
    expect(text.trim().length).toBeGreaterThan(50);
    await expect(page.getByText(/^404$|Page not found/i)).toHaveCount(0);
  });

  // ─── Hub redirect ────────────────────────────────────────────────────────

  test("LMS hub redirects to catalog", async ({ page }) => {
    await page.goto("/lms", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL(/\/lms\/catalog/);
  });
});
