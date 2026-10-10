const rateLimit = require('express-rate-limit');
const config = require('../config/env');

// Ограничение по IP — первый (сетевой) рубеж защиты от перебора учётных данных.
// Это дополняет, а не заменяет, поштучную блокировку аккаунта в User-модели:
// лимитер защищает от распределённого/автоматизированного перебора по многим
// адресам и просто "шумных" ботов, блокировка аккаунта — от прицельного
// перебора пароля одного и того же пользователя.
const authLimiter = rateLimit({
  windowMs: config.bruteForce.windowMinutes * 60 * 1000,
  max: config.bruteForce.maxRequestsPerWindow,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много попыток с этого адреса, повторите позже' },
  statusCode: 429,
});

module.exports = { authLimiter };
