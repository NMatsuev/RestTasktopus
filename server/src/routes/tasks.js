const express = require("express");
const fs = require("fs");
const path = require("path");
const Task = require("../models/Task");
const { upload, UPLOAD_DIR } = require("../middleware/upload");
const { authenticate, authorize } = require("../middleware/auth");
const ApiError = require("../utils/ApiError");
const {
  taskCreateRules,
  taskUpdateRules,
  idParamRule,
  handleValidation,
} = require("../middleware/validators");

const router = express.Router();

// Ролевая модель доступа к задачам:
//  - viewer  — только чтение (GET)
//  - manager — полный CRUD над задачами
//  - admin   — полный CRUD над задачами + управление пользователями (routes/users.js)
// Доступ к задачам вообще требует аутентификации — анонимных запросов нет.
router.use(authenticate);
const canWrite = authorize("admin", "manager");

// Админ может всё; менеджер — только задачи, где он автор.
function canModifyTask(user, task) {
  if (user.role === "admin") return true;
  return Boolean(task.createdBy) && String(task.createdBy) === user.id;
}

// Проверка до обработки тела запроса: 403/404 возвращаются сразу,
// и multer не успевает записать файл, который потом пришлось бы удалять.
function loadTaskForModify(forbiddenMessage) {
  return async (req, res, next) => {
    try {
      const task = await Task.findById(req.params.id);
      if (!task) return next(ApiError.notFound("Задача не найдена"));
      if (!canModifyTask(req.user, task))
        return next(ApiError.forbidden(forbiddenMessage));
      req.task = task;
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

function buildAttachment(file) {
  if (!file) return undefined;
  return {
    originalName: file.originalname,
    fileName: file.filename,
    mimeType: file.mimetype,
    size: file.size,
  };
}

function removeAttachmentFile(attachment) {
  if (attachment && attachment.fileName) {
    const filePath = path.join(UPLOAD_DIR, attachment.fileName);
    fs.unlink(filePath, (err) => {
      if (err && err.code !== "ENOENT") {
        console.error("Не удалось удалить файл вложения:", err);
      }
    });
  }
}

// GET /api/tasks?status=&search=
router.get("/", async (req, res, next) => {
  try {
    const { status, search } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (search) filter.title = { $regex: search, $options: "i" };

    const tasks = await Task.find(filter).sort({ createdAt: -1 });
    res.status(200).json(tasks);
  } catch (err) {
    next(err);
  }
});

// GET /api/tasks/:id
router.get("/:id", idParamRule, handleValidation, async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: "Задача не найдена" });
    }
    res.status(200).json(task);
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks (admin, manager)
router.post(
  "/",
  canWrite,
  upload.single("attachment"),
  taskCreateRules,
  handleValidation,
  async (req, res, next) => {
    try {
      const { title, description, status, dueDate } = req.body;
      const task = new Task({
        title,
        description,
        status,
        dueDate: dueDate || null,
        attachment: buildAttachment(req.file),
        createdBy: req.user.id,
      });
      await task.save();
      res.status(201).json(task);
    } catch (err) {
      next(err);
    }
  },
);

// PUT /api/tasks/:id (admin, manager)
router.put(
  "/:id",
  canWrite,
  idParamRule,
  handleValidation,
  loadTaskForModify("Менеджер может изменять только свои задачи"),
  upload.single("attachment"),
  taskUpdateRules,
  handleValidation,
  async (req, res, next) => {
    try {
      const task = req.task;

      const { title, description, status, dueDate, removeAttachment } =
        req.body;

      if (title !== undefined) task.title = title;
      if (description !== undefined) task.description = description;
      if (status !== undefined) task.status = status;
      if (dueDate !== undefined) task.dueDate = dueDate || null;

      if (req.file) {
        removeAttachmentFile(task.attachment);
        task.attachment = buildAttachment(req.file);
      } else if (removeAttachment === "true") {
        removeAttachmentFile(task.attachment);
        task.attachment = undefined;
      }

      await task.save();
      res.status(200).json(task);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/tasks/:id (admin, manager)
router.delete(
  "/:id",
  canWrite,
  idParamRule,
  handleValidation,
  loadTaskForModify("Менеджер может удалять только свои задачи"),
  async (req, res, next) => {
    try {
      const task = req.task;
      const result = await Task.deleteOne({ _id: task._id });
      if (result.deletedCount === 0) {
        return res.status(404).json({ error: "Задача не найдена" });
      }
      removeAttachmentFile(task.attachment);
      return res.status(200).json({ message: "Задача удалена", id: task._id });
    } catch (err) {
      return next(err);
    }
  },
);

module.exports = router;
