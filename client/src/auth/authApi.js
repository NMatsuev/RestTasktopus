import { apiRequest } from '../http.js';
import { setAccessToken, clearTokens } from './tokenStore.js';

export async function register(email, password) {
  return apiRequest('/api/auth/register', { method: 'POST', json: { email, password }, auth: false });
}

export async function login(email, password) {
  // Refresh-токен сюда не попадает: сервер положил его в httpOnly-cookie
  // (Set-Cookie в этом же ответе), и браузер обработал её сам, до того как
  // JS увидел тело ответа.
  const data = await apiRequest('/api/auth/login', { method: 'POST', json: { email, password }, auth: false });
  setAccessToken(data.accessToken);
  return data.user;
}

export async function fetchMe() {
  return apiRequest('/api/auth/me', { method: 'GET' });
}

export async function logout() {
  try {
    // Тело запроса не нужно — сервер сам прочитает refresh-токен из cookie,
    // отозвёт сессию и пришлёт Set-Cookie, очищающий её в браузере.
    await apiRequest('/api/auth/logout', { method: 'POST', auth: false });
  } finally {
    clearTokens();
  }
}

export async function logoutAll() {
  try {
    await apiRequest('/api/auth/logout-all', { method: 'POST' });
  } finally {
    clearTokens();
  }
}

export async function fetchSessions() {
  return apiRequest('/api/auth/sessions', { method: 'GET' });
}

export async function revokeSession(id) {
  return apiRequest(`/api/auth/sessions/${id}`, { method: 'DELETE' });
}

export async function forgotPassword(email) {
  return apiRequest('/api/auth/forgot-password', { method: 'POST', json: { email }, auth: false });
}

export async function resetPassword(email, token, newPassword) {
  return apiRequest('/api/auth/reset-password', {
    method: 'POST',
    json: { email, token, newPassword },
    auth: false,
  });
}
