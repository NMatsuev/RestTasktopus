const crypto = require("crypto");
const pinoHttp = require("pino-http");
const logger = require("../utils/logger");

// Каждому запросу присваивается requestId (корреляционный идентификатор).
// Он возвращается в заголовке X-Request-Id и попадает в каждую строку лога,
// связанную с этим запросом — это позволяет по одному ID собрать всю цепочку
// событий (вход -> бизнес-логика -> ошибка) в централизованной системе логов
// даже если инстансов сервера несколько.
const requestLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const existing = req.headers["x-request-id"];
    const id = existing || crypto.randomUUID();
    res.setHeader("X-Request-Id", id);
    return id;
  },
  customLogLevel: (req, res, err) => {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  serializers: {
    req: (req) => ({ method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});

module.exports = requestLogger;
