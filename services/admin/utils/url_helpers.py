"""URL building helpers shared across admin routers.

Centralised so every router that returns a Cloudflare R2 image URL produces
the same shape — full ``https://…`` URLs for the frontend, regardless of
whether the database stores absolute or relative keys.
"""

from core.config import settings


def get_r2_public_url(image_url: str | None) -> str:
    """Return a fully-qualified R2 URL for ``image_url``.

    - Empty / ``None`` -> empty string (caller decides how to render).
    - Already absolute (``http://``/``https://``) -> returned unchanged.
    - Relative path -> joined onto ``settings.R2_PUBLIC_URL``.
    """
    if not image_url:
        return ""
    if image_url.startswith("http://") or image_url.startswith("https://"):
        return image_url
    r2_base = (settings.R2_PUBLIC_URL or "").rstrip("/")
    if not r2_base:
        return image_url
    return f"{r2_base}/{image_url.lstrip('/')}"
