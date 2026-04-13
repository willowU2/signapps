import { test, expect, testData } from "./fixtures";

/**
 * Integration Tests - E2E Data Flow Verification
 *
 * Verifies the complete data flow: UI -> API -> Database -> API -> UI
 * Tests that data is correctly persisted and retrieved through all layers.
 *
 * These tests require the Identity service (port 3001) and Mail service
 * (port 3012) to be running. They are skipped when services are unavailable.
 *
 * Cycle 3, Step 4: Integration Testing
 */

const API_IDENTITY_URL = "http://localhost:3001";
const API_MAIL_URL = "http://localhost:3012";

/**
 * Check if a service is reachable by hitting its health endpoint.
 */
async function isServiceUp(request: any, baseUrl: string): Promise<boolean> {
  try {
    const response = await request.get(`${baseUrl}/health`, { timeout: 5000 });
    return response.status() === 200;
  } catch {
    return false;
  }
}

test.describe("Integration Data Flow Tests", () => {
  let identityUp = false;
  let mailUp = false;

  test.beforeAll(async ({ request }) => {
    identityUp = await isServiceUp(request, API_IDENTITY_URL);
    mailUp = await isServiceUp(request, API_MAIL_URL);
  });

  test.describe("Identity Service - Authentication Flow", () => {
    test("should authenticate and receive valid JWT token", async ({
      request,
    }) => {
      test.skip(!identityUp, "requires Identity service (port 3001)");
      const response = await request.post(
        `${API_IDENTITY_URL}/api/v1/auth/login`,
        {
          data: {
            username: testData.validUser.username,
            password: testData.validUser.password,
          },
        },
      );

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body).toHaveProperty("access_token");
      expect(body).toHaveProperty("refresh_token");
      expect(body.token_type).toBe("Bearer");
    });

    test("should validate token with /auth/me endpoint", async ({
      request,
    }) => {
      test.skip(!identityUp, "requires Identity service (port 3001)");
      const loginResponse = await request.post(
        `${API_IDENTITY_URL}/api/v1/auth/login`,
        {
          data: {
            username: testData.validUser.username,
            password: testData.validUser.password,
          },
        },
      );

      const { access_token } = await loginResponse.json();

      const meResponse = await request.get(
        `${API_IDENTITY_URL}/api/v1/auth/me`,
        {
          headers: {
            Authorization: `Bearer ${access_token}`,
          },
        },
      );

      expect(meResponse.status()).toBe(200);

      const user = await meResponse.json();
      expect(user).toHaveProperty("id");
      expect(user).toHaveProperty("username");
      expect(user.username).toBe(testData.validUser.username);
    });

    test("should reject invalid credentials", async ({ request }) => {
      test.skip(!identityUp, "requires Identity service (port 3001)");
      const response = await request.post(
        `${API_IDENTITY_URL}/api/v1/auth/login`,
        {
          data: {
            username: testData.invalidUser.username,
            password: testData.invalidUser.password,
          },
        },
      );

      expect(response.status()).toBe(401);
    });

    test("should reject requests without token", async ({ request }) => {
      test.skip(!identityUp, "requires Identity service (port 3001)");
      // Note: the default request context carries auth state from the fixture.
      // Use a direct fetch to test unauthenticated access.
      const response = await fetch(`${API_IDENTITY_URL}/api/v1/auth/me`);
      expect(response.status).toBe(401);
    });
  });

  test.describe("Mail Service - CRUD Data Flow", () => {
    let accessToken: string;
    let createdAccountId: string | null = null;
    let createdLabelId: string | null = null;

    test.beforeAll(async ({ request }) => {
      if (!identityUp || !mailUp) return;
      const response = await request.post(
        `${API_IDENTITY_URL}/api/v1/auth/login`,
        {
          data: {
            username: testData.validUser.username,
            password: testData.validUser.password,
          },
        },
      );

      const body = await response.json();
      accessToken = body.access_token;
    });

    test("should create mail account (INSERT to database)", async ({
      request,
    }) => {
      test.skip(
        !identityUp || !mailUp,
        "requires Identity service (port 3001) and Mail service (port 3012)",
      );
      const accountData = {
        email_address: `test-e2e-${Date.now()}@integration.test`,
        display_name: "E2E Integration Test Account",
        provider: "custom",
        imap_server: "imap.integration.test",
        imap_port: 993,
        smtp_server: "smtp.integration.test",
        smtp_port: 587,
      };

      const response = await request.post(
        `${API_MAIL_URL}/api/v1/mail/accounts`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          data: accountData,
        },
      );

      expect(response.status()).toBe(201);

      const account = await response.json();
      expect(account).toHaveProperty("id");
      expect(account.email_address).toBe(accountData.email_address);
      expect(account.display_name).toBe(accountData.display_name);
      expect(account.provider).toBe(accountData.provider);
      expect(account.status).toBe("active");

      createdAccountId = account.id;
    });

    test("should retrieve mail account (SELECT from database)", async ({
      request,
    }) => {
      test.skip(
        !identityUp || !mailUp,
        "requires Identity service (port 3001) and Mail service (port 3012)",
      );
      test.skip(!createdAccountId, "No account was created in previous test");

      const response = await request.get(
        `${API_MAIL_URL}/api/v1/mail/accounts/${createdAccountId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      expect(response.status()).toBe(200);

      const account = await response.json();
      expect(account.id).toBe(createdAccountId);
      expect(account.email_address).toContain("test-e2e-");
    });

    test("should list mail accounts (SELECT all from database)", async ({
      request,
    }) => {
      test.skip(
        !identityUp || !mailUp,
        "requires Identity service (port 3001) and Mail service (port 3012)",
      );
      const response = await request.get(
        `${API_MAIL_URL}/api/v1/mail/accounts`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      expect(response.status()).toBe(200);

      const accounts = await response.json();
      expect(Array.isArray(accounts)).toBe(true);

      if (createdAccountId) {
        const testAccount = accounts.find(
          (a: { id: string }) => a.id === createdAccountId,
        );
        expect(testAccount).toBeTruthy();
      }
    });

    test("should update mail account (UPDATE in database)", async ({
      request,
    }) => {
      test.skip(
        !identityUp || !mailUp,
        "requires Identity service (port 3001) and Mail service (port 3012)",
      );
      test.skip(!createdAccountId, "No account was created in previous test");

      const updateData = {
        display_name: "Updated E2E Integration Test",
        signature_text: "Sent from E2E Integration Tests",
      };

      const response = await request.patch(
        `${API_MAIL_URL}/api/v1/mail/accounts/${createdAccountId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          data: updateData,
        },
      );

      expect(response.status()).toBe(200);

      const account = await response.json();
      expect(account.display_name).toBe(updateData.display_name);
      expect(account.signature_text).toBe(updateData.signature_text);
    });

    test("should verify default folders were created (trigger verification)", async ({
      request,
    }) => {
      test.skip(
        !identityUp || !mailUp,
        "requires Identity service (port 3001) and Mail service (port 3012)",
      );
      test.skip(!createdAccountId, "No account was created in previous test");

      const response = await request.get(
        `${API_MAIL_URL}/api/v1/mail/folders?account_id=${createdAccountId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      expect(response.status()).toBe(200);

      const folders = await response.json();
      expect(Array.isArray(folders)).toBe(true);

      const folderTypes = folders.map(
        (f: { folder_type: string }) => f.folder_type,
      );
      expect(folderTypes).toContain("inbox");
      expect(folderTypes).toContain("sent");
      expect(folderTypes).toContain("drafts");
      expect(folderTypes).toContain("trash");
    });

    test("should create custom label (INSERT label)", async ({ request }) => {
      test.skip(
        !identityUp || !mailUp,
        "requires Identity service (port 3001) and Mail service (port 3012)",
      );
      test.skip(!createdAccountId, "No account was created in previous test");

      const labelData = {
        account_id: createdAccountId,
        name: `E2E-Test-Label-${Date.now()}`,
        color: "#FF5733",
      };

      const response = await request.post(
        `${API_MAIL_URL}/api/v1/mail/labels`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          data: labelData,
        },
      );

      expect(response.status()).toBe(201);

      const label = await response.json();
      expect(label).toHaveProperty("id");
      expect(label.name).toBe(labelData.name);
      expect(label.color).toBe(labelData.color);

      createdLabelId = label.id;
    });

    test("should delete label (DELETE from database)", async ({ request }) => {
      test.skip(
        !identityUp || !mailUp,
        "requires Identity service (port 3001) and Mail service (port 3012)",
      );
      test.skip(!createdLabelId, "No label was created in previous test");

      const response = await request.delete(
        `${API_MAIL_URL}/api/v1/mail/labels/${createdLabelId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      expect(response.status()).toBe(204);

      const verifyResponse = await request.get(
        `${API_MAIL_URL}/api/v1/mail/labels`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      const labels = await verifyResponse.json();
      const deletedLabel = labels.find(
        (l: { id: string }) => l.id === createdLabelId,
      );
      expect(deletedLabel).toBeUndefined();
    });

    test("should delete mail account (DELETE cascade)", async ({ request }) => {
      test.skip(
        !identityUp || !mailUp,
        "requires Identity service (port 3001) and Mail service (port 3012)",
      );
      test.skip(!createdAccountId, "No account was created in previous test");

      const response = await request.delete(
        `${API_MAIL_URL}/api/v1/mail/accounts/${createdAccountId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      expect(response.status()).toBe(204);

      const verifyResponse = await request.get(
        `${API_MAIL_URL}/api/v1/mail/accounts/${createdAccountId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      expect(verifyResponse.status()).toBe(404);
    });

    test("should get mail statistics", async ({ request }) => {
      test.skip(
        !identityUp || !mailUp,
        "requires Identity service (port 3001) and Mail service (port 3012)",
      );
      const response = await request.get(`${API_MAIL_URL}/api/v1/mail/stats`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.status()).toBe(200);

      const stats = await response.json();
      expect(stats).toHaveProperty("total_emails");
      expect(stats).toHaveProperty("unread_count");
    });
  });

  test.describe("UI to API Integration", () => {
    test("should login via UI and verify session is persisted", async ({
      page,
    }) => {
      test.skip(!identityUp, "requires Identity service (port 3001)");
      await page.context().clearCookies();

      await page.goto("/login");
      // Wait for the login form to fully render (may take time if dev server is compiling)
      await page
        .locator("#username")
        .waitFor({ state: "visible", timeout: 30000 });
      await page.waitForTimeout(500);

      // Fill credentials using id-based selectors
      await page.locator("#username").fill(testData.validUser.username);
      await page.locator("#password").fill(testData.validUser.password);

      // Click login button
      await page
        .getByRole("button", { name: /se connecter|connexion|sign in/i })
        .click();

      // After login, the app may:
      // - redirect to /dashboard (single org)
      // - show context picker on /login page (multi-org, URL stays /login)
      // - redirect to /login/verify (MFA)
      // Wait for the page to change (loading spinner, context picker, or dashboard)
      await page.waitForTimeout(5000);

      // If context picker is shown, pick the first org
      const hasContextPicker = await page
        .getByText(/choisissez votre contexte/i)
        .isVisible({ timeout: 5000 })
        .catch(() => false);
      if (hasContextPicker) {
        await page.getByText("Default").first().click();
        await page.waitForTimeout(5000);
      }

      // Verify auth tokens are stored (snake_case keys used by the app)
      const storage = await page.evaluate(() => {
        return {
          accessToken:
            localStorage.getItem("access_token") ||
            localStorage.getItem("accessToken"),
          refreshToken:
            localStorage.getItem("refresh_token") ||
            localStorage.getItem("refreshToken"),
        };
      });

      expect(storage.accessToken || storage.refreshToken).toBeTruthy();
    });

    test("should navigate to mail and verify data loads from API", async ({
      page,
    }) => {
      test.skip(
        !identityUp || !mailUp,
        "requires Identity service (port 3001) and Mail service (port 3012)",
      );
      await page.goto("/mail");

      await page.waitForSelector("text=Nouveau message", { timeout: 10000 });

      await expect(page.getByText("Boîte de réception")).toBeVisible();
      await expect(page.getByText("Brouillons")).toBeVisible();
      await expect(page.getByText("Messages envoyés")).toBeVisible();

      const composeButton = page.getByRole("button", {
        name: /nouveau message/i,
      });
      await expect(composeButton).toBeVisible();
      await expect(composeButton).toBeEnabled();
    });
  });

  test.describe("Health Check Endpoints", () => {
    test("should verify Identity service is healthy", async ({ request }) => {
      test.skip(!identityUp, "requires Identity service (port 3001)");
      const response = await request.get(`${API_IDENTITY_URL}/health`);

      expect(response.status()).toBe(200);

      const health = await response.json();
      expect(health.status).toBe("healthy");
    });
  });
});
