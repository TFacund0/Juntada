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
  // Prefixes the Redis key persistence.ts snapshots under — lets multiple
  // deployments (e.g. staging and production) safely share a single Redis
  // database without their snapshots colliding. Only matters when REDIS_URL
  // is set; each deployment sharing a database should set this to something
  // unique to it (e.g. "juntada-staging" vs "juntada-production").
  REDIS_NAMESPACE: z.string().min(1).default("juntada"),
  // Postgres connection string for the account/auth data layer (see
  // backend/src/db/). Supabase's "Connection pooling" string works here.
  // Still Zod-optional (not `.min(1)` required) even though the auth routes
  // now depend on it: `db/client.ts#getDb()` is lazy and throws its own
  // clear error the first time a query actually runs without it configured,
  // which lets every non-auth test (and this file's own parsing) keep
  // working without a real Postgres instance available. Production MUST set
  // this or every auth request fails at the DB call, not at boot.
  DATABASE_URL: z.string().url().optional(),
  // HS256 signing secrets for short-lived access JWTs and the opaque
  // refresh-token pair (see auth/tokenService.ts). Same lazy-optional
  // rationale as DATABASE_URL above — tokenService.ts throws a clear error
  // the first time it's asked to sign/verify without one set, instead of
  // this file exiting the whole process (including unrelated non-auth
  // tests) at import time.
  JWT_ACCESS_SECRET: z.string().min(1).optional(),
  JWT_REFRESH_SECRET: z.string().min(1).optional(),
  // Resend API key for transactional email (password reset). Optional for
  // the same reason: auth/mail/resendMailer.ts throws a clear error lazily
  // when a reset email is actually sent without it configured. Currently
  // ships against Resend's shared test domain (see design doc — only
  // delivers to the developer's own Resend account until a custom domain is
  // verified, tracked as a production release gate).
  RESEND_API_KEY: z.string().min(1).optional(),
  // "from" address used for outgoing auth email (password reset). Defaults
  // to Resend's shared test-domain sender so local dev works without any
  // Resend account configured at all.
  MAIL_FROM: z.string().min(1).default("Juntada <onboarding@resend.dev>"),
  // Base URL the frontend is served from — used to build the password-reset
  // link embedded in the email (e.g. `${APP_URL}/reset/${token}`). Falls
  // back to localhost so local dev needs no extra config.
  APP_URL: z.string().url().default("http://localhost:5173"),
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
