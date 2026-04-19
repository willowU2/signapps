/**
 * E2E — SO3 skills smoke test.
 *
 * Vérifie que :
 * 1. `GET /api/v1/org/skills` retourne >=40 skills (catalog global seedé).
 * 2. Catégories tech/soft/language/domain toutes présentes.
 */
import { test, expect } from "./fixtures";

test.describe("SO3 — skills catalog", () => {
  test("global catalog has >=40 skills across 4 categories", async ({
    request,
  }) => {
    const res = await request
      .get("http://localhost:3026/api/v1/org/skills")
      .catch(() => null);
    if (!res || !res.ok()) {
      test.skip(true, "signapps-org not reachable — backend required");
    }
    const skills = (await res!.json()) as Array<{ category: string }>;
    expect(skills.length).toBeGreaterThanOrEqual(40);
    const categories = new Set(skills.map((s) => s.category));
    expect(categories.has("tech")).toBe(true);
    expect(categories.has("soft")).toBe(true);
    expect(categories.has("language")).toBe(true);
    expect(categories.has("domain")).toBe(true);
  });
});
