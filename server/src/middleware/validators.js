const { body, param, validationResult } = require('express-validator');
const Task = require('../models/Task');
const User = require('../models/User');

const TASK_STATUSES = Task.TASK_STATUSES;

// Минимальная, но осмысленная политика паролей: длина — главный фактор
// энтропии пароля (см. NIST SP 800-63B), поэтому не требуем искусственных
// "спецсимволов", а задаём разумный минимум длины.
const PASSWORD_MIN_LENGTH = 8;

const registerRules = [
  body('email').trim().notEmpty().withMessage('Email обязателен').isEmail().withMessage('Некорректный email').normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Пароль обязателен')
    .isLength({ min: PASSWORD_MIN_LENGTH })
    .withMessage(`Пароль должен содержать не менее ${PASSWORD_MIN_LENGTH} символов`),
];

const loginRules = [
  body('email').trim().notEmpty().withMessage('Email обязателен').isEmail().withMessage('Некорректный email').normalizeEmail(),
  body('password').notEmpty().withMessage('Пароль обязателен'),
];

const forgotPasswordRules = [
  body('email').trim().notEmpty().withMessage('Email обязателен').isEmail().withMessage('Некорректный email').normalizeEmail(),
];

const resetPasswordRules = [
  body('email').trim().notEmpty().withMessage('Email обязателен').isEmail().withMessage('Некорректный email').normalizeEmail(),
  body('token').trim().notEmpty().withMessage('Токен сброса пароля обязателен'),
  body('newPassword')
    .notEmpty()
    .withMessage('Новый пароль обязателен')
    .isLength({ min: PASSWORD_MIN_LENGTH })
    .withMessage(`Пароль должен содержать не менее ${PASSWORD_MIN_LENGTH} символов`),
];

const roleUpdateRules = [
  body('role').isIn(User.ROLES).withMessage(`Роль должна быть одной из: ${User.ROLES.join(', ')}`),
];

const userIdParamRule = [
  param('id').isMongoId().withMessage('Некорректный идентификатор пользователя'),
];

const sessionIdParamRule = [
  param('id').isMongoId().withMessage('Некорректный идентификатор сессии'),
];

const taskCreateRules = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Название задачи обязательно')
    .isLength({ max: 100 })
    .withMessage('Название не должно превышать 100 символов'),
  body('description')
    .optional({ checkFalsy: true })
    .isLength({ max: 2000 })
    .withMessage('Описание не должно превышать 2000 символов'),
  body('status')
    .optional({ checkFalsy: true })
    .isIn(TASK_STATUSES)
    .withMessage(`Статус должен быть одним из: ${TASK_STATUSES.join(', ')}`),
  body('dueDate')
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('Дата выполнения должна быть в формате ISO8601 (YYYY-MM-DD)'),
];

const taskUpdateRules = [
  body('title')
    .optional({ checkFalsy: true })
    .trim()
    .notEmpty()
    .withMessage('Название задачи не может быть пустым')
    .isLength({ max: 100 })
    .withMessage('Название не должно превышать 100 символов'),
  body('description')
    .optional({ checkFalsy: true })
    .isLength({ max: 2000 })
    .withMessage('Описание не должно превышать 2000 символов'),
  body('status')
    .optional({ checkFalsy: true })
    .isIn(TASK_STATUSES)
    .withMessage(`Статус должен быть одним из: ${TASK_STATUSES.join(', ')}`),
  body('dueDate')
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('Дата выполнения должна быть в формате ISO8601 (YYYY-MM-DD)'),
];

const idParamRule = [
  param('id').isMongoId().withMessage('Некорректный идентификатор задачи'),
];

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Ошибка валидации данных',
      details: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

module.exports = {
  taskCreateRules,
  taskUpdateRules,
  idParamRule,
  registerRules,
  loginRules,
  forgotPasswordRules,
  resetPasswordRules,
  roleUpdateRules,
  userIdParamRule,
  sessionIdParamRule,
  handleValidation,
};
