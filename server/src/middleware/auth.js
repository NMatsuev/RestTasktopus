const jwt = require('jsonwebtoken');
const { verifyAccessToken } = require('../utils/tokens');
const ApiError = require('../utils/ApiError');

/**
 * Проверяет access-токен (временный ключ) из заголовка Authorization: Bearer.
 * При успехе кладёт в req.user { id, role, email } — остальной код маршрутов
 * доверяет только этому объекту, а не каким-либо данным из тела запроса.
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(ApiError.unauthorized('Отсутствует токен доступа'));
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role, email: payload.email };
    return next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return next(ApiError.unauthorized('Токен доступа истёк'));
    }
    return next(ApiError.unauthorized('Недействительный токен доступа'));
  }
}

/**
 * Фабрика middleware для ролевой модели доступа (RBAC).
 * authorize('admin', 'manager') пропускает только эти роли, иначе 403.
 * Должна ставиться ПОСЛЕ authenticate.
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(ApiError.forbidden('Роль пользователя не позволяет выполнить это действие'));
    }
    return next();
  };
}

module.exports = { authenticate, authorize };
