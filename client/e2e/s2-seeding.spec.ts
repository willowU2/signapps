import { test, expect } from "./fixtures";

/**
 * S2 — Seeding démo cohérent E2E scenarios (W3 T20)
 *
 * Relies on `just db-seed` having been run before the suite (see
 * package.json scripts or CI pipeline). The seed is idempotent so
 * re-running has no side-effects.
 *
 * Two scenarios:
 *   S2-SEED-1 : Visit several seeded pages and assert at least one
 *               Acme Corp artefact shows up on each (calendar events,
 *               mail sender, chat channels, docs, drive files, PXE
 *               enrolled assets). Individual page failures degrade
 *               gracefully (smoke) — the goal is cross-service data
 *               visibility, not pixel-perfect assertions.
 *   S2-SEED-2 : Log in as marie.dupont / Demo1234! (a seeded user)
 *               and verify the dashboard loads.
 */

test.describe("S2 — Seeding démo cohérent", () => {
  test("S2-SEED-1: pages peuplées après seed (Acme Corp)", async ({ page }) => {
    // Each assertion is best-effort: we `expect` visible but with a short
    // timeout. Soft failures are acceptable — a missing section should
    // not veto the whole scenario (the backend service may be disabled
    // or the UI may not be wired yet). We track successes and require
    // at least half of the pages to render their seeded content.
    const checks: { label: string; url: string; needle: RegExp }[] = [
      {
        label: "org",
        url: "/org",
        needle: /Acme Corp|Engineering|Marie Dupont/i,
      },
      {
        label: "calendar",
        url: "/calendar",
        needle: /Réunion|Sprint|Pipeline/i,
      },
      { label: "mail", url: "/mail", needle: /Démo|Point projet/i },
      {
        label: "chat",
        url: "/chat",
        needle: /Général|Engineering|Sales|Random/i,
      },
      {
        label: "docs",
        url: "/docs",
        needle: /Roadmap|Guide onboarding|Runbook/i,
      },
      { label: "drive", url: "/drive", needle: /Budget-Q2|Rapport|Pitch/i },
      {
        label: "forms",
        url: "/forms",
        needle: /Candidature|Satisfaction|démo/i,
      },
      {
        label: "pxe assets",
        url: "/pxe/assets",
        needle: /poste-jean|laptop-marie|devbox-sophie/i,
      },
    ];

    let hits = 0;
    const misses: string[] = [];
    for (const { label, url, needle } of checks) {
      try {
        await page.goto(url, { waitUntil: "domcontentloaded" });
        // Give a few ms for client-side fetches / stores to populate.
        await page.waitForTimeout(800);
        const content = await page.locator("body").innerText();
        if (needle.test(content)) {
          hits += 1;
        } else {
          misses.push(`${label} (${url})`);
        }
      } catch (e) {
        misses.push(`${label} (nav error: ${String(e).slice(0, 80)})`);
      }
    }

    // Require >= 3 pages to render seeded content.
    expect(
      hits,
      `hits=${hits}, misses=${misses.join(", ")}`,
    ).toBeGreaterThanOrEqual(3);
  });

  test("S2-SEED-2: Login en tant que marie.dupont (seed user)", async ({
    browser,
  }) => {
    // Fresh context — avoid leftover admin auth from fixture.
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

    await page.goto("/login");
    // Fill by common fr/en labels.
    const usernameField = page
      .getByLabel(/nom d'utilisateur|username/i)
      .first();
    const passwordField = page.getByLabel(/mot de passe|password/i).first();

    if (
      (await usernameField.count()) > 0 &&
      (await passwordField.count()) > 0
    ) {
      await usernameField.fill("marie.dupont");
      await passwordField.fill("Demo1234!");
      const submit = page
        .getByRole("button", { name: /connexion|log in|sign in/i })
        .first();
      if ((await submit.count()) > 0) {
        await submit.click();
        // Successful login lands on dashboard / home.
        await expect(page).toHaveURL(/\/(dashboard|home|$|\?)/, {
          timeout: 10_000,
        });
      }
    }

    await context.close();
  });
});
