"""Backward-compat shim — import collection schemas from schemas.collection instead."""
from schemas.collection import (
    CollectionBase, CollectionCreate, CollectionUpdate, CollectionResponse,
    CollectionWithProducts, CollectionList,
    BulkCollectionStatusUpdate, BulkCollectionReorder,
)

# Legacy aliases
CategoryBase = CollectionBase
CategoryCreate = CollectionCreate
CategoryUpdate = CollectionUpdate
CategoryResponse = CollectionResponse
CategoryWithChildren = CollectionWithProducts
CategoryTree = CollectionList
