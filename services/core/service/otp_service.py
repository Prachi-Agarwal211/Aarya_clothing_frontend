"""OTP Service for Aarya Clothing Core Platform.

Handles 6-digit OTP generation, persistence (``verification_tokens`` table)
and verification across the EMAIL / SMS / WHATSAPP delivery channels.

``verify_otp`` is intentionally polymorphic — both legacy callers in
``services/core/main.py`` (which pass an ``OTPVerifyRequest`` Pydantic model)
and modern callers in ``service/auth_service.py`` (which pass
``user_id`` / ``otp_code`` / ``token_type`` keyword arguments) work against
the same return contract.
"""

from __future__ import annotations

import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Union

from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from core.redis_client import redis_client
from models import User, VerificationToken

logger = logging.getLogger(__name__)


# Maps an OTP-flow ``purpose`` (used by the public schema) to the
# ``token_type`` value persisted in the verification_tokens table.
_PURPOSE_TO_TOKEN_TYPE: Dict[str, str] = {
    "registration": "email_verification",
    "verification": "email_verification",
    "email_verification": "email_verification",
    "login": "login",
    "password_reset": "password_reset",
}


def _coerce_token_type(purpose_or_type: Optional[str]) -> str:
    if not purpose_or_type:
        return "email_verification"
    key = str(purpose_or_type).lower()
    return _PURPOSE_TO_TOKEN_TYPE.get(key, key)


def _redis_safe(call):
    """Run a ``redis_client`` call, swallowing connection errors so DB-only
    OTP verification still works during outages."""
    try:
        return call()
    except Exception as exc:  # pragma: no cover - infrastructure path
        logger.warning(f"OTP redis call failed (best-effort): {exc}")
        return None


class OTPService:
    """Generation, persistence and verification of 6-digit OTPs."""

    def __init__(self, db: Optional[Session]):
        self.db = db
        self.logger = logging.getLogger(f"{__name__}.OTPService")

    # ============================================================
    # OTP generation
    # ============================================================

    def generate_otp(self, length: int = 6) -> str:
        return "".join(secrets.choice("0123456789") for _ in range(length))

    def create_verification_token(
        self,
        user_id: int,
        token_type: str = "email_verification",
        expires_in: int = 600,
        delivery_method: str = "EMAIL",
    ) -> Dict[str, Any]:
        """Create a fresh OTP for ``user_id`` and ``token_type``.

        Any pre-existing un-verified OTP for this combination is invalidated
        first so a user can never end up with multiple live codes for the
        same flow.
        """
        try:
            self._invalidate_active(user_id, token_type)

            otp_code = self.generate_otp()
            expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
            token = VerificationToken(
                user_id=user_id,
                token=otp_code,
                token_type=token_type,
                expires_at=expires_at,
                delivery_method=delivery_method,
                verified_at=None,
            )
            self.db.add(token)
            self.db.commit()
            self.db.refresh(token)

            _redis_safe(
                lambda: redis_client.set_cache(
                    f"otp:{user_id}:{token_type}", str(token.id), ttl=expires_in
                )
            )
            return {
                "success": True,
                "otp_code": otp_code,
                "token_id": token.id,
                "expires_at": expires_at.isoformat(),
                "expires_in": expires_in,
                "delivery_method": delivery_method,
            }

        except IntegrityError as exc:
            self.db.rollback()
            logger.error(f"Integrity error creating verification token: {exc}")
            return {"success": False, "error": "Database integrity error"}
        except Exception as exc:  # pragma: no cover - defensive
            self.db.rollback()
            logger.error(f"Error creating verification token: {exc}")
            return {"success": False, "error": "Failed to create verification token"}

    # ============================================================
    # OTP verification
    # ============================================================

    def verify_otp(
        self,
        user_id_or_request: Union[int, Any],
        otp_code: Optional[str] = None,
        token_type: str = "email_verification",
    ) -> Dict[str, Any]:
        """Verify a 6-digit OTP.

        Two calling conventions are supported:

        * ``verify_otp(user_id, otp_code, token_type)`` (keyword form, used
          internally by ``AuthService``).
        * ``verify_otp(OTPVerifyRequest(...))`` (used by the FastAPI routes
          in ``services/core/main.py``); we resolve the user by ``email``
          or ``phone`` and translate ``purpose`` to ``token_type``.

        The response always contains ``success`` (boolean), ``verified``
        (boolean) and ``message`` (string) so both styles of caller can
        consume it without conditional juggling.
        """
        # --- Normalise inputs ---------------------------------------------
        if hasattr(user_id_or_request, "otp_code"):
            req = user_id_or_request
            otp_code = req.otp_code
            token_type = _coerce_token_type(getattr(req, "purpose", None))
            user_id = self._lookup_user_id(
                email=getattr(req, "email", None),
                phone=getattr(req, "phone", None),
            )
            if not user_id:
                return {
                    "success": False,
                    "verified": False,
                    "message": "User not found",
                    "error": "User not found",
                }
        else:
            user_id = user_id_or_request
            token_type = _coerce_token_type(token_type)

        if not otp_code or not str(otp_code).isdigit() or len(str(otp_code)) != 6:
            return {
                "success": False,
                "verified": False,
                "message": "OTP code must be 6 digits",
                "error": "Invalid OTP format",
            }

        # --- Database lookup ----------------------------------------------
        try:
            token = (
                self.db.query(VerificationToken)
                .filter(
                    VerificationToken.user_id == user_id,
                    VerificationToken.token == str(otp_code),
                    VerificationToken.token_type == token_type,
                    VerificationToken.verified_at.is_(None),
                )
                .order_by(VerificationToken.id.desc())
                .first()
            )
            if not token:
                return {
                    "success": False,
                    "verified": False,
                    "message": "Invalid OTP code",
                    "error": "Invalid OTP code",
                }
            if token.expires_at < datetime.now(timezone.utc):
                return {
                    "success": False,
                    "verified": False,
                    "message": "OTP has expired",
                    "error": "OTP has expired",
                }

            token.verified_at = datetime.now(timezone.utc)
            self.db.commit()
            _redis_safe(lambda: redis_client.delete_cache(f"otp:{user_id}:{token_type}"))

            return {
                "success": True,
                "verified": True,
                "message": "OTP verified",
                "user_id": user_id,
                "verified_at": token.verified_at.isoformat(),
            }

        except Exception as exc:
            logger.error(f"Error verifying OTP: {exc}")
            return {
                "success": False,
                "verified": False,
                "message": "Failed to verify OTP",
                "error": str(exc),
            }

    # ============================================================
    # OTP management
    # ============================================================

    def resend_otp(
        self,
        user_id: int,
        token_type: str = "email_verification",
        delivery_method: str = "EMAIL",
    ) -> Dict[str, Any]:
        """Issue a fresh OTP, rate-limited to 3 sends per hour per token_type."""
        rate_key = f"otp_resend:{user_id}:{token_type}"
        attempts = _redis_safe(lambda: redis_client.get_cache(rate_key))
        if attempts and int(attempts) >= 3:
            return {
                "success": False,
                "error": "Too many attempts. Try again later.",
            }
        _redis_safe(
            lambda: redis_client.set_cache(
                rate_key, int(attempts or 0) + 1, ttl=3600
            )
        )
        return self.create_verification_token(
            user_id=user_id,
            token_type=token_type,
            delivery_method=delivery_method,
        )

    def invalidate_otp(
        self,
        user_id: int,
        token_type: str = "email_verification",
    ) -> bool:
        return self._invalidate_active(user_id, token_type)

    def _invalidate_active(self, user_id: int, token_type: str) -> bool:
        try:
            updated = (
                self.db.query(VerificationToken)
                .filter(
                    VerificationToken.user_id == user_id,
                    VerificationToken.token_type == token_type,
                    VerificationToken.verified_at.is_(None),
                )
                .update(
                    {VerificationToken.verified_at: datetime.now(timezone.utc)},
                    synchronize_session=False,
                )
            )
            self.db.commit()
            _redis_safe(
                lambda: redis_client.delete_cache(f"otp:{user_id}:{token_type}")
            )
            return updated >= 0
        except Exception as exc:
            logger.error(f"Error invalidating OTP: {exc}")
            self.db.rollback()
            return False

    # ============================================================
    # Helpers
    # ============================================================

    def _lookup_user_id(
        self,
        email: Optional[str] = None,
        phone: Optional[str] = None,
    ) -> Optional[int]:
        if not email and not phone:
            return None
        clauses = []
        if email:
            clauses.append(User.email == email.lower())
        if phone:
            clauses.append(User.phone == phone)
        user = self.db.query(User.id).filter(or_(*clauses)).first()
        return user[0] if user else None

    def get_verification_token(self, token_id: int) -> Optional[VerificationToken]:
        return (
            self.db.query(VerificationToken)
            .filter(VerificationToken.id == token_id)
            .first()
        )

    def get_active_verification_tokens(
        self,
        user_id: int,
        token_type: str,
    ) -> list:
        return (
            self.db.query(VerificationToken)
            .filter(
                VerificationToken.user_id == user_id,
                VerificationToken.token_type == token_type,
                VerificationToken.verified_at.is_(None),
                VerificationToken.expires_at > datetime.now(timezone.utc),
            )
            .all()
        )

    def cleanup_expired_tokens(self) -> int:
        try:
            deleted = (
                self.db.query(VerificationToken)
                .filter(
                    VerificationToken.expires_at < datetime.now(timezone.utc),
                    VerificationToken.verified_at.is_(None),
                )
                .delete(synchronize_session=False)
            )
            self.db.commit()
            return deleted
        except Exception as exc:
            logger.error(f"Error cleaning up expired tokens: {exc}")
            self.db.rollback()
            return 0

    def health_check(self) -> Dict[str, Any]:
        return {
            "status": "healthy",
            "service": "otp",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "database_connected": self.db is not None,
        }


otp_service = OTPService(db=None)
