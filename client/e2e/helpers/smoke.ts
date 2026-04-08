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

/**
 * Pre-populate the localStorage flags that suppress the "Quoi de neuf ?"
 * changelog modal and the onboarding wizard. Should be called from the
 * spec's `beforeEach` via `addInitScript` so every page load in the test
 * sees the flags before the app's useEffect runs.
 */
export function suppressOnboardingModals(): () => void {
  return () => {
    try {
      localStorage.setItem("signapps-changelog-seen", "2.6.0");
      localStorage.setItem(
        "signapps-onboarding-completed",
        new Date().toISOString(),
      );
      localStorage.setItem("signapps-onboarding-dismissed", "true");
      localStorage.setItem("signapps_initialized", new Date().toISOString());
      localStorage.setItem("signapps_seed_dismissed", "true");
    } catch {
      // ignore
    }
  };
}
