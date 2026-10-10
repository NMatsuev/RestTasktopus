const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const config = require("../config/env");

/**
 * Access-токен — это "временный ключ" доступа к API: подписанный JWT с коротким
 * временем жизни (по умолчанию 15 минут), который сервер не хранит — проверка
 * выполняется только по подписи и сроку действия (stateless).
 */
function signAccessToken(user) {
  return jwt.sign(
    { sub: String(user._id), role: user.role, email: user.email },
    config.jwt.accessSecret,
    { expiresIn: `${config.jwt.accessTtlMinutes}m` },
  );
}

function verifyAccessToken(token) {
  // Бросает jwt.TokenExpiredError / jwt.JsonWebTokenError при проблемах —
  // их перехватывает middleware/auth.js и errorHandler.js.
  return jwt.verify(token, config.jwt.accessSecret);
}

/**
 * Refresh-токен — тоже "временный ключ", но долгоживущий и отзываемый:
 * это случайная строка высокой энтропии, которая хранится у клиента целиком,
 * а на сервере — только её SHA-256 хеш (см. models/RefreshToken.js). Так мы
 * можем отзывать конкретные сессии и обнаруживать повторное использование
 * токена (признак кражи), не теряя главного плюса JWT — быстрой проверки
 * access-токена без обращения к базе на каждый запрос.
 */
function generateOpaqueToken() {
  return crypto.randomBytes(48).toString("hex");
}

function hashToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

function refreshTokenExpiry() {
  return new Date(Date.now() + config.jwt.refreshTtlDays * 24 * 60 * 60 * 1000);
}

function resetTokenExpiry() {
  return new Date(
    Date.now() + config.passwordReset.tokenTtlMinutes * 60 * 1000,
  );
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  generateOpaqueToken,
  hashToken,
  refreshTokenExpiry,
  resetTokenExpiry,
};
