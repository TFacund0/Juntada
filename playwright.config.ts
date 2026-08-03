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
  // Default (30s) is tight for specs that drive 2-3 real BrowserContexts
  // through actual WebSocket room flows (join, config, several rounds of
  // clue-giving, voting) — headless CI runners are slower/less parallel
  // than a local dev machine, so the same spec that finishes in ~15-20s
  // locally can blow past 30s in CI and fail on nothing but scheduling.
  // 60s wasn't enough either (still timing out on ubuntu-latest's shared
  // 2-vCPU runner), so this leaves real headroom instead of nudging it up
  // again one bump at a time.
  timeout: process.env.CI ? 90_000 : 30_000,
  // One retry only in CI: these specs are long real-socket flows on a
  // shared runner, so a genuine one-off scheduling hiccup shouldn't fail
  // the whole job — but a real regression still fails on the 2nd attempt.
  retries: process.env.CI ? 1 : 0,
  // "html" writes playwright-report/ (traces, screenshots per failed step) —
  // CI uploads that folder as an artifact on failure (see ci.yml); "list" is
  // just the same terminal output used when running locally. `open: "never"`
  // stops the html reporter from trying to launch a browser tab after a
  // local run.
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    // ubuntu-latest's default /dev/shm is 64MB — too small for Chromium's
    // shared memory once a real WebSocket/multi-context spec is running,
    // and it fails silently: no crash, no error, the renderer just stops
    // producing any output (confirmed via a CI trace that went completely
    // dark — no network activity, no console logs, no screencast frames —
    // for the rest of the test right after the socket opened). Chrome
    // falls back to /tmp instead of /dev/shm with this flag, same as
    // Playwright's own Docker images do internally. No effect locally.
    launchOptions: {
      args: ["--disable-dev-shm-usage"],
    },
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
