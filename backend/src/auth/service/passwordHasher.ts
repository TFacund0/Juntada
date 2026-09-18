// ─── Password Hasher ──────────────────────────────────────────────────────────
// Thin argon2id wrapper. Kept as its own module (rather than inlined in
// authService.ts) so it's the one place that ever imports the `argon2`
// package directly — swapping the hashing library later is a one-file change,
// and authService.ts stays testable without argon2's native binding on the
// require path of a pure-logic unit test (fakes never call this module).

const argon2 = require("argon2");

async function hashPassword(plain: string): Promise<string> {
  // argon2id is argon2's default `type` since v0.28 — kept explicit here so
  // the algorithm choice reads as intentional, matching the
  // `credentials.algorithm` column default ("argon2id") in db/schema.ts.
  return argon2.hash(plain, { type: argon2.argon2id });
}

async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return argon2.verify(hash, plain);
}

module.exports = { hashPassword, verifyPassword };
