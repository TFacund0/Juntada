// ─── Auth Ports ───────────────────────────────────────────────────────────────
// Pure interfaces + typed error classes. authService.ts depends only on these
// — never on Drizzle, Express, or the Resend SDK directly — so it can be unit
// tested against in-memory fakes that implement the same ports, and so the
// concrete adapters (repository/userRepository.ts, mail/resendMailer.ts) can
// be swapped without touching business logic. See auth/index.ts for the
// manual composition root that wires the real adapters together.

// ─── Domain shapes ──────────────────────────────────────────────────────────

// Full account row, as read back from storage. `firstName`/`lastName` are
// PRIVATE/administrative — callers must project through toPublicUser/
// toSelfUser (see authService.ts) before this ever crosses the wire to
// anyone but the account's own owner.
export interface UserRecord {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface CreateUserInput {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
}

export interface UpdateProfileInput {
  username?: string;
  firstName?: string;
  lastName?: string;
}

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface PasswordResetTokenRecord {
  userId: string;
  expiresAt: Date;
  usedAt: Date | null;
}

// ─── Typed errors ───────────────────────────────────────────────────────────
// authRoutes.ts maps these to HTTP status codes; authService.ts never knows
// about status codes itself.

class UsernameTakenError extends Error {
  constructor() {
    super("username_taken");
    this.name = "UsernameTakenError";
  }
}

class EmailTakenError extends Error {
  constructor() {
    super("email_taken");
    this.name = "EmailTakenError";
  }
}

class InvalidCredentialsError extends Error {
  constructor() {
    super("invalid_credentials");
    this.name = "InvalidCredentialsError";
  }
}

class InvalidRefreshTokenError extends Error {
  constructor() {
    super("invalid_refresh_token");
    this.name = "InvalidRefreshTokenError";
  }
}

class InvalidResetTokenError extends Error {
  constructor() {
    super("invalid_reset_token");
    this.name = "InvalidResetTokenError";
  }
}

// ─── Ports (adapters implement these) ──────────────────────────────────────

export interface UserRepository {
  // Throws UsernameTakenError / EmailTakenError on a unique-constraint hit —
  // the DB constraint is the authority, not a pre-check (see design.md).
  createUser(input: CreateUserInput): Promise<UserRecord>;

  // Case-insensitive lookup by username OR email; includes the password hash
  // since it exists only to support login. Returns null if no match.
  findByIdentifier(identifier: string): Promise<(UserRecord & { passwordHash: string }) | null>;

  findById(id: string): Promise<UserRecord | null>;
  findByEmail(email: string): Promise<UserRecord | null>;

  // Throws UsernameTakenError on a unique-constraint hit when `username` is
  // part of the update.
  updateProfile(id: string, input: UpdateProfileInput): Promise<UserRecord>;

  updatePasswordHash(id: string, passwordHash: string): Promise<void>;

  // `tokenHash` is the SHA-256 hash of the opaque refresh token actually
  // handed to the client — the raw token is never persisted.
  createRefreshToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  findRefreshTokenByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  revokeRefreshToken(id: string): Promise<void>;
  revokeAllRefreshTokens(userId: string): Promise<void>;

  createPasswordResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  findPasswordResetTokenByHash(tokenHash: string): Promise<PasswordResetTokenRecord | null>;
  markPasswordResetTokenUsed(tokenHash: string): Promise<void>;
}

export interface EmailSender {
  sendPasswordReset(to: string, resetUrl: string): Promise<void>;
}

module.exports = {
  UsernameTakenError,
  EmailTakenError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  InvalidResetTokenError,
};
