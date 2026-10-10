import { useCallback, useEffect, useState } from 'react';
import ErrorBanner from '../components/ErrorBanner.jsx';
import { fetchUsers, updateUserRole, unlockUser, revokeUserSessions } from './usersApi.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { ApiError } from '../http.js';
import { ROLE_OPTIONS } from '../constants/roleOptions.js'

export default function UsersPanel() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchUsers();
      setUsers(data);
    } catch (err) {
      setError({ message: err instanceof ApiError ? err.message : 'Не удалось загрузить пользователей' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function showNotice(text) {
    setNotice(text);
    setTimeout(() => setNotice(null), 3000);
  }

  async function handleRoleChange(id, role) {
    setError(null);
    try {
      await updateUserRole(id, role);
      showNotice('Роль обновлена');
      await load();
    } catch (err) {
      setError({ message: err instanceof ApiError ? err.message : 'Не удалось изменить роль' });
    }
  }

  async function handleUnlock(id) {
    setError(null);
    try {
      await unlockUser(id);
      showNotice('Аккаунт разблокирован');
      await load();
    } catch (err) {
      setError({ message: err instanceof ApiError ? err.message : 'Не удалось разблокировать аккаунт' });
    }
  }

  async function handleRevokeSessions(id) {
    setError(null);
    try {
      await revokeUserSessions(id);
      showNotice('Сессии пользователя завершены');
    } catch (err) {
      setError({ message: err instanceof ApiError ? err.message : 'Не удалось завершить сессии' });
    }
  }

  return (
    <div className="panel">
      <h2>Пользователи</h2>
      <ErrorBanner error={error} onClose={() => setError(null)} />
      {notice && <div className="notice">{notice}</div>}

      {loading ? (
        <p className="task-list__status">Загрузка...</p>
      ) : (
        <table className="task-list">
          <thead>
            <tr>
              <th>Email</th>
              <th>Роль</th>
              <th>Статус</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSelf = currentUser && u.id === currentUser.id;
              return (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>
                    <select
                      value={u.role}
                      disabled={isSelf}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                    >
                      {ROLE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {u.isLocked ? <span className="badge badge--locked">Заблокирован</span> : <span className="badge badge--done">Активен</span>}
                  </td>
                  <td className="task-actions">
                    {u.isLocked && (
                      <button onClick={() => handleUnlock(u.id)}>Разблокировать</button>
                    )}
                    <button className="danger" onClick={() => handleRevokeSessions(u.id)}>
                      Завершить сессии
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
