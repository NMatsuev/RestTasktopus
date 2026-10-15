const pino = require("pino");
const config = require("../config/env");
const { getRequestContext } = require("./requestContext");

// Структурированные логи (JSON) с едиными полями: level, time, msg, + контекст.
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
  mixin() {
    return getRequestContext() || {};
  },
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
