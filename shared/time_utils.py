"""Timezone helpers - IST is the canonical app timezone.

The Postgres server is configured with `timezone = 'Asia/Kolkata'`, so all
timestamps written to the DB or rendered to users should be IST.

Usage:
    from shared.time_utils import now_ist, to_ist, IST

    user.created_at = now_ist()
    expires_at = now_ist() + timedelta(minutes=10)
"""
from datetime import datetime, timezone, timedelta

import pytz

IST = pytz.timezone("Asia/Kolkata")


def now_ist() -> datetime:
    """Return current time as a timezone-aware datetime in IST."""
    return datetime.now(IST)


def to_ist(dt: datetime) -> datetime:
    """Convert any datetime (naive or aware) to IST.

    Naive datetimes are assumed to already be IST (Postgres returns naive
    timestamps and the server runs in IST).
    """
    if dt.tzinfo is None:
        return IST.localize(dt)
    return dt.astimezone(IST)


def ist_naive() -> datetime:
    """Return current IST time as a naive datetime (for DB columns without tz)."""
    return datetime.now(IST).replace(tzinfo=None)


def utc_now() -> datetime:
    """Escape hatch for code that genuinely needs UTC (rare - JWT exp, webhooks).

    Prefer `now_ist()` everywhere else.
    """
    return datetime.now(timezone.utc)


__all__ = ["IST", "now_ist", "to_ist", "ist_naive", "utc_now", "timedelta"]
