"""Phone number normalization utilities for Aarya Clothing.

Normalizes Indian and international phone numbers to E.164 format
so the system can match them regardless of how the user types them
(e.g. +919XXXXXXXXX, 919XXXXXXXXX, 099XXXXXXXXX, 9XXXXXXXXX).
"""

import logging
import re
from typing import Optional

logger = logging.getLogger(__name__)


def normalize_phone(phone: str) -> str:
    """Normalize a phone number to E.164 format (+91XXXXXXXXXX)."""
    if not phone or not phone.strip():
        raise ValueError("Phone number is empty")
    cleaned = re.sub(r"[\s\-\(\)\.]+", "", phone.strip())
    if cleaned.startswith("+"):
        if len(cleaned) < 8:
            raise ValueError(f"Phone number too short after normalization: {cleaned}")
        return cleaned
    stripped = cleaned.lstrip("0")
    if stripped.startswith("91") and len(stripped) == 12:
        return f"+{stripped}"
    if len(stripped) == 10 and stripped.isdigit():
        return f"+91{stripped}"
    if stripped.isdigit() and len(stripped) >= 7:
        return f"+{stripped}"
    raise ValueError(f"Cannot parse phone number: {phone}")


def normalize_phone_safe(phone: Optional[str]) -> Optional[str]:
    """Safe version that returns None instead of raising."""
    if not phone or not phone.strip():
        return None
    try:
        return normalize_phone(phone)
    except (ValueError, Exception) as exc:
        logger.warning(f"Could not normalize phone '{phone}': {exc}")
        return None
