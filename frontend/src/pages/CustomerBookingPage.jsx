import { CalendarDays, CheckCircle2, MapPin, ReceiptText, Ticket } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { api } from "../api";
import AppShell from "../components/AppShell.jsx";

function money(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0);
}

export default function CustomerBookingPage() {
  const [concerts, setConcerts] = useState([]);
  const [selectedShowtime, setSelectedShowtime] = useState(null);
  const [seatData, setSeatData] = useState({ zones: [], seats: [] });
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [booking, setBooking] = useState(null);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadConcerts() {
    setLoading(true);
    const data = await api.concerts();
    setConcerts(data);
    if (!selectedShowtime && data.length) setSelectedShowtime(data[0].showtime_id);
    setLoading(false);
  }

  async function loadSeats(showtimeId) {
    if (!showtimeId) return;
    const data = await api.seats(showtimeId);
    setSeatData(data);
  }

  useEffect(() => {
    loadConcerts().catch((err) => setNotice(err.message));
  }, []);

  useEffect(() => {
    setSelectedSeats([]);
    setBooking(null);
    loadSeats(selectedShowtime).catch((err) => setNotice(err.message));
  }, [selectedShowtime]);

  const activeConcert = useMemo(
    () => concerts.find((concert) => concert.showtime_id === Number(selectedShowtime)),
    [concerts, selectedShowtime]
  );

  const selectedTotal = useMemo(
    () =>
      selectedSeats.reduce((sum, seatId) => {
        const seat = seatData.seats.find((item) => item.seat_id === seatId);
        return sum + Number(seat?.price || 0);
      }, 0),
    [selectedSeats, seatData.seats]
  );

  function toggleSeat(seat) {
    if (seat.seat_status !== "available" || booking) return;
    setSelectedSeats((current) =>
      current.includes(seat.seat_id) ? current.filter((seatId) => seatId !== seat.seat_id) : [...current, seat.seat_id]
    );
  }

  async function holdSelectedSeats() {
    setNotice("");
    try {
      const hold = await api.holdSeats({ showtime_id: Number(selectedShowtime), seat_ids: selectedSeats });
      setBooking(hold);
      await loadSeats(selectedShowtime);
      setNotice("Seats held for 15 minutes.");
    } catch (err) {
      setNotice(err.message);
      await loadSeats(selectedShowtime);
    }
  }

  async function payBooking() {
    setNotice("");
    try {
      const payment = await api.confirmPayment({ booking_id: booking.booking_id, payment_method: "card" });
      setNotice(`Payment confirmed: ${payment.transaction_ref}`);
      setBooking(null);
      setSelectedSeats([]);
      await loadSeats(selectedShowtime);
      await loadConcerts();
    } catch (err) {
      setNotice(err.message);
      await loadSeats(selectedShowtime);
    }
  }

  return (
    <AppShell>
      <div className="customerGrid">
        <section className="concertRail">
          <div className="sectionHeader">
            <p className="kicker">Upcoming Sets</p>
            <h2>Choose a show</h2>
          </div>
          {loading && <p className="muted">Loading shows...</p>}
          <div className="concertList">
            {concerts.map((concert) => (
              <button
                className={`concertCard ${Number(selectedShowtime) === concert.showtime_id ? "active" : ""}`}
                key={concert.showtime_id}
                onClick={() => setSelectedShowtime(concert.showtime_id)}
                type="button"
              >
                <img src={concert.poster_url} alt="" />
                <div>
                  <h3>{concert.title}</h3>
                  <p>{concert.artist}</p>
                  <span>
                    <CalendarDays size={14} /> {concert.show_date} at {concert.show_time.slice(0, 5)}
                  </span>
                  <span>
                    <MapPin size={14} /> {concert.venue_name}, {concert.city}
                  </span>
                  <strong>{concert.available_seats} seats left</strong>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="bookingStage">
          <div className="stageBanner">
            <div>
              <p className="kicker">{activeConcert?.genre || "Live Session"}</p>
              <h2>{activeConcert?.title || "Select a concert"}</h2>
              <p>{activeConcert?.description}</p>
            </div>
          </div>

          <div className="zoneLegend">
            {seatData.zones.map((zone) => (
              <span key={zone.zone_id}>
                {zone.zone_name} · {money(zone.price)} · {zone.available_seats} open
              </span>
            ))}
          </div>

          <div className="seatMap" aria-label="Seat map">
            {seatData.seats.map((seat) => (
              <button
                className={`seatButton ${seat.seat_status} ${selectedSeats.includes(seat.seat_id) ? "selected" : ""}`}
                key={seat.seat_id}
                onClick={() => toggleSeat(seat)}
                disabled={seat.seat_status !== "available" || Boolean(booking)}
                title={`${seat.zone_name} ${seat.seat_no}`}
                type="button"
              >
                {seat.seat_no}
              </button>
            ))}
          </div>
        </section>

        <aside className="summaryPanel">
          <div className="sectionHeader">
            <p className="kicker">Order</p>
            <h2>Ticket Hold</h2>
          </div>
          <div className="summaryRows">
            <span>
              <Ticket size={16} /> Seats
            </span>
            <strong>{selectedSeats.length}</strong>
            <span>
              <ReceiptText size={16} /> Total
            </span>
            <strong>{money(booking?.total_amount || selectedTotal)}</strong>
          </div>
          {booking && (
            <div className="holdNote">
              <CheckCircle2 size={18} />
              <span>Held until {new Date(booking.hold_expires_at).toLocaleTimeString()}</span>
            </div>
          )}
          {notice && <p className="noticeText">{notice}</p>}
          {!booking ? (
            <button className="button primary fullWidth" disabled={!selectedSeats.length} onClick={holdSelectedSeats} type="button">
              Hold Seats
            </button>
          ) : (
            <button className="button primary fullWidth" onClick={payBooking} type="button">
              Confirm Payment
            </button>
          )}
        </aside>
      </div>
    </AppShell>
  );
}
