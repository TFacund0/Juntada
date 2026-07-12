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
