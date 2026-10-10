const RefreshToken = require("../models/RefreshToken");
const {
  generateOpaqueToken,
  hashToken,
  refreshTokenExpiry,
} = require("./tokens");

/**
 * Создаёт новую сессию (запись об активном подключении) и возвращает
 * refresh-токен — он отдаётся клиенту один раз и больше нигде
 * не сохраняется в открытом виде.
 */
async function createSession(user, meta = {}) {
  const raw = generateOpaqueToken();
  const doc = await RefreshToken.create({
    user: user._id,
    tokenHash: hashToken(raw),
    userAgent: meta.userAgent || null,
    ip: meta.ip || null,
    expiresAt: refreshTokenExpiry(),
  });
  return { raw, doc };
}

async function findActiveSessionByRawToken(raw) {
  return RefreshToken.findOne({ tokenHash: hashToken(raw) });
}

async function revokeSession(doc) {
  doc.revokedAt = new Date();
  await doc.save();
}

async function revokeAllSessionsForUser(userId) {
  await RefreshToken.updateMany(
    { user: userId, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
}

async function listActiveSessions(userId) {
  return RefreshToken.find({
    user: userId,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });
}

module.exports = {
  createSession,
  findActiveSessionByRawToken,
  revokeSession,
  revokeAllSessionsForUser,
  listActiveSessions,
};
