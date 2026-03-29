"""Standardized response schemas for all services."""
from typing import Any, Dict, List, Optional, Union, Generic, TypeVar
from pydantic import BaseModel, Field
from datetime import datetime, timezone

T = TypeVar('T')


class BaseResponse(BaseModel, Generic[T]):
    """Base response schema for all API responses."""
    success: bool = True
    message: Optional[str] = None
    data: Optional[T] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class ErrorResponse(BaseModel):
    """Standardized error response."""
    success: bool = False
    error: Dict[str, Any]
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class PaginatedResponse(BaseModel, Generic[T]):
    """Standardized paginated response."""
    success: bool = True
    data: List[T]
    pagination: Dict[str, Any]
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class SuccessResponse(BaseModel):
    """Simple success response."""
    success: bool = True
    message: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    service: str
    version: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class ValidationErrorResponse(BaseModel):
    """Validation error response."""
    success: bool = False
    error: Dict[str, Any]
    details: List[Dict[str, Any]]
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class DatabaseErrorResponse(BaseModel):
    """Database error response."""
    success: bool = False
    error: Dict[str, Any]
    message: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class AuthenticationErrorResponse(BaseModel):
    """Authentication error response."""
    success: bool = False
    error: Dict[str, Any]
    message: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class AuthorizationErrorResponse(BaseModel):
    """Authorization error response."""
    success: bool = False
    error: Dict[str, Any]
    message: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class NotFoundErrorResponse(BaseModel):
    """Not found error response."""
    success: bool = False
    error: Dict[str, Any]
    message: str = "Resource not found"
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class ConflictErrorResponse(BaseModel):
    """Conflict error response."""
    success: bool = False
    error: Dict[str, Any]
    message: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class TooManyRequestsErrorResponse(BaseModel):
    """Rate limit error response."""
    success: bool = False
    error: Dict[str, Any]
    message: str = "Too many requests"
    retry_after: Optional[int] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class ServiceUnavailableErrorResponse(BaseModel):
    """Service unavailable error response."""
    success: bool = False
    error: Dict[str, Any]
    message: str = "Service temporarily unavailable"
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


# Response builders for easy usage
class ResponseBuilder:
    """Utility class for building standardized responses."""
    
    @staticmethod
    def success(data: Any = None, message: str = None) -> Dict[str, Any]:
        """Build a success response."""
        response = {
            "success": True,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        if data is not None:
            response["data"] = data
        if message:
            response["message"] = message
        return response
    
    @staticmethod
    def paginated(data: List[Any], page: int, limit: int, total: int, message: str = None) -> Dict[str, Any]:
        """Build a paginated response."""
        return {
            "success": True,
            "data": data,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "pages": (total + limit - 1) // limit,
                "has_next": page * limit < total,
                "has_prev": page > 1
            },
            "message": message,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    
    @staticmethod
    def error(message: str, error_type: str = "internal_server_error", details: Any = None, status_code: int = 500) -> Dict[str, Any]:
        """Build an error response."""
        error_response = {
            "success": False,
            "error": {
                "type": error_type,
                "message": message,
                "status_code": status_code
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        if details:
            error_response["error"]["details"] = details
        return error_response
    
    @staticmethod
    def validation_error(message: str, details: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Build a validation error response."""
        return {
            "success": False,
            "error": {
                "type": "validation_error",
                "message": message,
                "details": details,
                "status_code": 422
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    
    @staticmethod
    def not_found(resource: str = "Resource") -> Dict[str, Any]:
        """Build a not found error response."""
        return {
            "success": False,
            "error": {
                "type": "not_found",
                "message": f"{resource} not found",
                "status_code": 404
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    
    @staticmethod
    def unauthorized(message: str = "Unauthorized") -> Dict[str, Any]:
        """Build an unauthorized error response."""
        return {
            "success": False,
            "error": {
                "type": "unauthorized",
                "message": message,
                "status_code": 401
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    
    @staticmethod
    def forbidden(message: str = "Forbidden") -> Dict[str, Any]:
        """Build a forbidden error response."""
        return {
            "success": False,
            "error": {
                "type": "forbidden",
                "message": message,
                "status_code": 403
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    
    @staticmethod
    def conflict(message: str) -> Dict[str, Any]:
        """Build a conflict error response."""
        return {
            "success": False,
            "error": {
                "type": "conflict",
                "message": message,
                "status_code": 409
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    
    @staticmethod
    def too_many_requests(message: str = "Too many requests", retry_after: int = None) -> Dict[str, Any]:
        """Build a rate limit error response."""
        response = {
            "success": False,
            "error": {
                "type": "too_many_requests",
                "message": message,
                "status_code": 429
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        if retry_after:
            response["error"]["retry_after"] = retry_after
        return response
    
    @staticmethod
    def service_unavailable(message: str = "Service temporarily unavailable") -> Dict[str, Any]:
        """Build a service unavailable error response."""
        return {
            "success": False,
            "error": {
                "type": "service_unavailable",
                "message": message,
                "status_code": 503
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        }


# Standard HTTP status codes with messages
class StatusMessages:
    """Standard status messages for HTTP codes."""
    
    SUCCESS = "Operation completed successfully"
    CREATED = "Resource created successfully"
    UPDATED = "Resource updated successfully"
    DELETED = "Resource deleted successfully"
    
    BAD_REQUEST = "Invalid request"
    UNAUTHORIZED = "Authentication required"
    FORBIDDEN = "Access denied"
    NOT_FOUND = "Resource not found"
    CONFLICT = "Resource conflict"
    VALIDATION_ERROR = "Validation failed"
    TOO_MANY_REQUESTS = "Rate limit exceeded"
    INTERNAL_ERROR = "Internal server error"
    SERVICE_UNAVAILABLE = "Service temporarily unavailable"
    
    @staticmethod
    def get_message(status_code: int) -> str:
        """Get standard message for status code."""
        messages = {
            200: StatusMessages.SUCCESS,
            201: StatusMessages.CREATED,
            204: StatusMessages.DELETED,
            400: StatusMessages.BAD_REQUEST,
            401: StatusMessages.UNAUTHORIZED,
            403: StatusMessages.FORBIDDEN,
            404: StatusMessages.NOT_FOUND,
            409: StatusMessages.CONFLICT,
            422: StatusMessages.VALIDATION_ERROR,
            429: StatusMessages.TOO_MANY_REQUESTS,
            500: StatusMessages.INTERNAL_ERROR,
            503: StatusMessages.SERVICE_UNAVAILABLE,
        }
        return messages.get(status_code, StatusMessages.INTERNAL_ERROR)
