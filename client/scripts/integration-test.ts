#!/usr/bin/env npx tsx
/**
 * Integration Test Script - E2E Data Flow Verification
 *
 * Standalone script to verify API → Database → API flow
 * without requiring a browser or Playwright.
 *
 * Usage: npx tsx scripts/integration-test.ts
 *
 * Cycle 3, Step 4: Integration Testing
 */

const API_IDENTITY = 'http://localhost:3001';
const API_MAIL = 'http://localhost:3012';

const TEST_USER = {
  username: 'admin',
  password: 'admin123',
};

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: string;
}

const results: TestResult[] = [];

async function runTest(
  name: string,
  testFn: () => Promise<void>
): Promise<boolean> {
  const start = Date.now();
  try {
    await testFn();
    const duration = Date.now() - start;
    results.push({ name, passed: true, duration });
    console.log(`  ✅ ${name} (${duration}ms)`);
    return true;
  } catch (error) {
    const duration = Date.now() - start;
    const errorMsg = error instanceof Error ? error.message : String(error);
    results.push({ name, passed: false, duration, error: errorMsg });
    console.log(`  ❌ ${name} (${duration}ms)`);
    console.log(`     Error: ${errorMsg}`);
    return false;
  }
}

async function fetchJSON(url: string, options?: RequestInit): Promise<Response> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  return response;
}

// ============================================================================
// Test Suite
// ============================================================================

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║     SignApps Integration Tests - E2E Data Flow              ║');
  console.log('║     Cycle 3, Step 4: Integration Testing                    ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const startTime = Date.now();
  let accessToken = '';
  let createdAccountId = '';
  let createdLabelId = '';

  // ══════════════════════════════════════════════════════════════════════════
  // Phase 1: Service Health Checks
  // ══════════════════════════════════════════════════════════════════════════
  console.log('📡 Phase 1: Service Health Checks\n');

  await runTest('Identity Service (3001) is reachable', async () => {
    const res = await fetchJSON(`${API_IDENTITY}/health`);
    if (!res.ok) throw new Error(`Status: ${res.status}`);
    const data = await res.json();
    if (data.status !== 'healthy') throw new Error(`Unhealthy: ${JSON.stringify(data)}`);
  });

  await runTest('Mail Service (3012) is reachable', async () => {
    const res = await fetch(`${API_MAIL}/api/v1/mail/accounts`, {
      headers: { Authorization: 'Bearer invalid' },
    });
    // 401 is expected without valid token, but service is up
    if (res.status !== 401) throw new Error(`Unexpected status: ${res.status}`);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Phase 2: Authentication Flow
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n🔐 Phase 2: Authentication Flow\n');

  await runTest('Login with valid credentials returns JWT', async () => {
    const res = await fetchJSON(`${API_IDENTITY}/api/v1/auth/login`, {
      method: 'POST',
      body: JSON.stringify(TEST_USER),
    });
    if (!res.ok) throw new Error(`Status: ${res.status}`);
    const data = await res.json();
    if (!data.access_token) throw new Error('No access_token in response');
    accessToken = data.access_token;
  });

  await runTest('Invalid credentials are rejected (401)', async () => {
    const res = await fetchJSON(`${API_IDENTITY}/api/v1/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ username: 'invalid', password: 'wrong' }),
    });
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  await runTest('Token validation via /auth/me', async () => {
    const res = await fetchJSON(`${API_IDENTITY}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Status: ${res.status}`);
    const user = await res.json();
    if (user.username !== TEST_USER.username) {
      throw new Error(`Username mismatch: ${user.username}`);
    }
  });

  await runTest('Request without token is rejected', async () => {
    const res = await fetchJSON(`${API_IDENTITY}/api/v1/auth/me`);
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Phase 3: Mail Service CRUD Operations
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n📧 Phase 3: Mail Service CRUD Operations\n');

  const testEmailAddress = `integration-test-${Date.now()}@e2e.local`;

  await runTest('CREATE: Insert mail account into database', async () => {
    const accountData = {
      email_address: testEmailAddress,
      display_name: 'Integration Test Account',
      provider: 'custom',
      imap_server: 'imap.test.local',
      imap_port: 993,
      smtp_server: 'smtp.test.local',
      smtp_port: 587,
    };

    const res = await fetchJSON(`${API_MAIL}/api/v1/mail/accounts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(accountData),
    });

    if (res.status !== 201) {
      const text = await res.text();
      throw new Error(`Status: ${res.status}, Body: ${text}`);
    }

    const account = await res.json();
    if (!account.id) throw new Error('No id in response');
    if (account.email_address !== testEmailAddress) {
      throw new Error(`Email mismatch: ${account.email_address}`);
    }
    createdAccountId = account.id;
  });

  await runTest('READ: Select mail account from database', async () => {
    if (!createdAccountId) throw new Error('No account created');

    const res = await fetchJSON(`${API_MAIL}/api/v1/mail/accounts/${createdAccountId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) throw new Error(`Status: ${res.status}`);
    const account = await res.json();
    if (account.id !== createdAccountId) {
      throw new Error(`ID mismatch: ${account.id}`);
    }
  });

  await runTest('LIST: Select all mail accounts from database', async () => {
    const res = await fetchJSON(`${API_MAIL}/api/v1/mail/accounts`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) throw new Error(`Status: ${res.status}`);
    const accounts = await res.json();
    if (!Array.isArray(accounts)) throw new Error('Response is not an array');

    const found = accounts.find((a: { id: string }) => a.id === createdAccountId);
    if (!found) throw new Error('Created account not found in list');
  });

  await runTest('UPDATE: Modify mail account in database', async () => {
    if (!createdAccountId) throw new Error('No account created');

    const res = await fetchJSON(`${API_MAIL}/api/v1/mail/accounts/${createdAccountId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        display_name: 'Updated via Integration Test',
        signature_text: 'E2E Test Signature',
      }),
    });

    if (!res.ok) throw new Error(`Status: ${res.status}`);
    const account = await res.json();
    if (account.display_name !== 'Updated via Integration Test') {
      throw new Error(`Update failed: ${account.display_name}`);
    }
  });

  await runTest('TRIGGER: Verify default folders were created', async () => {
    if (!createdAccountId) throw new Error('No account created');

    const res = await fetchJSON(
      `${API_MAIL}/api/v1/mail/folders?account_id=${createdAccountId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) throw new Error(`Status: ${res.status}`);
    const folders = await res.json();

    const folderTypes = folders.map((f: { folder_type: string }) => f.folder_type);
    const requiredFolders = ['inbox', 'sent', 'drafts', 'trash'];

    for (const ft of requiredFolders) {
      if (!folderTypes.includes(ft)) {
        throw new Error(`Missing folder type: ${ft}`);
      }
    }
  });

  await runTest('CREATE: Insert label into database', async () => {
    if (!createdAccountId) throw new Error('No account created');

    const res = await fetchJSON(`${API_MAIL}/api/v1/mail/labels`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        account_id: createdAccountId,
        name: `Test-Label-${Date.now()}`,
        color: '#3498db',
      }),
    });

    if (res.status !== 201) throw new Error(`Status: ${res.status}`);
    const label = await res.json();
    if (!label.id) throw new Error('No id in response');
    createdLabelId = label.id;
  });

  await runTest('DELETE: Remove label from database', async () => {
    if (!createdLabelId) throw new Error('No label created');

    const res = await fetch(`${API_MAIL}/api/v1/mail/labels/${createdLabelId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.status !== 204) throw new Error(`Status: ${res.status}`);

    // Verify deletion
    const verifyRes = await fetchJSON(`${API_MAIL}/api/v1/mail/labels`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const labels = await verifyRes.json();
    const found = labels.find((l: { id: string }) => l.id === createdLabelId);
    if (found) throw new Error('Label still exists after deletion');
  });

  await runTest('DELETE: Remove mail account (CASCADE)', async () => {
    if (!createdAccountId) throw new Error('No account created');

    const res = await fetch(`${API_MAIL}/api/v1/mail/accounts/${createdAccountId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.status !== 204) throw new Error(`Status: ${res.status}`);

    // Verify deletion
    const verifyRes = await fetch(`${API_MAIL}/api/v1/mail/accounts/${createdAccountId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (verifyRes.status !== 404) {
      throw new Error(`Expected 404 after deletion, got ${verifyRes.status}`);
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Phase 4: Statistics & Aggregations
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n📊 Phase 4: Statistics & Aggregations\n');

  await runTest('Mail statistics endpoint returns data', async () => {
    const res = await fetchJSON(`${API_MAIL}/api/v1/mail/stats`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) throw new Error(`Status: ${res.status}`);
    const stats = await res.json();
    if (typeof stats.total_emails !== 'number') {
      throw new Error('Missing total_emails in stats');
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Summary
  // ══════════════════════════════════════════════════════════════════════════
  const totalDuration = Date.now() - startTime;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                     TEST SUMMARY                             ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  console.log(`  Total Tests:  ${results.length}`);
  console.log(`  Passed:       ${passed} ✅`);
  console.log(`  Failed:       ${failed} ❌`);
  console.log(`  Duration:     ${totalDuration}ms`);
  console.log(`  Success Rate: ${((passed / results.length) * 100).toFixed(1)}%\n`);

  if (failed > 0) {
    console.log('Failed Tests:');
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  ❌ ${r.name}`);
        console.log(`     ${r.error}`);
      });
    process.exit(1);
  }

  console.log('✅ All integration tests passed!\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
