/**
 * E2E Smoke — LMS (Learning Management System) module
 *
 * 8 static pages covering the course catalog, progress tracking, quiz
 * builder, certificates, discussions, reviews, and learning paths. The
 * dynamic `/lms/courses/[id]` route is excluded — it requires a real
 * course ID and belongs in a dedicated lms-courses spec.
 */

import { test } from "./fixtures";
import { assertPageLoadsCleanly } from "./helpers/smoke";

const LMS_PAGES: Array<{ path: string; label: string }> = [
  { path: "/lms", label: "LMS hub" },
  { path: "/lms/catalog", label: "Course catalog" },
  { path: "/lms/certificates", label: "Certificates" },
  { path: "/lms/discussions", label: "Discussions" },
  { path: "/lms/learning-paths", label: "Learning paths" },
  { path: "/lms/progress", label: "Progress tracking" },
  { path: "/lms/quiz-builder", label: "Quiz builder" },
  { path: "/lms/reviews", label: "Reviews" },
];

test.describe("LMS — smoke", () => {
  for (const { path, label } of LMS_PAGES) {
    test(`${label} (${path}) loads without crashing`, async ({ page }) => {
      await assertPageLoadsCleanly(page, path);
    });
  }
});
