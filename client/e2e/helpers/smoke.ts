import { type Page, expect } from "@playwright/test";

/**
 * Assert that a given route loads without crashing.
 *
 * Checks:
 *   - HTTP response is < 400
 *   - <body> has more than 50 characters of content (not a blank/white page)
 *   - No visible "404 / Page not found / Une erreur est survenue / Something
 *     went wrong" fallback text anywhere on the page
 *   - No uncaught page errors or console errors (with noise filters)
 *
 * Onboarding/changelog modals are suppressed via `storageState` in
 * `auth.setup.ts`, not per-test — the relevant localStorage flags are
 * persisted across the whole browser context.
 *
 * Intended for parametric smoke specs that iterate over a module's routes.
 * Form interactions and data assertions are deliberately out of scope.
 */
export async function assertPageLoadsCleanly(
  page: Page,
  path: string,
): Promise<void> {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (
        text.includes("Failed to load resource") ||
        text.includes("favicon") ||
        text.includes("Download the React DevTools") ||
        text.includes("[HMR]") ||
        text.includes("webpack-internal")
      ) {
        return;
      }
      errors.push(`[console] ${text}`);
    }
  });

  const response = await page.goto(path);
  expect(response?.status() ?? 0, `HTTP status for ${path}`).toBeLessThan(400);

  await page.waitForLoadState("domcontentloaded");

  const bodyText = (await page.locator("body").textContent()) ?? "";
  expect(bodyText.trim().length, `body text length at ${path}`).toBeGreaterThan(
    50,
  );

  await expect(
    page.getByText(
      /^404$|Page not found|Une erreur est survenue|Something went wrong/i,
    ),
  ).toHaveCount(0);

  expect(errors, `uncaught page errors at ${path}`).toEqual([]);
}
