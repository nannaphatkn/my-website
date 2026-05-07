import base64
import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from jwt import InvalidTokenError


HASH_ALGORITHM = "pbkdf2_sha256"
HASH_ITERATIONS = 260_000
JWT_ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    salt = secrets.token_urlsafe(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), HASH_ITERATIONS)
    return f"{HASH_ALGORITHM}${HASH_ITERATIONS}${salt}${base64.b64encode(digest).decode()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, iterations_text, salt, expected_digest = stored_hash.split("$", 3)
        if algorithm != HASH_ALGORITHM:
            return False
        digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), int(iterations_text))
        return hmac.compare_digest(base64.b64encode(digest).decode(), expected_digest)
    except (ValueError, TypeError):
        return False


def create_access_token(subject: int, role: str, profile_name: str) -> str:
    expires_in = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "120"))
    payload: dict[str, Any] = {
        "sub": str(subject),
        "role": role,
        "name": profile_name,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=expires_in),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, os.getenv("JWT_SECRET", "dev-only-change-me"), algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, os.getenv("JWT_SECRET", "dev-only-change-me"), algorithms=[JWT_ALGORITHM])
    except InvalidTokenError as exc:
        raise ValueError("Invalid or expired token") from exc
