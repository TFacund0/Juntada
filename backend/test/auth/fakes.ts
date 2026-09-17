// ─── In-memory fakes for the auth ports ──────────────────────────────────────
// Implement UserRepository/EmailSender (see src/auth/ports.ts) entirely in
// memory so authService.ts is testable without a real Postgres instance or
// Resend account — this is the whole point of the ports/adapters split.

const { UsernameTakenError, EmailTakenError } = require("../../src/auth/ports");
const { createHash, randomUUID } = require("node:crypto");

function createFakeUserRepository() {
  const usersById = new Map();
  const credentialsByUserId = new Map();
  const refreshTokens = new Map(); // hash -> record
  const resetTokens = new Map(); // hash -> record

  function findUserByField(field: "username" | "email", value: string) {
    for (const user of usersById.values()) {
      if (user[field].toLowerCase() === value.toLowerCase()) return user;
    }
    return null;
  }

  return {
    async createUser(input: any) {
      if (findUserByField("username", input.username)) throw new UsernameTakenError();
      if (findUserByField("email", input.email)) throw new EmailTakenError();
      const id = randomUUID();
      const user = {
        id,
        username: input.username,
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
      };
      usersById.set(id, user);
      credentialsByUserId.set(id, input.passwordHash);
      return { ...user };
    },

    async findByIdentifier(identifier: string) {
      const user = findUserByField("username", identifier) ?? findUserByField("email", identifier);
      if (!user) return null;
      return { ...user, passwordHash: credentialsByUserId.get(user.id) };
    },

    async findById(id: string) {
      const user = usersById.get(id);
      return user ? { ...user } : null;
    },

    async findByEmail(email: string) {
      const user = findUserByField("email", email);
      return user ? { ...user } : null;
    },

    async updateProfile(id: string, input: any) {
      const user = usersById.get(id);
      if (!user) throw new Error(`no user ${id}`);
      if (
        input.username !== undefined &&
        findUserByField("username", input.username) &&
        findUserByField("username", input.username)?.id !== id
      ) {
        throw new UsernameTakenError();
      }
      const updated = { ...user, ...input };
      usersById.set(id, updated);
      return { ...updated };
    },

    async updatePasswordHash(id: string, passwordHash: string) {
      credentialsByUserId.set(id, passwordHash);
    },

    async createRefreshToken(userId: string, tokenHash: string, expiresAt: Date) {
      refreshTokens.set(tokenHash, { id: randomUUID(), userId, tokenHash, expiresAt, revokedAt: null });
    },

    async findRefreshTokenByHash(tokenHash: string) {
      const record = refreshTokens.get(tokenHash);
      return record ? { ...record } : null;
    },

    async revokeRefreshToken(id: string) {
      for (const record of refreshTokens.values()) {
        if (record.id === id) record.revokedAt = new Date();
      }
    },

    async revokeAllRefreshTokens(userId: string) {
      for (const record of refreshTokens.values()) {
        if (record.userId === userId && !record.revokedAt) record.revokedAt = new Date();
      }
    },

    async createPasswordResetToken(userId: string, tokenHash: string, expiresAt: Date) {
      resetTokens.set(tokenHash, { userId, tokenHash, expiresAt, usedAt: null });
    },

    async findPasswordResetTokenByHash(tokenHash: string) {
      const record = resetTokens.get(tokenHash);
      return record ? { ...record } : null;
    },

    async markPasswordResetTokenUsed(tokenHash: string) {
      const record = resetTokens.get(tokenHash);
      if (record) record.usedAt = new Date();
    },

    // Test-only helpers, not part of the port:
    _debugHashToken(token: string) {
      return createHash("sha256").update(token).digest("hex");
    },
  };
}

function createFakeEmailSender() {
  const sent: Array<{ to: string; resetUrl: string }> = [];
  return {
    sent,
    async sendPasswordReset(to: string, resetUrl: string) {
      sent.push({ to, resetUrl });
    },
  };
}

module.exports = { createFakeUserRepository, createFakeEmailSender };
