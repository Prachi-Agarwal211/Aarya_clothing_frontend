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
    # Async OTP email: queue in Redis + background worker (reduces API latency under load)
    EMAIL_OTP_USE_QUEUE: bool = True
    # SMTP transient failures — retries inside each send (queue worker uses this too)
    SMTP_SEND_MAX_ATTEMPTS: int = 3
    
    # ==================== MSG91 SMS API ====================
    MSG91_AUTH_KEY: Optional[str] = None
    MSG91_TEMPLATE_ID: Optional[str] = None
    MSG91_SENDER_ID: Optional[str] = None
    # Optional Flow template for order/shipping SMS (DLT-registered body in MSG91 console)
    MSG91_ORDER_FLOW_TEMPLATE_ID: Optional[str] = None

    # ==================== Meta WhatsApp Cloud API ====================
    # From Meta Developer Portal -> WhatsApp -> API Setup
    WHATSAPP_ACCESS_TOKEN: Optional[str] = None
    WHATSAPP_PHONE_NUMBER_ID: Optional[str] = None
    WHATSAPP_WABA_ID: Optional[str] = None
    WHATSAPP_API_VERSION: str = "v20.0"
    
    # Template Names (Must match exactly what you created in Meta Dashboard)
    WHATSAPP_TEMPLATE_OTP: str = "auth_otp"
    WHATSAPP_TEMPLATE_ORDER_CONFIRMED: str = "order_confirmation"
    WHATSAPP_TEMPLATE_ORDER_SHIPPED: str = "order_shipped"
    WHATSAPP_TEMPLATE_ORDER_DELIVERED: str = "order_delivered"

    @property
    def whatsapp_enabled(self) -> bool:
        """Check if Meta WhatsApp integration is enabled."""
        return bool(
            self.WHATSAPP_ACCESS_TOKEN and
            self.WHATSAPP_PHONE_NUMBER_ID
        )

    # ==================== Password Reset Settings ====================
    PASSWORD_RESET_TOKEN_EXPIRE_HOURS: int = 24
    PASSWORD_RESET_RATE_LIMIT: int = 5
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
        
        # Security: Enforce strong JWT secret
        is_prod = self.ENVIRONMENT.lower() in ("production", "prod")
        
        if is_prod:
            if self.SECRET_KEY == "your_secure_key_here":
                raise RuntimeError("PRODUCTION ERROR: You MUST change the default SECRET_KEY in .env!")
            if len(self.SECRET_KEY) < 32:
                raise RuntimeError("PRODUCTION ERROR: SECRET_KEY must be at least 32 characters for HS256!")
        else:
            # Warnings for non-production environments
            if len(self.SECRET_KEY) < 32:
                logging.getLogger(__name__).warning("SECRET_KEY is too short. Use at least 32 characters for security.")
            if self.SECRET_KEY == "your_secure_key_here":
                logging.getLogger(__name__).warning("Using default insecure SECRET_KEY. Change this for better security.")


# Create cached settings instance
settings = get_settings_cached(Settings)


def get_settings() -> Settings:
    """Get cached settings instance."""
    return settings
