"""Collection service — canonical service for collection/category management."""
from typing import List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
import re

from models.collection import Collection
from schemas.collection import CollectionCreate, CollectionUpdate


class CollectionService:
    """Service for collection management."""

    def __init__(self, db: Session):
        self.db = db

    def get_all_collections(self, active_only: bool = True) -> List[Collection]:
        """Return all collections ordered by display_order then name."""
        query = self.db.query(Collection)
        if active_only:
            query = query.filter(Collection.is_active == True)
        return query.order_by(Collection.display_order, Collection.name).all()

    def get_collection_by_id(self, collection_id: int) -> Optional[Collection]:
        """Return a single collection by primary key."""
        return self.db.query(Collection).filter(Collection.id == collection_id).first()

    def get_collection_by_slug(self, slug: str) -> Optional[Collection]:
        """Return a single collection by slug."""
        return self.db.query(Collection).filter(Collection.slug == slug).first()

    def create_collection(self, data: CollectionCreate) -> Collection:
        """Create a new collection, auto-generating slug when not supplied."""
        slug = data.slug
        if not slug and data.name:
            slug = re.sub(r'[^a-z0-9-]', '', data.name.lower().replace(' ', '-'))

        if self.db.query(Collection).filter(Collection.slug == slug).first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Collection with slug '{slug}' already exists",
            )

        payload = data.model_dump(exclude_none=False)
        payload['slug'] = slug
        payload.pop('parent_id', None)  # flat collections — no hierarchy
        collection = Collection(**{k: v for k, v in payload.items() if hasattr(Collection, k)})
        self.db.add(collection)
        self.db.commit()
        self.db.refresh(collection)
        return collection

    def update_collection(self, collection_id: int, data: CollectionUpdate) -> Collection:
        """Update an existing collection."""
        collection = self.get_collection_by_id(collection_id)
        if not collection:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Collection {collection_id} not found",
            )

        if data.slug and data.slug != collection.slug:
            if self.db.query(Collection).filter(Collection.slug == data.slug).first():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Collection with slug '{data.slug}' already exists",
                )

        update_data = data.model_dump(exclude_unset=True)
        update_data.pop('parent_id', None)
        for field, value in update_data.items():
            if hasattr(collection, field):
                setattr(collection, field, value)

        self.db.commit()
        self.db.refresh(collection)
        return collection

    def delete_collection(self, collection_id: int) -> bool:
        """Delete a collection and unassign its products."""
        collection = self.get_collection_by_id(collection_id)
        if not collection:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Collection {collection_id} not found",
            )

        from models.product import Product
        self.db.query(Product).filter(Product.category_id == collection_id).update(
            {"category_id": None}, synchronize_session=False
        )

        self.db.delete(collection)
        self.db.commit()
        return True

    # ── Backward-compat method aliases ─────────────────────────────────────
    def get_all_categories(self, active_only: bool = True) -> List[Collection]:
        return self.get_all_collections(active_only)

    def get_root_categories(self, active_only: bool = True) -> List[Collection]:
        return self.get_all_collections(active_only)

    def get_category_by_id(self, category_id: int) -> Optional[Collection]:
        return self.get_collection_by_id(category_id)

    def get_category_by_slug(self, slug: str) -> Optional[Collection]:
        return self.get_collection_by_slug(slug)

    def create_category(self, data) -> Collection:
        from schemas.collection import CollectionCreate as CC
        return self.create_collection(CC(**data.model_dump()))

    def update_category(self, category_id: int, data) -> Collection:
        from schemas.collection import CollectionUpdate as CU
        return self.update_collection(category_id, CU(**data.model_dump(exclude_unset=True)))

    def delete_category(self, category_id: int) -> bool:
        return self.delete_collection(category_id)

    def get_category_tree(self, parent_id: Optional[int] = None) -> List[Collection]:
        return self.get_all_collections()


# Backward-compat alias
CategoryService = CollectionService
