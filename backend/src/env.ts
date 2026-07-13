// ─── Environment ─────────────────────────────────────────────────────────────
// Validated once at process start so a typo'd or missing env var in
// production fails loudly here instead of silently misbehaving later (e.g.
// CORS_ORIGIN with a stray space, or a non-numeric PORT). See .env.example
// for the full list of variables this project understands.

import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  // Left unset in dev/prod-behind-same-origin on purpose — see the comment
  // on its usage in app.ts. Only set once a custom domain fronts the app.
  CORS_ORIGIN: z.string().url().optional(),
  // Optional — error tracking is a no-op until this is set (see sentry.ts).
  // Get one by creating a free Sentry.io project (Node/Express platform).
  SENTRY_DSN: z.string().url().optional(),
  // Optional — room/group persistence across restarts is a no-op until this
  // is set (see state/persistence.ts). Get one by creating a free Redis
  // database on upstash.com (or any other rediss://-compatible provider).
  REDIS_URL: z.string().url().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // Plain console here, not the Pino logger — logger.ts reads `env`, so
  // reaching for it before validation has even passed would be circular.
  console.error("Invalid environment variables:");
  for (const [key, errors] of Object.entries(parsed.error.flatten().fieldErrors)) {
    console.error(`  ${key}: ${errors?.join(", ")}`);
  }
  process.exit(1);
}

export const env = parsed.data;

// Not a hard failure — same-origin deployments (see render.yaml) intentionally
// leave this unset — but a silent misconfiguration here means CORS opens up
// to any origin, so make it visible at startup rather than only discoverable
// by testing cross-origin requests against prod.
if (env.NODE_ENV === "production" && !env.CORS_ORIGIN) {
  console.warn(
    "[env] CORS_ORIGIN is unset in production. This is expected only if the frontend " +
      "is served from the same origin as this backend (see render.yaml comment) — " +
      "otherwise, cross-origin requests are unrestricted.",
  );
}
