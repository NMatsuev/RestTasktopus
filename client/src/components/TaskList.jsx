import React from 'react';

const STATUS_LABELS = {
  todo: 'Не начато',
  in_progress: 'В процессе',
  done: 'Выполнено',
};

export default function TaskList({ tasks, loading, onEdit, onDelete }) {
  if (loading) {
    return <p className="task-list__status">Загрузка задач...</p>;
  }

  if (!tasks || tasks.length === 0) {
    return <p className="task-list__status">Задач нет. Добавьте первую задачу.</p>;
  }

  return (
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
        {tasks.map((task) => (
          <tr key={task._id}>
            <td>
              <div className="task-title">{task.title}</div>
              {task.description && <div className="task-description">{task.description}</div>}
            </td>
            <td>
              <span className={`badge badge--${task.status}`}>
                {STATUS_LABELS[task.status] || task.status}
              </span>
            </td>
            <td>{task.dueDate ? new Date(task.dueDate).toLocaleDateString('ru-RU') : '—'}</td>
            <td>
              {task.attachment && task.attachment.fileName ? (
                <a
                  href={`/uploads/${task.attachment.fileName}`}
                  target="_blank"
                  rel="noopener noreferrer"
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
        ))}
      </tbody>
    </table>
  );
}
