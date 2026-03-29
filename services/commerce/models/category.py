"""Backward-compat shim — import Collection from models.collection instead."""
from models.collection import Collection

# Legacy alias — kept so existing `from models.category import Category` imports keep working
Category = Collection
