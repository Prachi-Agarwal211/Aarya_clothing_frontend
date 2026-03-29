"""
Base Schemas for Aarya Clothing Microservices

This module provides shared base schema classes that all services can extend.
It eliminates duplication of common Pydantic model configurations.

Usage:
    from shared.base_schemas import BaseSchema, TimestampMixin, PaginatedResponse
    
    class ProductSchema(BaseSchema):
        name: str
        price: float
    
    class ProductWithTimestamps(BaseSchema, TimestampMixin):
        name: str
        price: float
"""

from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List, Generic, TypeVar
from datetime import datetime

T = TypeVar('T')


class BaseSchema(BaseModel):
    """
    Base schema with common configuration for all Pydantic models.
    
    This class provides:
    - from_attributes = True (for ORM model conversion)
    - populate_by_name = True (for field alias support)
    - use_enum_values = True (for enum field handling)
    - str_strip_whitespace = True (for string trimming)
    """
    
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        use_enum_values=True,
        str_strip_whitespace=True,
    )


class TimestampMixin(BaseModel):
    """
    Mixin that adds timestamp fields to schemas.
    
    Use this for schemas that need created_at and updated_at fields.
    """
    
    created_at: Optional[datetime] = Field(default=None, description="Creation timestamp")
    updated_at: Optional[datetime] = Field(default=None, description="Last update timestamp")


class IDMixin(BaseModel):
    """
    Mixin that adds an ID field to schemas.
    
    Use this for schemas that represent database entities with integer IDs.
    """
    
    id: int = Field(..., description="Unique identifier")


class ActiveMixin(BaseModel):
    """
    Mixin that adds an is_active field to schemas.
    
    Use this for schemas that represent entities that can be activated/deactivated.
    """
    
    is_active: bool = Field(default=True, description="Whether the entity is active")


class PaginatedResponse(BaseSchema, Generic[T]):
    """
    Generic paginated response schema.
    
    Use this for API endpoints that return paginated lists of items.
    
    Example:
        @app.get("/products")
        async def list_products() -> PaginatedResponse[ProductSchema]:
            ...
    """
    
    items: List[T] = Field(..., description="List of items")
    total: int = Field(..., description="Total number of items")
    page: int = Field(..., description="Current page number")
    page_size: int = Field(..., description="Number of items per page")
    total_pages: int = Field(..., description="Total number of pages")
    
    @classmethod
    def create(cls, items: List[T], total: int, page: int, page_size: int):
        """Create a paginated response from items and pagination info."""
        total_pages = (total + page_size - 1) // page_size if page_size > 0 else 0
        return cls(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )


class ErrorResponse(BaseSchema):
    """Standard error response schema."""
    
    detail: str = Field(..., description="Error message")
    code: Optional[str] = Field(default=None, description="Error code")
    field: Optional[str] = Field(default=None, description="Field that caused the error")


class SuccessResponse(BaseSchema):
    """Standard success response schema."""
    
    success: bool = Field(default=True, description="Operation success status")
    message: Optional[str] = Field(default=None, description="Success message")
    data: Optional[dict] = Field(default=None, description="Response data")


class HealthCheckResponse(BaseSchema):
    """Standard health check response schema."""
    
    status: str = Field(default="healthy", description="Service health status")
    service: str = Field(..., description="Service name")
    version: Optional[str] = Field(default=None, description="Service version")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Health check timestamp")
    dependencies: Optional[dict] = Field(default=None, description="Dependency health status")


class MessageResponse(BaseSchema):
    """Simple message response schema."""
    
    message: str = Field(..., description="Response message")


class ValidationErrorDetail(BaseSchema):
    """Validation error detail schema."""
    
    field: str = Field(..., description="Field that failed validation")
    message: str = Field(..., description="Validation error message")
    value: Optional[str] = Field(default=None, description="Invalid value")


class ValidationErrorResponse(BaseSchema):
    """Validation error response schema."""
    
    detail: str = Field(default="Validation error", description="Error message")
    errors: List[ValidationErrorDetail] = Field(..., description="List of validation errors")


# ==================== Common Field Types ====================

def PositiveFloatField(description: str = "Positive number") -> float:
    """Create a positive float field with validation."""
    return Field(..., gt=0, description=description)


def PositiveIntField(description: str = "Positive integer") -> int:
    """Create a positive integer field with validation."""
    return Field(..., gt=0, description=description)


def OptionalStrField(description: str = "", max_length: int = None) -> Optional[str]:
    """Create an optional string field."""
    return Field(
        default=None,
        max_length=max_length,
        description=description
    )


def RequiredStrField(description: str = "", min_length: int = 1, max_length: int = None) -> str:
    """Create a required string field."""
    return Field(
        ...,
        min_length=min_length,
        max_length=max_length,
        description=description
    )


def EmailField(description: str = "Email address") -> str:
    """Create an email field."""
    return Field(
        ...,
        pattern=r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$",
        description=description
    )


def PhoneField(description: str = "Phone number") -> str:
    """Create a phone number field."""
    return Field(
        ...,
        pattern=r"^\+?[1-9]\d{9,14}$",
        description=description
    )
