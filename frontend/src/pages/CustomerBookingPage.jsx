import { CalendarDays, CheckCircle2, CreditCard, Clock, DollarSign, MapPin, Search, Ticket } from "lucide-react";
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
};

const CATEGORIES = ["Entertainment", "Business", "Sports", "Lifestyle", "Vouchers"];

function money(v) { return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(v || 0); }
function dateFmt(d) { if (!d) return ""; return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }); }
function dateShort(d) { if (!d) return ""; return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }).toUpperCase(); }
function dayOfWeek(d) { if (!d) return ""; return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase(); }

/* ─── Group showtimes by concert_id for browse view ────────── */
function groupConcerts(list) {
  const map = {};
  list.forEach((c) => {
    if (!map[c.concert_id]) map[c.concert_id] = { ...c, showtimes: [] };
    map[c.concert_id].showtimes.push({ showtime_id: c.showtime_id, show_date: c.show_date, show_time: c.show_time, venue_name: c.venue_name, city: c.city, available_seats: c.available_seats });
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
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState("browse"); // browse | info | seats | checkout | done
  const [activeCat, setActiveCat] = useState("Entertainment");
  const [searchQ, setSearchQ] = useState("");
  const [payment, setPayment] = useState({ cardName: session?.name || "", cardNumber: "", expiry: "", cvc: "" });

  const grouped = useMemo(() => groupConcerts(concerts), [concerts]);
  const recommended = useMemo(() => grouped.slice(0, 5), [grouped]);
  const allEvents = useMemo(() => {
    let list = grouped;
    if (activeCat) list = list.filter((c) => (c.genre || "").toLowerCase().includes(activeCat.toLowerCase()));
    if (searchQ) list = list.filter((c) => c.title.toLowerCase().includes(searchQ.toLowerCase()));
    return list;
  }, [grouped, activeCat, searchQ]);

  async function loadConcerts() { setLoading(true); const d = await api.concerts(); setConcerts(d); setLoading(false); }
  async function loadSeats(id) { if (!id) return; setSeatData(await api.seats(id)); }

  useEffect(() => { loadConcerts().catch((e) => { setNotice(e.message); setLoading(false); }); }, []);
  useEffect(() => {
    if (!selectedShowtime) return;
    setSelectedSeats([]); setSelectedZone(null); setBooking(null); setPaymentRef("");
    loadSeats(selectedShowtime).catch((e) => setNotice(e.message));
  }, [selectedShowtime]);

  const activeConcert = useMemo(() => concerts.find((c) => c.showtime_id === Number(selectedShowtime)), [concerts, selectedShowtime]);
  const concertShowtimes = useMemo(() => concerts.filter((c) => c.concert_id === activeConcert?.concert_id), [concerts, activeConcert]);
  const selectedSeatRows = useMemo(() => seatData.seats.filter((s) => selectedSeats.includes(s.seat_id)), [seatData.seats, selectedSeats]);
  const selectedTotal = useMemo(() => selectedSeatRows.reduce((sum, s) => sum + Number(s.price || 0), 0), [selectedSeatRows]);
  const zoneSeats = useMemo(() => selectedZone ? seatData.seats.filter((s) => s.zone_name === selectedZone) : [], [seatData.seats, selectedZone]);
  const priceString = useMemo(() => seatData.zones.sort((a, b) => b.price - a.price).map((z) => `${money(z.price)} (${z.zone_name})`).join(" / "), [seatData.zones]);

  function openEvent(concert) { setSelectedShowtime(concert.showtimes[0].showtime_id); setStep("info"); }
  function toggleSeat(s) { if (s.seat_status !== "available" || booking) return; setSelectedSeats((c) => c.includes(s.seat_id) ? c.filter((i) => i !== s.seat_id) : [...c, s.seat_id]); }
  async function holdSeats() { setNotice(""); try { const h = await api.holdSeats({ showtime_id: Number(selectedShowtime), seat_ids: selectedSeats }); setBooking(h); await loadSeats(selectedShowtime); setStep("checkout"); } catch (e) { setNotice(e.message); await loadSeats(selectedShowtime); } }
  async function confirmPay() { setNotice(""); try { const c = await api.confirmPayment({ booking_id: booking.booking_id, payment_method: "card" }); setPaymentRef(c.transaction_ref); await loadSeats(selectedShowtime); await loadConcerts(); setStep("done"); } catch (e) { setNotice(e.message); } }
  function resetFlow() { setStep("browse"); setSelectedSeats([]); setSelectedZone(null); setBooking(null); setPaymentRef(""); setSelectedShowtime(null); }

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
                        <span className="tmViewDetails">View Details</span>
                      </div>
                    </button>
                  ))}
                </div>

                {/* ── All Events ───── */}
                <h2 className="tmBrowseTitle tmAllTitle">All Events</h2>
                <div className="tmCatTabs">
                  {CATEGORIES.map((cat) => (
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
                        <span className="tmViewDetails">View Details</span>
                      </div>
                    </button>
                  ))}
                </div>
                {allEvents.length === 0 && <p style={{ color: "var(--muted)", textAlign: "center", padding: 40 }}>No events found</p>}
                <p className="tmShowAll">Show all events</p>
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
                {/* Stage map */}
                <div className="tmMapWrapper">
                  <div className="tmStageMap">
                    <div className="tmStageLabel">STAGE</div>
                    <div className="tmMapRow tmRow1">
                      <div className="tmMapSide tmSideLeft">
                        <button type="button" className={`tmBlock tmZoneA ${selectedZone === "ZONE A" ? "selected" : ""}`} onClick={() => setSelectedZone("ZONE A")}><strong>A</strong></button>
                        <span className="tmGateLabel tmGate1">GATE 1</span>
                      </div>
                      <div className="tmMapCenter tmRow1Center">
                        <button type="button" className={`tmBlock tmStanding ${selectedZone === "STANDING" ? "selected" : ""}`} onClick={() => setSelectedZone("STANDING")}><strong>Roses</strong><small>(STANDING)</small></button>
                        <button type="button" className={`tmBlock tmStanding ${selectedZone === "STANDING" ? "selected" : ""}`} onClick={() => setSelectedZone("STANDING")}><strong>Dandelion</strong><small>(STANDING)</small></button>
                      </div>
                      <div className="tmMapSide tmSideRight">
                        <button type="button" className={`tmBlock tmZoneA ${selectedZone === "ZONE A" ? "selected" : ""}`} onClick={() => setSelectedZone("ZONE A")}><strong>I</strong></button>
                        <span className="tmGateLabel tmGate4">GATE 4</span>
                      </div>
                    </div>
                    <div className="tmMapRow tmRow2">
                      <div className="tmMapSide"><button type="button" className={`tmBlock tmZoneB ${selectedZone === "ZONE B" ? "selected" : ""}`} onClick={() => setSelectedZone("ZONE B")}><strong>B</strong></button></div>
                      <div className="tmMapCenter tmRow2Center">
                        <button type="button" className={`tmBlock tmVip ${selectedZone === "VIP PACKAGE" ? "selected" : ""}`} onClick={() => setSelectedZone("VIP PACKAGE")}><strong>Flamin'</strong><small>(VIP SEATED)</small></button>
                        <button type="button" className={`tmBlock tmVip ${selectedZone === "VIP PACKAGE" ? "selected" : ""}`} onClick={() => setSelectedZone("VIP PACKAGE")}><strong>Hot</strong><small>(VIP SEATED)</small></button>
                        <button type="button" className={`tmBlock tmVip ${selectedZone === "VIP PACKAGE" ? "selected" : ""}`} onClick={() => setSelectedZone("VIP PACKAGE")}><strong>Lemon</strong><small>(VIP SEATED)</small></button>
                      </div>
                      <div className="tmMapSide"><button type="button" className={`tmBlock tmZoneB ${selectedZone === "ZONE B" ? "selected" : ""}`} onClick={() => setSelectedZone("ZONE B")}><strong>H</strong></button></div>
                    </div>
                    <div className="tmMapRow tmRow3">
                      <div className="tmMapSide"><button type="button" className={`tmBlock tmZoneC ${selectedZone === "ZONE C" ? "selected" : ""}`} onClick={() => setSelectedZone("ZONE C")}><strong>C</strong></button></div>
                      <div className="tmMapCenter tmRow3Center"><div className="tmControlBar">CONTROL</div><div className="tmBlockedLabel">BLOCKED</div></div>
                      <div className="tmMapSide"><button type="button" className={`tmBlock tmZoneC ${selectedZone === "ZONE C" ? "selected" : ""}`} onClick={() => setSelectedZone("ZONE C")}><strong>G</strong></button></div>
                    </div>
                    <div className="tmMapRow tmRow4">
                      <span className="tmGateLabel tmGate2">GATE 2</span>
                      <div className="tmMapCenter tmRow4Center">
                        <button type="button" className={`tmBlock tmZoneC ${selectedZone === "ZONE C" ? "selected" : ""}`} onClick={() => setSelectedZone("ZONE C")}><strong>D</strong></button>
                        <button type="button" className={`tmBlock tmZoneC ${selectedZone === "ZONE C" ? "selected" : ""}`} onClick={() => setSelectedZone("ZONE C")}><strong>E</strong></button>
                        <button type="button" className={`tmBlock tmZoneC ${selectedZone === "ZONE C" ? "selected" : ""}`} onClick={() => setSelectedZone("ZONE C")}><strong>F</strong></button>
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

                {selectedZone && (
                  <div className="tmSeatSection">
                    <h4>Select seats in {selectedZone}</h4>
                    <div className="tmSeatGrid">
                      {zoneSeats.map((seat) => (
                        <button className={`seatButton ${seat.seat_status} ${selectedSeats.includes(seat.seat_id) ? "selected" : ""}`} key={seat.seat_id} onClick={() => toggleSeat(seat)} disabled={seat.seat_status !== "available"} title={`${seat.zone_name} ${seat.seat_no}`} type="button">{seat.seat_no}</button>
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
                      <div><span>Seats:</span> <strong>{selectedSeatRows.map((s) => s.seat_no).join(", ")}</strong></div>
                      <div><span>Total:</span> <strong className="tmTotalPrice">฿{money(selectedTotal)}</strong></div>
                    </div>
                    <div className="tmTicketActions">
                      <button className="button secondary" onClick={() => { setStep("info"); setSelectedSeats([]); setSelectedZone(null); }} type="button">Back</button>
                      <button className="button primary" onClick={holdSeats} disabled={!selectedSeats.length} type="button">Hold Seats & Continue</button>
                    </div>
                  </div>
                )}
                {!selectedZone && <button className="button secondary tmBackBtn" onClick={() => setStep("info")} type="button">← Back to Event Info</button>}
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
                    {selectedSeatRows.map((s) => (<div key={s.seat_id} className="tmOrderRow"><span>{s.zone_name} · {s.seat_no}</span><strong>฿{money(s.price)}</strong></div>))}
                    <div className="tmOrderRow tmOrderTotal"><span>Total</span><strong>฿{money(booking.total_amount || selectedTotal)}</strong></div>
                    <p className="tmHoldNote">Held until {new Date(booking.hold_expires_at).toLocaleTimeString()}</p>
                  </div>
                  <div className="tmPaymentForm">
                    <label><span>Name on card</span><input value={payment.cardName} onChange={(e) => setPayment({ ...payment, cardName: e.target.value })} /></label>
                    <label><span>Card number</span><input value={payment.cardNumber} placeholder="4242 4242 4242 4242" onChange={(e) => setPayment({ ...payment, cardNumber: e.target.value })} /></label>
                    <div className="tmPayRow">
                      <label><span>Expiry</span><input value={payment.expiry} placeholder="MM/YY" onChange={(e) => setPayment({ ...payment, expiry: e.target.value })} /></label>
                      <label><span>CVC</span><input value={payment.cvc} placeholder="123" onChange={(e) => setPayment({ ...payment, cvc: e.target.value })} /></label>
                    </div>
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
                  <p>A confirmation for {activeConcert?.title} has been sent.</p>
                  <div className="tmConfirmMeta">
                    <div><span>Booking</span><strong>#{booking?.booking_id}</strong></div>
                    <div><span>Payment Ref</span><strong>{paymentRef || "Confirmed"}</strong></div>
                    <div><span>Seats</span><strong>{selectedSeatRows.map((s) => s.seat_no).join(", ")}</strong></div>
                    <div><span>Show</span><strong>{dateFmt(activeConcert?.show_date)}</strong></div>
                  </div>
                  <button className="button primary" onClick={resetFlow} type="button">Book Another Ticket</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppShell>
  );
}
