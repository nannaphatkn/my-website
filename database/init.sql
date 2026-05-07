-- Concert Ticket Booking System
-- PostgreSQL initialization script.
--
-- Password columns intentionally store salted PBKDF2 hashes, never plaintext.
-- Seed credentials for local development:
--   admin@example.com / admin123
--   customer@example.com / customer123

CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(30),
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin (
    admin_id SERIAL PRIMARY KEY,
    display_name VARCHAR(120) NOT NULL,
    username VARCHAR(80) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS venue (
    venue_id SERIAL PRIMARY KEY,
    venue_name VARCHAR(160) NOT NULL,
    address TEXT,
    city VARCHAR(120) NOT NULL,
    capacity INTEGER CHECK (capacity IS NULL OR capacity > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (venue_name, city)
);

CREATE TABLE IF NOT EXISTS concert (
    concert_id SERIAL PRIMARY KEY,
    title VARCHAR(180) NOT NULL,
    artist VARCHAR(160) NOT NULL,
    genre VARCHAR(80),
    description TEXT,
    poster_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Many-to-many relationship: multiple admins can manage multiple concerts.
CREATE TABLE IF NOT EXISTS admin_concert (
    admin_id INTEGER NOT NULL REFERENCES admin(admin_id) ON DELETE CASCADE,
    concert_id INTEGER NOT NULL REFERENCES concert(concert_id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (admin_id, concert_id)
);

CREATE TABLE IF NOT EXISTS showtime (
    showtime_id SERIAL PRIMARY KEY,
    concert_id INTEGER NOT NULL REFERENCES concert(concert_id) ON DELETE CASCADE,
    venue_id INTEGER REFERENCES venue(venue_id) ON DELETE SET NULL,
    show_date DATE NOT NULL,
    show_time TIME NOT NULL,
    sales_start TIMESTAMPTZ,
    sales_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (venue_id, show_date, show_time)
);

CREATE TABLE IF NOT EXISTS zone (
    zone_id SERIAL PRIMARY KEY,
    showtime_id INTEGER NOT NULL REFERENCES showtime(showtime_id) ON DELETE CASCADE,
    zone_name VARCHAR(80) NOT NULL,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    total_seat INTEGER NOT NULL CHECK (total_seat > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (showtime_id, zone_name)
);

CREATE TABLE IF NOT EXISTS seat (
    seat_id SERIAL PRIMARY KEY,
    zone_id INTEGER NOT NULL REFERENCES zone(zone_id) ON DELETE CASCADE,
    seat_no VARCHAR(20) NOT NULL,
    seat_status VARCHAR(20) NOT NULL DEFAULT 'available'
        CHECK (seat_status IN ('available', 'pending', 'sold', 'blocked')),
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (zone_id, seat_no)
);

CREATE TABLE IF NOT EXISTS booking (
    booking_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    showtime_id INTEGER REFERENCES showtime(showtime_id) ON DELETE SET NULL,
    booking_amount INTEGER NOT NULL CHECK (booking_amount > 0),
    total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
    booking_status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (booking_status IN ('pending', 'paid', 'expired', 'cancelled')),
    hold_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ticket (
    ticket_id SERIAL PRIMARY KEY,
    booking_id INTEGER REFERENCES booking(booking_id) ON DELETE CASCADE,
    showtime_id INTEGER REFERENCES showtime(showtime_id) ON DELETE SET NULL,
    seat_id INTEGER REFERENCES seat(seat_id) ON DELETE SET NULL,
    price_paid NUMERIC(10, 2) NOT NULL CHECK (price_paid >= 0),
    ticket_status VARCHAR(20) NOT NULL DEFAULT 'held'
        CHECK (ticket_status IN ('held', 'sold', 'cancelled', 'refunded')),
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment (
    payment_id SERIAL PRIMARY KEY,
    booking_id INTEGER REFERENCES booking(booking_id) ON DELETE SET NULL,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
    payment_method VARCHAR(50) NOT NULL,
    payment_status VARCHAR(20) NOT NULL DEFAULT 'completed'
        CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
    transaction_ref VARCHAR(120) UNIQUE,
    paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seat_zone_status ON seat(zone_id, seat_status);
CREATE INDEX IF NOT EXISTS idx_booking_status_expiry ON booking(booking_status, hold_expires_at);
CREATE INDEX IF NOT EXISTS idx_payment_paid_at ON payment(paid_at);
CREATE INDEX IF NOT EXISTS idx_ticket_showtime ON ticket(showtime_id);

INSERT INTO users (full_name, email, phone, password_hash)
VALUES
    (
        'Demo Customer',
        'customer@example.com',
        '+66000000000',
        'pbkdf2_sha256$260000$customer_salt_v1$7+OZ51TevdKsixREzKBCRS2epZ9pWyxdRR4/A41JIE4='
    )
ON CONFLICT (email) DO NOTHING;

INSERT INTO admin (display_name, username, email, password_hash)
VALUES
    (
        'Backstage Admin',
        'admin',
        'admin@example.com',
        'pbkdf2_sha256$260000$admin_salt_v1$2sbJd7jmWHCe2fupmlyXLA2D0sa1OorVb4W9tTpakEw='
    )
ON CONFLICT (email) DO NOTHING;

INSERT INTO venue (venue_name, address, city, capacity)
VALUES
    ('Moonlit Hall', '12 Analog Lane', 'Bangkok', 260),
    ('Velvet Factory', '88 Cassette Road', 'Chiang Mai', 420)
ON CONFLICT (venue_name, city) DO NOTHING;

INSERT INTO concert (title, artist, genre, description, poster_url)
VALUES
    (
        'Summer Nostalgia Night',
        'The Apricot Tapes',
        'Indie Rock',
        'Warm guitars, brass-lit choruses, and bittersweet singalongs.',
        'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=900&q=80'
    ),
    (
        'Velvet Echoes',
        'Cassette Garden',
        'Retro Pop',
        'A late-night set of jangly melodies and analog synth color.',
        'https://images.unsplash.com/photo-1499364615650-ec38552f4f34?auto=format&fit=crop&w=900&q=80'
    )
ON CONFLICT DO NOTHING;

INSERT INTO admin_concert (admin_id, concert_id)
SELECT a.admin_id, c.concert_id
FROM admin a
CROSS JOIN concert c
WHERE a.email = 'admin@example.com'
ON CONFLICT DO NOTHING;

INSERT INTO showtime (concert_id, venue_id, show_date, show_time, sales_start, sales_end)
SELECT c.concert_id, v.venue_id, DATE '2026-07-18', TIME '19:30', NOW() - INTERVAL '1 day', TIMESTAMPTZ '2026-07-18 18:30:00+07'
FROM concert c
JOIN venue v ON v.venue_name = 'Moonlit Hall' AND v.city = 'Bangkok'
WHERE c.title = 'Summer Nostalgia Night'
ON CONFLICT (venue_id, show_date, show_time) DO NOTHING;

INSERT INTO showtime (concert_id, venue_id, show_date, show_time, sales_start, sales_end)
SELECT c.concert_id, v.venue_id, DATE '2026-08-02', TIME '20:00', NOW() - INTERVAL '1 day', TIMESTAMPTZ '2026-08-02 19:00:00+07'
FROM concert c
JOIN venue v ON v.venue_name = 'Velvet Factory' AND v.city = 'Chiang Mai'
WHERE c.title = 'Velvet Echoes'
ON CONFLICT (venue_id, show_date, show_time) DO NOTHING;

INSERT INTO zone (showtime_id, zone_name, price, total_seat)
SELECT s.showtime_id, z.zone_name, z.price, z.total_seat
FROM showtime s
JOIN concert c ON c.concert_id = s.concert_id
CROSS JOIN (
    VALUES
        ('Front Row', 2800.00, 20),
        ('Balcony', 1800.00, 30),
        ('Standing', 1200.00, 50)
) AS z(zone_name, price, total_seat)
WHERE c.title = 'Summer Nostalgia Night'
ON CONFLICT (showtime_id, zone_name) DO NOTHING;

INSERT INTO zone (showtime_id, zone_name, price, total_seat)
SELECT s.showtime_id, z.zone_name, z.price, z.total_seat
FROM showtime s
JOIN concert c ON c.concert_id = s.concert_id
CROSS JOIN (
    VALUES
        ('Golden Pit', 2400.00, 25),
        ('Main Floor', 1500.00, 45)
) AS z(zone_name, price, total_seat)
WHERE c.title = 'Velvet Echoes'
ON CONFLICT (showtime_id, zone_name) DO NOTHING;

INSERT INTO seat (zone_id, seat_no)
SELECT z.zone_id, CONCAT(UPPER(SUBSTRING(REPLACE(z.zone_name, ' ', '') FROM 1 FOR 2)), '-', LPAD(gs::TEXT, 3, '0'))
FROM zone z
CROSS JOIN LATERAL generate_series(1, z.total_seat) AS gs
ON CONFLICT (zone_id, seat_no) DO NOTHING;
