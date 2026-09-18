import React from 'react';

const STATUS_LABELS = {
  todo: 'Не начато',
  in_progress: 'В процессе',
  done: 'Выполнено',
};

function isOverdue(task) {
  if (!task.dueDate || task.status === 'done') return false;
  const due = new Date(task.dueDate);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

export default function TaskList({ tasks, loading, onEdit, onDelete }) {
  if (loading) {
    return <p className="task-list__status">Загрузка задач...</p>;
  }

  if (!tasks || tasks.length === 0) {
    return <p className="task-list__status">Задач нет. Добавьте первую задачу.</p>;
  }

  return (
    <div className="task-list-wrapper">
      <table className="task-list">
        <thead>
          <tr>
            <th>Название</th>
            <th>Статус</th>
            <th>Срок</th>
            <th>Вложение</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const overdue = isOverdue(task);
            return (
              <tr key={task._id} className={overdue ? 'task-row--overdue' : undefined}>
                <td>
                  <div className="task-title">{task.title}</div>
                  {task.description && (
                    <div className="task-description">{task.description}</div>
                  )}
                </td>
                <td>
                  <span className={`badge badge--${task.status}`}>
                    {STATUS_LABELS[task.status] || task.status}
                  </span>
                </td>
                <td className={overdue ? 'due-date--overdue' : undefined}>
                  {task.dueDate ? new Date(task.dueDate).toLocaleDateString('ru-RU') : '—'}
                  {overdue && <span className="overdue-tag">Просрочено</span>}
                </td>
                <td>
                  {task.attachment && task.attachment.fileName ? (
                    <a
                      className="attachment-link"
                      href={`/uploads/${task.attachment.fileName}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={task.attachment.originalName}
                    >
                      {task.attachment.originalName}
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="task-actions">
                  <button onClick={() => onEdit(task)}>Изменить</button>
                  <button className="danger" onClick={() => onDelete(task)}>
                    Удалить
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
