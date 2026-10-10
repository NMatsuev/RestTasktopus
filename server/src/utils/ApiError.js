// Унифицированная ошибка с HTTP-статусом. Бросаем её в обработчиках маршрутов,
// errorHandler превращает её в { error, details? } с правильным кодом ответа.
class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }

  static badRequest(message, details) {
    return new ApiError(400, message, details);
  }

  static unauthorized(message = 'Требуется авторизация') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'Недостаточно прав для выполнения действия') {
    return new ApiError(403, message);
  }

  static notFound(message = 'Ресурс не найден') {
    return new ApiError(404, message);
  }

  static conflict(message = 'Конфликт данных') {
    return new ApiError(409, message);
  }

  static locked(message = 'Учётная запись временно заблокирована') {
    return new ApiError(423, message);
  }

  static tooManyRequests(message = 'Слишком много попыток, повторите позже') {
    return new ApiError(429, message);
  }
}

module.exports = ApiError;
