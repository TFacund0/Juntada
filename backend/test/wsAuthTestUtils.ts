// ─── WS Auth Test Helpers ────────────────────────────────────────────────────
// Every WS integration test needs a valid access JWT to get past the
// handshake check in ws/server.ts, and roomHandlers.ts/groupHandlers.ts
// resolve the room-visible username via `authService.getSelf(accountId)` —
// which, in production, hits a real Postgres instance via
// auth/repository/userRepository.ts. There's no live Postgres in this test
// environment (same constraint PR1/PR2 already documented — see
// test/auth/fakes.ts), so this monkeypatches the auth composition root
// (auth/index.ts) with an in-memory fake BEFORE anything first requires
// ../src/app, the same require.cache-substitution trick test/db/client.test.ts
// already uses for env.ts/db/client.ts.
//
// JWT signing itself (tokenService.ts#signAccessToken) needs no DB — only
// JWT_ACCESS_SECRET, set here directly on process.env — so the actual
// handshake verification in ws/server.ts runs for real, unmocked.

process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "test-jwt-access-secret-not-for-prod";

const { signAccessToken } = require("../src/auth/service/tokenService") as {
  signAccessToken: (userId: string) => string;
};

// accountId -> username, read by the fake authService.getSelf installed by
// installFakeAuthService below.
const testAccounts = new Map<string, string>();
let nextAccountSeq = 0;

// Registers a fresh fake account and returns a signed access token for it —
// exactly what a real client would present as `jwt.<token>` on the WS
// subprotocol handshake (see ws/server.ts).
function registerTestAccount(username: string): { accountId: string; token: string } {
  nextAccountSeq += 1;
  const accountId = `acc-test-${nextAccountSeq}-${Math.random().toString(36).slice(2, 8)}`;
  testAccounts.set(accountId, username);
  return { accountId, token: signAccessToken(accountId) };
}

let installed = false;

// Must be called before the first `require("../../src/app")` (or anything
// that transitively requires it) in a given test process — module caching
// means a later call is a no-op once auth/index.ts has already been
// required for real.
function installFakeAuthService(): void {
  if (installed) return;
  installed = true;
  const authIndexPath = require.resolve("../src/auth/index");
  require.cache[authIndexPath] = {
    id: authIndexPath,
    filename: authIndexPath,
    loaded: true,
    exports: {
      authService: {
        async getSelf(userId: string) {
          const username = testAccounts.get(userId);
          if (!username) throw new Error(`wsAuthTestUtils: no test account registered for accountId ${userId}`);
          return { id: userId, username };
        },
      },
      // authRoutes.ts is out of scope for these WS tests — never mounted.
      mountAuthRoutes: () => {},
    },
  } as unknown as NodeModule;
}

// The exact subprotocol array a real client passes to the `ws` constructor
// (see design.md's "Token transport" decision) — `new WebSocket(url, protocols)`.
function jwtProtocol(token: string): string[] {
  return [`jwt.${token}`];
}

module.exports = { registerTestAccount, installFakeAuthService, jwtProtocol, testAccounts };
