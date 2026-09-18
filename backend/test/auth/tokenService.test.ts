const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

// tokenService.ts reads JWT_ACCESS_SECRET/JWT_REFRESH_SECRET lazily from env
// on each call (see its module comment) — set fake secrets before requiring
// it so this test never touches real production secrets, following the
// require.cache-reset pattern already used by test/db/client.test.ts.
let originalAccessSecret: string | undefined;
let originalRefreshSecret: string | undefined;

function freshTokenService() {
  delete require.cache[require.resolve("../../src/env")];
  delete require.cache[require.resolve("../../src/auth/service/tokenService")];
  return require("../../src/auth/service/tokenService");
}

before(() => {
  originalAccessSecret = process.env.JWT_ACCESS_SECRET;
  originalRefreshSecret = process.env.JWT_REFRESH_SECRET;
  process.env.JWT_ACCESS_SECRET = "test-access-secret";
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
});

after(() => {
  if (originalAccessSecret === undefined) delete process.env.JWT_ACCESS_SECRET;
  else process.env.JWT_ACCESS_SECRET = originalAccessSecret;
  if (originalRefreshSecret === undefined) delete process.env.JWT_REFRESH_SECRET;
  else process.env.JWT_REFRESH_SECRET = originalRefreshSecret;
  delete require.cache[require.resolve("../../src/env")];
  delete require.cache[require.resolve("../../src/auth/service/tokenService")];
});

test("signAccessToken/verifyAccessToken roundtrip returns the same userId", () => {
  const { signAccessToken, verifyAccessToken } = freshTokenService();
  const token = signAccessToken("user-123");
  const payload = verifyAccessToken(token);
  assert.equal(payload.sub, "user-123");
});

test("verifyAccessToken rejects a tampered token", () => {
  const { signAccessToken, verifyAccessToken } = freshTokenService();
  const token = signAccessToken("user-123");
  const tampered = token.slice(0, -2) + (token.at(-2) === "a" ? "b" : "a") + token.at(-1);
  assert.throws(() => verifyAccessToken(tampered));
});

test("verifyAccessToken throws a clear error when JWT_ACCESS_SECRET is unset", () => {
  delete process.env.JWT_ACCESS_SECRET;
  const tokenService = freshTokenService();
  assert.throws(() => tokenService.signAccessToken("user-123"), /JWT_ACCESS_SECRET is not set/);
  process.env.JWT_ACCESS_SECRET = "test-access-secret";
});

test("generateRefreshToken returns a token whose hash matches hashToken", () => {
  const { generateRefreshToken, hashToken } = freshTokenService();
  const { token, hash, expiresAt } = generateRefreshToken();
  assert.equal(hashToken(token), hash);
  assert.ok(expiresAt.getTime() > Date.now());
});

test("generatePasswordResetToken returns a token whose hash matches hashToken", () => {
  const { generatePasswordResetToken, hashToken } = freshTokenService();
  const { token, hash, expiresAt } = generatePasswordResetToken();
  assert.equal(hashToken(token), hash);
  assert.ok(expiresAt.getTime() > Date.now());
  assert.ok(expiresAt.getTime() < Date.now() + 31 * 60 * 1000);
});
