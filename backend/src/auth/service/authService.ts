// ─── Auth Service ─────────────────────────────────────────────────────────────
// Pure business logic for register/login/logout/refresh/editProfile/
// password-reset. Depends ONLY on the UserRepository/EmailSender ports (see
// ../ports.ts) plus the password/token helper modules — never on Drizzle,
// Express, or the Resend SDK directly. That's what makes it unit-testable
// with in-memory fakes (see test/auth/authService.test.ts) without a real
// Postgres instance or Resend account.

import type { EmailSender, UserRecord, UserRepository } from "../ports";

const { InvalidCredentialsError, InvalidRefreshTokenError, InvalidResetTokenError } = require("../ports");
const { hashPassword, verifyPassword } = require("./passwordHasher") as {
  hashPassword: (plain: string) => Promise<string>;
  verifyPassword: (hash: string, plain: string) => Promise<boolean>;
};
const { signAccessToken, generateRefreshToken, generatePasswordResetToken, hashToken, ACCESS_TOKEN_TTL_SECONDS } =
  require("./tokenService") as {
    signAccessToken: (userId: string) => string;
    generateRefreshToken: () => { token: string; hash: string; expiresAt: Date };
    generatePasswordResetToken: () => { token: string; hash: string; expiresAt: Date };
    hashToken: (token: string) => string;
    ACCESS_TOKEN_TTL_SECONDS: number;
  };

// ─── Public DTO projections ─────────────────────────────────────────────────
// PublicUser never carries firstName/lastName — see design.md's compile-time
// tripwire rationale. SelfUser is the owner-only GET/PATCH /api/me shape.

export interface PublicUser {
  id: string;
  username: string;
}

export interface SelfUser extends PublicUser {
  email: string;
  firstName: string;
  lastName: string;
}

export interface TokenPair {
  accessToken: string;
  accessTokenExpiresInSeconds: number;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

function toPublicUser(user: UserRecord): PublicUser {
  return { id: user.id, username: user.username };
}

function toSelfUser(user: UserRecord): SelfUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
  };
}

export interface RegisterInput {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
}

export interface AuthService {
  register(input: RegisterInput): Promise<{ user: SelfUser; tokens: TokenPair }>;
  login(identifier: string, password: string): Promise<{ user: SelfUser; tokens: TokenPair }>;
  logout(refreshToken: string): Promise<void>;
  refresh(refreshToken: string): Promise<TokenPair>;
  getSelf(userId: string): Promise<SelfUser>;
  updateProfile(userId: string, input: { username?: string; firstName?: string; lastName?: string }): Promise<SelfUser>;
  requestPasswordReset(email: string): Promise<void>;
  completePasswordReset(token: string, newPassword: string): Promise<void>;
}

function createAuthService(deps: { userRepository: UserRepository; emailSender: EmailSender; appUrl: string }): AuthService {
  const { userRepository, emailSender, appUrl } = deps;

  async function issueTokenPair(userId: string): Promise<TokenPair> {
    const accessToken = signAccessToken(userId);
    const refresh = generateRefreshToken();
    await userRepository.createRefreshToken(userId, refresh.hash, refresh.expiresAt);
    return {
      accessToken,
      accessTokenExpiresInSeconds: ACCESS_TOKEN_TTL_SECONDS,
      refreshToken: refresh.token,
      refreshTokenExpiresAt: refresh.expiresAt,
    };
  }

  async function register(input: RegisterInput): Promise<{ user: SelfUser; tokens: TokenPair }> {
    const passwordHash = await hashPassword(input.password);
    const user = await userRepository.createUser({
      username: input.username,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      passwordHash,
    });
    const tokens = await issueTokenPair(user.id);
    return { user: toSelfUser(user), tokens };
  }

  async function login(identifier: string, password: string): Promise<{ user: SelfUser; tokens: TokenPair }> {
    const record = await userRepository.findByIdentifier(identifier);
    if (!record) throw new InvalidCredentialsError();
    const valid = await verifyPassword(record.passwordHash, password);
    if (!valid) throw new InvalidCredentialsError();
    const tokens = await issueTokenPair(record.id);
    return { user: toSelfUser(record), tokens };
  }

  async function logout(refreshToken: string): Promise<void> {
    const hash = hashToken(refreshToken);
    const record = await userRepository.findRefreshTokenByHash(hash);
    if (!record || record.revokedAt) return; // idempotent — nothing to revoke
    await userRepository.revokeRefreshToken(record.id);
  }

  async function refresh(refreshToken: string): Promise<TokenPair> {
    const hash = hashToken(refreshToken);
    const record = await userRepository.findRefreshTokenByHash(hash);
    if (!record || record.revokedAt || record.expiresAt.getTime() < Date.now()) {
      throw new InvalidRefreshTokenError();
    }
    // Rotation: the old token is revoked before a new pair is issued, so a
    // stolen-and-replayed refresh token can only ever be used once.
    await userRepository.revokeRefreshToken(record.id);
    return issueTokenPair(record.userId);
  }

  async function getSelf(userId: string): Promise<SelfUser> {
    const user = await userRepository.findById(userId);
    if (!user) throw new InvalidCredentialsError();
    return toSelfUser(user);
  }

  async function updateProfile(userId: string, input: { username?: string; firstName?: string; lastName?: string }): Promise<SelfUser> {
    const user = await userRepository.updateProfile(userId, input);
    return toSelfUser(user);
  }

  async function requestPasswordReset(email: string): Promise<void> {
    // MUST respond identically whether or not the email exists — see
    // spec.md "Request reset". Callers of this method get a resolved
    // promise either way; the HTTP layer returns the same 202 regardless.
    const user = await userRepository.findByEmail(email);
    if (!user) return;
    const reset = generatePasswordResetToken();
    await userRepository.createPasswordResetToken(user.id, reset.hash, reset.expiresAt);
    const resetUrl = `${appUrl}/reset/${reset.token}`;
    await emailSender.sendPasswordReset(user.email, resetUrl);
  }

  async function completePasswordReset(token: string, newPassword: string): Promise<void> {
    const hash = hashToken(token);
    const record = await userRepository.findPasswordResetTokenByHash(hash);
    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
      throw new InvalidResetTokenError();
    }
    const passwordHash = await hashPassword(newPassword);
    await userRepository.updatePasswordHash(record.userId, passwordHash);
    await userRepository.markPasswordResetTokenUsed(hash);
    // Password reset invalidates every existing session — see spec.md.
    await userRepository.revokeAllRefreshTokens(record.userId);
  }

  return {
    register,
    login,
    logout,
    refresh,
    getSelf,
    updateProfile,
    requestPasswordReset,
    completePasswordReset,
  };
}

module.exports = { createAuthService, toPublicUser, toSelfUser };
