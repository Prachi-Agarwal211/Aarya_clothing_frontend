"""
Monitoring middleware for FastAPI applications.
Provides request tracking, metrics collection, and performance monitoring.
"""
import time
import logging
import asyncio
from typing import Callable, Optional
from datetime import datetime, timezone
from functools import wraps

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

logger = logging.getLogger(__name__)

# Try to import prometheus client if available
try:
    from prometheus_client import Counter, Histogram, Gauge, Info
    PROMETHEUS_AVAILABLE = True
except ImportError:
    PROMETHEUS_AVAILABLE = False
    logger.warning("prometheus_client not installed - metrics collection disabled")


# ==================== Metrics Definitions ====================

if PROMETHEUS_AVAILABLE:
    # Request metrics
    REQUEST_COUNT = Counter(
        'http_requests_total',
        'Total HTTP requests',
        ['method', 'endpoint', 'status', 'service']
    )
    
    REQUEST_LATENCY = Histogram(
        'http_request_duration_seconds',
        'HTTP request latency',
        ['method', 'endpoint', 'service'],
        buckets=[0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1.0, 2.5, 5.0, 7.5, 10.0]
    )
    
    REQUEST_IN_PROGRESS = Gauge(
        'http_requests_in_progress',
        'HTTP requests in progress',
        ['method', 'service']
    )
    
    # Database metrics
    DB_QUERY_COUNT = Counter(
        'db_queries_total',
        'Total database queries',
        ['operation', 'table', 'service']
    )
    
    DB_QUERY_LATENCY = Histogram(
        'db_query_duration_seconds',
        'Database query latency',
        ['operation', 'table', 'service'],
        buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0]
    )
    
    DB_CONNECTIONS = Gauge(
        'db_connections_in_use',
        'Database connections in use',
        ['service']
    )
    
    # Cache metrics
    CACHE_HITS = Counter(
        'cache_hits_total',
        'Total cache hits',
        ['cache_type', 'service']
    )
    
    CACHE_MISSES = Counter(
        'cache_misses_total',
        'Total cache misses',
        ['cache_type', 'service']
    )
    
    # Business metrics
    ORDER_COUNT = Counter(
        'orders_total',
        'Total orders',
        ['status', 'service']
    )
    
    ORDER_VALUE = Histogram(
        'order_value_rupees',
        'Order value in rupees',
        ['service'],
        buckets=[100, 500, 1000, 2000, 5000, 10000, 20000, 50000]
    )
    
    # Error tracking
    ERROR_COUNT = Counter(
        'errors_total',
        'Total errors',
        ['error_type', 'endpoint', 'service']
    )
    
    # Service info
    SERVICE_INFO = Info(
        'service',
        'Service information'
    )


# ==================== Monitoring Middleware ====================

class MonitoringMiddleware(BaseHTTPMiddleware):
    """
    Middleware for collecting request metrics.
    
    Collects:
    - Request count by method, endpoint, status
    - Request latency
    - Requests in progress
    - Error tracking
    """
    
    def __init__(
        self,
        app: ASGIApp,
        service_name: str = "unknown",
        exclude_paths: list = None,
        enable_prometheus: bool = True
    ):
        """
        Initialize monitoring middleware.
        
        Args:
            app: ASGI application
            service_name: Name of the service
            exclude_paths: Paths to exclude from monitoring
            enable_prometheus: Whether to enable Prometheus metrics
        """
        super().__init__(app)
        self.service_name = service_name
        self.exclude_paths = exclude_paths or ["/health", "/metrics", "/docs", "/openapi.json"]
        self.enable_prometheus = enable_prometheus and PROMETHEUS_AVAILABLE
        
        if self.enable_prometheus:
            SERVICE_INFO.info({
                'service': service_name,
                'version': '1.0.0'
            })
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request and collect metrics."""
        # Skip excluded paths
        if any(request.url.path.startswith(path) for path in self.exclude_paths):
            return await call_next(request)
        
        # Get endpoint pattern (replace path params with placeholders)
        endpoint = self._get_endpoint_pattern(request)
        method = request.method
        
        # Track in-progress requests
        if self.enable_prometheus:
            REQUEST_IN_PROGRESS.labels(method=method, service=self.service_name).inc()
        
        # Time the request
        start_time = time.time()
        status_code = 500
        
        try:
            response = await call_next(request)
            status_code = response.status_code
            return response
        except Exception as e:
            # Track errors
            if self.enable_prometheus:
                ERROR_COUNT.labels(
                    error_type=type(e).__name__,
                    endpoint=endpoint,
                    service=self.service_name
                ).inc()
            raise
        finally:
            # Calculate duration
            duration = time.time() - start_time
            
            # Record metrics
            if self.enable_prometheus:
                REQUEST_IN_PROGRESS.labels(method=method, service=self.service_name).dec()
                REQUEST_COUNT.labels(
                    method=method,
                    endpoint=endpoint,
                    status=str(status_code),
                    service=self.service_name
                ).inc()
                REQUEST_LATENCY.labels(
                    method=method,
                    endpoint=endpoint,
                    service=self.service_name
                ).observe(duration)
            
            # Log slow requests
            if duration > 1.0:
                logger.warning(
                    f"Slow request: {method} {endpoint} took {duration:.2f}s"
                )
    
    def _get_endpoint_pattern(self, request: Request) -> str:
        """Get endpoint pattern with path parameters replaced."""
        path = request.url.path
        
        # Try to get route pattern from FastAPI
        if hasattr(request, 'scope') and 'route' in request.scope:
            route = request.scope['route']
            if hasattr(route, 'path'):
                return route.path
        
        # Fallback: replace numeric IDs with placeholder
        import re
        path = re.sub(r'/\d+', '/{id}', path)
        return path


# ==================== Database Query Tracker ====================

class QueryTracker:
    """Track database query performance."""
    
    def __init__(self, service_name: str = "unknown"):
        self.service_name = service_name
        self.enable_prometheus = PROMETHEUS_AVAILABLE
    
    def track_query(self, operation: str, table: str, duration: float):
        """Track a database query."""
        if self.enable_prometheus:
            DB_QUERY_COUNT.labels(
                operation=operation,
                table=table,
                service=self.service_name
            ).inc()
            DB_QUERY_LATENCY.labels(
                operation=operation,
                table=table,
                service=self.service_name
            ).observe(duration)
    
    def track_connection(self, in_use: int):
        """Track database connections."""
        if self.enable_prometheus:
            DB_CONNECTIONS.labels(service=self.service_name).set(in_use)


# ==================== Cache Metrics Tracker ====================

class CacheMetrics:
    """Track cache hit/miss rates."""
    
    def __init__(self, service_name: str = "unknown"):
        self.service_name = service_name
        self.enable_prometheus = PROMETHEUS_AVAILABLE
    
    def track_hit(self, cache_type: str = "redis"):
        """Track cache hit."""
        if self.enable_prometheus:
            CACHE_HITS.labels(
                cache_type=cache_type,
                service=self.service_name
            ).inc()
    
    def track_miss(self, cache_type: str = "redis"):
        """Track cache miss."""
        if self.enable_prometheus:
            CACHE_MISSES.labels(
                cache_type=cache_type,
                service=self.service_name
            ).inc()


# ==================== Business Metrics Tracker ====================

class BusinessMetrics:
    """Track business-specific metrics."""
    
    def __init__(self, service_name: str = "unknown"):
        self.service_name = service_name
        self.enable_prometheus = PROMETHEUS_AVAILABLE
    
    def track_order(self, status: str, value: float = None):
        """Track order creation."""
        if self.enable_prometheus:
            ORDER_COUNT.labels(
                status=status,
                service=self.service_name
            ).inc()
            if value is not None:
                ORDER_VALUE.labels(service=self.service_name).observe(value)
    
    def track_error(self, error_type: str, endpoint: str):
        """Track application error."""
        if self.enable_prometheus:
            ERROR_COUNT.labels(
                error_type=error_type,
                endpoint=endpoint,
                service=self.service_name
            ).inc()


# ==================== Request Context ====================

class RequestContext:
    """Context for tracking request-specific metrics."""
    
    _current: dict = {}
    
    @classmethod
    def set(cls, key: str, value: any):
        """Set a context value."""
        cls._current[key] = value
    
    @classmethod
    def get(cls, key: str, default: any = None):
        """Get a context value."""
        return cls._current.get(key, default)
    
    @classmethod
    def clear(cls):
        """Clear all context values."""
        cls._current.clear()
    
    @classmethod
    def get_all(cls) -> dict:
        """Get all context values."""
        return cls._current.copy()


# ==================== Decorators ====================

def track_time(operation_name: str = None):
    """
    Decorator to track function execution time.
    
    Example:
        @track_time("database_query")
        def get_products():
            ...
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            start = time.time()
            try:
                return func(*args, **kwargs)
            finally:
                duration = time.time() - start
                name = operation_name or func.__name__
                logger.debug(f"{name} took {duration:.4f}s")
        return wrapper
    return decorator


def track_async_time(operation_name: str = None):
    """
    Decorator to track async function execution time.
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            start = time.time()
            try:
                return await func(*args, **kwargs)
            finally:
                duration = time.time() - start
                name = operation_name or func.__name__
                logger.debug(f"{name} took {duration:.4f}s")
        return wrapper
    return decorator


def track_errors(error_type: str = None):
    """
    Decorator to track errors in functions.
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                if PROMETHEUS_AVAILABLE:
                    ERROR_COUNT.labels(
                        error_type=error_type or type(e).__name__,
                        endpoint=func.__name__,
                        service="unknown"
                    ).inc()
                raise
        return wrapper
    return decorator


# ==================== Health Check ====================

class HealthChecker:
    """
    Health check utility for services.
    
    Checks:
    - Database connectivity
    - Redis connectivity
    - External service availability
    """
    
    def __init__(self, service_name: str = "unknown"):
        self.service_name = service_name
        self.checks = {}
    
    def register_check(self, name: str, check_func: Callable):
        """Register a health check function."""
        self.checks[name] = check_func
    
    async def run_checks(self) -> dict:
        """Run all health checks."""
        results = {
            "service": self.service_name,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "status": "healthy",
            "checks": {}
        }
        
        for name, check_func in self.checks.items():
            try:
                if asyncio.iscoroutinefunction(check_func):
                    result = await check_func()
                else:
                    result = check_func()
                
                results["checks"][name] = {
                    "status": "healthy" if result else "unhealthy",
                    "details": result if isinstance(result, dict) else None
                }
                
                if not result or (isinstance(result, dict) and result.get("status") == "unhealthy"):
                    results["status"] = "unhealthy"
                    
            except Exception as e:
                results["checks"][name] = {
                    "status": "error",
                    "error": str(e)
                }
                results["status"] = "unhealthy"
        
        return results


# ==================== Setup Function ====================

def setup_monitoring(app, service_name: str, exclude_paths: list = None):
    """
    Setup monitoring for a FastAPI application.
    
    Args:
        app: FastAPI application
        service_name: Name of the service
        exclude_paths: Paths to exclude from monitoring
        
    Returns:
        Tuple of (query_tracker, cache_metrics, business_metrics)
    """
    # Add monitoring middleware
    app.add_middleware(
        MonitoringMiddleware,
        service_name=service_name,
        exclude_paths=exclude_paths
    )
    
    # Create trackers
    query_tracker = QueryTracker(service_name)
    cache_metrics = CacheMetrics(service_name)
    business_metrics = BusinessMetrics(service_name)
    
    # Add metrics endpoint if Prometheus is available
    if PROMETHEUS_AVAILABLE:
        from prometheus_client import make_asgi_app
        metrics_app = make_asgi_app()
        app.mount("/metrics", metrics_app)
    
    return query_tracker, cache_metrics, business_metrics
