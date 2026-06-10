"""Nginx cache purge helper.

After admin mutations (product create/update/delete, inventory adjust, etc.)
we need the customer-facing nginx cache to reflect fresh data immediately
rather than serving stale responses for up to 60 seconds.

Strategy: send a lightweight GET request to the commerce service with
``X-Purge-Cache: 1`` header.  Nginx's ``proxy_cache_bypass`` map sees
the header and skips the disk cache, forwarding to the upstream.  The
response is then cached normally so the next (non-purge) request is fast.

The purge runs in a background thread so the admin endpoint response is
not delayed by the HTTP round-trip.
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

# Commerce service base URL for internal Docker calls.
# Uses nginx:80 so the purge goes through nginx (bypassing its own cache).
_COMMERCE_INTERNAL = os.getenv("COMMERCE_INTERNAL_URL", "http://nginx:80")


def _purge_urls(urls: list[str]) -> None:
    """Fire-and-forget HTTP GET with X-Purge-Cache header."""
    import httpx

    headers = {"X-Purge-Cache": "1"}
    for url in urls:
        try:
            # Synchronous call — runs in a thread via asyncio.to_thread
            resp = httpx.get(url, headers=headers, timeout=5.0)
            logger.debug(f"Purged {url} -> {resp.status_code} ({resp.headers.get('x-cache-status', '?')})")
        except Exception as e:
            # Purge is best-effort; never crash the admin endpoint
            logger.debug(f"Purge failed for {url}: {e}")


async def purge_product_caches(product_id: Optional[int] = None) -> None:
    """Purge nginx cache for product-related endpoints.

    Called after any admin mutation that affects the customer-facing catalog.
    Runs in background so the admin response is not delayed.
    """
    base = _COMMERCE_INTERNAL
    urls = [
        f"{base}/api/v1/products?limit=24",
        f"{base}/api/v1/landing/featured",
        f"{base}/api/v1/landing/all",
        f"{base}/api/v1/collections",
    ]
    # If a specific product ID is given, also purge its detail page
    if product_id:
        urls.append(f"{base}/api/v1/products/{product_id}")

    # Run in a thread so we don't block the event loop
    try:
        await asyncio.to_thread(_purge_urls, urls)
    except Exception as e:
        logger.debug(f"Cache purge thread failed: {e}")
