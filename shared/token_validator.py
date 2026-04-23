"""Standardized token validation across all services."""

import jwt
import logging
from typing import Optional, Dict, Any
from datetime import datetime, timezone
from fastapi import HTTPException, status

logger = logging.getLogger(__name__)


class TokenValidationError(Exception):
    """Custom exception for token validation errors."""

    pass


class TokenValidator:
    """
    Standardized JWT token validation with blacklist checking.

    This class provides consistent token validation across all services,
    including blacklist checking, expiration validation, and type verification.
    """

    def __init__(self, secret_key: str, algorithm: str = "HS256", redis_client=None):
        """
        Initialize token validator.

        Args:
            secret_key: JWT secret key
            algorithm: JWT algorithm
            redis_client: Redis client for blacklist checking (optional)
        """
        self.secret_key = secret_key
        self.algorithm = algorithm
        self.redis_client = redis_client

    def validate_token(
        self,
        token: str,
        expected_type: Optional[str] = None,
        check_blacklist: bool = True,
    ) -> Dict[str, Any]:
        """
        Validate JWT token with comprehensive checks.

        Args:
            token: JWT token string
            expected_type: Expected token type (access/refresh)
            check_blacklist: Whether to check token blacklist

        Returns:
            Decoded token payload

        Raises:
            TokenValidationError: If token is invalid
        """
        try:
            # Decode token
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])

            # Check token type if specified
            if expected_type and payload.get("type") != expected_type:
                raise TokenValidationError(
                    f"Invalid token type. Expected '{expected_type}', got '{payload.get('type')}'"
                )

            # Check blacklist if enabled and Redis client available
            if check_blacklist and self.redis_client:
                if self._is_token_blacklisted(token, payload):
                    raise TokenValidationError("Token is blacklisted")

            # Validate required fields
            if "sub" not in payload:
                raise TokenValidationError("Token missing subject (sub) claim")

            if "exp" not in payload:
                raise TokenValidationError("Token missing expiration (exp) claim")

            # NEW: Check logout_all and password_changed markers in Redis
            if self.redis_client:
                user_id = payload.get("sub")
                iat = payload.get("iat")
                if user_id and iat is not None:
                    # Check global logout
                    logout_all_ts = self.redis_client.get_cache(f"logout_all:{user_id}")
                    if logout_all_ts and int(iat) <= int(logout_all_ts):
                        raise TokenValidationError("Session has been invalidated")
                    
                    # Check password change invalidation
                    pwd_changed_ts = self.redis_client.get_cache(f"pwd_changed:{user_id}")
                    if pwd_changed_ts and int(iat) <= int(pwd_changed_ts):
                        raise TokenValidationError("Password was changed. Please login again.")

            # Check expiration (JWT decode already does this, but double-check)
            exp_timestamp = payload["exp"]
            if datetime.now(timezone.utc).timestamp() > exp_timestamp:
                raise TokenValidationError("Token has expired")

            return payload

        except jwt.ExpiredSignatureError:
            raise TokenValidationError("Token has expired")
        except jwt.InvalidTokenError as e:
            raise TokenValidationError(f"Invalid token: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error validating token: {str(e)}")
            raise TokenValidationError(f"Token validation failed: {str(e)}")

    def _is_token_blacklisted(self, token: str, payload: Optional[Dict[str, Any]] = None) -> bool:
        """
        Check if token is blacklisted.

        Args:
            token: JWT token string

        Returns:
            True if token is blacklisted, False otherwise

        Availability: Fails open - if Redis is unavailable, skip blacklist check
        to avoid locking out all users during Redis outages.
        """
        if not self.redis_client:
            logger.warning("Redis client not available - failing open, skipping blacklist check")
            return False

        try:
            # Legacy/global blacklist key.
            if self.redis_client.client.exists(f"blacklist:{token}") > 0:
                return True

            # Backward-compatible refresh-token revocation key used by AuthService.logout.
            if self.redis_client.client.exists(f"revoked_refresh:{token[-32:]}") > 0:
                return True

            # Logout-all marker keyed per user.
            if payload and payload.get("type") == "refresh":
                user_id = payload.get("sub")
                issued_at = payload.get("iat")
                if user_id and issued_at is not None:
                    logout_all_ts = self.redis_client.get_cache(f"logout_all:{user_id}")
                    if logout_all_ts and int(issued_at) <= int(logout_all_ts):
                        return True

            return False
        except Exception as e:
            logger.error(f"Error checking token blacklist: {str(e)} - failing open, allowing token")
            # FAIL OPEN: if we can't reach Redis, allow the token through
            return False

    def get_user_id(self, token: str, expected_type: Optional[str] = None) -> int:
        """
        Extract user ID from token.

        Args:
            token: JWT token string
            expected_type: Expected token type (access/refresh)

        Returns:
            User ID

        Raises:
            TokenValidationError: If token is invalid
            ValueError: If user ID cannot be converted to int
        """
        payload = self.validate_token(token, expected_type=expected_type)

        try:
            return int(payload.get("sub"))
        except (ValueError, TypeError) as e:
            raise ValueError(f"Invalid user ID in token: {e}")

    def get_token_info(self, token: str) -> Dict[str, Any]:
        """
        Get comprehensive token information.

        Args:
            token: JWT token string

        Returns:
            Dictionary with token information
        """
        try:
            payload = self.validate_token(token, check_blacklist=False)

            return {
                "user_id": payload.get("sub"),
                "username": payload.get("username"),
                "email": payload.get("email"),
                "role": payload.get("role"),
                "token_type": payload.get("type"),
                "issued_at": payload.get("iat"),
                "expires_at": payload.get("exp"),
                "is_blacklisted": self._is_token_blacklisted(token)
                if self.redis_client
                else None,
            }
        except TokenValidationError as e:
            return {"error": str(e), "valid": False}


# Global token validator instance (will be initialized with config)
_token_validator: Optional[TokenValidator] = None


def init_token_validator(secret_key: str, algorithm: str = "HS256", redis_client=None):
    """
    Initialize global token validator.

    Args:
        secret_key: JWT secret key
        algorithm: JWT algorithm
        redis_client: Redis client for blacklist checking
    """
    global _token_validator
    _token_validator = TokenValidator(secret_key, algorithm, redis_client)
    logger.info("Token validator initialized")


def get_token_validator() -> TokenValidator:
    """
    Get global token validator instance.

    Returns:
        TokenValidator instance

    Raises:
        RuntimeError: If token validator not initialized
    """
    if _token_validator is None:
        raise RuntimeError(
            "Token validator not initialized. Call init_token_validator() first."
        )
    return _token_validator


def validate_token(token: str, expected_type: Optional[str] = None) -> Dict[str, Any]:
    """
    Convenience function to validate token using global validator.

    Args:
        token: JWT token string
        expected_type: Expected token type (access/refresh)

    Returns:
        Decoded token payload
    """
    validator = get_token_validator()
    return validator.validate_token(token, expected_type=expected_type)


def get_user_id_from_token(token: str, expected_type: Optional[str] = None) -> int:
    """
    Convenience function to get user ID from token.

    Args:
        token: JWT token string
        expected_type: Expected token type (access/refresh)

    Returns:
        User ID
    """
    validator = get_token_validator()
    return validator.get_user_id(token, expected_type=expected_type)
