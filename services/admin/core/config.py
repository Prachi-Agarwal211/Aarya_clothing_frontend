"""
Admin Service Configuration for Aarya Clothing.

This module extends the shared BaseSettings with Admin service-specific settings
for analytics, chat, landing page configuration, and R2 storage.
"""

from typing import Optional, List

# Import from shared package (PYTHONPATH=/app in Docker, or parent dir in local dev)
from shared.base_config import BaseSettings as SharedBaseSettings, ServiceUrls


class Settings(SharedBaseSettings):
    """
    Admin Service settings loaded from environment variables.
    
    Inherits common settings from SharedBaseSettings and adds Admin-specific settings.
    """
    
    # Override service name
    SERVICE_NAME: str = "aarya-admin"
    
    # Override database pool size (admin needs fewer connections)
    DATABASE_POOL_SIZE: int = 5
    DATABASE_MAX_OVERFLOW: int = 10
    
    # ==================== Service URLs ====================
    CORE_SERVICE_URL: Optional[str] = None
    COMMERCE_SERVICE_URL: Optional[str] = None
    PAYMENT_SERVICE_URL: Optional[str] = None
    
    # ==================== Admin-specific Settings ====================
    ADMIN_SESSION_TIMEOUT_MINUTES: int = 60
    MAX_EXPORT_ROWS: int = 10000
    
    @property
    def r2_enabled(self) -> bool:
        """Check if R2 storage is configured."""
        return bool(
            self.R2_ACCOUNT_ID and
            self.R2_ACCESS_KEY_ID and
            self.R2_SECRET_ACCESS_KEY
        )
    
    def _validate_required_settings(self):
        """Validate that required settings are properly configured."""
        super()._validate_required_settings()
        
        # Validate service URLs are set
        if not self.CORE_SERVICE_URL:
            raise ValueError("CORE_SERVICE_URL must be set in environment variables")
        if not self.COMMERCE_SERVICE_URL:
            raise ValueError("COMMERCE_SERVICE_URL must be set in environment variables")


# Create cached settings instance
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# Eager load settings
settings = get_settings()
