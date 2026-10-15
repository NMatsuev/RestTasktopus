export const ROLE_OPTIONS = [
  { value: "viewer", label: "Наблюдатель" },
  { value: "manager", label: "Менеджер" },
  { value: "admin", label: "Администратор" },
];

export const ROLE_LABELS = Object.fromEntries(
  ROLE_OPTIONS.map((s) => [s.value, s.label]),
);
