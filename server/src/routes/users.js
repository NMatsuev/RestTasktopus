const express = require('express');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { revokeAllSessionsForUser } = require('../utils/sessions');
const { authenticate, authorize } = require('../middleware/auth');
const { roleUpdateRules, userIdParamRule, handleValidation } = require('../middleware/validators');

const router = express.Router();

// Все маршруты этого файла — только для роли admin (управление пользователями).
router.use(authenticate, authorize('admin'));

// GET /api/users — список пользователей с ролями и статусом блокировки.
router.get('/', async (req, res, next) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.status(200).json(users.map((u) => u.toSafeJSON()));
  } catch (err) {
    next(err);
  }
});

// PATCH /api/users/:id/role — изменить роль пользователя.
router.patch('/:id/role', userIdParamRule, roleUpdateRules, handleValidation, async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) {
      throw ApiError.badRequest('Нельзя изменить собственную роль');
    }

    const user = await User.findById(req.params.id);
    if (!user) throw ApiError.notFound('Пользователь не найден');

    const previousRole = user.role;
    user.role = req.body.role;
    await user.save();

    logger.info(
      { targetUserId: user._id, previousRole, newRole: user.role, actorId: req.user.id },
      'Администратор изменил роль пользователя'
    );
    res.status(200).json(user.toSafeJSON());
  } catch (err) {
    next(err);
  }
});

// POST /api/users/:id/unlock — вручную снять блокировку аккаунта раньше срока.
router.post('/:id/unlock', userIdParamRule, handleValidation, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) throw ApiError.notFound('Пользователь не найден');

    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    logger.info({ targetUserId: user._id, actorId: req.user.id }, 'Администратор снял блокировку аккаунта');
    res.status(200).json(user.toSafeJSON());
  } catch (err) {
    next(err);
  }
});

// POST /api/users/:id/revoke-sessions — принудительно завершить все сессии
// пользователя (например, при подозрении на компрометацию аккаунта).
router.post('/:id/revoke-sessions', userIdParamRule, handleValidation, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) throw ApiError.notFound('Пользователь не найден');

    await revokeAllSessionsForUser(user._id);

    logger.info({ targetUserId: user._id, actorId: req.user.id }, 'Администратор принудительно завершил сессии пользователя');
    res.status(200).json({ message: 'Все сессии пользователя завершены' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
