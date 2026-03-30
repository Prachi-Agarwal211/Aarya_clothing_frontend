"""Shared authentication middleware for all services."""

from typing import Optional, Dict, Any
from fastapi import HTTPException, status, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timedelta, timezone
import logging
import jwt

# Import standardized token validator
from .token_validator import TokenValidator, TokenValidationError, get_token_validator
# Import centralized role configuration
from .roles import UserRole, has_access, is_admin, is_staff, is_super_admin, get_redirect_for_role

logger = logging.getLogger(__name__)

# HTTP Bearer token scheme
security = HTTPBearer(auto_error=False)


class AuthMiddleware:
    """Shared authentication middleware for JWT token validation."""

    def __init__(self, secret_key: str, algorithm: str = "HS256", redis_client=None):
        self.secret_key = secret_key
        self.algorithm = algorithm
        self.redis_client = redis_client
        # Initialize standardized token validator
        self.token_validator = TokenValidator(secret_key, algorithm, redis_client)

    def decode_token(
        self, token: str, expected_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """Decode and validate JWT token using standardized validator."""
        try:
            return self.token_validator.validate_token(
                token, expected_type=expected_type
            )
        except TokenValidationError as e:
            logger.warning(f"Token validation error: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=str(e),
                headers={"WWW-Authenticate": "Bearer"},
            )
        except Exception as e:
            logger.error(f"Unexpected error during token decode: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication failed",
                headers={"WWW-Authenticate": "Bearer"},
            )

    def validate_token(
        self,
        credentials: Optional[HTTPAuthorizationCredentials],
        expected_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Validate JWT token from credentials."""
        if not credentials:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated",
                headers={"WWW-Authenticate": "Bearer"},
            )

        token = credentials.credentials
        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="No token provided",
                headers={"WWW-Authenticate": "Bearer"},
            )

        return self.decode_token(token, expected_type=expected_type)

    def extract_user_info(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Extract user information from JWT payload."""
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
            )

        return {
            "user_id": int(user_id),
            "email": payload.get("email"),
            "username": payload.get("username"),
            "role": payload.get("role", "customer"),
            "is_active": payload.get("is_active", True),
            "exp": payload.get("exp"),
            "iat": payload.get("iat"),
        }


# Global auth middleware instance (will be initialized with proper secret key)
auth_middleware: Optional[AuthMiddleware] = None


def initialize_auth_middleware(
    secret_key: str, algorithm: str = "HS256", redis_client=None
):
    """Initialize the global auth middleware."""
    global auth_middleware
    auth_middleware = AuthMiddleware(secret_key, algorithm, redis_client)


def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Dict[str, Any]:
    """Get current authenticated user."""
    if not auth_middleware:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication middleware not initialized",
        )

    # Try to get token from header first, then fallback to cookie
    token = None
    if credentials:
        token = credentials.credentials
    elif "access_token" in request.cookies:
        token = request.cookies.get("access_token")

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = auth_middleware.decode_token(token)
    return auth_middleware.extract_user_info(payload)


def get_current_user_optional(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[Dict[str, Any]]:
    """Get current authenticated user (optional)."""
    if not auth_middleware:
        return None

    token = None
    if credentials:
        token = credentials.credentials
    elif "access_token" in request.cookies:
        token = request.cookies.get("access_token")

    if not token:
        return None

    try:
        payload = auth_middleware.decode_token(token)
        return auth_middleware.extract_user_info(payload)
    except Exception:
        return None


def require_admin(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Require admin role - STRICT admin only (includes super_admin).
    Use this for admin-only endpoints that require full administrative access.
    """
    if not is_admin(current_user.get("role")):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


def require_super_admin(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Require super_admin role - STRICT super admin only.
    Use this for system configuration and AI key management.
    """
    if not is_super_admin(current_user.get("role")):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super Admin access required",
        )
    return current_user


def require_staff(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """Require staff role (includes admin and super_admin)."""
    if not is_staff(current_user.get("role")):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff access required",
        )
    return current_user


def require_customer(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """Require customer role."""
    if current_user.get("role") != UserRole.CUSTOMER.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Customer access required",
        )
    return current_user


def check_user_ownership(current_user: Dict[str, Any], resource_user_id: int) -> bool:
    """Check if current user owns the resource."""
    # Admin and staff can access any resource
    if is_staff(current_user.get("role")):
        return True

    # Users can only access their own resources
    return current_user.get("user_id") == resource_user_id


def require_ownership(resource_user_id: int):
    """Dependency to require resource ownership."""

    def dependency(current_user: Dict[str, Any] = Depends(get_current_user)):
        if not check_user_ownership(current_user, resource_user_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You don't own this resource",
            )
        return current_user

    return dependency


class TokenManager:
    """
    Utility class for JWT token management.
    
    Provides basic token creation and verification.
    Note: Token rotation is NOT implemented - tokens are managed by auth_service.py
    """

    def __init__(self, secret_key: str, algorithm: str = "HS256", redis_client=None):
        self.secret_key = secret_key
        self.algorithm = algorithm
        self.redis_client = redis_client

    def create_access_token(
        self, data: Dict[str, Any], expires_delta: Optional[timedelta] = None
    ) -> str:
        """Create JWT access token."""
        to_encode = data.copy()
        now = datetime.now(timezone.utc)

        if expires_delta:
            expire = now + expires_delta
        else:
            expire = now + timedelta(minutes=30)  # Default 30 minutes

        to_encode.update({"exp": expire, "iat": now})
        return jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)

    def create_refresh_token(
        self, data: Dict[str, Any], expires_delta: Optional[timedelta] = None
    ) -> str:
        """Create JWT refresh token."""
        to_encode = data.copy()
        now = datetime.now(timezone.utc)

        if expires_delta:
            expire = now + expires_delta
        else:
            expire = now + timedelta(days=7)  # Default 7 days

        to_encode.update({"exp": expire, "iat": now})
        return jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)

    def verify_token(self, token: str) -> Dict[str, Any]:
        """Verify and decode JWT token."""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            return payload
        except jwt.ExpiredSignatureError:
            logger.warning("Token has expired")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired",
            )
        except jwt.InvalidTokenError as e:
            logger.warning(f"JWT verification failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
            )
        except Exception as e:
            logger.error(f"Unexpected error during token verification: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token verification failed",
            )


# Global token manager instance (will be initialized with proper secret key)
token_manager: Optional[TokenManager] = None


def initialize_token_manager(secret_key: str, algorithm: str = "HS256"):
    """Initialize the global token manager."""
    global token_manager
    token_manager = TokenManager(secret_key, algorithm)


def get_token_manager() -> TokenManager:
    """Get the global token manager."""
    if not token_manager:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Token manager not initialized",
        )
    return token_manager
