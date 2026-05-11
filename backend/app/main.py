from __future__ import annotations

import asyncio
import os
import uuid
from datetime import datetime
import shutil
from decimal import Decimal

import psycopg2
from fastapi import Depends, FastAPI, HTTPException, Query, status, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .database import db_session, wait_for_db
from .dependencies import Principal, get_current_principal, require_admin, require_customer
from .schemas import (
    ConcertCreate,
    ConcertUpdate,
    LoginRequest,
    PaymentConfirmRequest,
    RegisterRequest,
    SeatHoldRequest,
    SeatReleaseRequest,
    SeatSelectRequest,
    ZoneUpdate,
)
from .security import create_access_token, hash_password, verify_password


app = FastAPI(title="Concert Ticket Booking API", version="1.0.0")
release_task: asyncio.Task | None = None

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def release_expired_locks() -> int:
    with db_session() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE seat s
                SET seat_status = 'available', locked_until = NULL
                FROM ticket t
                JOIN booking b ON b.booking_id = t.booking_id
                WHERE s.seat_id = t.seat_id
                  AND b.booking_status = 'pending'
                  AND b.hold_expires_at < NOW()
                  AND s.seat_status = 'pending'
                """
            )
            released_seats = cur.rowcount
            cur.execute(
                """
                UPDATE ticket t
                SET ticket_status = 'cancelled'
                FROM booking b
                WHERE b.booking_id = t.booking_id
                  AND b.booking_status = 'pending'
                  AND b.hold_expires_at < NOW()
                  AND t.ticket_status = 'held'
                """
            )
            cur.execute(
                """
                UPDATE booking
                SET booking_status = 'expired'
                WHERE booking_status = 'pending'
                  AND hold_expires_at < NOW()
                """
            )
            return released_seats


async def auto_release_loop() -> None:
    while True:
        await asyncio.to_thread(release_expired_locks)
        await asyncio.sleep(60)


@app.on_event("startup")
async def startup_event() -> None:
    global release_task
    await asyncio.to_thread(wait_for_db)
    release_task = asyncio.create_task(auto_release_loop())


@app.on_event("shutdown")
async def shutdown_event() -> None:
    if release_task:
        release_task.cancel()


def _decimal_to_float(value):
    if isinstance(value, Decimal):
        return float(value)
    return value


def _seat_prefix(zone_name: str) -> str:
    letters = "".join(word[0] for word in zone_name.replace("-", " ").split() if word)
    return (letters or zone_name[:2] or "Z").upper()[:3]


def _money_fields(row: dict, fields: tuple[str, ...]) -> dict:
    for field in fields:
        if field in row:
            row[field] = _decimal_to_float(row[field])
    return row


def _json_safe_rows(rows: list[dict]) -> list[dict]:
    return [{key: _decimal_to_float(value) for key, value in row.items()} for row in rows]


@app.get("/api/health")
def health_check():
    return {"status": "ok"}


@app.post("/api/auth/register", status_code=status.HTTP_201_CREATED)
def register_customer(payload: RegisterRequest):
    with db_session() as conn:
        with conn.cursor() as cur:
            try:
                cur.execute(
                    """
                    INSERT INTO users (full_name, email, phone, password_hash)
                    VALUES (%s, %s, %s, %s)
                    RETURNING user_id, full_name, email
                    """,
                    (payload.full_name, payload.email.lower(), payload.phone, hash_password(payload.password)),
                )
            except psycopg2.errors.UniqueViolation as exc:
                raise HTTPException(status_code=409, detail="Email is already registered") from exc
            user = cur.fetchone()
    return user


@app.post("/api/auth/login")
def login(payload: LoginRequest):
    identifier = payload.identifier.strip().lower()
    with db_session() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT user_id AS id, full_name AS profile_name, email, password_hash
                FROM users
                WHERE LOWER(email) = %s
                """,
                (identifier,),
            )
            user = cur.fetchone()
            if user and verify_password(payload.password, user["password_hash"]):
                token = create_access_token(user["id"], "customer", user["profile_name"])
                return {
                    "access_token": token,
                    "token_type": "bearer",
                    "role": "customer",
                    "profile_name": user["profile_name"],
                }

            cur.execute(
                """
                SELECT admin_id AS id, display_name AS profile_name, email, username, password_hash
                FROM admin
                WHERE LOWER(email) = %s OR LOWER(username) = %s
                """,
                (identifier, identifier),
            )
            admin = cur.fetchone()
            if admin and verify_password(payload.password, admin["password_hash"]):
                token = create_access_token(admin["id"], "admin", admin["profile_name"])
                return {
                    "access_token": token,
                    "token_type": "bearer",
                    "role": "admin",
                    "profile_name": admin["profile_name"],
                }

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid login credentials")


@app.get("/api/concerts")
def list_concerts():
    release_expired_locks()
    with db_session() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    c.concert_id,
                    c.title,
                    c.artist,
                    c.genre,
                    c.description,
                    c.poster_url,
                    s.showtime_id,
                    s.show_date,
                    s.show_time,
                    v.venue_name,
                    v.city,
                    COALESCE(SUM(CASE WHEN seat.seat_status = 'available' THEN 1 ELSE 0 END), 0) AS available_seats,
                    COALESCE(SUM(CASE WHEN seat.seat_status = 'sold' THEN 1 ELSE 0 END), 0) AS sold_seats,
                    COUNT(seat.seat_id) AS total_seats,
                    COALESCE(
                        ROUND(
                            COALESCE(SUM(CASE WHEN seat.seat_status = 'sold' THEN 1 ELSE 0 END), 0) * 100.0
                            / NULLIF(COUNT(seat.seat_id), 0),
                            1
                        ),
                        0
                    ) AS booking_rate
                FROM concert c
                JOIN showtime s ON s.concert_id = c.concert_id
                LEFT JOIN venue v ON v.venue_id = s.venue_id
                LEFT JOIN zone z ON z.showtime_id = s.showtime_id
                LEFT JOIN seat ON seat.zone_id = z.zone_id
                WHERE c.is_active = TRUE
                GROUP BY c.concert_id, s.showtime_id, v.venue_name, v.city
                ORDER BY s.show_date, s.show_time
                """
            )
            return cur.fetchall()


@app.get("/api/showtimes/{showtime_id}/seats")
def list_seats(showtime_id: int):
    release_expired_locks()
    with db_session() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    z.zone_id,
                    z.zone_name,
                    z.price,
                    z.total_seat,
                    COUNT(*) FILTER (WHERE s.seat_status = 'available') AS available_seats
                FROM zone z
                JOIN seat s ON s.zone_id = z.zone_id
                WHERE z.showtime_id = %s
                GROUP BY z.zone_id
                ORDER BY z.price DESC, z.zone_name
                """,
                (showtime_id,),
            )
            zones = cur.fetchall()
            cur.execute(
                """
                SELECT
                    s.seat_id,
                    s.zone_id,
                    s.seat_no,
                    s.seat_status,
                    s.locked_until,
                    z.price,
                    z.zone_name
                FROM seat s
                JOIN zone z ON z.zone_id = s.zone_id
                WHERE z.showtime_id = %s
                ORDER BY z.price DESC, z.zone_name, s.seat_no
                """,
                (showtime_id,),
            )
            seats = cur.fetchall()

    for zone in zones:
        zone["price"] = _decimal_to_float(zone["price"])
    for seat in seats:
        seat["price"] = _decimal_to_float(seat["price"])
    return {"zones": zones, "seats": seats}


@app.post("/api/bookings/hold", status_code=status.HTTP_201_CREATED)
def hold_seats(payload: SeatHoldRequest, principal: Principal = Depends(require_customer)):
    unique_seat_ids = sorted(set(payload.seat_ids))
    if len(unique_seat_ids) != len(payload.seat_ids):
        raise HTTPException(status_code=400, detail="Duplicate seats are not allowed in one booking")

    release_expired_locks()
    with db_session() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT showtime_id FROM showtime WHERE showtime_id = %s", (payload.showtime_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Showtime not found")

            cur.execute(
                """
                SELECT s.seat_id, s.seat_status, z.price
                FROM seat s
                JOIN zone z ON z.zone_id = s.zone_id
                WHERE z.showtime_id = %s
                  AND s.seat_id = ANY(%s)
                FOR UPDATE OF s
                """,
                (payload.showtime_id, unique_seat_ids),
            )
            seats = cur.fetchall()
            if len(seats) != len(unique_seat_ids):
                raise HTTPException(status_code=400, detail="One or more seats do not belong to this showtime")

            unavailable = [seat["seat_id"] for seat in seats if seat["seat_status"] != "available"]
            if unavailable:
                raise HTTPException(status_code=409, detail=f"Seats no longer available: {unavailable}")

            total_amount = sum((seat["price"] for seat in seats), Decimal("0"))
            cur.execute(
                """
                INSERT INTO booking (user_id, showtime_id, booking_amount, total_amount, hold_expires_at)
                VALUES (%s, %s, %s, %s, NOW() + INTERVAL '15 minutes')
                RETURNING booking_id, hold_expires_at, total_amount
                """,
                (principal.id, payload.showtime_id, len(seats), total_amount),
            )
            booking = cur.fetchone()

            cur.execute(
                """
                UPDATE seat
                SET seat_status = 'pending', locked_until = %s
                WHERE seat_id = ANY(%s)
                """,
                (booking["hold_expires_at"], unique_seat_ids),
            )

            for seat in seats:
                cur.execute(
                    """
                    INSERT INTO ticket (booking_id, showtime_id, seat_id, price_paid, ticket_status)
                    VALUES (%s, %s, %s, %s, 'held')
                    """,
                    (booking["booking_id"], payload.showtime_id, seat["seat_id"], seat["price"]),
                )

    booking["total_amount"] = _decimal_to_float(booking["total_amount"])
    return {
        "booking_id": booking["booking_id"],
        "hold_expires_at": booking["hold_expires_at"],
        "total_amount": booking["total_amount"],
        "seat_ids": unique_seat_ids,
    }


@app.post("/api/bookings/select-seat", status_code=status.HTTP_201_CREATED)
def select_seat(payload: SeatSelectRequest, principal: Principal = Depends(require_customer)):
    release_expired_locks()
    with db_session() as conn:
        with conn.cursor() as cur:
            booking = None
            if payload.booking_id is not None:
                cur.execute(
                    """
                    SELECT booking_id, user_id, showtime_id, booking_status, hold_expires_at
                    FROM booking
                    WHERE booking_id = %s
                    FOR UPDATE
                    """,
                    (payload.booking_id,),
                )
                booking = cur.fetchone()
                if not booking:
                    raise HTTPException(status_code=404, detail="Booking hold not found")
                if booking["user_id"] != principal.id:
                    raise HTTPException(status_code=403, detail="Cannot update another customer's booking")
                if booking["booking_status"] != "pending" or booking["hold_expires_at"] < datetime.now(booking["hold_expires_at"].tzinfo):
                    raise HTTPException(status_code=409, detail="Booking hold is no longer active")
                if booking["showtime_id"] != payload.showtime_id:
                    raise HTTPException(status_code=400, detail="Seat belongs to a different showtime")

            cur.execute(
                """
                SELECT s.seat_id, s.seat_status, z.price
                FROM seat s
                JOIN zone z ON z.zone_id = s.zone_id
                WHERE z.showtime_id = %s
                  AND s.seat_id = %s
                FOR UPDATE OF s
                """,
                (payload.showtime_id, payload.seat_id),
            )
            seat = cur.fetchone()
            if not seat:
                raise HTTPException(status_code=404, detail="Seat not found for this showtime")
            if seat["seat_status"] != "available":
                raise HTTPException(status_code=409, detail="Seat is already reserved or sold")

            if booking is None:
                cur.execute(
                    """
                    INSERT INTO booking (user_id, showtime_id, booking_amount, total_amount, hold_expires_at)
                    VALUES (%s, %s, 1, %s, NOW() + INTERVAL '15 minutes')
                    RETURNING booking_id, hold_expires_at, total_amount, booking_amount
                    """,
                    (principal.id, payload.showtime_id, seat["price"]),
                )
                booking = cur.fetchone()
                should_increment_booking = False
            else:
                should_increment_booking = True

            cur.execute(
                """
                UPDATE seat
                SET seat_status = 'pending', locked_until = %s
                WHERE seat_id = %s
                """,
                (booking["hold_expires_at"], payload.seat_id),
            )
            cur.execute(
                """
                INSERT INTO ticket (booking_id, showtime_id, seat_id, price_paid, ticket_status)
                VALUES (%s, %s, %s, %s, 'held')
                """,
                (booking["booking_id"], payload.showtime_id, payload.seat_id, seat["price"]),
            )
            if should_increment_booking:
                cur.execute(
                    """
                    UPDATE booking
                    SET booking_amount = booking_amount + 1,
                        total_amount = total_amount + %s
                    WHERE booking_id = %s
                    RETURNING booking_id, hold_expires_at, total_amount, booking_amount
                    """,
                    (seat["price"], booking["booking_id"]),
                )
                updated = cur.fetchone()
            else:
                updated = booking

    return {
        "booking_id": updated["booking_id"],
        "hold_expires_at": updated["hold_expires_at"],
        "total_amount": _decimal_to_float(updated["total_amount"]),
        "booking_amount": updated["booking_amount"],
        "seat_id": payload.seat_id,
    }


@app.post("/api/bookings/release-seat")
def release_selected_seat(payload: SeatReleaseRequest, principal: Principal = Depends(require_customer)):
    release_expired_locks()
    with db_session() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT booking_id, user_id, booking_status
                FROM booking
                WHERE booking_id = %s
                FOR UPDATE
                """,
                (payload.booking_id,),
            )
            booking = cur.fetchone()
            if not booking:
                return {"booking": None, "released_seat_id": payload.seat_id}
            if booking["user_id"] != principal.id:
                raise HTTPException(status_code=403, detail="Cannot update another customer's booking")
            if booking["booking_status"] != "pending":
                raise HTTPException(status_code=409, detail="Only pending holds can release seats")

            cur.execute(
                """
                SELECT ticket_id, price_paid
                FROM ticket
                WHERE booking_id = %s
                  AND seat_id = %s
                  AND ticket_status = 'held'
                FOR UPDATE
                """,
                (payload.booking_id, payload.seat_id),
            )
            ticket = cur.fetchone()
            if not ticket:
                return {"booking": booking, "released_seat_id": payload.seat_id}

            cur.execute("DELETE FROM ticket WHERE ticket_id = %s", (ticket["ticket_id"],))
            cur.execute(
                """
                UPDATE seat
                SET seat_status = 'available', locked_until = NULL
                WHERE seat_id = %s
                  AND seat_status = 'pending'
                """,
                (payload.seat_id,),
            )
            cur.execute(
                """
                SELECT COUNT(*) AS remaining_tickets
                FROM ticket
                WHERE booking_id = %s
                  AND ticket_status = 'held'
                """,
                (payload.booking_id,),
            )
            remaining = cur.fetchone()["remaining_tickets"]
            if remaining <= 0:
                cur.execute("DELETE FROM booking WHERE booking_id = %s", (payload.booking_id,))
                return {"booking": None, "released_seat_id": payload.seat_id}
            cur.execute(
                """
                UPDATE booking
                SET booking_amount = %s,
                    total_amount = GREATEST(total_amount - %s, 0)
                WHERE booking_id = %s
                RETURNING booking_id, booking_amount, total_amount, hold_expires_at
                """,
                (remaining, ticket["price_paid"], payload.booking_id),
            )
            updated = cur.fetchone()

    updated["total_amount"] = _decimal_to_float(updated["total_amount"])
    return {"booking": updated, "released_seat_id": payload.seat_id}


@app.post("/api/payments/confirm")
def confirm_payment(
    payload: PaymentConfirmRequest,
    principal: Principal = Depends(get_current_principal),
):
    release_expired_locks()
    with db_session() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT booking_id, user_id, total_amount, booking_status, hold_expires_at
                FROM booking
                WHERE booking_id = %s
                FOR UPDATE
                """,
                (payload.booking_id,),
            )
            booking = cur.fetchone()
            if not booking:
                raise HTTPException(status_code=404, detail="Booking not found")
            if principal.role == "customer" and booking["user_id"] != principal.id:
                raise HTTPException(status_code=403, detail="Cannot pay for another customer's booking")
            if booking["booking_status"] != "pending":
                raise HTTPException(status_code=409, detail=f"Booking is {booking['booking_status']}")

            transaction_ref = f"PAY-{uuid.uuid4().hex[:18].upper()}"
            cur.execute(
                """
                INSERT INTO payment (booking_id, amount, payment_method, payment_status, transaction_ref)
                VALUES (%s, %s, %s, 'completed', %s)
                RETURNING payment_id, paid_at, transaction_ref
                """,
                (booking["booking_id"], booking["total_amount"], payload.payment_method, transaction_ref),
            )
            payment = cur.fetchone()
            cur.execute(
                """
                UPDATE booking
                SET booking_status = 'paid'
                WHERE booking_id = %s
                """,
                (booking["booking_id"],),
            )
            cur.execute(
                """
                UPDATE ticket
                SET ticket_status = 'sold'
                WHERE booking_id = %s
                """,
                (booking["booking_id"],),
            )
            cur.execute(
                """
                UPDATE seat s
                SET seat_status = 'sold', locked_until = NULL
                FROM ticket t
                WHERE t.seat_id = s.seat_id
                  AND t.booking_id = %s
                """,
                (booking["booking_id"],),
            )

    return {
        "payment_id": payment["payment_id"],
        "paid_at": payment["paid_at"],
        "transaction_ref": payment["transaction_ref"],
        "amount": _decimal_to_float(booking["total_amount"]),
    }


@app.get("/api/bookings/history")
def booking_history(principal: Principal = Depends(require_customer)):
    release_expired_locks()
    with db_session() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    b.booking_id,
                    b.booking_status,
                    b.booking_amount,
                    b.total_amount,
                    b.hold_expires_at,
                    b.created_at,
                    c.title AS concert_title,
                    c.artist,
                    c.poster_url,
                    s.show_date,
                    s.show_time,
                    COALESCE(v.venue_name, '-') AS venue_name,
                    COALESCE(v.city, '-') AS city,
                    COALESCE(p.payment_method, '-') AS payment_method,
                    COALESCE(p.transaction_ref, '-') AS transaction_ref,
                    p.paid_at,
                    STRING_AGG(DISTINCT z.zone_name || ' ' || st.seat_no, ', ' ORDER BY z.zone_name || ' ' || st.seat_no) AS seats
                FROM booking b
                LEFT JOIN showtime s ON s.showtime_id = b.showtime_id
                LEFT JOIN concert c ON c.concert_id = s.concert_id
                LEFT JOIN venue v ON v.venue_id = s.venue_id
                LEFT JOIN ticket t ON t.booking_id = b.booking_id
                LEFT JOIN seat st ON st.seat_id = t.seat_id
                LEFT JOIN zone z ON z.zone_id = st.zone_id
                LEFT JOIN payment p ON p.booking_id = b.booking_id
                WHERE b.user_id = %s
                GROUP BY b.booking_id, c.title, c.artist, c.poster_url, s.show_date, s.show_time, v.venue_name, v.city,
                         p.payment_method, p.transaction_ref, p.paid_at
                ORDER BY b.created_at DESC
                """,
                (principal.id,),
            )
            rows = cur.fetchall()

    for row in rows:
        _money_fields(row, ("total_amount",))
    return rows


@app.get("/api/admin/concerts")
def admin_concerts(_: Principal = Depends(require_admin)):
    with db_session() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    c.concert_id,
                    c.title,
                    c.artist,
                    c.genre,
                    c.description,
                    c.poster_url,
                    c.is_active,
                    MIN(s.show_date) AS next_show_date,
                    COUNT(DISTINCT s.showtime_id) AS showtime_count,
                    COUNT(DISTINCT b.booking_id) FILTER (WHERE b.booking_status = 'paid') AS paid_bookings,
                    COUNT(DISTINCT t.ticket_id) FILTER (WHERE t.ticket_status = 'sold') AS sold_tickets,
                    COUNT(DISTINCT st.seat_id) AS total_seats,
                    COALESCE(
                        ROUND(
                            COUNT(DISTINCT t.ticket_id) FILTER (WHERE t.ticket_status = 'sold') * 100.0
                            / NULLIF(COUNT(DISTINCT st.seat_id), 0),
                            1
                        ),
                        0
                    ) AS booking_rate
                FROM concert c
                LEFT JOIN showtime s ON s.concert_id = c.concert_id
                LEFT JOIN booking b ON b.showtime_id = s.showtime_id
                LEFT JOIN ticket t ON t.booking_id = b.booking_id AND t.ticket_status = 'sold'
                LEFT JOIN zone z ON z.showtime_id = s.showtime_id
                LEFT JOIN seat st ON st.zone_id = z.zone_id
                GROUP BY c.concert_id
                ORDER BY c.created_at DESC
                """
            )
            return cur.fetchall()


@app.get("/api/admin/dashboard")
def admin_dashboard(_: Principal = Depends(require_admin)):
    release_expired_locks()
    with db_session() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    (SELECT COALESCE(SUM(amount), 0) FROM payment WHERE payment_status = 'completed') AS total_revenue,
                    (SELECT COUNT(*) FROM booking WHERE booking_status IN ('pending', 'paid')) AS active_bookings,
                    (SELECT COUNT(*) FROM showtime WHERE show_date >= CURRENT_DATE) AS upcoming_shows,
                    (
                        SELECT COUNT(*)
                        FROM (
                            SELECT b.user_id, COALESCE(SUM(p.amount), 0) AS total_spend
                            FROM booking b
                            JOIN payment p ON p.booking_id = b.booking_id
                            WHERE p.payment_status = 'completed'
                            GROUP BY b.user_id
                        ) spend
                        WHERE spend.total_spend >= 5000
                    ) AS vip_customers
                """
            )
            metrics = cur.fetchone()
            cur.execute(
                """
                SELECT
                    b.booking_id,
                    COALESCE(u.full_name, 'Deleted user') AS customer,
                    COALESCE(c.title, 'Deleted concert') AS concert,
                    COALESCE(z.zone_name, '-') AS zone,
                    b.total_amount,
                    b.booking_status,
                    b.created_at
                FROM booking b
                LEFT JOIN users u ON u.user_id = b.user_id
                LEFT JOIN ticket t ON t.booking_id = b.booking_id
                LEFT JOIN seat st ON st.seat_id = t.seat_id
                LEFT JOIN zone z ON z.zone_id = st.zone_id
                LEFT JOIN showtime s ON s.showtime_id = b.showtime_id
                LEFT JOIN concert c ON c.concert_id = s.concert_id
                GROUP BY b.booking_id, u.full_name, c.title, z.zone_name
                ORDER BY b.created_at DESC
                LIMIT 8
                """
            )
            recent_bookings = cur.fetchall()

    _money_fields(metrics, ("total_revenue",))
    for row in recent_bookings:
        _money_fields(row, ("total_amount",))
    return {"metrics": metrics, "recent_bookings": recent_bookings}


@app.get("/api/admin/inventory")
def admin_inventory(showtime_id: int | None = None, _: Principal = Depends(require_admin)):
    release_expired_locks()
    params: list[int] = []
    showtime_filter = ""
    if showtime_id is not None:
        showtime_filter = "WHERE s.showtime_id = %s"
        params.append(showtime_id)

    with db_session() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    s.showtime_id,
                    c.title,
                    c.artist,
                    v.venue_name,
                    s.show_date,
                    s.show_time
                FROM showtime s
                JOIN concert c ON c.concert_id = s.concert_id
                LEFT JOIN venue v ON v.venue_id = s.venue_id
                ORDER BY s.show_date DESC, s.show_time DESC
                """
            )
            showtimes = cur.fetchall()
            cur.execute(
                f"""
                SELECT
                    z.zone_id,
                    z.showtime_id,
                    z.zone_name,
                    z.price,
                    z.total_seat,
                    c.title,
                    COALESCE(v.venue_name, '-') AS venue_name,
                    COUNT(st.seat_id) AS actual_seats,
                    COUNT(st.seat_id) FILTER (WHERE st.seat_status = 'sold') AS seats_sold,
                    COUNT(st.seat_id) FILTER (WHERE st.seat_status = 'available') AS seats_available,
                    COUNT(st.seat_id) FILTER (WHERE st.seat_status = 'pending') AS seats_pending
                FROM zone z
                JOIN showtime s ON s.showtime_id = z.showtime_id
                JOIN concert c ON c.concert_id = s.concert_id
                LEFT JOIN venue v ON v.venue_id = s.venue_id
                LEFT JOIN seat st ON st.zone_id = z.zone_id
                {showtime_filter}
                GROUP BY z.zone_id, c.title, v.venue_name
                ORDER BY c.title, z.price DESC, z.zone_name
                """,
                params,
            )
            zones = cur.fetchall()

    for row in zones:
        _money_fields(row, ("price",))
    return {"showtimes": showtimes, "zones": zones}


@app.patch("/api/admin/zones/{zone_id}")
def update_zone(zone_id: int, payload: ZoneUpdate, _: Principal = Depends(require_admin)):
    if payload.price is None and payload.total_seat is None:
        raise HTTPException(status_code=400, detail="Provide price or total_seat to update")

    with db_session() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT z.zone_id, z.zone_name, z.price, z.total_seat, COUNT(s.seat_id) AS actual_seats
                FROM zone z
                LEFT JOIN seat s ON s.zone_id = z.zone_id
                WHERE z.zone_id = %s
                GROUP BY z.zone_id
                FOR UPDATE OF z
                """,
                (zone_id,),
            )
            zone = cur.fetchone()
            if not zone:
                raise HTTPException(status_code=404, detail="Zone not found")

            target_total = payload.total_seat if payload.total_seat is not None else zone["total_seat"]
            actual_seats = int(zone["actual_seats"])
            if target_total > actual_seats:
                prefix = _seat_prefix(zone["zone_name"])
                seat_rows = [(zone_id, f"{prefix}-{index:03d}") for index in range(actual_seats + 1, target_total + 1)]
                cur.executemany("INSERT INTO seat (zone_id, seat_no) VALUES (%s, %s) ON CONFLICT DO NOTHING", seat_rows)
            elif target_total < actual_seats:
                seats_to_remove = actual_seats - target_total
                cur.execute(
                    """
                    SELECT seat_id
                    FROM seat
                    WHERE zone_id = %s AND seat_status = 'available'
                    ORDER BY seat_no DESC
                    LIMIT %s
                    """,
                    (zone_id, seats_to_remove),
                )
                removable = [row["seat_id"] for row in cur.fetchall()]
                if len(removable) < seats_to_remove:
                    raise HTTPException(
                        status_code=409,
                        detail="Cannot reduce capacity below sold or locked seats",
                    )
                cur.execute("DELETE FROM seat WHERE seat_id = ANY(%s)", (removable,))

            cur.execute(
                """
                UPDATE zone
                SET price = COALESCE(%s, price),
                    total_seat = %s
                WHERE zone_id = %s
                RETURNING zone_id, zone_name, price, total_seat
                """,
                (payload.price, target_total, zone_id),
            )
            updated = cur.fetchone()

    return _money_fields(updated, ("price",))


@app.get("/api/admin/cleanup")
def cleanup_candidates(_: Principal = Depends(require_admin)):
    released = release_expired_locks()
    with db_session() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    b.booking_id,
                    COALESCE(u.full_name, 'Deleted user') AS customer,
                    COALESCE(c.title, 'Deleted concert') AS concert,
                    b.total_amount,
                    b.booking_status,
                    b.hold_expires_at,
                    b.created_at
                FROM booking b
                LEFT JOIN users u ON u.user_id = b.user_id
                LEFT JOIN showtime s ON s.showtime_id = b.showtime_id
                LEFT JOIN concert c ON c.concert_id = s.concert_id
                WHERE b.booking_status IN ('expired', 'cancelled')
                ORDER BY b.created_at DESC
                LIMIT 12
                """
            )
            stale_bookings = cur.fetchall()
            cur.execute("SELECT COUNT(*) AS pending_count FROM booking WHERE booking_status = 'pending'")
            pending = cur.fetchone()["pending_count"]
            cur.execute("SELECT COUNT(*) AS expired_count FROM booking WHERE booking_status = 'expired'")
            expired = cur.fetchone()["expired_count"]

    for row in stale_bookings:
        _money_fields(row, ("total_amount",))
    return {
        "released_now": released,
        "pending_count": pending,
        "expired_count": expired,
        "stale_bookings": stale_bookings,
    }


@app.delete("/api/admin/bookings/{booking_id}")
def delete_stale_booking(booking_id: int, _: Principal = Depends(require_admin)):
    with db_session() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT booking_id, booking_status
                FROM booking
                WHERE booking_id = %s
                FOR UPDATE
                """,
                (booking_id,),
            )
            booking = cur.fetchone()
            if not booking:
                raise HTTPException(status_code=404, detail="Booking not found")
            if booking["booking_status"] not in {"expired", "cancelled"}:
                raise HTTPException(status_code=409, detail="Only expired or cancelled bookings can be deleted")
            cur.execute(
                """
                UPDATE seat s
                SET seat_status = 'available', locked_until = NULL
                FROM ticket t
                WHERE t.seat_id = s.seat_id
                  AND t.booking_id = %s
                  AND s.seat_status = 'pending'
                """,
                (booking_id,),
            )
            cur.execute("DELETE FROM booking WHERE booking_id = %s", (booking_id,))
    return {"deleted": True, "booking_id": booking_id}


@app.get("/api/admin/loyalty")
def loyalty_report(_: Principal = Depends(require_admin)):
    with db_session() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    u.user_id,
                    u.full_name AS customer,
                    COUNT(b.booking_id) FILTER (WHERE b.booking_status = 'paid') AS paid_bookings,
                    COALESCE(SUM(p.amount) FILTER (WHERE p.payment_status = 'completed'), 0) AS total_spend,
                    COALESCE(MAX(b.total_amount) FILTER (WHERE b.booking_status = 'paid'), 0) AS historical_max,
                    CASE
                        WHEN COALESCE(SUM(p.amount) FILTER (WHERE p.payment_status = 'completed'), 0) >= 5000
                          OR COALESCE(MAX(b.total_amount) FILTER (WHERE b.booking_status = 'paid'), 0) >= 3000
                        THEN 'VIP'
                        ELSE 'Regular'
                    END AS loyalty_status
                FROM users u
                LEFT JOIN booking b ON b.user_id = u.user_id
                LEFT JOIN payment p ON p.booking_id = b.booking_id
                GROUP BY u.user_id
                ORDER BY total_spend DESC, historical_max DESC, u.full_name
                LIMIT 20
                """
            )
            rows = cur.fetchall()

    for row in rows:
        _money_fields(row, ("total_spend", "historical_max"))
    return rows


@app.post("/api/admin/concerts", status_code=status.HTTP_201_CREATED)
def create_concert(payload: ConcertCreate, principal: Principal = Depends(require_admin)):
    try:
        with db_session() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO venue (venue_name, address, city, capacity)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (venue_name, city)
                    DO UPDATE SET
                        address = COALESCE(EXCLUDED.address, venue.address),
                        capacity = COALESCE(EXCLUDED.capacity, venue.capacity)
                    RETURNING venue_id
                    """,
                    (payload.venue_name, payload.venue_address, payload.venue_city, payload.venue_capacity),
                )
                venue = cur.fetchone()

                cur.execute(
                    """
                    INSERT INTO concert (title, artist, genre, description, poster_url)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING concert_id
                    """,
                    (payload.title, payload.artist, payload.genre, payload.description, payload.poster_url),
                )
                concert = cur.fetchone()
                concert_id = concert["concert_id"]

                cur.execute(
                    """
                    INSERT INTO admin_concert (admin_id, concert_id)
                    VALUES (%s, %s)
                    ON CONFLICT DO NOTHING
                    """,
                    (principal.id, concert_id),
                )
                cur.execute(
                    """
                    INSERT INTO showtime (concert_id, venue_id, show_date, show_time, sales_start, sales_end)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING showtime_id
                    """,
                    (
                        concert_id,
                        venue["venue_id"],
                        payload.show_date,
                        payload.show_time,
                        payload.sales_start,
                        payload.sales_end,
                    ),
                )
                showtime = cur.fetchone()

                created_zones = []
                for zone in payload.zones:
                    cur.execute(
                        """
                        INSERT INTO zone (showtime_id, zone_name, price, total_seat)
                        VALUES (%s, %s, %s, %s)
                        RETURNING zone_id
                        """,
                        (showtime["showtime_id"], zone.zone_name, zone.price, zone.total_seat),
                    )
                    zone_row = cur.fetchone()
                    created_zones.append(zone_row["zone_id"])
                    prefix = _seat_prefix(zone.zone_name)
                    seat_rows = [(zone_row["zone_id"], f"{prefix}-{index:03d}") for index in range(1, zone.total_seat + 1)]
                    cur.executemany(
                        "INSERT INTO seat (zone_id, seat_no) VALUES (%s, %s)",
                        seat_rows,
                    )
    except psycopg2.errors.UniqueViolation as exc:
        raise HTTPException(status_code=409, detail="Venue is already booked at that date and time") from exc

    return {"concert_id": concert_id, "showtime_id": showtime["showtime_id"], "zone_ids": created_zones}


@app.post("/api/admin/upload-poster")
def upload_poster(file: UploadFile = File(...), _: Principal = Depends(require_admin)):
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"{uuid.uuid4().hex}.{ext}"
    os.makedirs("/app/posters", exist_ok=True)
    filepath = f"/app/posters/{filename}"
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return {"poster_url": f"/posters/{filename}"}


@app.patch("/api/admin/concerts/{concert_id}")
def update_concert(concert_id: int, payload: ConcertUpdate, _: Principal = Depends(require_admin)):
    with db_session() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE concert
                SET
                    title = COALESCE(%s, title),
                    artist = COALESCE(%s, artist),
                    genre = COALESCE(%s, genre),
                    description = COALESCE(%s, description),
                    poster_url = COALESCE(%s, poster_url)
                WHERE concert_id = %s
                RETURNING concert_id
                """,
                (payload.title, payload.artist, payload.genre, payload.description, payload.poster_url, concert_id),
            )
            updated = cur.fetchone()
            if not updated:
                raise HTTPException(status_code=404, detail="Concert not found")
    return {"updated": True, "concert_id": concert_id}


@app.delete("/api/admin/concerts/{concert_id}")
def delete_concert(concert_id: int, _: Principal = Depends(require_admin)):
    with db_session() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM concert WHERE concert_id = %s RETURNING concert_id", (concert_id,))
            deleted = cur.fetchone()
            if not deleted:
                raise HTTPException(status_code=404, detail="Concert not found")
    return {"deleted": True, "concert_id": concert_id}


@app.get("/api/admin/revenue")
def revenue_report(
    month: int | None = Query(default=None, ge=1, le=12),
    year: int | None = Query(default=None, ge=2000, le=2100),
    _: Principal = Depends(require_admin),
):
    filters = ["p.payment_status = 'completed'"]
    params: list[int] = []
    if month is not None:
        filters.append("EXTRACT(MONTH FROM p.paid_at) = %s")
        params.append(month)
    if year is not None:
        filters.append("EXTRACT(YEAR FROM p.paid_at) = %s")
        params.append(year)

    where_clause = " AND ".join(filters)
    with db_session() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                WITH paid_bookings AS (
                    SELECT b.booking_id, b.showtime_id, b.booking_amount, p.amount, p.paid_at
                    FROM payment p
                    JOIN booking b ON b.booking_id = p.booking_id
                    WHERE {where_clause}
                ),
                ticket_counts AS (
                    SELECT booking_id, COUNT(*) AS sold_tickets
                    FROM ticket
                    WHERE ticket_status = 'sold'
                    GROUP BY booking_id
                )
                SELECT
                    c.concert_id,
                    COALESCE(c.title, 'Deleted concert') AS title,
                    COALESCE(c.artist, 'Unknown artist') AS artist,
                    COUNT(pb.booking_id) AS paid_bookings,
                    COALESCE(SUM(tc.sold_tickets), 0) AS tickets_sold,
                    COALESCE(SUM(pb.amount), 0) AS revenue
                FROM paid_bookings pb
                LEFT JOIN ticket_counts tc ON tc.booking_id = pb.booking_id
                LEFT JOIN showtime s ON s.showtime_id = pb.showtime_id
                LEFT JOIN concert c ON c.concert_id = s.concert_id
                GROUP BY c.concert_id, c.title, c.artist
                ORDER BY revenue DESC
                """,
                params,
            )
            rows = cur.fetchall()

    total_revenue = sum((row["revenue"] for row in rows), Decimal("0"))
    total_tickets = sum(row["tickets_sold"] for row in rows)
    for row in rows:
        row["revenue"] = _decimal_to_float(row["revenue"])
    return {
        "filters": {"month": month, "year": year},
        "total_revenue": _decimal_to_float(total_revenue),
        "total_tickets": total_tickets,
        "rows": rows,
    }


@app.get("/api/admin/analytics")
def analytics_reports(_: Principal = Depends(require_admin)):
    release_expired_locks()
    reports: dict[str, object] = {}
    with db_session() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    c.title AS concert,
                    EXTRACT(YEAR FROM p.paid_at)::INT AS year,
                    EXTRACT(MONTH FROM p.paid_at)::INT AS month,
                    TO_CHAR(p.paid_at, 'Mon YYYY') AS period,
                    COALESCE(SUM(p.amount), 0) AS total_revenue,
                    COUNT(DISTINCT b.booking_id) AS paid_bookings,
                    COUNT(t.ticket_id) AS tickets_sold
                FROM payment p
                JOIN booking b ON b.booking_id = p.booking_id
                JOIN showtime s ON s.showtime_id = b.showtime_id
                JOIN concert c ON c.concert_id = s.concert_id
                LEFT JOIN ticket t ON t.booking_id = b.booking_id
                WHERE p.payment_status = 'completed'
                GROUP BY c.title, year, month, period
                ORDER BY year DESC, month DESC, total_revenue DESC
                """
            )
            reports["monthly_revenue_per_concert"] = _json_safe_rows(cur.fetchall())

            cur.execute(
                """
                SELECT
                    COALESCE(v.venue_name, '-') AS venue,
                    s.show_date,
                    z.zone_name,
                    z.price,
                    z.total_seat,
                    COUNT(st.seat_id) FILTER (WHERE st.seat_status IN ('sold', 'pending')) AS seats_reserved,
                    ROUND(
                        COUNT(st.seat_id) FILTER (WHERE st.seat_status IN ('sold', 'pending')) * 100.0
                        / NULLIF(COUNT(st.seat_id), 0),
                        2
                    ) AS occupancy_rate
                FROM zone z
                JOIN showtime s ON s.showtime_id = z.showtime_id
                LEFT JOIN venue v ON v.venue_id = s.venue_id
                LEFT JOIN seat st ON st.zone_id = z.zone_id
                GROUP BY v.venue_name, s.show_date, z.zone_id
                ORDER BY s.show_date ASC, occupancy_rate DESC NULLS LAST
                """
            )
            reports["seat_occupancy_by_zone"] = _json_safe_rows(cur.fetchall())

            cur.execute(
                """
                SELECT
                    COALESCE(c.genre, 'Uncategorized') AS genre,
                    EXTRACT(YEAR FROM COALESCE(p.paid_at, b.created_at))::INT AS year,
                    EXTRACT(QUARTER FROM COALESCE(p.paid_at, b.created_at))::INT AS quarter,
                    ROUND(AVG(t.price_paid), 2) AS avg_ticket_price,
                    COUNT(t.ticket_id) AS ticket_count
                FROM ticket t
                JOIN booking b ON b.booking_id = t.booking_id
                LEFT JOIN payment p ON p.booking_id = b.booking_id AND p.payment_status = 'completed'
                JOIN showtime s ON s.showtime_id = t.showtime_id
                JOIN concert c ON c.concert_id = s.concert_id
                WHERE t.ticket_status = 'sold'
                GROUP BY genre, year, quarter
                ORDER BY year DESC, quarter ASC, avg_ticket_price DESC
                """
            )
            reports["avg_ticket_price_by_genre_quarter"] = _json_safe_rows(cur.fetchall())

            cur.execute(
                """
                SELECT
                    c.concert_id,
                    c.title AS concert,
                    COUNT(t.ticket_id) FILTER (WHERE t.ticket_status = 'sold') AS tickets_sold,
                    COUNT(st.seat_id) AS total_seats,
                    ROUND(
                        COUNT(t.ticket_id) FILTER (WHERE t.ticket_status = 'sold') * 100.0
                        / NULLIF(COUNT(st.seat_id), 0),
                        2
                    ) AS booking_rate
                FROM concert c
                JOIN showtime s ON s.concert_id = c.concert_id
                JOIN zone z ON z.showtime_id = s.showtime_id
                JOIN seat st ON st.zone_id = z.zone_id
                LEFT JOIN ticket t ON t.seat_id = st.seat_id AND t.ticket_status = 'sold'
                GROUP BY c.concert_id
                ORDER BY booking_rate DESC NULLS LAST, tickets_sold DESC
                LIMIT 5
                """
            )
            reports["top_concerts_by_booking_rate"] = _json_safe_rows(cur.fetchall())

            cur.execute(
                """
                SELECT
                    booking_status,
                    COUNT(*) AS total_bookings,
                    ROUND(COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM booking), 0), 2) AS percentage
                FROM booking
                GROUP BY booking_status
                ORDER BY total_bookings DESC
                """
            )
            reports["booking_status_summary"] = _json_safe_rows(cur.fetchall())

            cur.execute(
                """
                SELECT
                    payment_method,
                    COUNT(*) AS usage_count,
                    COALESCE(SUM(amount), 0) AS total_amount
                FROM payment
                GROUP BY payment_method
                ORDER BY usage_count DESC, total_amount DESC
                """
            )
            reports["popular_payment_methods"] = _json_safe_rows(cur.fetchall())

            cur.execute(
                """
                SELECT
                    EXTRACT(YEAR FROM created_at)::INT AS year,
                    EXTRACT(MONTH FROM created_at)::INT AS month,
                    TO_CHAR(created_at, 'Mon YYYY') AS period,
                    COUNT(user_id) AS new_users
                FROM users
                GROUP BY year, month, period
                ORDER BY year DESC, month DESC
                """
            )
            reports["monthly_new_users"] = _json_safe_rows(cur.fetchall())

            cur.execute(
                """
                SELECT
                    u.user_id,
                    u.full_name AS customer,
                    COUNT(DISTINCT b.booking_id) FILTER (WHERE b.booking_status = 'paid') AS paid_bookings,
                    COUNT(t.ticket_id) FILTER (WHERE t.ticket_status = 'sold') AS tickets_purchased,
                    COALESCE(SUM(p.amount) FILTER (WHERE p.payment_status = 'completed'), 0) AS total_spending
                FROM users u
                LEFT JOIN booking b ON b.user_id = u.user_id
                LEFT JOIN ticket t ON t.booking_id = b.booking_id
                LEFT JOIN payment p ON p.booking_id = b.booking_id
                GROUP BY u.user_id
                ORDER BY total_spending DESC, tickets_purchased DESC
                LIMIT 10
                """
            )
            reports["top_customers_by_spending"] = _json_safe_rows(cur.fetchall())

            cur.execute(
                """
                SELECT
                    s.showtime_id,
                    c.title AS concert,
                    COALESCE(v.venue_name, '-') AS venue,
                    s.show_date,
                    s.show_time,
                    COUNT(st.seat_id) FILTER (WHERE st.seat_status = 'available') AS available_seats,
                    COUNT(st.seat_id) AS total_seats,
                    ROUND(
                        COUNT(st.seat_id) FILTER (WHERE st.seat_status = 'available') * 100.0
                        / NULLIF(COUNT(st.seat_id), 0),
                        2
                    ) AS available_rate
                FROM showtime s
                JOIN concert c ON c.concert_id = s.concert_id
                LEFT JOIN venue v ON v.venue_id = s.venue_id
                LEFT JOIN zone z ON z.showtime_id = s.showtime_id
                LEFT JOIN seat st ON st.zone_id = z.zone_id
                GROUP BY s.showtime_id, c.title, v.venue_name
                ORDER BY s.show_date ASC, s.show_time ASC
                """
            )
            reports["available_seats_by_showtime"] = _json_safe_rows(cur.fetchall())

            cur.execute(
                """
                SELECT
                    EXTRACT(YEAR FROM b.created_at)::INT AS year,
                    EXTRACT(QUARTER FROM b.created_at)::INT AS quarter,
                    COUNT(*) AS cancelled_bookings,
                    COALESCE(SUM(b.total_amount), 0) AS estimated_refund_amount
                FROM booking b
                WHERE b.booking_status IN ('cancelled', 'expired')
                GROUP BY year, quarter
                ORDER BY year DESC, quarter ASC
                """
            )
            reports["refund_amount_by_quarter"] = _json_safe_rows(cur.fetchall())

            cur.execute(
                """
                SELECT
                    EXTRACT(HOUR FROM created_at)::INT AS hour_of_day,
                    COUNT(*) AS transaction_count
                FROM booking
                GROUP BY hour_of_day
                ORDER BY hour_of_day ASC
                """
            )
            reports["busiest_booking_hours"] = _json_safe_rows(cur.fetchall())

            cur.execute(
                """
                SELECT
                    c.concert_id,
                    c.title AS concert,
                    COALESCE(a.display_name, 'Unassigned') AS admin_name,
                    COALESCE(a.email, '-') AS admin_email
                FROM concert c
                LEFT JOIN admin_concert ac ON ac.concert_id = c.concert_id
                LEFT JOIN admin a ON a.admin_id = ac.admin_id
                ORDER BY c.title, admin_name
                """
            )
            by_concert = _json_safe_rows(cur.fetchall())
            cur.execute(
                """
                SELECT
                    a.admin_id,
                    a.display_name AS admin_name,
                    COUNT(ac.concert_id) AS concerts_managed
                FROM admin a
                LEFT JOIN admin_concert ac ON ac.admin_id = a.admin_id
                GROUP BY a.admin_id
                ORDER BY concerts_managed DESC, a.display_name
                """
            )
            reports["admin_concert_assignments"] = {
                "by_concert": by_concert,
                "workload": _json_safe_rows(cur.fetchall()),
            }

            cur.execute(
                """
                SELECT
                    COALESCE(v.venue_name, '-') AS venue,
                    MIN(z.price) AS min_price,
                    MAX(z.price) AS max_price,
                    ROUND(AVG(z.price), 2) AS avg_price,
                    MAX(z.price) - MIN(z.price) AS price_range
                FROM venue v
                JOIN showtime s ON s.venue_id = v.venue_id
                JOIN zone z ON z.showtime_id = s.showtime_id
                GROUP BY v.venue_id
                ORDER BY price_range DESC, avg_price DESC
                """
            )
            reports["venue_ticket_price_range"] = _json_safe_rows(cur.fetchall())

            cur.execute(
                """
                WITH ticket_counts AS (
                    SELECT b.booking_id, COUNT(t.ticket_id) AS ticket_count
                    FROM booking b
                    LEFT JOIN ticket t ON t.booking_id = b.booking_id
                    GROUP BY b.booking_id
                )
                SELECT
                    ROUND(AVG(ticket_count), 2) AS overall_avg_tickets_per_booking,
                    MIN(ticket_count) AS min_tickets,
                    MAX(ticket_count) AS max_tickets,
                    COUNT(*) AS booking_count
                FROM ticket_counts
                """
            )
            summary = cur.fetchone()
            cur.execute(
                """
                SELECT
                    ticket_count,
                    COUNT(*) AS booking_count
                FROM (
                    SELECT b.booking_id, COUNT(t.ticket_id) AS ticket_count
                    FROM booking b
                    LEFT JOIN ticket t ON t.booking_id = b.booking_id
                    GROUP BY b.booking_id
                ) counts
                GROUP BY ticket_count
                ORDER BY ticket_count
                """
            )
            reports["avg_tickets_per_booking"] = {
                "summary": {key: _decimal_to_float(value) for key, value in summary.items()},
                "distribution": _json_safe_rows(cur.fetchall()),
            }

    return reports
