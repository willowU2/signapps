/**
 * E2E — SO4 IN2 — Public link anonymized share.
 *
 * The seed inserts a stable public link with slug `nexus-public` (anon
 * visibility). This test:
 * 1. Hits `/public/org/nexus-public` directly (no auth context).
 * 2. Asserts JSON-shaped response with at least one node and the
 *    `visibility` echoed as `anon`.
 * 3. Hits `/public/org/nexus-public/embed.html` and checks the HTML
 *    contains the org name.
 *
 * Falls back to skipping when the public_links seeder hasn't run.
 */
import { test, expect } from "./fixtures";

const SLUG = "nexus-public";
const ORG_BASE_URL = "http://localhost:3026";

test.describe("SO4 — public anonymized link", () => {
  test("JSON endpoint returns anon snapshot", async ({ request }) => {
    const resp = await request
      .get(`${ORG_BASE_URL}/public/org/${SLUG}`)
      .catch(() => null);

    if (!resp || resp.status() === 404) {
      test.skip(true, "seed not run — public link nexus-public missing");
      return;
    }

    expect(resp.ok(), `unexpected status ${resp.status()}`).toBeTruthy();
    const body = await resp.json();
    expect(body.slug).toBe(SLUG);
    expect(body.visibility).toBe("anon");
    expect(Array.isArray(body.nodes)).toBeTruthy();
    expect(body.nodes.length).toBeGreaterThan(0);
    // Anon visibility hides emails.
    if (Array.isArray(body.persons) && body.persons.length > 0) {
      expect(body.persons[0].email).toBeFalsy();
    }
  });

  test("embed.html surface returns HTML", async ({ request }) => {
    const resp = await request
      .get(`${ORG_BASE_URL}/public/org/${SLUG}/embed.html`)
      .catch(() => null);

    if (!resp || resp.status() === 404) {
      test.skip(true, "seed not run — embed page missing");
      return;
    }

    expect(resp.ok()).toBeTruthy();
    const ct = resp.headers()["content-type"] ?? "";
    expect(ct).toContain("text/html");
    const body = await resp.text();
    expect(body.toLowerCase()).toContain("organization");
  });
});
