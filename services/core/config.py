"""
Core Service Configuration for Aarya Clothing.

This module provides the main settings instance used by all services.
All services import: from core.config import settings
"""

from typing import List
from pydantic import Field
from shared.base_config import BaseSettings, get_settings_cached


class Settings(BaseSettings):
    """
    Core Service settings loaded from environment variables.

    Extends BaseSettings with Core-specific configuration.
    ALL services (core, commerce, payment, admin) import settings from here.
    """

    # Override service name
    SERVICE_NAME: str = "aarya-core"

    # ==================== Session Settings ====================
    SESSION_EXPIRE_MINUTES: int = 1440  # 24 hours

    # ==================== Password Policy ====================
    PASSWORD_MIN_LENGTH: int = 5
    PASSWORD_REQUIRE_UPPERCASE: bool = False
    PASSWORD_REQUIRE_LOWERCASE: bool = False
    PASSWORD_REQUIRE_NUMBER: bool = False
    PASSWORD_REQUIRE_SPECIAL: bool = False

    # ==================== Rate Limiting ====================
    LOGIN_RATE_LIMIT: int = 10  # attempts per window
    LOGIN_RATE_WINDOW: int = 300  # seconds (5 minutes)

    # ==================== Account Security ====================
    MAX_LOGIN_ATTEMPTS: int = 5
    ACCOUNT_LOCKOUT_MINUTES: int = 15

    # ==================== OTP Settings ====================
    OTP_CODE_LENGTH: int = 6
    OTP_EXPIRY_MINUTES: int = 10
    OTP_MAX_ATTEMPTS: int = 5
    OTP_RESEND_COOLDOWN_MINUTES: float = 0.5  # 30 seconds
    OTP_MAX_RESEND_PER_HOUR: int = 8

    # ==================== Email/SMTP Settings ====================
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_TLS: bool = True
    EMAIL_FROM: str = "noreply@aaryaclothings.com"
    EMAIL_FROM_NAME: str = "Aarya Clothings"
    EMAIL_OTP_USE_QUEUE: bool = True
    SMTP_SEND_MAX_ATTEMPTS: int = 3

    # ==================== MSG91 SMS API ====================
    MSG91_AUTH_KEY: str = ""
    MSG91_TEMPLATE_ID: str = ""
    MSG91_SENDER_ID: str = ""
    MSG91_ORDER_FLOW_TEMPLATE_ID: str = ""

    # ==================== Meta WhatsApp Cloud API ====================
    WHATSAPP_ACCESS_TOKEN: str = ""
    WHATSAPP_PHONE_NUMBER_ID: str = ""
    WHATSAPP_WABA_ID: str = ""
    WHATSAPP_API_VERSION: str = "v20.0"

    WHATSAPP_TEMPLATE_OTP: str = "auth_otp"
    WHATSAPP_TEMPLATE_ORDER_CONFIRMED: str = "order_confirmation"
    WHATSAPP_TEMPLATE_ORDER_SHIPPED: str = "order_shipped"
    WHATSAPP_TEMPLATE_ORDER_DELIVERED: str = "order_delivered"

    # ==================== Fast2SMS WhatsApp API ====================
    FAST2SMS_API_KEY: Optional[str] = None
    FAST2SMS_PHONE_NUMBER_ID: Optional[str] = None
    FAST2SMS_TEMPLATE_AUTH_OTP: str = "19572"
    FAST2SMS_TEMPLATE_OTP: str = "19576"
    FAST2SMS_TEMPLATE_UPDATE_CASE: str = "19573"
    FAST2SMS_TEMPLATE_OFFER: str = "19574"
    FAST2SMS_TEMPLATE_PAYMENT: str = "19575"

    # ==================== Fast2SMS SMS API ====================
    FAST2SMS_SMS_ROUTE: str = "dlt"
    FAST2SMS_SMS_SENDER_ID: str = "AARYAC"
    FAST2SMS_SMS_TEMPLATE_OTP: str = "214721"
    FAST2SMS_SMS_FLASH: str = "1"

    # ==================== Password Reset Settings ====================
    PASSWORD_RESET_TOKEN_EXPIRE_HOURS: int = 24
    PASSWORD_RESET_RATE_LIMIT: int = 5
    PASSWORD_RESET_RATE_WINDOW: int = 3600  # 1 hour

    def _validate_required_settings(self):
        """Validate critical settings."""
        super()._validate_required_settings()
        is_prod = self.ENVIRONMENT.lower() in ("production", "prod")
        if is_prod:
            if self.SECRET_KEY == "your_secure_key_here":
                raise RuntimeError(
                    "PRODUCTION ERROR: You MUST change the default SECRET_KEY!"
                )
            if len(self.SECRET_KEY) < 32:
                raise RuntimeError(
                    "PRODUCTION ERROR: SECRET_KEY must be at least 32 characters for HS256!"
                )


# Create cached settings instance
settings = get_settings_cached(Settings)


def get_settings() -> Settings:
    """Get cached settings instance."""
    return settings
