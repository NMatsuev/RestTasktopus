// Единая точка чтения конфигурации из переменных окружения.
// Если обязательный секрет не задан, в production — падаем сразу (fail fast),
// в разработке — подставляем значение по умолчанию и громко предупреждаем.

const isProd = process.env.NODE_ENV === "production";

function requireSecret(name, devFallback) {
  const value = process.env[name];
  if (value && value.trim()) return value;
  if (isProd) {
    throw new Error(`Переменная окружения ${name} обязательна в production`);
  }
  // eslint-disable-next-line no-console
  console.warn(
    `[config] ${name} не задана, используется небезопасное значение по умолчанию (только для разработки)`,
  );
  return devFallback;
}

// Cookie требует браузерной same-site/CORS-модели с origin — со
// значением '*' браузер откажется и отправлять, и принимать такую cookie при
// credentialed-запросах. Поэтому дефолт для разработки — конкретный адрес, а
// не wildcard; если кто-то всё же явно поставит '*', громко предупреждаем.
const rawClientOrigin = process.env.CLIENT_ORIGIN;
if (rawClientOrigin === "*") {
  // eslint-disable-next-line no-console
  console.warn(
    "[config] CLIENT_ORIGIN=* несовместим с httpOnly cookie для refresh-токена — браузер не примет credentialed-ответ с Access-Control-Allow-Origin: *. Укажите конкретный адрес клиента.",
  );
}

const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "5000", 10),
  mongoUri: process.env.MONGO_URI || "mongodb://localhost:27017/taskmanager",
  clientOrigin: rawClientOrigin || "http://localhost:3000",
  logLevel: process.env.LOG_LEVEL || (isProd ? "info" : "debug"),

  jwt: {
    accessSecret: requireSecret(
      "JWT_ACCESS_SECRET",
      "dev-insecure-access-secret",
    ),
    accessTtlMinutes: parseInt(
      process.env.ACCESS_TOKEN_TTL_MINUTES || "15",
      10,
    ),
    refreshTtlDays: parseInt(process.env.REFRESH_TOKEN_TTL_DAYS || "30", 10),
  },

  // Настройки cookie, в которой лежит refresh-токен (httpOnly, недоступна из JS).
  refreshCookie: {
    name: "refresh_token",
    // Только для конкретного поддерева API, где он реально нужен — меньше
    // поверхность атаки (cookie не улетает на каждый запрос к сайту).
    path: "/api/auth",
    // В проде за HTTPS обязательно true — иначе браузер не будет работать без
    // localhost-исключения. Переключается явным флагом, а не auto-detect,
    // чтобы не словить "тихо не работает" при неожиданной конфигурации прокси.
    secure: process.env.COOKIE_SECURE === "true",
  },

  bruteForce: {
    maxLoginAttempts: parseInt(process.env.LOGIN_MAX_ATTEMPTS || "5", 10),
    lockMinutes: parseInt(process.env.LOGIN_LOCK_MINUTES || "15", 10),
    windowMinutes: parseInt(process.env.LOGIN_RATE_WINDOW_MINUTES || "15", 10),
    maxRequestsPerWindow: parseInt(
      process.env.LOGIN_RATE_MAX_REQUESTS || "20",
      10,
    ),
  },

  passwordReset: {
    tokenTtlMinutes: parseInt(process.env.RESET_TOKEN_TTL_MINUTES || "60", 10),
  },

  smtp: {
    host: process.env.SMTP_HOST || null,
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER || null,
    pass: process.env.SMTP_PASS || null,
    from: process.env.SMTP_FROM || "Task Manager <no-reply@task-manager.local>",
  },

  admin: {
    email: process.env.ADMIN_EMAIL || null,
    password: process.env.ADMIN_PASSWORD || null,
  },
};

module.exports = config;
