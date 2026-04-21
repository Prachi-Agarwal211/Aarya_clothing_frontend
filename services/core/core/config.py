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

    # ==================== MSG91 WhatsApp (BSP) ====================
    # Same authkey as SMS; from MSG91 panel → Authkey. Required for WHATSAPP_PROVIDER=msg91.
    MSG91_WHATSAPP_INTEGRATED_NUMBER: Optional[str] = None
    # Template namespace from MSG91 / Meta (WhatsApp → Templates → namespace in API payload)
    MSG91_WHATSAPP_NAMESPACE: Optional[str] = None
    MSG91_WHATSAPP_BULK_URL: str = "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/"
    MSG91_WHATSAPP_TEXT_URL: str = "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/"

    # ==================== WhatsApp provider ====================
    # "msg91" = MSG91 WhatsApp API (recommended). "meta" = direct Meta Graph API (legacy).
    # If unset or empty: auto — MSG91 when authkey + integrated number + namespace are set; else Meta when token + phone_number_id.
    WHATSAPP_PROVIDER: Optional[str] = None

    # ==================== Meta WhatsApp Cloud API (legacy / optional) ====================
    # From Meta Developer Portal -> WhatsApp -> API Setup
    WHATSAPP_ACCESS_TOKEN: Optional[str] = None
    WHATSAPP_PHONE_NUMBER_ID: Optional[str] = None
    WHATSAPP_WABA_ID: Optional[str] = None
    WHATSAPP_API_VERSION: str = "v20.0"
    
    # Template Names (Must match exactly what you created in Meta / MSG91 template list)
    WHATSAPP_TEMPLATE_OTP: str = "auth_otp"
    WHATSAPP_TEMPLATE_ORDER_CONFIRMED: str = "order_confirmation"
    WHATSAPP_TEMPLATE_ORDER_SHIPPED: str = "order_shipped"
    WHATSAPP_TEMPLATE_ORDER_DELIVERED: str = "order_delivered"
    # Language code for template sends (MSG91 examples use "en"; Meta may use "en_US")
    WHATSAPP_TEMPLATE_LANGUAGE_CODE: str = "en"
    
    # Webhook Configuration
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: str = "aarya_whatsapp_webhook_2026"
    WHATSAPP_APP_SECRET: Optional[str] = None
    WHATSAPP_WEBHOOK_URL: str = "https://aaryaclothing.in/api/v1/whatsapp/webhook"
    # Optional: if MSG91 sends a static header secret for webhook auth, set and validate in POST handler
    MSG91_WHATSAPP_WEBHOOK_SECRET: Optional[str] = None

    def resolve_whatsapp_provider(self) -> str:
        """Return 'msg91' or 'meta'."""
        explicit = (self.WHATSAPP_PROVIDER or "").strip().lower()
        if explicit in ("msg91", "meta"):
            return explicit
        msg91_ready = bool(
            self.MSG91_AUTH_KEY
            and self.MSG91_WHATSAPP_INTEGRATED_NUMBER
            and self.MSG91_WHATSAPP_NAMESPACE
        )
        meta_ready = bool(self.WHATSAPP_ACCESS_TOKEN and self.WHATSAPP_PHONE_NUMBER_ID)
        if msg91_ready:
            return "msg91"
        if meta_ready:
            return "meta"
        return "msg91"

    @property
    def whatsapp_enabled(self) -> bool:
        """True when the active provider has required credentials."""
        p = self.resolve_whatsapp_provider()
        if p == "msg91":
            return bool(
                self.MSG91_AUTH_KEY
                and self.MSG91_WHATSAPP_INTEGRATED_NUMBER
                and self.MSG91_WHATSAPP_NAMESPACE
            )
        return bool(self.WHATSAPP_ACCESS_TOKEN and self.WHATSAPP_PHONE_NUMBER_ID)

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
