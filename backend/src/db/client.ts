// ─── DB Client ────────────────────────────────────────────────────────────────
// Lazily-created postgres-js connection + Drizzle wrapper. `getDb()` throws
// with a clear message rather than letting a missing DATABASE_URL surface as
// a confusing driver error deep in some query — nothing calls this yet (see
// README in this PR), so the error path is exercised by tests, not prod.

import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

const { env } = require("../env") as { env: { DATABASE_URL?: string } };
const schema = require("./schema");

type Db = PostgresJsDatabase<typeof schema>;

let db: Db | undefined;

function getDb(): Db {
  if (db) return db;
  if (!env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set — the account/auth data layer requires a Postgres " +
        "connection string (see .env.example). This is expected if nothing in this " +
        "deployment reads from the DB yet.",
    );
  }
  const postgres = require("postgres");
  const sql = postgres(env.DATABASE_URL, { prepare: false });
  db = drizzle(sql, { schema });
  return db;
}

module.exports = { getDb };
