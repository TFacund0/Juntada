// ─── User Repository (Drizzle adapter) ───────────────────────────────────────
// Implements the UserRepository port (see ../ports.ts) against the tables
// created in PR1 (backend/src/db/schema.ts). This is the ONLY module in
// auth/ allowed to import Drizzle or call getDb() — authService.ts never
// touches SQL directly, which is what makes it unit-testable with an
// in-memory fake instead.

import { eq, or, and, sql } from "drizzle-orm";
import type {
  UserRepository as UserRepositoryPort,
  UserRecord,
  CreateUserInput,
  UpdateProfileInput,
  RefreshTokenRecord,
  PasswordResetTokenRecord,
} from "../ports";

const { getDb } = require("../../db/client") as {
  getDb: () => import("drizzle-orm/postgres-js").PostgresJsDatabase<Record<string, unknown>>;
};
const { users, credentials, refreshTokens, passwordResetTokens } = require("../../db/schema");
const { UsernameTakenError, EmailTakenError } = require("../ports");

// Postgres unique_violation — see
// https://www.postgresql.org/docs/current/errcodes-appendix.html
const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(err: unknown, constraintHint: string): boolean {
  const pgErr = err as { code?: string; constraint_name?: string; message?: string } | null;
  if (!pgErr || pgErr.code !== UNIQUE_VIOLATION) return false;
  const hint = pgErr.constraint_name ?? pgErr.message ?? "";
  return hint.toLowerCase().includes(constraintHint);
}

function toUserRecord(row: typeof users.$inferSelect): UserRecord {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
  };
}

async function createUser(input: CreateUserInput): Promise<UserRecord> {
  const db = getDb();
  try {
    const [row] = await db
      .insert(users)
      .values({
        username: input.username,
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
      })
      .returning();

    await db.insert(credentials).values({
      userId: row.id,
      provider: "password",
      passwordHash: input.passwordHash,
      algorithm: "argon2id",
    });

    return toUserRecord(row);
  } catch (err) {
    if (isUniqueViolation(err, "username")) throw new UsernameTakenError();
    if (isUniqueViolation(err, "email")) throw new EmailTakenError();
    throw err;
  }
}

async function findByIdentifier(identifier: string): Promise<(UserRecord & { passwordHash: string }) | null> {
  const db = getDb();
  const [row] = await db
    .select({ user: users, passwordHash: credentials.passwordHash })
    .from(users)
    .innerJoin(credentials, eq(credentials.userId, users.id))
    .where(and(eq(credentials.provider, "password"), or(eq(users.username, identifier), eq(users.email, identifier))))
    .limit(1);
  if (!row || !row.passwordHash) return null;
  return { ...toUserRecord(row.user), passwordHash: row.passwordHash };
}

async function findById(id: string): Promise<UserRecord | null> {
  const db = getDb();
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row ? toUserRecord(row) : null;
}

async function findByEmail(email: string): Promise<UserRecord | null> {
  const db = getDb();
  const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return row ? toUserRecord(row) : null;
}

async function updateProfile(id: string, input: UpdateProfileInput): Promise<UserRecord> {
  const db = getDb();
  const patch: Record<string, string> = {};
  if (input.username !== undefined) patch.username = input.username;
  if (input.firstName !== undefined) patch.firstName = input.firstName;
  if (input.lastName !== undefined) patch.lastName = input.lastName;

  try {
    const [row] = await db.update(users).set(patch).where(eq(users.id, id)).returning();
    if (!row) throw new Error(`updateProfile: no user with id ${id}`);
    return toUserRecord(row);
  } catch (err) {
    if (isUniqueViolation(err, "username")) throw new UsernameTakenError();
    if (isUniqueViolation(err, "email")) throw new EmailTakenError();
    throw err;
  }
}

async function updatePasswordHash(id: string, passwordHash: string): Promise<void> {
  const db = getDb();
  await db.update(credentials).set({ passwordHash }).where(eq(credentials.userId, id));
}

async function createRefreshToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
  const db = getDb();
  await db.insert(refreshTokens).values({ userId, tokenHash, expiresAt });
}

async function findRefreshTokenByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
  const db = getDb();
  const [row] = await db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash)).limit(1);
  if (!row) return null;
  return { id: row.id, userId: row.userId, expiresAt: row.expiresAt, revokedAt: row.revokedAt };
}

async function revokeRefreshToken(id: string): Promise<void> {
  const db = getDb();
  await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.id, id));
}

async function revokeAllRefreshTokens(userId: string): Promise<void> {
  const db = getDb();
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.userId, userId), sql`${refreshTokens.revokedAt} is null`));
}

async function createPasswordResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
  const db = getDb();
  await db.insert(passwordResetTokens).values({ userId, tokenHash, expiresAt });
}

async function findPasswordResetTokenByHash(tokenHash: string): Promise<PasswordResetTokenRecord | null> {
  const db = getDb();
  const [row] = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.tokenHash, tokenHash)).limit(1);
  if (!row) return null;
  return { userId: row.userId, expiresAt: row.expiresAt, usedAt: row.usedAt };
}

async function markPasswordResetTokenUsed(tokenHash: string): Promise<void> {
  const db = getDb();
  await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.tokenHash, tokenHash));
}

const userRepository: UserRepositoryPort = {
  createUser,
  findByIdentifier,
  findById,
  findByEmail,
  updateProfile,
  updatePasswordHash,
  createRefreshToken,
  findRefreshTokenByHash,
  revokeRefreshToken,
  revokeAllRefreshTokens,
  createPasswordResetToken,
  findPasswordResetTokenByHash,
  markPasswordResetTokenUsed,
};

module.exports = { userRepository };
