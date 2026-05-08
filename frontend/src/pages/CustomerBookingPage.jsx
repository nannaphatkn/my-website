import {
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Eye,
  EyeOff,
  MapPin,
  ReceiptText,
  Ticket,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { api } from "../api";
import AppShell from "../components/AppShell.jsx";
import { getSession } from "../auth";

const steps = [
  "Event Details",
  "Seat Selection",
  "Login",
  "Order Summary",
  "Payment",
  "Confirmation",
];

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value || 0);
}

function dateLine(concert) {
  if (!concert) return "Choose a show";
  return `${concert.show_date} at ${String(concert.show_time || "").slice(0, 5)}`;
}

export default function CustomerBookingPage() {
  const session = getSession();
  const [step, setStep] = useState(0);
  const [concerts, setConcerts] = useState([]);
  const [selectedShowtime, setSelectedShowtime] = useState(null);
  const [seatData, setSeatData] = useState({ zones: [], seats: [] });
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [booking, setBooking] = useState(null);
  const [paymentRef, setPaymentRef] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [guest, setGuest] = useState({
    name: session?.name || "NodNod Guest",
    email: session?.email || "customer@example.com",
    password: "customer123",
  });
  const [payment, setPayment] = useState({
    cardName: session?.name || "",
    cardNumber: "",
    expiry: "",
    cvc: "",
  });

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
    loadConcerts().catch((err) => {
      setNotice(err.message);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    setSelectedSeats([]);
    setBooking(null);
    setPaymentRef("");
    loadSeats(selectedShowtime).catch((err) => setNotice(err.message));
  }, [selectedShowtime]);

  const activeConcert = useMemo(
    () => concerts.find((concert) => concert.showtime_id === Number(selectedShowtime)),
    [concerts, selectedShowtime],
  );

  const selectedSeatRows = useMemo(
    () => seatData.seats.filter((seat) => selectedSeats.includes(seat.seat_id)),
    [seatData.seats, selectedSeats],
  );

  const selectedTotal = useMemo(
    () => selectedSeatRows.reduce((sum, seat) => sum + Number(seat.price || 0), 0),
    [selectedSeatRows],
  );

  const canContinue = [
    Boolean(activeConcert),
    selectedSeats.length > 0,
    Boolean(guest.name && guest.email && guest.password),
    true,
    Boolean(payment.cardName && payment.cardNumber && payment.expiry && payment.cvc),
    true,
  ][step];

  function chooseConcert(showtimeId) {
    setSelectedShowtime(showtimeId);
    setStep(0);
  }

  function toggleSeat(seat) {
    if (seat.seat_status !== "available" || booking) return;
    setSelectedSeats((current) =>
      current.includes(seat.seat_id)
        ? current.filter((seatId) => seatId !== seat.seat_id)
        : [...current, seat.seat_id],
    );
  }

  async function next() {
    setNotice("");
    if (!canContinue) return;
    if (step === 1 && !booking) {
      try {
        const hold = await api.holdSeats({
          showtime_id: Number(selectedShowtime),
          seat_ids: selectedSeats,
        });
        setBooking(hold);
        await loadSeats(selectedShowtime);
      } catch (err) {
        setNotice(err.message);
        await loadSeats(selectedShowtime);
        return;
      }
    }
    if (step === 4 && booking && !paymentRef) {
      try {
        const confirmed = await api.confirmPayment({
          booking_id: booking.booking_id,
          payment_method: "card",
        });
        setPaymentRef(confirmed.transaction_ref);
        await loadSeats(selectedShowtime);
        await loadConcerts();
      } catch (err) {
        setNotice(err.message);
        await loadSeats(selectedShowtime);
        return;
      }
    }
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  function back() {
    setNotice("");
    setStep((current) => Math.max(current - 1, 0));
  }

  function resetFlow() {
    setStep(0);
    setSelectedSeats([]);
    setBooking(null);
    setPaymentRef("");
    setPayment({ cardName: session?.name || "", cardNumber: "", expiry: "", cvc: "" });
    loadSeats(selectedShowtime).catch((err) => setNotice(err.message));
  }

  return (
    <AppShell>
      <div className="bookingFlow">
        <aside className="bookingPoster" style={{ backgroundImage: `url(${activeConcert?.poster_url || ""})` }}>
          <div className="bookingPosterOverlay">
            <p className="kicker">NodNod Live House</p>
            <h2>{activeConcert?.artist || "NodNod"}</h2>
            <p>{activeConcert?.description || "Warm lights, jangly guitars, and a ticket that feels like a keepsake."}</p>
          </div>
        </aside>

        <main className="bookingFlowMain">
          <header className="flowHeader">
            <div>
              <p className="kicker">Concert Ticket Booking Platform</p>
              <h2>{steps[step]}</h2>
            </div>
            <span className="vinylStamp">NodNod</span>
          </header>

          <ol className="stepRail">
            {steps.map((label, index) => (
              <motion.li
                key={label}
                className={index === step ? "active" : index < step ? "done" : ""}
                animate={{ scale: index === step ? 1.05 : 1, opacity: index > step ? 0.6 : 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <span>{index + 1}</span>
                <strong>{label}</strong>
              </motion.li>
            ))}
          </ol>

          {notice && <p className="noticeText flowNotice">{notice}</p>}

          <section className="flowCard" style={{ overflow: "hidden", position: "relative" }}>
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="p-4">
                  <p className="muted">Loading shows...</p>
                </motion.div>
              ) : (
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                >
                  {step === 0 && (
                    <EventDetails concerts={concerts} activeConcert={activeConcert} selectedShowtime={selectedShowtime} onChoose={chooseConcert} />
                  )}
                  {step === 1 && (
                    <SeatSelection
                      zones={seatData.zones}
                      seats={seatData.seats}
                      selectedSeats={selectedSeats}
                      onToggleSeat={toggleSeat}
                    />
                  )}
                  {step === 2 && (
                    <LoginStep
                      guest={guest}
                      setGuest={setGuest}
                      showPassword={showPassword}
                      setShowPassword={setShowPassword}
                    />
                  )}
                  {step === 3 && (
                    <OrderSummary
                      activeConcert={activeConcert}
                      booking={booking}
                      selectedSeatRows={selectedSeatRows}
                      selectedTotal={selectedTotal}
                    />
                  )}
                  {step === 4 && (
                    <PaymentStep payment={payment} setPayment={setPayment} total={booking?.total_amount || selectedTotal} />
                  )}
                  {step === 5 && (
                    <Confirmation
                      guest={guest}
                      activeConcert={activeConcert}
                      booking={booking}
                      paymentRef={paymentRef}
                      selectedSeatRows={selectedSeatRows}
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          <footer className="flowActions">
            <button className="button secondary" disabled={step === 0} onClick={back} type="button">
              Back
            </button>
            {step < steps.length - 1 ? (
              <button className="button primary" disabled={!canContinue || loading} onClick={next} type="button">
                {step === 1 ? "Hold Seats" : step === 4 ? "Pay & Confirm" : "Continue"}
              </button>
            ) : (
              <button className="button primary" onClick={resetFlow} type="button">
                Book Another Ticket
              </button>
            )}
          </footer>
        </main>
      </div>
    </AppShell>
  );
}

function EventDetails({ concerts, activeConcert, selectedShowtime, onChoose }) {
  return (
    <div className="eventDetailsGrid">
      <div>
        <p className="kicker">{activeConcert?.genre || "Live Session"}</p>
        <h3>{activeConcert?.title || "Choose your concert"}</h3>
        <p className="flowLede">{activeConcert?.description}</p>
        <div className="detailTiles">
          <Detail icon={<CalendarDays size={18} />} label="Date" value={dateLine(activeConcert)} />
          <Detail icon={<MapPin size={18} />} label="Venue" value={`${activeConcert?.venue_name || "TBA"}, ${activeConcert?.city || ""}`} />
          <Detail icon={<Ticket size={18} />} label="Availability" value={`${activeConcert?.available_seats || 0} seats left`} />
          <Detail icon={<ReceiptText size={18} />} label="Showtime ID" value={activeConcert?.showtime_id || "-"} />
        </div>
      </div>

      <div className="showPicker">
        <h4>Upcoming Sets</h4>
        {concerts.map((concert) => (
          <button
            className={`showOption ${Number(selectedShowtime) === concert.showtime_id ? "active" : ""}`}
            key={concert.showtime_id}
            onClick={() => onChoose(concert.showtime_id)}
            type="button"
          >
            <img src={concert.poster_url} alt="" />
            <span>
              <strong>{concert.title}</strong>
              <small>{concert.artist} · {dateLine(concert)}</small>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SeatSelection({ zones, seats, selectedSeats, onToggleSeat }) {
  return (
    <div>
      <div className="stageArc">Stage</div>
      <div className="zoneLegend">
        {zones.map((zone) => (
          <span key={zone.zone_id}>
            {zone.zone_name} · {money(zone.price)} · {zone.available_seats} open
          </span>
        ))}
      </div>
      <div className="flowSeatMap" aria-label="Seat map">
        {seats.map((seat) => (
          <button
            className={`seatButton ${seat.seat_status} ${selectedSeats.includes(seat.seat_id) ? "selected" : ""}`}
            key={seat.seat_id}
            onClick={() => onToggleSeat(seat)}
            disabled={seat.seat_status !== "available"}
            title={`${seat.zone_name} ${seat.seat_no}`}
            type="button"
          >
            {seat.seat_no}
          </button>
        ))}
      </div>
      <div className="seatLegend">
        <span><i className="available" /> Available</span>
        <span><i className="selected" /> Selected</span>
        <span><i className="pending" /> Pending</span>
        <span><i className="sold" /> Sold</span>
      </div>
    </div>
  );
}

function LoginStep({ guest, setGuest, showPassword, setShowPassword }) {
  return (
    <div>
      <p className="flowLede">Your account is already signed in. This screen keeps the requested six-step checkout shape and lets the ticket receipt details be checked before payment.</p>
      <div className="flowFormGrid">
        <Field label="Full name" value={guest.name} onChange={(name) => setGuest({ ...guest, name })} />
        <Field label="Email" type="email" value={guest.email} onChange={(email) => setGuest({ ...guest, email })} />
        <Field
          action={
            <button className="fieldIconButton" onClick={() => setShowPassword((value) => !value)} type="button">
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          }
          label="Password"
          type={showPassword ? "text" : "password"}
          value={guest.password}
          onChange={(password) => setGuest({ ...guest, password })}
        />
      </div>
    </div>
  );
}

function OrderSummary({ activeConcert, booking, selectedSeatRows, selectedTotal }) {
  const total = Number(booking?.total_amount || selectedTotal);
  return (
    <div className="orderSummary">
      <div className="ticketStub">
        <span>Admit One</span>
        <strong>{activeConcert?.artist || "NodNod"}</strong>
        <p>{activeConcert?.title}</p>
        {booking && <small>Held until {new Date(booking.hold_expires_at).toLocaleTimeString()}</small>}
      </div>
      <SummaryRows selectedSeatRows={selectedSeatRows} total={total} />
    </div>
  );
}

function PaymentStep({ payment, setPayment, total }) {
  return (
    <div className="paymentGrid">
      <div className="vinylPayment">
        <CreditCard size={24} />
        <span>Now Paying</span>
        <strong>{money(total)}</strong>
        <p>Secure demo checkout for NodNod Live House.</p>
      </div>
      <div className="flowFormGrid">
        <Field label="Name on card" value={payment.cardName} onChange={(cardName) => setPayment({ ...payment, cardName })} />
        <Field label="Card number" value={payment.cardNumber} onChange={(cardNumber) => setPayment({ ...payment, cardNumber })} placeholder="4242 4242 4242 4242" />
        <Field label="Expiry" value={payment.expiry} onChange={(expiry) => setPayment({ ...payment, expiry })} placeholder="MM/YY" />
        <Field label="CVC" value={payment.cvc} onChange={(cvc) => setPayment({ ...payment, cvc })} placeholder="123" />
      </div>
    </div>
  );
}

function Confirmation({ guest, activeConcert, booking, paymentRef, selectedSeatRows }) {
  return (
    <div className="confirmationPanel">
      <span className="confirmationBadge"><CheckCircle2 size={18} /> Confirmed</span>
      <h3>Your tickets are ready, {guest.name}.</h3>
      <p className="flowLede">A confirmation for {activeConcert?.title} is ready for {guest.email}.</p>
      <div className="confirmationMeta">
        <Detail label="Booking" value={`#${booking?.booking_id || "-"}`} />
        <Detail label="Payment" value={paymentRef || "Confirmed"} />
        <Detail label="Seats" value={selectedSeatRows.map((seat) => seat.seat_no).join(", ")} />
        <Detail label="Show" value={dateLine(activeConcert)} />
      </div>
    </div>
  );
}

function SummaryRows({ selectedSeatRows, total }) {
  return (
    <div className="flowSummaryRows">
      {selectedSeatRows.map((seat) => (
        <div key={seat.seat_id}>
          <span>{seat.zone_name} · Seat {seat.seat_no}</span>
          <strong>{money(seat.price)}</strong>
        </div>
      ))}
      <div className="total">
        <span>Total</span>
        <strong>{money(total)}</strong>
      </div>
    </div>
  );
}

function Detail({ icon, label, value }) {
  return (
    <div className="detailTile">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Field({ action, label, onChange, placeholder = "", type = "text", value }) {
  return (
    <label className="flowField">
      <span>{label}</span>
      <div className="flowFieldControl">
        <input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
        {action}
      </div>
    </label>
  );
}
