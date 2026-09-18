import React, { useEffect, useRef, useState } from 'react';

const STATUS_OPTIONS = [
  { value: 'todo', label: 'Не начато' },
  { value: 'in_progress', label: 'В процессе' },
  { value: 'done', label: 'Выполнено' },
];

const emptyForm = {
  title: '',
  description: '',
  status: 'todo',
  dueDate: '',
  file: null,
  removeAttachment: false,
};

export default function TaskForm({ editingTask, onSubmit, onCancel, submitting, resetToken }) {
  const [form, setForm] = useState(emptyForm);
  const fileInputRef = useRef(null);

  // Re-runs whenever we start/stop editing a task AND after every successful
  // submit (resetToken changes even when editingTask stays null, e.g. when
  // creating several tasks in a row). type="file" inputs are uncontrolled in
  // the DOM, so clearing React state alone doesn't clear the browser's
  // displayed file name — it has to be reset on the element directly.
  useEffect(() => {
    if (editingTask) {
      setForm({
        title: editingTask.title || '',
        description: editingTask.description || '',
        status: editingTask.status || 'todo',
        dueDate: editingTask.dueDate ? editingTask.dueDate.slice(0, 10) : '',
        file: null,
        removeAttachment: false,
      });
    } else {
      setForm(emptyForm);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [editingTask, resetToken]);

  function handleChange(e) {
    const { name, value, type, checked, files } = e.target;
    if (type === 'file') {
      setForm((f) => ({ ...f, file: files[0] || null }));
    } else if (type === 'checkbox') {
      setForm((f) => ({ ...f, [name]: checked }));
    } else {
      setForm((f) => ({ ...f, [name]: value }));
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit(form);
  }

  return (
    <form className="task-form" onSubmit={handleSubmit}>
      <h2>{editingTask ? 'Редактировать задачу' : 'Новая задача'}</h2>

      <label>
        Название *
        <input
          type="text"
          name="title"
          value={form.title}
          onChange={handleChange}
          maxLength={100}
          required
        />
      </label>

      <label>
        Описание
        <textarea
          name="description"
          value={form.description}
          onChange={handleChange}
          maxLength={2000}
          rows={3}
        />
      </label>

      <label>
        Статус
        <select name="status" value={form.status} onChange={handleChange}>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        Срок выполнения
        <input type="date" name="dueDate" value={form.dueDate} onChange={handleChange} />
      </label>

      <label>
        Вложение (PNG, JPEG, GIF, WEBP, PDF, до 5MB)
        <input type="file" name="file" ref={fileInputRef} onChange={handleChange} />
      </label>

      {editingTask && editingTask.attachment && editingTask.attachment.fileName && !form.file && (
        <label className="checkbox-label">
          <input
            type="checkbox"
            name="removeAttachment"
            checked={form.removeAttachment}
            onChange={handleChange}
          />
          Удалить текущее вложение ({editingTask.attachment.originalName})
        </label>
      )}

      <div className="task-form__actions">
        <button type="submit" disabled={submitting}>
          {submitting ? 'Сохранение...' : editingTask ? 'Сохранить' : 'Создать'}
        </button>
        {editingTask && (
          <button type="button" onClick={onCancel} disabled={submitting}>
            Отмена
          </button>
        )}
      </div>
    </form>
  );
}
