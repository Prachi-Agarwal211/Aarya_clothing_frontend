"""Authentication Service for Aarya Clothing Core Platform."""

import secrets
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple, List, Dict, Any
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from passlib.context import CryptContext
import jwt

from core.config import settings
from models import User, UserRole, UserProfile, UserSecurity, EmailVerification
from schemas.auth import UserResponse

logger = logging.getLogger(__name__)

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class AuthService:
    """Service for authentication and user management."""

    def __init__(self, db: Optional[Session]):
        """Initialize auth service with database session."""
        self.db = db

    # ==================== Password Methods ====================

    @staticmethod
    def get_password_hash(password: str) -> str:
        """Hash a password using bcrypt."""
        return pwd_context.hash(password)

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash."""
        return pwd_context.verify(plain_password, hashed_password)

    def validate_password(self, password: str) -> Tuple[bool, List[str]]:
        """
        Validate password against security policy.

        Returns:
            Tuple of (is_valid, list_of_errors)
        """
        errors = []

        if len(password) < settings.PASSWORD_MIN_LENGTH:
            errors.append(
                f"Password must be at least {settings.PASSWORD_MIN_LENGTH} characters"
            )

        if settings.PASSWORD_REQUIRE_UPPERCASE and not any(
            c.isupper() for c in password
        ):
            errors.append("Password must contain at least one uppercase letter")

        if settings.PASSWORD_REQUIRE_LOWERCASE and not any(
            c.islower() for c in password
        ):
            errors.append("Password must contain at least one lowercase letter")

        if settings.PASSWORD_REQUIRE_NUMBER and not any(c.isdigit() for c in password):
            errors.append("Password must contain at least one number")

        if settings.PASSWORD_REQUIRE_SPECIAL:
            special_chars = "!@#$%^&*()_+-=[]{}|;:,.<>?"
            if not any(c in special_chars for c in password):
                errors.append("Password must contain at least one special character")

        return len(errors) == 0, errors

    # ==================== JWT Token Methods ====================

    def create_access_token(
        self, user_id: int, role: str, expires_delta: Optional[timedelta] = None
    ) -> str:
        """Create a JWT access token."""
        if expires_delta is None:
            expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

        expire = datetime.now(timezone.utc) + expires_delta
        payload = {
            "sub": str(user_id),
            "role": role,
            "type": "access",
            "exp": expire,
            "iat": datetime.now(timezone.utc),
        }
        return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    def create_refresh_token(
        self, user_id: int, role: str, expires_delta: Optional[timedelta] = None
    ) -> str:
        """Create a JWT refresh token."""
        if expires_delta is None:
            expires_delta = timedelta(minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES)

        expire = datetime.now(timezone.utc) + expires_delta
        payload = {
            "sub": str(user_id),
            "role": role,
            "type": "refresh",
            "exp": expire,
            "iat": datetime.now(timezone.utc),
        }
        return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    def decode_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Decode and validate a JWT token."""
        try:
            payload = jwt.decode(
                token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
            )
            return payload
        except jwt.ExpiredSignatureError:
            logger.warning("Token has expired")
            return None
        except jwt.InvalidTokenError as e:
            logger.warning(f"Invalid token: {e}")
            return None

    def refresh_access_token(self, refresh_token: str) -> Optional[Dict[str, str]]:
        """
        Refresh an access token using a refresh token.

        Returns:
            Dict with new access_token and refresh_token, or None if invalid.
        """
        payload = self.decode_token(refresh_token)

        if not payload or payload.get("type") != "refresh":
            return None

        user_id = int(payload.get("sub"))

        # Check if token is blacklisted
        try:
            from core.redis_client import redis_client

            if redis_client.is_blacklisted(refresh_token):
                logger.warning(f"Refresh token is blacklisted for user {user_id}")
                return None
        except (ImportError, Exception):
            pass  # Redis not available, skip blacklist check

        # MANDATORY DB LOOKUP: Verify user exists and is active
        user = (
            self.db.query(User)
            .filter(User.id == user_id, User.is_active == True)
            .first()
        )
        if not user:
            logger.warning(f"Refresh failed: User {user_id} not found or inactive")
            return None

        role = user.role.value

        new_access_token = self.create_access_token(user_id, role)
        new_refresh_token = self.create_refresh_token(user_id, role)

        return {
            "access_token": new_access_token,
            "refresh_token": new_refresh_token,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        }

    # ==================== User CRUD Methods ====================

    def create_user(self, user_data) -> Dict[str, Any]:
        """
        Create a new user (OPTIMIZED: No auto-login, requires email verification).

        Args:
            user_data: UserCreate schema with email, username, password, etc.

        Returns:
            Dict with user info only (NO tokens - email verification required)
        """
        # Validate password
        valid, errors = self.validate_password(user_data.password)
        if not valid:
            raise ValueError("; ".join(errors))

        # Validate phone number is provided
        if not user_data.phone:
            raise ValueError("Phone number is required")

        # Check if user already exists
        existing = (
            self.db.query(User)
            .filter(
                or_(User.email == user_data.email, User.username == user_data.username)
            )
            .first()
        )

        if existing:
            if existing.email == user_data.email:
                raise ValueError("Email already registered")
            raise ValueError("Username already taken")

        # Create user and profile objects
        user = User(
            email=user_data.email,
            username=user_data.username,
            hashed_password=self.get_password_hash(user_data.password),
            role=getattr(user_data, "role", UserRole.customer),
            is_active=True,
            email_verified=False,  # Requires verification
        )

        user_profile = UserProfile(
            full_name=user_data.full_name,
            phone=user_data.phone,  # Phone is now required
        )

        user_security = UserSecurity()

        # Associate profile and security with user
        user.profile = user_profile
        user.security = user_security

        self.db.add(user)

        try:
            self.db.commit()
        except IntegrityError:
            self.db.rollback()
            # Check which field caused the conflict
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

        # After committing, the user object and its relationships are in the DB.
        # We query it again to ensure all relationships are loaded for the response model.
        self.db.refresh(user)

        # Re-query the user with relationships loaded to ensure the response model works
        user_with_profile = (
            self.db.query(User)
            .options(joinedload(User.profile))
            .filter(User.id == user.id)
            .one()
        )

        return {
            "message": "Account created. Please check your email to verify your account.",
            "user": UserResponse.model_validate(user_with_profile).model_dump(),
        }

    def create_email_verification_token(self, user_id: int) -> str:
        """Create an email verification token for a user."""
        return secrets.token_urlsafe(32)

    def save_verification_token(
        self, user_id: int, token: str, token_type: str = "email_verification"
    ) -> None:
        """Save verification token to the database using the ORM."""
        expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
        verification = EmailVerification(
            user_id=user_id, token=token, token_type=token_type, expires_at=expires_at
        )
        self.db.add(verification)
        self.db.commit()

    def verify_email_token(self, token: str) -> Optional[User]:
        """
        Verify an email verification token using the ORM.

        Returns:
            User if token is valid, None otherwise.
        """
        verification = (
            self.db.query(EmailVerification)
            .filter(
                EmailVerification.token == token,
                EmailVerification.token_type == "email_verification",
            )
            .first()
        )

        if not verification:
            return None

        # Ensure expires_at is timezone-aware if it's naive (assuming UTC)
        expires_at = verification.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)

        if verification.verified_at or expires_at < datetime.now(timezone.utc):
            return None

        # Mark token as verified
        verification.verified_at = datetime.now(timezone.utc)

        # Update user's email_verified status
        user = verification.user
        if user:
            user.email_verified = True
            self.db.commit()
            self.db.refresh(user)

        return user

    def login(
        self, username: str, password: str, remember_me: bool = False
    ) -> Dict[str, Any]:
        """
        Authenticate a user and return tokens.

        Args:
            username: Username, email, or phone number
            password: Plain text password
            remember_me: If True, extend refresh token expiry

        Returns:
            Dict with user info, tokens, and session_id
        """
        # Find user by username, email, or phone (phone is in user_profiles)
        from models.user_profile import UserProfile

        user = (
            self.db.query(User)
            .options(joinedload(User.profile), joinedload(User.security))
            .outerjoin(UserProfile, User.id == UserProfile.user_id)
            .filter(
                or_(
                    User.username == username,
                    User.email == username,
                    UserProfile.phone == username,
                )
            )
            .first()
        )

        if not user:
            raise ValueError("Invalid credentials")

        # Check if account is locked
        if (
            user.security
            and user.security.locked_until
            and user.security.locked_until > datetime.now(timezone.utc)
        ):
            remaining = (
                user.security.locked_until - datetime.now(timezone.utc)
            ).seconds // 60
            raise ValueError(f"Account locked. Try again in {remaining} minutes")

        # Check if account is active
        if not user.is_active:
            raise ValueError("Account is deactivated")

        # OPTIMIZED: Check if email is verified
        if not user.email_verified:
            # Reveal existence only in dev, otherwise standardized
            if settings.is_development:
                raise ValueError(
                    "Email verification required. Please check your email to verify your account."
                )
            raise ValueError("Invalid credentials")

        # Verify password
        if not self.verify_password(password, user.hashed_password):
            if user.security:
                user.security.failed_login_attempts = (
                    user.security.failed_login_attempts or 0
                ) + 1
                if user.security.failed_login_attempts >= settings.MAX_LOGIN_ATTEMPTS:
                    user.security.locked_until = datetime.now(timezone.utc) + timedelta(
                        minutes=settings.ACCOUNT_LOCKOUT_MINUTES
                    )
                    self.db.commit()
                    raise ValueError(
                        f"Account locked for {settings.ACCOUNT_LOCKOUT_MINUTES} minutes due to too many failed attempts"
                    )
                self.db.commit()
                remaining = (
                    settings.MAX_LOGIN_ATTEMPTS - user.security.failed_login_attempts
                )
                raise ValueError("Invalid credentials")
            else:
                # Fallback if security object doesn't exist for some reason
                self.db.commit()
                raise ValueError("Invalid credentials")

        # Reset failed attempts on successful login
        if user.security:
            user.security.failed_login_attempts = 0
            user.security.locked_until = None
            user.security.last_login_at = datetime.now(timezone.utc)
            self.db.commit()

        # Generate tokens
        refresh_delta = (
            timedelta(minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES)
            if remember_me
            else None
        )
        access_token = self.create_access_token(user.id, user.role.value)
        refresh_token = self.create_refresh_token(
            user.id, user.role.value, refresh_delta
        )

        # Create session
        session_id = secrets.token_urlsafe(32)
        session_expiry = (
            settings.SESSION_EXPIRE_MINUTES
            if remember_me
            else settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
        try:
            from core.redis_client import redis_client

            redis_client.create_session(
                session_id, {"user_id": user.id}, session_expiry
            )
        except ImportError:
            pass

        return {
            "user": UserResponse.model_validate(user).model_dump(),
            "tokens": {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "bearer",
                "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            },
            "session_id": session_id,
        }

    def logout(self, user_id: int, refresh_token: str) -> bool:
        """
        Logout a user by blacklisting their refresh token.

        Args:
            user_id: User ID
            refresh_token: The refresh token to blacklist

        Returns:
            True if logout successful
        """
        try:
            from core.redis_client import redis_client

            # Blacklist the refresh token
            redis_client.blacklist_token(
                refresh_token, settings.REFRESH_TOKEN_EXPIRE_MINUTES * 60
            )
            logger.info(f"User {user_id} logged out")
        except ImportError:
            pass

        return True

    def logout_all(self, user_id: int) -> int:
        """
        Logout a user from all devices by deleting all sessions.

        Args:
            user_id: User ID

        Returns:
            Number of sessions deleted
        """
        try:
            from core.redis_client import redis_client

            deleted = redis_client.delete_user_sessions(user_id)
            logger.info(f"User {user_id} logged out from {deleted} devices")
            return deleted
        except ImportError:
            return 0

    # ==================== Password Reset Methods ====================

    def change_password(
        self, user: User, current_password: str, new_password: str
    ) -> bool:
        """
        Change a user's password.
        """
        if not self.verify_password(current_password, user.hashed_password):
            raise ValueError("Current password is incorrect")

        valid, errors = self.validate_password(new_password)
        if not valid:
            raise ValueError("; ".join(errors))

        user.hashed_password = self.get_password_hash(new_password)
        if user.security:
            user.security.last_password_change = datetime.now(timezone.utc)

        self.db.commit()
        self.logout_all(user.id)
        logger.info(f"Password changed for user {user.id}")
        return True

    def request_password_reset(
        self, email: str, frontend_url: str = "http://localhost:3000"
    ) -> Dict[str, Any]:
        """
        Request a password reset email.
        """
        user = self.db.query(User).filter(User.email == email).first()

        if not user:
            return {"message": "If the email exists, a reset link has been sent"}

        reset_token = self.create_email_verification_token(user.id)
        self.save_verification_token(user.id, reset_token, token_type="password_reset")

        reset_url = f"{frontend_url}/auth/reset-password?token={reset_token}"
        from service.email_service import email_service

        email_service.send_password_reset_email(email, reset_token, reset_url)

        logger.info(f"Password reset requested for {email}")
        return {"message": "If the email exists, a reset link has been sent"}

    def verify_reset_token(self, token: str) -> Optional[User]:
        """
        Verify a password reset token using the EmailVerification model.
        """
        verification = (
            self.db.query(EmailVerification)
            .filter(
                EmailVerification.token == token,
                EmailVerification.token_type == "password_reset",
            )
            .first()
        )

        if (
            not verification
            or verification.verified_at
            or verification.expires_at < datetime.now(timezone.utc)
        ):
            return None

        return verification.user

    def reset_password(self, token: str, new_password: str) -> bool:
        """
        Reset a user's password using a reset token.
        """
        verification = (
            self.db.query(EmailVerification)
            .filter(EmailVerification.token == token)
            .first()
        )
        if not verification:
            raise ValueError("Invalid or expired reset token")

        user = self.verify_reset_token(token)
        if not user:
            raise ValueError("Invalid or expired reset token")

        valid, errors = self.validate_password(new_password)
        if not valid:
            raise ValueError("; ".join(errors))

        user.hashed_password = self.get_password_hash(new_password)
        if user.security:
            user.security.failed_login_attempts = 0
            user.security.locked_until = None
            user.security.last_password_change = datetime.now(timezone.utc)

        verification.verified_at = datetime.now(timezone.utc)

        self.db.commit()
        self.logout_all(user.id)
        logger.info(f"Password reset for user {user.id}")
        return True

    def request_password_reset_otp(
        self, identifier: str, otp_type: str = "EMAIL"
    ) -> Dict[str, Any]:
        """
        Request a password reset via OTP.

        Args:
            identifier: Email or phone number
            otp_type: "EMAIL" or "WHATSAPP"

        Returns:
            Dict with success message
        """
        # Find user by email or phone (phone is in user_profiles)
        from models.user_profile import UserProfile

        user = (
            self.db.query(User)
            .outerjoin(UserProfile, User.id == UserProfile.user_id)
            .filter(or_(User.email == identifier, UserProfile.phone == identifier))
            .first()
        )

        if not user:
            # Don't reveal if user exists
            return {"message": "If the account exists, an OTP has been sent"}

        # Generate and send OTP
        from service.otp_service import OTPService
        from schemas.otp import OTPSendRequest
        from schemas.otp import OTPType

        otp_service = OTPService(self.db)
        request = OTPSendRequest(
            email=user.email if otp_type == "EMAIL" else None,
            phone=user.profile.phone
            if otp_type == "WHATSAPP" and user.profile
            else None,
            otp_type=OTPType.EMAIL if otp_type == "EMAIL" else OTPType.WHATSAPP,
            purpose="password_reset",
        )

        result = otp_service.send_otp(request)
        return result

    def reset_password_with_otp(
        self, identifier: str, otp_code: str, new_password: str, otp_type: str = "EMAIL"
    ) -> bool:
        """
        Reset password using OTP verification.

        Args:
            identifier: Email or phone number
            otp_code: OTP code received
            new_password: New password to set
            otp_type: "EMAIL" or "WHATSAPP"

        Returns:
            True if password reset successfully
        """
        # Verify OTP
        from service.otp_service import OTPService
        from schemas.otp import OTPVerifyRequest
        from schemas.otp import OTPType

        otp_service = OTPService(self.db)
        request = OTPVerifyRequest(
            email=identifier if otp_type == "EMAIL" else None,
            phone=identifier if otp_type == "WHATSAPP" else None,
            otp_code=otp_code,
            otp_type=OTPType.EMAIL if otp_type == "EMAIL" else OTPType.WHATSAPP,
            purpose="password_reset",
        )

        result = otp_service.verify_otp(request)

        if not result.get("verified"):
            raise ValueError(result.get("message", "OTP verification failed"))

        # Find user by email or phone (phone is in user_profiles)
        from models.user_profile import UserProfile

        user = (
            self.db.query(User)
            .outerjoin(UserProfile, User.id == UserProfile.user_id)
            .filter(or_(User.email == identifier, UserProfile.phone == identifier))
            .first()
        )

        if not user:
            raise ValueError("User not found")

        # Validate new password
        valid, errors = self.validate_password(new_password)
        if not valid:
            raise ValueError("; ".join(errors))

        # Update password
        user.hashed_password = self.get_password_hash(new_password)
        if user.security:
            user.security.failed_login_attempts = 0
            user.security.locked_until = None
        self.db.commit()

        # Logout from all devices
        self.logout_all(user.id)

        logger.info(f"Password reset via OTP for user {user.id}")
        return True

    # ==================== FastAPI Dependency ====================

    @staticmethod
    def verify_token_and_get_user(token: str, db: Session) -> Optional[User]:
        """
        Verify a token and return the user.

        Args:
            token: JWT access token
            db: Database session

        Returns:
            User if token valid, None otherwise
        """
        try:
            payload = jwt.decode(
                token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
            )

            if payload.get("type") != "access":
                return None

            user_id = int(payload.get("sub"))
            user = db.query(User).filter(User.id == user_id).first()

            return user

        except jwt.ExpiredSignatureError:
            logger.warning("Token has expired")
            return None
        except jwt.InvalidTokenError as e:
            logger.warning(f"Invalid token: {e}")
            return None

    # ==================== Admin Methods ====================

    def get_users(self, skip: int = 0, limit: int = 100) -> List[User]:
        """Get all users (admin only)."""
        return self.db.query(User).offset(skip).limit(limit).all()

    def get_user_by_id(self, user_id: int) -> Optional[User]:
        """Get a user by ID."""
        return self.db.query(User).filter(User.id == user_id).first()

    def update_user_role(self, user_id: int, new_role: UserRole) -> User:
        """Update a user's role (admin only).
        
        SECURITY: Invalidates all existing tokens when role changes
        to prevent privilege escalation with old tokens.
        """
        user = self.db.query(User).filter(User.id == user_id).first()

        if not user:
            raise ValueError("User not found")

        old_role = user.role
        user.role = new_role
        self.db.commit()
        self.db.refresh(user)

        # SECURITY: Logout from all devices to invalidate old tokens
        # This prevents privilege escalation with old JWT tokens
        self.logout_all(user_id)
        
        logger.info(f"User {user_id} role updated from {old_role} to {new_role}. All sessions invalidated.")
        return user

    def deactivate_user(self, user_id: int) -> bool:
        """Deactivate a user account (admin only)."""
        user = self.db.query(User).filter(User.id == user_id).first()

        if not user:
            raise ValueError("User not found")

        user.is_active = False
        self.db.commit()

        # Logout from all devices
        self.logout_all(user_id)

        logger.info(f"User {user_id} deactivated")
        return True

    def activate_user(self, user_id: int) -> bool:
        """Activate a user account (admin only)."""
        user = self.db.query(User).filter(User.id == user_id).first()

        if not user:
            raise ValueError("User not found")

        user.is_active = True
        self.db.commit()

        logger.info(f"User {user_id} activated")
        return True
