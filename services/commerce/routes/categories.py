"""
Commerce Service - Categories/Collections Routes

Collection management endpoints:
- List collections/categories
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
from models.category import Category
from schemas.category import (
    CategoryCreate, CategoryUpdate, CategoryResponse, 
    CategoryWithChildren, CategoryTree
)
from schemas.error import ErrorResponse, PaginatedResponse
from service.category_service import CategoryService
from shared.auth_middleware import get_current_user, require_staff

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/collections", tags=["Collections"])


# ==================== Helper Functions ====================

def _get_category_service(db: Session) -> CategoryService:
    """Get category service instance."""
    return CategoryService(db)


def _enrich_category(cat) -> dict:
    """Convert Category ORM to dict with enriched data."""
    return {
        "id": cat.id,
        "name": cat.name,
        "slug": cat.slug,
        "description": cat.description,
        "image_url": cat.image_url,
        "display_order": cat.display_order,
        "is_active": cat.is_active,
        "is_featured": cat.is_featured,
        "product_count": len(cat.products) if hasattr(cat, 'products') and cat.products else 0,
        "created_at": cat.created_at,
        "updated_at": cat.updated_at,
    }


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
    category_service = _get_category_service(db)
    
    query = db.query(Category)
    
    if is_active:
        query = query.filter(Category.is_active == True)
    
    if is_featured is not None:
        query = query.filter(Category.is_featured == is_featured)
    
    # Order by display_order
    query = query.order_by(Category.display_order, desc(Category.created_at))
    
    # Pagination
    total = query.count()
    offset = (page - 1) * limit
    categories = query.offset(offset).limit(limit).all()

    # Calculate pagination metadata to match PaginatedResponse schema
    skip = offset
    has_more = offset + limit < total

    return {
        "items": [_enrich_category(cat) for cat in categories],
        "total": total,
        "skip": skip,
        "limit": limit,
        "has_more": has_more
    }


@router.get("/tree", response_model=List[CategoryTree])
async def get_collections_tree(
    db: Session = Depends(get_db)
):
    """Get collections as a hierarchical tree structure."""
    category_service = _get_category_service(db)
    
    try:
        # Get all root categories (no parent)
        root_categories = db.query(Category).filter(
            Category.is_active == True
        ).order_by(Category.display_order).all()
        
        # Build tree structure
        def build_tree(category):
            children = db.query(Category).filter(
                Category.parent_id == category.id,
                Category.is_active == True
            ).order_by(Category.display_order).all()
            
            return {
                "id": category.id,
                "name": category.name,
                "slug": category.slug,
                "children": [build_tree(child) for child in children]
            }
        
        return [build_tree(cat) for cat in root_categories]
    except Exception as e:
        logger.error(f"Error building category tree: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to build category tree"
        )


@router.get("/featured", response_model=List[CategoryResponse])
async def get_featured_collections(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """Get featured collections for homepage."""
    categories = db.query(Category).filter(
        Category.is_active == True,
        Category.is_featured == True
    ).order_by(Category.display_order).limit(limit).all()
    
    return [_enrich_category(cat) for cat in categories]


@router.get("/{collection_id}", response_model=CategoryWithChildren)
async def get_collection(
    collection_id: int,
    db: Session = Depends(get_db)
):
    """Get collection details by ID with products."""
    category = db.query(Category).filter(Category.id == collection_id).first()
    
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collection not found"
        )
    
    return _enrich_category(category)


@router.get("/slug/{slug}", response_model=CategoryWithChildren)
async def get_collection_by_slug(
    slug: str,
    db: Session = Depends(get_db)
):
    """Get collection details by slug."""
    category = db.query(Category).filter(Category.slug == slug).first()
    
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collection not found"
        )
    
    return _enrich_category(category)


# ==================== Admin Collection Management ====================

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_collection(
    category_data: CategoryCreate,
    current_user: dict = Depends(require_staff),
    db: Session = Depends(get_db)
):
    """Create new collection (admin/staff only)."""
    category_service = _get_category_service(db)
    
    try:
        category = category_service.create_category(category_data)
        return _enrich_category(category)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.put("/{collection_id}", response_model=CategoryResponse)
async def update_collection(
    collection_id: int,
    category_data: CategoryUpdate,
    current_user: dict = Depends(require_staff),
    db: Session = Depends(get_db)
):
    """Update collection (admin/staff only)."""
    category_service = _get_category_service(db)
    
    try:
        category = category_service.update_category(collection_id, category_data)
        return _enrich_category(category)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.delete("/{collection_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_collection(
    collection_id: int,
    current_user: dict = Depends(require_staff),
    db: Session = Depends(get_db)
):
    """Delete collection (admin/staff only)."""
    category_service = _get_category_service(db)
    
    try:
        category_service.delete_category(collection_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
