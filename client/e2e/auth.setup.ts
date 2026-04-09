import { test as setup } from "@playwright/test";
import path from "path";

const authFile = path.join(__dirname, "../playwright/.auth/user.json");

/**
 * Authentication setup - runs before all tests that depend on 'setup'
 * Creates an authenticated session that can be reused across tests.
 *
 * Strategy: call the identity API directly to get JWT tokens, then set
 * them as cookies. This bypasses UI login issues (onboarding modal overlay,
 * slow React hydration, etc.) and is faster + more reliable.
 */
setup("authenticate", async ({ page }) => {
  setup.setTimeout(90000);

  // 1. Call the login API directly to get tokens
  const loginRes = await page.request.post(
    "http://localhost:3001/api/v1/auth/login",
    {
      data: { username: "admin", password: "admin" },
    },
  );

  if (!loginRes.ok()) {
    throw new Error(
      `Login API failed: ${loginRes.status()} ${await loginRes.text()}`,
    );
  }

  const { access_token, refresh_token } = await loginRes.json();

  // 2. Navigate to the app so we can set cookies on the right domain
  await page.goto("http://localhost:3000/login", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  // 3. Set auth cookies
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
  ]);

  // 4. Set localStorage to dismiss all onboarding/changelog modals
  await page.evaluate(() => {
    localStorage.setItem(
      "signapps-onboarding-completed",
      new Date().toISOString(),
    );
    localStorage.setItem("signapps-onboarding-dismissed", "true");
    localStorage.setItem("signapps-changelog-seen", "2.6.0");
    localStorage.setItem("signapps_initialized", new Date().toISOString());
    localStorage.setItem("signapps_seed_dismissed", "true");
  });

  // 5. Verify auth works by navigating to dashboard
  await page.goto("http://localhost:3000/dashboard", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  // Wait for the page to actually render (not just the loading spinner)
  await page.waitForTimeout(5000);

  // 6. Save the authenticated state
  await page.context().storageState({ path: authFile });
});

export { authFile };
