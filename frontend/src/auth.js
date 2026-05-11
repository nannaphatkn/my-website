export function decodeToken(token) {
  try {
    let base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = base64.length % 4;
    if (pad) {
      base64 += "=".repeat(4 - pad);
    }
    // Handle URI encoded characters properly
    const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (err) {
    console.error("Token decode error:", err);
    return null;
  }
}

const TOKEN_KEY = "ticket_token";
const ROLE_KEY = "ticket_role";
const NAME_KEY = "ticket_name";
const LAST_ROUTE_KEY = "ticket_last_route";

export function saveSession(loginResponse) {
  localStorage.setItem(TOKEN_KEY, loginResponse.access_token);
  localStorage.setItem(ROLE_KEY, loginResponse.role);
  localStorage.setItem(NAME_KEY, loginResponse.profile_name);
}

export function getSession() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  const payload = decodeToken(token);
  const savedRole = localStorage.getItem(ROLE_KEY);
  const savedName = localStorage.getItem(NAME_KEY);
  if (payload?.exp && payload.exp * 1000 < Date.now()) {
    clearSession();
    return null;
  }
  if (!payload && !savedRole) return null;
  return {
    token,
    id: payload?.sub || null,
    role: payload?.role || savedRole,
    name: payload?.name || savedName
  };
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(NAME_KEY);
  localStorage.removeItem(LAST_ROUTE_KEY);
}

export function saveLastRoute(pathname) {
  if (pathname && pathname !== "/login") localStorage.setItem(LAST_ROUTE_KEY, pathname);
}

export function getLastRoute(role) {
  const saved = localStorage.getItem(LAST_ROUTE_KEY);
  if (saved) return saved;
  return role === "admin" ? "/admin" : "/concerts";
}
