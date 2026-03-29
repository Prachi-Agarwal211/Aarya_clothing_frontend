"""Commerce schemas module."""
from schemas.product import ProductCreate, ProductUpdate, ProductResponse, ProductDetailResponse
from schemas.order import OrderCreate, OrderResponse, CartItem, CartResponse
from schemas.category import CategoryCreate, CategoryUpdate, CategoryResponse, CategoryWithChildren, CategoryTree
from schemas.product_image import ProductImageCreate, ProductImageResponse
from schemas.inventory import InventoryCreate, InventoryUpdate, InventoryResponse, StockAdjustment, LowStockItem
from schemas.wishlist import WishlistItemCreate, WishlistItemResponse, WishlistResponse
from schemas.promotion import PromotionCreate, PromotionUpdate, PromotionResponse, PromotionValidateRequest, PromotionValidateResponse
from schemas.address import AddressCreate, AddressUpdate, AddressResponse
from schemas.review import ReviewCreate, ReviewResponse
from schemas.order_tracking import OrderTrackingCreate, OrderTrackingResponse
from schemas.return_request import ReturnRequestCreate, ReturnRequestUpdate, ReturnRequestResponse
from schemas.error import ErrorResponse, PaginatedResponse, ErrorDetail

__all__ = [
    "ProductCreate", "ProductUpdate", "ProductResponse", "ProductDetailResponse",
    "OrderCreate", "OrderResponse", "CartItem", "CartResponse",
    "CategoryCreate", "CategoryUpdate", "CategoryResponse", "CategoryWithChildren", "CategoryTree",
    "ProductImageCreate", "ProductImageResponse",
    "InventoryCreate", "InventoryUpdate", "InventoryResponse", "StockAdjustment", "LowStockItem",
    "WishlistItemCreate", "WishlistItemResponse", "WishlistResponse",
    "PromotionCreate", "PromotionUpdate", "PromotionResponse", "PromotionValidateRequest", "PromotionValidateResponse",
    "AddressCreate", "AddressUpdate", "AddressResponse",
    "ReviewCreate", "ReviewResponse",
    "OrderTrackingCreate", "OrderTrackingResponse",
    "ReturnRequestCreate", "ReturnRequestUpdate", "ReturnRequestResponse",
    "ErrorResponse", "PaginatedResponse", "ErrorDetail"
]

