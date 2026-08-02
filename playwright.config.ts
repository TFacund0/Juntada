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
  // "html" writes playwright-report/ (traces, screenshots per failed step) —
  // CI uploads that folder as an artifact on failure (see ci.yml); "list" is
  // just the same terminal output used when running locally. `open: "never"`
  // stops the html reporter from trying to launch a browser tab after a
  // local run.
  reporter: [["list"], ["html", { open: "never" }]],
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
