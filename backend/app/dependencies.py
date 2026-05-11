from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from .security import decode_access_token


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


@dataclass(frozen=True)
class Principal:
    id: int
    role: str
    name: str
    admin_role: str | None = None


def get_current_principal(token: str = Depends(oauth2_scheme)) -> Principal:
    try:
        payload = decode_access_token(token)
        role = payload.get("role")
        if role not in {"customer", "admin"}:
            raise ValueError("Invalid role")
        return Principal(
            id=int(payload["sub"]),
            role=role,
            name=payload.get("name", ""),
            admin_role=payload.get("admin_role") if role == "admin" else None,
        )
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def require_admin(principal: Principal = Depends(get_current_principal)) -> Principal:
    if principal.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return principal


def require_admin_write(principal: Principal = Depends(require_admin)) -> Principal:
    if principal.admin_role not in {None, "write", "admin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin write access required")
    return principal


def require_customer(principal: Principal = Depends(get_current_principal)) -> Principal:
    if principal.role != "customer":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Customer access required")
    return principal
