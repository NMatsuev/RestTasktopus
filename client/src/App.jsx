import React, { useCallback, useEffect, useState } from 'react';
import TaskForm from './components/TaskForm.jsx';
import TaskList from './components/TaskList.jsx';
import ErrorBanner from './components/ErrorBanner.jsx';
import { fetchTasks, createTask, updateTask, deleteTask, ApiError } from './api.js';
import { TASK_STATUSES } from './constants/taskStatus';

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState(null);
  const [resetToken, setResetToken] = useState(0);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchTasks({ status: statusFilter, search });
      setTasks(data);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  function handleError(err) {
    if (err instanceof ApiError) {
      setError({ message: err.message, details: err.details });
    } else {
      setError({ message: 'Не удалось связаться с сервером' });
    }
  }

  function showNotice(text) {
    setNotice(text);
    setTimeout(() => setNotice(null), 3000);
  }

  async function handleSubmit(form) {
    setSubmitting(true);
    setError(null);
    try {
      if (editingTask) {
        await updateTask(editingTask._id, form);
        showNotice('Задача обновлена');
      } else {
        await createTask(form);
        showNotice('Задача создана');
      }
      setEditingTask(null);
      setResetToken((t) => t + 1);
      await loadTasks();
    } catch (err) {
      handleError(err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(task) {
    if (!window.confirm(`Удалить задачу «${task.title}»?`)) return;
    setError(null);
    try {
      await deleteTask(task._id);
      showNotice('Задача удалена');
      await loadTasks();
    } catch (err) {
      handleError(err);
    }
  }

  return (
    <div className="app">
      <header>
        <h1>Менеджер задач</h1>
      </header>

      <ErrorBanner error={error} onClose={() => setError(null)} />
      {notice && <div className="notice">{notice}</div>}

      <div className="app__layout">
        <section className="app__form">
          <TaskForm
            editingTask={editingTask}
            onSubmit={handleSubmit}
            onCancel={() => setEditingTask(null)}
            submitting={submitting}
            resetToken={resetToken}
          />
        </section>
        <section className="app__list">
          <div className="filters">
            <input
              type="text"
              placeholder="Поиск по названию"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Все статусы</option>
              {TASK_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
               {s.label}
              </option>
              ))}
            </select>
          </div>

          <TaskList
            tasks={tasks}
            loading={loading}
            onEdit={setEditingTask}
            onDelete={handleDelete}
          />
        </section>
      </div>
    </div>
  );
}
