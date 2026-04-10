"""
Core Service Configuration for Aarya Clothing.

This module extends the shared BaseSettings with Core service-specific settings
for authentication, OTP, email, and SMS integration.
"""

from typing import Optional

# Import from shared package (PYTHONPATH=/app in Docker, or parent dir in local dev)
from shared.base_config import BaseSettings as SharedBaseSettings, get_settings_cached


class Settings(SharedBaseSettings):
    """
    Core Service settings loaded from environment variables.
    
    Inherits common settings from SharedBaseSettings and adds Core-specific settings.
    """
    
    # Override service name
    SERVICE_NAME: str = "aarya-core"
    
    # ==================== Session Settings ====================
    SESSION_EXPIRE_MINUTES: int = 1440  # 24 hours
    
    # ==================== Password Policy ====================
    PASSWORD_MIN_LENGTH: int = 8
    PASSWORD_REQUIRE_UPPERCASE: bool = True
    PASSWORD_REQUIRE_LOWERCASE: bool = True
    PASSWORD_REQUIRE_NUMBER: bool = True
    PASSWORD_REQUIRE_SPECIAL: bool = False
    
    # ==================== Rate Limiting ====================
    LOGIN_RATE_LIMIT: int = 5  # attempts per window
    LOGIN_RATE_WINDOW: int = 300  # seconds (5 minutes)
    
    # ==================== Account Security ====================
    MAX_LOGIN_ATTEMPTS: int = 5
    ACCOUNT_LOCKOUT_MINUTES: int = 30
    
    # ==================== OTP Settings ====================
    OTP_CODE_LENGTH: int = 6
    OTP_EXPIRY_MINUTES: int = 10
    OTP_MAX_ATTEMPTS: int = 3
    OTP_RESEND_COOLDOWN_MINUTES: int = 1
    OTP_MAX_RESEND_PER_HOUR: int = 5
    
    # ==================== Email/SMTP Settings ====================
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_TLS: bool = True
    EMAIL_FROM: str = "noreply@aaryaclothings.com"
    EMAIL_FROM_NAME: str = "Aarya Clothings"
    # Async OTP email: queue in Redis + background worker (reduces API latency under load)
    EMAIL_OTP_USE_QUEUE: bool = True
    # SMTP transient failures — retries inside each send (queue worker uses this too)
    SMTP_SEND_MAX_ATTEMPTS: int = 3
    
    # ==================== MSG91 SMS API ====================
    MSG91_AUTH_KEY: Optional[str] = None
    MSG91_TEMPLATE_ID: Optional[str] = None
    MSG91_SENDER_ID: Optional[str] = None

    # ==================== Password Reset Settings ====================
    PASSWORD_RESET_TOKEN_EXPIRE_HOURS: int = 24
    PASSWORD_RESET_RATE_LIMIT: int = 3
    PASSWORD_RESET_RATE_WINDOW: int = 3600  # 1 hour

    @property
    def sms_enabled(self) -> bool:
        """Check if MSG91 SMS integration is enabled."""
        return bool(
            self.MSG91_AUTH_KEY and
            self.MSG91_TEMPLATE_ID and
            self.MSG91_SENDER_ID
        )
    
    @property
    def email_enabled(self) -> bool:
        """Check if email is configured."""
        return bool(self.SMTP_USER and self.SMTP_PASSWORD)

    def _validate_required_settings(self):
        """Validate critical settings."""
        super()._validate_required_settings()
        if len(self.SECRET_KEY) < 32:
            import logging
            logging.getLogger(__name__).warning("SECRET_KEY is too short. Use at least 32 characters for security.")
        if self.SECRET_KEY == "your_secure_key_here":
             logging.getLogger(__name__).warning("Using default insecure SECRET_KEY. Change this in production!")


# Create cached settings instance
settings = get_settings_cached(Settings)


def get_settings() -> Settings:
    """Get cached settings instance."""
    return settings
