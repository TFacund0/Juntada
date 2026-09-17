const { test } = require("node:test");
const assert = require("node:assert/strict");
const { hashPassword, verifyPassword } = require("../../src/auth/service/passwordHasher");

test("hashPassword/verifyPassword roundtrip succeeds for the correct password", async () => {
  const hash = await hashPassword("correct horse battery staple");
  assert.equal(await verifyPassword(hash, "correct horse battery staple"), true);
});

test("verifyPassword rejects a wrong password", async () => {
  const hash = await hashPassword("correct horse battery staple");
  assert.equal(await verifyPassword(hash, "wrong password"), false);
});

test("hashPassword never stores the plaintext", async () => {
  const hash = await hashPassword("correct horse battery staple");
  assert.doesNotMatch(hash, /correct horse battery staple/);
  assert.match(hash, /^\$argon2id\$/);
});
