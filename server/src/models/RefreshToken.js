const mongoose = require('mongoose');

// Каждый документ — одна сессия/активное подключение пользователя (одно
// устройство или браузер). Храним только ХЕШ refresh-токена — сам "временный
// ключ" в базе никогда не лежит в открытом виде, как и пароль.
const refreshTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    userAgent: { type: String, default: null },
    ip: { type: String, default: null },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    replacedByTokenHash: { type: String, default: null },
  },
  { timestamps: true }
);

refreshTokenSchema.methods.isActive = function isActive() {
  return !this.revokedAt && this.expiresAt.getTime() > Date.now();
};

refreshTokenSchema.methods.toSessionJSON = function toSessionJSON() {
  return {
    id: this._id,
    userAgent: this.userAgent,
    ip: this.ip,
    createdAt: this.createdAt,
    expiresAt: this.expiresAt,
  };
};

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
