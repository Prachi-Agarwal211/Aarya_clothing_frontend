"""Error response schemas for standardized error handling."""
from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime


class ErrorDetail(BaseModel):
    """Individual error detail."""
    field: Optional[str] = None
    message: str
    code: str
    
    class Config:
        json_schema_extra = {
            "example": {
                "field": "email",
                "message": "Invalid email format",
                "code": "INVALID_EMAIL"
            }
        }


class ErrorResponse(BaseModel):
    """Standardized error response."""
    error: str
    message: str
    details: Optional[List[ErrorDetail]] = None
    timestamp: datetime
    path: Optional[str] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "error": "ValidationError",
                "message": "Request validation failed",
                "details": [
                    {
                        "field": "price",
                        "message": "Price must be greater than 0",
                        "code": "VALUE_ERROR"
                    }
                ],
                "timestamp": "2026-02-06T21:00:00Z",
                "path": "/api/v1/products"
            }
        }


class PaginatedResponse(BaseModel):
    """Standardized paginated response."""
    items: List[Any]
    total: int
    skip: int
    limit: int
    has_more: bool
    
    class Config:
        json_schema_extra = {
            "example": {
                "items": [],
                "total": 150,
                "skip": 0,
                "limit": 50,
                "has_more": True
            }
        }
