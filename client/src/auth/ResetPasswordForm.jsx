import { useState } from 'react';
import ErrorBanner from '../components/ErrorBanner.jsx';
import { resetPassword } from './authApi.js';
import { ApiError } from '../http.js';

function readParamsFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return { email: params.get('email') || '', token: params.get('token') || '' };
}

export default function ResetPasswordForm() {
  const [{ email, token }] = useState(readParamsFromUrl);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  function goToLogin() {
    window.history.replaceState({}, '', '/');
    window.location.reload();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError({ message: 'Пароли не совпадают' });
      return;
    }

    setSubmitting(true);
    try {
      await resetPassword(email, token, newPassword);
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError({ message: err.message, details: err.details });
      } else {
        setError({ message: 'Не удалось связаться с сервером' });
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!email || !token) {
    return (
      <div className="auth-form">
        <h2>Сброс пароля</h2>
        <p>Ссылка повреждена: не найден email или токен. Запросите восстановление ещё раз.</p>
        <button type="button" onClick={goToLogin}>
          Вернуться ко входу
        </button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="auth-form">
        <h2>Пароль изменён</h2>
        <p>Теперь можно войти с новым паролем. Все предыдущие сессии были завершены.</p>
        <button type="button" onClick={goToLogin}>
          Перейти ко входу
        </button>
      </div>
    );
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <h2>Новый пароль</h2>
      <p className="auth-form__hint">Для {email}</p>
      <ErrorBanner error={error} onClose={() => setError(null)} />

      <label>
        Новый пароль (не менее 8 символов)
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
      </label>

      <label>
        Повторите пароль
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
      </label>

      <button type="submit" disabled={submitting}>
        {submitting ? 'Сохраняем...' : 'Сохранить новый пароль'}
      </button>
    </form>
  );
}
