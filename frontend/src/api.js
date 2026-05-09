const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

function authHeaders() {
  const token = localStorage.getItem("ticket_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(data?.detail || "Request failed");
  }
  return data;
}

export const api = {
  login: (payload) => request("/api/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  concerts: () => request("/api/concerts"),
  seats: (showtimeId) => request(`/api/showtimes/${showtimeId}/seats`),
  holdSeats: (payload) => request("/api/bookings/hold", { method: "POST", body: JSON.stringify(payload) }),
  confirmPayment: (payload) => request("/api/payments/confirm", { method: "POST", body: JSON.stringify(payload) }),
  adminDashboard: () => request("/api/admin/dashboard"),
  adminConcerts: () => request("/api/admin/concerts"),
  adminInventory: (showtimeId) => {
    const params = new URLSearchParams();
    if (showtimeId) params.set("showtime_id", showtimeId);
    return request(`/api/admin/inventory?${params.toString()}`);
  },
  updateZone: (zoneId, payload) =>
    request(`/api/admin/zones/${zoneId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  cleanup: () => request("/api/admin/cleanup"),
  deleteBooking: (bookingId) => request(`/api/admin/bookings/${bookingId}`, { method: "DELETE" }),
  loyalty: () => request("/api/admin/loyalty"),
  analytics: () => request("/api/admin/analytics"),
  createConcert: (payload) => request("/api/admin/concerts", { method: "POST", body: JSON.stringify(payload) }),
  deleteConcert: (concertId) => request(`/api/admin/concerts/${concertId}`, { method: "DELETE" }),
  revenue: ({ month, year }) => {
    const params = new URLSearchParams();
    if (month) params.set("month", month);
    if (year) params.set("year", year);
    return request(`/api/admin/revenue?${params.toString()}`);
  }
};
