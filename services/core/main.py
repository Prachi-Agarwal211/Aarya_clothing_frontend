"""
Core Platform Service - Aarya Clothing
User Management, Authentication, and Session Services

This service handles:
- User registration and management
- Authentication (JWT + Refresh Tokens)
- Cookie-based sessions (24-hour login)
- OTP verification (Email/SMS)
- Session management
- Profile management
"""
import re
import asyncio
import logging
import ipaddress
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from fastapi import FastAPI, Depends, HTTPException, status, Request, BackgroundTasks, Response
from fastapi.security import OAuth2PasswordBearer
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import or_, text
from typing import Optional

logger = logging.getLogger(__name__)

from core.config import settings
from core.redis_client import redis_client
from database.database import get_db, init_db
from models import User, UserRole, UserSecurity, EmailVerification
from schemas.auth import (
    UserCreate, UserResponse, UserProfileUpdate,
    Token, LoginRequest, LoginResponse,
    TokenRefresh, ChangePasswordRequest,
    ForgotPasswordRequest, ResetPasswordWithOtpRequest,
    VerifyResetOtpRequest, VerifyResetOtpResponse
)
from schemas.otp import OTPSendRequest, OTPVerifyRequest, OTPType, VerifyRegistrationOTPBody
from service.auth_service import AuthService
from service.email_service import email_service
from middleware.auth_middleware import init_auth, get_current_user, get_current_user_optional
from middleware.csrf_middleware import CSRFMiddleware
from shared.request_id_middleware import RequestIDMiddleware
from shared.error_responses import register_error_handlers
from shared.time_utils import now_ist


# ==================== Lifespan ====================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    init_db()
    
    # Initialize auth middleware
    init_auth()

    otp_email_worker: asyncio.Task | None = None

    # Verify Redis connection
    if redis_client.ping():
        logger.info("✓ Redis connected")
        if settings.EMAIL_OTP_USE_QUEUE:
            from service.email_queue import run_otp_email_worker

            otp_email_worker = asyncio.create_task(run_otp_email_worker())
            logger.info("✓ OTP email queue worker started")
    else:
        logger.error("✗ Redis connection failed")

    yield

    # Shutdown
    if otp_email_worker is not None:
        otp_email_worker.cancel()
        try:
            await otp_email_worker
        except asyncio.CancelledError:
            pass
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

# Prometheus metrics — /metrics endpoint for scraping
try:
    from prometheus_fastapi_instrumentator import Instrumentator
    Instrumentator().instrument(app).expose(app, endpoint="/metrics")
except Exception:
    pass  # Graceful degradation if prometheus lib is missing

# Request ID
app.add_middleware(RequestIDMiddleware)

# HSTS (Strict-Transport-Security)
@app.middleware("http")
async def add_hsts_header(request: Request, call_next):
    response = await call_next(request)
    if not settings.is_development:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
    return response

# CSRF Protection
app.add_middleware(CSRFMiddleware)

# Standardized error handlers
register_error_handlers(app)

# Filter out health checks from logs to reduce noise
class HealthCheckFilter(logging.Filter):
    def filter(self, record):
        return "GET /health" not in record.getMessage()

logging.getLogger("uvicorn.access").addFilter(HealthCheckFilter())

# Service-to-service: Commerce triggers transactional email via Core SMTP
from api_internal_notify import router as internal_notify_router

app.include_router(internal_notify_router, prefix="/api/v1")


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

def _cookie_scope_for_request(request: Optional[Request] = None) -> tuple[Optional[str], bool]:
    """Resolve cookie domain/secure flags for prod domains vs local hosts."""
    env = getattr(settings, "ENVIRONMENT", "").lower() if hasattr(settings, "ENVIRONMENT") else ""
    is_prod = "production" in env or "prod" in env or env == "prod"

    host = ""
    forwarded_host = ""
    scheme = ""
    forwarded_proto = ""
    if request is not None:
        try:
            host = (request.url.hostname or "").lower()
        except Exception:
            host = ""
        forwarded_host = (request.headers.get("x-forwarded-host") or "").lower()
        scheme = (request.url.scheme or "").lower()
        forwarded_proto = (request.headers.get("x-forwarded-proto") or "").lower()

    effective_host = (forwarded_host.split(",")[0].strip() or host).lower()
    is_local = effective_host in {"localhost", "127.0.0.1", "::1"} or effective_host.endswith(".local")
    if not effective_host and request is not None and request.headers.get("host"):
        host_header = request.headers.get("host", "").split(":")[0].lower()
        is_local = host_header in {"localhost", "127.0.0.1", "::1"} or host_header.endswith(".local")

    effective_scheme = (forwarded_proto.split(",")[0].strip() or scheme).lower()
    is_https = effective_scheme == "https"

    if is_prod and not is_local:
        return ".aaryaclothing.in", True

    # Local/dev hosts: avoid domain scoping and avoid Secure cookie on plain HTTP.
    return None, bool(settings.COOKIE_SECURE and is_https)


def set_auth_cookies(
    response: Response,
    auth_data: dict,
    remember_me: bool = False,
    request: Optional[Request] = None,
):
    """Set authentication cookies on response.
    
    FIX: Added domain parameter for production to support both www and non-www domains.
    Cookies set with domain=".aaryaclothing.in" will be sent to both:
    - aaryaclothing.in
    - www.aaryaclothing.in
    """
    tokens = auth_data["tokens"]
    session_id = auth_data.get("session_id")

    access_max_age = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60

    # Persistent refresh: 90 days by default, 365 days when remember_me=True
    # — Amazon/Flipkart-style "stay signed in" behaviour. The actual cap is
    # configured in shared.base_config so we don't hardcode it here.
    refresh_days = (
        settings.REFRESH_TOKEN_DAYS_REMEMBER
        if remember_me
        else settings.REFRESH_TOKEN_DAYS_DEFAULT
    )
    refresh_max_age = refresh_days * 24 * 60 * 60

    # Session cookie tracks the refresh window so it doesn't drop early.
    session_max_age = refresh_max_age

    cookie_domain, cookie_secure = _cookie_scope_for_request(request)

    # Set cookies
    response.set_cookie(
        key="access_token",
        value=tokens["access_token"],
        httponly=settings.COOKIE_HTTPONLY,
        secure=cookie_secure,
        samesite=settings.COOKIE_SAMESITE,
        max_age=access_max_age,
        path="/",
        domain=cookie_domain  # FIX: Added for cross-subdomain session support
    )

    response.set_cookie(
        key="refresh_token",
        value=tokens["refresh_token"],
        httponly=settings.COOKIE_HTTPONLY,
        secure=cookie_secure,
        samesite=settings.COOKIE_SAMESITE,
        max_age=refresh_max_age,
        path="/",
        domain=cookie_domain  # FIX: Added for cross-subdomain session support
    )

    response.set_cookie(
        key="session_id",
        value=session_id,
        httponly=settings.COOKIE_HTTPONLY,
        secure=cookie_secure,
        samesite=settings.COOKIE_SAMESITE,
        max_age=session_max_age,
        path="/",
        domain=cookie_domain  # FIX: Added for cross-subdomain session support
    )


def clear_auth_cookies(response: Response, request: Request):
    """Clear all authentication cookies from all possible domains."""
    cookie_domain, _ = _cookie_scope_for_request(request)

    # 1. Clear with currently detected domain
    response.delete_cookie("access_token", path="/", domain=cookie_domain)
    response.delete_cookie("refresh_token", path="/", domain=cookie_domain)
    response.delete_cookie("session_id", path="/", domain=cookie_domain)
    
    # 2. Aggressively clear with common production domains just in case
    # This prevents users from getting stuck if environment flags are misaligned
    if cookie_domain != ".aaryaclothing.in":
        response.delete_cookie("access_token", path="/", domain=".aaryaclothing.in")
        response.delete_cookie("refresh_token", path="/", domain=".aaryaclothing.in")
        response.delete_cookie("session_id", path="/", domain=".aaryaclothing.in")
    
    # 3. Clear without domain (host-only cookies)
    if cookie_domain is not None:
        response.delete_cookie("access_token", path="/", domain=None)
        response.delete_cookie("refresh_token", path="/", domain=None)
        response.delete_cookie("session_id", path="/", domain=None)


# ==================== Email Helper ====================

def send_verification_email(email: str, token: str):
    """Send verification email helper (backward compatibility only)."""
    # Construct verification URL - use frontend URL from settings or default to production
    # NOTE: New registrations use OTP, not email links. This is kept for existing unverified users.
    frontend_url = getattr(settings, 'FRONTEND_URL', 'https://aaryaclothing.in')
    verification_url = f"{frontend_url}/auth/verify-email?token={token}"
    email_service.send_email_verification_link(email, verification_url)


# ==================== Health Check ====================

@app.get("/api/v1/health", tags=["Health"])
async def health():
    return {
        "status": "healthy",
        "service": "core",
        "version": "1.0.0",
        "timestamp": now_ist().isoformat(),
    }

@app.get("/health", tags=["Health"])
async def root_health():
    return {
        "status": "healthy",
        "service": "core",
        "version": "1.0.0",
        "timestamp": now_ist().isoformat(),
    }

@app.get("/api/v1/auth/health", tags=["Health"])
async def health_check(db: Session = Depends(get_db)):
    """Health check endpoint."""
    from service.email_queue import otp_email_queue_length

    redis_status = "healthy" if redis_client.ping() else "unhealthy"
    db_status = "healthy"
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        db_status = "unhealthy"

    q_len = otp_email_queue_length()

    return {
        "status": "healthy" if db_status == "healthy" else "degraded",
        "service": "core-platform",
        "version": "1.0.0",
        "timestamp": now_ist().isoformat(),
        "dependencies": {
            "redis": redis_status,
            "database": db_status
        },
        "otp_email_queue_length": q_len,
        "email_otp_queue_enabled": settings.EMAIL_OTP_USE_QUEUE,
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
    """Register endpoint with per-customer rate limiting (email/phone, not IP)."""
    if not _should_bypass_local_rate_limit(http_request):
        try:
            # Rate limit per customer identifier, NOT per-IP.
            # Multiple users behind NAT/mobile networks share one IP —
            # blocking by IP blocks ALL legitimate users on that network.
            customer_id = (user_data.email or user_data.phone or 'unknown').lower().strip()
            limit_key = f'rate_limit:register:{customer_id}'
            count = redis_client.get_cache(limit_key) or 0
            if int(count) >= 5:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail='Too many registration attempts for this account. Please check your email for the OTP or try again in 1 hour.'
                )
            redis_client.set_cache(limit_key, int(count) + 1, ttl=3600)
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f'Rate limit error on register (skipping): {e}')
    auth_service = AuthService(db)
    try:
        result = auth_service.create_user(user_data)
        
        user_response_data = result.get('user')
        if not user_response_data:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="User creation failed to return user data.")

        # AuthService already creates the registration OTP via OTPService.create_verification_token.
        # Do not call legacy OTPService.send_otp path here (that API no longer exists).
        message = result.get(
            "message",
            "Account created. Please verify your email/phone to complete registration.",
        )

        return {
            "message": message,
            "user": user_response_data,
            "verification_method": result.get("otp_method", user_data.verification_method),
            "otp_expires_at": result.get("otp_expires_at"),
            "requires_verification": result.get("requires_verification", True),
        }
    except ValueError as e:
        logger.error(f"[Auth Error] {str(e)}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Registration error: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred.")


@app.post("/api/v1/auth/verify-email",
          status_code=status.HTTP_410_GONE,
          tags=["Authentication"])
async def verify_email(
    token: str,  # kept for backward compatibility with old clients
):
    """
    Deprecated email-link verification endpoint.
    """
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail={
            "error": "endpoint_deprecated",
            "message": (
                "Email-link verification has been removed. "
                "Use OTP verification via /api/v1/auth/verify-otp-registration."
            ),
        },
    )


@app.post("/api/v1/auth/verify-otp-registration",
          status_code=status.HTTP_200_OK,
          tags=["Authentication"])
async def verify_otp_registration(
    body: VerifyRegistrationOTPBody,
    response: Response,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Verify OTP for registration and auto-login user.
    Supports both EMAIL and SMS OTP verification.
    OTP and identifiers must be sent in the JSON body (not query params).
    """
    import logging
    logger = logging.getLogger(__name__)

    email = body.email
    phone = body.phone
    
    # Rate limiting for verification attempts (prevents brute force)
    if not _should_bypass_local_rate_limit(request):
        try:
            # Key by identifier being verified
            identifier = (email or phone or "unknown").lower().strip()
            limit_key = f"rate_limit:verify_otp:{identifier}"
            count = redis_client.get_cache(limit_key) or 0
            
            if int(count) >= 5:
                logger.warning(f"[OTP Verify] Rate limit exceeded for {identifier}")
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many verification attempts. Please wait 5 minutes and try again."
                )
            redis_client.set_cache(limit_key, int(count) + 1, ttl=300) # 5 min window
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"Rate limiting error on verify (skipping): {e}")

    # SMS / WhatsApp + email only (e.g. login recovery): resolve profile phone for OTP key matching
    if body.otp_type in (OTPType.SMS, OTPType.WHATSAPP) and email and not phone:
        u_lookup = db.query(User).filter(User.email == email).first()
        if u_lookup and u_lookup.phone:
            phone = u_lookup.phone

    logger.info(
        f"[OTP Verify] Starting verification - phone: {phone}, email: {email}, "
        f"otp_type: {body.otp_type}"
    )

    # Resolve user by email or phone
    user = db.query(User).filter(
        or_(User.email == email, User.phone == phone)
    ).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found. Please register first."
        )

    from service.otp_service import OTPService

    # Call unified service logic
    auth_service = AuthService(db)
    try:
        result = auth_service.verify_user_registration(
            user_id=user.id,
            otp_code=body.otp_code,
            otp_method=f"otp_{body.otp_type.lower()}"
        )
        
        # Ensure session cookie is set
        set_auth_cookies(response, result, remember_me=False, request=request)
        logger.info(f"[AUTH] Registration verified user_id={user.id} method={body.otp_type}")
        
        return result
    except ValueError as e:
        logger.warning(f"[OTP Verify] Registration verification failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@app.post("/api/v1/auth/send-verification-otp",
          status_code=status.HTTP_200_OK,
          tags=["Authentication"])
async def send_verification_otp(
    body: OTPSendRequest,
    db: Session = Depends(get_db)
):
    """
    Send or resend OTP for registration verification.
    Supports both EMAIL and SMS OTP.
    Request JSON body (email/phone + otp_type); purpose is always registration.
    For SMS, you may pass email instead of phone — server resolves phone from the user profile
    (used when the user returns from login redirect and only has email in the form).
    """
    from service.otp_service import OTPService

    otp_request_in = body
    if (
        body.otp_type == OTPType.SMS
        and getattr(body, "email", None)
        and not getattr(body, "phone", None)
    ):
        user = db.query(User).filter(User.email == body.email).first()
        if not user or not user.phone:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot send SMS code: account or phone number not found.",
            )
        otp_request_in = OTPSendRequest(
            phone=user.phone,
            otp_type=OTPType.SMS,
            purpose="registration",
        )

    otp_service = OTPService(db)
    otp_request = otp_request_in.model_copy(update={"purpose": "registration"})
    try:
        return otp_service.send_otp(otp_request)
    except ValueError as e:
        message = str(e)
        if "Too many OTP requests" in message or "Please wait" in message:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=message,
            )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)


@app.post("/api/v1/auth/resend-verification",
          status_code=status.HTTP_200_OK,
          tags=["Authentication"])
async def resend_verification(
    email: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Resend OTP for verification (email OTP by default)."""
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

    # Find user by email
    user = db.query(User).filter(User.email == email).first()
    
    if not user:
        # Don't reveal if email exists or not
        return {"message": "If the email exists, a verification OTP has been sent"}
    
    if user.email_verified:
        return {"message": "Email is already verified"}
    
    # Get user's signup verification method, default to email OTP
    signup_method = getattr(user, "signup_verification_method", None) or "otp_email"
    
    # Send OTP based on user's original signup method
    from service.otp_service import OTPService
    from schemas.otp import OTPSendRequest, OTPType
    
    otp_service = OTPService(db)
    
    # Map signup method to OTP type
    if signup_method == "otp_sms":
        if not user.phone:
            # Fallback to email if phone not available
            otp_request = OTPSendRequest(
                email=user.email,
                otp_type=OTPType.EMAIL,
                purpose="registration"
            )
        else:
            otp_request = OTPSendRequest(
                phone=user.phone,
                otp_type=OTPType.SMS,
                purpose="registration"
            )
    elif signup_method == "otp_whatsapp":
        if not user.phone:
            # Fallback to email if phone not available
            otp_request = OTPSendRequest(
                email=user.email,
                otp_type=OTPType.EMAIL,
                purpose="registration"
            )
        else:
            otp_request = OTPSendRequest(
                phone=user.phone,
                otp_type=OTPType.WHATSAPP,
                purpose="registration"
            )
    else:
        # Default to email OTP (includes 'link' for legacy users, 'otp_email', or any other value)
        otp_request = OTPSendRequest(
            email=user.email,
            otp_type=OTPType.EMAIL,
            purpose="registration"
        )
    
    # Send OTP in background
    try:
        background_tasks.add_task(otp_service.send_otp, otp_request)
        return {"message": "Verification OTP sent"}
    except ValueError as e:
        logger.warning(f"OTP send failed for resend verification: {e}")
        return {"message": "Verification OTP send requested (may be rate limited)"}


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
    # Per-account rate limiting to prevent brute-force without blocking shared IPs.
    # Keyed on the submitted identifier so attacks on a specific account do not
    # punish other users behind the same NAT.
    if not _should_bypass_local_rate_limit(http_request):
        try:
            account_id = (request.identifier or 'unknown').lower().strip()
            limit_key = f'rate_limit:login:{account_id}'
            count = redis_client.get_cache(limit_key) or 0
            if int(count) >= settings.LOGIN_RATE_LIMIT:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail='Too many login attempts for this account. Please wait 5 minutes and try again.'
                )
            redis_client.set_cache(limit_key, int(count) + 1, ttl=settings.LOGIN_RATE_WINDOW)
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f'Login rate limiting error (skipping): {e}')

    try:
        auth_service = AuthService(db)

        client_ip = http_request.client.host if http_request.client else None
        client_ua = http_request.headers.get("user-agent")

        result = auth_service.login(
            identifier=request.identifier,
            password=request.password,
            remember_me=request.remember_me,
            device_fingerprint=request.device_fingerprint,
            device_name=request.device_name,
            last_ip=client_ip,
            user_agent=client_ua,
        )

        # Ensure session cookie points to a real Redis session row.
        try:
            redis_client.create_session(
                result["session_id"],
                {"user_id": result["user"]["id"]},
                settings.SESSION_EXPIRE_MINUTES,
            )
        except Exception as exc:
            logger.warning(f"Failed to persist login session in Redis: {exc}")

        logger.info(f"[AUTH] Login success user_id={result['user']['id']} ip={client_ip}")

        set_auth_cookies(response, result, request.remember_me, request=http_request)

        return LoginResponse(
            user=UserResponse.model_validate(result["user"]),
            tokens=Token(**result["tokens"]),
            session_id=result["session_id"],
            device_trusted=bool(result.get("device_trusted", False)),
        )
    except ValueError as e:
        msg = str(e)
        if msg in (
            "Account not verified. Please complete verification.",
            "Account temporarily locked. Please try again later.",
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error_code": (
                        "ACCOUNT_NOT_VERIFIED"
                        if "not verified" in msg.lower()
                        else "ACCOUNT_LOCKED"
                    ),
                    "message": msg,
                }
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=msg
        )
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


# ----------------------------------------------------------------------
# OTP login (passwordless / step-up)
# ----------------------------------------------------------------------
# `login-otp-request` sends a one-time code to the user via the chosen
# channel; `login-otp-verify` exchanges the code (plus optional device
# fingerprint) for a session, and remembers the device so the next login
# from the same browser can skip the second factor.

@app.post("/api/v1/auth/login-otp-request",
          status_code=status.HTTP_200_OK,
          tags=["Authentication"])
async def login_otp_request(
    payload: dict,
    http_request: Request,
    db: Session = Depends(get_db),
):
    identifier = (payload.get("identifier") or "").strip()
    if not identifier:
        raise HTTPException(status_code=400, detail="identifier is required")
    otp_type = (payload.get("otp_type") or payload.get("channel") or "EMAIL").upper()

    # Lightweight account-scoped throttle to prevent OTP-spam.
    if not _should_bypass_local_rate_limit(http_request):
        try:
            limit_key = f"rate_limit:login_otp_send:{identifier.lower()}"
            count = redis_client.get_cache(limit_key) or 0
            if int(count) >= 6:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many OTP requests. Please wait a few minutes and try again.",
                )
            redis_client.set_cache(limit_key, int(count) + 1, ttl=600)
        except HTTPException:
            raise
        except Exception as exc:
            logger.warning(f"login_otp_request rate limit error (skipping): {exc}")

    try:
        result = AuthService(db).send_login_otp(identifier=identifier, otp_type=otp_type)
        return {
            "message": result.get("message", "OTP sent"),
            "otp_type": result.get("otp_type", otp_type),
            "expires_in": result.get("expires_in", 600),
        }
    except ValueError as e:
        logger.error(f"[Auth Error] {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/v1/auth/login-otp-verify",
          response_model=LoginResponse,
          tags=["Authentication"])
async def login_otp_verify(
    request: LoginRequest,
    response: Response,
    http_request: Request,
    db: Session = Depends(get_db),
):
    if not request.otp_code:
        raise HTTPException(status_code=400, detail="otp_code is required")
    try:
        client_ip = http_request.client.host if http_request.client else None
        client_ua = http_request.headers.get("user-agent")
        result = AuthService(db).verify_login_otp(
            identifier=request.identifier,
            otp_code=request.otp_code,
            remember_me=request.remember_me,
            device_fingerprint=request.device_fingerprint,
            device_name=request.device_name,
            last_ip=client_ip,
            user_agent=client_ua,
        )
        try:
            redis_client.create_session(
                result["session_id"],
                {"user_id": result["user"]["id"]},
                settings.SESSION_EXPIRE_MINUTES,
            )
        except Exception as exc:
            logger.warning(f"Failed to persist OTP-login session in Redis: {exc}")
        logger.info(f"[AUTH] OTP login success user_id={result['user']['id']} ip={client_ip}")
        set_auth_cookies(response, result, request.remember_me, request=http_request)
        return LoginResponse(
            user=UserResponse.model_validate(result["user"]),
            tokens=Token(**result["tokens"]),
            session_id=result["session_id"],
            device_trusted=bool(result.get("device_trusted", True)),
        )
    except ValueError as e:
        logger.error(f"[Auth Error] {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as exc:  # pragma: no cover — defensive
        logger.error(f"OTP login error: {exc}")
        raise HTTPException(status_code=500, detail="Internal server error")


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

    # FIX: Add domain for cross-subdomain session support
    cookie_domain, cookie_secure = _cookie_scope_for_request(request)

    # Set new access token cookie
    response.set_cookie(
        key="access_token",
        value=tokens["access_token"],
        httponly=settings.COOKIE_HTTPONLY,
        secure=cookie_secure,
        samesite=settings.COOKIE_SAMESITE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
        domain=cookie_domain  # FIX: Added for cross-subdomain session support
    )

    # If a new refresh token was issued (rotation), update the cookie
    if tokens.get("refresh_token"):
        refresh_days = (
            settings.REFRESH_TOKEN_DAYS_REMEMBER
            if bool(payload.get("remember_me", False))
            else settings.REFRESH_TOKEN_DAYS_DEFAULT
        )
        response.set_cookie(
            key="refresh_token",
            value=tokens["refresh_token"],
            httponly=settings.COOKIE_HTTPONLY,
            secure=cookie_secure,
            samesite=settings.COOKIE_SAMESITE,
            max_age=refresh_days * 24 * 60 * 60,
            path="/",
            domain=cookie_domain
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

    # Ensure current server-side session is invalidated immediately.
    if session_id:
        try:
            redis_client.delete_session(session_id)
        except Exception as exc:
            logger.warning(f"Session delete failed during logout: {exc}")
    
    # Clear cookies
    clear_auth_cookies(response, request)
    
    return {"detail": "Successfully logged out"}


@app.post("/api/v1/auth/logout-all", status_code=status.HTTP_200_OK,
          tags=["Authentication"])
async def logout_all(
    response: Response,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: Optional[dict] = Depends(get_current_user_optional),
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
                try:
                    redis_client.delete_user_sessions(user_id)
                except Exception as exc:
                    logger.warning(f"Bulk session delete failed during logout-all: {exc}")
    
    clear_auth_cookies(response, request)
    
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

# NOTE: The link-based password-reset flow (forgot-password / reset-password /
# verify-reset-token) was removed in Phase 1 in favour of the OTP-only flow.
# These endpoints remain for legacy clients but always return HTTP 410 Gone.

_LINK_RESET_GONE_DETAIL = {
    "error": "endpoint_deprecated",
    "message": (
        "Password reset by email link has been removed. "
        "Use POST /api/v1/auth/forgot-password-otp + "
        "/api/v1/auth/verify-reset-otp + /api/v1/auth/reset-password-with-otp."
    ),
}


@app.post(
    "/api/v1/auth/forgot-password",
    status_code=status.HTTP_410_GONE,
    tags=["Authentication", "Deprecated"],
    deprecated=True,
)
async def forgot_password_deprecated():
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail=_LINK_RESET_GONE_DETAIL,
    )


@app.post(
    "/api/v1/auth/reset-password",
    status_code=status.HTTP_410_GONE,
    tags=["Authentication", "Deprecated"],
    deprecated=True,
)
async def reset_password_deprecated():
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail=_LINK_RESET_GONE_DETAIL,
    )


@app.get(
    "/api/v1/auth/verify-reset-token/{token}",
    status_code=status.HTTP_410_GONE,
    tags=["Authentication", "Deprecated"],
    deprecated=True,
)
async def verify_reset_token_deprecated(token: str):
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail=_LINK_RESET_GONE_DETAIL,
    )


@app.post("/api/v1/auth/forgot-password-otp", status_code=status.HTTP_200_OK, tags=["Authentication"])
async def forgot_password_otp(
    request_data: ForgotPasswordRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Request password reset via OTP.
    Supports both Email and SMS OTP.
    identifier: email or phone number
    otp_type: "EMAIL" or "SMS"
    """
    # Rate limiting
    identifier = request_data.identifier  # Use identifier field
    try:
        limit_key = f"rate_limit:pw_reset_otp:{identifier}"
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
    otp_type = getattr(request_data, 'otp_type', 'SMS')
    try:
        result = auth_service.request_password_reset_otp(identifier, otp_type)
        logger.info(f"[AUTH] Password reset OTP requested identifier={identifier[:3]}***")
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="If an account exists, an OTP has been sent.")


@app.post("/api/v1/auth/reset-password-with-otp", status_code=status.HTTP_200_OK, tags=["Authentication"])
async def reset_password_with_otp(
    request_data: ResetPasswordWithOtpRequest,
    db: Session = Depends(get_db)
):
    """
    Reset password using OTP verification.
    identifier: email or phone number
    otp_code: 6-digit OTP code
    new_password: New password
    otp_type: "EMAIL" or "SMS"
    """
    auth_service = AuthService(db)
    try:
        verification_key = (
            f"password_reset_verified:{request_data.otp_type.lower()}:{request_data.identifier}"
        )
        verification_data = redis_client.get_cache(verification_key, namespace="")
        if not verification_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="OTP verification expired or missing. Please verify OTP again.",
            )

        auth_service.reset_password_with_otp(
            request_data.identifier,
            request_data.otp_code,
            request_data.new_password,
            request_data.otp_type
        )
        redis_client.delete_cache(verification_key, namespace="")
        return {"message": "Password reset successfully. You can now login."}
    except ValueError as e:
        logger.error(f"[Auth Error] {str(e)}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@app.post("/api/v1/auth/verify-reset-otp", status_code=status.HTTP_200_OK, tags=["Authentication"])
async def verify_reset_otp(
    request_data: VerifyResetOtpRequest,
    db: Session = Depends(get_db)
):
    """
    Verify OTP for password reset BEFORE redirecting to reset-password page (Fix #1).

    This endpoint verifies the OTP code and returns success with verified identifier and otp_code
    if valid, or returns error if OTP is invalid or expired.

    Frontend should call this endpoint AFTER user enters OTP and BEFORE redirecting to reset-password page.

    SECURITY: After successful verification, stores a timestamp in Redis (5 min TTL) to allow
    password reset without re-verifying OTP (prevents double verification bug).
    """
    from service.otp_service import OTPService
    from schemas.otp import OTPVerifyRequest, OTPType
    from core.redis_client import redis_client

    auth_service = AuthService(db)
    otp_service = OTPService(db)

    # Create OTP verify request
    _ot = (request_data.otp_type or "EMAIL").upper()
    _otp_type_enum = {
        "EMAIL": OTPType.EMAIL,
        "SMS": OTPType.SMS,
        "WHATSAPP": OTPType.WHATSAPP,
    }.get(_ot, OTPType.EMAIL)
    otp_request = OTPVerifyRequest(
        email=request_data.identifier if _ot == "EMAIL" else None,
        phone=request_data.identifier if _ot in ("SMS", "WHATSAPP") else None,
        otp_code=request_data.otp_code,
        otp_type=_otp_type_enum,
        purpose="password_reset"
    )

    # Verify OTP
    result = otp_service.verify_otp(otp_request)

    # Check if verification failed
    if not result.get("verified"):
        # Determine error code for frontend
        error_code = "INVALID"
        message = result.get("message", "Invalid OTP")

        if "expired" in message.lower() or "not found" in message.lower():
            error_code = "EXPIRED"
        elif "too many attempts" in message.lower():
            error_code = "LOCKED"

        return VerifyResetOtpResponse(
            success=False,
            message=message,
            verified=False,
            error_code=error_code
        )

    # OTP verified successfully - store verification timestamp in Redis
    # This allows password reset without re-verifying OTP (prevents double verification bug)
    # TTL: 300 seconds (5 minutes) - user must reset password within this window
    verification_key = f"password_reset_verified:{request_data.otp_type.lower()}:{request_data.identifier}"
    verification_data = {
        "verified_at": now_ist().isoformat(),
        "identifier": request_data.identifier,
        "otp_type": request_data.otp_type
    }
    redis_client.set_cache(
        verification_key,
        verification_data,
        ttl=300,  # 5 minutes
        namespace=""
    )

    # OTP verified successfully - return identifier only (NOT otp_code for security)
    # SECURITY FIX: Don't return otp_code in response (was security risk - exposed in URL)
    # Frontend now stores OTP in sessionStorage instead of passing via URL
    return VerifyResetOtpResponse(
        success=True,
        message="OTP verified successfully",
        verified=True,
        identifier=request_data.identifier
    )


# ==================== User Routes ====================

@app.get("/api/v1/users/me", response_model=UserResponse,
         tags=["Users"])
async def get_current_user_info(
    user_data: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user profile, including profile information."""
    user = db.query(User).filter(User.id == user_data.get("user_id")).first()
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
    user = db.query(User).filter(User.id == current_user.get("user_id")).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    update_data = profile_data.model_dump(exclude_unset=True)
    if "phone" in update_data:
        user.phone = update_data.get("phone")
    if "full_name" in update_data:
        full_name = (update_data.get("full_name") or "").strip()
        user.full_name = full_name or None
        if full_name:
            parts = full_name.split()
            user.first_name = parts[0]
            user.last_name = " ".join(parts[1:]) if len(parts) > 1 else None

    user.updated_at = now_ist()
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
    if current_user.get("user_id") != user_id and current_user.get("role") not in ("admin", "super_admin"):
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


# ==================== Web Vitals ====================

@app.post("/api/vitals", tags=["Performance"])
async def collect_web_vitals(request: Request, db: Session = Depends(get_db)):
    """
    Collect Core Web Vitals metrics from frontend.
    
    Accepts metrics:
    - LCP (Largest Contentful Paint)
    - FID (First Input Delay)
    - CLS (Cumulative Layout Shift)
    - INP (Interaction to Next Paint)
    - TTFB (Time to First Byte)
    - FCP (First Contentful Paint)
    
    Stores in Redis for later analysis.
    """
    try:
        import json
        body = await request.json()
        
        # Store in Redis with timestamp
        vitals_data = {
            **body,
            "received_at": now_ist().isoformat(),
            "ip": request.client.host if request.client else "unknown",
            "user_agent": request.headers.get("user-agent", ""),
        }
        
        # Store in Redis list for later processing
        redis_client.client.lpush("web_vitals:metrics", json.dumps(vitals_data))
        
        # Trim list to last 10000 entries to prevent unbounded growth
        redis_client.client.ltrim("web_vitals:metrics", 0, 9999)
        
        # Log in development
        if settings.ENVIRONMENT == "development":
            logger.info(f"[Web Vitals] {body.get('name')}: {body.get('value')} ({body.get('rating')})")
        
        return {"status": "ok"}
    except Exception as e:
        # Silently ignore errors - vitals collection is non-critical
        logger.debug(f"Web vitals collection error: {e}")
        return {"status": "ok"}


# ==================== Site Config ====================

@app.get("/api/v1/site/config", tags=["Public"])
async def get_site_config(db: Session = Depends(get_db)):
    """
    Public endpoint returning site-wide configuration (logo, video, noise URLs).
    Frontend SiteConfigProvider calls this on every page load.
    Returns R2 public URL base so frontend can construct asset URLs.
    
    Video response format:
    - New format: { desktop: string, mobile: string }
    - Backward compatible: intro_video_url (legacy) is migrated to desktop variant
    """
    cache_key = "public:site:config:v1"
    cached = redis_client.get_cache(cache_key)
    if cached is not None:
        return cached

    from core.config import settings as core_settings
    r2_public = getattr(core_settings, "R2_PUBLIC_URL", "") or ""

    # Get config from database
    rows = db.execute(text("SELECT key, value FROM site_config")).fetchall()
    db_config = {r[0]: r[1] for r in rows}

    # Build video object with desktop and mobile variants
    video_desktop = db_config.get("intro_video_url_desktop")
    video_mobile = db_config.get("intro_video_url_mobile")

    # Fallback chain for backward compatibility
    if not video_desktop:
        # Try legacy intro_video_url
        video_desktop = db_config.get("intro_video_url")
    
    # CROSS-FALLBACK: If desktop is missing, use mobile; if mobile is missing, use desktop
    if not video_desktop:
        video_desktop = video_mobile
    if not video_mobile:
        video_mobile = video_desktop
    
    # Construct full URLs if needed
    if video_desktop and not video_desktop.startswith(('http://', 'https://')):
        video_desktop = f"{r2_public}/{video_desktop}" if r2_public else video_desktop
    if video_mobile and not video_mobile.startswith(('http://', 'https://')):
        video_mobile = f"{r2_public}/{video_mobile}" if r2_public else video_mobile

    # Final hardcoded fallback if BOTH are missing (using mobile URL from DB as baseline if available)
    default_video = "https://pub-7846c786f7154610b57735df47899fa0.r2.dev/Create_a_video_202602141450_ub9p5.mp4"
    
    payload = {
        "logo": db_config.get("logo_url") or (f"{r2_public}/logo.png" if r2_public else "/logo.png"),
        "video": {
            "desktop": video_desktop or default_video,
            "mobile": video_mobile or default_video,
            "enabled": db_config.get("intro_video_enabled", "true").lower() == "true"
        },
        "brand_name": db_config.get("brand_name", "Aarya Clothing"),
        "noise": f"{r2_public}/noise.png" if r2_public else "/noise.png",
        "r2BaseUrl": r2_public,
        # MSG91 fully configured — frontend hides SMS OTP when false
        "smsOtpEnabled": core_settings.sms_enabled,
        "sms_otp_enabled": core_settings.sms_enabled,
        "whatsappEnabled": core_settings.whatsapp_enabled,
    }
    redis_client.set_cache(cache_key, payload, ttl=60)
    return payload


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
