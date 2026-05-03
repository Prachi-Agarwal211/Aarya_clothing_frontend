"""Shared storage utilities for image URL resolution."""
import os
from typing import Optional

def get_r2_public_url(path: Optional[str]) -> Optional[str]:
    """
    Standardizes image URL resolution across all services.
    
    Rules:
    1. If path is already a full URL (http/https), return it.
    2. If path is None/empty, return None.
    3. If path is relative, prefix with R2_PUBLIC_URL.
    4. Ensure no double slashes during prefixing.
    
    Args:
        path: The image path or URL.
        
    Returns:
        Full standardized URL or None.
    """
    if not path:
        return None
    
    path = str(path).strip()
    
    # Already a full URL
    if path.startswith(('http://', 'https://')):
        return path
    
    # Get base URL from environment
    base_url = os.environ.get("R2_PUBLIC_URL")
    if not base_url:
        # Fallback to hardcoded public R2 URL if not in env
        base_url = "https://pub-7846c786f7154610b57735df47899fa0.r2.dev"
    
    # Normalize base_url (remove trailing slash)
    base_url = base_url.rstrip('/')
    
    # Normalize path (ensure leading slash)
    if not path.startswith('/'):
        path = '/' + path
        
    return f"{base_url}{path}"
