const { body, param, validationResult } = require('express-validator');
const Task = require('../models/Task');

const TASK_STATUSES = Task.TASK_STATUSES;

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
  handleValidation,
};
