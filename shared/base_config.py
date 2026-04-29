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


T = TypeVar("T", bound="BaseSettings")


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
    # High concurrency settings for 5000+ users:
    # - pool_size: baseline connections (should be ~2x CPU cores)
    # - max_overflow: burst capacity for traffic spikes
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 30

    # ==================== Security ====================
    SECRET_KEY: str = Field(
        default="your_secure_key_here_change_in_production",
        description="JWT signing key. MUST be overridden in production via environment variable.",
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 1440

    # Refresh token "stay logged in" duration
    REFRESH_TOKEN_DAYS_DEFAULT: int = 90  # regular login
    REFRESH_TOKEN_DAYS_REMEMBER: int = 365  # remember_me=True

    # Cookie settings
    COOKIE_SECURE: bool = False  # Set True in production (HTTPS only)
    COOKIE_HTTPONLY: bool = True
    COOKIE_SAMESITE: str = "lax"

    @property
    def is_development(self) -> bool:
        """Check if running in development mode."""
        return self.ENVIRONMENT.lower() in ("development", "dev", "local")

    # ==================== CORS ====================
    ALLOWED_ORIGINS: List[str] = Field(
        default=[
            "http://localhost:6004",
            "http://localhost:6005",
            "http://127.0.0.1:6004",
            "http://127.0.0.1:6005",
            "https://aaryaclothing.in",
            "https://www.aaryaclothing.in",
        ]
    )

    # ==================== Cloudflare R2 ====================
    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_NAME: str = ""
    R2_PUBLIC_URL: str = ""
    R2_REGION: str = "auto"

    # ==================== Redis ====================
    REDIS_URL: str = "redis://localhost:6379"
    REDIS_DB: int = 0

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

    SECRET_KEY: str = Field(
        default=None, description="Must be set in environment variables"
    )
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


class DatabaseSettings(PydanticBaseSettings):
    """
    Standalone database settings for services that need database configuration
    without inheriting all base settings.
    """

    DATABASE_URL: str = "postgresql://postgres:password@localhost/aarya_clothing"
    DATABASE_POOL_SIZE: int = 5
    DATABASE_MAX_OVERFLOW: int = 10

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


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
