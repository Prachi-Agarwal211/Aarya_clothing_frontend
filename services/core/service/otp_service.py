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
from datetime import datetime, timedelta
from typing import Any, Dict, Optional, Union

from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from core.config import settings
from core.redis_client import redis_client
from models import User, VerificationToken
from shared.time_utils import IST, ist_naive

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


def _utcnow_naive() -> datetime:
    """DB uses timestamp without timezone; keep IST values naive for consistency."""
    return ist_naive()


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

        ⚠️ RACE CONDITION: Any pre-existing un-verified OTP for this combination
        is invalidated BEFORE creating a new one. This prevents multiple valid OTPs
        for the same flow, but it also means:
        - If a user requests a new OTP without verifying the old one, the old OTP
          will be invalidated and marked as verified
        - Users should use the most recently sent OTP for verification

        This is intentional to prevent confusion and security issues with multiple
        valid OTPs for the same account flow.
        """
        try:
            self._invalidate_active(user_id, token_type)

            otp_code = self.generate_otp()
            expires_at = _utcnow_naive() + timedelta(seconds=expires_in)
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

    def send_otp(self, otp_request: Any) -> Dict[str, Any]:
        """Compatibility API for FastAPI routes using OTPSendRequest.

        Flow:
        1) Resolve user by email/phone.
        2) Create verification token in DB.
        3) Deliver OTP via EMAIL/SMS/WHATSAPP best-effort.
        """
        raw_otp_type = getattr(otp_request, "otp_type", "EMAIL")
        if hasattr(raw_otp_type, "value"):
            raw_otp_type = raw_otp_type.value
        otp_type = str(raw_otp_type).upper()
        purpose = getattr(otp_request, "purpose", "verification")
        token_type = _coerce_token_type(purpose)
        email = getattr(otp_request, "email", None)
        phone = getattr(otp_request, "phone", None)

        user_id = self._lookup_user_id(email=email, phone=phone)
        if not user_id:
            return {"success": False, "error": "User not found"}

        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            return {"success": False, "error": "User not found"}

        target_email = email or getattr(user, "email", None)
        target_phone = phone or getattr(user, "phone", None)

        token_result = self.create_verification_token(
            user_id=user_id,
            token_type=token_type,
            delivery_method=otp_type,
        )
        if not token_result.get("success"):
            return token_result

        otp_code = token_result.get("otp_code")
        send_result = self._dispatch_otp(
            otp_type=otp_type,
            email=target_email,
            phone=target_phone,
            otp_code=otp_code,
            purpose=purpose,
        )
        if not send_result.get("success"):
            return {"success": False, "error": send_result.get("error", "Failed to send OTP")}

        return {
            "success": True,
            "message": "OTP sent",
            "expires_in": token_result.get("expires_in", 600),
            "expires_at": token_result.get("expires_at"),
            "email": target_email,
            "phone": target_phone,
            "otp_type": otp_type,
        }

    # ============================================================
    # OTP verification
    # ============================================================

    def verify_otp(
        self,
        user_id_or_request: Optional[Union[int, Any]] = None,
        otp_code: Optional[str] = None,
        token_type: str = "email_verification",
        **kwargs: Any,
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
        if user_id_or_request is None and "user_id" in kwargs:
            user_id_or_request = kwargs.get("user_id")

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

        max_attempts = int(getattr(settings, "OTP_MAX_ATTEMPTS", 5))
        attempt_key = f"otp_attempts:{user_id}:{token_type}"
        attempts = _redis_safe(lambda: redis_client.get_cache(attempt_key, namespace=""))
        if attempts and int(attempts) >= max_attempts:
            return {
                "success": False,
                "verified": False,
                "message": "Too many attempts. Please request a new OTP.",
                "error": "Too many attempts",
            }

        # --- Database lookup ----------------------------------------------
        try:
            logger.info(f"[OTP DEBUG] Querying DB - user_id={user_id}, type={token_type}, code={otp_code}")
            
            # Debug: Check if ANY tokens exist for this user/type
            all_tokens = self.db.query(VerificationToken).filter(
                VerificationToken.user_id == user_id,
                VerificationToken.token_type == token_type
            ).order_by(VerificationToken.id.desc()).limit(3).all()
            
            for t in all_tokens:
                logger.info(f"[OTP DEBUG] Existing Token: id={t.id}, code={t.token}, verified_at={t.verified_at}, expires_at={t.expires_at}")

            token = (
                self.db.query(VerificationToken)
                .filter(
                    VerificationToken.user_id == user_id,
                    VerificationToken.token == str(otp_code).strip(),
                    VerificationToken.token_type == token_type,
                    VerificationToken.verified_at.is_(None),
                )
                .with_for_update(skip_locked=True)  # Prevent race conditions
                # Note: skip_locked=True means if row is locked by another transaction,
                # PostgreSQL returns NULL instead of blocking. This is intentional and secure.
                .order_by(VerificationToken.id.desc())
                .first()
            )

            if not token:
                # Two possible causes:
                # 1. No matching token (invalid OTP)
                # 2. Token locked by another transaction (race condition)
                # Both return "invalid OTP" to prevent timing attacks
                _redis_safe(
                    lambda: redis_client.set_cache(
                        attempt_key,
                        int(attempts or 0) + 1,
                        ttl=int(getattr(settings, "OTP_EXPIRY_MINUTES", 10)) * 60,
                        namespace="",
                    )
                )
                return {
                    "success": False,
                    "verified": False,
                    "message": "Invalid OTP code",
                    "error": "Invalid OTP code",
                }

            expires_at = token.expires_at
            if expires_at and expires_at.tzinfo is not None:
                expires_at = expires_at.astimezone(IST).replace(tzinfo=None)
            if expires_at and expires_at < _utcnow_naive():
                _redis_safe(
                    lambda: redis_client.set_cache(
                        attempt_key,
                        int(attempts or 0) + 1,
                        ttl=int(getattr(settings, "OTP_EXPIRY_MINUTES", 10)) * 60,
                        namespace="",
                    )
                )
                return {
                    "success": False,
                    "verified": False,
                    "message": "OTP has expired",
                    "error": "OTP has expired",
                }

            token.verified_at = _utcnow_naive()
            self.db.commit()
            _redis_safe(lambda: redis_client.delete_cache(f"otp:{user_id}:{token_type}"))
            _redis_safe(lambda: redis_client.delete_cache(attempt_key, namespace=""))

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
                .with_for_update()  # Lock rows before updating to prevent race conditions
                .update(
                    {VerificationToken.verified_at: _utcnow_naive()},
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
                    VerificationToken.expires_at > _utcnow_naive(),
            )
            .all()
        )

    def cleanup_expired_tokens(self) -> int:
        try:
            deleted = (
                self.db.query(VerificationToken)
                .filter(
                    VerificationToken.expires_at < _utcnow_naive(),
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
            "timestamp": _utcnow_naive().isoformat() + "Z",
            "database_connected": self.db is not None,
        }

    def _dispatch_otp(
        self,
        otp_type: str,
        email: Optional[str],
        phone: Optional[str],
        otp_code: str,
        purpose: str,
    ) -> Dict[str, Any]:
        """Send OTP through selected channel."""
        otp_type = (otp_type or "EMAIL").upper()
        try:
            if otp_type == "EMAIL":
                if not email:
                    return {"success": False, "error": "Email is required for email OTP"}

                from service.email_queue import try_enqueue_otp_email
                from service.email_service import email_service

                # Only try to enqueue if the setting is enabled
                if settings.EMAIL_OTP_USE_QUEUE:
                    queued = try_enqueue_otp_email(email, otp_code, purpose or "verification")
                    if queued:
                        logger.info("[OTP] Email queued for %s", email)
                        return {"success": True, "queued": True}
                    logger.warning("[OTP] Email queueing failed, falling back to sync send for %s", email)

                # Send synchronously
                logger.info("[OTP] Sending email synchronously to %s", email)
                ok = email_service.send_otp_email(email, otp_code, purpose or "verification")
                if ok:
                    return {"success": True}

                logger.error("[OTP] Failed to send email to %s", email)
                return {"success": False, "error": "Failed to deliver OTP email. Please check your configuration."}

            if otp_type == "SMS":
                if not phone:
                    return {"success": False, "error": "Phone is required for SMS OTP"}
                from service.sms_service import sms_service
                
                if not sms_service.api_key:
                    return {"success": False, "error": "SMS service not configured. Set FAST2SMS_API_KEY."}
                result = sms_service.send_otp(phone, otp_code, purpose or "verification")
                return result if isinstance(result, dict) else {"success": bool(result)}

            if otp_type == "WHATSAPP":
                if not phone:
                    return {"success": False, "error": "Phone is required for WhatsApp OTP"}
                from service.whatsapp_service import whatsapp_service
                
                if not whatsapp_service.api_key or not whatsapp_service.phone_number_id:
                    return {"success": False, "error": "WhatsApp service not configured. Set FAST2SMS_API_KEY and FAST2SMS_PHONE_NUMBER_ID."}
                
                result = whatsapp_service.send_otp(phone, otp_code)
                if isinstance(result, dict):
                    if not result.get("success"):
                        return {"success": False, "error": result.get("error", "WhatsApp delivery failed")}
                    return result
                return {"success": bool(result)}

            return {"success": False, "error": f"Unsupported OTP type: {otp_type}"}
        except Exception as exc:  # pragma: no cover - infra dependent
            logger.error(f"OTP delivery failed ({otp_type}): {exc}")
            return {"success": False, "error": f"Failed to deliver OTP via {otp_type}"}


otp_service = OTPService(db=None)
