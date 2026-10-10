import { apiRequest } from '../http.js';

export async function fetchUsers() {
  return apiRequest('/api/users', { method: 'GET' });
}

export async function updateUserRole(id, role) {
  return apiRequest(`/api/users/${id}/role`, { method: 'PATCH', json: { role } });
}

export async function unlockUser(id) {
  return apiRequest(`/api/users/${id}/unlock`, { method: 'POST' });
}

export async function revokeUserSessions(id) {
  return apiRequest(`/api/users/${id}/revoke-sessions`, { method: 'POST' });
}
