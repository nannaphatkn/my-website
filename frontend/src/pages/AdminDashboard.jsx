import { CalendarPlus, LogOut, Music2, RefreshCw, Trash2, Edit } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";

import { api } from "../api";
import { clearSession, getSession } from "../auth";
import ConfirmDialog from "../components/ConfirmDialog.jsx";

const sections = [
  ["dashboard", "Dashboard", "Overview", "📊"],
  ["events", "Event Management", "Management", "🎵"],
  ["inventory", "Venue & Seating", "Management", "🏟"],
  ["cleanup", "Ticket & Sales", "Management", "🎫"],
  ["revenue", "User Management", "Analytics", "👥"],
  ["loyalty", "Reports", "Analytics", "📈"],
  ["analytics", "Analytics", "Analytics", "📊"],
];

const monthOptions = [
  ["", "All months"],
  ["1", "January"],
  ["2", "February"],
  ["3", "March"],
  ["4", "April"],
  ["5", "May"],
  ["6", "June"],
  ["7", "July"],
  ["8", "August"],
  ["9", "September"],
  ["10", "October"],
  ["11", "November"],
  ["12", "December"],
];

const analyticsReportOptions = [
  ["1", "Report 1: Monthly Revenue per Concert"],
  ["2", "Report 2: Seat Occupancy by Zone"],
  ["3", "Report 3: Average Ticket Price by Genre per Quarter"],
  ["4", "Report 4: Top 5 Concerts by Booking Rate"],
  ["5", "Report 5: Booking Status Summary"],
  ["6", "Report 6: Most Popular Payment Methods"],
  ["7", "Report 7: Monthly New Users"],
  ["8", "Report 8: Top 10 Customers by Spending"],
  ["9", "Report 9: Available Seats by Showtime"],
  ["10", "Report 10: Refund Amount by Quarter"],
  ["11", "Report 11: Busiest Booking Hours"],
  ["12", "Report 12: Admin Concert Assignments"],
  ["13", "Report 13: Venue Ticket Price Range"],
  ["14", "Report 14: Average Tickets per Booking"],
];

function emptyForm() {
  return {
    title: "",
    artist: "",
    genre: "Indie Rock",
    description: "",
    poster_url: "",
    venue_name: "",
    venue_city: "",
    venue_capacity: 200,
    show_date: "",
    show_time: "19:30",
    zones: [{ zone_name: "VIP", price: 4500, total_seat: 200 }],
  };
}

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function dateText(value) {
  if (!value) return "TBA";
  if (typeof value === "string" && value.length === 10) return value;
  return new Date(value).toLocaleDateString();
}

function Status({ value }) {
  return (
    <span className={`statusPill ${String(value || "regular").toLowerCase()}`}>
      {value}
    </span>
  );
}

function Metric({ tone = "green", glyph, label, value, note }) {
  return (
    <div className={`consoleMetric ${tone}`}>
      <span className="metricIcon">{glyph}</span>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}

function Panel({ title, note, children, action }) {
  return (
    <section className="consolePanel">
      <div className="panelHeader horizontal">
        <div>
          <h2>{title}</h2>
          {note && <small>{note}</small>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Progress({ value, tone = "purple" }) {
  const width = Math.max(4, Math.min(100, Number(value) || 0));
  return (
    <span className="progressTrack">
      <span className={`progressFill ${tone}`} style={{ width: width + "%" }} />
    </span>
  );
}

function SalesChart() {
  const pts = [20,35,25,50,40,65,80,55,70,60,45,75,90,70,55,65,50,40,60,55];
  const h = 200, w = 500, pad = 30;
  const max = Math.max(...pts);
  const coords = pts.map((p,i) => [pad + i*(w-2*pad)/(pts.length-1), h-pad-(p/max)*(h-2*pad)]);
  const line = coords.map((c,i)=>((i===0?'M':'L')+c[0]+','+c[1])).join(' ');
  const area = line + ` L${coords[coords.length-1][0]},${h-pad} L${coords[0][0]},${h-pad} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="salesChartSvg">
      <defs>
        <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a855f7" stopOpacity="0.4"/>
          <stop offset="100%" stopColor="#a855f7" stopOpacity="0.02"/>
        </linearGradient>
      </defs>
      {[0,1,2,3,4].map(i=>(<line key={i} x1={pad} x2={w-pad} y1={pad+i*(h-2*pad)/4} y2={pad+i*(h-2*pad)/4} stroke="rgba(255,255,255,0.06)" />))}
      <path d={area} fill="url(#cg)" />
      <path d={line} fill="none" stroke="#a855f7" strokeWidth="2.5" />
      {['12AM','3AM','6AM','9AM','12PM','3PM','6PM','9PM','11PM'].map((t,i)=>(
        <text key={i} x={pad+i*(w-2*pad)/8} y={h-8} fill="rgba(255,255,255,0.35)" fontSize="9" textAnchor="middle">{t}</text>
      ))}
    </svg>
  );
}

function Required({ children }) {
  return (
    <span>
      {children} <strong className="requiredStar">*</strong>
    </span>
  );
}

function pct(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function reportValue(row, keys, fallback = "-") {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null && row?.[key] !== "") return row[key];
  }
  return fallback;
}

function MiniBars({ rows = [], valueKey, labelKey, format = (value) => value }) {
  const max = Math.max(...rows.map((row) => Number(row[valueKey] || 0)), 1);
  return (
    <div className="miniBars">
      {rows.slice(0, 6).map((row, index) => {
        const value = Number(row[valueKey] || 0);
        return (
          <div className="miniBarRow" key={index}>
            <span>{reportValue(row, [labelKey])}</span>
            <div><i style={{ width: `${Math.max(4, (value / max) * 100)}%` }} /></div>
            <strong>{format(value)}</strong>
          </div>
        );
      })}
      {!rows.length && <p className="muted">No data yet.</p>}
    </div>
  );
}

function AnalyticsTable({ rows = [], columns }) {
  return (
    <div className="tableWrap analyticsTableWrap">
      <table className="consoleTable analyticsTable">
        <thead>
          <tr>
            {columns.map((column) => <th key={column.label}>{column.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 8).map((row, index) => (
            <tr key={index}>
              {columns.map((column) => (
                <td key={column.label}>{column.render ? column.render(row) : reportValue(row, column.keys)}</td>
              ))}
            </tr>
          ))}
          <tr hidden={rows.length}>
            <td colSpan={columns.length}>No data yet.</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function AnalyticsReport({ number, title, question, children }) {
  return (
    <div className={`analyticsReport report-${number}`}>
      <Panel
        title={`Report ${number}: ${title}`}
        note={question}
      >
        {children}
      </Panel>
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const session = getSession();
  const currentYear = new Date().getFullYear();
  const years = useMemo(
    () =>
      Array.from({ length: 6 }, (_, index) => String(currentYear - 2 + index)),
    [currentYear],
  );
  const [active, setActive] = useState("dashboard");
  const [notice, setNotice] = useState("");
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [filters, setFilters] = useState({
    month: "",
    year: String(currentYear),
  });
  const [concerts, setConcerts] = useState([]);
  const [dashboard, setDashboard] = useState({
    metrics: {},
    recent_bookings: [],
  });
  const [inventory, setInventory] = useState({ showtimes: [], zones: [] });
  const [selectedShowtime, setSelectedShowtime] = useState("");
  const [inventoryEdits, setInventoryEdits] = useState({});
  const [cleanup, setCleanup] = useState({ stale_bookings: [] });
  const [loyalty, setLoyalty] = useState([]);
  const [revenue, setRevenue] = useState({
    rows: [],
    total_revenue: 0,
    total_tickets: 0,
  });
  const [analytics, setAnalytics] = useState({});
  const [selectedAnalyticsReport, setSelectedAnalyticsReport] = useState("1");
  const [form, setForm] = useState(emptyForm());
  const [editingConcert, setEditingConcert] = useState(null);
  const [editForm, setEditForm] = useState({ title: "", artist: "", genre: "", description: "", poster_url: "" });

  function startEdit(concert) {
    setEditingConcert(concert);
    setEditForm({
      title: concert.title || "",
      artist: concert.artist || "",
      genre: concert.genre || "",
      description: concert.description || "",
      poster_url: concert.poster_url || ""
    });
  }

  async function saveEdit(event) {
    event.preventDefault();
    setNotice("");
    try {
      await api.updateConcert(editingConcert.concert_id, editForm);
      setEditingConcert(null);
      await loadAll();
      setNotice("Concert updated.");
    } catch (err) {
      setNotice(err.message);
    }
  }

  async function handleUpload(e, setField) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      setNotice("Uploading...");
      const res = await api.uploadPoster(file);
      setField(res.poster_url);
      setNotice("Poster uploaded successfully!");
    } catch (err) {
      setNotice(err.message);
    }
  }

  const title = sections.find(([id]) => id === active)?.[1] || "Dashboard";
  const topConcert = revenue.rows[0];
  const paidBookings = revenue.rows.reduce(
    (sum, row) => sum + Number(row.paid_bookings || 0),
    0,
  );
  const avgBooking = paidBookings
    ? Math.round(revenue.total_revenue / paidBookings)
    : 0;
  const vipCustomers = loyalty.filter((row) => row.loyalty_status === "VIP");
  const regularCustomers = loyalty.length - vipCustomers.length;
  const bestSellingConcerts = useMemo(
    () =>
      [...concerts]
        .sort(
          (a, b) =>
            Number(b.sold_tickets || 0) - Number(a.sold_tickets || 0) ||
            Number(b.booking_rate || 0) - Number(a.booking_rate || 0),
        )
        .slice(0, 5),
    [concerts],
  );

  let confirmTitle = "Confirm Delete";
  let confirmBody = "";
  if (confirmTarget?.type === "concert")
    confirmBody = `Delete ${confirmTarget.item.title}?`;
  if (confirmTarget?.type === "booking")
    confirmBody = `Delete booking #${confirmTarget.item.booking_id}?`;
  if (confirmTarget?.type === "privilege") {
    confirmTitle = "Confirm Privilege";
    confirmBody = `Assign VIP privilege review for ${confirmTarget.item.customer}?`;
  }

  async function loadAll(nextFilters = filters, showtime = selectedShowtime, isInitial = false) {
    const [
      concertData,
      revenueData,
      dashboardData,
      inventoryData,
      cleanupData,
      loyaltyData,
      analyticsData,
    ] = await Promise.all([
      api.adminConcerts(),
      api.revenue(nextFilters),
      api.adminDashboard(),
      api.adminInventory(showtime),
      api.cleanup(),
      api.loyalty(),
      api.analytics(),
    ]);
    setConcerts(concertData);
    setRevenue(revenueData);
    setDashboard(dashboardData);
    setInventory(inventoryData);
    setCleanup(cleanupData);
    setLoyalty(loyaltyData);
    setAnalytics(analyticsData);
  }

  useEffect(() => {
    loadAll(filters, selectedShowtime, true).catch((err) => setNotice(err.message));
  }, []);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateZone(index, field, value) {
    setForm((current) => ({
      ...current,
      zones: current.zones.map((zone, zoneIndex) =>
        zoneIndex === index ? { ...zone, [field]: value } : zone,
      ),
    }));
  }

  async function refresh() {
    setNotice("");
    await loadAll()
      .then(() => setNotice("Dashboard updated."))
      .catch((err) => setNotice(err.message));
  }

  async function refreshRevenue(nextFilters) {
    setFilters(nextFilters);
    await api
      .revenue(nextFilters)
      .then(setRevenue)
      .catch((err) => setNotice(err.message));
  }

  async function changeShowtime(value) {
    setSelectedShowtime(value);
    await api
      .adminInventory(value)
      .then(setInventory)
      .catch((err) => setNotice(err.message));
  }

  async function createConcert(event) {
    event.preventDefault();
    setNotice("");
    try {
      await api.createConcert({
        ...form,
        venue_capacity: Number(form.venue_capacity),
        zones: form.zones.map((zone) => ({
          zone_name: zone.zone_name,
          price: Number(zone.price),
          total_seat: Number(zone.total_seat),
        })),
      });
      setForm(emptyForm());
      await loadAll();
      setNotice("Concert created.");
    } catch (err) {
      setNotice(err.message);
    }
  }

  async function saveZone(zone) {
    const edit = inventoryEdits[zone.zone_id] || {};
    try {
      await api.updateZone(zone.zone_id, {
        price: Number(edit.price ?? zone.price),
        total_seat: Number(edit.total_seat ?? zone.total_seat),
      });
      setInventoryEdits({});
      await changeShowtime(selectedShowtime);
      setNotice("Inventory updated.");
    } catch (err) {
      setNotice(err.message);
    }
  }

  async function runConfirm() {
    try {
      if (confirmTarget?.type === "concert")
        await api.deleteConcert(confirmTarget.item.concert_id);
      if (confirmTarget?.type === "booking")
        await api.deleteBooking(confirmTarget.item.booking_id);
      if (confirmTarget?.type === "privilege")
        setNotice(`${confirmTarget.item.customer} marked for VIP review.`);
      setConfirmTarget(null);
      await loadAll();
    } catch (err) {
      setNotice(err.message);
    }
  }

  return (
    <main className="consoleShell">
      <aside className="consoleSidebar">
        <div className="consoleBrand">
          <span>
            <Music2 size={20} />
          </span>
          <div>
            <strong>NodNod Tickets</strong>
            <small>Admin Console</small>
          </div>
        </div>
        <nav className="consoleNav">
          {["Overview", "Management", "Analytics"].map((group) => (
            <div className="navGroup" key={group}>
              <p>{group}</p>
              {sections
                .filter((section) => section[2] === group)
                .map((section) => {
                  const id = section[0];
                  const label = section[1];
                  const glyph = section[3];
                  return (
                    <button
                      className={active === id ? "active" : ""}
                      key={id}
                      onClick={() => setActive(id)}
                      type="button"
                    >
                      <span className="navGlyph">{glyph}</span>
                      {label}
                    </button>
                  );
                })}
            </div>
          ))}
        </nav>
        <div className="consoleUser">
          <span>{session?.name?.charAt(0) || "A"}</span>
          <div>
            <strong>{session?.name || "Admin User"}</strong>
            <small>Super Admin</small>
          </div>
          <button
            className="iconButton"
            onClick={() => {
              clearSession();
              navigate("/login");
            }}
            title="Sign out"
            type="button"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <section className="consoleMain">
        <header className="consoleHeader">
          {active === 'dashboard' ? (
            <div className="adminGreeting">
              <div><h1>Hello Admin👋</h1><p>Good Morning</p></div>
              <div className="headerRight">
                <div className="headerSearch"><span>🔍</span><input placeholder="Search..." /></div>
                <span className="headerBell">🔔</span>
                <div className="headerProfile"><img src="https://ui-avatars.com/api/?name=Admin&background=6c5ce7&color=fff&size=36" alt="" /><div><strong>{session?.name || 'Robert Allen'}</strong><small>HR Manager</small></div></div>
              </div>
            </div>
          ) : (
            <>
              <div><h1>{title}</h1><p>Concert booking system overview</p></div>
              <div className="consoleActions">
                <button className="button secondary compact" onClick={refresh} type="button"><RefreshCw size={16} /> Refresh</button>
                <button className="button primary compact" onClick={() => setActive('events')} type="button"><CalendarPlus size={16} /> New Concert</button>
              </div>
            </>
          )}
        </header>
        {notice && <p className="consoleNotice">{notice}</p>}

        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
          >
            {active === "dashboard" && (
              <div className="consoleStack">
                <div className="metricGrid four">
                  <div className="statCard"><div className="statIcon purple">💰</div><div><small>TOTAL REVENUE</small><strong>{dashboard.metrics.total_revenue || 560}</strong></div><span className="statBadge up">▲ 12%</span></div>
                  <div className="statCard"><div className="statIcon blue">🎫</div><div><small>TICKETS SOLD</small><strong>{dashboard.metrics.active_bookings || 1050}</strong></div><span className="statBadge down">▼ 3%</span></div>
                  <div className="statCard"><div className="statIcon green">👥</div><div><small>Active Users</small><strong>{dashboard.metrics.upcoming_shows || 470}</strong></div><span className="statBadge down">▼ 5%</span></div>
                  <div className="statCard"><div className="statIcon orange">💳</div><div><small>Pending Payment</small><strong>{dashboard.metrics.vip_customers || 250}</strong></div><span className="statBadge up">▲ 11%</span></div>
                </div>
                <div className="dashTwoCol">
                  <div className="chartCard">
                    <div className="chartHeader"><span>📈 Sales Velocity</span><div className="chartMeta"><span>Revenue (฿)</span><span className="chartBadge">● ฿2,45,000</span></div></div>
                    <SalesChart />
                  </div>
                  <div className="bestSellingCard">
                    <div className="bestHeader"><span>⭐ Best Selling Concerts</span><button className="viewAllBtn">View All</button></div>
                    {(bestSellingConcerts.length ? bestSellingConcerts : concerts.slice(0, 5)).map((c,i) => {
                      const sold = Number(c.sold_tickets || 0);
                      const pct = Math.min(100, Math.round(Number(c.booking_rate || 0)));
                      return (
                        <div className="bestRow" key={i}>
                          <div className="bestInfo"><div className="bestAvatar">{i + 1}</div><div><strong>{c.title}</strong><small>{c.artist}</small></div></div>
                          <div className="bestBar"><div className="bestBarFill" style={{width:pct+'%'}}/></div>
                          <span className="bestPct">{sold} sold</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="dashTwoCol" style={{ marginTop: "24px" }}>
                  <div className="recentPanel">
                    <div className="recentHeader"><h3>Revenue Report</h3></div>
                    <AnalyticsTable
                      rows={analytics.monthly_revenue_per_concert || []}
                      columns={[
                        { label: "Concert", keys: ["concert"] },
                        { label: "Bookings", keys: ["paid_bookings"] },
                        { label: "Revenue", render: (row) => money(row.total_revenue) },
                      ]}
                    />
                  </div>
                  <div className="recentPanel">
                    <div className="recentHeader"><h3>Top Customers by Spending</h3></div>
                    <AnalyticsTable
                      rows={analytics.top_customers_by_spending || []}
                      columns={[
                        { label: "Customer", keys: ["customer"] },
                        { label: "Bookings", keys: ["paid_bookings"] },
                        { label: "Spend", render: (row) => money(row.total_spending) },
                      ]}
                    />
                  </div>
                  <div className="recentPanel">
                    <div className="recentHeader"><h3>Seat Occupancy by Zone</h3></div>
                    <AnalyticsTable
                      rows={analytics.seat_occupancy_by_zone || []}
                      columns={[
                        { label: "Zone", keys: ["zone_name"] },
                        { label: "Total", keys: ["total_seat"] },
                        { label: "Occupancy", render: (row) => pct(row.occupancy_rate) },
                      ]}
                    />
                  </div>
                  <div className="recentPanel">
                    <div className="recentHeader"><h3>Booking Status Summary</h3></div>
                    <AnalyticsTable
                      rows={analytics.booking_status_summary || []}
                      columns={[
                        { label: "Status", render: (row) => <Status value={row.booking_status} /> },
                        { label: "Bookings", keys: ["total_bookings"] },
                        { label: "Share", render: (row) => pct(row.percentage) },
                      ]}
                    />
                  </div>
                  <div className="recentPanel">
                    <div className="recentHeader"><h3>Popular Payment Methods</h3></div>
                    <AnalyticsTable
                      rows={analytics.popular_payment_methods || []}
                      columns={[
                        { label: "Method", keys: ["payment_method"] },
                        { label: "Uses", keys: ["usage_count"] },
                        { label: "Amount", render: (row) => money(row.total_amount) },
                      ]}
                    />
                  </div>
                  <div className="recentPanel">
                    <div className="recentHeader"><h3>Top Concerts by Rate</h3></div>
                    <AnalyticsTable
                      rows={analytics.top_concerts_by_booking_rate || []}
                      columns={[
                        { label: "Concert", keys: ["concert"] },
                        { label: "Rate", render: (row) => pct(row.booking_rate) },
                      ]}
                    />
                  </div>
                </div>
              </div>
            )}

        {active === "events" && (
          <div className="managementGrid">
            <Panel title="Add New Concert" note="Required fields use asterisk">
              <form className="adminForm compactForm" onSubmit={createConcert}>
                <div className="formGrid">
                  <label>
                    <Required>Concert Name</Required>
                    <input
                      value={form.title}
                      onChange={(event) =>
                        updateField("title", event.target.value)
                      }
                      required
                    />
                  </label>
                  <label>
                    <Required>Artist Name</Required>
                    <input
                      value={form.artist}
                      onChange={(event) =>
                        updateField("artist", event.target.value)
                      }
                      required
                    />
                  </label>
                  <label>
                    <span>Event Type</span>
                    <input
                      value={form.genre}
                      onChange={(event) =>
                        updateField("genre", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    <Required>Show Time</Required>
                    <input
                      type="time"
                      value={form.show_time}
                      onChange={(event) =>
                        updateField("show_time", event.target.value)
                      }
                      required
                    />
                  </label>
                  <label>
                    <Required>Date</Required>
                    <input
                      type="date"
                      value={form.show_date}
                      onChange={(event) =>
                        updateField("show_date", event.target.value)
                      }
                      required
                    />
                  </label>
                  <label>
                    <span>Poster URL</span>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <input
                        value={form.poster_url}
                        onChange={(event) =>
                          updateField("poster_url", event.target.value)
                        }
                        placeholder="/posters/default.jpg"
                        style={{ flex: 1 }}
                      />
                      <label className="button secondary compact" style={{ margin: 0, cursor: "pointer", display: "flex", alignItems: "center" }}>
                        Upload
                        <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleUpload(e, (val) => updateField("poster_url", val))} />
                      </label>
                    </div>
                  </label>
                  <label>
                    <Required>Venue</Required>
                    <input
                      value={form.venue_name}
                      onChange={(event) =>
                        updateField("venue_name", event.target.value)
                      }
                      required
                    />
                  </label>
                  <label>
                    <Required>City</Required>
                    <input
                      value={form.venue_city}
                      onChange={(event) =>
                        updateField("venue_city", event.target.value)
                      }
                      required
                    />
                  </label>
                  <label>
                    <span>Venue Capacity</span>
                    <input
                      type="number"
                      min="1"
                      value={form.venue_capacity}
                      onChange={(event) =>
                        updateField("venue_capacity", event.target.value)
                      }
                    />
                  </label>
                  <label className="wide">
                    <span>Description</span>
                    <textarea
                      value={form.description}
                      onChange={(event) =>
                        updateField("description", event.target.value)
                      }
                    />
                  </label>
                </div>
                <div className="zoneEditor">
                  <div className="subHeader">
                    <h3>
                      Zones <span className="requiredStar">*</span>
                    </h3>
                    <button
                      className="button secondary compact"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          zones: [
                            ...current.zones,
                            { zone_name: "", price: 0, total_seat: 1 },
                          ],
                        }))
                      }
                      type="button"
                    >
                      Add Zone
                    </button>
                  </div>
                  {form.zones.map((zone, index) => (
                    <div className="zoneRow" key={index}>
                      <label>
                        <Required>Zone Name</Required>
                        <input
                          value={zone.zone_name}
                          onChange={(event) =>
                            updateZone(index, "zone_name", event.target.value)
                          }
                          required
                        />
                      </label>
                      <label>
                        <Required>Price</Required>
                        <input
                          type="number"
                          min="0"
                          value={zone.price}
                          onChange={(event) =>
                            updateZone(index, "price", event.target.value)
                          }
                          required
                        />
                      </label>
                      <label>
                        <Required>Total Seats</Required>
                        <input
                          type="number"
                          min="1"
                          value={zone.total_seat}
                          onChange={(event) =>
                            updateZone(index, "total_seat", event.target.value)
                          }
                          required
                        />
                      </label>
                    </div>
                  ))}
                </div>
                <button className="button primary" type="submit">
                  <CalendarPlus size={18} /> Add to Concert Table
                </button>
              </form>
            </Panel>
            <Panel title="Concert Records" note={`${concerts.length} records`}>
              <div className="tableWrap">
                <table className="consoleTable">
                  <thead>
                    <tr>
                      <th>Concert ID</th>
                      <th>Name</th>
                      <th>Artist</th>
                      <th>Showtimes</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {concerts.map((concert) => (
                      <tr key={concert.concert_id}>
                        <td>#C-{concert.concert_id}</td>
                        <td>{concert.title}</td>
                        <td>{concert.artist}</td>
                        <td>
                          <span className="softBadge">
                            {concert.showtime_count} dates
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            <button
                              className="button secondary compact"
                              onClick={() => startEdit(concert)}
                              type="button"
                              style={{ padding: "4px 8px" }}
                            >
                              <Edit size={15} /> Edit
                            </button>
                            <button
                              className="deleteOutline"
                              onClick={() =>
                                setConfirmTarget({
                                  type: "concert",
                                  item: concert,
                                })
                              }
                              type="button"
                              style={{ margin: 0 }}
                            >
                              <Trash2 size={15} /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        )}

        {active === "inventory" && (
          <Panel
            title="Zone Configuration"
            note="Update ticket prices and seat capacities"
            action={
              <label className="inlineFilter">
                <span>Select Concert</span>
                <select
                  value={selectedShowtime}
                  onChange={(event) => changeShowtime(event.target.value)}
                >
                  <option value="">All showtimes</option>
                  {inventory.showtimes.map((showtime) => (
                    <option
                      key={showtime.showtime_id}
                      value={showtime.showtime_id}
                    >
                      {showtime.title} - {dateText(showtime.show_date)}
                    </option>
                  ))}
                </select>
              </label>
            }
          >
            <div className="tableWrap">
              <table className="consoleTable">
                <thead>
                  <tr>
                    <th>Zone</th>
                    <th>Concert</th>
                    <th>Price</th>
                    <th>Total Seats</th>
                    <th>Seats Sold</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.zones.map((zone) => (
                    <tr key={zone.zone_id}>
                      <td>
                        <span className="softBadge">{zone.zone_name}</span>
                      </td>
                      <td>{zone.title}</td>
                      <td>
                        <input
                          className="tableInput"
                          type="number"
                          min="0"
                          value={
                            inventoryEdits[zone.zone_id]?.price ?? zone.price
                          }
                          onChange={(event) =>
                            setInventoryEdits((current) => ({
                              ...current,
                              [zone.zone_id]: {
                                ...(current[zone.zone_id] || {}),
                                price: event.target.value,
                              },
                            }))
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="tableInput"
                          type="number"
                          min="1"
                          value={
                            inventoryEdits[zone.zone_id]?.total_seat ??
                            zone.total_seat
                          }
                          onChange={(event) =>
                            setInventoryEdits((current) => ({
                              ...current,
                              [zone.zone_id]: {
                                ...(current[zone.zone_id] || {}),
                                total_seat: event.target.value,
                              },
                            }))
                          }
                        />
                      </td>
                      <td>
                        <Progress
                          value={
                            (Number(zone.seats_sold || 0) /
                              Math.max(Number(zone.total_seat || 1), 1)) *
                            100
                          }
                          tone="blue"
                        />
                      </td>
                      <td>
                        <button
                          className="button primary compact"
                          onClick={() => saveZone(zone)}
                          type="button"
                        >
                          Save
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        {active === "cleanup" && (
          <div className="consoleStack">
            <div className="metricGrid three">
              <Metric
                glyph="X"
                label="Expired Bookings"
                value={cleanup.expired_count || 0}
                note="Ready for cleanup"
                tone="red"
              />
              <Metric
                glyph="P"
                label="Pending Holds"
                value={cleanup.pending_count || 0}
                note="Auto-release active"
                tone="gold"
              />
              <Metric
                glyph="A"
                label="Seats Released"
                value={cleanup.released_now || 0}
                note="Released on refresh"
              />
            </div>
            <Panel
              title="Expired / Cancelled Bookings"
              note="Delete requires confirmation"
            >
              <div className="tableWrap">
                <table className="consoleTable">
                  <thead>
                    <tr>
                      <th>Booking ID</th>
                      <th>Customer</th>
                      <th>Concert</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cleanup.stale_bookings.map((booking) => (
                      <tr key={booking.booking_id}>
                        <td>#BK-{booking.booking_id}</td>
                        <td>{booking.customer}</td>
                        <td>{booking.concert}</td>
                        <td>{money(booking.total_amount)}</td>
                        <td>
                          <Status value={booking.booking_status} />
                        </td>
                        <td>
                          <button
                            className="deleteOutline"
                            onClick={() =>
                              setConfirmTarget({
                                type: "booking",
                                item: booking,
                              })
                            }
                            type="button"
                          >
                            <Trash2 size={15} /> Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr hidden={cleanup.stale_bookings.length}>
                      <td colSpan="6">No expired or cancelled bookings.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        )}

        {active === "revenue" && (
          <div className="consoleStack">
            <div className="metricGrid four">
              <Metric
                glyph="$"
                label="Total Revenue"
                value={money(revenue.total_revenue)}
                note="Selected period"
              />
              <Metric
                glyph="T"
                label="Tickets Sold"
                value={revenue.total_tickets}
                note="Paid tickets"
                tone="blue"
              />
              <Metric
                glyph="1"
                label="Top Concert"
                value={topConcert?.title || "N/A"}
                note={topConcert ? money(topConcert.revenue) : "No sales"}
                tone="gold"
              />
              <Metric
                glyph="A"
                label="Avg per Booking"
                value={money(avgBooking)}
                note="Selected period"
                tone="purple"
              />
            </div>
            <Panel
              title="Revenue by Concert"
              note="Month and Year filter enabled"
              action={
                <div className="filterBar compactFilters">
                  <label>
                    <span>Month</span>
                    <select
                      value={filters.month}
                      onChange={(event) =>
                        refreshRevenue({
                          ...filters,
                          month: event.target.value,
                        })
                      }
                    >
                      {monthOptions.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Year</span>
                    <select
                      value={filters.year}
                      onChange={(event) =>
                        refreshRevenue({ ...filters, year: event.target.value })
                      }
                    >
                      <option value="">All years</option>
                      {years.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              }
            >
              <div className="tableWrap">
                <table className="consoleTable">
                  <thead>
                    <tr>
                      <th>Concert</th>
                      <th>Artist</th>
                      <th>Bookings</th>
                      <th>Tickets Sold</th>
                      <th>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenue.rows.map((row) => (
                      <tr key={row.concert_id || row.title}>
                        <td>{row.title}</td>
                        <td>{row.artist}</td>
                        <td>{row.paid_bookings}</td>
                        <td>{row.tickets_sold}</td>
                        <td className="moneyCell">{money(row.revenue)}</td>
                      </tr>
                    ))}
                    <tr hidden={revenue.rows.length}>
                      <td colSpan="5">No paid bookings for this period.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        )}

        {active === "loyalty" && (
          <div className="consoleStack">
            <div className="metricGrid three">
              <Metric
                glyph="V"
                label="VIP Customers"
                value={vipCustomers.length}
                note="High spenders"
                tone="gold"
              />
              <Metric
                glyph="U"
                label="Regular Customers"
                value={regularCustomers}
                note="Active accounts"
                tone="blue"
              />
              <Metric
                glyph="$"
                label="Avg VIP Spend"
                value={money(
                  vipCustomers.reduce(
                    (sum, row) => sum + Number(row.total_spend || 0),
                    0,
                  ) / Math.max(vipCustomers.length, 1),
                )}
                note="Completed payments"
              />
            </div>
            <Panel
              title="Customer Loyalty Report"
              note="VIP candidates based on booking value"
            >
              <div className="tableWrap">
                <table className="consoleTable">
                  <thead>
                    <tr>
                      <th>User ID</th>
                      <th>Customer</th>
                      <th>Total Spend</th>
                      <th>Historical Max</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loyalty.map((customer) => (
                      <tr key={customer.user_id}>
                        <td>#U-{customer.user_id}</td>
                        <td>{customer.customer}</td>
                        <td className="moneyCell">
                          {money(customer.total_spend)}
                        </td>
                        <td>{money(customer.historical_max)}</td>
                        <td>
                          <Status value={customer.loyalty_status} />
                        </td>
                        <td>
                          {customer.loyalty_status === "VIP" ? (
                            <button
                              className="button primary compact"
                              onClick={() =>
                                setConfirmTarget({
                                  type: "privilege",
                                  item: customer,
                                })
                              }
                              type="button"
                            >
                              Assign Privilege
                            </button>
                          ) : (
                            <span className="softBadge">Keep Regular</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        )}

        {active === "analytics" && (
          <div className="consoleStack analyticsPage">
            <Panel
              title="Analytics Report"
              note="Choose one PS07 report to view"
              action={
                <label className="analyticsSelect">
                  <span>Report</span>
                  <select
                    value={selectedAnalyticsReport}
                    onChange={(event) => setSelectedAnalyticsReport(event.target.value)}
                  >
                    {analyticsReportOptions.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              }
            >
              <p className="muted">
                Select a report from the dropdown. The dashboard shows one analytics report at a time.
              </p>
            </Panel>

            <div className={`analyticsGrid report-${selectedAnalyticsReport}`}>
              <AnalyticsReport
                number="1"
                title="Monthly Revenue per Concert"
                question="Which months and concerts generate the most booking revenue?"
              >
                <MiniBars
                  rows={analytics.monthly_revenue_per_concert || []}
                  labelKey="concert"
                  valueKey="total_revenue"
                  format={money}
                />
                <AnalyticsTable
                  rows={analytics.monthly_revenue_per_concert || []}
                  columns={[
                    { label: "Concert", keys: ["concert"] },
                    { label: "Period", keys: ["period"] },
                    { label: "Bookings", keys: ["paid_bookings"] },
                    { label: "Tickets", keys: ["tickets_sold"] },
                    { label: "Revenue", render: (row) => money(row.total_revenue) },
                  ]}
                />
              </AnalyticsReport>

              <AnalyticsReport
                number="2"
                title="Seat Occupancy by Zone"
                question="Which seating zones have the highest demand?"
              >
                <MiniBars
                  rows={analytics.seat_occupancy_by_zone || []}
                  labelKey="zone_name"
                  valueKey="occupancy_rate"
                  format={pct}
                />
                <AnalyticsTable
                  rows={analytics.seat_occupancy_by_zone || []}
                  columns={[
                    { label: "Zone", keys: ["zone_name"] },
                    { label: "Reserved", keys: ["seats_reserved"] },
                    { label: "Total", keys: ["total_seat"] },
                    { label: "Occupancy", render: (row) => pct(row.occupancy_rate) },
                  ]}
                />
              </AnalyticsReport>

              <AnalyticsReport
                number="3"
                title="Average Ticket Price by Genre per Quarter"
                question="Which genres produce higher average ticket prices?"
              >
                <AnalyticsTable
                  rows={analytics.avg_ticket_price_by_genre_quarter || []}
                  columns={[
                    { label: "Genre", keys: ["genre"] },
                    { label: "Year", keys: ["year"] },
                    { label: "Quarter", render: (row) => `Q${row.quarter}` },
                    { label: "Avg Price", render: (row) => money(row.avg_ticket_price) },
                    { label: "Tickets", keys: ["ticket_count"] },
                  ]}
                />
              </AnalyticsReport>

              <AnalyticsReport
                number="4"
                title="Top 5 Concerts by Booking Rate"
                question="Which concerts sell through the fastest?"
              >
                <MiniBars
                  rows={analytics.top_concerts_by_booking_rate || []}
                  labelKey="concert"
                  valueKey="booking_rate"
                  format={pct}
                />
                <AnalyticsTable
                  rows={analytics.top_concerts_by_booking_rate || []}
                  columns={[
                    { label: "Concert", keys: ["concert"] },
                    { label: "Sold", keys: ["tickets_sold"] },
                    { label: "Seats", keys: ["total_seats"] },
                    { label: "Rate", render: (row) => pct(row.booking_rate) },
                  ]}
                />
              </AnalyticsReport>

              <AnalyticsReport
                number="5"
                title="Booking Status Summary"
                question="What is the confirmed, cancelled, pending, and expired mix?"
              >
                <AnalyticsTable
                  rows={analytics.booking_status_summary || []}
                  columns={[
                    { label: "Status", render: (row) => <Status value={row.booking_status} /> },
                    { label: "Bookings", keys: ["total_bookings"] },
                    { label: "Share", render: (row) => pct(row.percentage) },
                  ]}
                />
              </AnalyticsReport>

              <AnalyticsReport
                number="6"
                title="Most Popular Payment Methods"
                question="Which payment method is used most often?"
              >
                <MiniBars
                  rows={analytics.popular_payment_methods || []}
                  labelKey="payment_method"
                  valueKey="usage_count"
                />
                <AnalyticsTable
                  rows={analytics.popular_payment_methods || []}
                  columns={[
                    { label: "Method", keys: ["payment_method"] },
                    { label: "Uses", keys: ["usage_count"] },
                    { label: "Amount", render: (row) => money(row.total_amount) },
                  ]}
                />
              </AnalyticsReport>

              <AnalyticsReport
                number="7"
                title="Monthly New Users"
                question="How many new users register each month?"
              >
                <MiniBars
                  rows={analytics.monthly_new_users || []}
                  labelKey="period"
                  valueKey="new_users"
                />
                <AnalyticsTable
                  rows={analytics.monthly_new_users || []}
                  columns={[
                    { label: "Period", keys: ["period"] },
                    { label: "New Users", keys: ["new_users"] },
                  ]}
                />
              </AnalyticsReport>

              <AnalyticsReport
                number="8"
                title="Top 10 Customers by Spending"
                question="Who are the highest-value customers?"
              >
                <AnalyticsTable
                  rows={analytics.top_customers_by_spending || []}
                  columns={[
                    { label: "Customer", keys: ["customer"] },
                    { label: "Bookings", keys: ["paid_bookings"] },
                    { label: "Tickets", keys: ["tickets_purchased"] },
                    { label: "Spend", render: (row) => money(row.total_spending) },
                  ]}
                />
              </AnalyticsReport>

              <AnalyticsReport
                number="9"
                title="Available Seats by Showtime"
                question="Which showtimes may need additional advertising?"
              >
                <MiniBars
                  rows={analytics.available_seats_by_showtime || []}
                  labelKey="concert"
                  valueKey="available_rate"
                  format={pct}
                />
                <AnalyticsTable
                  rows={analytics.available_seats_by_showtime || []}
                  columns={[
                    { label: "Concert", keys: ["concert"] },
                    { label: "Venue", keys: ["venue"] },
                    { label: "Available", keys: ["available_seats"] },
                    { label: "Total", keys: ["total_seats"] },
                    { label: "Open Rate", render: (row) => pct(row.available_rate) },
                  ]}
                />
              </AnalyticsReport>

              <AnalyticsReport
                number="10"
                title="Refund Amount by Quarter"
                question="Estimated refunds from cancelled or expired bookings."
              >
                <AnalyticsTable
                  rows={analytics.refund_amount_by_quarter || []}
                  columns={[
                    { label: "Year", keys: ["year"] },
                    { label: "Quarter", render: (row) => `Q${row.quarter}` },
                    { label: "Cancelled", keys: ["cancelled_bookings"] },
                    { label: "Estimated Refund", render: (row) => money(row.estimated_refund_amount) },
                  ]}
                />
              </AnalyticsReport>

              <AnalyticsReport
                number="11"
                title="Busiest Booking Hours"
                question="When do customers book the most tickets?"
              >
                <MiniBars
                  rows={analytics.busiest_booking_hours || []}
                  labelKey="hour_of_day"
                  valueKey="transaction_count"
                  format={(value) => `${value} tx`}
                />
                <AnalyticsTable
                  rows={analytics.busiest_booking_hours || []}
                  columns={[
                    { label: "Hour", render: (row) => `${String(row.hour_of_day).padStart(2, "0")}:00` },
                    { label: "Transactions", keys: ["transaction_count"] },
                  ]}
                />
              </AnalyticsReport>

              <AnalyticsReport
                number="12"
                title="Admin Concert Assignments"
                question="Which admin manages each concert and who has the largest workload?"
              >
                <div className="analyticsSplit">
                  <AnalyticsTable
                    rows={analytics.admin_concert_assignments?.by_concert || []}
                    columns={[
                      { label: "Concert", keys: ["concert"] },
                      { label: "Admin", keys: ["admin_name"] },
                      { label: "Email", keys: ["admin_email"] },
                    ]}
                  />
                  <AnalyticsTable
                    rows={analytics.admin_concert_assignments?.workload || []}
                    columns={[
                      { label: "Admin", keys: ["admin_name"] },
                      { label: "Concerts", keys: ["concerts_managed"] },
                    ]}
                  />
                </div>
              </AnalyticsReport>

              <AnalyticsReport
                number="13"
                title="Venue Ticket Price Range"
                question="Which venues have the widest ticket pricing range?"
              >
                <MiniBars
                  rows={analytics.venue_ticket_price_range || []}
                  labelKey="venue"
                  valueKey="price_range"
                  format={money}
                />
                <AnalyticsTable
                  rows={analytics.venue_ticket_price_range || []}
                  columns={[
                    { label: "Venue", keys: ["venue"] },
                    { label: "Min", render: (row) => money(row.min_price) },
                    { label: "Max", render: (row) => money(row.max_price) },
                    { label: "Average", render: (row) => money(row.avg_price) },
                    { label: "Range", render: (row) => money(row.price_range) },
                  ]}
                />
              </AnalyticsReport>

              <AnalyticsReport
                number="14"
                title="Average Tickets Purchased per Booking"
                question="How many tickets do customers usually buy in one booking?"
              >
                <div className="analyticsSummaryStrip">
                  <Metric
                    glyph="AVG"
                    label="Average"
                    value={analytics.avg_tickets_per_booking?.summary?.overall_avg_tickets_per_booking || 0}
                    note="Tickets per booking"
                    tone="blue"
                  />
                  <Metric
                    glyph="MIN"
                    label="Minimum"
                    value={analytics.avg_tickets_per_booking?.summary?.min_tickets || 0}
                    note="Smallest booking"
                    tone="gold"
                  />
                  <Metric
                    glyph="MAX"
                    label="Maximum"
                    value={analytics.avg_tickets_per_booking?.summary?.max_tickets || 0}
                    note="Largest booking"
                  />
                </div>
                <AnalyticsTable
                  rows={analytics.avg_tickets_per_booking?.distribution || []}
                  columns={[
                    { label: "Tickets in Booking", keys: ["ticket_count"] },
                    { label: "Booking Count", keys: ["booking_count"] },
                  ]}
                />
              </AnalyticsReport>
            </div>
          </div>
        )}
          </motion.div>
        </AnimatePresence>
      </section>

      <ConfirmDialog
        open={Boolean(confirmTarget)}
        title={confirmTitle}
        body={confirmBody}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={runConfirm}
      />

      {editingConcert && (
        <div className="dialogBackdrop" role="presentation">
          <section className="dialog" style={{ maxWidth: "500px" }} role="dialog">
            <h2>Edit Concert</h2>
            <form className="adminForm compactForm" onSubmit={saveEdit}>
              <div className="formGrid">
                <label className="wide">
                  <span>Concert Name</span>
                  <input
                    value={editForm.title}
                    onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                    required
                  />
                </label>
                <label>
                  <span>Artist</span>
                  <input
                    value={editForm.artist}
                    onChange={(e) => setEditForm((f) => ({ ...f, artist: e.target.value }))}
                    required
                  />
                </label>
                <label>
                  <span>Type</span>
                  <input
                    value={editForm.genre}
                    onChange={(e) => setEditForm((f) => ({ ...f, genre: e.target.value }))}
                  />
                </label>
                <label className="wide">
                  <span>Poster URL</span>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      value={editForm.poster_url}
                      onChange={(e) => setEditForm((f) => ({ ...f, poster_url: e.target.value }))}
                      style={{ flex: 1 }}
                    />
                    <label className="button secondary compact" style={{ margin: 0, cursor: "pointer", display: "flex", alignItems: "center" }}>
                      Upload
                      <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleUpload(e, (val) => setEditForm((f) => ({ ...f, poster_url: val })))} />
                    </label>
                  </div>
                </label>
                <label className="wide">
                  <span>Description</span>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </label>
              </div>
              <div className="dialogActions" style={{ marginTop: "20px" }}>
                <button
                  className="button secondary"
                  onClick={() => setEditingConcert(null)}
                  type="button"
                >
                  Cancel
                </button>
                <button className="button primary" type="submit">
                  Save Changes
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
