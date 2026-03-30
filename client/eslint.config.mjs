import { defineConfig, globalIgnores } from "eslint/config";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";

const eslintConfig = defineConfig([
  // Keep global ignores for generated/vendor files
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "public/**",
    "out/**",
  ]),

  // Apply guards to all TypeScript/TSX source files
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    plugins: {
      "@typescript-eslint": typescriptEslint,
      "react-hooks": reactHooks,
    },
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      // ── Guard: prevent "as any" accumulation ──────────────────────────────
      // Warn first — can escalate to "error" once existing violations are fixed
      "@typescript-eslint/no-explicit-any": "warn",

      // ── Guard: prevent infinite render loops ──────────────────────────────
      // Error — missing deps in useEffect/useCallback are almost always bugs
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",

      // ── Guard: no console.log in production code ───────────────────────────
      // Allow console.warn and console.error for legitimate diagnostics
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
]);

export default eslintConfig;
