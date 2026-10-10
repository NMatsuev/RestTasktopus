import { apiRequest, ApiError } from './http.js';

const API_BASE = '/api/tasks';

function buildFormData(task) {
  const formData = new FormData();
  formData.append('title', task.title || '');
  formData.append('description', task.description || '');
  formData.append('status', task.status || 'todo');
  formData.append('dueDate', task.dueDate || '');
  if (task.file) formData.append('attachment', task.file);
  if (task.removeAttachment) formData.append('removeAttachment', 'true');
  return formData;
}

export async function fetchTasks({ status, search } = {}) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (search) params.set('search', search);
  const query = params.toString();
  return apiRequest(`${API_BASE}${query ? `?${query}` : ''}`);
}

export async function fetchTask(id) {
  return apiRequest(`${API_BASE}/${id}`);
}

export async function createTask(task) {
  return apiRequest(API_BASE, { method: 'POST', formData: buildFormData(task) });
}

export async function updateTask(id, task) {
  return apiRequest(`${API_BASE}/${id}`, { method: 'PUT', formData: buildFormData(task) });
}

export async function deleteTask(id) {
  return apiRequest(`${API_BASE}/${id}`, { method: 'DELETE' });
}

export { ApiError };
