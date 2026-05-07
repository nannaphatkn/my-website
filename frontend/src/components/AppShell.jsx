import { LogOut, Music2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { clearSession, getSession } from "../auth";

export default function AppShell({ children }) {
  const navigate = useNavigate();
  const session = getSession();

  function signOut() {
    clearSession();
    navigate("/login");
  }

  return (
    <div className="appShell">
      <header className="topbar">
        <div className="brandLockup">
          <span className="brandMark" aria-hidden="true">
            <Music2 size={20} />
          </span>
          <div>
            <p className="kicker">NodNod Tickets</p>
            <h1>{session?.role === "admin" ? "Admin Dashboard" : "Concert Booking"}</h1>
          </div>
        </div>
        <div className="topbarActions">
          <span className="sessionName">{session?.name}</span>
          <button className="iconButton ghost" onClick={signOut} title="Sign out" type="button">
            <LogOut size={18} />
          </button>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
