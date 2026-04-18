/**
 * Phase D2 P3 — Virtualised list frame-time bench.
 *
 * Scrolls the first role="list" element on the target page for 60 frames
 * and asserts that the p95 inter-frame time stays under 33 ms (~30 fps).
 *
 * Targets `/dashboard` as a safe proxy since it always renders on CI. When
 * a chat-room fixture with ~5k messages exists, adapt the URL to that
 * route for a more representative benchmark.
 *
 * Skips gracefully if no VirtualList is mounted on the page.
 */
import { test, expect } from "@playwright/test";

test("virtualized list keeps p95 frame time under 33ms", async ({ page }) => {
  await page.goto("http://localhost:3000/dashboard", {
    waitUntil: "domcontentloaded",
    timeout: 15_000,
  });

  const list = page.locator('[role="list"]').first();
  const present = await list.count();

  if (present === 0) {
    test.skip(true, "no VirtualList rendered on dashboard — add fixture route");
    return;
  }

  const frames = await page.evaluate(() => {
    return new Promise<number[]>((resolve) => {
      const frameTimes: number[] = [];
      let last = performance.now();
      const el = document.querySelector('[role="list"]') as HTMLElement | null;
      if (!el) return resolve([]);

      function step() {
        const now = performance.now();
        frameTimes.push(now - last);
        last = now;
        if (frameTimes.length < 60) {
          el!.scrollTop += 200;
          requestAnimationFrame(step);
        } else {
          resolve(frameTimes);
        }
      }
      requestAnimationFrame(step);
    });
  });

  if (frames.length > 0) {
    frames.sort((a, b) => a - b);
    const p95 = frames[Math.floor(frames.length * 0.95)];
    expect(p95).toBeLessThan(33);
  }
});
