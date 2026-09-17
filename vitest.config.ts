import { defineConfig } from "vitest/config";

// Tests for the pure-logic packages/* workspace — no React, no DOM, so a
// plain node environment is enough (unlike frontend/vitest.config.ts, which
// needs jsdom for component tests). Kept at the repo root instead of one
// vitest.config.ts per package since all 16 packages share the exact same
// setup (node env, no plugins) — one config covers them all.
export default defineConfig({
  test: {
    environment: "node",
    include: ["packages/*/*.test.ts"],
  },
});
