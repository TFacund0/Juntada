// ─── DB Schema ────────────────────────────────────────────────────────────────
// Drizzle table definitions for the account/auth data layer. This file is the
// single source of truth for both the runtime types (via drizzle's inferred
// row types) and the SQL migrations generated from it (see
// backend/src/db/migrations/ and `pnpm db:generate`).
//
// Kept deliberately isolated: nothing outside backend/src/db/ imports this
// yet (see README in this PR) — the HTTP/WS layers start consuming it in a
// later PR.

import { pgTable, uuid, text, timestamp, unique, customType } from "drizzle-orm/pg-core";

// Postgres' case-insensitive text type (Supabase ships the `citext`
// extension — enabled by the initial migration). Using it for `username`
// and `email` means uniqueness and lookups are case-insensitive at the DB
// level ("Tobias" and "tobias" collide) without hand-rolling a lowercase
// functional index everywhere a query touches these columns.
const citext = customType<{ data: string }>({
  dataType() {
    return "citext";
  },
});

const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Public, editable, unique — the ONLY name shown anywhere in rooms/games.
  username: citext("username").notNull().unique(),
  email: citext("email").notNull().unique(),
  // PRIVATE, administrative-only — must never be serialized into a
  // room/game-facing payload (see packages/shared-types PublicUser/SelfUser
  // split, added in a later PR).
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Kept separate from `users` so adding another auth provider later (e.g.
// Google) only ever means inserting a new `credentials` row with a
// different `provider` — the `users` shape never has to change for that.
const credentials = pgTable(
  "credentials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("password"),
    passwordHash: text("password_hash"),
    algorithm: text("algorithm").notNull().default("argon2id"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [unique().on(table.userId, table.provider)],
);

// Single-use, expiring tokens for the password-recovery flow. `tokenHash` is
// a SHA-256 hash of the token actually emailed to the user — the raw token
// itself is never stored.
const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Refresh JWTs are stored hashed (never the raw token) and rotated on every
// use; `revokedAt` covers logout and "revoke all sessions" (password reset).
const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

module.exports = { citext, users, credentials, passwordResetTokens, refreshTokens };
