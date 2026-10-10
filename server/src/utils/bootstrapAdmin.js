const bcrypt = require("bcryptjs");
const User = require("../models/User");
const config = require("../config/env");
const logger = require("./logger");

/**
 * При старте сервера, если
 * в базе ещё нет ни одного администратора, а в окружении заданы
 * ADMIN_EMAIL/ADMIN_PASSWORD — создаём (или повышаем) первого администратора
 * автоматически. Без этих переменных сервер просто предупреждает в логах.
 */
async function bootstrapAdmin() {
  const adminExists = await User.exists({ role: "admin" });
  if (adminExists) return;

  if (!config.admin.email || !config.admin.password) {
    logger.warn(
      "В системе нет ни одного администратора, а ADMIN_EMAIL/ADMIN_PASSWORD не заданы — некому будет назначать роли. Задайте эти переменные окружения и перезапустите сервер.",
    );
    return;
  }

  const passwordHash = await bcrypt.hash(config.admin.password, 12);
  const existing = await User.findOne({ email: config.admin.email });

  if (existing) {
    existing.role = "admin";
    existing.passwordHash = passwordHash;
    await existing.save();
    logger.info(
      { email: existing.email },
      "Существующий пользователь повышен до администратора (bootstrap)",
    );
    return;
  }

  const admin = await User.create({
    email: config.admin.email,
    passwordHash,
    role: "admin",
  });
  logger.info(
    { email: admin.email },
    "Создан первый администратор (bootstrap)",
  );
}

module.exports = bootstrapAdmin;
