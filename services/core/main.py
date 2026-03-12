"""
Core Platform Service - Aarya Clothing
User Management, Authentication, and Session Services

This service handles:
- User registration and management
- Authentication (JWT + Refresh Tokens)
- Cookie-based sessions (24-hour login)
- OTP verification (Email/WhatsApp)
- Session management
- Profile management
"""
import re
import logging
import ipaddress
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from fastapi import FastAPI, Depends, HTTPException, status, Request, BackgroundTasks, Response
from fastapi.security import OAuth2PasswordBearer
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import or_, text
from sqlalchemy.orm import joinedload
from typing import Optional

logger = logging.getLogger(__name__)

from core.config import settings
from core.redis_client import redis_client
from database.database import get_db, init_db
from models import User, UserRole, UserProfile, UserSecurity, EmailVerification
from schemas.auth import (
    UserCreate, UserResponse, UserProfileUpdate,
    Token, LoginRequest, LoginResponse,
    TokenRefresh, ChangePasswordRequest,
    ForgotPasswordRequest, PasswordResetConfirm
)
from service.auth_service import AuthService
from service.email_service import email_service
from middleware.auth_middleware import init_auth, get_current_user, get_current_user_optional
from shared.request_id_middleware import RequestIDMiddleware
from shared.error_responses import register_error_handlers


# ==================== Lifespan ====================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    init_db()
    
    # Initialize auth middleware
    init_auth()

    # Verify Redis connection
    if redis_client.ping():
        logger.info("✓ Redis connected")
    else:
        logger.error("✗ Redis connection failed")

    yield

    # Shutdown
    logger.info("Core service shutting down")


# ==================== FastAPI App ====================

app = FastAPI(
    title="Aarya Clothing - Core Platform",
    description="User Management, Authentication, Cookie Sessions, OTP Verification",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin", "X-CSRF-Token"],
)

# Request ID
app.add_middleware(RequestIDMiddleware)

# Standardized error handlers
register_error_handlers(app)


LOCAL_TEST_IPS = {"127.0.0.1", "::1", "localhost", "testclient"}


def _get_client_ip(request: Request) -> str:
    """Resolve the best-effort client IP, honoring proxy headers when present."""
    forwarded_for = request.headers.get("x-forwarded-for", "")
    if forwarded_for:
        first_hop = forwarded_for.split(",")[0].strip()
        if first_hop:
            return first_hop
    return request.client.host if request.client else "unknown"


def _should_bypass_local_rate_limit(request: Request) -> bool:
    """
    Keep brute-force protection for deployed traffic while allowing local dev/test
    automation from loopback addresses to exercise auth flows repeatedly.
    """
    if not settings.is_development:
        return False

    client_ip = _get_client_ip(request)
    if client_ip in LOCAL_TEST_IPS:
        return True

    try:
        parsed_ip = ipaddress.ip_address(client_ip)
    except ValueError:
        return False

    return parsed_ip.is_loopback or parsed_ip.is_private


# ==================== Cookie Helper ====================

def set_auth_cookies(response: Response, auth_data: dict, remember_me: bool = False):
    """Set authentication cookies on response."""
    tokens = auth_data["tokens"]
    session_id = auth_data.get("session_id")
    
    # Access token cookie (30 minutes)
    access_max_age = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    
    # Refresh token cookie (24 hours if remember_me)
    refresh_max_age = (
        settings.REFRESH_TOKEN_EXPIRE_MINUTES * 60 
        if remember_me 
        else settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )
    
    # Session cookie (24 hours)
    session_max_age = settings.SESSION_EXPIRE_MINUTES * 60
    
    # Set cookies
    response.set_cookie(
        key="access_token",
        value=tokens["access_token"],
        httponly=settings.COOKIE_HTTPONLY,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=access_max_age,
        path="/"
    )
    
    response.set_cookie(
        key="refresh_token",
        value=tokens["refresh_token"],
        httponly=settings.COOKIE_HTTPONLY,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=refresh_max_age,
        path="/api/v1/auth/refresh"
    )
    
    response.set_cookie(
        key="session_id",
        value=session_id,
        httponly=settings.COOKIE_HTTPONLY,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=session_max_age,
        path="/"
    )


def clear_auth_cookies(response: Response):
    """Clear all authentication cookies."""
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/api/v1/auth/refresh")
    response.delete_cookie("session_id", path="/")


# ==================== Email Helper ====================

def send_verification_email(email: str, token: str):
    """Send verification email helper."""
    # Construct verification URL - use frontend URL from settings or default
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:6004')
    verification_url = f"{frontend_url}/auth/verify-email?token={token}"
    email_service.send_email_verification_link(email, verification_url)


# ==================== Health Check ====================

@app.get("/api/v1/health", tags=["Health"])
async def health():
    return {
        "status": "healthy",
        "service": "core",
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

@app.get("/health", tags=["Health"])
async def root_health():
    return {
        "status": "healthy",
        "service": "core",
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

@app.get("/api/v1/auth/health", tags=["Health"])
async def health_check(db: Session = Depends(get_db)):
    """Health check endpoint."""
    redis_status = "healthy" if redis_client.ping() else "unhealthy"
    db_status = "healthy"
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        db_status = "unhealthy"
        
    return {
        "status": "healthy" if db_status == "healthy" else "degraded",
        "service": "core-platform",
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "dependencies": {
            "redis": redis_status,
            "database": db_status
        }
    }


# ==================== Authentication Routes ====================



@app.post("/api/v1/auth/register",
          status_code=status.HTTP_201_CREATED,
          tags=["Authentication"])
async def register(
    user_data: UserCreate,
    background_tasks: BackgroundTasks,
    http_request: Request,
    db: Session = Depends(get_db)
):
    """Register endpoint with IP-based rate limiting."""
    if not _should_bypass_local_rate_limit(http_request):
        try:
            client_ip = _get_client_ip(http_request)
            limit_key = f"rate_limit:register:{client_ip}"
            count = redis_client.get_cache(limit_key) or 0
            if int(count) >= 5:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many registration attempts. Please try again in 1 hour."
                )
            redis_client.set_cache(limit_key, int(count) + 1, ttl=3600)
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"Rate limit error on register (skipping): {e}")
    auth_service = AuthService(db)
    try:
        result = auth_service.create_user(user_data)
        
        user_response_data = result.get('user')
        if not user_response_data:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="User creation failed to return user data.")

        # Route based on verification method
        if user_data.verification_method == "link":
            # Traditional email link verification
            token = auth_service.create_email_verification_token(user_response_data['id'])
            auth_service.save_verification_token(user_response_data['id'], token, "email_verification")
            background_tasks.add_task(send_verification_email, user_response_data['email'], token)
            message = "Account created successfully. Please check your email to verify your account."
        
        elif user_data.verification_method == "otp_email":
            # Email OTP verification
            from service.otp_service import OTPService
            from schemas.otp import OTPSendRequest, OTPType
            otp_service = OTPService(db)
            otp_request = OTPSendRequest(
                email=user_response_data['email'],
                otp_type=OTPType.EMAIL,
                purpose="registration"
            )
            otp_service.send_otp(otp_request)
            message = "Account created successfully. Please check your email for the verification code."
        
        elif user_data.verification_method == "otp_whatsapp":
            # WhatsApp OTP verification
            from service.otp_service import OTPService
            from schemas.otp import OTPSendRequest, OTPType
            otp_service = OTPService(db)
            otp_request = OTPSendRequest(
                phone=user_response_data['profile']['phone'],
                otp_type=OTPType.WHATSAPP,
                purpose="registration"
            )
            otp_service.send_otp(otp_request)
            message = "Account created successfully. Please check WhatsApp for the verification code."

        return {
            "message": message,
            "user": user_response_data,
            "verification_method": user_data.verification_method
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Registration error: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred.")


@app.post("/api/v1/auth/verify-email",
          status_code=status.HTTP_200_OK,
          tags=["Authentication"])
async def verify_email(
    token: str,
    response: Response,
    db: Session = Depends(get_db)
):
    """
    Verify user's email address using verification token.
    
    After verification, user is automatically logged in.
    """
    auth_service = AuthService(db)
    
    user = auth_service.verify_email_token(token)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token"
        )
    
    # Generate tokens for auto-login after verification
    access_token = auth_service.create_access_token(user.id, user.role.value)
    refresh_token = auth_service.create_refresh_token(user.id, user.role.value)
    
    # Create session
    import secrets
    session_id = secrets.token_urlsafe(32)
    try:
        redis_client.create_session(session_id, {"user_id": user.id}, settings.SESSION_EXPIRE_MINUTES)
    except Exception:
        pass  # Redis not available
    
    user_response = UserResponse.model_validate(user)

    auth_data = {
        "user": user_response.model_dump(),
        "tokens": {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        },
        "session_id": session_id
    }

    set_auth_cookies(response, auth_data, remember_me=False)

    return {
        "message": "Email verified successfully",
        "user": user_response,
        "tokens": auth_data["tokens"]
    }


@app.post("/api/v1/auth/verify-otp-registration",
          status_code=status.HTTP_200_OK,
          tags=["Authentication"])
async def verify_otp_registration(
    otp_code: str,
    email: str = None,
    phone: str = None,
    otp_type: str = "EMAIL",
    response: Response = None,
    db: Session = Depends(get_db)
):
    """
    Verify OTP for registration and auto-login user.
    Supports both EMAIL and WHATSAPP OTP verification.
    """
    from service.otp_service import OTPService
    from schemas.otp import OTPVerifyRequest, OTPType
    
    if not email and not phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either email or phone must be provided"
        )
    
    # Verify OTP
    otp_service = OTPService(db)
    otp_request = OTPVerifyRequest(
        email=email if otp_type == "EMAIL" else None,
        phone=phone if otp_type == "WHATSAPP" else None,
        otp_code=otp_code,
        otp_type=OTPType.EMAIL if otp_type == "EMAIL" else OTPType.WHATSAPP,
        purpose="registration"
    )
    
    result = otp_service.verify_otp(otp_request)
    
    if not result.get("verified"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("message", "Invalid OTP")
        )
    
    # Find user by email or phone
    auth_service = AuthService(db)
    if email:
        user = db.query(User).filter(User.email == email).first()
    else:
        from models.user_profile import UserProfile
        user = db.query(User).join(UserProfile).filter(UserProfile.phone == phone).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Mark email as verified
    user.email_verified = True
    db.commit()
    db.refresh(user)
    
    # Generate tokens for auto-login
    access_token = auth_service.create_access_token(user.id, user.role.value)
    refresh_token = auth_service.create_refresh_token(user.id, user.role.value)
    
    # Create session
    import secrets
    session_id = secrets.token_urlsafe(32)
    try:
        redis_client.create_session(session_id, {"user_id": user.id}, settings.SESSION_EXPIRE_MINUTES)
    except Exception:
        pass
    
    user_response = UserResponse.model_validate(user)
    
    auth_data = {
        "user": user_response.model_dump(),
        "tokens": {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        },
        "session_id": session_id
    }
    
    set_auth_cookies(response, auth_data, remember_me=False)
    
    return {
        "message": "Email verified successfully",
        "user": user_response,
        "tokens": auth_data["tokens"]
    }


@app.post("/api/v1/auth/send-verification-otp",
          status_code=status.HTTP_200_OK,
          tags=["Authentication"])
async def send_verification_otp(
    email: str = None,
    phone: str = None,
    otp_type: str = "EMAIL",
    db: Session = Depends(get_db)
):
    """
    Send or resend OTP for registration verification.
    Supports both EMAIL and WHATSAPP OTP.
    """
    if not email and not phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either email or phone must be provided"
        )
    
    from service.otp_service import OTPService
    from schemas.otp import OTPSendRequest, OTPType
    
    otp_service = OTPService(db)
    otp_request = OTPSendRequest(
        email=email if otp_type == "EMAIL" else None,
        phone=phone if otp_type == "WHATSAPP" else None,
        otp_type=OTPType.EMAIL if otp_type == "EMAIL" else OTPType.WHATSAPP,
        purpose="registration"
    )
    
    result = otp_service.send_otp(otp_request)
    return result


@app.post("/api/v1/auth/resend-verification",
          status_code=status.HTTP_200_OK,
          tags=["Authentication"])
async def resend_verification(
    email: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Resend verification email to user."""
    # Rate limiting
    try:
        limit_key = f"rate_limit:resend_verify:{email}"
        count = redis_client.get_cache(limit_key) or 0
        if int(count) >= 3: # Max 3 times per hour
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many resend requests. Please check your spam folder or try again later."
            )
        redis_client.set_cache(limit_key, int(count) + 1, ttl=3600)
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Rate limit error (skipping): {e}")

    auth_service = AuthService(db)
    
    # Find user by email
    user = db.query(User).filter(User.email == email).first()
    
    if not user:
        # Don't reveal if email exists or not
        return {"message": "If the email exists, a verification link has been sent"}
    
    if user.email_verified:
        return {"message": "Email is already verified"}
    
    # Create new verification token
    token = auth_service.create_email_verification_token(user.id)
    auth_service.save_verification_token(user.id, token, "email_verification")
    
    # Send verification email in background
    background_tasks.add_task(send_verification_email, user.email, token)
    
    return {"message": "Verification email sent"}


@app.post("/api/v1/auth/login", response_model=LoginResponse,
          tags=["Authentication"])
async def login(
    request: LoginRequest,
    response: Response,
    http_request: Request,
    db: Session = Depends(get_db)
):
    """
    Login with username/email and password.
    Sets HTTP-Only cookies for 24-hour session.
    """
    # IP-based rate limiting to prevent brute-force across accounts
    if not _should_bypass_local_rate_limit(http_request):
        try:
            client_ip = _get_client_ip(http_request)
            limit_key = f"rate_limit:login:{client_ip}"
            count = redis_client.get_cache(limit_key) or 0
            if int(count) >= settings.LOGIN_RATE_LIMIT:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many login attempts. Please try again later."
                )
            redis_client.set_cache(limit_key, int(count) + 1, ttl=settings.LOGIN_RATE_WINDOW)
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"Login rate limiting error (skipping): {e}")

    try:
        auth_service = AuthService(db)
        
        result = auth_service.login(
            username=request.username,
            password=request.password,
            remember_me=request.remember_me
        )
        
        # Set authentication cookies
        set_auth_cookies(response, result, request.remember_me)
        
        return LoginResponse(
            user=UserResponse.model_validate(result["user"]),
            tokens=Token(**result["tokens"]),
            session_id=result["session_id"]
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@app.post("/api/v1/auth/refresh", response_model=Token,
          tags=["Authentication"])
async def refresh_token(
    response: Response,
    refresh_token: str = None,
    request: Request = None,
    db: Session = Depends(get_db)
):
    """
    Refresh access token using refresh token cookie.
    Automatically extends session.
    """
    # Get refresh token from cookie or body
    if refresh_token is None and request:
        refresh_token = request.cookies.get("refresh_token")
    
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token not found"
        )
    
    auth_service = AuthService(db)
    
    # Explicitly validate token is a refresh token
    payload = auth_service.decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type"
        )
    
    tokens = auth_service.refresh_access_token(refresh_token)
    
    # Set new access token cookie
    response.set_cookie(
        key="access_token",
        value=tokens["access_token"],
        httponly=settings.COOKIE_HTTPONLY,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/"
    )
    
    return Token(**tokens)


@app.post("/api/v1/auth/logout", status_code=status.HTTP_200_OK,
          tags=["Authentication"])
async def logout(
    response: Response,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: Optional[dict] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Logout and clear all authentication cookies."""
    session_id = request.cookies.get("session_id")
    refresh_token = request.cookies.get("refresh_token")
    
    # Get user from session if available
    if session_id:
        session_data = redis_client.get_session(session_id)
        user_id = session_data.get("user_id") if session_data else None
        
        # Security: Verify session belongs to the token user
        if current_user and user_id and str(user_id) != str(current_user.get("user_id")):
            logger.warning(f"Logout session mismatch: user {current_user.get('user_id')} tried to logout session belonging to {user_id}")
            user_id = None # Don't process this session for this user
    else:
        user_id = None
    
    # Revoke tokens
    if user_id and refresh_token:
        auth_service = AuthService(db)
        background_tasks.add_task(auth_service.logout, user_id, refresh_token)
    
    # Clear cookies
    clear_auth_cookies(response)
    
    return {"detail": "Successfully logged out"}


@app.post("/api/v1/auth/logout-all", status_code=status.HTTP_200_OK,
          tags=["Authentication"])
async def logout_all(
    response: Response,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Logout from all devices."""
    session_id = request.cookies.get("session_id")
    
    if session_id:
        session_data = redis_client.get_session(session_id)
        if session_data:
            user_id = session_data.get("user_id")
            if user_id:
                auth_service = AuthService(db)
                background_tasks.add_task(auth_service.logout_all, user_id)
    
    clear_auth_cookies(response)
    
    return {"detail": "Logged out from all devices"}


@app.post("/api/v1/auth/change-password", status_code=status.HTTP_200_OK,
          tags=["Authentication"])
async def change_password(
    password_data: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Change password for authenticated user."""
    auth_service = AuthService(db)
    
    # Get actual User object from database
    user_obj = db.query(User).filter(User.id == current_user.get("user_id")).first()
    if not user_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    success = auth_service.change_password(
        user=user_obj,
        current_password=password_data.current_password,
        new_password=password_data.new_password
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    return {"detail": "Password changed successfully"}


# ==================== Password Reset Routes ====================

@app.post("/api/v1/auth/forgot-password", status_code=status.HTTP_200_OK,
          tags=["Authentication"])
async def forgot_password(
    request_data: ForgotPasswordRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Request password reset email.
    Sends a password reset link to the user's email if it exists.
    """
    # Simple rate limiting check via Redis
    try:
        limit_key = f"rate_limit:pw_reset:{request_data.email}"
        count = redis_client.get_cache(limit_key) or 0
        if int(count) >= settings.PASSWORD_RESET_RATE_LIMIT:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many reset requests. Please try again later."
            )
        redis_client.set_cache(limit_key, int(count) + 1, ttl=settings.PASSWORD_RESET_RATE_WINDOW)
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Rate limiting error (skipping): {e}")

    auth_service = AuthService(db)
    
    # Get frontend URL from referer or use default
    frontend_url = request.headers.get("origin", "http://localhost:3000")
    
    try:
        result = auth_service.request_password_reset(
            email=request_data.email,
            frontend_url=frontend_url
        )
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(e)
        )


@app.post("/api/v1/auth/reset-password", status_code=status.HTTP_200_OK,
          tags=["Authentication"])
async def reset_password(
    request_data: PasswordResetConfirm,
    db: Session = Depends(get_db)
):
    """
    Reset password using token from email.
    """
    auth_service = AuthService(db)
    
    try:
        result = auth_service.reset_password(
            token=request_data.token,
            new_password=request_data.new_password
        )
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@app.get("/api/v1/auth/verify-reset-token/{token}", status_code=status.HTTP_200_OK,
         tags=["Authentication"])
async def verify_reset_token(
    token: str,
    db: Session = Depends(get_db)
):
    """
    Verify if a password reset token is valid.
    """
    auth_service = AuthService(db)
    user = auth_service.verify_reset_token(token)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset token"
        )
    
    return {"valid": True, "email": user.email}




# ==================== User Routes ====================

@app.get("/api/v1/users/me", response_model=UserResponse,
         tags=["Users"])
async def get_current_user_info(
    user_data: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user profile, including profile information."""
    user = db.query(User).options(joinedload(User.profile)).filter(User.id == user_data.get("user_id")).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@app.patch("/api/v1/users/me", response_model=UserResponse,
           tags=["Users"])
async def update_current_user(
    profile_data: UserProfileUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update current user's profile."""
    user = db.query(User).options(joinedload(User.profile)).filter(User.id == current_user.get("user_id")).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if not user.profile:
        user.profile = UserProfile()

    update_data = profile_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user.profile, field, value)

    user.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)

    return user


@app.get("/api/v1/users/{user_id}", response_model=UserResponse,
         tags=["Users"])
async def get_user_by_id(
    user_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user by ID (admin or self only)."""
    if current_user.get("user_id") != user_id and current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this user"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return user


# ==================== Site Config ====================

@app.get("/api/v1/site/config", tags=["Public"])
async def get_site_config(db: Session = Depends(get_db)):
    """
    Public endpoint returning site-wide configuration (logo, video, noise URLs).
    Frontend SiteConfigProvider calls this on every page load.
    Returns R2 public URL base so frontend can construct asset URLs.
    """
    from core.config import settings as core_settings
    r2_public = getattr(core_settings, "R2_PUBLIC_URL", "") or ""
    
    # Get config from database
    rows = db.execute(text("SELECT key, value FROM site_config")).fetchall()
    db_config = {r[0]: r[1] for r in rows}
    
    return {
        "logo": db_config.get("logo_url") or (f"{r2_public}/logo.png" if r2_public else "/logo.png"),
        "video": {
            "intro": db_config.get("intro_video_url") or (f"{r2_public}/Create_a_video_202602141450_ub9p5.mp4" if r2_public else "/Create_a_video_202602141450_ub9p5.mp4"),
            "enabled": db_config.get("intro_video_enabled", "true").lower() == "true"
        },
        "brand_name": db_config.get("brand_name", "Aarya Clothing"),
        "noise": f"{r2_public}/noise.png" if r2_public else "/noise.png",
        "r2BaseUrl": r2_public,
    }


# ==================== Run Server ====================


# ==================== Test Routes ====================
# These endpoints are for testing purposes only and should not be exposed in production.
if settings.ENVIRONMENT == "development":
    @app.get("/api/v1/test/get-verification-token/{email}", tags=["Testing"])
    async def get_verification_token_for_test(email: str, db: Session = Depends(get_db)):
        """
        [TESTING ONLY] Get the latest verification token for a user by email.
        """
        user = db.query(User).filter(User.email == email).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        verification = db.query(EmailVerification).filter(EmailVerification.user_id == user.id).order_by(EmailVerification.created_at.desc()).first()
        if not verification:
            raise HTTPException(status_code=404, detail="No verification token found for user")

        return {"token": verification.token}


# ==================== Run Server ====================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=5001,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower()
    )
