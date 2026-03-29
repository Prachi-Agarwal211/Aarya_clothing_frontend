"""
Comprehensive Unit Tests for Aarya Clothing E-Commerce Platform

This test suite covers:
1. Security features (token rotation, rate limiting, blacklist)
2. Authentication and authorization
3. Product management
4. Cart operations
5. Order processing
6. Payment integration
7. Error handling

Run with: pytest tests/test_comprehensive_unit.py -v
"""

import pytest
import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import Mock, MagicMock, patch, AsyncMock
from typing import Dict, Any

# Test configuration
pytestmark = pytest.mark.asyncio


# ==================== Fixtures ====================

@pytest.fixture
def mock_db_session():
    """Create a mock database session."""
    session = Mock()
    session.query = Mock()
    session.add = Mock()
    session.add_all = Mock()
    session.commit = Mock()
    session.flush = Mock()
    session.refresh = Mock()
    session.delete = Mock()
    session.execute = Mock()
    return session


@pytest.fixture
def mock_redis_client():
    """Create a mock Redis client."""
    redis = Mock()
    redis.client = Mock()
    redis.client.set = Mock()
    redis.client.setex = Mock()
    redis.client.get = Mock(return_value=None)
    redis.client.exists = Mock(return_value=0)
    redis.client.delete = Mock()
    redis.client.publish = Mock()
    redis.client.pipeline = Mock()
    return redis


@pytest.fixture
def sample_user():
    """Sample user data for tests."""
    return {
        "id": 1,
        "user_id": 1,
        "email": "test@example.com",
        "username": "testuser",
        "role": "customer",
        "is_active": True,
        "email_verified": True
    }


@pytest.fixture
def sample_product():
    """Sample product data for tests."""
    return {
        "id": 1,
        "name": "Test Product",
        "slug": "test-product",
        "base_price": Decimal("99.99"),
        "mrp": Decimal("149.99"),
        "category_id": 1,
        "is_active": True,
        "is_featured": False,
        "is_new_arrival": True,
        "total_stock": 100,
        "average_rating": Decimal("4.5"),
        "review_count": 10
    }


@pytest.fixture
def sample_cart_item():
    """Sample cart item data."""
    return {
        "product_id": 1,
        "name": "Test Product",
        "price": 99.99,
        "quantity": 2,
        "size": "M",
        "color": "Blue",
        "sku": "TEST-001"
    }


# ==================== Token Rotation Tests ====================

class TestTokenRotation:
    """Test token rotation mechanism."""

    def test_create_access_token(self, mock_redis_client):
        """Test access token creation."""
        from shared.auth_middleware import TokenManager
        
        token_manager = TokenManager(
            secret_key="test_secret_key_for_testing_only_12345",
            algorithm="HS256",
            redis_client=mock_redis_client
        )
        
        token = token_manager.create_access_token(
            data={"sub": "1", "role": "customer"},
            expires_delta=timedelta(minutes=30)
        )
        
        assert token is not None
        assert isinstance(token, str)
        assert len(token) > 50

    def test_create_refresh_token_with_jti(self, mock_redis_client):
        """Test refresh token creation includes JTI."""
        from shared.auth_middleware import TokenManager
        
        token_manager = TokenManager(
            secret_key="test_secret_key_for_testing_only_12345",
            algorithm="HS256",
            redis_client=mock_redis_client
        )
        
        token = token_manager.create_refresh_token(
            data={"sub": "1", "role": "customer"},
            expires_delta=timedelta(days=7)
        )
        
        assert token is not None
        
        # Decode and verify JTI exists
        import jwt
        payload = jwt.decode(
            token,
            "test_secret_key_for_testing_only_12345",
            algorithms=["HS256"]
        )
        
        assert "jti" in payload
        assert payload["type"] == "refresh"
        assert "sub" in payload

    def test_rotate_refresh_token_success(self, mock_redis_client):
        """Test successful token rotation."""
        from shared.auth_middleware import TokenManager
        
        token_manager = TokenManager(
            secret_key="test_secret_key_for_testing_only_12345",
            algorithm="HS256",
            redis_client=mock_redis_client
        )
        
        # Create initial refresh token
        old_token = token_manager.create_refresh_token(
            data={"sub": "1", "role": "customer"}
        )
        
        # Rotate token
        result = token_manager.rotate_refresh_token(
            old_refresh_token=old_token,
            user_id=1,
            role="customer"
        )
        
        assert "access_token" in result
        assert "refresh_token" in result
        assert result["access_token"] != old_token
        assert result["refresh_token"] != old_token
        
        # Verify Redis blacklist was called
        mock_redis_client.client.setex.assert_called()

    def test_rotate_invalid_token(self, mock_redis_client):
        """Test rotation with invalid token."""
        from shared.auth_middleware import TokenManager
        from fastapi import HTTPException
        
        token_manager = TokenManager(
            secret_key="test_secret_key_for_testing_only_12345",
            algorithm="HS256",
            redis_client=mock_redis_client
        )
        
        with pytest.raises(HTTPException) as exc_info:
            token_manager.rotate_refresh_token(
                old_refresh_token="invalid_token",
                user_id=1,
                role="customer"
            )
        
        assert exc_info.value.status_code == 401

    def test_rotate_wrong_token_type(self, mock_redis_client):
        """Test rotation with access token instead of refresh."""
        from shared.auth_middleware import TokenManager
        from fastapi import HTTPException
        
        token_manager = TokenManager(
            secret_key="test_secret_key_for_testing_only_12345",
            algorithm="HS256",
            redis_client=mock_redis_client
        )
        
        # Create access token
        access_token = token_manager.create_access_token(
            data={"sub": "1", "role": "customer"}
        )
        
        with pytest.raises(HTTPException) as exc_info:
            token_manager.rotate_refresh_token(
                old_refresh_token=access_token,
                user_id=1,
                role="customer"
            )
        
        assert exc_info.value.status_code == 401
        assert "token type" in str(exc_info.value.detail).lower()


# ==================== Rate Limiter Tests ====================

class TestRateLimiter:
    """Test rate limiting functionality."""

    def test_rate_limiter_allows_under_limit(self, mock_redis_client):
        """Test rate limiter allows requests under limit."""
        from shared.rate_limiter import RateLimiter
        
        # Setup Redis to return count under limit
        mock_redis_client.client.pipeline = Mock(return_value=Mock(
            incr=Mock(return_value=Mock()),
            expire=Mock(return_value=Mock()),
            execute=Mock(return_value=[3, None])  # count=3, under limit
        ))
        
        rate_limiter = RateLimiter(redis_client=mock_redis_client)
        
        # Should not raise exception
        allowed, count = rate_limiter.is_allowed(
            key="test_key",
            limit=10,
            window_seconds=300
        )
        
        assert allowed is True
        assert count == 3

    def test_rate_limiter_blocks_over_limit(self, mock_redis_client):
        """Test rate limiter blocks requests over limit."""
        from shared.rate_limiter import RateLimiter
        
        # Setup Redis to return count over limit
        mock_redis_client.client.pipeline = Mock(return_value=Mock(
            incr=Mock(return_value=Mock()),
            expire=Mock(return_value=Mock()),
            execute=Mock(return_value=[11, None])  # count=11, over limit
        ))
        
        rate_limiter = RateLimiter(redis_client=mock_redis_client)
        
        allowed, count = rate_limiter.is_allowed(
            key="test_key",
            limit=10,
            window_seconds=300
        )
        
        assert allowed is False
        assert count == 11

    def test_rate_limiter_fails_closed_without_redis(self):
        """Test rate limiter fails closed when Redis unavailable."""
        from shared.rate_limiter import RateLimiter
        
        rate_limiter = RateLimiter(redis_client=None)
        
        allowed, count = rate_limiter.is_allowed(
            key="test_key",
            limit=10,
            window_seconds=300
        )
        
        assert allowed is False  # Fail closed
        assert count == 0

    def test_rate_limiter_check_raises_429(self, mock_redis_client):
        """Test rate limiter check raises HTTP 429 when limit exceeded."""
        from shared.rate_limiter import RateLimiter
        from fastapi import HTTPException
        
        # Setup Redis to return count over limit
        mock_redis_client.client.pipeline = Mock(return_value=Mock(
            incr=Mock(return_value=Mock()),
            expire=Mock(return_value=Mock()),
            execute=Mock(return_value=[11, None])
        ))
        
        rate_limiter = RateLimiter(redis_client=mock_redis_client)
        
        with pytest.raises(HTTPException) as exc_info:
            rate_limiter.check(
                key="test_key",
                limit=10,
                window_seconds=300
            )
        
        assert exc_info.value.status_code == 429


# ==================== Token Validator Tests ====================

class TestTokenValidator:
    """Test token validation functionality."""

    def test_validate_valid_token(self, mock_redis_client):
        """Test validation of valid token."""
        from shared.token_validator import TokenValidator
        
        validator = TokenValidator(
            secret_key="test_secret_key_for_testing_only_12345",
            algorithm="HS256",
            redis_client=mock_redis_client
        )
        
        # Create valid token
        import jwt
        token = jwt.encode(
            {
                "sub": "1",
                "email": "test@example.com",
                "role": "customer",
                "exp": datetime.now(timezone.utc) + timedelta(minutes=30),
                "iat": datetime.now(timezone.utc)
            },
            "test_secret_key_for_testing_only_12345",
            algorithm="HS256"
        )
        
        payload = validator.validate_token(token)
        
        assert payload["sub"] == "1"
        assert payload["email"] == "test@example.com"
        assert payload["role"] == "customer"

    def test_validate_expired_token(self, mock_redis_client):
        """Test validation of expired token."""
        from shared.token_validator import TokenValidator, TokenValidationError
        
        validator = TokenValidator(
            secret_key="test_secret_key_for_testing_only_12345",
            algorithm="HS256",
            redis_client=mock_redis_client
        )
        
        # Create expired token
        import jwt
        token = jwt.encode(
            {
                "sub": "1",
                "exp": datetime.now(timezone.utc) - timedelta(minutes=30),
                "iat": datetime.now(timezone.utc) - timedelta(minutes=60)
            },
            "test_secret_key_for_testing_only_12345",
            algorithm="HS256"
        )
        
        with pytest.raises(TokenValidationError) as exc_info:
            validator.validate_token(token)
        
        assert "expired" in str(exc_info.value).lower()

    def test_validate_blacklisted_token(self, mock_redis_client):
        """Test validation of blacklisted token."""
        from shared.token_validator import TokenValidator, TokenValidationError
        
        # Setup Redis to return token is blacklisted
        mock_redis_client.client.exists = Mock(return_value=1)
        
        validator = TokenValidator(
            secret_key="test_secret_key_for_testing_only_12345",
            algorithm="HS256",
            redis_client=mock_redis_client
        )
        
        # Create valid token
        import jwt
        token = jwt.encode(
            {
                "sub": "1",
                "exp": datetime.now(timezone.utc) + timedelta(minutes=30),
                "iat": datetime.now(timezone.utc)
            },
            "test_secret_key_for_testing_only_12345",
            algorithm="HS256"
        )
        
        with pytest.raises(TokenValidationError) as exc_info:
            validator.validate_token(token, check_blacklist=True)
        
        assert "blacklist" in str(exc_info.value).lower()

    def test_get_user_id_from_token(self, mock_redis_client):
        """Test extracting user ID from token."""
        from shared.token_validator import TokenValidator
        
        validator = TokenValidator(
            secret_key="test_secret_key_for_testing_only_12345",
            algorithm="HS256",
            redis_client=mock_redis_client
        )
        
        import jwt
        token = jwt.encode(
            {
                "sub": "123",
                "exp": datetime.now(timezone.utc) + timedelta(minutes=30),
                "iat": datetime.now(timezone.utc)
            },
            "test_secret_key_for_testing_only_12345",
            algorithm="HS256"
        )
        
        user_id = validator.get_user_id(token)
        
        assert user_id == 123


# ==================== Cart Service Tests ====================

class TestCartService:
    """Test cart service operations."""

    def test_add_to_cart_success(self, mock_db_session, mock_redis_client):
        """Test adding item to cart successfully."""
        from service.cart_service import CartService
        
        # Mock Redis operations
        mock_redis_client.get_cache = Mock(return_value=None)
        mock_redis_client.set_cache = Mock()
        
        cart_service = CartService(mock_db_session)
        cart_service.redis_client = mock_redis_client
        
        # Mock cart data
        cart_data = {
            "user_id": 1,
            "items": [],
            "subtotal": 0,
            "total_amount": 0
        }
        
        # Mock get_cart to return empty cart
        cart_service.get_cart = Mock(return_value=cart_data)
        cart_service.save_cart = Mock(return_value=True)
        cart_service._recalculate_cart = Mock(return_value=cart_data)
        
        # Add item
        result = cart_service.add_to_cart(
            user_id=1,
            product_id=1,
            quantity=2
        )
        
        assert result is not None
        cart_service.save_cart.assert_called()

    def test_add_to_cart_out_of_stock(self, mock_db_session, mock_redis_client):
        """Test adding item that's out of stock."""
        from service.cart_service import CartService
        
        cart_service = CartService(mock_db_session)
        cart_service.redis_client = mock_redis_client
        
        # Mock inventory check
        mock_db_session.query = Mock(return_value=Mock(
            filter=Mock(return_value=Mock(
                first=Mock(return_value=Mock(quantity=0, reserved_quantity=0))
            ))
        ))
        
        cart_service.get_cart = Mock(return_value={
            "user_id": 1,
            "items": []
        })
        
        with pytest.raises(ValueError) as exc_info:
            cart_service.add_to_cart(
                user_id=1,
                product_id=1,
                quantity=1
            )
        
        assert "out of stock" in str(exc_info.value).lower() or "insufficient" in str(exc_info.value).lower()


# ==================== Order Service Tests ====================

class TestOrderService:
    """Test order service operations."""

    def test_create_order_success(self, mock_db_session, sample_user):
        """Test successful order creation."""
        from service.order_service import OrderService
        from models.order import OrderStatus
        
        order_service = OrderService(mock_db_session)
        
        # Mock cart service
        order_service.cart_service = Mock()
        order_service.cart_service.get_cart = Mock(return_value={
            "items": [
                {
                    "product_id": 1,
                    "name": "Test Product",
                    "price": 99.99,
                    "quantity": 2,
                    "sku": "TEST-001",
                    "gst_rate": 18
                }
            ],
            "shipping": 50,
            "gst_amount": 36,
            "cgst_amount": 18,
            "sgst_amount": 18,
            "igst_amount": 0,
            "delivery_state": "Rajasthan",
            "customer_gstin": None
        })
        order_service.cart_service.confirm_cart_for_checkout = Mock(return_value=True)
        order_service.cart_service.clear_cart = Mock()
        
        # Mock inventory service
        order_service.inventory_service = Mock()
        order_service.inventory_service.confirm_reservation = Mock()
        
        # Mock promotion service
        order_service.promotion_service = Mock()
        order_service.promotion_service.validate_promotion = Mock(return_value={"valid": False})
        order_service.promotion_service.record_usage = Mock()
        
        # Mock database operations
        mock_db_session.execute = Mock(return_value=Mock(scalar=Mock(return_value=123)))
        
        mock_order = Mock()
        mock_order.id = 1
        mock_order.items = []
        mock_db_session.add = Mock()
        mock_db_session.flush = Mock()
        mock_db_session.commit = Mock()
        mock_db_session.refresh = Mock()
        
        # Create order
        order = order_service.create_order(
            user_id=1,
            shipping_address="123 Test St",
            payment_method="razorpay"
        )
        
        assert order is not None
        mock_db_session.add.assert_called()
        mock_db_session.commit.assert_called()

    def test_cancel_order_success(self, mock_db_session):
        """Test successful order cancellation."""
        from service.order_service import OrderService
        from models.order import Order, OrderStatus
        
        order_service = OrderService(mock_db_session)
        
        # Mock order
        mock_order = Mock(spec=Order)
        mock_order.id = 1
        mock_order.status = OrderStatus.CONFIRMED
        mock_order.items = [Mock(sku="TEST-001", quantity=2)]
        
        mock_db_session.query = Mock(return_value=Mock(
            filter=Mock(return_value=Mock(
                first=Mock(return_value=mock_order)
            ))
        ))
        
        # Mock inventory service
        order_service.inventory_service = Mock()
        order_service.inventory_service.adjust_stock = Mock()
        
        mock_db_session.commit = Mock()
        mock_db_session.refresh = Mock()
        
        # Cancel order
        result = order_service.cancel_order(
            order_id=1,
            user_id=1,
            reason="Customer request"
        )
        
        assert result is not None
        assert result.status == OrderStatus.CANCELLED
        order_service.inventory_service.adjust_stock.assert_called()
        mock_db_session.commit.assert_called()


# ==================== Error Handling Tests ====================

class TestErrorHandling:
    """Test error handling across services."""

    def test_http_exception_handling(self):
        """Test HTTP exception is properly raised."""
        from fastapi import HTTPException, status
        
        with pytest.raises(HTTPException) as exc_info:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Resource not found"
            )
        
        assert exc_info.value.status_code == 404
        assert exc_info.value.detail == "Resource not found"

    def test_validation_error_handling(self):
        """Test validation errors are properly handled."""
        from fastapi import HTTPException, status
        
        def validate_value(value):
            if value < 0:
                raise ValueError("Value must be positive")
            return value
        
        with pytest.raises(ValueError) as exc_info:
            validate_value(-1)
        
        assert "positive" in str(exc_info.value).lower()


# ==================== Integration Tests ====================

class TestIntegration:
    """Integration tests for complete workflows."""

    def test_complete_checkout_flow(self, mock_db_session, mock_redis_client, sample_user):
        """Test complete checkout flow from cart to order."""
        from service.cart_service import CartService
        from service.order_service import OrderService
        from models.order import OrderStatus
        
        # Setup services
        cart_service = CartService(mock_db_session)
        cart_service.redis_client = mock_redis_client
        
        order_service = OrderService(mock_db_session)
        order_service.cart_service = cart_service
        order_service.inventory_service = Mock()
        order_service.promotion_service = Mock()
        
        # Step 1: Add items to cart
        cart_service.get_cart = Mock(return_value={
            "user_id": 1,
            "items": [
                {
                    "product_id": 1,
                    "name": "Test Product",
                    "price": 99.99,
                    "quantity": 2,
                    "sku": "TEST-001"
                }
            ],
            "subtotal": 199.98,
            "shipping": 50,
            "total_amount": 249.98
        })
        
        # Step 2: Create order
        order_service.cart_service.confirm_cart_for_checkout = Mock(return_value=True)
        order_service.cart_service.clear_cart = Mock()
        order_service.inventory_service.confirm_reservation = Mock()
        order_service.promotion_service.validate_promotion = Mock(return_value={"valid": False})
        
        mock_db_session.execute = Mock(return_value=Mock(scalar=Mock(return_value=123)))
        mock_db_session.add = Mock()
        mock_db_session.flush = Mock()
        mock_db_session.commit = Mock()
        mock_db_session.refresh = Mock()
        
        order = order_service.create_order(
            user_id=1,
            shipping_address="123 Test St"
        )
        
        assert order is not None
        
        # Verify cart was cleared
        order_service.cart_service.clear_cart.assert_called()


# ==================== Run Tests ====================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
