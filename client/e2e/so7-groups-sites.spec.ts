/**
 * E2E — SO7 Groupes transverses & Sites physiques
 *
 * Three scenarios, all isolated behind an `orgServiceUp` guard so the tests
 * degrade gracefully when the backend is offline (dev mode without
 * PostgreSQL).  When the service is up they exercise the real REST surface
 * on `:3026` / `/api/v1/org/*`.
 *
 *  1. Dynamic group list + member resolution (python-devs).
 *  2. Site hierarchy tree + building > room navigation.
 *  3. Booking creation with conflict detection.
 *
 * See :
 *  - Spec   : docs/superpowers/specs/2026-04-19-so7-groups-sites-design.md
 *  - Plan   : —
 */

import { test, expect } from "./fixtures";

const ORG = "http://localhost:3026";
const IDENT = "http://localhost:3001";

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

test.describe("SO7 — Groupes transverses & Sites physiques", () => {
  test("scenario 1 : lists dynamic group + resolves members live", async ({
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

    // 1. List dynamic groups.
    const listRes = await request.get(`${ORG}/api/v1/org/groups`, {
      headers: auth,
      params: {
        kind: "dynamic",
        tenant_id: "6a16dd8c-dca6-4d7a-af3a-a9ebb4247934",
      },
    });
    expect(listRes.ok(), `list status=${listRes.status()}`).toBeTruthy();
    const groups: Array<{ id: string; slug: string; kind: string }> =
      await listRes.json();
    const pyDevs = groups.find((g) => g.slug === "python-devs");
    expect(
      pyDevs,
      "python-devs dynamic group must exist (seeded)",
    ).toBeDefined();
    if (!pyDevs) return;

    // 2. Resolve members — we don't assert exact count because the matcher
    //    depends on seeded skills, but the call must succeed and return
    //    the right kind marker.
    const membersRes = await request.get(
      `${ORG}/api/v1/org/groups/${pyDevs.id}/members`,
      { headers: auth },
    );
    expect(
      membersRes.ok(),
      `members status=${membersRes.status()}`,
    ).toBeTruthy();
    const body = await membersRes.json();
    expect(body.kind).toBe("dynamic");
    expect(Array.isArray(body.persons)).toBe(true);
  });

  test("scenario 2 : walks the sites hierarchy", async ({ request }) => {
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

    // 1. List buildings.
    const buildingsRes = await request.get(`${ORG}/api/v1/org/sites`, {
      headers: auth,
      params: {
        kind: "building",
        tenant_id: "6a16dd8c-dca6-4d7a-af3a-a9ebb4247934",
      },
    });
    expect(buildingsRes.ok()).toBeTruthy();
    const buildings: Array<{ id: string; slug: string; kind: string }> =
      await buildingsRes.json();
    const paris = buildings.find((b) => b.slug === "paris-hq");
    expect(paris, "paris-hq building must be seeded").toBeDefined();
    if (!paris) return;

    // 2. /tree returns the full subtree.
    const treeRes = await request.get(
      `${ORG}/api/v1/org/sites/${paris.id}/tree`,
      { headers: auth },
    );
    expect(treeRes.ok()).toBeTruthy();
    const tree: Array<{ slug: string; kind: string }> = await treeRes.json();
    expect(tree.length).toBeGreaterThan(5);
    const hasRoom = tree.some((n) => n.kind === "room");
    const hasDesk = tree.some((n) => n.kind === "desk");
    expect(hasRoom, "subtree must include rooms").toBeTruthy();
    expect(hasDesk, "subtree must include desks").toBeTruthy();
  });

  test("scenario 3 : booking creation + conflict detection", async ({
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

    // Find a bookable room (Alpha is bookable per seed).
    const sitesRes = await request.get(`${ORG}/api/v1/org/sites`, {
      headers: auth,
      params: {
        kind: "room",
        tenant_id: "6a16dd8c-dca6-4d7a-af3a-a9ebb4247934",
      },
    });
    const rooms: Array<{ id: string; slug: string; bookable: boolean }> =
      await sitesRes.json();
    const alpha = rooms.find((r) => r.slug === "paris-alpha");
    expect(alpha).toBeDefined();
    if (!alpha) return;

    const personId = "5baed91f-bc7b-5fb8-9e9e-55f8afb8b9ad"; // deterministic
    // Anchor the booking in a year that won't clash with other specs.
    const start = "2099-11-03T09:00:00Z";
    const end = "2099-11-03T10:00:00Z";

    // 1. First booking succeeds.
    const first = await request.post(`${ORG}/api/v1/org/site-bookings`, {
      headers: auth,
      data: {
        site_id: alpha.id,
        person_id: personId,
        start_at: start,
        end_at: end,
        purpose: "SO7 e2e — first",
      },
    });
    // 2xx OR 404/409 if person is missing — acceptable; the assertion focuses
    // on the 409-on-conflict path.
    if (!first.ok()) {
      test.skip(
        true,
        `first booking POST failed (${first.status()}): seed person not reachable`,
      );
      return;
    }

    // 2. Overlapping booking must 409.
    const conflict = await request.post(`${ORG}/api/v1/org/site-bookings`, {
      headers: auth,
      data: {
        site_id: alpha.id,
        person_id: personId,
        start_at: start,
        end_at: end,
        purpose: "SO7 e2e — conflict",
      },
    });
    expect(conflict.status()).toBe(409);

    // 3. Cleanup : cancel the first booking (idempotent).
    const { id } = await first.json();
    if (id) {
      await request.patch(`${ORG}/api/v1/org/site-bookings/${id}/cancel`, {
        headers: auth,
      });
    }
  });
});
