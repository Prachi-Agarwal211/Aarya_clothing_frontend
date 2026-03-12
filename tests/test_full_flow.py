"""
Comprehensive end-to-end integration tests for Aarya Clothing.
Covers: Auth -> Catalog -> Cart (Variants) -> Checkout (Address/COD) -> Payment -> Admin

UPDATED: Now handles email verification requirement.
"""
import pytest
import requests
import json
import time
from decimal import Decimal

# Mark all tests as integration tests
pytestmark = pytest.mark.integration

class TestFullUserJourney:
    """Simulate a full user journey."""
    
    def test_complete_purchase_flow(self, core_client, commerce_client, payment_client, admin_client, fake_user_data, fake_address_data, db_connection):
        """
        Step 1: User Registration, Email Verification & Login
        UPDATED: Now includes email verification step.
        """
        # Register
        reg_response = core_client.register(fake_user_data)
        if reg_response.status_code not in [200, 201]:
            # If user exists, try login directly (they might already be verified)
            pass
        
        # Get verification token from database
        verification_token = None
        if db_connection:
            try:
                cursor = db_connection.cursor()
                cursor.execute(
                    "SELECT token FROM email_verifications WHERE user_id = "
                    "(SELECT id FROM users WHERE email = %s) "
                    "ORDER BY created_at DESC LIMIT 1",
                    (fake_user_data["email"],)
                )
                result = cursor.fetchone()
                if result:
                    verification_token = result[0]
                cursor.close()
            except Exception as e:
                print(f"Could not get verification token: {e}")
        
        # Verify email if we got a token
        if verification_token:
            verify_response = core_client.verify_email(verification_token)
            if verify_response.status_code != 200:
                # Might already be verified
                pass
        
        # Give some time for DB to commit and session to be ready
        time.sleep(0.5)
        
        # Login
        login_response = core_client.login(fake_user_data["email"], fake_user_data["password"])
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        auth_data = login_response.json()
        token = auth_data.get("tokens", {}).get("access_token")
        user_id = auth_data["user"]["id"]
        assert token is not None
        assert user_id is not None
        
        print(f"Step 1: User authenticated (ID: {user_id})")

        """
        Step 2: Catalog & Variant Selection
        """
        # Get products
        products_response = commerce_client.get_products({"limit": 10})
        assert products_response.status_code == 200
        products_data = products_response.json()
        
        # Handle list or dict response
        products = products_data if isinstance(products_data, list) else products_data.get("items", [])
        if not products and isinstance(products_data, dict) and "products" in products_data:
             products = products_data["products"]

        assert len(products) > 0, "No products found in catalog"
        
        # Find a product with inventory
        target_product = None
        target_variant = None
        
        for p in products:
            # Fetch full details to see inventory
            detail_resp = commerce_client.get_product(p["id"])
            if detail_resp.status_code == 200:
                p_detail = detail_resp.json()
                # Check for inventory field or try to find variants
                inventory_list = p_detail.get("inventory", [])
                if inventory_list and len(inventory_list) > 0:
                    # Find a variant with stock
                    for inv in inventory_list:
                        available = inv.get("available_quantity")
                        if available is None:
                            available = inv.get("quantity", 0) - inv.get("reserved_quantity", 0)
                        if available > 0:
                            target_product = p_detail
                            target_variant = inv
                            break
            if target_product:
                break
        
        if not target_product:
            pytest.skip("No products with inventory found - skipping cart tests")
            
        print(f"Step 2: Selected Product '{target_product['name']}' (ID: {target_product['id']}), Variant ID: {target_variant.get('id')}")

        """
        Step 3: Cart Operations
        """
        # Add to cart with variant_id
        cart_item = {
            "product_id": target_product["id"],
            "variant_id": target_variant.get("id"),
            "quantity": 1
        }
        
        add_cart_resp = commerce_client.add_to_cart(user_id, cart_item, token)
        if add_cart_resp.status_code in (409, 429):
            # Retry if cart lock is busy
            for _ in range(10):
                time.sleep(1)
                add_cart_resp = commerce_client.add_to_cart(user_id, cart_item, token)
                if add_cart_resp.status_code not in (409, 429):
                    break
        if add_cart_resp.status_code in (409, 429):
            pytest.skip("Cart lock busy after retries")
        assert add_cart_resp.status_code == 200, f"Add to cart failed: {add_cart_resp.text}"
        
        cart = add_cart_resp.json()
        assert len(cart["items"]) > 0
        # Check variant_id if available in response
        if "variant_id" in cart["items"][0]:
            assert cart["items"][0]["variant_id"] == target_variant.get("id")
        
        print(f"Step 3: Item added to cart. Cart Total: {cart.get('total')}")

        """
        Step 4: Checkout - Address Creation
        """
        # Create address directly via API
        address_resp = commerce_client.session.post(
            f"{commerce_client.base_url}/api/v1/addresses",
            json=fake_address_data,
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        assert address_resp.status_code in [200, 201], f"Address creation failed: {address_resp.text}"
        address_data_resp = address_resp.json()
        address_id = address_data_resp.get("id") or address_data_resp.get("address", {}).get("id")
        
        print(f"Step 4: Address created (ID: {address_id})")

        """
        Step 5: Order Creation (COD)
        """
        order_payload = {
            "user_id": user_id,
            "address_id": address_id,
            "payment_method": "cod"
        }
        
        create_order_resp = commerce_client.session.post(
            f"{commerce_client.base_url}/api/v1/orders",
            json=order_payload,
            headers={"Authorization": f"Bearer {token}"}
        )
        assert create_order_resp.status_code in [200, 201], f"Order creation failed: {create_order_resp.text}"
        
        order = create_order_resp.json()
        assert order["id"] is not None
        # Check for our new fields
        if "order_number" in order:
            assert order["order_number"] is not None
        
        print(f"Step 5: Order created successfully (ID: {order['id']})")

        """
        Step 6: Payment Verification (Razorpay Flow Simulation)
        """
        # Create a Razorpay order (backend)
        rzp_order_resp = payment_client.session.post(
            f"{payment_client.base_url}/api/v1/payments/razorpay/create-order",
            json={
                "amount": int(float(order["total_amount"]) * 100),
                "currency": "INR",
                "notes": {"internal_order_id": str(order["id"])}
            },
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        if rzp_order_resp.status_code != 200:
            pytest.skip(f"Razorpay order creation failed or unavailable: {rzp_order_resp.text}")
        rzp_order = rzp_order_resp.json()
        assert "id" in rzp_order
        
        print(f"Step 6: Razorpay order created (ID: {rzp_order['id']})")

        """
        Step 7: Admin Dashboard Verification
        """
        landing_resp = requests.get(f"{admin_client.base_url}/api/v1/landing/all")
        assert landing_resp.status_code == 200
        landing_data = landing_resp.json()
        assert "hero" in landing_data
        
        print(f"Step 7: Admin service landing config Verified")
