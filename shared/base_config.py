"""
Base Configuration for Aarya Clothing Microservices

This module provides a shared base configuration class that all services can extend.
It eliminates duplication of common settings across services.

Usage:
    from shared.base_config import BaseSettings, get_settings_cached
    
    class Settings(BaseSettings):
        # Service-specific settings here
        MY_CUSTOM_SETTING: str = "default"
        
    settings = get_settings_cached(Settings)
"""

from pydantic_settings import BaseSettings as PydanticBaseSettings
from pydantic import Field, field_validator
from typing import Any, Optional, List, TypeVar, Type
from functools import lru_cache


T = TypeVar('T', bound='BaseSettings')


class BaseSettings(PydanticBaseSettings):
    """
    Base configuration class with common settings shared across all services.
    
    All microservices should inherit from this class and add their specific settings.
    
    Common settings include:
    - Service info (name, environment, debug)
    - Database configuration
    - Redis configuration
    - Security settings (JWT)
    - CORS settings
    - Logging configuration
    """
    
    # ==================== Service Info ====================
    SERVICE_NAME: str = "aarya-service"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    
    # ==================== Database ====================
    DATABASE_URL: str = "postgresql://postgres:password@localhost/aarya_clothing"
    DATABASE_POOL_SIZE: int = 5
    DATABASE_MAX_OVERFLOW: int = 5
    
    # ==================== Redis ====================
    # One Redis server is shared; each microservice MUST use a distinct REDIS_DB so caches/sessions/queues stay isolated.
    # Convention with docker-compose: core=0, commerce=1, payment=2, admin=3 (set via each service's environment).
    REDIS_URL: str = "redis://localhost:6379"
    REDIS_DB: int = 0
    
    # ==================== Security ====================
    SECRET_KEY: str = Field(
        default=None, 
        description="Must be set in environment variables"
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    # Refresh-token TTL (days). Customers stay logged in like Amazon/Flipkart:
    # 90 days normally, 365 days when "Remember me" is checked. Sliding renewal
    # extends the cookie on every authenticated request.
    REFRESH_TOKEN_DAYS_DEFAULT: int = 90
    REFRESH_TOKEN_DAYS_REMEMBER: int = 365
    # Deprecated - kept for back-compat with code paths still reading it.
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 90 * 24 * 60
    
    # ==================== CORS ====================
    # Include frontend container (6004 -> 3000), production domain, and MCP/browser proxies
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:6004",
        "http://127.0.0.1:6004",
        "http://127.0.0.1:52637",
        "https://aaryaclothing.in",
        "https://www.aaryaclothing.in",
    ]
    
    # ==================== Logging ====================
    LOG_LEVEL: str = "INFO"
    
    # ==================== OTP Settings ====================
    EMAIL_OTP_USE_QUEUE: bool = False

    # ==================== Cookie Settings ====================
    COOKIE_SECURE: bool = False  # Overridden to True in production via env
    COOKIE_HTTPONLY: bool = True
    COOKIE_SAMESITE: str = "lax"

    # ==================== X_API_KEY (Semantic Search / Vector DB) ====================
    X_API_KEY: Optional[str] = None

    # ==================== Internal Service Auth ====================
    # Used by payment service to call commerce internal endpoints (e.g. confirm reservations)
    INTERNAL_SERVICE_SECRET: Optional[str] = None
    
    # ==================== R2 Storage Settings ====================
    R2_ACCOUNT_ID: Optional[str] = None
    R2_ACCESS_KEY_ID: Optional[str] = None
    R2_SECRET_ACCESS_KEY: Optional[str] = None
    R2_BUCKET_NAME: str = "aarya-clothing-images"
    R2_PUBLIC_URL: str = "https://pub-7846c786f7154610b57735df47899fa0.r2.dev"
    R2_REGION: str = "auto"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "ignore"  # Ignore extra env vars not defined in this class

    @field_validator("DEBUG", mode="before")
    @classmethod
    def normalize_debug_flag(cls, value: Any) -> Any:
        """Accept common boolean aliases used by shells and deployment configs."""
        if isinstance(value, bool) or value is None:
            return value

        if isinstance(value, (int, float)):
            return bool(value)

        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"1", "true", "t", "yes", "y", "on", "debug", "dev", "development"}:
                return True
            if normalized in {"0", "false", "f", "no", "n", "off", "release", "prod", "production"}:
                return False

        raise ValueError(
            "DEBUG must be a boolean or one of: true/false/debug/release/prod/development"
        )
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._validate_required_settings()
    
    def _validate_required_settings(self):
        """Validate that required settings are properly configured."""
        import logging as _logging
        _log = _logging.getLogger(__name__)

        if self.SECRET_KEY is None:
            raise ValueError(
                "SECRET_KEY must be set in environment variables. "
                "Generate a secure key using: python -c 'import secrets; print(secrets.token_urlsafe(32))'"
            )

        # Enforce minimum key length (32 chars = 256 bits of entropy)
        if len(self.SECRET_KEY) < 32:
            raise ValueError(
                "SECRET_KEY must be at least 32 characters for adequate security. "
                "Generate one: python -c 'import secrets; print(secrets.token_urlsafe(32))'"
            )

        _INSECURE_DEFAULTS = {
            "dev_secret_key_change_in_production",
            "secret",
            "changeme",
            "password",
            "test",
        }

        # Always block known insecure defaults — not just in production
        if self.SECRET_KEY.lower() in _INSECURE_DEFAULTS:
            if self.is_production:
                raise ValueError(
                    "SECURITY CRITICAL: SECRET_KEY is using an insecure default value. "
                    "Set a unique secure key via environment variable before deploying."
                )
            else:
                _log.warning(
                    "SECURITY WARNING: SECRET_KEY is using an insecure default '%s'. "
                    "Change this before going to production.",
                    self.SECRET_KEY[:8] + "..."
                )

        if not self.DATABASE_URL or "postgresql://" not in self.DATABASE_URL:
            raise ValueError("DATABASE_URL must be a valid postgresql connection string")

        if not self.REDIS_URL or "redis://" not in self.REDIS_URL:
            raise ValueError("REDIS_URL must be a valid redis connection string")
    
    @property
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.ENVIRONMENT == "production"
    
    @property
    def is_development(self) -> bool:
        """Check if running in development environment."""
        return self.ENVIRONMENT == "development"
    
    @property
    def is_testing(self) -> bool:
        """Check if running in testing environment."""
        return self.ENVIRONMENT == "testing"


class DatabaseSettings(PydanticBaseSettings):
    """
    Standalone database settings for services that need database configuration
    without inheriting all base settings.
    """
    DATABASE_URL: str = "postgresql://postgres:password@localhost/aarya_clothing"
    DATABASE_POOL_SIZE: int = 5
    DATABASE_MAX_OVERFLOW: int = 5
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


class RedisSettings(PydanticBaseSettings):
    """
    Standalone Redis settings for services that need Redis configuration
    without inheriting all base settings.
    """
    REDIS_URL: str = "redis://localhost:6379"
    REDIS_DB: int = 0
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


class SecuritySettings(PydanticBaseSettings):
    """
    Standalone security settings for services that need security configuration
    without inheriting all base settings.
    """
    SECRET_KEY: str = Field(default=None, description="Must be set in environment variables")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 1440
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if self.SECRET_KEY is None:
            raise ValueError(
                "SECRET_KEY must be set in environment variables. "
                "Generate a secure key using: python -c 'import secrets; print(secrets.token_urlsafe(32))'"
            )


@lru_cache()
def get_settings_cached(settings_class: Type[T]) -> T:
    """
    Get a cached instance of the settings class.
    
    This function ensures that settings are only loaded once per settings class.
    
    Args:
        settings_class: The settings class to instantiate
        
    Returns:
        A cached instance of the settings class
        
    Usage:
        class MySettings(BaseSettings):
            MY_SETTING: str = "default"
        
        settings = get_settings_cached(MySettings)
    """
    return settings_class()


def get_settings_factory(settings_class: Type[T]) -> callable:
    """
    Create a factory function for getting settings.
    
    This is useful for dependency injection patterns.
    
    Args:
        settings_class: The settings class to create a factory for
        
    Returns:
        A function that returns the cached settings instance
        
    Usage:
        class MySettings(BaseSettings):
            pass
        
        get_my_settings = get_settings_factory(MySettings)
        settings = get_my_settings()
    """
    @lru_cache()
    def _get_settings() -> T:
        return settings_class()
    return _get_settings


# ==================== Service URLs ====================

class ServiceUrls(PydanticBaseSettings):
    """
    Configuration for inter-service communication URLs.
    """
    CORE_SERVICE_URL: str = "http://core:5001"
    COMMERCE_SERVICE_URL: str = "http://commerce:5002"
    ADMIN_SERVICE_URL: str = "http://admin:5004"
    PAYMENT_SERVICE_URL: str = "http://payment:5003"
    
    # Development URLs (for local development)
    CORE_SERVICE_URL_DEV: str = "http://localhost:5001"
    COMMERCE_SERVICE_URL_DEV: str = "http://localhost:5002"
    ADMIN_SERVICE_URL_DEV: str = "http://localhost:5004"
    PAYMENT_SERVICE_URL_DEV: str = "http://localhost:5003"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "ignore"  # Ignore extra env vars not defined in this class
    
    def get_service_url(self, service: str, development: bool = False) -> str:
        """
        Get the URL for a specific service.
        
        Args:
            service: Service name (core, commerce, admin, payment)
            development: Whether to use development URLs
            
        Returns:
            The service URL
        """
        suffix = "_DEV" if development else ""
        attr = f"{service.upper()}_SERVICE_URL{suffix}"
        return getattr(self, attr, "")


# Default service URLs instance
service_urls = ServiceUrls()
