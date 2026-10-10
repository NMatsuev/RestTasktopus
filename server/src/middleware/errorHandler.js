const multer = require('multer');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Маршрут не найден' });
}

/**
 * Единая обработка ошибок. Любой объект, переданный в next(err), попадает
 * сюда и переводится в код ответа + тело, соответствующие семантике HTTP:
 *  - 400 Bad Request        — некорректные данные запроса (валидация, файл)
 *  - 401 Unauthorized       — запрос не аутентифицирован / токен недействителен
 *  - 403 Forbidden          — аутентифицирован, но роль не даёт доступа
 *  - 404 Not Found          — ресурс с таким id не существует
 *  - 409 Conflict           — конфликт состояния (например, email уже занят)
 *  - 423 Locked             — учётная запись временно заблокирована
 *  - 429 Too Many Requests  — превышен лимит попыток (анти-брутфорс)
 *  - 500 Internal Server Error — необработанная ошибка сервера
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err instanceof multer.MulterError) {
    let message = 'Ошибка загрузки файла';
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'Файл слишком большой. Максимальный размер — 5MB';
    }
    return res.status(400).json({ error: message });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({ error: 'Некорректный идентификатор ресурса' });
  }

  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ error: messages.join('; ') });
  }

  // Дубликат уникального поля в MongoDB (например, email при регистрации)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'поле';
    return res.status(409).json({ error: `Значение поля "${field}" уже используется` });
  }

  if (err instanceof jwt.TokenExpiredError) {
    return res.status(401).json({ error: 'Токен доступа истёк' });
  }

  if (err instanceof jwt.JsonWebTokenError) {
    return res.status(401).json({ error: 'Недействительный токен доступа' });
  }

  const status = err.status || 500;
  const message = err.message || 'Внутренняя ошибка сервера';

  if (status >= 500) {
    logger.error({ err, requestId: req.id }, 'Необработанная ошибка сервера');
  }

  const body = { error: message };
  if (err.details) body.details = err.details;
  res.status(status).json(body);
}

module.exports = { notFoundHandler, errorHandler };
