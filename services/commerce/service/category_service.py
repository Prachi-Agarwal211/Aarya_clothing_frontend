"""Collection service (categories = collections are unified)."""
from typing import List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from models.category import Category
from schemas.category import CategoryCreate, CategoryUpdate


class CategoryService:
    """Service for collection/category management (unified)."""
    
    def __init__(self, db: Session):
        """Initialize category service."""
        self.db = db
    
    def get_all_categories(self, active_only: bool = True) -> List[Category]:
        """Get all categories."""
        query = self.db.query(Category)
        if active_only:
            query = query.filter(Category.is_active == True)
        return query.order_by(Category.display_order, Category.name).all()
    
    def get_root_categories(self, active_only: bool = True) -> List[Category]:
        """Get all collections (flat structure, no hierarchy)."""
        return self.get_all_categories(active_only)
    
    def get_category_by_id(self, category_id: int) -> Optional[Category]:
        """Get category by ID."""
        return self.db.query(Category).filter(Category.id == category_id).first()
    
    def get_category_by_slug(self, slug: str) -> Optional[Category]:
        """Get category by slug."""
        return self.db.query(Category).filter(Category.slug == slug).first()
    
    def create_category(self, category_data: CategoryCreate) -> Category:
        """Create a new collection."""
        # Auto-generate slug if not provided
        slug = category_data.slug
        if not slug and category_data.name:
            import re
            slug = re.sub(r'[^a-z0-9-]', '', category_data.name.lower().replace(' ', '-'))
        
        # Check if slug exists
        existing = self.db.query(Category).filter(Category.slug == slug).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Collection with slug '{slug}' already exists"
            )
        
        data = category_data.model_dump(exclude={'parent_id'}, exclude_none=False)
        data['slug'] = slug
        # Remove parent_id if present (flat collections)
        data.pop('parent_id', None)
        category = Category(**{k: v for k, v in data.items() if hasattr(Category, k)})
        self.db.add(category)
        self.db.commit()
        self.db.refresh(category)
        return category
    
    def update_category(self, category_id: int, category_data: CategoryUpdate) -> Category:
        """Update an existing collection."""
        category = self.get_category_by_id(category_id)
        if not category:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Collection with ID {category_id} not found"
            )
        
        # Check slug uniqueness if updating
        if category_data.slug and category_data.slug != category.slug:
            existing = self.db.query(Category).filter(Category.slug == category_data.slug).first()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Collection with slug '{category_data.slug}' already exists"
                )
        
        update_data = category_data.model_dump(exclude_unset=True)
        update_data.pop('parent_id', None)  # flat collections, no hierarchy
        for field, value in update_data.items():
            if hasattr(category, field):
                setattr(category, field, value)
        
        self.db.commit()
        self.db.refresh(category)
        return category
    
    def delete_category(self, category_id: int) -> bool:
        """Delete a collection. Products are unassigned (collection_id set to NULL)."""
        category = self.get_category_by_id(category_id)
        if not category:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Collection with ID {category_id} not found"
            )
        
        # Unassign products instead of blocking deletion
        from models.product import Product
        self.db.query(Product).filter(Product.category_id == category_id).update(
            {"category_id": None}, synchronize_session=False
        )
        
        self.db.delete(category)
        self.db.commit()
        return True
    
    def get_category_tree(self, parent_id: Optional[int] = None) -> List[Category]:
        """Get all collections (flat, no tree hierarchy)."""
        return self.get_all_categories()
