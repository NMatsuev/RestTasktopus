export const TASK_STATUSES = [
  { value: "todo", label: "Не начато" },
  { value: "in_progress", label: "В процессе" },
  { value: "done", label: "Выполнено" },
];

export const STATUS_LABELS = Object.fromEntries(
  TASK_STATUSES.map((s) => [s.value, s.label]),
);
