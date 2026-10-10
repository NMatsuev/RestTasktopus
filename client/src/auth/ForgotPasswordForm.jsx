import { useState } from 'react';
import ErrorBanner from '../components/ErrorBanner.jsx';
import { forgotPassword } from './authApi.js';
import { ApiError } from '../http.js';

export default function ForgotPasswordForm({ onSwitchToLogin }) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await forgotPassword(email);
      setMessage(res.message);
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
      <h2>Восстановление доступа</h2>
      <ErrorBanner error={error} onClose={() => setError(null)} />
      {message && <div className="notice">{message}</div>}

      <label>
        Email
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>

      <button type="submit" disabled={submitting}>
        {submitting ? 'Отправляем...' : 'Отправить ссылку для сброса'}
      </button>

      <div className="auth-form__links">
        <button type="button" className="link-button" onClick={onSwitchToLogin}>
          Вернуться ко входу
        </button>
      </div>
    </form>
  );
}
