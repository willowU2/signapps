import { defineConfig, globalIgnores } from "eslint/config";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";
import nextPlugin from "@next/eslint-plugin-next";
import jsxA11y from "eslint-plugin-jsx-a11y";

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
      "@next/next": nextPlugin,
      "jsx-a11y": jsxA11y,
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
      "no-console": ["error", { allow: ["warn", "error"] }],

      // ── Guard: use Next.js <Image> instead of <img> ────────────────────────
      "@next/next/no-img-element": "error",

      // ── Guard: a11y static analysis (Phase E1) ────────────────────────────
      // "warn" level per the progressive-strictness policy (same as Phase C
      // no-explicit-any). Pattern-level fixes in E1c reduce the count.
      "jsx-a11y/alt-text": "warn",
      "jsx-a11y/anchor-has-content": "warn",
      "jsx-a11y/anchor-is-valid": "warn",
      "jsx-a11y/aria-activedescendant-has-tabindex": "warn",
      "jsx-a11y/aria-props": "warn",
      "jsx-a11y/aria-proptypes": "warn",
      "jsx-a11y/aria-role": "warn",
      "jsx-a11y/aria-unsupported-elements": "warn",
      "jsx-a11y/autocomplete-valid": "warn",
      "jsx-a11y/click-events-have-key-events": "warn",
      "jsx-a11y/heading-has-content": "warn",
      "jsx-a11y/iframe-has-title": "warn",
      "jsx-a11y/img-redundant-alt": "warn",
      "jsx-a11y/interactive-supports-focus": "warn",
      "jsx-a11y/label-has-associated-control": "warn",
      "jsx-a11y/media-has-caption": "warn",
      "jsx-a11y/mouse-events-have-key-events": "warn",
      "jsx-a11y/no-access-key": "warn",
      "jsx-a11y/no-autofocus": "warn",
      "jsx-a11y/no-distracting-elements": "warn",
      "jsx-a11y/no-interactive-element-to-noninteractive-role": "warn",
      "jsx-a11y/no-noninteractive-element-interactions": "warn",
      "jsx-a11y/no-noninteractive-element-to-interactive-role": "warn",
      "jsx-a11y/no-noninteractive-tabindex": "warn",
      "jsx-a11y/no-redundant-roles": "warn",
      "jsx-a11y/no-static-element-interactions": "warn",
      "jsx-a11y/role-has-required-aria-props": "warn",
      "jsx-a11y/role-supports-aria-props": "warn",
      "jsx-a11y/scope": "warn",
      "jsx-a11y/tabindex-no-positive": "warn",
    },
  },

  // Scripts are CLI tools — console.log is intentional output
  {
    files: ["src/scripts/**/*.ts"],
    rules: {
      "no-console": "off",
    },
  },

  // Phase C — lib/api + stores any elimination.
  // These directories have been audited and typed; re-introducing `any`
  // is an ERROR (not warning), blocking the build. The rest of the
  // codebase stays on the global 'warn' level until Phase C-UI is done.
  // See docs/superpowers/specs/2026-04-16-phase-c-api-stores-design.md
  {
    files: ["src/lib/api/**/*.ts", "src/stores/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
]);

export default eslintConfig;
