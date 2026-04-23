"""
Payment Service Configuration for Aarya Clothing.

This module extends the shared BaseSettings with Payment service-specific settings
for Razorpay payment processing.
"""

from typing import Optional, List

# Import from shared package (PYTHONPATH=/app in Docker, or parent dir in local dev)
from shared.base_config import BaseSettings as SharedBaseSettings, ServiceUrls


class Settings(SharedBaseSettings):
    """
    Payment Service settings loaded from environment variables.
    
    Inherits common settings from SharedBaseSettings and adds Payment-specific settings.
    """
    
    # Override service name
    SERVICE_NAME: str = "aarya-payment"

    # ==================== Razorpay Configuration ====================
    RAZORPAY_KEY_ID: Optional[str] = None
    RAZORPAY_KEY_SECRET: Optional[str] = None
    RAZORPAY_WEBHOOK_SECRET: Optional[str] = None
    RAZORPAY_CHECKOUT_CONFIG_ID: Optional[str] = None  # Dashboard Payment Config ID (enables UPI etc.)

    # ==================== Payment Settings ====================
    PAYMENT_TIMEOUT_SECONDS: int = 300  # 5 minutes
    MAX_RETRY_ATTEMPTS: int = 3
    PAYMENT_SUCCESS_URL: str = "https://aaryaclothing.in/payment/success"
    PAYMENT_FAILURE_URL: str = "https://aaryaclothing.in/payment/failure"
    PAYMENT_NOTIFY_URL: str = "https://aaryaclothing.in/api/v1/webhooks/razorpay"

    # ==================== Currency ====================
    DEFAULT_CURRENCY: str = "INR"
    SUPPORTED_CURRENCIES: List[str] = ["INR"]

    # ==================== Service URLs ====================
    # Docker Compose: core → 5001, commerce → 5002 (see docker-compose.yml)
    CORE_SERVICE_URL: str = "http://core:5001"
    COMMERCE_SERVICE_URL: str = "http://commerce:5002"

    @property
    def razorpay_enabled(self) -> bool:
        """Check if Razorpay is configured."""
        return bool(
            self.RAZORPAY_KEY_ID and
            self.RAZORPAY_KEY_SECRET
        )

# Create cached settings instance
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# Eager load settings
settings = get_settings()
