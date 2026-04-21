"""Routes package for Core service."""
from .whatsapp_webhook import router as whatsapp_webhook_router

__all__ = ["whatsapp_webhook_router"]
