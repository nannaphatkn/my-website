export function decodeToken(token) {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(window.atob(payload));
  } catch {
    return null;
  }
}

export function saveSession(loginResponse) {
  localStorage.setItem("ticket_token", loginResponse.access_token);
  localStorage.setItem("ticket_role", loginResponse.role);
  localStorage.setItem("ticket_name", loginResponse.profile_name);
}

export function getSession() {
  const token = localStorage.getItem("ticket_token");
  if (!token) return null;
  const payload = decodeToken(token);
  if (!payload || payload.exp * 1000 < Date.now()) {
    clearSession();
    return null;
  }
  return {
    token,
    role: payload.role,
    name: payload.name || localStorage.getItem("ticket_name")
  };
}

export function clearSession() {
  localStorage.removeItem("ticket_token");
  localStorage.removeItem("ticket_role");
  localStorage.removeItem("ticket_name");
}
