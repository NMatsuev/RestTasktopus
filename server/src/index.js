const mongoose = require('mongoose');
const app = require('./app');
const config = require('./config/env');
const logger = require('./utils/logger');
const bootstrapAdmin = require('./utils/bootstrapAdmin');

async function start() {
  try {
    await mongoose.connect(config.mongoUri);
    logger.info('MongoDB подключена');

    await bootstrapAdmin();

    app.listen(config.port, () => {
      logger.info(`Сервер запущен на порту ${config.port}`);
    });
  } catch (err) {
    logger.error({ err }, 'Не удалось запустить сервер');
    process.exit(1);
  }
}

start();
