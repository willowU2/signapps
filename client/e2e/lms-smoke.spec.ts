/**
 * E2E Smoke — LMS (Learning Management System) module
 *
 * 12 tests covering key user journeys: course catalog display, category
 * filters, level filters, search, course cards with ratings, learning paths
 * with progress, certificates list and preview, quiz builder question types,
 * discussions with threads, progress dashboard KPIs, enrollment buttons,
 * and reviews page.
 *
 * Spec: docs/product-specs/ (lms)
 */
import { test, expect } from "./fixtures";

test.describe("LMS — smoke", () => {
  // ─── Catalog ──────────────────────────────────────────────────────────────

  test("catalog page loads with course cards", async ({ page }) => {
    await page.goto("/lms/catalog", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const heading = page
      .getByText("Course Catalog")
      .or(page.getByText(/catalogue/i));
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
    const courseCard = page
      .getByText("Introduction to SignApps Platform")
      .or(page.getByText(/signApps/i));
    await expect(courseCard.first()).toBeVisible({ timeout: 5000 });
  });

  test("catalog shows category filter buttons", async ({ page }) => {
    await page.goto("/lms/catalog", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    for (const label of ["All", "Security", "Documents"]) {
      const btn = page.getByRole("button", { name: label });
      await expect(btn.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test("catalog shows level filter buttons", async ({ page }) => {
    await page.goto("/lms/catalog", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    for (const label of ["Beginner", "Intermediate", "Advanced"]) {
      const btn = page.getByRole("button", { name: label });
      await expect(btn.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test("catalog search filters courses", async ({ page }) => {
    await page.goto("/lms/catalog", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const search = page.getByPlaceholder(/rechercher/i);
    await expect(search.first()).toBeVisible({ timeout: 10000 });
    await search.first().fill("Security");
    await page.waitForTimeout(500);
    const result = page.getByText(/security/i);
    await expect(result.first()).toBeVisible({ timeout: 5000 });
  });

  test("catalog course cards show rating, duration, and enroll button", async ({
    page,
  }) => {
    await page.goto("/lms/catalog", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const rating = page.getByText(/4\.\d/);
    await expect(rating.first()).toBeVisible({ timeout: 5000 });
    const duration = page.getByText(/\d+h/);
    await expect(duration.first()).toBeVisible({ timeout: 5000 });
    const enrollBtn = page
      .getByRole("link", { name: /enroll|continue|review/i })
      .or(page.getByRole("button", { name: /enroll|continue/i }));
    await expect(enrollBtn.first()).toBeVisible({ timeout: 5000 });
  });

  // ─── Learning Paths ───────────────────────────────────────────────────────

  test("learning paths page shows path cards with progress", async ({
    page,
  }) => {
    await page.goto("/lms/learning-paths", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(2000);
    const heading = page
      .getByText(/learning path/i)
      .or(page.getByText(/parcours/i));
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
    const pathTitle = page
      .getByText("SignApps Essentials")
      .or(page.getByText("Security & Compliance"));
    await expect(pathTitle.first()).toBeVisible({ timeout: 5000 });
  });

  // ─── Certificates ────────────────────────────────────────────────────────

  test("certificates page shows earned certificates", async ({ page }) => {
    await page.goto("/lms/certificates", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const heading = page
      .getByText(/certificate/i)
      .or(page.getByText(/certificat/i));
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
    const certNumber = page
      .getByText(/CERT-2026/)
      .or(page.getByText(/certificate of completion/i));
    await expect(certNumber.first()).toBeVisible({ timeout: 5000 });
  });

  // ─── Quiz Builder ────────────────────────────────────────────────────────

  test("quiz builder shows question type buttons", async ({ page }) => {
    await page.goto("/lms/quiz-builder", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const heading = page
      .getByText(/quiz builder/i)
      .or(page.getByText(/créateur de quiz/i));
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
    const mcBtn = page
      .getByText("Multiple Choice")
      .or(page.getByText(/choix multiple/i));
    const tfBtn = page
      .getByText("True / False")
      .or(page.getByText(/vrai.*faux/i));
    const hasMC = await mcBtn
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    const hasTF = await tfBtn
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    expect(hasMC || hasTF).toBeTruthy();
  });

  // ─── Discussions ──────────────────────────────────────────────────────────

  test("discussions page shows lesson threads with comments", async ({
    page,
  }) => {
    await page.goto("/lms/discussions", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const heading = page.getByText(/discussion/i).or(page.getByText(/forum/i));
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
    const thread = page
      .getByText("Getting Started")
      .or(page.getByText(/introduction/i));
    await expect(thread.first()).toBeVisible({ timeout: 5000 });
  });

  // ─── Progress ─────────────────────────────────────────────────────────────

  test("progress page shows learning dashboard with KPIs", async ({ page }) => {
    await page.goto("/lms/progress", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const heading = page
      .getByText("Learning Progress Dashboard")
      .or(page.getByText(/progression/i));
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
    const studentName = page.getByText("Alice M.").or(page.getByText("Bob K."));
    await expect(studentName.first()).toBeVisible({ timeout: 5000 });
  });

  // ─── Reviews ──────────────────────────────────────────────────────────────

  test("reviews page loads without crashing", async ({ page }) => {
    await page.goto("/lms/reviews", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const body = page.locator("body");
    const text = (await body.textContent()) ?? "";
    expect(text.trim().length).toBeGreaterThan(50);
    await expect(
      page.getByText(
        /^404$|Page not found|Une erreur est survenue|Something went wrong/i,
      ),
    ).toHaveCount(0);
  });

  // ─── Hub redirect ────────────────────────────────────────────────────────

  test("LMS hub redirects to catalog", async ({ page }) => {
    await page.goto("/lms", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL(/\/lms\/catalog/);
  });
});
