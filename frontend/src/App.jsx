import { Navigate, Route, Routes } from "react-router-dom";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { getLastRoute, getSession, saveLastRoute } from "./auth";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import CustomerBookingPage from "./pages/CustomerBookingPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";

function RoleRoute({ role, children }) {
  const session = getSession();
  if (!session) return <Navigate to="/login" replace />;
  if (session.role !== role) return <Navigate to={session.role === "admin" ? "/admin" : "/concerts"} replace />;
  return children;
}

function HomeRedirect() {
  const session = getSession();
  if (!session) return <Navigate to="/login" replace />;
  return <Navigate to={getLastRoute(session.role)} replace />;
}

export default function App() {
  const location = useLocation();
  useEffect(() => {
    saveLastRoute(location.pathname);
  }, [location.pathname]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/concerts"
        element={
          <RoleRoute role="customer">
            <CustomerBookingPage />
          </RoleRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <RoleRoute role="admin">
            <AdminDashboard />
          </RoleRoute>
        }
      />
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}
