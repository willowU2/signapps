import { test, expect, testData } from './fixtures';

/**
 * Integration Tests - E2E Data Flow Verification
 *
 * Verifies the complete data flow: UI → API → Database → API → UI
 * Tests that data is correctly persisted and retrieved through all layers.
 *
 * Cycle 3, Step 4: Integration Testing
 */

const API_IDENTITY_URL = 'http://localhost:3001';
const API_MAIL_URL = 'http://localhost:3012';

test.describe('Integration Data Flow Tests', () => {
  let authToken: string | null = null;

  test.describe('Identity Service - Authentication Flow', () => {
    test('should authenticate and receive valid JWT token', async ({ request }) => {
      // Direct API call to test backend authentication
      const response = await request.post(`${API_IDENTITY_URL}/api/v1/auth/login`, {
        data: {
          username: testData.validUser.username,
          password: testData.validUser.password,
        },
      });

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body).toHaveProperty('access_token');
      expect(body).toHaveProperty('refresh_token');
      expect(body.token_type).toBe('Bearer');

      authToken = body.access_token;
    });

    test('should validate token with /auth/me endpoint', async ({ request }) => {
      // First login to get token
      const loginResponse = await request.post(`${API_IDENTITY_URL}/api/v1/auth/login`, {
        data: {
          username: testData.validUser.username,
          password: testData.validUser.password,
        },
      });

      const { access_token } = await loginResponse.json();

      // Validate token
      const meResponse = await request.get(`${API_IDENTITY_URL}/api/v1/auth/me`, {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      });

      expect(meResponse.status()).toBe(200);

      const user = await meResponse.json();
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('username');
      expect(user.username).toBe(testData.validUser.username);
    });

    test('should reject invalid credentials', async ({ request }) => {
      const response = await request.post(`${API_IDENTITY_URL}/api/v1/auth/login`, {
        data: {
          username: testData.invalidUser.username,
          password: testData.invalidUser.password,
        },
      });

      expect(response.status()).toBe(401);
    });

    test('should reject requests without token', async ({ request }) => {
      const response = await request.get(`${API_IDENTITY_URL}/api/v1/auth/me`);

      expect(response.status()).toBe(401);
    });
  });

  test.describe('Mail Service - CRUD Data Flow', () => {
    let accessToken: string;
    let createdAccountId: string | null = null;
    let createdLabelId: string | null = null;

    test.beforeAll(async ({ request }) => {
      // Authenticate once for all mail tests
      const response = await request.post(`${API_IDENTITY_URL}/api/v1/auth/login`, {
        data: {
          username: testData.validUser.username,
          password: testData.validUser.password,
        },
      });

      const body = await response.json();
      accessToken = body.access_token;
    });

    test('should create mail account (INSERT to database)', async ({ request }) => {
      const accountData = {
        email_address: `test-e2e-${Date.now()}@integration.test`,
        display_name: 'E2E Integration Test Account',
        provider: 'custom',
        imap_server: 'imap.integration.test',
        imap_port: 993,
        smtp_server: 'smtp.integration.test',
        smtp_port: 587,
      };

      const response = await request.post(`${API_MAIL_URL}/api/v1/mail/accounts`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        data: accountData,
      });

      expect(response.status()).toBe(201);

      const account = await response.json();
      expect(account).toHaveProperty('id');
      expect(account.email_address).toBe(accountData.email_address);
      expect(account.display_name).toBe(accountData.display_name);
      expect(account.provider).toBe(accountData.provider);
      expect(account.status).toBe('active');

      createdAccountId = account.id;
    });

    test('should retrieve mail account (SELECT from database)', async ({ request }) => {
      // Skip if no account was created
      test.skip(!createdAccountId, 'No account was created in previous test');

      const response = await request.get(`${API_MAIL_URL}/api/v1/mail/accounts/${createdAccountId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.status()).toBe(200);

      const account = await response.json();
      expect(account.id).toBe(createdAccountId);
      expect(account.email_address).toContain('test-e2e-');
    });

    test('should list mail accounts (SELECT all from database)', async ({ request }) => {
      const response = await request.get(`${API_MAIL_URL}/api/v1/mail/accounts`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.status()).toBe(200);

      const accounts = await response.json();
      expect(Array.isArray(accounts)).toBe(true);

      // Should contain our test account
      if (createdAccountId) {
        const testAccount = accounts.find((a: { id: string }) => a.id === createdAccountId);
        expect(testAccount).toBeTruthy();
      }
    });

    test('should update mail account (UPDATE in database)', async ({ request }) => {
      test.skip(!createdAccountId, 'No account was created in previous test');

      const updateData = {
        display_name: 'Updated E2E Integration Test',
        signature_text: 'Sent from E2E Integration Tests',
      };

      const response = await request.patch(`${API_MAIL_URL}/api/v1/mail/accounts/${createdAccountId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        data: updateData,
      });

      expect(response.status()).toBe(200);

      const account = await response.json();
      expect(account.display_name).toBe(updateData.display_name);
      expect(account.signature_text).toBe(updateData.signature_text);
    });

    test('should verify default folders were created (trigger verification)', async ({ request }) => {
      test.skip(!createdAccountId, 'No account was created in previous test');

      const response = await request.get(`${API_MAIL_URL}/api/v1/mail/folders?account_id=${createdAccountId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.status()).toBe(200);

      const folders = await response.json();
      expect(Array.isArray(folders)).toBe(true);

      // Database trigger should have created default folders
      const folderTypes = folders.map((f: { folder_type: string }) => f.folder_type);
      expect(folderTypes).toContain('inbox');
      expect(folderTypes).toContain('sent');
      expect(folderTypes).toContain('drafts');
      expect(folderTypes).toContain('trash');
    });

    test('should create custom label (INSERT label)', async ({ request }) => {
      test.skip(!createdAccountId, 'No account was created in previous test');

      const labelData = {
        account_id: createdAccountId,
        name: `E2E-Test-Label-${Date.now()}`,
        color: '#FF5733',
      };

      const response = await request.post(`${API_MAIL_URL}/api/v1/mail/labels`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        data: labelData,
      });

      expect(response.status()).toBe(201);

      const label = await response.json();
      expect(label).toHaveProperty('id');
      expect(label.name).toBe(labelData.name);
      expect(label.color).toBe(labelData.color);

      createdLabelId = label.id;
    });

    test('should delete label (DELETE from database)', async ({ request }) => {
      test.skip(!createdLabelId, 'No label was created in previous test');

      const response = await request.delete(`${API_MAIL_URL}/api/v1/mail/labels/${createdLabelId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.status()).toBe(204);

      // Verify deletion
      const verifyResponse = await request.get(`${API_MAIL_URL}/api/v1/mail/labels`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const labels = await verifyResponse.json();
      const deletedLabel = labels.find((l: { id: string }) => l.id === createdLabelId);
      expect(deletedLabel).toBeUndefined();
    });

    test('should delete mail account (DELETE cascade)', async ({ request }) => {
      test.skip(!createdAccountId, 'No account was created in previous test');

      const response = await request.delete(`${API_MAIL_URL}/api/v1/mail/accounts/${createdAccountId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.status()).toBe(204);

      // Verify deletion
      const verifyResponse = await request.get(`${API_MAIL_URL}/api/v1/mail/accounts/${createdAccountId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      expect(verifyResponse.status()).toBe(404);
    });

    test('should get mail statistics', async ({ request }) => {
      const response = await request.get(`${API_MAIL_URL}/api/v1/mail/stats`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.status()).toBe(200);

      const stats = await response.json();
      expect(stats).toHaveProperty('total_emails');
      expect(stats).toHaveProperty('unread_count');
    });
  });

  test.describe('UI to API Integration', () => {
    test('should login via UI and verify session is persisted', async ({ page }) => {
      // Clear any existing auth state
      await page.context().clearCookies();

      await page.goto('/login');

      // Fill login form
      await page.getByLabel('Username').fill(testData.validUser.username);
      await page.getByLabel('Password').fill(testData.validUser.password);

      // Submit
      await page.getByRole('button', { name: /sign in/i }).click();

      // Wait for redirect to dashboard
      await page.waitForURL(/\/(dashboard|login\/verify)/, { timeout: 15000 });

      // Verify localStorage has auth token
      const storage = await page.evaluate(() => {
        return {
          accessToken: localStorage.getItem('accessToken'),
          refreshToken: localStorage.getItem('refreshToken'),
        };
      });

      // Token should be stored
      expect(storage.accessToken || storage.refreshToken).toBeTruthy();
    });

    test('should navigate to mail and verify data loads from API', async ({ page }) => {
      await page.goto('/mail');

      // Wait for mail interface to load
      await page.waitForSelector('text=Nouveau message', { timeout: 10000 });

      // Verify navigation elements loaded (data from API/store)
      await expect(page.getByText('Boîte de réception')).toBeVisible();
      await expect(page.getByText('Brouillons')).toBeVisible();
      await expect(page.getByText('Messages envoyés')).toBeVisible();

      // Verify compose button is functional
      const composeButton = page.getByRole('button', { name: /nouveau message/i });
      await expect(composeButton).toBeVisible();
      await expect(composeButton).toBeEnabled();
    });
  });

  test.describe('Health Check Endpoints', () => {
    test('should verify Identity service is healthy', async ({ request }) => {
      const response = await request.get(`${API_IDENTITY_URL}/health`);

      expect(response.status()).toBe(200);

      const health = await response.json();
      expect(health.status).toBe('healthy');
    });
  });
});
