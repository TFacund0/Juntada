// ─── Auth HTTP Routes ─────────────────────────────────────────────────────────
// Express adapter: parses/validates the request, calls the injected
// AuthService (see ../service/authService.ts), and translates the result (or
// thrown typed error) into a status code + JSON body. Never touches Drizzle
// or Resend directly — those live behind the service's ports.

import type { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import type { AuthService } from "../service/authService";

const {
  UsernameTakenError,
  EmailTakenError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  InvalidResetTokenError,
} = require("../ports");

// [a-zA-Z0-9_-], 3-20 chars — decided by the orchestrator, see tasks.md.
const usernameSchema = z
  .string()
  .min(3)
  .max(20)
  .regex(/^[a-zA-Z0-9_-]+$/, "Usuario inválido");

const registerSchema = z.object({
  username: usernameSchema,
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  password: z.string().min(8),
});

const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

const updateProfileSchema = z.object({
  username: usernameSchema.optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
});

const requestResetSchema = z.object({
  email: z.string().email(),
});

const completeResetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

const REFRESH_COOKIE = "refreshToken";
// Matches JWT_REFRESH_TTL from design.md (30 days), expressed in ms for
// res.cookie's `maxAge`.
const REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth",
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
}

// Maps a thrown typed error (see ../ports.ts) to its HTTP response. Anything
// not recognized here is rethrown to Express's default/Sentry error handler
// (see app.ts) rather than swallowed into a generic 500 body.
function handleError(err: unknown, res: Response): void {
  if (err instanceof UsernameTakenError) {
    res.status(409).json({ error: "username_taken", field: "username" });
    return;
  }
  if (err instanceof EmailTakenError) {
    res.status(409).json({ error: "email_taken", field: "email" });
    return;
  }
  if (err instanceof InvalidCredentialsError) {
    res.status(401).json({ error: "invalid_credentials" });
    return;
  }
  if (err instanceof InvalidRefreshTokenError) {
    res.status(401).json({ error: "invalid_refresh_token" });
    return;
  }
  if (err instanceof InvalidResetTokenError) {
    res.status(400).json({ error: "invalid_reset_token" });
    return;
  }
  throw err;
}

function buildAuthGuard(verifyAccessToken: (token: string) => { sub: string }) {
  return function requireAuth(req: Request, res: Response, next: NextFunction): void {
    const header = req.header("authorization") ?? "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    try {
      const payload = verifyAccessToken(token);
      (req as Request & { userId?: string }).userId = payload.sub;
      next();
    } catch {
      res.status(401).json({ error: "unauthorized" });
    }
  };
}

function registerAuthRoutes(router: Router, deps: { authService: AuthService }): void {
  const { authService } = deps;
  const { verifyAccessToken } = require("../service/tokenService") as {
    verifyAccessToken: (token: string) => { sub: string };
  };
  const rateLimit = require("express-rate-limit");
  // Separate from the app-wide 300/min limiter in app.ts — these endpoints
  // are credential-guessing / enumeration targets, so they get a much
  // tighter per-IP budget (see design.md "Auth routes get their own
  // express-rate-limit instance").
  const authRateLimiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
  });
  const requireAuth = buildAuthGuard(verifyAccessToken);

  router.post("/auth/register", authRateLimiter, async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_request" });
      return;
    }
    try {
      const { user, tokens } = await authService.register(parsed.data);
      setRefreshCookie(res, tokens.refreshToken);
      res.status(201).json({ user, accessToken: tokens.accessToken });
    } catch (err) {
      handleError(err, res);
    }
  });

  router.post("/auth/login", authRateLimiter, async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_request" });
      return;
    }
    try {
      const { user, tokens } = await authService.login(parsed.data.identifier, parsed.data.password);
      setRefreshCookie(res, tokens.refreshToken);
      res.status(200).json({ user, accessToken: tokens.accessToken });
    } catch (err) {
      handleError(err, res);
    }
  });

  router.post("/auth/refresh", async (req, res) => {
    const refreshToken = (req as Request & { cookies?: Record<string, string> }).cookies?.[REFRESH_COOKIE];
    if (!refreshToken) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    try {
      const tokens = await authService.refresh(refreshToken);
      setRefreshCookie(res, tokens.refreshToken);
      res.status(200).json({ accessToken: tokens.accessToken });
    } catch (err) {
      handleError(err, res);
    }
  });

  router.post("/auth/logout", async (req, res) => {
    const refreshToken = (req as Request & { cookies?: Record<string, string> }).cookies?.[REFRESH_COOKIE];
    if (refreshToken) await authService.logout(refreshToken);
    clearRefreshCookie(res);
    res.status(204).end();
  });

  router.get("/me", requireAuth, async (req, res) => {
    const userId = (req as Request & { userId: string }).userId;
    try {
      const user = await authService.getSelf(userId);
      res.status(200).json({ user });
    } catch (err) {
      handleError(err, res);
    }
  });

  router.patch("/me", requireAuth, async (req, res) => {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_request" });
      return;
    }
    const userId = (req as Request & { userId: string }).userId;
    try {
      const user = await authService.updateProfile(userId, parsed.data);
      res.status(200).json({ user });
    } catch (err) {
      handleError(err, res);
    }
  });

  router.post("/auth/password-reset/request", authRateLimiter, async (req, res) => {
    const parsed = requestResetSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_request" });
      return;
    }
    // Always the same response, whether or not the email exists — see
    // spec.md "Request reset" (no account enumeration).
    await authService.requestPasswordReset(parsed.data.email);
    res.status(202).json({ ok: true });
  });

  router.post("/auth/password-reset/complete", authRateLimiter, async (req, res) => {
    const parsed = completeResetSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_request" });
      return;
    }
    try {
      await authService.completePasswordReset(parsed.data.token, parsed.data.password);
      res.status(204).end();
    } catch (err) {
      handleError(err, res);
    }
  });
}

module.exports = { registerAuthRoutes };
