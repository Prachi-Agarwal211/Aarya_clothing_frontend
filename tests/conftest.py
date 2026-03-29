"""
Pytest configuration and fixtures for Aarya Clothing tests.
"""
import os
import pytest
import requests
import time
import psycopg2
import redis
from urllib.parse import urlparse
from typing import Generator, Dict, Any
from faker import Faker

# Test configuration
TEST_DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres123@localhost:6001/aarya_clothing")
TEST_REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6002/0")
COMMERCE_REDIS_URL = os.getenv("COMMERCE_REDIS_URL", "redis://localhost:6002/1")
CORE_SERVICE_URL = os.getenv("CORE_SERVICE_URL", "http://localhost:5001")
COMMERCE_SERVICE_URL = os.getenv("COMMERCE_SERVICE_URL", "http://localhost:5002")
PAYMENT_SERVICE_URL = os.getenv("PAYMENT_SERVICE_URL", "http://localhost:5003")
ADMIN_SERVICE_URL = os.getenv("ADMIN_SERVICE_URL", "http://localhost:5004")

fake = Faker()

TEST_COLLECTION_SLUG = "pytest-seeded-collection"
TEST_PRODUCT_SLUG = "pytest-seeded-product"
TEST_PRODUCT_SKU = "PYTEST-SEED-001-M-BLUE"


def _connect_test_db():
    """Open a direct PostgreSQL connection for suite setup work."""
    url = urlparse(TEST_DATABASE_URL)
    conn = psycopg2.connect(
        dbname=url.path[1:],
        user=url.username,
        password=url.password,
        host=url.hostname,
        port=url.port,
    )
    conn.autocommit = True
    return conn


def _clear_redis_patterns(redis_url: str, patterns: list[str]) -> None:
    """Delete keys by pattern without blocking Redis with KEYS."""
    client = redis.Redis.from_url(redis_url, decode_responses=True)
    for pattern in patterns:
        batch = []
        for key in client.scan_iter(match=pattern, count=100):
            batch.append(key)
            if len(batch) >= 200:
                client.delete(*batch)
                batch = []
        if batch:
            client.delete(*batch)


# ============================================================
# FIXTURES: Database
# ============================================================

@pytest.fixture
def db_connection():
    """Create a database connection for testing."""
    url = urlparse(TEST_DATABASE_URL)
    try:
        conn = psycopg2.connect(
            dbname=url.path[1:],
            user=url.username,
            password=url.password,
            host=url.hostname,
            port=url.port
        )
        conn.autocommit = True
        yield conn
        conn.close()
    except Exception as e:
        pytest.fail(f"Could not connect to database: {e}")


# ============================================================
# FIXTURES: Redis
# ============================================================

@pytest.fixture
def redis_client():
    """Create a Redis client for testing OTP and cache operations.
    
    This fixture provides access to Redis for:
    - Retrieving OTP codes (test environment only)
    - Managing cache keys
    - Testing rate limiting
    - Verifying verification timestamps
    
    Returns:
        RedisClient: Test helper class for Redis operations
    """
    class RedisClient:
        def __init__(self, redis_url: str):
            self.redis_url = redis_url
            self.client = redis.Redis.from_url(redis_url, decode_responses=True)
        
        def get_otp(self, key: str) -> str | None:
            """Get OTP code from Redis (test environment only).
            
            Args:
                key: Redis key (e.g., 'EMAIL:user@example.com')
                
            Returns:
                OTP code or None if not found
            """
            try:
                return self.client.get(key)
            except Exception:
                return None
        
        def delete_cache(self, key: str, namespace: str = "") -> bool:
            """Delete a cache key from Redis.
            
            Args:
                key: Cache key to delete
                namespace: Optional namespace (not used in this simple implementation)
                
            Returns:
                True if deleted, False otherwise
            """
            try:
                # If namespace is provided, prepend it to the key
                full_key = f"{namespace}:{key}" if namespace and not key.startswith(namespace) else key
                return bool(self.client.delete(full_key))
            except Exception:
                return False
        
        def get_cache(self, key: str, namespace: str = "") -> str | None:
            """Get a value from Redis cache.
            
            Args:
                key: Cache key
                namespace: Optional namespace
                
            Returns:
                Cached value or None if not found
            """
            try:
                full_key = f"{namespace}:{key}" if namespace and not key.startswith(namespace) else key
                return self.client.get(full_key)
            except Exception:
                return None
        
        def set_cache(self, key: str, value: str, ttl: int = 300) -> bool:
            """Set a value in Redis cache with TTL.
            
            Args:
                key: Cache key
                value: Value to cache
                ttl: Time to live in seconds (default: 300)
                
            Returns:
                True if set successfully
            """
            try:
                return self.client.setex(key, ttl, value)
            except Exception:
                return False
    
    try:
        client = RedisClient(TEST_REDIS_URL)
        # Test connection
        client.client.ping()
        yield client
    except Exception as e:
        pytest.skip(f"Could not connect to Redis: {e}")


# ============================================================
# FIXTURES: Test Data
# ============================================================

@pytest.fixture
def fake_user_data() -> Dict[str, Any]:
    """Generate fake user data for testing."""
    return {
        "email": fake.email(),
        "username": fake.user_name(),
        "password": "TestPass123!",
        "full_name": fake.name(),
        "phone": fake.numerify("##########"),  # 10 digit number
        "role": "customer"
    }


@pytest.fixture
def fake_product_data() -> Dict[str, Any]:
    """Generate fake product data for testing."""
    return {
        "name": fake.sentence(nb_words=3),
        "slug": fake.slug(),
        "description": fake.text(),
        "short_description": fake.sentence(),
        "price": float(fake.random_int(min=100, max=10000)),
        "mrp": float(fake.random_int(min=100, max=15000)),
        "category_id": 1,
        "brand": fake.company(),
        "is_active": True,
        "is_featured": False
    }


@pytest.fixture
def fake_address_data() -> Dict[str, Any]:
    """Generate fake address data for testing."""
    return {
        "full_name": fake.name(),
        "phone": fake.phone_number()[:20],
        "address_line1": fake.street_address(),
        "address_line2": fake.secondary_address(),
        "city": fake.city(),
        "state": fake.state(),
        "postal_code": fake.postcode(),
        "country": "India",
        "address_type": "shipping",
        "is_default": False
    }


# ============================================================
# FIXTURES: API Clients
# ============================================================

@pytest.fixture
def core_client():
    """HTTP client for Core service."""
    class CoreClient:
        def __init__(self, base_url: str):
            self.base_url = base_url
            self.session = requests.Session()
        
        def health(self):
            return self.session.get(f"{self.base_url}/health")
        
        def register(self, data: dict):
            return self.session.post(
                f"{self.base_url}/api/v1/auth/register",
                json=data
            )
        
        def login(self, username: str, password: str):
            return self.session.post(
                f"{self.base_url}/api/v1/auth/login",
                json={"username": username, "password": password}
            )
        
        def get_user(self, token: str):
            return self.session.get(
                f"{self.base_url}/api/v1/users/me",
                headers={"Authorization": f"Bearer {token}"}
            )
        
        def update_user_role(self, user_id: int, role: str, admin_token: str):
            return self.session.patch(
                f"{self.base_url}/api/v1/admin/users/{user_id}/role",
                json={"new_role": role},
                headers={"Authorization": f"Bearer {admin_token}"}
            )
        
        def logout(self, token: str):
            return self.session.post(
                f"{self.base_url}/api/v1/auth/logout",
                headers={"Authorization": f"Bearer {token}"}
            )
        
        def verify_email(self, token: str):
            """Verify email with token."""
            return self.session.post(
                f"{self.base_url}/api/v1/auth/verify-email",
                params={"token": token}
            )
        
        def resend_verification(self, email: str):
            """Resend verification email."""
            return self.session.post(
                f"{self.base_url}/api/v1/auth/resend-verification",
                params={"email": email}
            )

        def get_verification_token(self, email: str):
            """[TESTING ONLY] Get verification token via test endpoint."""
            return self.session.get(
                f"{self.base_url}/api/v1/test/get-verification-token/{email}"
            )
    
    return CoreClient(CORE_SERVICE_URL)


@pytest.fixture
def commerce_client():
    """HTTP client for Commerce service."""
    class CommerceClient:
        def __init__(self, base_url: str):
            self.base_url = base_url
            self.session = requests.Session()
        
        def health(self):
            return self.session.get(f"{self.base_url}/health")
        
        def get_products(self, params: dict = None):
            return self.session.get(f"{self.base_url}/api/v1/products", params=params)
        
        def get_product(self, product_id: int):
            return self.session.get(f"{self.base_url}/api/v1/products/{product_id}")
        
        def get_categories(self):
            return self.session.get(f"{self.base_url}/api/v1/categories")
        
        def get_cart(self, user_id: int, token: str):
            return self.session.get(
                f"{self.base_url}/api/v1/cart/{user_id}",
                headers={"Authorization": f"Bearer {token}"}
            )
        
        def add_to_cart(self, user_id: int, item: dict, token: str):
            import time
            last_exc = None
            last_resp = None
            for _ in range(5):
                try:
                    resp = self.session.post(
                        f"{self.base_url}/api/v1/cart/{user_id}/add",
                        json=item,
                        headers={"Authorization": f"Bearer {token}"},
                        timeout=10
                    )
                    last_resp = resp
                    if resp.status_code in (409, 429):
                        time.sleep(1)
                        continue
                    return resp
                except requests.exceptions.RequestException as exc:
                    last_exc = exc
                    time.sleep(1)
            if last_resp is not None:
                return last_resp
            if last_exc:
                raise last_exc
            return self.session.post(
                f"{self.base_url}/api/v1/cart/{user_id}/add",
                json=item,
                headers={"Authorization": f"Bearer {token}"},
                timeout=10
            )
    
    return CommerceClient(COMMERCE_SERVICE_URL)


@pytest.fixture
def payment_client():
    """HTTP client for Payment service."""
    class PaymentClient:
        def __init__(self, base_url: str):
            self.base_url = base_url
            self.session = requests.Session()
        
        def health(self):
            return self.session.get(f"{self.base_url}/health")
        
        def get_methods(self):
            return self.session.get(f"{self.base_url}/api/v1/payment/methods")
    
    return PaymentClient(PAYMENT_SERVICE_URL)


@pytest.fixture
def admin_client():
    """HTTP client for Admin service."""
    class AdminClient:
        def __init__(self, base_url: str):
            self.base_url = base_url
            self.session = requests.Session()
        
        def health(self):
            return self.session.get(f"{self.base_url}/health")

        def get_dashboard(self, token: str):
            return self.session.get(
                f"{self.base_url}/api/v1/admin/dashboard/overview",
                headers={"Authorization": f"Bearer {token}"}
            )
            
        def update_order_status(
            self,
            order_id: int,
            status: str,
            token: str,
            notes: str = "",
            pod_number: str | None = None
        ):
            payload = {"status": status, "notes": notes}
            if pod_number:
                payload["pod_number"] = pod_number
            return self.session.patch(
                f"{self.base_url}/api/v1/admin/orders/{order_id}/status",
                json=payload,
                headers={"Authorization": f"Bearer {token}"}
            )
            
        def get_inventory(self, token: str):
            return self.session.get(
                f"{self.base_url}/api/v1/admin/inventory",
                headers={"Authorization": f"Bearer {token}"}
            )
            
        def adjust_inventory(self, sku: str, adjustment: int, token: str):
            return self.session.post(
                f"{self.base_url}/api/v1/admin/inventory/adjust",
                json={"sku": sku, "adjustment": adjustment, "reason": "test"},
                headers={"Authorization": f"Bearer {token}"}
            )
    
    return AdminClient(ADMIN_SERVICE_URL)


# ============================================================
# FIXTURES: Authentication
# ============================================================

@pytest.fixture
def registered_user(core_client, fake_user_data) -> Dict[str, Any]:
    """Register a test user and return user data with credentials.
    
    Note: User is NOT verified - email verification is required before login.
    """
    response = core_client.register(fake_user_data)
    
    if response.status_code not in [200, 201]:
        # User might already exist
        pass
    
    return {
        **fake_user_data,
        "response": response
    }


@pytest.fixture
def verified_user(core_client, fake_user_data) -> Generator[Dict[str, Any], None, None]:
    """Create and verify a user for testing.
    
    This fixture:
    1. Registers a new user
    2. Gets the verification token via a test-only API endpoint
    3. Verifies the email
    4. Returns the verified user data
    """
    # Register user
    register_response = core_client.register(fake_user_data)
    
    if register_response.status_code not in [200, 201] and register_response.json().get("detail") != "Email already registered":
        pytest.fail(f"User registration failed: {register_response.text}")

    # Get verification token from the test endpoint
    token_response = core_client.get_verification_token(fake_user_data["email"])
    if token_response.status_code != 200:
        pytest.fail(f"Could not get verification token via API: {token_response.text}")
    
    verification_token = token_response.json().get("token")
    
    # Verify email if we have a token
    if verification_token:
        verify_response = core_client.verify_email(verification_token)
        if verify_response.status_code == 200:
            data = verify_response.json()
            yield {
                **fake_user_data,
                "access_token": data.get("tokens", {}).get("access_token"),
                "refresh_token": data.get("tokens", {}).get("refresh_token"),
                "user_id": data.get("user", {}).get("id"),
                "verified": True
            }
            return
    
    # Fallback - return unverified user
    yield {
        **fake_user_data,
        "access_token": None,
        "user_id": None,
        "verified": False,
        "error": "Could not verify user"
    }


@pytest.fixture
def authenticated_user(core_client, verified_user) -> Generator[Dict[str, Any], None, None]:
    """Create, authenticate, and cleanup a test user.
    
    UPDATED: Now uses verified_user fixture since email verification is required.
    """
    # verified_user fixture handles registration and verification
    if verified_user.get("access_token"):
        yield verified_user
        
        # Cleanup - logout
        try:
            core_client.logout(verified_user["access_token"])
        except Exception:
            pass
    else:
        yield {
            **verified_user,
            "access_token": None,
            "user_id": None,
            "login_error": "User could not be verified"
        }




# ============================================================
# FIXTURES: Service Health
# ============================================================

@pytest.fixture(scope="session", autouse=True)
def wait_for_services():
    """Wait for all services to be healthy before running tests."""
    services = [
        (CORE_SERVICE_URL, "Core"),
        (COMMERCE_SERVICE_URL, "Commerce"),
        (PAYMENT_SERVICE_URL, "Payment"),
        (ADMIN_SERVICE_URL, "Admin"),
    ]
    
    max_retries = 30
    retry_delay = 2
    
    for url, name in services:
        for attempt in range(max_retries):
            try:
                response = requests.get(f"{url}/health", timeout=5)
                if response.status_code == 200:
                    print(f"[OK] {name} service is healthy")
                    break
            except requests.exceptions.RequestException:
                pass
            
            if attempt == max_retries - 1:
                pytest.fail(f"Service {name} at {url} is not healthy after {max_retries} retries")
            
            time.sleep(retry_delay)


@pytest.fixture(scope="session", autouse=True)
def ensure_seed_catalog(wait_for_services):
    """Create a minimal in-stock catalog baseline for integration tests."""
    conn = _connect_test_db()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO collections (name, slug, description, is_active, is_featured, display_order)
                VALUES (%s, %s, %s, TRUE, FALSE, 999)
                ON CONFLICT (slug) DO UPDATE
                SET
                    name = EXCLUDED.name,
                    description = EXCLUDED.description,
                    is_active = TRUE,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING id
                """,
                (
                    "Pytest Seeded Collection",
                    TEST_COLLECTION_SLUG,
                    "Stable collection created for integration tests.",
                ),
            )
            collection_id = cursor.fetchone()[0]

            cursor.execute(
                """
                INSERT INTO products (
                    name, slug, description, short_description, base_price, mrp,
                    category_id, brand, total_stock, is_active, is_featured,
                    is_new_arrival, hsn_code, gst_rate, is_taxable
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, TRUE, FALSE, TRUE, %s, %s, TRUE)
                ON CONFLICT (slug) DO UPDATE
                SET
                    name = EXCLUDED.name,
                    description = EXCLUDED.description,
                    short_description = EXCLUDED.short_description,
                    base_price = EXCLUDED.base_price,
                    mrp = EXCLUDED.mrp,
                    category_id = EXCLUDED.category_id,
                    brand = EXCLUDED.brand,
                    total_stock = EXCLUDED.total_stock,
                    is_active = TRUE,
                    is_new_arrival = TRUE,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING id
                """,
                (
                    "Pytest Seeded Kurti",
                    TEST_PRODUCT_SLUG,
                    "Baseline seeded product for integration tests.",
                    "Seeded product for cart and checkout coverage.",
                    999.00,
                    1299.00,
                    collection_id,
                    "Pytest",
                    25,
                    "6104",
                    5.0,
                ),
            )
            product_id = cursor.fetchone()[0]

            cursor.execute(
                "SELECT id, quantity FROM inventory WHERE sku = %s LIMIT 1",
                (TEST_PRODUCT_SKU,),
            )
            inventory_row = cursor.fetchone()
            if inventory_row:
                cursor.execute(
                    """
                    UPDATE inventory
                    SET
                        product_id = %s,
                        size = %s,
                        color = %s,
                        quantity = GREATEST(quantity, %s),
                        reserved_quantity = 0,
                        low_stock_threshold = %s,
                        variant_price = %s,
                        is_active = TRUE,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    """,
                    (
                        product_id,
                        "M",
                        "Blue",
                        25,
                        5,
                        999.00,
                        inventory_row[0],
                    ),
                )
            else:
                cursor.execute(
                    """
                    INSERT INTO inventory (
                        product_id, sku, size, color, quantity, reserved_quantity,
                        low_stock_threshold, variant_price, is_active
                    )
                    VALUES (%s, %s, %s, %s, %s, 0, %s, %s, TRUE)
                    """,
                    (
                        product_id,
                        TEST_PRODUCT_SKU,
                        "M",
                        "Blue",
                        25,
                        5,
                        999.00,
                    ),
                )

            cursor.execute(
                """
                INSERT INTO product_images (product_id, image_url, alt_text, is_primary, display_order)
                SELECT %s, %s, %s, TRUE, 0
                WHERE NOT EXISTS (
                    SELECT 1 FROM product_images
                    WHERE product_id = %s AND is_primary = TRUE
                )
                """,
                (
                    product_id,
                    "products/pytest-seeded-kurti.jpg",
                    "Pytest seeded product image",
                    product_id,
                ),
            )

        _clear_redis_patterns(
            COMMERCE_REDIS_URL,
            [
                "cache:products:*",
                "cache:cart:*",
                "cache:cart:reservation:*",
            ],
        )
        yield
    finally:
        conn.close()


# ============================================================
# HOOKS
# ============================================================

def pytest_configure(config):
    """Configure custom markers."""
    config.addinivalue_line(
        "markers", "unit: Unit tests (no external dependencies)"
    )
    config.addinivalue_line(
        "markers", "integration: Integration tests (require database/redis)"
    )
    config.addinivalue_line(
        "markers", "e2e: End-to-end tests (require full stack)"
    )
    config.addinivalue_line(
        "markers", "slow: Slow running tests"
    )


def pytest_collection_modifyitems(config, items):
    """Modify test collection based on markers."""
    # Add slow marker to tests that take long
    for item in items:
        if "e2e" in item.keywords:
            item.add_marker(pytest.mark.slow)
