import { CalendarDays, CheckCircle2, CreditCard, Clock, DollarSign, Download, History, MapPin, Search, Ticket } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../api";
import AppShell from "../components/AppShell.jsx";
import { getSession } from "../auth";

const ZONE_COLORS = {
  "VIP PACKAGE": { bg: "#e74c8b", text: "#fff" },
  STANDING: { bg: "#f5a623", text: "#fff" },
  "ZONE A": { bg: "#7b68ee", text: "#fff" },
  "ZONE B": { bg: "#4ecdc4", text: "#fff" },
  "ZONE C": { bg: "#95afc0", text: "#fff" },
  "VIP": { bg: "#e74c8b", text: "#fff" },
  "Standard": { bg: "#4ecdc4", text: "#fff" },
  "Economy": { bg: "#95afc0", text: "#fff" },
};

/* Zone names that match the hardcoded JAEHYUN-style stage map */
const STAGE_MAP_ZONES = new Set(["VIP PACKAGE", "STANDING", "ZONE A", "ZONE B", "ZONE C"]);

const BEST_SELLING_FILTER = "Best Selling Concerts";
const CATEGORIES = ["All", BEST_SELLING_FILTER, "Entertainment", "Business", "Sports", "Lifestyle", "Vouchers"];
const PAYMENT_METHODS = [
  { id: "card", label: "Credit / Debit Card", icon: "▭", note: "Visa, Mastercard, JCB" },
  { id: "promptpay", label: "PromptPay", icon: "QR", note: "QR code transfer" },
  { id: "bank_transfer", label: "Bank Transfer", icon: "฿", note: "Thai bank transfer" },
  { id: "wallet", label: "Mobile Wallet", icon: "W", note: "TrueMoney or wallet app" },
];

const PAYMENT_DEMOS = {
  promptpay: {
    title: "PromptPay Demo",
    subtitle: "Scan this demo QR with your banking app.",
    rows: [
      ["Biller", "NodNod Ticketing"],
      ["PromptPay ID", "099-999-2410"],
      ["Reference", "NN-PROMPT-DEMO"],
    ],
  },
  bank_transfer: {
    title: "Bank Transfer Demo",
    subtitle: "Transfer to this demo account, then press Pay.",
    rows: [
      ["Bank", "Kasikorn Bank"],
      ["Account Name", "NodNod Ticketing Co., Ltd."],
      ["Account No.", "123-4-56789-0"],
    ],
  },
  wallet: {
    title: "Mobile Wallet Demo",
    subtitle: "Use this demo wallet receiver in your wallet app.",
    rows: [
      ["Wallet", "TrueMoney Wallet"],
      ["Receiver", "NodNod Tickets"],
      ["Phone", "099-888-2410"],
    ],
  },
};

function money(v) { return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(v || 0); }
function dateFmt(d) { if (!d) return ""; return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }); }
function dateShort(d) { if (!d) return ""; return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }).toUpperCase(); }
function dayOfWeek(d) { if (!d) return ""; return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase(); }
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[char]));
}

const STAGE_AREAS = {
  "ZONE A - A": { label: "A", zone: "ZONE A", index: 0, parts: 2 },
  "ZONE A - I": { label: "I", zone: "ZONE A", index: 1, parts: 2 },
  "Roses": { label: "Roses", zone: "STANDING", index: 0, parts: 2 },
  "Dandelion": { label: "Dandelion", zone: "STANDING", index: 1, parts: 2 },
  "ZONE B - B": { label: "B", zone: "ZONE B", index: 0, parts: 2 },
  "Flamin'": { label: "Flamin'", zone: "VIP PACKAGE", index: 0, parts: 3 },
  "Hot": { label: "Hot", zone: "VIP PACKAGE", index: 1, parts: 3 },
  "Lemon": { label: "Lemon", zone: "VIP PACKAGE", index: 2, parts: 3 },
  "ZONE B - H": { label: "H", zone: "ZONE B", index: 1, parts: 2 },
  "ZONE C - C": { label: "C", zone: "ZONE C", index: 0, parts: 5 },
  "ZONE C - G": { label: "G", zone: "ZONE C", index: 1, parts: 5 },
  "ZONE C - D": { label: "D", zone: "ZONE C", index: 2, parts: 5 },
  "ZONE C - E": { label: "E", zone: "ZONE C", index: 3, parts: 5 },
  "ZONE C - F": { label: "F", zone: "ZONE C", index: 4, parts: 5 },
};

function seatNoNumber(seatNo = "") {
  const match = String(seatNo).match(/(\d+)$/);
  return match ? Number(match[1]) : 0;
}

function sortSeatsByNo(seats) {
  return [...seats].sort((a, b) => seatNoNumber(a.seat_no) - seatNoNumber(b.seat_no) || String(a.seat_no).localeCompare(String(b.seat_no)));
}

function splitSeatsForArea(allSeats, area) {
  if (!area) return [];
  const zoneSeats = sortSeatsByNo(allSeats.filter((seat) => seat.zone_name === area.zone));
  const size = Math.ceil(zoneSeats.length / area.parts);
  return zoneSeats.slice(area.index * size, Math.min(zoneSeats.length, (area.index + 1) * size));
}

function displayAreaForSeat(seat, allSeats) {
  const matchingAreas = Object.values(STAGE_AREAS).filter((area) => area.zone === seat.zone_name);
  for (const area of matchingAreas) {
    if (splitSeatsForArea(allSeats, area).some((candidate) => candidate.seat_id === seat.seat_id)) {
      return area.label;
    }
  }
  return seat.zone_name;
}

function DemoPayment({ amount, method }) {
  const demo = PAYMENT_DEMOS[method];
  if (!demo) return null;
  return (
    <div className={`tmAltPaymentBox ${method}`}>
      {method === "promptpay" && (
        <div className="tmDemoQr" aria-label="Demo PromptPay QR">
          <span />
          <span />
          <span />
          <strong>QR</strong>
        </div>
      )}
      <div className="tmDemoPaymentInfo">
        <strong>{demo.title}</strong>
        <p>{demo.subtitle}</p>
        <div className="tmDemoRows">
          {demo.rows.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <b>{value}</b>
            </div>
          ))}
          <div>
            <span>Amount</span>
            <b>฿{money(amount)}</b>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Group showtimes by concert_id for browse view ────────── */
function groupConcerts(list) {
  const map = {};
  list.forEach((c) => {
    if (!map[c.concert_id]) map[c.concert_id] = { ...c, showtimes: [], sold_seats: 0, total_seats: 0, booking_rate: 0 };
    const soldSeats = Number(c.sold_seats || 0);
    const totalSeats = Number(c.total_seats || 0);
    map[c.concert_id].sold_seats += soldSeats;
    map[c.concert_id].total_seats += totalSeats;
    map[c.concert_id].booking_rate = map[c.concert_id].total_seats
      ? Math.round((map[c.concert_id].sold_seats / map[c.concert_id].total_seats) * 100)
      : 0;
    map[c.concert_id].showtimes.push({
      showtime_id: c.showtime_id,
      show_date: c.show_date,
      show_time: c.show_time,
      venue_name: c.venue_name,
      city: c.city,
      available_seats: c.available_seats,
      sold_seats: soldSeats,
      total_seats: totalSeats,
      booking_rate: Number(c.booking_rate || 0),
    });
  });
  return Object.values(map);
}

function dateRange(showtimes) {
  if (!showtimes?.length) return "";
  const dates = showtimes.map((s) => s.show_date).sort();
  if (dates.length === 1) return dateShort(dates[0]);
  return `${dateShort(dates[0])} - ${dateShort(dates[dates.length - 1])}`;
}

export default function CustomerBookingPage() {
  const session = getSession();
  const [concerts, setConcerts] = useState([]);
  const [selectedShowtime, setSelectedShowtime] = useState(null);
  const [seatData, setSeatData] = useState({ zones: [], seats: [] });
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [selectedZone, setSelectedZone] = useState(null);
  const [booking, setBooking] = useState(null);
  const [paymentRef, setPaymentRef] = useState("");
  const [ticketReceipt, setTicketReceipt] = useState(null);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState("browse"); // browse | history | info | seats | checkout | done
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [seatsRefreshing, setSeatsRefreshing] = useState(false);
  const [lastSeatRefresh, setLastSeatRefresh] = useState(null);
  const [activeCat, setActiveCat] = useState("All");
  const [searchQ, setSearchQ] = useState("");
  const [payment, setPayment] = useState({ method: "card", cardName: session?.name || "", cardNumber: "", expiry: "", cvc: "" });

  const grouped = useMemo(() => groupConcerts(concerts), [concerts]);
  const bestSelling = useMemo(
    () => [...grouped].sort((a, b) => Number(b.sold_seats || 0) - Number(a.sold_seats || 0) || Number(b.booking_rate || 0) - Number(a.booking_rate || 0)),
    [grouped],
  );
  const recommended = useMemo(() => (bestSelling.some((concert) => concert.sold_seats > 0) ? bestSelling : grouped).slice(0, 5), [bestSelling, grouped]);
  const categoryOptions = useMemo(() => {
    const dynamicGenres = grouped.map((concert) => concert.genre).filter(Boolean);
    return [...new Set([...CATEGORIES, ...dynamicGenres])];
  }, [grouped]);
  const allEvents = useMemo(() => {
    let list = grouped;
    if (activeCat === BEST_SELLING_FILTER) list = bestSelling;
    else if (activeCat && activeCat !== "All") list = list.filter((c) => (c.genre || "").toLowerCase().includes(activeCat.toLowerCase()));
    if (searchQ) list = list.filter((c) => c.title.toLowerCase().includes(searchQ.toLowerCase()));
    return list;
  }, [grouped, bestSelling, activeCat, searchQ]);

  async function loadConcerts() { setLoading(true); const d = await api.concerts(); setConcerts(d); setLoading(false); }
  async function loadSeats(id, options = {}) {
    if (!id) return;
    const data = await api.seats(id);
    setSeatData(data);
    setLastSeatRefresh(new Date());
    if (options.keepSelection) {
      const stillHeldOrOpen = new Set(data.seats.filter((seat) => ["available", "pending"].includes(seat.seat_status)).map((seat) => seat.seat_id));
      setSelectedSeats((current) => current.filter((seatId) => stillHeldOrOpen.has(seatId)));
    }
  }
  async function refreshSeatsNow() {
    if (!selectedShowtime) return;
    setSeatsRefreshing(true);
    try {
      await loadSeats(selectedShowtime, { keepSelection: !booking });
    } catch (e) {
      setNotice(e.message);
    } finally {
      setSeatsRefreshing(false);
    }
  }
  async function openHistory() {
    setNotice("");
    setHistoryLoading(true);
    setStep("history");
    try {
      setHistoryRows(await api.bookingHistory());
    } catch (e) {
      setNotice(e.message);
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => { loadConcerts().catch((e) => { setNotice(e.message); setLoading(false); }); }, []);
  useEffect(() => {
    if (!selectedShowtime) return;
    setSelectedSeats([]); setSelectedZone(null); setBooking(null); setPaymentRef("");
    loadSeats(selectedShowtime).catch((e) => setNotice(e.message));
  }, [selectedShowtime]);
  useEffect(() => {
    if (!selectedShowtime || step !== "seats") return undefined;
    const timer = window.setInterval(() => {
      loadSeats(selectedShowtime, { keepSelection: true }).catch((e) => setNotice(e.message));
    }, 3000);
    return () => window.clearInterval(timer);
  }, [selectedShowtime, step]);

  const activeConcert = useMemo(() => concerts.find((c) => c.showtime_id === Number(selectedShowtime)), [concerts, selectedShowtime]);
  const concertShowtimes = useMemo(() => concerts.filter((c) => c.concert_id === activeConcert?.concert_id), [concerts, activeConcert]);
  const useStageMap = useMemo(() => seatData.zones.length > 0 && seatData.zones.every((z) => STAGE_MAP_ZONES.has(z.zone_name)), [seatData.zones]);
  const selectedSeatRows = useMemo(
    () => seatData.seats
      .filter((s) => selectedSeats.includes(s.seat_id))
      .map((seat) => ({ ...seat, display_zone_name: useStageMap ? displayAreaForSeat(seat, seatData.seats) : seat.zone_name })),
    [seatData.seats, selectedSeats, useStageMap],
  );
  const selectedTotal = useMemo(() => selectedSeatRows.reduce((sum, s) => sum + Number(s.price || 0), 0), [selectedSeatRows]);
  const selectedStageArea = useMemo(() => STAGE_AREAS[selectedZone] || null, [selectedZone]);
  const selectedZoneLabel = selectedStageArea?.label || selectedZone;
  const zoneSeats = useMemo(() => {
    if (!selectedZone) return [];
    if (selectedStageArea) return splitSeatsForArea(seatData.seats, selectedStageArea);
    return seatData.seats.filter((s) => s.zone_name === selectedZone);
  }, [seatData.seats, selectedStageArea, selectedZone]);
  const priceString = useMemo(() => seatData.zones.sort((a, b) => b.price - a.price).map((z) => `${money(z.price)} (${z.zone_name})`).join(" / "), [seatData.zones]);

  function openEvent(concert) { setSelectedShowtime(concert.showtimes[0].showtime_id); setStep("info"); }
  async function toggleSeat(s) {
    setNotice("");
    const alreadySelected = selectedSeats.includes(s.seat_id);
    try {
      if (alreadySelected) {
        if (booking?.booking_id) {
          const released = await api.releaseSeat({ booking_id: booking.booking_id, seat_id: s.seat_id });
          setBooking(released.booking);
        }
        setSelectedSeats((current) => current.filter((seatId) => seatId !== s.seat_id));
        await loadSeats(selectedShowtime, { keepSelection: true });
        return;
      }
      if (s.seat_status !== "available") {
        setNotice("This seat was just reserved by someone else. Please choose another seat.");
        await loadSeats(selectedShowtime, { keepSelection: true });
        return;
      }
      const held = await api.selectSeat({
        showtime_id: Number(selectedShowtime),
        seat_id: s.seat_id,
        booking_id: booking?.booking_id || null,
      });
      setBooking(held);
      setSelectedSeats((current) => [...current, s.seat_id]);
      await loadSeats(selectedShowtime, { keepSelection: true });
    } catch (e) {
      setNotice(e.message || "Seat is no longer available.");
      await loadSeats(selectedShowtime, { keepSelection: true });
    }
  }
  async function holdSeats() {
    setNotice("");
    if (!selectedSeats.length || !booking?.booking_id) {
      setNotice("Please select at least one available seat.");
      return;
    }
    await loadSeats(selectedShowtime, { keepSelection: true });
    setStep("checkout");
  }
  async function clearSeatHold(nextStep = "info") {
    if (booking?.booking_id) {
      await Promise.allSettled(selectedSeats.map((seatId) => api.releaseSeat({ booking_id: booking.booking_id, seat_id: seatId })));
    }
    setSelectedSeats([]);
    setSelectedZone(null);
    setBooking(null);
    setStep(nextStep);
    await loadSeats(selectedShowtime).catch((e) => setNotice(e.message));
  }
  async function confirmPay() {
    setNotice("");
    try {
      const c = await api.confirmPayment({ booking_id: booking.booking_id, payment_method: payment.method });
      setPaymentRef(c.transaction_ref);
      setTicketReceipt(c);
      await loadSeats(selectedShowtime);
      await loadConcerts();
      setStep("done");
    } catch (e) {
      setNotice(e.message);
    }
  }
  function downloadTicketPdf() {
    const seats = selectedSeatRows.map((s) => `${s.display_zone_name || s.zone_name} ${s.seat_no}`);
    const paymentMethod = PAYMENT_METHODS.find((method) => method.id === payment.method)?.label || payment.method;
    const paidAt = ticketReceipt?.paid_at ? new Date(ticketReceipt.paid_at).toLocaleString() : new Date().toLocaleString();
    const ticketNo = `NN-${booking?.booking_id || "000"}-${(paymentRef || "CONFIRMED").slice(-6)}`;
    const html = `<!doctype html>
      <html>
        <head>
          <title>NodNod Ticket ${escapeHtml(ticketNo)}</title>
          <style>
            @page { size: A4; margin: 18mm; }
            * { box-sizing: border-box; }
            body { margin: 0; font-family: Arial, sans-serif; color: #221a15; background: #f8f0df; }
            .ticket { max-width: 760px; margin: 0 auto; border: 2px solid #221a15; background: #fff8e8; }
            .top { display: flex; justify-content: space-between; gap: 24px; padding: 28px; border-bottom: 2px dashed #221a15; background: #2ed8c3; color: #10101f; }
            .brand { letter-spacing: 4px; font-size: 12px; font-weight: 900; text-transform: uppercase; }
            h1 { margin: 8px 0 0; font-size: 30px; line-height: 1.08; }
            .admit { min-width: 150px; text-align: center; border: 2px solid #10101f; padding: 14px; font-weight: 900; text-transform: uppercase; }
            .body { padding: 28px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 22px; }
            .box { border: 1px solid #d0b98d; padding: 13px; background: #fffdf5; }
            .box span { display: block; color: #8a6d43; font-size: 11px; font-weight: 900; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 6px; }
            .box strong { font-size: 16px; }
            .seats { font-size: 22px; font-weight: 900; color: #d94486; }
            .footer { display: flex; justify-content: space-between; align-items: end; gap: 18px; margin-top: 28px; padding-top: 18px; border-top: 2px dashed #d0b98d; }
            .qr { width: 116px; height: 116px; display: grid; place-items: center; border: 8px solid #221a15; font-weight: 900; font-size: 28px; }
            .small { color: #6f5b3e; font-size: 12px; line-height: 1.6; }
          </style>
        </head>
        <body>
          <main class="ticket">
            <section class="top">
              <div>
                <div class="brand">NodNod Tickets</div>
                <h1>${escapeHtml(activeConcert?.title || "Concert Ticket")}</h1>
              </div>
              <div class="admit">Admit<br />${seats.length || 1}</div>
            </section>
            <section class="body">
              <div class="seats">${escapeHtml(seats.join(", ") || "Seat confirmed")}</div>
              <div class="grid">
                <div class="box"><span>Ticket No.</span><strong>${escapeHtml(ticketNo)}</strong></div>
                <div class="box"><span>Booking</span><strong>#${escapeHtml(booking?.booking_id)}</strong></div>
                <div class="box"><span>Date</span><strong>${escapeHtml(dateFmt(activeConcert?.show_date))}</strong></div>
                <div class="box"><span>Time</span><strong>${escapeHtml(activeConcert?.show_time || "")}</strong></div>
                <div class="box"><span>Venue</span><strong>${escapeHtml(activeConcert?.venue_name || "")}</strong></div>
                <div class="box"><span>Payment</span><strong>${escapeHtml(paymentMethod)}</strong></div>
                <div class="box"><span>Paid At</span><strong>${escapeHtml(paidAt)}</strong></div>
                <div class="box"><span>Total</span><strong>THB ${escapeHtml(money(ticketReceipt?.amount || booking?.total_amount || selectedTotal))}</strong></div>
              </div>
              <div class="footer">
                <div class="small">
                  Payment Ref: ${escapeHtml(paymentRef || "Confirmed")}<br />
                  Present this ticket at the entrance. Demo ticket generated by NodNod.
                </div>
                <div class="qr">NN</div>
              </div>
            </section>
          </main>
          <script>window.onload = () => { window.print(); };</script>
        </body>
      </html>`;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setNotice("Please allow popups, then click Download PDF again.");
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
  }
  function resetFlow() { setStep("browse"); setSelectedSeats([]); setSelectedZone(null); setBooking(null); setPaymentRef(""); setTicketReceipt(null); setSelectedShowtime(null); }

  return (
    <AppShell>
      <div className="tmPage">
        <AnimatePresence mode="wait">

          {/* ════════ BROWSE (homepage) ════════ */}
          {step === "browse" && (
            <motion.div key="browse" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* Search bar */}
              <div className="tmSearchBar">
                <div className="tmSearchInput">
                  <Search size={18} />
                  <input placeholder="Search event name, location or keyword" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} />
                </div>
                <button className="tmHistoryBtn" onClick={openHistory} type="button">
                  <History size={18} /> Booking History
                </button>
              </div>

              <div className="tmBrowseContent">
                {/* ── Recommended Events ───── */}
                <h2 className="tmBrowseTitle">Recommended Events</h2>
                <div className="tmEventScroll">
                  {recommended.map((c) => (
                    <button key={c.concert_id} className="tmEventCard" onClick={() => openEvent(c)} type="button">
                      <img src={c.poster_url} alt={c.title} />
                      <div className="tmEventCardBody">
                        <strong>{c.title}</strong>
                        <small>{dateRange(c.showtimes)}</small>
                        <em className="tmSalesBadge">{c.sold_seats || 0} sold · {c.booking_rate || 0}%</em>
                        <span className="tmViewDetails">View Details</span>
                      </div>
                    </button>
                  ))}
                </div>

                {/* ── All Events ───── */}
                <h2 className="tmBrowseTitle tmAllTitle">All Events</h2>
                <div className="tmCatTabs">
                  {categoryOptions.map((cat) => (
                    <button key={cat} className={`tmCatBtn ${activeCat === cat ? "active" : ""}`} onClick={() => setActiveCat(cat)} type="button">{cat}</button>
                  ))}
                </div>
                <div className="tmEventGrid">
                  {allEvents.map((c) => (
                    <button key={c.concert_id} className="tmEventCard tmGridCard" onClick={() => openEvent(c)} type="button">
                      <img src={c.poster_url} alt={c.title} />
                      <div className="tmEventCardBody">
                        <strong>{c.title}</strong>
                        <small>{dateRange(c.showtimes)}</small>
                        {activeCat === BEST_SELLING_FILTER && <em className="tmSalesBadge">{c.sold_seats || 0} sold · {c.booking_rate || 0}%</em>}
                        <span className="tmViewDetails">View Details</span>
                      </div>
                    </button>
                  ))}
                </div>
                {allEvents.length === 0 && <p style={{ color: "var(--muted)", textAlign: "center", padding: 40 }}>No events found</p>}
                <button className="tmShowAll" onClick={() => { setActiveCat("All"); setSearchQ(""); }} type="button">Show all events</button>
              </div>
            </motion.div>
          )}

          {/* ════════ BOOKING HISTORY ════════ */}
          {step === "history" && (
            <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="tmContent">
                <div className="tmHistoryHeader">
                  <div>
                    <h2 className="tmEventTitle">Booking History</h2>
                    <p>View your previous holds, paid tickets, payment methods, and ticket references.</p>
                  </div>
                  <button className="button secondary" onClick={() => setStep("browse")} type="button">← Back to Events</button>
                </div>
                {notice && <p className="noticeText tmNotice">{notice}</p>}
                {historyLoading ? (
                  <p className="muted">Loading booking history...</p>
                ) : (
                  <div className="tmHistoryList">
                    {historyRows.map((row) => (
                      <article className="tmHistoryCard" key={row.booking_id}>
                        <img src={row.poster_url} alt="" />
                        <div className="tmHistoryInfo">
                          <div className="tmHistoryTitleRow">
                            <div>
                              <h3>{row.concert_title || "Deleted concert"}</h3>
                              <p>{row.artist} · {row.venue_name}, {row.city}</p>
                            </div>
                            <span className={`tmHistoryStatus ${row.booking_status}`}>{row.booking_status}</span>
                          </div>
                          <div className="tmHistoryMeta">
                            <div><span>Date</span><strong>{dateFmt(row.show_date)} · {String(row.show_time || "").slice(0, 5)}</strong></div>
                            <div><span>Seats</span><strong>{row.seats || "-"}</strong></div>
                            <div><span>Total</span><strong>฿{money(row.total_amount)}</strong></div>
                            <div><span>Payment</span><strong>{row.payment_method}</strong></div>
                            <div><span>Reference</span><strong>{row.transaction_ref}</strong></div>
                            <div><span>Booked</span><strong>{new Date(row.created_at).toLocaleString()}</strong></div>
                          </div>
                        </div>
                      </article>
                    ))}
                    {!historyRows.length && (
                      <div className="tmHistoryEmpty">
                        <History size={28} />
                        <h3>No booking history yet</h3>
                        <p>Your paid and pending bookings will appear here.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ════════ EVENT INFO ════════ */}
          {step === "info" && (
            <motion.div key="info" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <section className="tmHero" style={{ backgroundImage: `url(${activeConcert?.poster_url || ""})` }}>
                <div className="tmHeroOverlay">
                  <h1 className="tmHeroTitle">{activeConcert?.artist || ""}</h1>
                  <p className="tmHeroLabel">{activeConcert?.title?.split("«")[1]?.split("»")[0] || ""}</p>
                </div>
              </section>
              <div className="tmContent">
                <h2 className="tmEventTitle">{activeConcert?.title}</h2>
                <div className="tmInfoRow">
                  <div className="tmInfoItem"><CalendarDays size={18} /><span>{activeConcert?.show_date ? dateFmt(activeConcert.show_date) : ""}</span></div>
                  <div className="tmInfoItem"><Clock size={18} /><span>{String(activeConcert?.show_time || "").slice(0, 5)}</span></div>
                </div>
                <div className="tmInfoRow">
                  <div className="tmInfoItem"><MapPin size={18} /><span>{activeConcert?.venue_name}</span></div>
                  <div className="tmInfoItem"><DollarSign size={18} /><span className="tmPriceStr">{priceString}</span></div>
                </div>
                <h3 className="tmSectionTitle">Choose Date and Time</h3>
                <div className="tmShowtimePicker">
                  {concertShowtimes.map((c) => (
                    <button key={c.showtime_id} className={`tmShowtimeBtn ${Number(selectedShowtime) === c.showtime_id ? "active" : ""}`} onClick={() => setSelectedShowtime(c.showtime_id)} type="button">
                      <strong>{c.title}</strong>
                      <small>{dayOfWeek(c.show_date)} {dateFmt(c.show_date)} · {String(c.show_time).slice(0, 5)}</small>
                    </button>
                  ))}
                </div>
                {notice && <p className="noticeText tmNotice">{notice}</p>}
                <div className="tmDescSection">
                  <div className="tmPosterCard"><img src={activeConcert?.poster_url} alt="poster" /></div>
                  <div className="tmDescText">
                    <p>{activeConcert?.description}</p>
                    <div className="tmDescMeta">
                      <p><strong>สถานที่:</strong> {activeConcert?.venue_name}, {activeConcert?.city}</p>
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <button className="button secondary" onClick={() => setStep("browse")} type="button">← Back</button>
                  <button className="button primary tmBuyBtn" onClick={() => setStep("seats")} type="button"><Ticket size={18} /> CHECK SEAT AVAILABILITY</button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ════════ SEAT SELECTION ════════ */}
          {step === "seats" && (
            <motion.div key="seats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="tmContent">
                <h2 className="tmEventTitle">{activeConcert?.title}</h2>
                <h3 className="tmSectionTitle">Choose Zone</h3>
                {/* Stage map / Dynamic zone picker */}
                {useStageMap ? (
                <div className="tmMapWrapper">
                  <div className="tmStageMap">
                    <div className="tmStageLabel">STAGE</div>
                    <div className="tmMapRow tmRow1">
                      <div className="tmMapSide tmSideLeft">
                        <button type="button" className={`tmBlock tmZoneA ${selectedZone === "ZONE A - A" ? "selected" : ""}`} onClick={() => setSelectedZone("ZONE A - A")}><strong>A</strong></button>
                        <span className="tmGateLabel tmGate1">GATE 1</span>
                      </div>
                      <div className="tmMapCenter tmRow1Center">
                        <button type="button" className={`tmBlock tmStanding ${selectedZone === "Roses" ? "selected" : ""}`} onClick={() => setSelectedZone("Roses")}><strong>Roses</strong><small>(STANDING)</small></button>
                        <button type="button" className={`tmBlock tmStanding ${selectedZone === "Dandelion" ? "selected" : ""}`} onClick={() => setSelectedZone("Dandelion")}><strong>Dandelion</strong><small>(STANDING)</small></button>
                      </div>
                      <div className="tmMapSide tmSideRight">
                        <button type="button" className={`tmBlock tmZoneA ${selectedZone === "ZONE A - I" ? "selected" : ""}`} onClick={() => setSelectedZone("ZONE A - I")}><strong>I</strong></button>
                        <span className="tmGateLabel tmGate4">GATE 4</span>
                      </div>
                    </div>
                    <div className="tmMapRow tmRow2">
                      <div className="tmMapSide"><button type="button" className={`tmBlock tmZoneB ${selectedZone === "ZONE B - B" ? "selected" : ""}`} onClick={() => setSelectedZone("ZONE B - B")}><strong>B</strong></button></div>
                      <div className="tmMapCenter tmRow2Center">
                        <button type="button" className={`tmBlock tmVip ${selectedZone === "Flamin'" ? "selected" : ""}`} onClick={() => setSelectedZone("Flamin'")}><strong>Flamin'</strong><small>(VIP SEATED)</small></button>
                        <button type="button" className={`tmBlock tmVip ${selectedZone === "Hot" ? "selected" : ""}`} onClick={() => setSelectedZone("Hot")}><strong>Hot</strong><small>(VIP SEATED)</small></button>
                        <button type="button" className={`tmBlock tmVip ${selectedZone === "Lemon" ? "selected" : ""}`} onClick={() => setSelectedZone("Lemon")}><strong>Lemon</strong><small>(VIP SEATED)</small></button>
                      </div>
                      <div className="tmMapSide"><button type="button" className={`tmBlock tmZoneB ${selectedZone === "ZONE B - H" ? "selected" : ""}`} onClick={() => setSelectedZone("ZONE B - H")}><strong>H</strong></button></div>
                    </div>
                    <div className="tmMapRow tmRow3">
                      <div className="tmMapSide"><button type="button" className={`tmBlock tmZoneC ${selectedZone === "ZONE C - C" ? "selected" : ""}`} onClick={() => setSelectedZone("ZONE C - C")}><strong>C</strong></button></div>
                      <div className="tmMapCenter tmRow3Center"><div className="tmControlBar">CONTROL</div><div className="tmBlockedLabel">BLOCKED</div></div>
                      <div className="tmMapSide"><button type="button" className={`tmBlock tmZoneC ${selectedZone === "ZONE C - G" ? "selected" : ""}`} onClick={() => setSelectedZone("ZONE C - G")}><strong>G</strong></button></div>
                    </div>
                    <div className="tmMapRow tmRow4">
                      <span className="tmGateLabel tmGate2">GATE 2</span>
                      <div className="tmMapCenter tmRow4Center">
                        <button type="button" className={`tmBlock tmZoneC ${selectedZone === "ZONE C - D" ? "selected" : ""}`} onClick={() => setSelectedZone("ZONE C - D")}><strong>D</strong></button>
                        <button type="button" className={`tmBlock tmZoneC ${selectedZone === "ZONE C - E" ? "selected" : ""}`} onClick={() => setSelectedZone("ZONE C - E")}><strong>E</strong></button>
                        <button type="button" className={`tmBlock tmZoneC ${selectedZone === "ZONE C - F" ? "selected" : ""}`} onClick={() => setSelectedZone("ZONE C - F")}><strong>F</strong></button>
                      </div>
                      <span className="tmGateLabel tmGate3">GATE 3</span>
                    </div>
                  </div>
                  <div className="tmRemarkBox">
                    <h4>REMARK</h4>
                    <div className="tmRemarkRow"><i className="tmDot tmDotVip" /><span>ZONE</span><strong>6,600 BAHT</strong><small>(VIP SEATED)</small></div>
                    <div className="tmRemarkRow"><i className="tmDot tmDotStanding" /><span>ZONE</span><strong>5,600 BAHT</strong><small>(STANDING)</small></div>
                    <div className="tmRemarkRow"><i className="tmDot tmDotA" /><span>ZONE</span><strong>4,700 BAHT</strong></div>
                    <div className="tmRemarkRow"><i className="tmDot tmDotB" /><span>ZONE</span><strong>3,700 BAHT</strong></div>
                    <div className="tmRemarkRow"><i className="tmDot tmDotC" /><span>ZONE</span><strong>2,700 BAHT</strong></div>
                    <p className="tmRemarkNote">* โซน Flamin', Hot และ Lemon เป็นแพลตฟอร์มยกระดับสูง 40 ซม.</p>
                  </div>
                </div>
                ) : (
                <div className="tmDynamicZones">
                  <div className="tmDynStage"><span>STAGE</span></div>
                  <div className="tmDynGrid">
                    {seatData.zones.map((z) => {
                      const color = ZONE_COLORS[z.zone_name] || { bg: "#6c757d", text: "#fff" };
                      const isActive = selectedZone === z.zone_name;
                      return (
                        <button
                          key={z.zone_id}
                          type="button"
                          className={`tmDynZoneCard ${isActive ? "selected" : ""}`}
                          style={{ "--zone-color": color.bg }}
                          onClick={() => setSelectedZone(z.zone_name)}
                        >
                          <div className="tmDynZoneHeader" style={{ background: color.bg, color: color.text }}>
                            <strong>{z.zone_name}</strong>
                          </div>
                          <div className="tmDynZoneBody">
                            <span className="tmDynPrice">฿{money(z.price)}</span>
                            <span className="tmDynAvail">{z.available_seats}/{z.total_seat} available</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                )}

                {selectedZone && (
                  <div className="tmSeatSection">
                    <div className="tmSeatHeader">
                      <div>
                        <h4>Select seats in {selectedZoneLabel}</h4>
                        <span>Auto-refresh every 3 seconds{lastSeatRefresh ? ` · Updated ${lastSeatRefresh.toLocaleTimeString()}` : ""}</span>
                      </div>
                      <button className="button secondary compact" onClick={refreshSeatsNow} disabled={seatsRefreshing} type="button">
                        {seatsRefreshing ? "Refreshing..." : "Refresh Seats"}
                      </button>
                    </div>
                    <div className="tmSeatGrid">
                      {zoneSeats.map((seat) => (
                        <button className={`seatButton ${seat.seat_status} ${selectedSeats.includes(seat.seat_id) ? "selected" : ""}`} key={seat.seat_id} onClick={() => toggleSeat(seat)} disabled={seat.seat_status !== "available" && !selectedSeats.includes(seat.seat_id)} title={`${selectedZoneLabel} ${seat.seat_no}`} type="button">{seat.seat_no}</button>
                      ))}
                    </div>
                    <div className="seatLegend"><span><i className="available" /> Available</span><span><i className="selected" /> Selected</span><span><i className="pending" /> Reserved</span><span><i className="sold" /> Sold</span></div>
                  </div>
                )}

                {selectedSeats.length > 0 && (
                  <div className="tmTicketInfo">
                    <h4>Ticket Information</h4>
                    <div className="tmTicketMeta">
                      <div><span>Event:</span> <strong>{activeConcert?.title}</strong></div>
                      <div><span>Seats:</span> <strong>{selectedSeatRows.map((s) => `${s.display_zone_name} · ${s.seat_no}`).join(", ")}</strong></div>
                      <div><span>Total:</span> <strong className="tmTotalPrice">฿{money(selectedTotal)}</strong></div>
                    </div>
                    <div className="tmTicketActions">
                      <button className="button secondary" onClick={() => clearSeatHold("info")} type="button">Back</button>
                      <button className="button primary" onClick={holdSeats} disabled={!selectedSeats.length} type="button">Hold Seats & Continue</button>
                    </div>
                  </div>
                )}
                <button className="button secondary tmBackBtn" onClick={() => clearSeatHold("info")} type="button">← Back to Event Info</button>
                {notice && <p className="noticeText tmNotice">{notice}</p>}
              </div>
            </motion.div>
          )}

          {/* ════════ CHECKOUT ════════ */}
          {step === "checkout" && booking && (
            <motion.div key="checkout" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="tmContent">
                <h3 className="tmSectionTitle">Payment</h3>
                <div className="tmCheckoutGrid">
                  <div className="tmOrderSummary">
                    <h4>Order Summary</h4>
                    {selectedSeatRows.map((s) => (<div key={s.seat_id} className="tmOrderRow"><span>{s.display_zone_name || s.zone_name} · {s.seat_no}</span><strong>฿{money(s.price)}</strong></div>))}
                    <div className="tmOrderRow tmOrderTotal"><span>Total</span><strong>฿{money(booking.total_amount || selectedTotal)}</strong></div>
                    <p className="tmHoldNote">Held until {new Date(booking.hold_expires_at).toLocaleTimeString()}</p>
                  </div>
                  <div className="tmPaymentForm">
                    <label>
                      <span>Payment method</span>
                      <div className="tmPaymentMethods">
                        {PAYMENT_METHODS.map((method) => (
                          <button
                            className={`tmPaymentMethod ${payment.method === method.id ? "active" : ""}`}
                            key={method.id}
                            onClick={() => setPayment({ ...payment, method: method.id })}
                            type="button"
                          >
                            <strong>{method.icon}</strong>
                            <span>{method.label}</span>
                            <small>{method.note}</small>
                          </button>
                        ))}
                      </div>
                    </label>
                    {payment.method === "card" ? (
                      <>
                        <label><span>Name on card</span><input value={payment.cardName} onChange={(e) => setPayment({ ...payment, cardName: e.target.value })} /></label>
                        <label><span>Card number</span><input value={payment.cardNumber} placeholder="4242 4242 4242 4242" onChange={(e) => setPayment({ ...payment, cardNumber: e.target.value })} /></label>
                        <div className="tmPayRow">
                          <label><span>Expiry</span><input value={payment.expiry} placeholder="MM/YY" onChange={(e) => setPayment({ ...payment, expiry: e.target.value })} /></label>
                          <label><span>CVC</span><input value={payment.cvc} placeholder="123" onChange={(e) => setPayment({ ...payment, cvc: e.target.value })} /></label>
                        </div>
                      </>
                    ) : (
                      <DemoPayment method={payment.method} amount={booking.total_amount || selectedTotal} />
                    )}
                    <button className="button primary tmPayBtn" onClick={confirmPay} type="button"><CreditCard size={18} /> Pay ฿{money(booking.total_amount || selectedTotal)}</button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ════════ DONE ════════ */}
          {step === "done" && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              <div className="tmContent">
                <div className="tmConfirmation">
                  <span className="confirmationBadge"><CheckCircle2 size={18} /> Confirmed</span>
                  <h3>Your tickets are ready!</h3>
                  <p>Show this ticket at the entrance, or save it as a PDF.</p>

                  <div className="tmTicketPass">
                    <div className="tmTicketPassMain">
                      <span>NODNOD TICKETS</span>
                      <h4>{activeConcert?.title}</h4>
                      <div className="tmTicketSeats">
                        {selectedSeatRows.map((s) => (
                          <strong key={s.seat_id}>{s.display_zone_name || s.zone_name} · {s.seat_no}</strong>
                        ))}
                      </div>
                    </div>
                    <div className="tmTicketPassSide">
                      <span>ADMIT</span>
                      <strong>{selectedSeatRows.length || 1}</strong>
                    </div>
                  </div>

                  <div className="tmConfirmMeta">
                    <div><span>Booking</span><strong>#{booking?.booking_id}</strong></div>
                    <div><span>Ticket No.</span><strong>NN-{booking?.booking_id}-{(paymentRef || "CONFIRMED").slice(-6)}</strong></div>
                    <div><span>Payment Ref</span><strong>{paymentRef || "Confirmed"}</strong></div>
                    <div><span>Show</span><strong>{dateFmt(activeConcert?.show_date)}</strong></div>
                    <div><span>Time</span><strong>{activeConcert?.show_time}</strong></div>
                    <div><span>Venue</span><strong>{activeConcert?.venue_name}</strong></div>
                  </div>

                  <div className="tmConfirmActions">
                    <button className="button primary" onClick={downloadTicketPdf} type="button"><Download size={18} /> Download PDF</button>
                    <button className="button secondary" onClick={resetFlow} type="button">Book Another Ticket</button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppShell>
  );
}
