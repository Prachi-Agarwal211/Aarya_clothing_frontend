"""
Commerce Service - Collections Routes

Collection management endpoints:
- List collections
- Collection tree navigation
- CRUD operations (admin)
- Featured collections
"""

import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from database.database import get_db
from models.collection import Collection
from schemas.collection import (
    CollectionCreate, CollectionUpdate, CollectionResponse,
    CollectionWithProducts, CollectionList,
)
from schemas.error import ErrorResponse, PaginatedResponse
from service.collection_service import CollectionService
from core.advanced_cache import cache
from shared.auth_middleware import get_current_user, require_staff

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/collections", tags=["Collections"])


# ==================== Helper Functions ====================

def _get_collection_service(db: Session) -> CollectionService:
    """Get collection service instance."""
    return CollectionService(db)


# Backward-compat alias
_get_category_service = _get_collection_service


def _enrich_collection(col) -> dict:
    """Convert Collection ORM to dict with enriched data."""
    return {
        "id": col.id,
        "name": col.name,
        "slug": col.slug,
        "description": col.description,
        "image_url": col.image_url,
        "display_order": col.display_order,
        "is_active": col.is_active,
        "is_featured": col.is_featured,
        "product_count": len(col.products) if hasattr(col, 'products') and col.products else 0,
        "created_at": col.created_at,
        "updated_at": col.updated_at,
    }


def _enrich_category(cat) -> dict:
    """Backward-compat alias for _enrich_collection."""
    return _enrich_collection(cat)


# ==================== Public Collection Endpoints ====================

@router.get("", response_model=PaginatedResponse)
async def list_collections(
    is_active: bool = True,
    is_featured: Optional[bool] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """
    List all collections/categories.
    
    - **is_active**: Filter by active status (default: true)
    - **is_featured**: Filter featured collections only
    - **page**: Page number
    - **limit**: Items per page (max 100)
    """
    query = db.query(Collection)

    if is_active:
        query = query.filter(Collection.is_active == True)

    if is_featured is not None:
        query = query.filter(Collection.is_featured == is_featured)

    query = query.order_by(Collection.display_order, desc(Collection.created_at))

    total = query.count()
    offset = (page - 1) * limit
    collections = query.offset(offset).limit(limit).all()

    return {
        "items": [_enrich_collection(col) for col in collections],
        "total": total,
        "skip": offset,
        "limit": limit,
        "has_more": offset + limit < total,
    }


@router.get("/tree", response_model=List[CollectionList])
async def get_collections_tree(
    db: Session = Depends(get_db)
):
    """Get flat collections list (no hierarchy)."""
    try:
        collections = db.query(Collection).filter(
            Collection.is_active == True
        ).order_by(Collection.display_order).all()
        return [{"collections": [_enrich_collection(col) for col in collections]}]
    except Exception as e:
        logger.error(f"Error fetching collections tree: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch collections"
        )


@router.get("/featured", response_model=List[CollectionResponse])
async def get_featured_collections(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """Get featured collections for homepage."""
    collections = db.query(Collection).filter(
        Collection.is_active == True,
        Collection.is_featured == True
    ).order_by(Collection.display_order).limit(limit).all()

    return [_enrich_collection(col) for col in collections]


@router.get("/slug/{slug}", response_model=CollectionWithProducts)
async def get_collection_by_slug(
    slug: str,
    db: Session = Depends(get_db)
):
    """Get collection details by slug."""
    collection = db.query(Collection).filter(Collection.slug == slug).first()

    if not collection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collection not found"
        )

    return _enrich_collection(collection)


@router.get("/{collection_id}", response_model=CollectionWithProducts)
async def get_collection(
    collection_id: int,
    db: Session = Depends(get_db)
):
    """Get collection details by ID."""
    collection = db.query(Collection).filter(Collection.id == collection_id).first()

    if not collection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collection not found"
        )

    return _enrich_collection(collection)


# ==================== Admin Collection Management ====================

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_collection(
    data: CollectionCreate,
    current_user: dict = Depends(require_staff),
    db: Session = Depends(get_db)
):
    """Create new collection (admin/staff only)."""
    svc = _get_collection_service(db)
    try:
        collection = svc.create_collection(data)
        cache.invalidate_pattern("collections:*")
        cache.invalidate_pattern("products:*")
        return _enrich_collection(collection)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put("/{collection_id}", response_model=CollectionResponse)
async def update_collection(
    collection_id: int,
    data: CollectionUpdate,
    current_user: dict = Depends(require_staff),
    db: Session = Depends(get_db)
):
    """Update collection (admin/staff only)."""
    svc = _get_collection_service(db)
    try:
        collection = svc.update_collection(collection_id, data)
        cache.invalidate_pattern("collections:*")
        cache.invalidate_pattern("products:*")
        return _enrich_collection(collection)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{collection_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_collection(
    collection_id: int,
    current_user: dict = Depends(require_staff),
    db: Session = Depends(get_db)
):
    """Delete collection (admin/staff only)."""
    svc = _get_collection_service(db)
    try:
        svc.delete_collection(collection_id)
        cache.invalidate_pattern("collections:*")
        cache.invalidate_pattern("products:*")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
