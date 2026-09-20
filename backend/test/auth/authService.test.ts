const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { createFakeUserRepository, createFakeEmailSender } = require("./fakes");

// authService.ts reads JWT_ACCESS_SECRET at call time via tokenService.ts —
// set a fake one before requiring it, same pattern as tokenService.test.ts.
let originalAccessSecret: string | undefined;
before(() => {
  originalAccessSecret = process.env.JWT_ACCESS_SECRET;
  process.env.JWT_ACCESS_SECRET = "test-access-secret";
  delete require.cache[require.resolve("../../src/env")];
});
after(() => {
  if (originalAccessSecret === undefined) delete process.env.JWT_ACCESS_SECRET;
  else process.env.JWT_ACCESS_SECRET = originalAccessSecret;
  delete require.cache[require.resolve("../../src/env")];
});

const { createAuthService } = require("../../src/auth/service/authService");
const {
  UsernameTakenError,
  EmailTakenError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  InvalidResetTokenError,
} = require("../../src/auth/ports");

let userRepository: ReturnType<typeof createFakeUserRepository>;
let emailSender: ReturnType<typeof createFakeEmailSender>;
let authService: ReturnType<typeof createAuthService>;

beforeEach(() => {
  userRepository = createFakeUserRepository();
  emailSender = createFakeEmailSender();
  authService = createAuthService({ userRepository, emailSender, appUrl: "http://localhost:5173" });
});

const validRegistration = {
  username: "tobi",
  email: "tobi@example.com",
  firstName: "Tobias",
  lastName: "Acevedo",
  password: "supersecret123",
};

test("register creates the account and returns a SelfUser + token pair, never a raw password", async () => {
  const { user, tokens } = await authService.register(validRegistration);
  assert.equal(user.username, "tobi");
  assert.equal(user.email, "tobi@example.com");
  assert.equal(user.firstName, "Tobias");
  assert.equal(user.lastName, "Acevedo");
  assert.ok(tokens.accessToken);
  assert.ok(tokens.refreshToken);
  assert.equal((user as any).password, undefined);
  assert.equal((user as any).passwordHash, undefined);
});

test("register rejects a duplicate username", async () => {
  await authService.register(validRegistration);
  await assert.rejects(() => authService.register({ ...validRegistration, email: "other@example.com" }), UsernameTakenError);
});

test("register rejects a duplicate email", async () => {
  await authService.register(validRegistration);
  await assert.rejects(() => authService.register({ ...validRegistration, username: "other" }), EmailTakenError);
});

test("login succeeds by username or by email, with the same password", async () => {
  await authService.register(validRegistration);
  const byUsername = await authService.login("tobi", "supersecret123");
  const byEmail = await authService.login("tobi@example.com", "supersecret123");
  assert.equal(byUsername.user.id, byEmail.user.id);
});

test("login rejects a wrong password with a generic error", async () => {
  await authService.register(validRegistration);
  await assert.rejects(() => authService.login("tobi", "wrong-password"), InvalidCredentialsError);
});

test("login rejects an unknown identifier with the same generic error", async () => {
  await assert.rejects(() => authService.login("ghost", "whatever123"), InvalidCredentialsError);
});

test("refresh rotates the refresh token and the old one becomes unusable", async () => {
  const { tokens } = await authService.register(validRegistration);
  const rotated = await authService.refresh(tokens.refreshToken);
  assert.notEqual(rotated.refreshToken, tokens.refreshToken);
  await assert.rejects(() => authService.refresh(tokens.refreshToken), InvalidRefreshTokenError);
});

test("logout revokes the refresh token so it can no longer be used to refresh", async () => {
  const { tokens } = await authService.register(validRegistration);
  await authService.logout(tokens.refreshToken);
  await assert.rejects(() => authService.refresh(tokens.refreshToken), InvalidRefreshTokenError);
});

test("getSelf returns the SelfUser projection including private fields for the owner", async () => {
  const { user } = await authService.register(validRegistration);
  const self = await authService.getSelf(user.id);
  assert.deepEqual(self, user);
});

test("updateProfile renames the username after re-checking uniqueness", async () => {
  const { user } = await authService.register(validRegistration);
  const updated = await authService.updateProfile(user.id, { username: "newname" });
  assert.equal(updated.username, "newname");
});

test("updateProfile rejects a rename to an already-taken username", async () => {
  const { user } = await authService.register(validRegistration);
  await authService.register({ ...validRegistration, username: "taken", email: "taken@example.com" });
  await assert.rejects(() => authService.updateProfile(user.id, { username: "taken" }), UsernameTakenError);
});

test("requestPasswordReset sends an email when the account exists", async () => {
  await authService.register(validRegistration);
  await authService.requestPasswordReset("tobi@example.com");
  assert.equal(emailSender.sent.length, 1);
  assert.equal(emailSender.sent[0].to, "tobi@example.com");
  assert.match(emailSender.sent[0].resetUrl, /^http:\/\/localhost:5173\/reset\//);
});

test("requestPasswordReset resolves identically (no error, no email sent) for a non-existent email", async () => {
  await assert.doesNotReject(() => authService.requestPasswordReset("ghost@example.com"));
  assert.equal(emailSender.sent.length, 0);
});

test("completePasswordReset updates the password, consumes the token, and revokes all refresh tokens", async () => {
  const { user, tokens } = await authService.register(validRegistration);
  await authService.requestPasswordReset(user.email);
  const resetUrl = emailSender.sent[0].resetUrl;
  const resetToken = resetUrl.split("/").pop() as string;

  await authService.completePasswordReset(resetToken, "brandNewPassword123");

  // Old password no longer works, new one does.
  await assert.rejects(() => authService.login(user.username, "supersecret123"), InvalidCredentialsError);
  const relogin = await authService.login(user.username, "brandNewPassword123");
  assert.ok(relogin.tokens.accessToken);

  // The refresh token issued at registration was revoked by the reset.
  await assert.rejects(() => authService.refresh(tokens.refreshToken), InvalidRefreshTokenError);

  // The reset token itself is now single-used.
  await assert.rejects(() => authService.completePasswordReset(resetToken, "anotherPassword123"), InvalidResetTokenError);
});

test("completePasswordReset rejects an unknown/invalid token", async () => {
  await assert.rejects(() => authService.completePasswordReset("not-a-real-token", "whatever123"), InvalidResetTokenError);
});
