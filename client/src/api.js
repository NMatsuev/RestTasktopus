const API_BASE = '/api/tasks';

class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function handleResponse(res) {
  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    const message = (data && data.error) || `Ошибка запроса (${res.status})`;
    throw new ApiError(message, res.status, data ? data.details : null);
  }
  return data;
}

export async function fetchTasks({ status, search } = {}) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (search) params.set('search', search);
  const query = params.toString();

  let res;
  try {
    res = await fetch(`${API_BASE}${query ? `?${query}` : ''}`);
  } catch (err) {
    throw new ApiError('Не удалось связаться с сервером', 0, null);
  }
  return handleResponse(res);
}

export async function fetchTask(id) {
  const res = await fetch(`${API_BASE}/${id}`);
  return handleResponse(res);
}

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

export async function createTask(task) {
  let res;
  try {
    res = await fetch(API_BASE, { method: 'POST', body: buildFormData(task) });
  } catch (err) {
    throw new ApiError('Не удалось связаться с сервером', 0, null);
  }
  return handleResponse(res);
}

export async function updateTask(id, task) {
  let res;
  try {
    res = await fetch(`${API_BASE}/${id}`, { method: 'PUT', body: buildFormData(task) });
  } catch (err) {
    throw new ApiError('Не удалось связаться с сервером', 0, null);
  }
  return handleResponse(res);
}

export async function deleteTask(id) {
  let res;
  try {
    res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
  } catch (err) {
    throw new ApiError('Не удалось связаться с сервером', 0, null);
  }
  return handleResponse(res);
}

export { ApiError };
