const multer = require('multer');

function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Маршрут не найден' });
}

function errorHandler(err, req, res, next) {
  console.error(err);

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

  const status = err.status || 500;
  const message = err.message || 'Внутренняя ошибка сервера';
  res.status(status).json({ error: message });
}

module.exports = { notFoundHandler, errorHandler };
