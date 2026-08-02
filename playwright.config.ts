import { defineConfig } from "@playwright/test";

// Fixed, non-default ports so this never collides with a `pnpm dev` a
// developer already has open on 3001/5173 — `start` (not `dev`) for the
// backend deliberately, since `dev` loads a local .env if present and could
// pick up a REDIS_URL the E2E suite doesn't want (see persistence.ts: no
// REDIS_URL means pure in-memory state, which is exactly what isolated E2E
// runs need).
const BACKEND_PORT = 3011;

export default defineConfig({
  testDir: "./e2e",
  // Specs share one backend/frontend pair started by webServer below, with
  // no state reset between files — running in series avoids two specs
  // colliding on a random room/group code by coincidence.
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "pnpm --filter @juntada/backend start",
      url: `http://localhost:${BACKEND_PORT}/health`,
      env: { PORT: String(BACKEND_PORT) },
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "pnpm --filter @juntada/frontend dev",
      url: "http://localhost:5173",
      env: { VITE_BACKEND_PORT: String(BACKEND_PORT) },
      reuseExistingServer: !process.env.CI,
    },
  ],
});
