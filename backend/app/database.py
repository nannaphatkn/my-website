from __future__ import annotations

import os
import time
from contextlib import contextmanager

import psycopg2
from psycopg2.extras import RealDictCursor


def _database_config() -> dict[str, str | int]:
    return {
        "host": os.getenv("DB_HOST", "db"),
        "port": int(os.getenv("DB_PORT", "5432")),
        "dbname": os.getenv("DB_NAME", "ticketing"),
        "user": os.getenv("DB_USER", "ticket_user"),
        "password": os.getenv("DB_PASSWORD", "ticket_password"),
    }


def get_connection():
    return psycopg2.connect(**_database_config(), cursor_factory=RealDictCursor)


@contextmanager
def db_session():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def wait_for_db(max_attempts: int = 30, delay_seconds: float = 1.5) -> None:
    last_error: Exception | None = None
    for _ in range(max_attempts):
        try:
            conn = get_connection()
            conn.close()
            return
        except Exception as exc:
            last_error = exc
            time.sleep(delay_seconds)
    raise RuntimeError("Database did not become ready in time") from last_error
