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

-- ═══ VENUES ═══
INSERT INTO venue (venue_name, address, city, capacity) VALUES
  ('Thunder Dome','Popular 3 Rd, Bangsue','Bangkok',5000),
  ('Impact Arena','99 Popular Rd, Pak Kret','Bangkok',12000),
  ('MCC Hall','The Mall Bangkapi','Bangkok',3000),
  ('Samyan Mitrtown Hall','Rama IV Rd','Bangkok',2000),
  ('Show DC','Show DC Oasis Arena','Bangkok',4000)
ON CONFLICT (venue_name, city) DO NOTHING;

-- ═══ CONCERTS ═══
INSERT INTO concert (title, artist, genre, description, poster_url) VALUES
  ('JAEHYUN FAN-CON TOUR «Mono» in BANGKOK','JAEHYUN','Entertainment','กลับมาพบกันอีกครั้ง! SM True ร่วมกับ NCT จัดคอนเสิร์ตสุดยิ่งใหญ่ ครั้งแรกในไทย กับ JAEHYUN in NCT','/posters/jaehyun.jpg'),
  ('2026 NCT JNJM FANMEETING TOUR [DUALITY] #BANGKOK','NCT','Entertainment','NCT กลับมาพร้อมแฟนมีทติ้งทัวร์ DUALITY สุดพิเศษ','/posters/nct_duality.jpg'),
  ('DUANG WITH YOU Love is all around Show & Screening','Various','Entertainment','งานแสดงและฉายภาพยนตร์สุดพิเศษ DUANG WITH YOU','/posters/duang.png'),
  ('PEPSI Presents PROXIE The 3rd Concert "PROXIMA-B"','PROXIE','Entertainment','PROXIE คอนเสิร์ตครั้งที่ 3 สุดยิ่งใหญ่','/posters/proxie.jpg'),
  ('CLUB 30 CONCERT','Various','Entertainment','คอนเสิร์ตรวมศิลปินระดับตำนาน CLUB 30','/posters/club30.jpg'),
  ('BUS because of you i shine LIGHT AS ONE CONCERT','BUS','Entertainment','BUS because of you i shine คอนเสิร์ตสุดพิเศษ LIGHT AS ONE','/posters/bus.jpg'),
  ('NANGFANG 6 MUSIC CAMP FESTIVAL 2026','Various','Entertainment','เทศกาลดนตรี NANGFANG ครั้งที่ 6','/posters/nangfang_real.png'),
  ('OCEAN NIGHT BY HEYHA MUSIC FESTIVAL','Various','Lifestyle','เทศกาลดนตรีริมทะเล OCEAN NIGHT สุดมันส์','/posters/ocean.jpg'),
  ('Daniel Caesar - Son of Spergy Tour in Bangkok','Daniel Caesar','Entertainment','Daniel Caesar กลับมาพร้อม Son of Spergy Tour','/posters/daniel_real.png'),
  ('มาม่า Presents GDH โตมาตั้วยกัน ออร์เคสตรูบูฟรีคอนเสิร์ต','GDH','Lifestyle','คอนเสิร์ตออร์เคสตร้าสุดพิเศษจาก GDH','/posters/gdh_real.png')
ON CONFLICT DO NOTHING;

INSERT INTO admin_concert (admin_id, concert_id)
SELECT a.admin_id, c.concert_id FROM admin a CROSS JOIN concert c WHERE a.email='admin@example.com' ON CONFLICT DO NOTHING;

-- ═══ SHOWTIMES ═══
-- JAEHYUN (2 shows)
INSERT INTO showtime (concert_id,venue_id,show_date,show_time,sales_start,sales_end)
SELECT c.concert_id,v.venue_id,d::date,t::time,NOW()-INTERVAL '7 days',(d||' '||t)::timestamptz - INTERVAL '1 hour'
FROM concert c JOIN venue v ON v.venue_name='Thunder Dome' CROSS JOIN (VALUES('2026-06-27','18:00'),('2026-06-28','16:00')) AS dt(d,t)
WHERE c.title='JAEHYUN FAN-CON TOUR «Mono» in BANGKOK' ON CONFLICT (venue_id,show_date,show_time) DO NOTHING;
-- NCT DUALITY
INSERT INTO showtime (concert_id,venue_id,show_date,show_time,sales_start,sales_end)
SELECT c.concert_id,v.venue_id,DATE '2026-08-08',TIME '18:00',NOW()-INTERVAL '7 days',TIMESTAMPTZ '2026-08-08 17:00+07'
FROM concert c JOIN venue v ON v.venue_name='Impact Arena' WHERE c.title LIKE '%DUALITY%' ON CONFLICT (venue_id,show_date,show_time) DO NOTHING;
-- DUANG WITH YOU
INSERT INTO showtime (concert_id,venue_id,show_date,show_time,sales_start,sales_end)
SELECT c.concert_id,v.venue_id,DATE '2026-04-18',TIME '19:00',NOW()-INTERVAL '30 days',TIMESTAMPTZ '2026-04-18 18:00+07'
FROM concert c JOIN venue v ON v.venue_name='Samyan Mitrtown Hall' WHERE c.title LIKE '%DUANG%' ON CONFLICT (venue_id,show_date,show_time) DO NOTHING;
-- PROXIE
INSERT INTO showtime (concert_id,venue_id,show_date,show_time,sales_start,sales_end)
SELECT c.concert_id,v.venue_id,DATE '2026-01-24',TIME '18:30',NOW()-INTERVAL '60 days',TIMESTAMPTZ '2026-01-24 17:30+07'
FROM concert c JOIN venue v ON v.venue_name='MCC Hall' WHERE c.title LIKE '%PROXIE%' ON CONFLICT (venue_id,show_date,show_time) DO NOTHING;
-- CLUB 30
INSERT INTO showtime (concert_id,venue_id,show_date,show_time,sales_start,sales_end)
SELECT c.concert_id,v.venue_id,d::date,TIME '19:00',NOW()-INTERVAL '7 days',(d||' 18:00')::timestamptz
FROM concert c JOIN venue v ON v.venue_name='Thunder Dome' CROSS JOIN (VALUES('2026-06-27'),('2026-06-28')) AS dt(d)
WHERE c.title='CLUB 30 CONCERT' ON CONFLICT (venue_id,show_date,show_time) DO NOTHING;
-- BUS LIGHT AS ONE
INSERT INTO showtime (concert_id,venue_id,show_date,show_time,sales_start,sales_end)
SELECT c.concert_id,v.venue_id,d::date,TIME '18:00',NOW()-INTERVAL '7 days',(d||' 17:00')::timestamptz
FROM concert c JOIN venue v ON v.venue_name='Impact Arena' CROSS JOIN (VALUES('2026-07-24'),('2026-07-25'),('2026-07-26')) AS dt(d)
WHERE c.title LIKE '%BUS%LIGHT%' ON CONFLICT (venue_id,show_date,show_time) DO NOTHING;
-- NANGFANG
INSERT INTO showtime (concert_id,venue_id,show_date,show_time,sales_start,sales_end)
SELECT c.concert_id,v.venue_id,DATE '2026-06-06',TIME '16:00',NOW()-INTERVAL '7 days',TIMESTAMPTZ '2026-06-06 15:00+07'
FROM concert c JOIN venue v ON v.venue_name='Show DC' WHERE c.title LIKE '%NANGFANG%' ON CONFLICT (venue_id,show_date,show_time) DO NOTHING;
-- OCEAN NIGHT
INSERT INTO showtime (concert_id,venue_id,show_date,show_time,sales_start,sales_end)
SELECT c.concert_id,v.venue_id,DATE '2026-06-20',TIME '17:00',NOW()-INTERVAL '7 days',TIMESTAMPTZ '2026-06-20 16:00+07'
FROM concert c JOIN venue v ON v.venue_name='Show DC' WHERE c.title LIKE '%OCEAN%' ON CONFLICT (venue_id,show_date,show_time) DO NOTHING;
-- Daniel Caesar
INSERT INTO showtime (concert_id,venue_id,show_date,show_time,sales_start,sales_end)
SELECT c.concert_id,v.venue_id,DATE '2026-06-08',TIME '19:00',NOW()-INTERVAL '7 days',TIMESTAMPTZ '2026-06-08 18:00+07'
FROM concert c JOIN venue v ON v.venue_name='Impact Arena' WHERE c.title LIKE '%Daniel Caesar%' ON CONFLICT (venue_id,show_date,show_time) DO NOTHING;
-- GDH
INSERT INTO showtime (concert_id,venue_id,show_date,show_time,sales_start,sales_end)
SELECT c.concert_id,v.venue_id,DATE '2026-06-14',TIME '18:00',NOW()-INTERVAL '7 days',TIMESTAMPTZ '2026-06-14 17:00+07'
FROM concert c JOIN venue v ON v.venue_name='MCC Hall' WHERE c.title LIKE '%GDH%' ON CONFLICT (venue_id,show_date,show_time) DO NOTHING;

-- ═══ ZONES (for all showtimes) ═══
-- JAEHYUN zones
INSERT INTO zone (showtime_id, zone_name, price, total_seat)
SELECT s.showtime_id, z.zone_name, z.price, z.total_seat FROM showtime s JOIN concert c ON c.concert_id=s.concert_id
CROSS JOIN (VALUES('VIP PACKAGE',6600.00,30),('STANDING',5600.00,50),('ZONE A',4700.00,40),('ZONE B',3700.00,60),('ZONE C',2700.00,80)) AS z(zone_name,price,total_seat)
WHERE c.title='JAEHYUN FAN-CON TOUR «Mono» in BANGKOK' ON CONFLICT (showtime_id,zone_name) DO NOTHING;
-- Other concerts: standard 3-zone layout
INSERT INTO zone (showtime_id, zone_name, price, total_seat)
SELECT s.showtime_id, z.zone_name, z.price, z.total_seat FROM showtime s JOIN concert c ON c.concert_id=s.concert_id
CROSS JOIN (VALUES('VIP',4500.00,30),('Standard',2500.00,60),('Economy',1500.00,100)) AS z(zone_name,price,total_seat)
WHERE c.title NOT LIKE '%JAEHYUN%' ON CONFLICT (showtime_id,zone_name) DO NOTHING;

-- ═══ SEATS ═══
INSERT INTO seat (zone_id, seat_no)
SELECT z.zone_id, CONCAT(UPPER(SUBSTRING(REPLACE(z.zone_name,' ','') FROM 1 FOR 2)),'-',LPAD(gs::TEXT,3,'0'))
FROM zone z CROSS JOIN LATERAL generate_series(1, z.total_seat) AS gs
ON CONFLICT (zone_id, seat_no) DO NOTHING;
