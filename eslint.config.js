// ─── ESLint (flat config) ────────────────────────────────────────────────────
// Single shared config for the whole monorepo — backend and frontend get the
// same TypeScript rules, frontend additionally gets React/hooks rules.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import prettierConfig from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  {
    ignores: ["**/node_modules/**", "**/dist/**", "**/build/**", "frontend/dev-dist/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      globals: { ...globals.node, ...globals.es2022 },
    },
    rules: {
      // Untyped `require()`/JS interop and gradual typing during the TS
      // migration mean `any` shows up on purpose in plenty of places (see
      // engineTypes.ts casts) — downgraded to a warning, not a hard error.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-unused-vars": "off",
    },
  },
  {
    // react-hooks rules apply to plain .ts hook files too (useMultiplayerSocket.ts
    // has no JSX), not just .tsx components.
    files: ["frontend/**/*.{js,jsx,ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      // eslint-plugin-react-hooks' "recommended" preset now bundles a whole
      // set of experimental React Compiler rules (purity, static-components,
      // set-state-in-effect, refs, ...) that assume compiler-era patterns and
      // fire on plenty of legitimate code here (resetting UI state in a
      // useEffect on a prop change, Math.random() in a click handler). Only
      // the two long-stable rules are worth enforcing.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    files: ["frontend/**/*.{jsx,tsx}"],
    plugins: { react },
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      ...react.configs.recommended.rules,
      "react/react-in-jsx-scope": "off", // Vite's JSX runtime, no import needed
      "react/prop-types": "off", // TypeScript covers this
      // Copy text is in Spanish and uses "..." and quotes constantly — escaping
      // every one as &quot; hurts readability in JSX for no real benefit here.
      "react/no-unescaped-entities": "off",
    },
    settings: { react: { version: "detect" } },
  },
  {
    files: ["backend/**/*.ts"],
    rules: {
      // The backend is CJS by convention (require() for runtime values,
      // `import type` for types-only) — see the TS migration's file-by-file
      // notes. Rewriting every require() to import is a separate refactor.
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["backend/test/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off", // test mocks intentionally loose, see impostorEngine.test.ts
    },
  },
  prettierConfig,
);
