"""
Health Check Utilities for Aarya Clothing Microservices

This module provides standardized health check endpoints for all services.
All services should use the same health check format for consistency.

Usage:
    from shared.health_check import create_health_router, HealthChecker
    
    app.include_router(create_health_router(service_name="core"))
"""

from fastapi import APIRouter, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
import logging

from shared.time_utils import now_ist

logger = logging.getLogger(__name__)


class HealthStatus(BaseModel):
    """Standard health check response model."""
    
    status: str = Field(default="healthy", description="Service health status")
    service: str = Field(..., description="Service name")
    version: Optional[str] = Field(default=None, description="Service version")
    timestamp: datetime = Field(default_factory=now_ist, description="Health check timestamp (IST)")
    environment: Optional[str] = Field(default=None, description="Environment (development/production)")
    dependencies: Optional[Dict[str, Any]] = Field(default=None, description="Dependency health status")


class HealthChecker:
    """
    Health checker class for performing health checks on service dependencies.
    
    Usage:
        checker = HealthChecker(service_name="core")
        
        # Add dependency checks
        checker.add_check("database", check_database_connection)
        checker.add_check("redis", check_redis_connection)
        
        # Get health status
        health = checker.check()
    """
    
    def __init__(
        self,
        service_name: str,
        version: str = None,
        environment: str = None
    ):
        self.service_name = service_name
        self.version = version
        self.environment = environment
        self._checks: Dict[str, callable] = {}
    
    def add_check(self, name: str, check_func: callable):
        """
        Add a dependency health check.
        
        Args:
            name: Name of the dependency (e.g., "database", "redis")
            check_func: Function that returns True if healthy, False otherwise
        """
        self._checks[name] = check_func
    
    def check(self) -> HealthStatus:
        """
        Perform all health checks and return the status.
        
        Returns:
            HealthStatus with results of all checks
        """
        dependencies = {}
        all_healthy = True
        
        for name, check_func in self._checks.items():
            try:
                result = check_func()
                if isinstance(result, bool):
                    dependencies[name] = {"status": "healthy" if result else "unhealthy"}
                    if not result:
                        all_healthy = False
                elif isinstance(result, dict):
                    dependencies[name] = result
                    if result.get("status") != "healthy":
                        all_healthy = False
                else:
                    dependencies[name] = {"status": "healthy"}
            except Exception as e:
                logger.error(f"Health check failed for {name}: {e}")
                dependencies[name] = {"status": "unhealthy", "error": str(e)}
                all_healthy = False
        
        return HealthStatus(
            status="healthy" if all_healthy else "unhealthy",
            service=self.service_name,
            version=self.version,
            environment=self.environment,
            dependencies=dependencies if dependencies else None,
        )


def create_health_router(
    service_name: str,
    version: str = None,
    environment: str = None,
    health_checker: HealthChecker = None,
    prefix: str = "/api/v1"
) -> APIRouter:
    """
    Create a health check router with standardized endpoints.
    
    Args:
        service_name: Name of the service
        version: Service version
        environment: Environment (development/production)
        health_checker: Optional HealthChecker instance with dependency checks
        prefix: API prefix (default: /api/v1)
    
    Returns:
        APIRouter with health check endpoints
    
    Endpoints:
        GET /api/v1/health - Full health check with dependencies
        GET /api/v1/health/live - Liveness probe (Kubernetes)
        GET /api/v1/health/ready - Readiness probe (Kubernetes)
    """
    router = APIRouter(tags=["Health"])
    
    checker = health_checker or HealthChecker(
        service_name=service_name,
        version=version,
        environment=environment
    )
    
    @router.get("/health", response_model=HealthStatus)
    async def health_check():
        """
        Full health check with dependency status.
        
        Returns detailed health information including:
        - Service status
        - Dependency status (database, redis, etc.)
        - Service metadata
        """
        health = checker.check()
        
        if health.status == "unhealthy":
            return JSONResponse(
                status_code=503,
                content=health.model_dump(mode='json')
            )
        
        return health
    
    @router.get("/health/live")
    async def liveness_probe():
        """
        Liveness probe for Kubernetes.
        
        Returns 200 if the service is running.
        This endpoint should always return 200 if the service is alive.
        """
        return {"status": "alive", "service": service_name}
    
    @router.get("/health/ready")
    async def readiness_probe():
        """
        Readiness probe for Kubernetes.
        
        Returns 200 if the service is ready to accept traffic.
        This checks if all critical dependencies are available.
        """
        health = checker.check()
        
        if health.status == "unhealthy":
            return JSONResponse(
                status_code=503,
                content={"status": "not_ready", "service": service_name}
            )
        
        return {"status": "ready", "service": service_name}
    
    return router


def check_database_health(db_session_factory) -> callable:
    """
    Create a database health check function.
    
    Args:
        db_session_factory: Function that creates a database session
    
    Returns:
        Health check function for database
    """
    def check():
        try:
            # Try to get a session and execute a simple query
            session = db_session_factory()
            session.execute("SELECT 1")
            session.close()
            return {"status": "healthy"}
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return {"status": "unhealthy", "error": str(e)}
    
    return check


def check_redis_health(redis_client) -> callable:
    """
    Create a Redis health check function.
    
    Args:
        redis_client: Redis client instance
    
    Returns:
        Health check function for Redis
    """
    def check():
        try:
            if redis_client.ping():
                return {"status": "healthy"}
            return {"status": "unhealthy", "error": "Ping failed"}
        except Exception as e:
            logger.error(f"Redis health check failed: {e}")
            return {"status": "unhealthy", "error": str(e)}
    
    return check


# Convenience function for simple health checks
def simple_health_check(service_name: str) -> Dict[str, Any]:
    """
    Simple health check without dependencies.
    
    Args:
        service_name: Name of the service
    
    Returns:
        Basic health status dictionary
    """
    return {
        "status": "healthy",
        "service": service_name,
        "timestamp": now_ist().isoformat(),
    }
