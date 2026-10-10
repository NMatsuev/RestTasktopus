import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiRequest } from '../http.js';
import { setAccessToken, clearTokens, onForceLogout } from './tokenStore.js';
import {
  login as loginRequest,
  register as registerRequest,
  logout as logoutRequest,
  logoutAll as logoutAllRequest,
  fetchMe,
} from './authApi.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  // При загрузке страницы access-токена в памяти уже нет (он там и не должен
  // сохраняться). Refresh-токен лежит в httpOnly-cookie, которую JS не может
  // прочитать — поэтому мы не можем заранее проверить, есть ли сессия, и
  // просто всегда пробуем тихо обновить токен; если cookie нет или она
  // недействительна, сервер ответит 401, и это просто означает "не вошли".
  const restoreSession = useCallback(async () => {
    try {
      const data = await apiRequest('/api/auth/refresh', { method: 'POST', auth: false });
      setAccessToken(data.accessToken);
      const me = await fetchMe();
      setUser(me);
    } catch (err) {
      clearTokens();
      setUser(null);
    } finally {
      setInitializing(false);
    }
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  useEffect(() => onForceLogout(() => setUser(null)), []);

  async function login(email, password) {
    const loggedInUser = await loginRequest(email, password);
    setUser(loggedInUser);
    return loggedInUser;
  }

  async function register(email, password) {
    return registerRequest(email, password);
  }

  async function logout() {
    await logoutRequest();
    setUser(null);
  }

  async function logoutAll() {
    await logoutAllRequest();
    setUser(null);
  }

  async function refreshMe() {
    const me = await fetchMe();
    setUser(me);
    return me;
  }

  const value = { user, initializing, login, register, logout, logoutAll, refreshMe };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth должен использоваться внутри <AuthProvider>');
  }
  return ctx;
}
