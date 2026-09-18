const express = require('express');
const fs = require('fs');
const path = require('path');
const Task = require('../models/Task');
const { upload, UPLOAD_DIR } = require('../middleware/upload');
const {
  taskCreateRules,
  taskUpdateRules,
  idParamRule,
  handleValidation,
} = require('../middleware/validators');

const router = express.Router();

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
      if (err && err.code !== 'ENOENT') {
        console.error('Не удалось удалить файл вложения:', err);
      }
    });
  }
}

// GET /api/tasks?status=&search=
router.get('/', async (req, res, next) => {
  try {
    const { status, search } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (search) filter.title = { $regex: search, $options: 'i' };

    const tasks = await Task.find(filter).sort({ createdAt: -1 });
    res.status(200).json(tasks);
  } catch (err) {
    next(err);
  }
});

// GET /api/tasks/:id
router.get('/:id', idParamRule, handleValidation, async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Задача не найдена' });
    }
    res.status(200).json(task);
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks
router.post(
  '/',
  upload.single('attachment'),
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
      });
      await task.save();
      res.status(201).json(task);
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/tasks/:id
router.put(
  '/:id',
  idParamRule,
  upload.single('attachment'),
  taskUpdateRules,
  handleValidation,
  async (req, res, next) => {
    try {
      const task = await Task.findById(req.params.id);
      if (!task) {
        if (req.file) removeAttachmentFile(buildAttachment(req.file));
        return res.status(404).json({ error: 'Задача не найдена' });
      }

      const { title, description, status, dueDate, removeAttachment } = req.body;

      if (title !== undefined) task.title = title;
      if (description !== undefined) task.description = description;
      if (status !== undefined) task.status = status;
      if (dueDate !== undefined) task.dueDate = dueDate || null;

      if (req.file) {
        removeAttachmentFile(task.attachment);
        task.attachment = buildAttachment(req.file);
      } else if (removeAttachment === 'true') {
        removeAttachmentFile(task.attachment);
        task.attachment = undefined;
      }

      await task.save();
      res.status(200).json(task);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/tasks/:id
router.delete('/:id', idParamRule, handleValidation, async (req, res, next) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Задача не найдена' });
    }
    removeAttachmentFile(task.attachment);
    res.status(200).json({ message: 'Задача удалена', id: task._id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
