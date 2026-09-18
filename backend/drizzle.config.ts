// Config for `pnpm db:generate` / `pnpm db:migrate` (drizzle-kit). Only used
// as a dev-time CLI tool — the app itself talks to Postgres through
// backend/src/db/client.ts, not through this file.
import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://placeholder",
  },
} satisfies Config;
