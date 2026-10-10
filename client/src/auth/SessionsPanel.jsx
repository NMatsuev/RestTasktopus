import { useCallback, useEffect, useState } from 'react';
import ErrorBanner from '../components/ErrorBanner.jsx';
import { fetchSessions, revokeSession } from './authApi.js';
import { useAuth } from './AuthContext.jsx';
import { ApiError } from '../http.js';

export default function SessionsPanel() {
  const { logoutAll } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSessions();
      setSessions(data);
    } catch (err) {
      setError({ message: err instanceof ApiError ? err.message : 'Не удалось загрузить сессии' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRevoke(id) {
    setError(null);
    try {
      await revokeSession(id);
      await load();
    } catch (err) {
      setError({ message: err instanceof ApiError ? err.message : 'Не удалось отозвать сессию' });
    }
  }

  async function handleLogoutAll() {
    if (!window.confirm('Завершить все сессии на всех устройствах? Потребуется повторный вход.')) return;
    await logoutAll();
  }

  return (
    <div className="panel">
      <div className="panel__header">
        <h2>Активные подключения</h2>
        <button className="danger" onClick={handleLogoutAll}>
          Выйти со всех устройств
        </button>
      </div>

      <ErrorBanner error={error} onClose={() => setError(null)} />

      {loading ? (
        <p className="task-list__status">Загрузка...</p>
      ) : sessions.length === 0 ? (
        <p className="task-list__status">Активных сессий нет.</p>
      ) : (
        <table className="task-list">
          <thead>
            <tr>
              <th>Устройство / браузер</th>
              <th>IP-адрес</th>
              <th>Начало сессии</th>
              <th>Истекает</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id}>
                <td className="session-ua">{s.userAgent || '—'}</td>
                <td>{s.ip || '—'}</td>
                <td>{new Date(s.createdAt).toLocaleString('ru-RU')}</td>
                <td>{new Date(s.expiresAt).toLocaleString('ru-RU')}</td>
                <td>
                  <button className="danger" onClick={() => handleRevoke(s.id)}>
                    Отозвать
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
