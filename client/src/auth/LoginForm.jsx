import { useState } from 'react';
import ErrorBanner from '../components/ErrorBanner.jsx';
import { useAuth } from './AuthContext.jsx';
import { ApiError } from '../http.js';

export default function LoginForm({ onSwitchToRegister, onSwitchToForgot }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      if (err instanceof ApiError) {
        setError({ message: err.message });
      } else {
        setError({ message: 'Не удалось связаться с сервером' });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <h2>Вход</h2>
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
        Пароль
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </label>

      <button type="submit" disabled={submitting}>
        {submitting ? 'Входим...' : 'Войти'}
      </button>

      <div className="auth-form__links">
        <button type="button" className="link-button" onClick={onSwitchToForgot}>
          Забыли пароль?
        </button>
        <button type="button" className="link-button" onClick={onSwitchToRegister}>
          Нет аккаунта? Зарегистрироваться
        </button>
      </div>
    </form>
  );
}
