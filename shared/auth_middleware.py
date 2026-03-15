"""Shared authentication middleware for all services."""

from typing import Optional, Dict, Any
from fastapi import HTTPException, status, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timedelta, timezone
import logging
import jwt

# Import standardized token validator - use relative import for package compatibility
from .token_validator import TokenValidator, TokenValidationError, get_token_validator

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
    except HTTPException:
        return None


def require_admin(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Require admin role - STRICT admin only.
    Use this for admin-only endpoints that require full administrative access.
    """
    if current_user.get("role") not in ["admin", "super_admin"]:
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
    if current_user.get("role") != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super Admin access required",
        )
    return current_user


def require_staff(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """Require staff role."""
    if current_user.get("role") not in ["admin", "staff", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff access required",
        )
    return current_user


def require_customer(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """Require customer role."""
    if current_user.get("role") != "customer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Customer access required",
        )
    return current_user


def check_user_ownership(current_user: Dict[str, Any], resource_user_id: int) -> bool:
    """Check if current user owns the resource."""
    # Admin and staff can access any resource
    if current_user.get("role") in ["admin", "staff"]:
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
    Utility class for JWT token management with token rotation support.
    
    Token rotation enhances security by:
    - Generating new refresh tokens on each use
    - Tracking token families to detect reuse attacks
    - Invalidating entire token family if compromise detected
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

        to_encode.update({"exp": expire})
        to_encode.update({"iat": now})

        return jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)

    def create_refresh_token(
        self, data: Dict[str, Any], expires_delta: Optional[timedelta] = None
    ) -> str:
        """
        Create JWT refresh token with rotation support.
        
        Adds:
        - jti: Unique token ID for tracking
        - type: Token type (refresh)
        """
        to_encode = data.copy()
        now = datetime.now(timezone.utc)

        if expires_delta:
            expire = now + expires_delta
        else:
            expire = now + timedelta(days=7)  # Default 7 days

        # Add unique token ID for rotation tracking
        import secrets
        to_encode.update({
            "exp": expire,
            "type": "refresh",
            "jti": secrets.token_urlsafe(32),
            "iat": now
        })

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

    def rotate_refresh_token(
        self,
        old_refresh_token: str,
        user_id: int,
        role: str = "customer"
    ) -> Dict[str, str]:
        """
        Rotate refresh token - invalidate old token and issue new one.
        
        This implements the refresh token rotation pattern:
        1. Validate the old refresh token
        2. Blacklist the old token (prevent reuse)
        3. Generate new access and refresh tokens
        4. Store token family for compromise detection
        
        Args:
            old_refresh_token: The current refresh token to rotate
            user_id: User ID for new token generation
            role: User role for new token generation
            
        Returns:
            Dictionary with new access_token and refresh_token
            
        Security:
            - If a rotated token is reused (replay attack), the entire
              token family is invalidated to prevent account takeover
        """
        import secrets
        
        # Step 1: Validate old token
        try:
            old_payload = self.verify_token(old_refresh_token)
        except HTTPException as e:
            # Token is invalid/expired - could be a replay attack
            logger.warning(f"Attempt to rotate invalid token for user {user_id}")
            raise e
        
        # Verify it's a refresh token
        if old_payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type",
            )
        
        # Step 2: Get old token JTI for blacklisting
        old_jti = old_payload.get("jti")
        
        # Step 3: Blacklist old token
        if self.redis_client:
            try:
                # Get token expiration to set blacklist TTL
                exp_timestamp = old_payload.get("exp", 0)
                now_timestamp = datetime.now(timezone.utc).timestamp()
                ttl = max(0, int(exp_timestamp - now_timestamp))
                
                if ttl > 0:
                    # Store in blacklist with TTL
                    self.redis_client.client.setex(
                        f"blacklist:{old_jti}",
                        ttl,
                        "rotated"
                    )
                    
                    # Track token family for compromise detection
                    token_family = old_payload.get("family") or secrets.token_urlsafe(16)
                    self.redis_client.client.setex(
                        f"token_family:{token_family}",
                        ttl,
                        user_id
                    )
            except Exception as e:
                logger.error(f"Error blacklisting token: {e}")
        
        # Step 4: Generate new tokens
        new_access_token = self.create_access_token(
            data={"sub": str(user_id), "role": role},
            expires_delta=timedelta(minutes=30)
        )
        
        new_refresh_token_data = {
            "sub": str(user_id),
            "role": role,
            "family": old_payload.get("family") or secrets.token_urlsafe(16)
        }
        new_refresh_token = self.create_refresh_token(
            data=new_refresh_token_data,
            expires_delta=timedelta(days=7)
        )
        
        logger.info(f"Token rotated successfully for user {user_id}")
        
        return {
            "access_token": new_access_token,
            "refresh_token": new_refresh_token
        }

    def check_token_blacklist(self, jti: str) -> bool:
        """
        Check if a token JTI is blacklisted.
        
        Args:
            jti: Token ID to check
            
        Returns:
            True if blacklisted, False otherwise
        """
        if not self.redis_client:
            return False
        
        try:
            return self.redis_client.client.exists(f"blacklist:{jti}") > 0
        except Exception as e:
            logger.error(f"Error checking token blacklist: {e}")
            return False


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
