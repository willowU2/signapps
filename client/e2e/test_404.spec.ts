import { test } from "@playwright/test";
import type { Response, Page } from "@playwright/test";

test("capture 404 URL", async ({ page }: { page: Page }) => {
  page.on("response", (response: Response) => {
    if (response.status() === 404 || response.status() === 401) {
      console.log(`[${response.status()}] ${response.url()}`);
    }
  });

  console.log("Navigating to http://localhost:3000/login?auto=admin");
  await page.goto("http://localhost:3000/login?auto=admin");
  await page.waitForTimeout(3000);
});
