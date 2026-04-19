"""Legacy alias - `Inventory` is now `ProductVariant`.

This shim keeps `from models.inventory import Inventory` working during the
transition. New code should import `ProductVariant` directly.
"""
from .product_variant import ProductVariant as Inventory

__all__ = ["Inventory"]
