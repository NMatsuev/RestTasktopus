require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const config = require("./config/env");
const requestLogger = require("./middleware/requestLogger");
const { bindRequestContext } = require("./utils/requestContext");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");
const { UPLOAD_DIR } = require("./middleware/upload");
const authRouter = require("./routes/auth");
const usersRouter = require("./routes/users");
const tasksRouter = require("./routes/tasks");

const app = express();

// За обратным прокси (nginx в docker-compose) доверяем заголовку
// X-Forwarded-For, иначе req.ip всегда будет адресом контейнера nginx —
// это важно и для rate-limit'а, и для структурированных логов.
app.set("trust proxy", 1);

// credentials: true обязателен, чтобы браузер разрешил отправку/приём cookie
// с refresh-токеном при межпортовых запросах (localhost:3000 → localhost:5000
// в режиме разработки без nginx) — и именно поэтому origin не может быть '*'
// (см. config/env.js): спецификация CORS прямо запрещает сочетание wildcard
// origin с credentialed-запросами.
app.use(cors({ origin: config.clientOrigin, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(requestLogger);
app.use(bindRequestContext);

app.use("/uploads", express.static(UPLOAD_DIR));

app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/tasks", tasksRouter);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
