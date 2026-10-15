import { useState } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext.jsx';
import LoginForm from './auth/LoginForm.jsx';
import RegisterForm from './auth/RegisterForm.jsx';
import ForgotPasswordForm from './auth/ForgotPasswordForm.jsx';
import ResetPasswordForm from './auth/ResetPasswordForm.jsx';
import SessionsPanel from './auth/SessionsPanel.jsx';
import UsersPanel from './admin/UsersPanel.jsx';
import TasksPage from './tasks/TasksPage.jsx';
import { ROLE_LABELS } from './constants/roleOptions.js';

function AuthGate() {
  const [view, setView] = useState('login'); // 'login' | 'register' | 'forgot'

  if (view === 'register') {
    return <RegisterForm onSwitchToLogin={() => setView('login')} />;
  }
  if (view === 'forgot') {
    return <ForgotPasswordForm onSwitchToLogin={() => setView('login')} />;
  }
  return (
    <LoginForm
      onSwitchToRegister={() => setView('register')}
      onSwitchToForgot={() => setView('forgot')}
    />
  );
}

function AuthenticatedShell() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState('tasks'); // 'tasks' | 'sessions' | 'users'

  function tabClass(name) {
    return tab === name ? 'nav-tab nav-tab--active' : 'nav-tab';
  }

  return (
    <div className="app">
      <header className="app__header">
        <h1>Менеджер задач</h1>
        <div className="app__user">
          <span className="app__user-email">{user.email}</span>
          <span className="badge badge--role">{ROLE_LABELS[user.role] || user.role}</span>
          <button className="danger" onClick={logout}>
            Выйти
          </button>
        </div>
      </header>

      <nav className="app__nav">
        <button className={tabClass('tasks')} onClick={() => setTab('tasks')}>
          Задачи
        </button>
        <button className={tabClass('sessions')} onClick={() => setTab('sessions')}>
          Сессии
        </button>
        {user.role === 'admin' && (
          <button className={tabClass('users')} onClick={() => setTab('users')}>
            Пользователи
          </button>
        )}
      </nav>

      {tab === 'tasks' && <TasksPage />}
      {tab === 'sessions' && <SessionsPanel />}
      {tab === 'users' && user.role === 'admin' && <UsersPanel />}
    </div>
  );
}

function AppShell() {
  const { user, initializing } = useAuth();

  // Ссылка на восстановление пароля из письма ведёт сюда же (SPA без
  // отдельного роутера) — обрабатываем её независимо от статуса входа
  if (window.location.pathname === '/reset-password') {
    return (
      <div className="app app--centered">
        <ResetPasswordForm />
      </div>
    );
  }

  if (initializing) {
    return (
      <div className="app app--centered">
        <p className="task-list__status">Загрузка...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app app--centered">
        <header>
          <h1>Менеджер задач</h1>
        </header>
        <AuthGate />
      </div>
    );
  }

  return <AuthenticatedShell />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
