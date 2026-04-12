import { defineConfig, devices } from "@playwright/test";
import path from "path";

const authFile = path.join(__dirname, "playwright/.auth/user.json");

/**
 * Playwright E2E Test Configuration for SignApps Platform
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Test directory
  testDir: "./e2e",

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter to use
  reporter: [["html", { open: "never" }], ["list"]],

  // Global timeout: 60s per test (Next.js dev server compiles on first visit)
  timeout: 60_000,

  // Navigation timeout
  expect: {
    timeout: 15_000,
  },

  // Shared settings for all projects
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: "http://localhost:3000",

    // Navigation timeout (first page load can be slow in dev)
    navigationTimeout: 45_000,
    actionTimeout: 15_000,

    // Block service workers to prevent stale chunk caching across builds
    serviceWorkers: "block",

    // Collect trace when retrying the failed test
    trace: "on-first-retry",

    // Screenshot on failure
    screenshot: "only-on-failure",

    // Video on failure
    video: "on-first-retry",
  },

  // Configure projects — chromium + firefox only (webkit has known auth state issues)
  projects: [
    // Setup project for authentication state
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
    },

    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: authFile,
      },
      dependencies: ["setup"],
    },

    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        storageState: authFile,
      },
      dependencies: ["setup"],
    },
  ],

  // webServer is disabled. Next.js must be running manually on port 3000.
});
