module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.js"],
  verbose: true,
  // Тесты задействуют реальную (тестовую) MongoDB, поэтому не распараллеливаем
  // внутри одного процесса агрессивно — npm run test уже запускает Jest с
  // --runInBand, это предсказуемее для CI.
  testTimeout: 20000,
};
