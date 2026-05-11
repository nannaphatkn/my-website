from datetime import date, datetime, time
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    identifier: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


class RegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=120)
    email: EmailStr
    phone: Optional[str] = None
    password: str = Field(..., min_length=8)


class ZoneCreate(BaseModel):
    zone_name: str = Field(..., min_length=1, max_length=80)
    price: Decimal = Field(..., ge=0)
    total_seat: int = Field(..., gt=0, le=1000)


class ConcertCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=180)
    artist: str = Field(..., min_length=1, max_length=160)
    genre: Optional[str] = None
    description: Optional[str] = None
    poster_url: Optional[str] = None
    venue_name: str = Field(..., min_length=1, max_length=160)
    venue_city: str = Field(..., min_length=1, max_length=120)
    venue_address: Optional[str] = None
    venue_capacity: Optional[int] = Field(default=None, gt=0)
    show_date: date
    show_time: time
    sales_start: Optional[datetime] = None
    sales_end: Optional[datetime] = None
    zones: list[ZoneCreate] = Field(..., min_length=1)


class ConcertUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=180)
    artist: Optional[str] = Field(default=None, min_length=1, max_length=160)
    genre: Optional[str] = None
    description: Optional[str] = None
    poster_url: Optional[str] = None


class SeatHoldRequest(BaseModel):
    showtime_id: int = Field(..., gt=0)
    seat_ids: list[int] = Field(..., min_length=1)


class SeatSelectRequest(BaseModel):
    showtime_id: int = Field(..., gt=0)
    seat_id: int = Field(..., gt=0)
    booking_id: Optional[int] = Field(default=None, gt=0)


class SeatReleaseRequest(BaseModel):
    booking_id: int = Field(..., gt=0)
    seat_id: int = Field(..., gt=0)


class PaymentConfirmRequest(BaseModel):
    booking_id: int = Field(..., gt=0)
    payment_method: str = Field(default="card", min_length=1, max_length=50)


class ZoneUpdate(BaseModel):
    price: Optional[Decimal] = Field(default=None, ge=0)
    total_seat: Optional[int] = Field(default=None, gt=0, le=1000)
