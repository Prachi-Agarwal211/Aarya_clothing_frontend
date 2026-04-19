"""
Storefront search router.

Currently exposes the autocomplete suggestion endpoint that the search bar
calls on every keystroke. The heavy lifting lives in
``search.meilisearch_client``; this module just enforces the public API
shape, the rate limit, and dependency injection.

If full-text search needs more endpoints later (faceted search, popular
queries, etc.), add them here so they share the same rate limit budget.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from database.database import get_db
from rate_limit import check_rate_limit
from search.meilisearch_client import get_search_suggestions as meili_suggestions

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Search"])


@router.get("/api/v1/search/suggestions")
async def get_search_suggestions(
    request: Request,
    q: str = Query(..., min_length=1, description="Search query for suggestions"),
    limit: int = Query(5, ge=1, le=10, description="Max suggestions per category"),
    db: Session = Depends(get_db),
):
    """
    Autocomplete suggestions for the global search bar.

    Returns matching products, collections, and trending searches via
    Meilisearch with a Postgres fallback. Capped at 30 requests per minute
    per IP because clients hit this on every keystroke.
    """
    if not check_rate_limit(request, "search_suggestions", limit=30, window=60):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many suggestion requests. Please try again later.",
        )

    return meili_suggestions(query=q, limit=limit, db_session=db)
