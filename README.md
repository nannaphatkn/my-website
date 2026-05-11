# Concert Ticket Booking System

Full-stack concert booking app with PostgreSQL, FastAPI, React, JWT auth, RBAC, seat holds, auto-release, and admin revenue reporting.

## Run with Docker

```bash
cp .env.example .env
docker compose up --build
```

Frontend: http://localhost:3000  
Backend API: http://localhost:8000  
API docs: http://localhost:8000/docs
PostgreSQL host port: `5433` by default, mapped to container port `5432`
Adminer : http://localhost:8081

Seed logins:

- Customer: `customer@example.com` / `customer123`
- Admin: `admin@example.com` or `admin` / `admin123`
//////
- System: 'PostgreSQL'
- Server: db
- Username: ticket_user
- Password: ticket_password
- Database: ticketing

## Project Layout

- `database/init.sql`: PostgreSQL DDL, constraints, indexes, and seed data.
- `backend/app`: FastAPI service with auth, booking, payment, admin, and report endpoints.
- `frontend/src`: React app with role-based routing, customer booking, and admin dashboard.
- `docker-compose.yml`: `db`, `backend`, and `frontend` services with persistent database volume.
