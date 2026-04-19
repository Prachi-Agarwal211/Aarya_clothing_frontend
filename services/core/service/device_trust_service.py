"""
Device-trust helpers.

The login flow keeps a per-user list of fingerprints the user has
verified. When a fingerprint matches a row in `trusted_devices` we treat
the device as known and may skip the second-factor OTP challenge.

Phase 1 scope:
 * Lookup whether `(user_id, fingerprint)` is trusted.
 * Register a new fingerprint after a verified login (OTP success or
   admin opt-in) and refresh `last_seen_at` on subsequent matches.

This module deliberately avoids any Redis state — the source of truth is
Postgres so that revocation is durable and visible across services.
"""

from __future__ import annotations

import hashlib
import logging
from typing import Optional

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from models import TrustedDevice
from shared.time_utils import ist_naive

logger = logging.getLogger(__name__)

MAX_FINGERPRINT_LEN = 128
MAX_DEVICE_NAME_LEN = 120


def _normalize_fingerprint(fingerprint: Optional[str]) -> Optional[str]:
    """
    Defensively hash any client-supplied fingerprint so we never store the
    raw browser data, and so the column width is predictable.

    Already-hashed 64-char hex strings pass through unchanged; anything
    else is sha256-hashed.
    """
    if not fingerprint:
        return None
    fp = fingerprint.strip()
    if not fp:
        return None
    if len(fp) == 64 and all(c in "0123456789abcdefABCDEF" for c in fp):
        return fp.lower()
    if len(fp) > MAX_FINGERPRINT_LEN:
        fp = fp[:MAX_FINGERPRINT_LEN]
    return hashlib.sha256(fp.encode("utf-8")).hexdigest()


def is_device_trusted(
    db: Session,
    user_id: int,
    fingerprint: Optional[str],
) -> bool:
    """Return True if the user has previously trusted this fingerprint."""
    fp = _normalize_fingerprint(fingerprint)
    if not fp:
        return False
    try:
        row = (
            db.query(TrustedDevice)
            .filter(
                TrustedDevice.user_id == user_id,
                TrustedDevice.fingerprint == fp,
                TrustedDevice.revoked_at.is_(None),
            )
            .first()
        )
        return row is not None
    except SQLAlchemyError as exc:
        logger.warning("trusted_devices lookup failed: %s", exc)
        return False


def remember_device(
    db: Session,
    user_id: int,
    fingerprint: Optional[str],
    *,
    device_name: Optional[str] = None,
    last_ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> Optional[TrustedDevice]:
    """
    Insert or refresh `(user_id, fingerprint)` in `trusted_devices`.

    Safe to call on every successful login — repeated calls just bump
    `last_seen_at` (and the optional metadata) instead of duplicating rows.
    """
    fp = _normalize_fingerprint(fingerprint)
    if not fp:
        return None

    if device_name and len(device_name) > MAX_DEVICE_NAME_LEN:
        device_name = device_name[:MAX_DEVICE_NAME_LEN]
    if user_agent and len(user_agent) > 512:
        user_agent = user_agent[:512]

    try:
        device = (
            db.query(TrustedDevice)
            .filter(
                TrustedDevice.user_id == user_id,
                TrustedDevice.fingerprint == fp,
            )
            .first()
        )
        now = ist_naive()
        if device is None:
            device = TrustedDevice(
                user_id=user_id,
                fingerprint=fp,
                device_name=device_name,
                last_ip=last_ip,
                user_agent=user_agent,
                created_at=now,
                last_seen_at=now,
            )
            db.add(device)
        else:
            device.last_seen_at = now
            device.revoked_at = None
            if device_name:
                device.device_name = device_name
            if last_ip:
                device.last_ip = last_ip
            if user_agent:
                device.user_agent = user_agent
        db.commit()
        db.refresh(device)
        return device
    except SQLAlchemyError as exc:
        logger.warning("trusted_devices upsert failed: %s", exc)
        db.rollback()
        return None


def revoke_device(db: Session, user_id: int, device_id: int) -> bool:
    """Mark a single trusted device as revoked. Returns True on success."""
    try:
        device = (
            db.query(TrustedDevice)
            .filter(TrustedDevice.user_id == user_id, TrustedDevice.id == device_id)
            .first()
        )
        if not device:
            return False
        device.revoked_at = ist_naive()
        db.commit()
        return True
    except SQLAlchemyError as exc:
        logger.warning("trusted_devices revoke failed: %s", exc)
        db.rollback()
        return False


def list_devices(db: Session, user_id: int) -> list[TrustedDevice]:
    """Return all non-revoked trusted devices for the user, newest first."""
    try:
        return (
            db.query(TrustedDevice)
            .filter(
                TrustedDevice.user_id == user_id,
                TrustedDevice.revoked_at.is_(None),
            )
            .order_by(TrustedDevice.last_seen_at.desc())
            .all()
        )
    except SQLAlchemyError as exc:
        logger.warning("trusted_devices list failed: %s", exc)
        return []
