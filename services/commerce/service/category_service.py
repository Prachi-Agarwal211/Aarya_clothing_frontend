"""Backward-compat shim — import CollectionService from service.collection_service instead."""
from service.collection_service import CollectionService

# Legacy alias
CategoryService = CollectionService
