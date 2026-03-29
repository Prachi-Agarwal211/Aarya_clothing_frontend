"""
Commerce Service Configuration for Aarya Clothing.

This module extends the shared BaseSettings with Commerce service-specific settings
for products, orders, cart, inventory, and R2 storage.
"""

from typing import Optional

# Import from shared package (PYTHONPATH=/app in Docker, or parent dir in local dev)
from shared.base_config import BaseSettings as SharedBaseSettings, get_settings_cached


class Settings(SharedBaseSettings):
    """
    Commerce Service settings loaded from environment variables.
    
    Inherits common settings from SharedBaseSettings and adds Commerce-specific settings.
    """
    
    # Override service name
    SERVICE_NAME: str = "aarya-commerce"
    
    # ==================== Commerce Settings ====================
    CART_TTL_HOURS: int = 168  # 7 days
    ORDER_TIMEOUT_MINUTES: int = 15
    INVENTORY_LOCK_TIMEOUT: int = 300
    
    # ==================== MeiliSearch Settings ====================
    MEILISEARCH_URL: str = "http://localhost:7700"
    MEILISEARCH_API_KEY: Optional[str] = None
    
    @property
    def r2_enabled(self) -> bool:
        """Check if R2 storage is configured."""
        return bool(
            self.R2_ACCOUNT_ID and
            self.R2_ACCESS_KEY_ID and
            self.R2_SECRET_ACCESS_KEY
        )
    
    @property
    def search_enabled(self) -> bool:
        """Check if MeiliSearch is configured."""
        return bool(self.MEILISEARCH_URL)


# Create cached settings instance
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# Eager load settings
settings = get_settings()
