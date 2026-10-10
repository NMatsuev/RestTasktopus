const mongoose = require('mongoose');

// Токен восстановления пароля — тоже "временный ключ": одноразовый,
// короткоживущий (по умолчанию 60 минут), хранится только в виде хеша.
const passwordResetTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

passwordResetTokenSchema.methods.isValid = function isValid() {
  return !this.usedAt && this.expiresAt.getTime() > Date.now();
};

module.exports = mongoose.model('PasswordResetToken', passwordResetTokenSchema);
