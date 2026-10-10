const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../src/models/User");

// Тесты работают со своей базой. Намеренно не используем MONGO_URI:
// app.js подгружает server/.env через dotenv, и там MONGO_URI указывает на
// рабочую БД разработки — а clearCollections() ниже удаляет все документы.
const TEST_MONGO_URI =
  process.env.TEST_MONGO_URI || "mongodb://127.0.0.1:27017/taskmanager_test";

// Страховка от потери данных: имя базы обязано содержать "test" или "ci".
function assertSafeTestDb(uri) {
  const dbName = uri.split("?")[0].split("/").pop();
  if (!/(test|ci)/i.test(dbName)) {
    throw new Error(
      `Тесты удаляют все данные, поэтому отказываюсь работать с базой "${dbName}". Имя тестовой базы (TEST_MONGO_URI) должно содержать "test" или "ci".`,
    );
  }
}

async function connectTestDb() {
  assertSafeTestDb(TEST_MONGO_URI);
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(TEST_MONGO_URI);
  }
}

async function clearCollections() {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}

async function disconnectTestDb() {
  await mongoose.connection.close();
}

async function createUser({
  email,
  password = "Password123!",
  role = "viewer",
}) {
  const passwordHash = await bcrypt.hash(password, 4); // низкая стоимость — тесты быстрее
  return User.create({ email, passwordHash, role });
}

module.exports = {
  TEST_MONGO_URI,
  connectTestDb,
  clearCollections,
  disconnectTestDb,
  createUser,
};
