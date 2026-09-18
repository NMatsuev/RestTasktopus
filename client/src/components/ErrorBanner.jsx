import React from 'react';

export default function ErrorBanner({ error, onClose }) {
  if (!error) return null;

  const { message, details } = error;

  return (
    <div className="error-banner" role="alert">
      <div className="error-banner__content">
        <strong>Ошибка:</strong> {message}
        {details && details.length > 0 && (
          <ul>
            {details.map((d, i) => (
              <li key={i}>{d.field ? `${d.field}: ${d.message}` : d.message}</li>
            ))}
          </ul>
        )}
      </div>
      <button className="error-banner__close" onClick={onClose} aria-label="Закрыть">
        ×
      </button>
    </div>
  );
}
