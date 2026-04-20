/**
 * E2E — SO8 Catalogue unifié de ressources tangibles.
 *
 * Three scenarios, all gated behind `orgServiceUp` so the suite stays green
 * when the backend is offline. When the service is up they exercise the real
 * REST surface on `:3026` / `/api/v1/org/resources/*`.
 *
 *  1. Create a new resource → auto-generated QR token is a 16-hex string.
 *  2. State machine — invalid transition is refused, valid one succeeds and
 *     adds a status_log row.
 *  3. `/me/inventory` lists resources assigned to the authenticated user.
 *
 * See :
 *   - Spec : docs/superpowers/specs/2026-04-19-so8-resources-catalog-design.md
 */

import { test, expect } from "./fixtures";

const ORG = "http://localhost:3026";
const IDENT = "http://localhost:3001";
const TENANT = "6a16dd8c-dca6-4d7a-af3a-a9ebb4247934";

async function loginAdmin(
  request: import("@playwright/test").APIRequestContext,
) {
  const loginRes = await request.post(`${IDENT}/api/v1/auth/login`, {
    data: { username: "admin", password: "admin" },
  });
  if (!loginRes.ok()) return null;
  const loginJson = await loginRes.json();
  let token: string = loginJson.access_token;
  if (loginJson.requires_context && loginJson.contexts?.length > 0) {
    const ctxRes = await request.post(`${IDENT}/api/v1/auth/select-context`, {
      data: { context_id: loginJson.contexts[0].id },
      headers: { Authorization: `Bearer ${token}` },
    });
    if (ctxRes.ok()) {
      token = (await ctxRes.json()).access_token;
    }
  }
  return token;
}

async function orgServiceUp(
  request: import("@playwright/test").APIRequestContext,
) {
  try {
    const res = await request.get(`${ORG}/health`, { timeout: 2000 });
    return res.ok();
  } catch {
    return false;
  }
}

test.describe("SO8 — Resources catalog", () => {
  test("scenario 1 : create resource → QR token auto-generated (16 hex)", async ({
    request,
  }) => {
    if (!(await orgServiceUp(request))) {
      test.skip(true, "org service offline");
      return;
    }
    const token = await loginAdmin(request);
    if (!token) {
      test.skip(true, "admin login failed");
      return;
    }
    const auth = { Authorization: `Bearer ${token}` };
    const slug = `e2e-res-${Date.now()}`;

    const createRes = await request.post(`${ORG}/api/v1/org/resources`, {
      headers: auth,
      data: {
        tenant_id: TENANT,
        kind: "other",
        slug,
        name: "E2E test resource",
        description: "Created by Playwright SO8 test",
      },
    });
    expect(createRes.ok(), `create status=${createRes.status()}`).toBeTruthy();
    const created = await createRes.json();
    expect(created.slug).toBe(slug);
    expect(created.qr_token).toMatch(/^[0-9a-f]{16}$/);

    // Public QR redirect must 302 somewhere.
    const publicRes = await request.get(
      `${ORG}/public/resource/${created.qr_token}`,
      { maxRedirects: 0 },
    );
    // 302 redirect is considered "ok" by Playwright when maxRedirects=0 & followRedirects=false.
    expect([200, 302, 301]).toContain(publicRes.status());

    // Cleanup.
    await request.delete(`${ORG}/api/v1/org/resources/${created.id}`, {
      headers: auth,
    });
  });

  test("scenario 2 : invalid transition refused, valid one recorded in history", async ({
    request,
  }) => {
    if (!(await orgServiceUp(request))) {
      test.skip(true, "org service offline");
      return;
    }
    const token = await loginAdmin(request);
    if (!token) {
      test.skip(true, "admin login failed");
      return;
    }
    const auth = { Authorization: `Bearer ${token}` };

    // Find any active resource for the tenant.
    const listRes = await request.get(`${ORG}/api/v1/org/resources`, {
      headers: auth,
      params: { tenant_id: TENANT, status: "active" },
    });
    expect(listRes.ok(), `list status=${listRes.status()}`).toBeTruthy();
    const rows: Array<{ id: string; status: string }> = await listRes.json();
    if (rows.length === 0) {
      test.skip(true, "no active resource available");
      return;
    }
    const id = rows[0].id;

    // Invalid transition: active → ordered (not allowed).
    const badRes = await request.post(
      `${ORG}/api/v1/org/resources/${id}/status`,
      {
        headers: auth,
        data: { to: "ordered" },
      },
    );
    expect(
      badRes.status(),
      `expected 400 on invalid transition, got ${badRes.status()}`,
    ).toBe(400);

    // Valid transition: active → in_maintenance.
    const goodRes = await request.post(
      `${ORG}/api/v1/org/resources/${id}/status`,
      {
        headers: auth,
        data: { to: "in_maintenance", reason: "E2E test" },
      },
    );
    expect(
      goodRes.ok(),
      `valid transition status=${goodRes.status()}`,
    ).toBeTruthy();
    const updated = await goodRes.json();
    expect(updated.status).toBe("in_maintenance");

    // History must carry the new row.
    const histRes = await request.get(
      `${ORG}/api/v1/org/resources/${id}/history`,
      { headers: auth },
    );
    expect(histRes.ok()).toBeTruthy();
    const history: Array<{ from_status?: string | null; to_status: string }> =
      await histRes.json();
    expect(history.length).toBeGreaterThan(0);
    expect(history[0].to_status).toBe("in_maintenance");

    // Restore: in_maintenance → active.
    await request.post(`${ORG}/api/v1/org/resources/${id}/status`, {
      headers: auth,
      data: { to: "active", reason: "E2E restore" },
    });
  });

  test("scenario 3 : /me/inventory returns user's resources grouped by kind", async ({
    request,
  }) => {
    if (!(await orgServiceUp(request))) {
      test.skip(true, "org service offline");
      return;
    }
    const token = await loginAdmin(request);
    if (!token) {
      test.skip(true, "admin login failed");
      return;
    }
    const auth = { Authorization: `Bearer ${token}` };

    const res = await request.get(`${ORG}/api/v1/me/inventory`, {
      headers: auth,
    });
    expect(res.ok(), `inventory status=${res.status()}`).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty("by_kind");
    expect(body).toHaveProperty("total");
    expect(Array.isArray(body.by_kind)).toBe(true);
    // The admin user may or may not have resources assigned as `person_id`
    // depending on how the seed runs — we just assert the shape.
    for (const bucket of body.by_kind) {
      expect(bucket).toHaveProperty("kind");
      expect(bucket).toHaveProperty("resources");
      expect(Array.isArray(bucket.resources)).toBe(true);
    }
  });
});
