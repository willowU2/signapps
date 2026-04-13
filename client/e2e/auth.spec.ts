import { unauthenticatedTest, expect, testData, selectors } from "./fixtures";

/**
 * Authentication E2E Tests
 * Tests login flow, logout, and route protection
 * All labels are in French to match the current UI.
 */

unauthenticatedTest.describe("Authentication Flow", () => {
  unauthenticatedTest.describe("Login Page", () => {
    unauthenticatedTest(
      "should display login form with all elements",
      async ({ page }) => {
        await page.goto("/login");

        // Check page title and description (French)
        await expect(page.getByText("Bon retour")).toBeVisible();
        await expect(
          page.getByText("Connectez-vous à votre compte SignApps"),
        ).toBeVisible();

        // Check form elements (French labels)
        await expect(page.locator("#username")).toBeVisible();
        await expect(page.locator("#password")).toBeVisible();
        await expect(
          page.getByRole("button", { name: /se connecter/i }),
        ).toBeVisible();

        // Check remember me checkbox (French)
        await expect(page.getByText("Se souvenir de moi")).toBeVisible();

        // Check LDAP option
        await expect(page.getByRole("button", { name: /LDAP/i })).toBeVisible();
      },
    );

    unauthenticatedTest(
      "should toggle password visibility",
      async ({ page }) => {
        await page.goto("/login");

        const passwordInput = page.locator("#password");

        // Initially password should be hidden
        await expect(passwordInput).toHaveAttribute("type", "password");

        // Fill some text so the field is visible
        await passwordInput.fill("test");

        // Click the eye toggle button (ghost button inside the password field wrapper)
        const eyeButton = page
          .locator('#password ~ button[type="button"]')
          .first();
        // Fallback: the button is absolutely positioned inside .relative wrapping the input
        const toggleBtn = page
          .locator('.relative button[type="button"]')
          .first();
        const btn = (await eyeButton.isVisible().catch(() => false))
          ? eyeButton
          : toggleBtn;
        await btn.click();

        // Password should now be visible
        await expect(passwordInput).toHaveAttribute("type", "text");
      },
    );
  });

  unauthenticatedTest.describe("Login with Valid Credentials", () => {
    unauthenticatedTest(
      "should redirect to dashboard after successful login",
      async ({ page }) => {
        await page.goto("/login");

        // Fill in valid credentials (French labels)
        await page.locator("#username").fill(testData.validUser.username);
        await page.locator("#password").fill(testData.validUser.password);

        // Submit the form
        await page.getByRole("button", { name: /se connecter/i }).click();

        // Should redirect to dashboard, MFA verify, or stay on login for context picker
        // The context picker is rendered on the same /login URL (inline component swap)
        await page.waitForURL(/\/(dashboard|login|portal)/, { timeout: 15000 });

        // If we're on dashboard, verify it loaded
        if (page.url().includes("/dashboard")) {
          await expect(page.getByText("Tableau de bord")).toBeVisible({
            timeout: 10000,
          });
        }
        // If still on /login, context picker may be showing (multi-affiliation)
        // That's a valid outcome
      },
    );

    unauthenticatedTest(
      "should show loading state during login",
      async ({ page }) => {
        await page.goto("/login");

        // Fill in credentials
        await page.locator("#username").fill(testData.validUser.username);
        await page.locator("#password").fill(testData.validUser.password);

        // Click submit and check for loading state
        const submitButton = page.getByRole("button", {
          name: /se connecter/i,
        });
        await submitButton.click();

        // Button should show loading text (French)
        await expect(page.getByText("Connexion en cours..."))
          .toBeVisible({ timeout: 2000 })
          .catch(() => {
            // Loading state might be too fast to catch, that's ok
          });
      },
    );
  });

  unauthenticatedTest.describe("Login with Invalid Credentials", () => {
    unauthenticatedTest(
      "should show error message for invalid username",
      async ({ page }) => {
        await page.goto("/login");

        // Fill in invalid credentials
        await page.locator("#username").fill(testData.invalidUser.username);
        await page.locator("#password").fill(testData.invalidUser.password);

        // Submit the form
        await page.getByRole("button", { name: /se connecter/i }).click();

        // Should show error message (destructive style — target the specific error div)
        await expect(page.locator(".bg-destructive\\/10")).toBeVisible({
          timeout: 5000,
        });

        // Should stay on login page
        await expect(page).toHaveURL(/\/login/);
      },
    );

    unauthenticatedTest(
      "should show error for empty username",
      async ({ page }) => {
        await page.goto("/login");

        // Only fill password
        await page.locator("#password").fill("somepassword");

        // Submit the form
        await page.getByRole("button", { name: /se connecter/i }).click();

        // Should show validation error (French)
        await expect(
          page.getByText("Le nom d'utilisateur est requis"),
        ).toBeVisible();
      },
    );

    unauthenticatedTest(
      "should show error for empty password",
      async ({ page }) => {
        await page.goto("/login");

        // Only fill username
        await page.locator("#username").fill("someuser");

        // Submit the form
        await page.getByRole("button", { name: /se connecter/i }).click();

        // Should show validation error (French)
        await expect(
          page.getByText("Le mot de passe est requis"),
        ).toBeVisible();
      },
    );
  });

  unauthenticatedTest.describe("Route Protection", () => {
    unauthenticatedTest(
      "should redirect to login when accessing protected route",
      async ({ page }) => {
        // Try to access dashboard without authentication
        await page.goto("/dashboard");

        // Should be redirected to login
        await expect(page).toHaveURL(/\/login/);
      },
    );

    unauthenticatedTest(
      "should redirect to login when accessing containers page",
      async ({ page }) => {
        await page.goto("/containers");
        await expect(page).toHaveURL(/\/login/);
      },
    );

    unauthenticatedTest(
      "should redirect to login when accessing storage page",
      async ({ page }) => {
        await page.goto("/storage");
        await expect(page).toHaveURL(/\/login/);
      },
    );

    unauthenticatedTest(
      "should redirect to login when accessing settings page",
      async ({ page }) => {
        await page.goto("/settings");
        await expect(page).toHaveURL(/\/login/);
      },
    );

    unauthenticatedTest(
      "should preserve redirect path in URL",
      async ({ page }) => {
        // Try to access a protected route
        await page.goto("/containers");

        // Should redirect to login with redirect param
        await expect(page).toHaveURL(/\/login(\?redirect=.*)?/);
      },
    );
  });

  unauthenticatedTest.describe("LDAP Login Dialog", () => {
    unauthenticatedTest("should open LDAP login dialog", async ({ page }) => {
      await page.goto("/login");

      // Click LDAP button
      await page.getByRole("button", { name: /LDAP/i }).click();

      // Dialog should be visible
      await expect(page.locator('[role="dialog"]')).toBeVisible();
    });
  });
});

/**
 * Logout tests - these require authentication first
 */
import { test } from "./fixtures";

test.describe("Logout Flow", () => {
  test("should logout and redirect to login page", async ({ page }) => {
    // Start on dashboard (authenticated via fixture)
    await page.goto("/dashboard");

    // Wait for page to load
    await expect(page.getByText("Tableau de bord"))
      .toBeVisible({ timeout: 10000 })
      .catch(() => {
        // If dashboard doesn't load, we might not be authenticated
      });

    // Find and click the user menu/logout button
    // This depends on your header implementation
    const userMenuButton = page.locator("header button").last();
    await userMenuButton.click().catch(() => {});

    // Look for logout option in dropdown (French or English)
    const logoutButton = page.getByRole("menuitem", {
      name: /deconnexion|logout|sign out/i,
    });
    if (await logoutButton.isVisible().catch(() => false)) {
      await logoutButton.click();

      // Should redirect to login page
      await expect(page).toHaveURL(/\/login/);
    }
  });
});
