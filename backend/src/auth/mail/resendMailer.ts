// ─── Resend Mailer (adapter) ──────────────────────────────────────────────────
// Implements the EmailSender port (see ../ports.ts) using the Resend SDK.
// The client is constructed lazily, inside sendPasswordReset, not at module
// load — so importing this file (which auth/index.ts does eagerly to wire
// the composition root) never throws just because RESEND_API_KEY happens to
// be unset (see env.ts comment; mirrors db/client.ts#getDb()'s convention).
//
// NOTE: ships against Resend's shared test domain by default (MAIL_FROM
// default in env.ts) — this only delivers to the developer's own Resend
// account until a custom domain is verified (see design.md "Risks", tracked
// as a pre-production release gate, not a code change).

import type { EmailSender } from "../ports";

const { env } = require("../../env") as { env: { RESEND_API_KEY?: string; MAIL_FROM: string; APP_URL: string } };

function getClient() {
  if (!env.RESEND_API_KEY) {
    throw new Error(
      "RESEND_API_KEY is not set — sending email requires it (see .env.example). " +
        "This is expected only in an environment that never actually sends a reset email.",
    );
  }
  const { Resend } = require("resend");
  return new Resend(env.RESEND_API_KEY);
}

async function sendPasswordReset(to: string, resetUrl: string): Promise<void> {
  const client = getClient();
  await client.emails.send({
    from: env.MAIL_FROM,
    to,
    subject: "Restablecé tu contraseña de Juntada",
    html: `<p>Pediste restablecer tu contraseña. Este enlace vence en 30 minutos:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>Si no fuiste vos, ignorá este mensaje.</p>`,
  });
}

const resendMailer: EmailSender = { sendPasswordReset };

module.exports = { resendMailer };
