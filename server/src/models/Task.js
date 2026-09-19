const mongoose = require("mongoose");
const { TASK_STATUSES } = require("../constants/taskStatus");

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Название задачи обязательно"],
      trim: true,
      minlength: [1, "Название не может быть пустым"],
      maxlength: [100, "Название не должно превышать 100 символов"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, "Описание не должно превышать 2000 символов"],
      default: "",
    },
    status: {
      type: String,
      enum: {
        values: TASK_STATUSES,
        message: `Статус должен быть одним из: ${TASK_STATUSES.join(", ")}`,
      },
      default: "todo",
    },
    dueDate: {
      type: Date,
      default: null,
    },
    attachment: {
      originalName: { type: String, default: null },
      fileName: { type: String, default: null },
      mimeType: { type: String, default: null },
      size: { type: Number, default: null },
    },
  },
  { timestamps: true },
);

const Task = mongoose.model("Task", taskSchema);
Task.TASK_STATUSES = TASK_STATUSES;

module.exports = Task;
