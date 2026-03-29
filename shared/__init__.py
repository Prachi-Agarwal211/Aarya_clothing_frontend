"""
Shared Module for Aarya Clothing Microservices

This package contains shared utilities, configurations, and middleware
that are used across all microservices.

Available modules:
- base_config: Shared configuration classes
- base_schemas: Shared Pydantic schema classes
- auth_middleware: Shared authentication middleware
- token_validator: JWT token validation utilities
- health_check: Standardized health check endpoints
- unified_redis_client: Unified Redis client for all services
- service_client: Inter-service communication client
- smart_cache: Intelligent caching utilities
- event_bus: Event-driven architecture support
- background_tasks: Async task processing
- monitoring_middleware: Performance monitoring
- query_optimizations: Database query optimization
- response_schemas: Standardized API response formats
"""

# Base configuration - use relative imports for package compatibility
from .base_config import (
    BaseSettings,
    DatabaseSettings,
    RedisSettings,
    SecuritySettings,
    ServiceUrls,
    get_settings_cached,
    get_settings_factory,
    service_urls,
)

# Base schemas
from .base_schemas import (
    BaseSchema,
    TimestampMixin,
    IDMixin,
    ActiveMixin,
    PaginatedResponse,
    ErrorResponse,
    SuccessResponse,
    HealthCheckResponse,
    MessageResponse,
    ValidationErrorDetail,
    ValidationErrorResponse,
)

# Health check utilities
from .health_check import (
    HealthChecker,
    HealthStatus,
    create_health_router,
    check_database_health,
    check_redis_health,
    simple_health_check,
)

__all__ = [
    # Configuration
    'BaseSettings',
    'DatabaseSettings',
    'RedisSettings',
    'SecuritySettings',
    'ServiceUrls',
    'get_settings_cached',
    'get_settings_factory',
    'service_urls',
    
    # Schemas
    'BaseSchema',
    'TimestampMixin',
    'IDMixin',
    'ActiveMixin',
    'PaginatedResponse',
    'ErrorResponse',
    'SuccessResponse',
    'HealthCheckResponse',
    'MessageResponse',
    'ValidationErrorDetail',
    'ValidationErrorResponse',
    
    # Health check
    'HealthChecker',
    'HealthStatus',
    'create_health_router',
    'check_database_health',
    'check_redis_health',
    'simple_health_check',
]
