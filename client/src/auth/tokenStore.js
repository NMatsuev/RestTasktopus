// Access-токен храним в памяти (переменная модуля) — он живёт недолго
// (минуты) и пропадает при перезагрузке страницы, что уменьшает окно для
// кражи через XSS.
let accessToken = null;
let forceLogoutListeners = [];

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token) {
  accessToken = token || null;
}

export function clearTokens() {
  setAccessToken(null);
}

export function onForceLogout(listener) {
  forceLogoutListeners.push(listener);
  return () => {
    forceLogoutListeners = forceLogoutListeners.filter((l) => l !== listener);
  };
}

export function triggerForceLogout() {
  clearTokens();
  forceLogoutListeners.forEach((listener) => listener());
}
