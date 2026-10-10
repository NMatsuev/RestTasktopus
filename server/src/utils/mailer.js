const nodemailer = require("nodemailer");
const config = require("../config/env");
const logger = require("./logger");

let transporter = null;
if (config.smtp.host) {
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: config.smtp.user
      ? { user: config.smtp.user, pass: config.smtp.pass }
      : undefined,
  });
}

/**
 * Отправляет письмо для восстановления доступа. Если SMTP не настроен, ссылка не теряется молча — она пишется в
 * структурированный лог уровня warn, чтобы её можно было найти и использовать
 * для ручной проверки.
 */
async function sendPasswordResetEmail(to, resetLink) {
  if (!transporter) {
    logger.warn(
      { to, resetLink },
      "SMTP не настроен: ссылка на сброс пароля выведена в лог вместо письма",
    );
    return { delivered: false };
  }

  await transporter.sendMail({
    from: config.smtp.from,
    to,
    subject: "Восстановление доступа — Менеджер задач",
    text: `Вы запросили восстановление доступа. Перейдите по ссылке в течение ${config.passwordReset.tokenTtlMinutes} минут: ${resetLink}\n\nЕсли вы не запрашивали восстановление — проигнорируйте это письмо.`,
    html: `<p>Вы запросили восстановление доступа.</p><p>Перейдите по ссылке в течение ${config.passwordReset.tokenTtlMinutes} минут:</p><p><a href="${resetLink}">${resetLink}</a></p><p>Если вы не запрашивали восстановление — проигнорируйте это письмо.</p>`,
  });

  return { delivered: true };
}

module.exports = { sendPasswordResetEmail };
