import { useState } from 'react';
import ErrorBanner from '../components/ErrorBanner.jsx';
import { useAuth } from './AuthContext.jsx';
import { ApiError } from '../http.js';

export default function RegisterForm({ onSwitchToLogin }) {
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError({ message: 'Пароли не совпадают' });
      return;
    }

    setSubmitting(true);
    try {
      await register(email, password);
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

  if (done) {
    return (
      <div className="auth-form">
        <h2>Регистрация завершена</h2>
        <p>Аккаунт создан с ролью «Наблюдатель». Теперь вы можете войти.</p>
        <button type="button" onClick={onSwitchToLogin}>
          Перейти ко входу
        </button>
      </div>
    );
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <h2>Регистрация</h2>
      <ErrorBanner error={error} onClose={() => setError(null)} />

      <label>
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
        />
      </label>

      <label>
        Пароль (не менее 8 символов)
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
        {submitting ? 'Создаём аккаунт...' : 'Зарегистрироваться'}
      </button>

      <div className="auth-form__links">
        <button type="button" className="link-button" onClick={onSwitchToLogin}>
          Уже есть аккаунт? Войти
        </button>
      </div>
    </form>
  );
}
