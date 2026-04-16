import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Vitest configuration — Phase F2.
 *
 * - happy-dom for DOM globals (lighter than jsdom, no Canvas/WebGL)
 * - `@/*` alias matches tsconfig.json path alias
 * - Test files: `src/**\/*.test.{ts,tsx}` co-located next to source
 * - Setup file mounts @testing-library/jest-dom matchers
 *
 * Run:
 *   npm test         # watch mode
 *   npm run test:run # one-shot
 *   npm run test:ui  # browser UI
 */
export default defineConfig({
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/.next/**", "**/e2e/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
