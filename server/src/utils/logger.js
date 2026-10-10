const pino = require("pino");
const config = require("../config/env");

// Структурированные логи (JSON) с едиными полями: level, time, msg, + контекст.
// В разработке используем pino-pretty, если он установлен
let transport;
if (config.nodeEnv !== "production") {
  try {
    // eslint-disable-next-line global-require
    require.resolve("pino-pretty");
    transport = {
      target: "pino-pretty",
      options: { colorize: true, translateTime: "HH:MM:ss" },
    };
  } catch (err) {
    transport = undefined;
  }
}

const logger = pino({
  level: config.logLevel,
  transport,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "password",
      "newPassword",
      "passwordHash",
      "*.password",
      "*.passwordHash",
      "*.token",
      "*.refreshToken",
      "*.accessToken",
    ],
    censor: "[REDACTED]",
  },
  base: { service: "task-manager-api" },
});

module.exports = logger;
