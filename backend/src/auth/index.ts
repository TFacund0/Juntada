// ─── Auth Composition Root ────────────────────────────────────────────────────
// The one place that wires the concrete adapters (Drizzle repository, Resend
// mailer) into authService.ts. authRoutes.ts (and, in a later PR, the WS
// layer) import the already-assembled `authService` from here instead of
// constructing it themselves — this is the feature's manual "Program.cs".

import type { Router } from "express";
import type { AuthService } from "./service/authService";

const { createAuthService } = require("./service/authService") as {
  createAuthService: (deps: { userRepository: unknown; emailSender: unknown; appUrl: string }) => AuthService;
};
const { userRepository } = require("./repository/userRepository");
const { resendMailer } = require("./mail/resendMailer");
const { registerAuthRoutes } = require("./http/authRoutes");
const { env } = require("../env") as { env: { APP_URL: string } };

const authService: AuthService = createAuthService({
  userRepository,
  emailSender: resendMailer,
  appUrl: env.APP_URL,
});

function mountAuthRoutes(router: Router): void {
  registerAuthRoutes(router, { authService });
}

module.exports = { authService, mountAuthRoutes };
