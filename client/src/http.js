import {
  getAccessToken,
  setAccessToken,
  triggerForceLogout,
} from "./auth/tokenStore.js";

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function parseResponse(res) {
  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    const message = (data && data.error) || `Ошибка запроса (${res.status})`;
    throw new ApiError(message, res.status, data ? data.details : null);
  }
  return data;
}

// Несколько параллельных запросов не должны вызывать несколько одновременных
// обновлений токена — все они ждут один и тот же промис
let refreshPromise = null;

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      // Refresh-токен мы на клиенте не видим — он в httpOnly-cookie, которую
      // браузер сам приложит благодаря credentials: 'include'. Тело запроса
      // не нужно; сервер прочитает cookie и сам решит, валидна ли сессия
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      });
      const data = await parseResponse(res);
      setAccessToken(data.accessToken);
      return data.accessToken;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/**
 * @param {string} path
 * @param {object} options
 * @param {string} [options.method]
 * @param {object} [options.json] - тело запроса как JSON
 * @param {FormData} [options.formData] - тело запроса как multipart/form-data
 * @param {boolean} [options.auth] - прикладывать ли Authorization-заголовок
 *   и пытаться ли тихо обновить токен при 401 (по умолчанию true)
 */
export async function apiRequest(path, options = {}) {
  const {
    method = "GET",
    json,
    formData,
    auth = true,
    _retried = false,
  } = options;

  const headers = {};
  let body;
  if (formData) {
    body = formData;
  } else if (json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(json);
  }

  if (auth) {
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    // credentials: 'include' — чтобы браузер отправлял и принимал httpOnly
    // cookie с refresh-токеном на /api/auth/*. Для остальных путей cookie
    // всё равно не прикладывается — её Path ограничен на сервере (/api/auth)
    res = await fetch(path, { method, headers, body, credentials: "include" });
  } catch (err) {
    throw new ApiError("Не удалось связаться с сервером", 0);
  }

  if (res.status === 401 && auth && !_retried) {
    try {
      await refreshAccessToken();
    } catch (refreshErr) {
      triggerForceLogout();
      throw refreshErr;
    }
    return apiRequest(path, { ...options, _retried: true });
  }

  return parseResponse(res);
}
