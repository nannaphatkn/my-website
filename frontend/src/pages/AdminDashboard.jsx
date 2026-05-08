import { CalendarPlus, LogOut, Music2, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";

import { api } from "../api";
import { clearSession, getSession } from "../auth";
import ConfirmDialog from "../components/ConfirmDialog.jsx";

const sections = [
  ["dashboard", "Dashboard", "Overview", "D"],
  ["events", "Event & Showtimes", "Management", "E"],
  ["inventory", "Inventory & Pricing", "Management", "I"],
  ["cleanup", "Data Cleanup", "Management", "C"],
  ["revenue", "Revenue Reports", "Analytics", "R"],
  ["loyalty", "Customer Loyalty", "Analytics", "L"],
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

function emptyForm() {
  return {
    title: "",
    artist: "",
    genre: "Indie Rock",
    description: "",
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

function Required({ children }) {
  return (
    <span>
      {children} <strong className="requiredStar">*</strong>
    </span>
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
  const [form, setForm] = useState(emptyForm());

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
    ] = await Promise.all([
      api.adminConcerts(),
      api.revenue(nextFilters),
      api.adminDashboard(),
      api.adminInventory(showtime),
      api.cleanup(),
      api.loyalty(),
    ]);
    setConcerts(concertData);
    setRevenue(revenueData);
    setDashboard(dashboardData);
    setInventory(inventoryData);
    setCleanup(cleanupData);
    setLoyalty(loyaltyData);
    if (isInitial && !showtime && inventoryData.showtimes.length)
      setSelectedShowtime(String(inventoryData.showtimes[0].showtime_id));
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
            <strong>StageMaster</strong>
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
          <div>
            <h1>{title}</h1>
            <p>Concert booking system overview</p>
          </div>
          <div className="consoleActions">
            <button
              className="button secondary compact"
              onClick={refresh}
              type="button"
            >
              <RefreshCw size={16} /> Refresh
            </button>
            <button
              className="button primary compact"
              onClick={() => setActive("events")}
              type="button"
            >
              <CalendarPlus size={16} /> New Concert
            </button>
          </div>
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
              <Metric
                glyph="$"
                label="Total Revenue"
                value={money(dashboard.metrics.total_revenue)}
                note="All completed payments"
              />
              <Metric
                glyph="B"
                label="Active Bookings"
                value={dashboard.metrics.active_bookings || 0}
                note="Pending and paid"
                tone="blue"
              />
              <Metric
                glyph="S"
                label="Upcoming Shows"
                value={dashboard.metrics.upcoming_shows || 0}
                note="Next scheduled dates"
                tone="purple"
              />
              <Metric
                glyph="V"
                label="VIP Customers"
                value={dashboard.metrics.vip_customers || 0}
                note="High spenders"
                tone="gold"
              />
            </div>
            <Panel title="Recent Bookings" note="Status visibility from PS11">
              <div className="tableWrap">
                <table className="consoleTable">
                  <thead>
                    <tr>
                      <th>Booking ID</th>
                      <th>Customer</th>
                      <th>Concert</th>
                      <th>Zone</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.recent_bookings.map((booking) => (
                      <tr key={booking.booking_id}>
                        <td>#BK-{booking.booking_id}</td>
                        <td>{booking.customer}</td>
                        <td>{booking.concert}</td>
                        <td>{booking.zone}</td>
                        <td>{money(booking.total_amount)}</td>
                        <td>
                          <Status value={booking.booking_status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
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
                          <button
                            className="deleteOutline"
                            onClick={() =>
                              setConfirmTarget({
                                type: "concert",
                                item: concert,
                              })
                            }
                            type="button"
                          >
                            <Trash2 size={15} /> Delete
                          </button>
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
    </main>
  );
}
