// ─── Token Service ────────────────────────────────────────────────────────────
// Everything token-shaped in one module: signs/verifies the short-lived
// access JWT, and mints the opaque refresh + password-reset tokens (random
// bytes handed to the client, SHA-256 hash persisted — see
// repository/userRepository.ts). Secrets are read from `env` lazily, inside
// each function, not at module load — so importing this file never throws
// just because JWT_ACCESS_SECRET/JWT_REFRESH_SECRET happen to be unset in an
// environment that never actually calls it (mirrors db/client.ts#getDb()'s
// existing lazy-throw convention, see env.ts comment).

import { randomBytes, createHash } from "node:crypto";

const jwt = require("jsonwebtoken");
const { env } = require("../../env") as {
  env: { JWT_ACCESS_SECRET?: string; JWT_REFRESH_SECRET?: string };
};

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 min, per design.md
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 min

export interface AccessTokenPayload {
  sub: string; // userId
}

function requireSecret(name: "JWT_ACCESS_SECRET" | "JWT_REFRESH_SECRET"): string {
  const value = env[name];
  if (!value) {
    throw new Error(
      `${name} is not set — issuing/verifying tokens requires it (see .env.example). ` +
        "This is expected only in an environment that never actually exercises auth.",
    );
  }
  return value;
}

function signAccessToken(userId: string): string {
  const secret = requireSecret("JWT_ACCESS_SECRET");
  return jwt.sign({ sub: userId } satisfies AccessTokenPayload, secret, {
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  });
}

function verifyAccessToken(token: string): AccessTokenPayload {
  const secret = requireSecret("JWT_ACCESS_SECRET");
  const decoded = jwt.verify(token, secret);
  if (typeof decoded === "string" || !decoded.sub) {
    throw new Error("Malformed access token payload");
  }
  return { sub: decoded.sub };
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

// Opaque random token handed to the client; only its SHA-256 hash is ever
// persisted. `token` is what the caller sends back (cookie / email link),
// `hash` + `expiresAt` are what the repository stores.
function generateRefreshToken(): { token: string; hash: string; expiresAt: Date } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: sha256(token), expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS) };
}

function generatePasswordResetToken(): { token: string; hash: string; expiresAt: Date } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: sha256(token), expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) };
}

function hashToken(token: string): string {
  return sha256(token);
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  generatePasswordResetToken,
  hashToken,
  ACCESS_TOKEN_TTL_SECONDS,
};
