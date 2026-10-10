const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const RefreshToken = require("../models/RefreshToken");
const PasswordResetToken = require("../models/PasswordResetToken");
const ApiError = require("../utils/ApiError");
const config = require("../config/env");
const logger = require("../utils/logger");
const {
  signAccessToken,
  generateOpaqueToken,
  hashToken,
  resetTokenExpiry,
} = require("../utils/tokens");
const {
  createSession,
  findActiveSessionByRawToken,
  revokeSession,
  revokeAllSessionsForUser,
  listActiveSessions,
} = require("../utils/sessions");
const { sendPasswordResetEmail } = require("../utils/mailer");
const { authenticate } = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimit");
const {
  registerRules,
  loginRules,
  forgotPasswordRules,
  resetPasswordRules,
  sessionIdParamRule,
  handleValidation,
} = require("../middleware/validators");

const router = express.Router();
const BCRYPT_COST = 12;

function sessionMeta(req) {
  return { userAgent: req.headers["user-agent"] || null, ip: req.ip };
}

// Refresh-токен живёт в httpOnly-cookie — JS на клиенте никогда его не видит,
// что исключает его кражу через XSS (в отличие от localStorage/тела ответа).
function refreshCookieBaseOptions() {
  return {
    httpOnly: true,
    secure: config.refreshCookie.secure,
    // 'lax' блокирует отправку cookie при межсайтовых fetch/XHR (именно так
    // сторонняя страница попыталась бы выполнить CSRF на /refresh или /logout),
    // но не мешает обычной навигации пользователя на сам сайт.
    sameSite: "lax",
    path: config.refreshCookie.path,
  };
}

function setRefreshCookie(res, rawToken) {
  res.cookie(config.refreshCookie.name, rawToken, {
    ...refreshCookieBaseOptions(),
    maxAge: config.jwt.refreshTtlDays * 24 * 60 * 60 * 1000,
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(config.refreshCookie.name, refreshCookieBaseOptions());
}

function getRefreshCookie(req) {
  return req.cookies ? req.cookies[config.refreshCookie.name] : undefined;
}

// POST /api/auth/register — самостоятельная регистрация всегда создаёт
// пользователя с минимальной ролью (viewer); повышение роли — только через
// административный маршрут (принцип наименьших привилегий по умолчанию).
router.post(
  "/register",
  authLimiter,
  registerRules,
  handleValidation,
  async (req, res, next) => {
    try {
      const { email, password } = req.body;

      const existing = await User.findOne({ email });
      if (existing) {
        throw ApiError.conflict(
          "Пользователь с таким email уже зарегистрирован",
        );
      }

      const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
      const user = await User.create({ email, passwordHash, role: "viewer" });

      logger.info(
        { userId: user._id, email: user.email },
        "Зарегистрирован новый пользователь",
      );
      res.status(201).json(user.toSafeJSON());
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/auth/login
router.post(
  "/login",
  authLimiter,
  loginRules,
  handleValidation,
  async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const genericError = () =>
        ApiError.unauthorized("Неверный email или пароль");

      const user = await User.findOne({ email });
      if (!user) {
        // Намеренно та же ошибка, что и при неверном пароле — чтобы не раскрывать
        // существование аккаунта (защита от перечисления пользователей).
        throw genericError();
      }

      if (user.isLocked()) {
        logger.warn(
          { userId: user._id },
          "Попытка входа в заблокированный аккаунт",
        );
        throw ApiError.locked(
          `Аккаунт временно заблокирован из-за множества неудачных попыток входа. Повторите после ${user.lockUntil.toISOString()}`,
        );
      }

      const passwordMatches = await bcrypt.compare(password, user.passwordHash);
      if (!passwordMatches) {
        user.failedLoginAttempts += 1;
        if (user.failedLoginAttempts >= config.bruteForce.maxLoginAttempts) {
          user.lockUntil = new Date(
            Date.now() + config.bruteForce.lockMinutes * 60 * 1000,
          );
          user.failedLoginAttempts = 0;
          logger.warn(
            { userId: user._id },
            "Аккаунт заблокирован после превышения лимита неудачных попыток входа",
          );
        }
        await user.save();
        throw genericError();
      }

      user.failedLoginAttempts = 0;
      user.lockUntil = null;
      await user.save();

      const accessToken = signAccessToken(user);
      const { raw: refreshToken } = await createSession(user, sessionMeta(req));
      setRefreshCookie(res, refreshToken);

      logger.info({ userId: user._id }, "Успешный вход");
      res.status(200).json({ accessToken, user: user.toSafeJSON() });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/auth/refresh — обмен refresh-токена (из cookie) на новый
// access-токен, с ротацией refresh-токена и обнаружением его повторного
// использования. Тело запроса не нужно — токен сервер читает из cookie.
router.post("/refresh", async (req, res, next) => {
  try {
    const refreshToken = getRefreshCookie(req);
    if (!refreshToken) {
      throw ApiError.unauthorized("Сессия не найдена, войдите снова");
    }

    const session = await findActiveSessionByRawToken(refreshToken);

    if (!session) {
      clearRefreshCookie(res);
      throw ApiError.unauthorized("Недействительный refresh-токен");
    }

    if (session.revokedAt) {
      // Токен уже был использован/отозван ранее — похоже на кражу и повторное
      // использование. Из соображений безопасности отзываем ВСЕ сессии
      // пользователя и требуем повторный вход.
      await revokeAllSessionsForUser(session.user);
      clearRefreshCookie(res);
      logger.warn(
        { userId: session.user },
        "Обнаружено повторное использование refresh-токена — все сессии отозваны",
      );
      throw ApiError.unauthorized(
        "Обнаружено повторное использование токена. Все сессии были завершены, войдите снова",
      );
    }

    if (session.expiresAt.getTime() < Date.now()) {
      clearRefreshCookie(res);
      throw ApiError.unauthorized("Срок действия refresh-токена истёк");
    }

    const user = await User.findById(session.user);
    if (!user) {
      clearRefreshCookie(res);
      throw ApiError.unauthorized();
    }

    const { raw: newRefreshToken, doc: newSession } = await createSession(
      user,
      sessionMeta(req),
    );
    session.revokedAt = new Date();
    session.replacedByTokenHash = newSession.tokenHash;
    await session.save();
    setRefreshCookie(res, newRefreshToken);

    const accessToken = signAccessToken(user);
    res.status(200).json({ accessToken });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout — завершает одну конкретную сессию (по refresh-токену
// из cookie) и очищает саму cookie. Идемпотентно: повторный вызов без
// cookie/с уже отозванным токеном тоже вернёт 200.
router.post("/logout", async (req, res, next) => {
  try {
    const refreshToken = getRefreshCookie(req);
    if (refreshToken) {
      const session = await findActiveSessionByRawToken(refreshToken);
      if (session && !session.revokedAt) {
        await revokeSession(session);
      }
    }
    clearRefreshCookie(res);
    res.status(200).json({ message: "Сессия завершена" });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout-all — завершает ВСЕ сессии текущего пользователя
// («выйти везде») — требует валидный access-токен.
router.post("/logout-all", authenticate, async (req, res, next) => {
  try {
    await revokeAllSessionsForUser(req.user.id);
    clearRefreshCookie(res);
    logger.info(
      { userId: req.user.id },
      "Пользователь завершил все свои сессии",
    );
    res.status(200).json({ message: "Все сессии завершены" });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/sessions — список активных подключений текущего пользователя.
router.get("/sessions", authenticate, async (req, res, next) => {
  try {
    const sessions = await listActiveSessions(req.user.id);
    res.status(200).json(sessions.map((s) => s.toSessionJSON()));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/auth/sessions/:id — отозвать одну конкретную сессию по её id
// (например, если пользователь видит в списке незнакомое устройство).
router.delete(
  "/sessions/:id",
  authenticate,
  sessionIdParamRule,
  handleValidation,
  async (req, res, next) => {
    try {
      const session = await RefreshToken.findById(req.params.id);
      if (!session || String(session.user) !== req.user.id) {
        throw ApiError.notFound("Сессия не найдена");
      }
      if (!session.revokedAt) {
        await revokeSession(session);
      }

      // Если пользователь отозвал именно ту сессию, с которой сейчас пришёл
      // запрос, — очищаем и cookie в его браузере, а не только запись в базе.
      const currentRawToken = getRefreshCookie(req);
      if (currentRawToken && hashToken(currentRawToken) === session.tokenHash) {
        clearRefreshCookie(res);
      }

      res.status(200).json({ message: "Сессия отозвана" });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/auth/forgot-password — восстановление доступа по email.
// Ответ всегда одинаков, независимо от того, существует ли email — иначе
// по разнице ответов можно было бы перечислять зарегистрированные адреса.
router.post(
  "/forgot-password",
  authLimiter,
  forgotPasswordRules,
  handleValidation,
  async (req, res, next) => {
    try {
      const { email } = req.body;
      const genericResponse = {
        message:
          "Если такой email зарегистрирован, на него отправлено письмо с инструкциями",
      };

      const user = await User.findOne({ email });
      if (user) {
        await PasswordResetToken.deleteMany({ user: user._id, usedAt: null });
        const raw = generateOpaqueToken();
        await PasswordResetToken.create({
          user: user._id,
          tokenHash: hashToken(raw),
          expiresAt: resetTokenExpiry(),
        });

        const base =
          config.clientOrigin && config.clientOrigin !== "*"
            ? config.clientOrigin
            : "http://localhost:3000";
        const link = `${base}/reset-password?email=${encodeURIComponent(user.email)}&token=${raw}`;

        try {
          await sendPasswordResetEmail(user.email, link);
        } catch (mailErr) {
          logger.error(
            { err: mailErr, userId: user._id },
            "Не удалось отправить письмо восстановления пароля",
          );
        }
      }

      res.status(200).json(genericResponse);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/auth/reset-password — завершение восстановления доступа.
router.post(
  "/reset-password",
  authLimiter,
  resetPasswordRules,
  handleValidation,
  async (req, res, next) => {
    try {
      const { email, token, newPassword } = req.body;
      const invalidError = () =>
        ApiError.badRequest(
          "Недействительный или просроченный токен восстановления",
        );

      const user = await User.findOne({ email });
      if (!user) throw invalidError();

      const resetDoc = await PasswordResetToken.findOne({
        user: user._id,
        tokenHash: hashToken(token),
      });
      if (!resetDoc || !resetDoc.isValid()) throw invalidError();

      user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
      user.failedLoginAttempts = 0;
      user.lockUntil = null;
      await user.save();

      resetDoc.usedAt = new Date();
      await resetDoc.save();

      // Смена пароля — повод завершить все существующие сессии на всех
      // устройствах (на случай, если пароль менялся из-за компрометации).
      await revokeAllSessionsForUser(user._id);
      clearRefreshCookie(res);

      logger.info(
        { userId: user._id },
        "Пароль восстановлен через email, все сессии отозваны",
      );
      res
        .status(200)
        .json({ message: "Пароль успешно изменён. Войдите с новым паролем" });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/auth/me — профиль текущего пользователя.
router.get("/me", authenticate, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) throw ApiError.notFound("Пользователь не найден");
    res.status(200).json(user.toSafeJSON());
  } catch (err) {
    next(err);
  }
});

module.exports = router;
