const mongoose = require("mongoose");

const { USER_ROLES } = require("../constants/userRoles");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email обязателен"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Некорректный формат email"],
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: {
        values: USER_ROLES,
        message: `Роль должна быть одной из: ${USER_ROLES.join(", ")}`,
      },
      default: "viewer",
    },
    // --- защита от подбора учётных данных (brute-force) ---
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

userSchema.methods.isLocked = function isLocked() {
  return Boolean(this.lockUntil && this.lockUntil.getTime() > Date.now());
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id,
    email: this.email,
    role: this.role,
    isLocked: this.isLocked(),
    createdAt: this.createdAt,
  };
};

const User = mongoose.model("User", userSchema);
User.ROLES = USER_ROLES;

module.exports = User;
