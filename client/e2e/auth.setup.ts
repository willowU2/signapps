import { test as setup } from "@playwright/test";
import path from "path";

const authFile = path.join(__dirname, "../playwright/.auth/user.json");

/**
 * Authentication setup.
 *
 * Gets JWT tokens from the identity API, injects 3 cookies:
 * - access_token (httpOnly) — for API auth
 * - refresh_token (httpOnly) — for token refresh
 * - auth-storage (non-httpOnly) — for Next.js server-side auth guard
 *
 * Also sets localStorage auth-storage for client-side AuthProvider.
 */
setup("authenticate", async ({ page }) => {
  setup.setTimeout(120000);

  // 1. Get JWT tokens
  const loginRes = await page.request.post(
    "http://localhost:3001/api/v1/auth/login",
    { data: { username: "admin", password: "admin" } },
  );
  if (!loginRes.ok()) {
    throw new Error(
      `Login API failed: ${loginRes.status()} ${await loginRes.text()}`,
    );
  }
  const { access_token, refresh_token } = await loginRes.json();

  // 2. Set all 3 cookies BEFORE any navigation
  await page.context().addCookies([
    {
      name: "access_token",
      value: access_token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
    {
      name: "refresh_token",
      value: refresh_token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
    {
      name: "auth-storage",
      value: encodeURIComponent(
        JSON.stringify({ state: { isAuthenticated: true } }),
      ),
      domain: "localhost",
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
  ]);

  // 3. Navigate to a page to set localStorage
  await page.goto("http://localhost:3000/dashboard", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  // 4. Unregister any service workers that might cache stale chunks
  await page.evaluate(async () => {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) {
        await reg.unregister();
      }
    }
    // Clear all caches
    if ("caches" in window) {
      const keys = await caches.keys();
      for (const key of keys) {
        await caches.delete(key);
      }
    }
  });

  // 5. Set localStorage for client-side AuthProvider + dismiss modals
  await page.evaluate(() => {
    localStorage.setItem(
      "auth-storage",
      JSON.stringify({ state: { isAuthenticated: true } }),
    );
    localStorage.setItem(
      "signapps-onboarding-completed",
      new Date().toISOString(),
    );
    localStorage.setItem("signapps-onboarding-dismissed", "true");
    localStorage.setItem("signapps-changelog-seen", "2.6.0");
    localStorage.setItem("signapps_initialized", new Date().toISOString());
    localStorage.setItem("signapps_seed_dismissed", "true");
  });

  // 5. Wait for the app to hydrate — look for sidebar/nav/header
  try {
    await page
      .locator("nav, aside, header, [data-slot='sidebar']")
      .first()
      .waitFor({ state: "visible", timeout: 60000 });
  } catch {
    // If hydration doesn't complete in 60s, save anyway
  }

  // 6. Re-set localStorage after hydration
  await page.evaluate(() => {
    localStorage.setItem(
      "auth-storage",
      JSON.stringify({ state: { isAuthenticated: true } }),
    );
    localStorage.setItem(
      "signapps-onboarding-completed",
      new Date().toISOString(),
    );
    localStorage.setItem("signapps-onboarding-dismissed", "true");
    localStorage.setItem("signapps-changelog-seen", "2.6.0");
    localStorage.setItem("signapps_initialized", new Date().toISOString());
    localStorage.setItem("signapps_seed_dismissed", "true");
  });

  // 7. Save state
  await page.context().storageState({ path: authFile });
});

export { authFile };
