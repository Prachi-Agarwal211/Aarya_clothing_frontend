"""Canonical authentication service for the Aarya Clothing core platform.

This is the single source of truth for password + OTP auth, JWT token issuance,
registration with OTP verification, password change, and OTP-based password
reset.
"""

from __future__ import annotations

import logging
import secrets
import jwt
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple, Union

from passlib.context import CryptContext
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from core.config import settings
from core.redis_client import redis_client
from models import User
from shared.time_utils import now_ist, ist_naive


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
    """Authentication, registration, password and OTP-login service."""

    def __init__(self, db: Optional[Session]):
        self.db = db
        self.algorithm = "HS256"

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
        return len(errors) == 0, errors

    # ============================================================
    # JWT token helpers
    # ============================================================

    def create_access_token(
        self, user_id: int, role: str, email: str, username: str, is_active: bool,
        remember_me: bool = False
    ) -> str:
        """Create a short-lived access token."""
        expire = ist_naive() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        payload = {
            "sub": str(user_id),
            "role": role,
            "email": email,
            "username": username,
            "is_active": is_active,
            "remember_me": remember_me,
            "type": "access",
            "iat": ist_naive(),
            "exp": expire,
            "jti": secrets.token_hex(16),
        }
        return jwt.encode(payload, settings.SECRET_KEY, algorithm=self.algorithm)

    def create_refresh_token(
        self, user_id: int, role: str, email: str, username: str, is_active: bool,
        remember_me: bool = False
    ) -> str:
        """Create a long-lived refresh token."""
        days = settings.REFRESH_TOKEN_DAYS_REMEMBER if remember_me else settings.REFRESH_TOKEN_DAYS_DEFAULT
        expire = ist_naive() + timedelta(days=days)
        payload = {
            "sub": str(user_id),
            "role": role,
            "email": email,
            "username": username,
            "is_active": is_active,
            "remember_me": remember_me,
            "type": "refresh",
            "iat": ist_naive(),
            "exp": expire,
            "jti": secrets.token_hex(16),
        }
        return jwt.encode(payload, settings.SECRET_KEY, algorithm=self.algorithm)

    def decode_token(self, token: str) -> Optional[Dict[str, Any]]:
        try:
            return jwt.decode(token, settings.SECRET_KEY, algorithms=[self.algorithm])
        except Exception:
            return None

    # ============================================================
    # User lookup & helpers
    # ============================================================

    def get_user_by_id(self, user_id: int) -> Optional[User]:
        return self.db.query(User).filter(User.id == user_id).first()

    def _user_payload(self, user: User) -> Dict[str, Any]:
        return {
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "full_name": user.full_name,
            "phone": user.phone,
            "role": user.role.value if hasattr(user.role, "value") else str(user.role),
            "is_active": user.is_active,
            "email_verified": user.email_verified,
            "phone_verified": getattr(user, "phone_verified", False),
        }

    # ============================================================
    # Registration Flow
    # ============================================================

    def create_user(self, user_data) -> Dict[str, Any]:
        """Register a new user and dispatch a verification OTP."""
        valid, errors = self.validate_password(user_data.password)
        if not valid:
            raise ValueError("; ".join(errors))

        # Check for existing user by email or username
        existing = self.db.query(User).filter(
            or_(User.email == user_data.email, User.username == user_data.username)
        ).first()

        if existing:
            # Case 1: Already verified/active -> BLOCK (redirect to login)
            if existing.is_active:
                if existing.email == user_data.email:
                    raise ValueError("Email already registered")
                raise ValueError("Username already taken")
            
            # Case 2: Unverified -> RESUME FLOW (update and send fresh OTP)
            user = existing
            user.hashed_password = self.get_password_hash(user_data.password)
            user.signup_verification_method = getattr(user_data, "verification_method", "otp_email")
            user.phone = getattr(user_data, "phone", user.phone)
            user.full_name = getattr(user_data, "full_name", user.full_name)
            user.updated_at = ist_naive()
            logger.info(f"[Auth] Resuming registration for unverified user {user.id}")
        else:
            # Case 3: Brand new user
            user = User(
                email=user_data.email,
                username=user_data.username,
                hashed_password=self.get_password_hash(user_data.password),
                role=getattr(user_data, "role", "customer"),
                is_active=False,
                email_verified=False,
                phone=getattr(user_data, "phone", ""),
                full_name=getattr(user_data, "full_name", None),
                signup_verification_method=getattr(user_data, "verification_method", "otp_email"),
                created_at=ist_naive(),
                updated_at=ist_naive(),
            )
            self.db.add(user)

        try:
            self.db.commit()
            self.db.refresh(user)
        except IntegrityError:
            self.db.rollback()
            raise ValueError("Registration failed due to a database conflict")

        from service.otp_service import OTPService
        from schemas.otp import OTPSendRequest, OTPType

        verification_method = getattr(user_data, "verification_method", "otp_email")
        otp_type = {
            "otp_email": OTPType.EMAIL,
            "otp_sms": OTPType.SMS,
            "otp_whatsapp": OTPType.WHATSAPP,
        }.get(verification_method, OTPType.EMAIL)

        otp_service = OTPService(db=self.db)
        otp_request = OTPSendRequest(
            email=user.email if otp_type == OTPType.EMAIL else None,
            phone=user.phone if otp_type in (OTPType.SMS, OTPType.WHATSAPP) else None,
            otp_type=otp_type,
            purpose="registration",
        )
        otp_result = otp_service.send_otp(otp_request)
        if not otp_result.get("success"):
            error_msg = otp_result.get("error", "Failed to send verification OTP")
            self.db.delete(user)
            self.db.commit()
            raise ValueError(f"Registration stopped: {error_msg}")

        return {
            "message": "Account created. Please verify your email/phone to complete registration.",
            "user": self._user_payload(user),
            "otp_method": verification_method,
            "otp_expires_at": otp_result.get("expires_at"),
            "requires_verification": True,
        }

    def verify_user_registration(self, user_id: int, otp_code: str, otp_method: str = "otp_email") -> Dict[str, Any]:
        """Verify registration OTP and activate account."""
        from service.otp_service import OTPService
        otp_service = OTPService(db=self.db)
        
        # UNIFIED FIX: Use "registration" consistently across create and verify
        otp_verify = otp_service.verify_otp(user_id=user_id, otp_code=otp_code, token_type="registration")
        if not otp_verify.get("success"):
            raise ValueError(otp_verify.get("error", "Invalid or expired OTP"))

        user = self.get_user_by_id(user_id)
        if not user: raise ValueError("User not found")

        user.is_active = True
        method = str(otp_method).lower()
        if any(m in method for m in ("sms", "whatsapp", "phone")):
            user.phone_verified = True
        else:
            user.email_verified = True

        user.last_login_at = ist_naive()
        self.db.commit()
        self.db.refresh(user)

        role_str = user.role.value if hasattr(user.role, "value") else str(user.role)
        access_token = self.create_access_token(user.id, role_str, user.email, user.username, user.is_active)
        refresh_token = self.create_refresh_token(user.id, role_str, user.email, user.username, user.is_active)
        
        return {
            "message": "Account verified successfully. You are now logged in.",
            "user": self._user_payload(user),
            "session_id": secrets.token_urlsafe(32),
            "tokens": {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "bearer",
                "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            }
        }

    # ============================================================
    # Login Flow
    # ============================================================

    def login(self, identifier: str, password: str, remember_me: bool = False, **kwargs) -> Dict[str, Any]:
        """Authenticate using identifier and password."""
        user = _resolve_user_query(self.db, identifier)
        if not user:
            raise ValueError("Account not found. Please create an account first.")

        if getattr(user, "account_locked_until", None) and user.account_locked_until > ist_naive():
            raise ValueError("Account temporarily locked. Please try again later.")

        if not user.is_active:
            raise ValueError("Account not verified. Please complete your registration verification.")

        if not self.verify_password(password, user.hashed_password):
            user.failed_login_attempts = int(getattr(user, "failed_login_attempts", 0)) + 1
            if user.failed_login_attempts >= settings.MAX_LOGIN_ATTEMPTS:
                user.account_locked_until = ist_naive() + timedelta(minutes=settings.ACCOUNT_LOCKOUT_MINUTES)
                user.failed_login_attempts = 0
                self.db.commit()
                
                # SECURITY: Notify the user about the lockout
                try:
                    from service.email_service import email_service
                    email_service.send_security_alert(
                        user.email,
                        "Account Locked",
                        f"Your Aarya Clothing account has been locked for {settings.ACCOUNT_LOCKOUT_MINUTES} minutes due to multiple failed login attempts. If this wasn't you, please reset your password immediately."
                    )
                except Exception as exc:
                    logger.error(f"Failed to send lockout alert email: {exc}")

                raise ValueError(f"Account locked due to failed attempts. Try again in {settings.ACCOUNT_LOCKOUT_MINUTES} mins.")
            self.db.commit()
            raise ValueError("Incorrect password. Please try again.")

        user.last_login_at = ist_naive()
        user.failed_login_attempts = 0
        user.account_locked_until = None
        self.db.commit()
        self.db.refresh(user)

        role_str = user.role.value if hasattr(user.role, "value") else str(user.role)
        access_token = self.create_access_token(user.id, role_str, user.email, user.username, user.is_active, remember_me)
        refresh_token = self.create_refresh_token(user.id, role_str, user.email, user.username, user.is_active, remember_me)

        return {
            "message": "Login successful",
            "user": self._user_payload(user),
            "session_id": secrets.token_urlsafe(32),
            "tokens": {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "bearer",
                "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            }
        }

    def send_login_otp(self, identifier: str, otp_type: str = "EMAIL") -> Dict[str, Any]:
        """Send a login OTP."""
        user = _resolve_user_query(self.db, identifier)
        if not user:
            raise ValueError("Account not found. Please create an account first.")
        
        if not user.is_active:
            raise ValueError("Account not verified. Please complete your registration verification.")

        delivery = (otp_type or "EMAIL").upper()
        from service.otp_service import OTPService
        otp_service = OTPService(db=self.db)
        
        result = otp_service.create_verification_token(user_id=user.id, token_type="login", delivery_method=delivery)
        if not result.get("success"):
            raise ValueError(result.get("error", "Failed to generate login OTP"))

        send_result = otp_service._dispatch_otp(
            otp_type=delivery,
            email=user.email,
            phone=user.phone,
            otp_code=result.get("otp_code"),
            purpose="login"
        )
        if not send_result.get("success"):
            raise ValueError(send_result.get("error", "Failed to deliver OTP"))

        return {"success": True, "message": "OTP sent", "otp_type": delivery, "expires_in": 600}

    def verify_login_otp(self, identifier: str, otp_code: str, remember_me: bool = False, **kwargs) -> Dict[str, Any]:
        """Verify login OTP and issue tokens."""
        user = _resolve_user_query(self.db, identifier)
        if not user: raise ValueError("Invalid or expired OTP")

        from service.otp_service import OTPService
        verify = OTPService(db=self.db).verify_otp(user_id=user.id, otp_code=otp_code, token_type="login")
        if not verify.get("success"):
            raise ValueError(verify.get("error", "Invalid or expired OTP"))

        # Update verification flag based on delivery method
        delivery = str(verify.get("delivery_method", "EMAIL")).upper()
        if any(m in delivery for m in ("SMS", "WHATSAPP", "PHONE")):
            user.phone_verified = True
        else:
            user.email_verified = True

        user.last_login_at = ist_naive()
        self.db.commit()
        self.db.refresh(user)

        role_str = user.role.value if hasattr(user.role, "value") else str(user.role)
        access_token = self.create_access_token(user.id, role_str, user.email, user.username, user.is_active, remember_me)
        refresh_token = self.create_refresh_token(user.id, role_str, user.email, user.username, user.is_active, remember_me)

        return {
            "message": "Login successful",
            "user": self._user_payload(user),
            "session_id": secrets.token_urlsafe(32),
            "tokens": {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "bearer",
                "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            }
        }

    # ============================================================
    # Refresh Token Rotation
    # ============================================================

    def refresh_access_token(self, refresh_token: str) -> Dict[str, Any]:
        """Rotate refresh token and issue new access token."""
        payload = self.decode_token(refresh_token)
        if not payload or payload.get("type") != "refresh":
            raise ValueError("Invalid refresh token")

        user_id = int(payload.get("sub"))
        revoked_key = f"revoked_refresh:{refresh_token[-32:]}"
        if redis_client.get_cache(revoked_key):
            raise ValueError("Refresh token has been revoked")

        user = self.get_user_by_id(user_id)
        if not user or not user.is_active:
            raise ValueError("User not found or inactive")

        # Rotate: Blacklist old, issue new
        exp = payload.get("exp")
        if exp:
            ttl = int(exp - ist_naive().timestamp())
            if ttl > 0: redis_client.set_cache(revoked_key, "1", ttl=ttl)

        remember_me = bool(payload.get("remember_me", False))
        role_str = user.role.value if hasattr(user.role, "value") else str(user.role)
        
        new_access = self.create_access_token(user.id, role_str, user.email, user.username, user.is_active, remember_me)
        new_refresh = self.create_refresh_token(user.id, role_str, user.email, user.username, user.is_active, remember_me)

        return {
            "access_token": new_access,
            "refresh_token": new_refresh,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        }

    # ============================================================
    # Password Reset (Forgot Password)
    # ============================================================

    def request_password_reset_otp(self, identifier: str, otp_type: str = "EMAIL") -> Dict[str, Any]:
        """Request password reset via OTP."""
        user = _resolve_user_query(self.db, identifier)
        if not user:
            raise ValueError("Account not found. Please create an account first.")

        delivery = (otp_type or "EMAIL").upper()
        from service.otp_service import OTPService
        otp_service = OTPService(db=self.db)
        
        result = otp_service.create_verification_token(user_id=user.id, token_type="password_reset", delivery_method=delivery)
        if not result.get("success"):
            raise ValueError(result.get("error", "Failed to generate reset OTP"))

        send_result = otp_service._dispatch_otp(
            otp_type=delivery,
            email=user.email,
            phone=user.phone,
            otp_code=result.get("otp_code"),
            purpose="password_reset"
        )
        if not send_result.get("success"):
            raise ValueError(send_result.get("error", "Failed to deliver OTP"))

        return {"success": True, "message": "OTP sent", "expires_in": 600}

    def reset_password_with_otp(self, identifier: str, otp_code: str, new_password: str, otp_type: str = "EMAIL") -> Dict[str, Any]:
        """Reset password after OTP verification."""
        user = _resolve_user_query(self.db, identifier)
        if not user: raise ValueError("Account not found")

        valid, errors = self.validate_password(new_password)
        if not valid: raise ValueError("; ".join(errors))

        user.hashed_password = self.get_password_hash(new_password)
        user.password_changed_at = ist_naive()
        user.updated_at = ist_naive()
        self.db.commit()

        # Logout all sessions after password change
        redis_client.set_cache(f"logout_all:{user.id}", str(int(ist_naive().timestamp())), ttl=86400 * 30)
        
        return {"success": True, "message": "Password reset successful"}

    def logout(self, user_id: int, refresh_token: str) -> None:
        """Revoke a single refresh token."""
        redis_client.set_cache(f"revoked_refresh:{refresh_token[-32:]}", str(user_id), ttl=86400 * 30)

    def logout_all(self, user_id: int) -> None:
        """Revoke all tokens for a user."""
        redis_client.set_cache(f"logout_all:{user_id}", str(int(ist_naive().timestamp())), ttl=86400 * 30)


# Backwards-compatible aliases
AuthServiceOTP = AuthService
auth_service_otp = AuthService(db=None)
