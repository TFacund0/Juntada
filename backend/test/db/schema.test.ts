const { test } = require("node:test");
const assert = require("node:assert/strict");
const { getTableName, getTableColumns } = require("drizzle-orm");
const { users, credentials, passwordResetTokens, refreshTokens } = require("../../src/db/schema");

// No live Supabase/Postgres instance in this environment — these tests
// assert the shape of the Drizzle schema definitions directly (table/column
// names, which columns are unique/required) rather than round-tripping
// through a real connection. The generated migration
// (src/db/migrations/0000_boring_victor_mancha.sql) is the artifact that
// actually gets run against Supabase; see db/client.test.ts for the
// connection-error-path test.

test("users table has the expected public + private columns", () => {
  assert.equal(getTableName(users), "users");
  const columns = getTableColumns(users);
  assert.deepEqual(Object.keys(columns).sort(), ["createdAt", "email", "firstName", "id", "lastName", "updatedAt", "username"]);
  assert.equal(columns.username.notNull, true);
  assert.equal(columns.username.isUnique, true);
  assert.equal(columns.email.notNull, true);
  assert.equal(columns.email.isUnique, true);
  // Private fields exist on the row but must never be embedded in any
  // room/game-facing DTO — that boundary is enforced in a later PR by the
  // shared-types PublicUser/SelfUser split, not by this table shape.
  assert.equal(columns.firstName.notNull, true);
  assert.equal(columns.lastName.notNull, true);
});

test("credentials table keeps the password hash separate from users, keyed by (user_id, provider)", () => {
  assert.equal(getTableName(credentials), "credentials");
  const columns = getTableColumns(credentials);
  assert.deepEqual(Object.keys(columns).sort(), ["algorithm", "id", "passwordHash", "provider", "updatedAt", "userId"]);
  assert.equal(columns.provider.default, "password");
  assert.equal(columns.algorithm.default, "argon2id");
  // password_hash is nullable at the column level so a future non-password
  // provider (e.g. Google) can insert a credentials row without one.
  assert.equal(columns.passwordHash.notNull, false);
});

test("password_reset_tokens supports single-use, expiring tokens", () => {
  assert.equal(getTableName(passwordResetTokens), "password_reset_tokens");
  const columns = getTableColumns(passwordResetTokens);
  assert.deepEqual(Object.keys(columns).sort(), ["createdAt", "expiresAt", "id", "tokenHash", "usedAt", "userId"]);
  assert.equal(columns.tokenHash.isUnique, true);
  assert.equal(columns.expiresAt.notNull, true);
  assert.equal(columns.usedAt.notNull, false); // null until consumed
});

test("refresh_tokens supports rotation and revocation", () => {
  assert.equal(getTableName(refreshTokens), "refresh_tokens");
  const columns = getTableColumns(refreshTokens);
  assert.deepEqual(Object.keys(columns).sort(), ["createdAt", "expiresAt", "id", "revokedAt", "tokenHash", "userId"]);
  assert.equal(columns.tokenHash.isUnique, true);
  assert.equal(columns.revokedAt.notNull, false);
});
