"""Canonical authentication service for the Aarya Clothing core platform.

This is the single source of truth for password + OTP auth, JWT token issuance,
registration with OTP verification, password change, and OTP-based password
reset. The legacy ``auth_service_otp.py``, ``auth_service_complete.py`` and
``auth_service_fixed.py`` modules have been collapsed into this file.
"""

from __future__ import annotations

import logging
import secrets
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

import jwt
from passlib.context import CryptContext
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from core.config import settings
from models import User
from shared.time_utils import now_ist


logger = logging.getLogger(__name__)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _resolve_user_query(db: Session, identifier: str):
    """Build a query that matches a user by email, username, or phone."""
    ident = (identifier or "").strip()
    if not ident:
        return None
    return (
        db.query(User)
        .filter(
            or_(
                User.email == ident.lower(),
                User.username == ident,
                User.phone == ident,
            )
        )
        .first()
    )


class AuthService:
    """Authentication, registration, password and OTP-login service.

    All timestamps written to the database are IST-aware via ``now_ist``.
    JWT ``iat``/``exp`` payload values use the same IST datetime objects;
    ``jwt`` serialises them to a UTC unix timestamp internally so token
    math stays correct across clients.
    """

    def __init__(self, db: Optional[Session]):
        self.db = db
        self.logger = logging.getLogger(f"{__name__}.AuthService")

    # ============================================================
    # Password helpers
    # ============================================================

    @staticmethod
    def get_password_hash(password: str) -> str:
        return pwd_context.hash(password)

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        return pwd_context.verify(plain_password, hashed_password)

    def validate_password(self, password: str) -> Tuple[bool, List[str]]:
        errors: List[str] = []
        min_length = getattr(settings, "PASSWORD_MIN_LENGTH", 5)
        if len(password) < min_length:
            errors.append(f"Password must be at least {min_length} characters")
        if len(password) > 128:
            errors.append("Password must be less than 128 characters")
        return len(errors) == 0, errors

    # ============================================================
    # JWT token helpers
    # ============================================================

    def create_access_token(
        self,
        user_id: int,
        role: str,
        email: Optional[str] = None,
        username: Optional[str] = None,
        is_active: bool = True,
        expires_delta: Optional[timedelta] = None,
        remember_me: bool = False,
    ) -> str:
        if expires_delta is None:
            expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        expire = now_ist() + expires_delta
        payload = {
            "sub": str(user_id),
            "role": role,
            "email": email,
            "username": username,
            "is_active": is_active,
            "remember_me": remember_me,
            "type": "access",
            "exp": expire,
            "iat": now_ist(),
        }
        return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    def create_refresh_token(
        self,
        user_id: int,
        role: str,
        email: Optional[str] = None,
        username: Optional[str] = None,
        is_active: bool = True,
        expires_delta: Optional[timedelta] = None,
        remember_me: bool = False,
    ) -> str:
        if expires_delta is None:
            days = (
                getattr(settings, "REFRESH_TOKEN_DAYS_REMEMBER", 365)
                if remember_me
                else getattr(settings, "REFRESH_TOKEN_DAYS_DEFAULT", 90)
            )
            expires_delta = timedelta(days=days)
        expire = now_ist() + expires_delta
        payload = {
            "sub": str(user_id),
            "role": role,
            "email": email,
            "username": username,
            "is_active": is_active,
            "remember_me": remember_me,
            "type": "refresh",
            "exp": expire,
            "iat": now_ist(),
        }
        return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    def decode_token(self, token: str) -> Optional[Dict[str, Any]]:
        try:
            return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        except jwt.ExpiredSignatureError:
            logger.warning("Token has expired")
            return None
        except jwt.InvalidTokenError as exc:
            logger.warning(f"Invalid token: {exc}")
            return None

    # ============================================================
    # User lookup
    # ============================================================

    def get_user_by_id(self, user_id: int) -> Optional[User]:
        return self.db.query(User).filter(User.id == user_id).first()

    def _user_payload(self, user: User) -> Dict[str, Any]:
        return {
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "first_name": getattr(user, "first_name", None),
            "last_name": getattr(user, "last_name", None),
            "full_name": user.full_name,
            "phone": user.phone,
            "role": user.role,
            "is_active": user.is_active,
            "email_verified": user.email_verified,
            "phone_verified": getattr(user, "phone_verified", False),
            "signup_verification_method": getattr(user, "signup_verification_method", None),
            "created_at": user.created_at,
            "updated_at": user.updated_at,
        }

    # ============================================================
    # Registration
    # ============================================================

    def create_user(self, user_data) -> Dict[str, Any]:
        """Register a new user and dispatch a verification OTP via the chosen channel."""
        valid, errors = self.validate_password(user_data.password)
        if not valid:
            raise ValueError("; ".join(errors))
        if not user_data.email:
            raise ValueError("Email is required")
        if not user_data.username:
            raise ValueError("Username is required")

        existing = (
            self.db.query(User)
            .filter(or_(User.email == user_data.email, User.username == user_data.username))
            .first()
        )
        if existing:
            if existing.email == user_data.email:
                raise ValueError("Email already registered")
            raise ValueError("Username already taken")

        first_name = getattr(user_data, "first_name", None) or ""
        last_name = getattr(user_data, "last_name", None) or ""
        full_name = (
            getattr(user_data, "full_name", None)
            or f"{first_name} {last_name}".strip()
        )
        verification_method = getattr(user_data, "verification_method", "otp_email")
        if hasattr(verification_method, "value"):
            verification_method = verification_method.value

        user = User(
            email=user_data.email,
            username=user_data.username,
            hashed_password=self.get_password_hash(user_data.password),
            role=getattr(user_data, "role", "customer"),
            is_active=False,
            email_verified=False,
            phone=getattr(user_data, "phone", ""),
            first_name=first_name or None,
            last_name=last_name or None,
            full_name=full_name or None,
            signup_verification_method=verification_method,
            created_at=now_ist(),
            updated_at=now_ist(),
        )
        self.db.add(user)
        try:
            self.db.commit()
        except IntegrityError:
            self.db.rollback()
            existing = (
                self.db.query(User)
                .filter(
                    or_(
                        User.email == user_data.email,
                        User.username == user_data.username,
                    )
                )
                .first()
            )
            if existing:
                if existing.email == user_data.email:
                    raise ValueError("Email already registered")
                raise ValueError("Username already taken")
            raise ValueError("Registration failed due to a database conflict")

        self.db.refresh(user)

        delivery_method = verification_method.upper().replace("OTP_", "")

        from service.otp_service import OTPService

        otp_service = OTPService(db=self.db)
        otp_result = otp_service.create_verification_token(
            user_id=user.id,
            token_type="email_verification",
            delivery_method=delivery_method,
        )
        if not otp_result.get("success"):
            self.db.delete(user)
            self.db.commit()
            raise ValueError(otp_result.get("error", "Failed to create verification token"))

        return {
            "message": "Account created. Please verify your email/phone to complete registration.",
            "user": {
                "id": user.id,
                "email": user.email,
                "username": user.username,
                "full_name": user.full_name,
                "phone": user.phone,
                "role": user.role,
                "is_active": user.is_active,
                "email_verified": user.email_verified,
            },
            "otp_method": verification_method,
            "otp_expires_at": otp_result.get("expires_at"),
            "requires_verification": True,
        }

    def verify_user_registration(
        self,
        user_id: int,
        otp_code: str,
        otp_method: str = "otp_email",
    ) -> Dict[str, Any]:
        """Verify a registration OTP, activate the account, and auto-login."""
        from service.otp_service import OTPService

        otp_service = OTPService(db=self.db)
        otp_verify = otp_service.verify_otp(
            user_id=user_id,
            otp_code=otp_code,
            token_type="email_verification",
        )
        if not otp_verify.get("success"):
            raise ValueError(otp_verify.get("error", "Invalid or expired OTP"))

        user = self.get_user_by_id(user_id)
        if not user:
            raise ValueError("User not found")

        user.is_active = True
        user.email_verified = True
        user.last_login_at = now_ist()
        self.db.commit()
        self.db.refresh(user)

        access_token = self.create_access_token(
            user.id, user.role, user.email, user.username, user.is_active
        )
        refresh_token = self.create_refresh_token(
            user.id, user.role, user.email, user.username, user.is_active
        )
        return {
            "message": "Account verified successfully. You are now logged in.",
            "user": self._user_payload(user),
            "session_id": secrets.token_urlsafe(32),
            "tokens": {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "bearer",
                "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            },
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        }

    def resend_verification_otp(
        self,
        user_id: int,
        otp_method: str = "otp_email",
    ) -> Dict[str, Any]:
        from service.otp_service import OTPService

        otp_service = OTPService(db=self.db)
        delivery_method = otp_method.upper().replace("OTP_", "")
        return otp_service.resend_otp(
            user_id=user_id,
            token_type="email_verification",
            delivery_method=delivery_method,
        )

    def create_user_auto_verify(self, user_data) -> Dict[str, Any]:
        """Skip OTP gate (used by admin scripts and seed data)."""
        valid, errors = self.validate_password(user_data.password)
        if not valid:
            raise ValueError("; ".join(errors))
        if not user_data.email or not user_data.username:
            raise ValueError("Email and username are required")

        existing = (
            self.db.query(User)
            .filter(or_(User.email == user_data.email, User.username == user_data.username))
            .first()
        )
        if existing:
            if existing.email == user_data.email:
                raise ValueError("Email already registered")
            raise ValueError("Username already taken")

        first_name = getattr(user_data, "first_name", None) or ""
        last_name = getattr(user_data, "last_name", None) or ""
        full_name = (
            getattr(user_data, "full_name", None)
            or f"{first_name} {last_name}".strip()
        )
        user = User(
            email=user_data.email,
            username=user_data.username,
            hashed_password=self.get_password_hash(user_data.password),
            role=getattr(user_data, "role", "customer"),
            is_active=True,
            email_verified=True,
            phone=getattr(user_data, "phone", ""),
            first_name=first_name or None,
            last_name=last_name or None,
            full_name=full_name or None,
            created_at=now_ist(),
            updated_at=now_ist(),
        )
        self.db.add(user)
        try:
            self.db.commit()
        except IntegrityError:
            self.db.rollback()
            raise ValueError("Registration failed due to a database conflict")
        self.db.refresh(user)

        access_token = self.create_access_token(
            user.id, user.role, user.email, user.username, user.is_active
        )
        refresh_token = self.create_refresh_token(
            user.id, user.role, user.email, user.username, user.is_active
        )
        return {
            "message": "Account created successfully. You are now logged in.",
            "user": self._user_payload(user),
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        }

    # ============================================================
    # Password login
    # ============================================================

    def login(
        self,
        identifier: Optional[str] = None,
        password: Optional[str] = None,
        remember_me: bool = False,
        # Backwards-compat kwargs:
        username: Optional[str] = None,
        email: Optional[str] = None,
        phone: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Authenticate using a single identifier (email / username / phone)."""
        ident = identifier or username or email or phone
        if not ident or not password:
            raise ValueError("Invalid credentials")

        user = _resolve_user_query(self.db, ident)
        if not user:
            logger.warning(f"Login attempt with non-existent identifier: {ident}")
            raise ValueError("Invalid credentials")

        if not user.is_active:
            method = (
                getattr(user, "signup_verification_method", None) or "otp_email"
            )
            logger.info(f"Login blocked for unverified account: {user.id}")
            raise ValueError(f"EMAIL_NOT_VERIFIED:{user.email}:{method}")

        if not self.verify_password(password, user.hashed_password):
            logger.warning(f"Failed login for user: {user.id}")
            raise ValueError("Invalid credentials")

        user.last_login_at = now_ist()
        user.failed_login_attempts = 0
        self.db.commit()
        self.db.refresh(user)

        access_token = self.create_access_token(
            user.id, user.role, user.email, user.username,
            user.is_active, remember_me=remember_me,
        )
        refresh_token = self.create_refresh_token(
            user.id, user.role, user.email, user.username,
            user.is_active, remember_me=remember_me,
        )

        return {
            "message": "Login successful",
            "user": self._user_payload(user),
            "session_id": secrets.token_urlsafe(32),
            "tokens": {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "bearer",
                "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            },
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        }

    def refresh_access_token(
        self,
        refresh_token: str,
        remember_me: Optional[bool] = None,
    ) -> Optional[Dict[str, str]]:
        payload = self.decode_token(refresh_token)
        if not payload or payload.get("type") != "refresh":
            raise ValueError("Invalid refresh token")
        user_id = int(payload.get("sub"))
        if remember_me is None:
            remember_me = bool(payload.get("remember_me", False))

        user = self.get_user_by_id(user_id)
        if not user:
            raise ValueError("User not found")
        if not user.is_active:
            raise ValueError("Account is inactive")

        access_token = self.create_access_token(
            user.id, user.role, user.email, user.username,
            user.is_active, remember_me=remember_me,
        )
        new_refresh = self.create_refresh_token(
            user.id, user.role, user.email, user.username,
            user.is_active, remember_me=remember_me,
        )
        return {
            "access_token": access_token,
            "refresh_token": new_refresh,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        }

    # ============================================================
    # OTP login
    # ============================================================

    def send_login_otp(self, identifier: str, otp_type: str = "EMAIL") -> Dict[str, Any]:
        from service.otp_service import OTPService

        user = _resolve_user_query(self.db, identifier)
        if not user:
            raise ValueError("No account found with that identifier")
        if not user.is_active:
            raise ValueError("Account is not active. Please verify your email/phone first.")

        delivery = (otp_type or "EMAIL").upper()
        result = OTPService(db=self.db).create_verification_token(
            user_id=user.id, token_type="login", delivery_method=delivery
        )
        if not result.get("success"):
            raise ValueError(result.get("error", "Failed to send login OTP"))
        return {
            "success": True,
            "message": "OTP sent",
            "user_id": user.id,
            "otp_type": delivery,
            "expires_in": result.get("expires_in", 600),
        }

    def verify_login_otp(
        self,
        identifier: str,
        otp_code: str,
        remember_me: bool = False,
    ) -> Dict[str, Any]:
        from service.otp_service import OTPService

        user = _resolve_user_query(self.db, identifier)
        if not user:
            raise ValueError("No account found with that identifier")

        verify = OTPService(db=self.db).verify_otp(
            user_id=user.id, otp_code=otp_code, token_type="login"
        )
        if not verify.get("success"):
            raise ValueError(verify.get("error", "Invalid or expired OTP"))

        user.last_login_at = now_ist()
        self.db.commit()
        self.db.refresh(user)

        access_token = self.create_access_token(
            user.id, user.role, user.email, user.username,
            user.is_active, remember_me=remember_me,
        )
        refresh_token = self.create_refresh_token(
            user.id, user.role, user.email, user.username,
            user.is_active, remember_me=remember_me,
        )
        return {
            "message": "Login successful",
            "user": self._user_payload(user),
            "session_id": secrets.token_urlsafe(32),
            "tokens": {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "bearer",
                "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            },
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        }

    # ============================================================
    # Password change & logout
    # ============================================================

    def change_password(
        self,
        user: User,
        current_password: str,
        new_password: str,
    ) -> bool:
        """Change a user's password after re-validating the current one."""
        if not user or not user.hashed_password:
            return False
        if not self.verify_password(current_password, user.hashed_password):
            return False
        valid, errors = self.validate_password(new_password)
        if not valid:
            raise ValueError("; ".join(errors))
        user.hashed_password = self.get_password_hash(new_password)
        user.updated_at = now_ist()
        self.db.commit()
        return True

    def logout(self, user_id: int, refresh_token: str) -> None:
        """Best-effort revocation of a single refresh token."""
        try:
            from core.redis_client import redis_client

            redis_client.set_cache(
                f"revoked_refresh:{refresh_token[-32:]}",
                str(user_id),
                ttl=86400 * 365,
            )
        except Exception as exc:
            logger.warning(f"logout token revoke failed (best-effort): {exc}")

    def logout_all(self, user_id: int) -> None:
        """Best-effort: stamp a logout-all marker so all existing refresh
        tokens issued before this moment are rejected by the validator."""
        try:
            from core.redis_client import redis_client

            redis_client.set_cache(
                f"logout_all:{user_id}",
                str(int(now_ist().timestamp())),
                ttl=86400 * 365,
            )
        except Exception as exc:
            logger.warning(f"logout_all failed (best-effort): {exc}")

    # ============================================================
    # Password reset (OTP only — link flow is deprecated)
    # ============================================================

    def verify_email_token(self, token: str) -> Optional[User]:
        """Legacy email-link verification path. Returns ``None`` so the route
        responds with a 400; the supported flow is OTP via
        ``verify_user_registration``."""
        logger.info("verify_email_token called — link-based email verification is deprecated")
        return None

    def request_password_reset(self, email: str, frontend_url: str = "") -> Dict[str, Any]:
        """Legacy link-based reset. Disabled in favour of the OTP flow."""
        raise ValueError(
            "Email-link password reset has been disabled. Please request a "
            "password-reset OTP instead."
        )

    def reset_password(self, token: str, new_password: str) -> Dict[str, Any]:
        """Legacy link-based reset confirmation. Disabled."""
        raise ValueError(
            "Email-link password reset has been disabled. Please use the OTP-based flow."
        )

    def verify_reset_token(self, token: str) -> Optional[User]:
        """Legacy link-based reset token verifier. Returns ``None``."""
        return None

    def request_password_reset_otp(
        self,
        identifier: str,
        otp_type: str = "EMAIL",
    ) -> Dict[str, Any]:
        """Send a 6-digit password-reset OTP to email / SMS / WhatsApp."""
        from service.otp_service import OTPService

        user = _resolve_user_query(self.db, identifier)
        # Generic response so we never leak which identifiers exist.
        if not user:
            return {
                "success": True,
                "message": "If an account exists, a reset OTP has been sent.",
                "expires_in": 600,
            }

        delivery = (otp_type or "EMAIL").upper()
        result = OTPService(db=self.db).create_verification_token(
            user_id=user.id,
            token_type="password_reset",
            delivery_method=delivery,
        )
        if not result.get("success"):
            raise ValueError(result.get("error", "Failed to send password-reset OTP"))
        return {
            "success": True,
            "message": "OTP sent",
            "expires_in": result.get("expires_in", 600),
            "otp_type": delivery,
        }

    def reset_password_with_otp(
        self,
        identifier: str,
        otp_code: str,
        new_password: str,
        otp_type: str = "EMAIL",
    ) -> Dict[str, Any]:
        """Verify the OTP then update the password."""
        from service.otp_service import OTPService

        user = _resolve_user_query(self.db, identifier)
        if not user:
            raise ValueError("No account found with that identifier")
        valid, errors = self.validate_password(new_password)
        if not valid:
            raise ValueError("; ".join(errors))

        verify = OTPService(db=self.db).verify_otp(
            user_id=user.id,
            otp_code=otp_code,
            token_type="password_reset",
        )
        if not verify.get("success"):
            raise ValueError(verify.get("error", "Invalid or expired OTP"))

        user.hashed_password = self.get_password_hash(new_password)
        user.updated_at = now_ist()
        self.db.commit()
        try:
            self.logout_all(user.id)
        except Exception:  # pragma: no cover - best-effort
            pass
        return {"success": True, "message": "Password reset successful"}


# Backwards-compatible aliases used elsewhere in the codebase.
AuthServiceOTP = AuthService
auth_service_otp = AuthService(db=None)
