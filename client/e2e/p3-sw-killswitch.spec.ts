import { test, expect } from "@playwright/test";

test.describe("P3 SW kill-switch", () => {
  test("caches are purged on SW unregister + caches.delete", async ({
    page,
  }) => {
    await page.goto("http://localhost:3000/dashboard", {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });

    const registered = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker?.ready;
      return !!reg?.active;
    });

    if (!registered) {
      test.skip(
        true,
        "SW not registered in this environment (dev mode disables it)",
      );
      return;
    }

    // Seed a known cache entry.
    await page.evaluate(async () => {
      const cache = await caches.open("api-list");
      await cache.put(
        new Request("http://localhost:3000/api/v1/test/list"),
        new Response(JSON.stringify({ cached: true }), { status: 200 }),
      );
    });

    const seeded = await page.evaluate(async () => {
      const cache = await caches.open("api-list");
      const hit = await cache.match("http://localhost:3000/api/v1/test/list");
      return !!hit;
    });
    expect(seeded).toBe(true);

    // Kill-switch: unregister SW + wipe all caches.
    await page.evaluate(async () => {
      const regs = await navigator.serviceWorker?.getRegistrations();
      for (const r of regs ?? []) await r.unregister();
      const keys = await caches.keys();
      for (const k of keys) await caches.delete(k);
    });

    const purged = await page.evaluate(async () => {
      const keys = await caches.keys();
      return keys.length === 0;
    });
    expect(purged).toBe(true);
  });
});
