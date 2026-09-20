const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { createServer } = require("node:http");

// authRoutes.ts internally requires tokenService.ts for the requireAuth
// guard, which reads JWT_ACCESS_SECRET lazily — set a fake one so
// verifyAccessToken can be exercised end-to-end through GET/PATCH /api/me
// without touching a real secret.
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

const { registerAuthRoutes } = require("../../src/auth/http/authRoutes");
const { signAccessToken } = require("../../src/auth/service/tokenService");
const { UsernameTakenError, EmailTakenError, InvalidCredentialsError, InvalidResetTokenError } = require("../../src/auth/ports");

// A hand-rolled fake AuthService (not the fakes.ts repository fakes) — this
// suite only exercises the HTTP adapter (parsing, status codes, cookies),
// never the business logic, so it stubs the service directly per test.
function buildApp(authService: any) {
  const express = require("express");
  const cookieParser = require("cookie-parser");
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  const router = express.Router();
  registerAuthRoutes(router, { authService });
  app.use("/api", router);
  return app;
}

let server: any;
let baseUrl: string;

function listen(app: any) {
  return new Promise<void>(resolve => {
    server = createServer(app);
    server.listen(0, () => {
      const address = server.address();
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
}

afterEachClose();
function afterEachClose() {
  const { afterEach } = require("node:test");
  afterEach(async () => {
    if (server) await new Promise<void>(resolve => server.close(() => resolve()));
  });
}

const sampleUser = { id: "user-1", username: "tobi", email: "tobi@example.com", firstName: "T", lastName: "A" };
const sampleTokens = {
  accessToken: "access-token-value",
  accessTokenExpiresInSeconds: 900,
  refreshToken: "refresh-token-value",
  refreshTokenExpiresAt: new Date(Date.now() + 1000 * 60),
};

test("POST /api/auth/register returns 201 with the user and access token, and sets a refresh cookie", async () => {
  const authService = {
    register: async () => ({ user: sampleUser, tokens: sampleTokens }),
  };
  await listen(buildApp(authService));
  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "tobi", email: "tobi@example.com", firstName: "T", lastName: "A", password: "supersecret123" }),
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.user.username, "tobi");
  assert.equal(body.accessToken, "access-token-value");
  assert.match(res.headers.get("set-cookie") ?? "", /refreshToken=refresh-token-value/);
});

test("POST /api/auth/register rejects an invalid body with 400 before calling the service", async () => {
  let called = false;
  const authService = { register: async () => ((called = true), { user: sampleUser, tokens: sampleTokens }) };
  await listen(buildApp(authService));
  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "a", email: "not-an-email", firstName: "", lastName: "", password: "x" }),
  });
  assert.equal(res.status, 400);
  assert.equal(called, false);
});

test("POST /api/auth/register maps UsernameTakenError to 409", async () => {
  const authService = {
    register: async () => {
      throw new UsernameTakenError();
    },
  };
  await listen(buildApp(authService));
  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "tobi", email: "tobi@example.com", firstName: "T", lastName: "A", password: "supersecret123" }),
  });
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.error, "username_taken");
  assert.equal(body.field, "username");
});

test("POST /api/auth/register maps EmailTakenError to 409", async () => {
  const authService = {
    register: async () => {
      throw new EmailTakenError();
    },
  };
  await listen(buildApp(authService));
  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "tobi", email: "tobi@example.com", firstName: "T", lastName: "A", password: "supersecret123" }),
  });
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.error, "email_taken");
});

test("POST /api/auth/login maps InvalidCredentialsError to a generic 401", async () => {
  const authService = {
    login: async () => {
      throw new InvalidCredentialsError();
    },
  };
  await listen(buildApp(authService));
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identifier: "tobi", password: "wrong" }),
  });
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.error, "invalid_credentials");
});

test("POST /api/auth/logout is 204 even with no cookie set (idempotent)", async () => {
  const authService = { logout: async () => {} };
  await listen(buildApp(authService));
  const res = await fetch(`${baseUrl}/api/auth/logout`, { method: "POST" });
  assert.equal(res.status, 204);
});

test("GET /api/me without a Bearer token returns 401 without calling the service", async () => {
  let called = false;
  const authService = { getSelf: async () => ((called = true), sampleUser) };
  await listen(buildApp(authService));
  const res = await fetch(`${baseUrl}/api/me`);
  assert.equal(res.status, 401);
  assert.equal(called, false);
});

test("GET /api/me with a valid Bearer token returns the SelfUser", async () => {
  const authService = { getSelf: async (userId: string) => ({ ...sampleUser, id: userId }) };
  await listen(buildApp(authService));
  const token = signAccessToken("user-42");
  const res = await fetch(`${baseUrl}/api/me`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.user.id, "user-42");
});

test("PATCH /api/me maps a UsernameTakenError collision to 409", async () => {
  const authService = {
    updateProfile: async () => {
      throw new UsernameTakenError();
    },
  };
  await listen(buildApp(authService));
  const token = signAccessToken("user-42");
  const res = await fetch(`${baseUrl}/api/me`, {
    method: "PATCH",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ username: "taken" }),
  });
  assert.equal(res.status, 409);
});

test("POST /api/auth/password-reset/request always returns 202, regardless of the service outcome", async () => {
  const authService = { requestPasswordReset: async () => {} };
  await listen(buildApp(authService));
  const res = await fetch(`${baseUrl}/api/auth/password-reset/request`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "ghost@example.com" }),
  });
  assert.equal(res.status, 202);
});

test("POST /api/auth/password-reset/complete maps InvalidResetTokenError to 400", async () => {
  const authService = {
    completePasswordReset: async () => {
      throw new InvalidResetTokenError();
    },
  };
  await listen(buildApp(authService));
  const res = await fetch(`${baseUrl}/api/auth/password-reset/complete`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: "bad-token", password: "brandNewPassword123" }),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error, "invalid_reset_token");
});
