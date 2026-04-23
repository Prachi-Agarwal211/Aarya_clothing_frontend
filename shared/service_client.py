"""
Inter-service communication client.
Provides a unified interface for services to communicate with each other.
"""
import httpx
import logging
import os
from typing import Optional, Dict, Any, List
from functools import lru_cache
from shared.time_utils import now_ist

logger = logging.getLogger(__name__)


class ServiceConfig:
    """Configuration for microservices - loaded from environment variables."""
    
    # Service URLs - loaded from environment with Docker service name defaults
    # In Docker, services communicate using service names
    CORE_SERVICE_URL: str = os.getenv("CORE_SERVICE_URL", "http://core:5001")
    COMMERCE_SERVICE_URL: str = os.getenv("COMMERCE_SERVICE_URL", "http://commerce:5002")
    PAYMENT_SERVICE_URL: str = os.getenv("PAYMENT_SERVICE_URL", "http://payment:5003")
    ADMIN_SERVICE_URL: str = os.getenv("ADMIN_SERVICE_URL", "http://admin:5004")
    
    # Timeouts
    DEFAULT_TIMEOUT: float = float(os.getenv("SERVICE_TIMEOUT", "30.0"))
    PAYMENT_TIMEOUT: float = float(os.getenv("PAYMENT_TIMEOUT", "60.0"))
    
    # Retry configuration
    MAX_RETRIES: int = int(os.getenv("SERVICE_MAX_RETRIES", "3"))
    RETRY_DELAY: float = float(os.getenv("SERVICE_RETRY_DELAY", "1.0"))


class ServiceClient:
    """
    HTTP client for inter-service communication.
    
    Provides:
    - Service discovery
    - Request/response handling
    - Error handling
    - Authentication forwarding
    - Circuit breaker pattern
    """
    
    def __init__(self, base_url: str, timeout: float = ServiceConfig.DEFAULT_TIMEOUT):
        """
        Initialize service client.
        
        Args:
            base_url: Base URL for the service
            timeout: Request timeout in seconds
        """
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._client: Optional[httpx.AsyncClient] = None
    
    async def __aenter__(self):
        """Async context manager entry."""
        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=self.timeout,
            follow_redirects=True
        )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if self._client:
            await self._client.aclose()
            self._client = None
    
    def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=self.timeout,
                follow_redirects=True
            )
        return self._client
    
    async def request(
        self,
        method: str,
        endpoint: str,
        *,
        json: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        auth_token: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Make HTTP request to service.
        
        Args:
            method: HTTP method
            endpoint: API endpoint (without base URL)
            json: JSON body
            params: Query parameters
            headers: Additional headers
            auth_token: JWT token to forward
            
        Returns:
            Response JSON
            
        Raises:
            ServiceError: If request fails
        """
        client = self._get_client()
        
        # Prepare headers
        request_headers = {
            "Content-Type": "application/json",
            "X-Service-Request": "true",
            "X-Request-Timestamp": now_ist().isoformat()
        }
        
        if auth_token:
            request_headers["Authorization"] = f"Bearer {auth_token}"
        
        if headers:
            request_headers.update(headers)
        
        # Make request
        try:
            response = await client.request(
                method=method,
                url=endpoint,
                json=json,
                params=params,
                headers=request_headers
            )
            
            response.raise_for_status()
            return response.json()
            
        except httpx.TimeoutException as e:
            logger.error(f"Service request timeout: {method} {endpoint}")
            raise ServiceError(
                service=self.base_url,
                endpoint=endpoint,
                message="Request timeout",
                status_code=504
            ) from e
            
        except httpx.HTTPStatusError as e:
            logger.error(f"Service request failed: {e.response.status_code} - {method} {endpoint}")
            raise ServiceError(
                service=self.base_url,
                endpoint=endpoint,
                message=e.response.text,
                status_code=e.response.status_code
            ) from e
            
        except httpx.RequestError as e:
            logger.error(f"Service request error: {str(e)} - {method} {endpoint}")
            raise ServiceError(
                service=self.base_url,
                endpoint=endpoint,
                message=str(e),
                status_code=503
            ) from e
    
    async def get(self, endpoint: str, **kwargs) -> Dict[str, Any]:
        """GET request."""
        return await self.request("GET", endpoint, **kwargs)
    
    async def post(self, endpoint: str, **kwargs) -> Dict[str, Any]:
        """POST request."""
        return await self.request("POST", endpoint, **kwargs)
    
    async def put(self, endpoint: str, **kwargs) -> Dict[str, Any]:
        """PUT request."""
        return await self.request("PUT", endpoint, **kwargs)
    
    async def patch(self, endpoint: str, **kwargs) -> Dict[str, Any]:
        """PATCH request."""
        return await self.request("PATCH", endpoint, **kwargs)
    
    async def delete(self, endpoint: str, **kwargs) -> Dict[str, Any]:
        """DELETE request."""
        return await self.request("DELETE", endpoint, **kwargs)
    
    async def health_check(self) -> bool:
        """Check if service is healthy."""
        try:
            response = await self.get("/health")
            return response.get("status") == "healthy"
        except Exception:
            return False
    
    async def close(self):
        """Close the HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None


class ServiceError(Exception):
    """Exception raised for service communication errors."""
    
    def __init__(
        self,
        service: str,
        endpoint: str,
        message: str,
        status_code: int = 500
    ):
        self.service = service
        self.endpoint = endpoint
        self.message = message
        self.status_code = status_code
        super().__init__(f"Service error [{service}]{endpoint}: {message}")


# ==================== Service-Specific Clients ====================

class CoreServiceClient(ServiceClient):
    """Client for Core service (user management, authentication)."""
    
    def __init__(self):
        super().__init__(ServiceConfig.CORE_SERVICE_URL)
    
    async def get_user(self, user_id: int, auth_token: str = None) -> Dict[str, Any]:
        """Get user by ID."""
        return await self.get(f"/api/v1/users/{user_id}", auth_token=auth_token)
    
    async def get_user_by_email(self, email: str, auth_token: str = None) -> Dict[str, Any]:
        """Get user by email."""
        return await self.get("/api/v1/users/by-email", params={"email": email}, auth_token=auth_token)
    
    async def verify_user(self, user_id: int, auth_token: str = None) -> bool:
        """Verify user exists and is active."""
        try:
            user = await self.get_user(user_id, auth_token)
            return user.get("is_active", False)
        except ServiceError:
            return False
    
    async def update_user_stats(
        self,
        user_id: int,
        stats: Dict[str, Any],
        auth_token: str = None
    ) -> Dict[str, Any]:
        """Update user statistics (order count, total spent, etc.)."""
        return await self.patch(
            f"/api/v1/users/{user_id}/stats",
            json=stats,
            auth_token=auth_token
        )


class PaymentServiceClient(ServiceClient):
    """Client for Payment service."""
    
    def __init__(self):
        super().__init__(ServiceConfig.PAYMENT_SERVICE_URL, timeout=ServiceConfig.PAYMENT_TIMEOUT)
    
    async def create_payment(
        self,
        order_id: int,
        amount: float,
        currency: str = "INR",
        payment_method: str = None,
        auth_token: str = None
    ) -> Dict[str, Any]:
        """Create a new payment."""
        payload = {
            "order_id": order_id,
            "amount": amount,
            "currency": currency
        }
        if payment_method:
            payload["payment_method"] = payment_method
        
        return await self.post("/api/v1/payments", json=payload, auth_token=auth_token)
    
    async def get_payment(self, payment_id: str, auth_token: str = None) -> Dict[str, Any]:
        """Get payment by ID."""
        return await self.get(f"/api/v1/payments/{payment_id}", auth_token=auth_token)
    
    async def get_payment_by_order(self, order_id: int, auth_token: str = None) -> Dict[str, Any]:
        """Get payment by order ID."""
        return await self.get(f"/api/v1/payments/order/{order_id}", auth_token=auth_token)
    
    async def verify_payment(self, payment_id: str, auth_token: str = None) -> Dict[str, Any]:
        """Verify payment status."""
        return await self.post(f"/api/v1/payments/{payment_id}/verify", auth_token=auth_token)
    
    async def refund_payment(
        self,
        payment_id: str,
        amount: float = None,
        reason: str = None,
        auth_token: str = None
    ) -> Dict[str, Any]:
        """Initiate refund for a payment."""
        payload = {}
        if amount:
            payload["amount"] = amount
        if reason:
            payload["reason"] = reason
        
        return await self.post(
            f"/api/v1/payments/{payment_id}/refund",
            json=payload,
            auth_token=auth_token
        )
    
    async def capture_payment(self, payment_id: str, auth_token: str = None) -> Dict[str, Any]:
        """Capture an authorized payment."""
        return await self.post(f"/api/v1/payments/{payment_id}/capture", auth_token=auth_token)


class CommerceServiceClient(ServiceClient):
    """Client for Commerce service (products, orders, cart)."""
    
    def __init__(self):
        super().__init__(ServiceConfig.COMMERCE_SERVICE_URL)
    
    async def get_product(self, product_id: int, auth_token: str = None) -> Dict[str, Any]:
        """Get product by ID."""
        return await self.get(f"/api/v1/products/{product_id}", auth_token=auth_token)
    
    async def get_order(self, order_id: int, auth_token: str = None) -> Dict[str, Any]:
        """Get order by ID."""
        return await self.get(f"/api/v1/orders/{order_id}", auth_token=auth_token)
    
    async def update_order_status(
        self,
        order_id: int,
        status: str,
        auth_token: str = None
    ) -> Dict[str, Any]:
        """Update order status."""
        return await self.patch(
            f"/api/v1/admin/orders/{order_id}/status",
            json={"status": status},
            auth_token=auth_token
        )
    
    async def check_inventory(
        self,
        product_id: int,
        quantity: int,
        auth_token: str = None
    ) -> bool:
        """Check if product has sufficient inventory."""
        try:
            response = await self.get(
                f"/api/v1/inventory/check/{product_id}",
                params={"quantity": quantity},
                auth_token=auth_token
            )
            return response.get("available", False)
        except ServiceError:
            return False
    
    async def reserve_inventory(
        self,
        product_id: int,
        quantity: int,
        order_id: int,
        auth_token: str = None
    ) -> Dict[str, Any]:
        """Reserve inventory for an order."""
        return await self.post(
            "/api/v1/inventory/reserve",
            json={
                "product_id": product_id,
                "quantity": quantity,
                "order_id": order_id
            },
            auth_token=auth_token
        )


class AdminServiceClient(ServiceClient):
    """Client for Admin service."""
    
    def __init__(self):
        super().__init__(ServiceConfig.ADMIN_SERVICE_URL)
    
    async def get_analytics(
        self,
        metric: str,
        period: str = "day",
        auth_token: str = None
    ) -> Dict[str, Any]:
        """Get analytics data."""
        return await self.get(
            "/api/v1/admin/analytics",
            params={"metric": metric, "period": period},
            auth_token=auth_token
        )
    
    async def log_admin_action(
        self,
        action: str,
        resource: str,
        resource_id: int = None,
        details: Dict[str, Any] = None,
        auth_token: str = None
    ) -> Dict[str, Any]:
        """Log admin action for audit."""
        payload = {
            "action": action,
            "resource": resource
        }
        if resource_id:
            payload["resource_id"] = resource_id
        if details:
            payload["details"] = details
        
        return await self.post(
            "/api/v1/admin/audit-log",
            json=payload,
            auth_token=auth_token
        )


# ==================== Factory Functions ====================

@lru_cache()
def get_core_client() -> CoreServiceClient:
    """Get cached Core service client."""
    return CoreServiceClient()


@lru_cache()
def get_payment_client() -> PaymentServiceClient:
    """Get cached Payment service client."""
    return PaymentServiceClient()


@lru_cache()
def get_commerce_client() -> CommerceServiceClient:
    """Get cached Commerce service client."""
    return CommerceServiceClient()


@lru_cache()
def get_admin_client() -> AdminServiceClient:
    """Get cached Admin service client."""
    return AdminServiceClient()
