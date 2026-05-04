"""Timezone helpers - IST is the canonical app timezone.

The Postgres server is configured with `timezone = 'Asia/Kolkata'`, so all
timestamps written to the DB or rendered to users should be IST.

Usage:
    from shared.time_utils import now_ist, to_ist, IST

    user.created_at = now_ist()
    expires_at = now_ist() + timedelta(minutes=10)
"""
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")


def now_ist() -> datetime:
    """Return current time as a timezone-aware datetime in IST."""
    return datetime.now(IST)


def to_ist(dt: datetime) -> datetime:
    """Convert any datetime (naive or aware) to IST.

    Naive datetimes are assumed to already be IST (Postgres returns naive
    timestamps and the server runs in IST).
    """
    if dt.tzinfo is None:
        return dt.replace(tzinfo=IST)
    return dt.astimezone(IST)


def ist_naive() -> datetime:
    """Return current IST time as a naive datetime (for DB columns without tz).

    CRITICAL: The DB timezone is UTC (show timezone = 'Etc/UTC').
    Naive datetimes written to the DB are interpreted as UTC.
    So we must return a naive datetime that represents the CORRECT UTC time
    (i.e., IST - 5:30), not the IST wall clock time.

    Example:
        IST wall clock = 11:53
        UTC = 06:23
        We must write 06:23 (naive) to the DB, not 11:53.
    """
    # Get current time in IST, convert to UTC, strip timezone
    ist_now = datetime.now(IST)
    utc_now = ist_now.astimezone(timezone.utc)
    return utc_now.replace(tzinfo=None)


def utc_now() -> datetime:
    """Escape hatch for code that genuinely needs UTC (rare - JWT exp, webhooks).

    Prefer `now_ist()` everywhere else.
    """
    return datetime.now(timezone.utc)


__all__ = ["IST", "now_ist", "to_ist", "ist_naive", "utc_now", "timedelta"]
