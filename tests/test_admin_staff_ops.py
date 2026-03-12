"""
Comprehensive tests for Admin and Staff operations.
Covers: Order Status Lifecycle, Inventory Management, Dashboard Stats.

UPDATED: Now handles email verification requirement.
"""
import pytest
import requests
import time

# Mark all tests as integration tests
pytestmark = pytest.mark.integration

class TestAdminStaffOperations:
    """Test Admin and Staff workflows."""

    @pytest.fixture
    def admin_user(self, core_client):
        """Authenticate as admin.
        
        Note: Admin users should already be verified in seed data.
        """
        # Use default admin credentials from seed data
        response = core_client.login("admin@aarya.com", "admin123")
        if response.status_code == 200:
            data = response.json()
            return {
                "token": data["tokens"]["access_token"],
                "user_id": data["user"]["id"]
            }
        else:
            # Try another one if first failed
            response = core_client.login("admin@example.com", "admin123")
            if response.status_code == 200:
                data = response.json()
                return {
                    "token": data["tokens"]["access_token"],
                    "user_id": data["user"]["id"]
                }
            pytest.skip("Admin login failed - check if seed data exists")

    @pytest.fixture
    def verified_customer(self, core_client, fake_user_data, db_connection):
        """Create and verify a customer user for testing."""
        # Register user
        reg_response = core_client.register(fake_user_data)
        
        if reg_response.status_code not in [200, 201]:
            # User might already exist, try to get verification token anyway
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
        
        # Verify email if we have a token
        if verification_token:
            core_client.verify_email(verification_token)
        
        # Login
        login_response = core_client.login(fake_user_data["email"], fake_user_data["password"])
        if login_response.status_code == 200:
            data = login_response.json()
            return {
                "token": data["tokens"]["access_token"],
                "user_id": data["user"]["id"],
                "email": fake_user_data["email"]
            }
        return None

    def test_order_lifecycle_management(self, admin_user, verified_customer, core_client, commerce_client, admin_client, fake_address_data):
        """
        Full lifecycle: Create Order -> Ship -> Deliver.
        Uses the current backend state machine where new orders start as confirmed.
        """
        token = admin_user["token"]
        
        # 1. Use verified customer
        if not verified_customer:
            pytest.skip("Could not create verified customer")
        
        cust_token = verified_customer["token"]
        cust_id = verified_customer["user_id"]
        
        # Get a product with available inventory
        prod_resp = commerce_client.get_products({"limit": 10})
        products = prod_resp.json()
        if isinstance(products, dict):
            products = products.get("items", products.get("products", []))

        target_product = None
        target_variant = None
        for p in products:
            detail_resp = commerce_client.get_product(p["id"])
            if detail_resp.status_code != 200:
                continue
            p_detail = detail_resp.json()
            inventory_list = p_detail.get("inventory", [])
            if inventory_list:
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
            pytest.skip("No in-stock products available for order lifecycle test")
        product = target_product
        
        # Create address
        addr_resp = commerce_client.session.post(
            f"{commerce_client.base_url}/api/v1/addresses",
            json=fake_address_data,
            headers={"Authorization": f"Bearer {cust_token}"}
        )
        assert addr_resp.status_code in [200, 201], f"Address creation failed: {addr_resp.text}"
        addr_payload = addr_resp.json()
        address_id = addr_payload.get("id") or addr_payload.get("address", {}).get("id")
        
        # Add to cart
        time.sleep(0.5)
        cart_item = {"product_id": product["id"], "quantity": 1}
        if target_variant:
            cart_item["variant_id"] = target_variant.get("id")
        add_resp = commerce_client.add_to_cart(cust_id, cart_item, cust_token)
        if add_resp.status_code in (409, 429):
            for _ in range(10):
                time.sleep(1)
                add_resp = commerce_client.add_to_cart(cust_id, {"product_id": product["id"], "quantity": 1}, cust_token)
                if add_resp.status_code not in (409, 429):
                    break
        assert add_resp.status_code == 200, f"Add to cart failed: {add_resp.text}"
        
        # Create Order (Confirmed)
        time.sleep(0.5)
        order_resp = commerce_client.session.post(
            f"{commerce_client.base_url}/api/v1/orders",
            json={"address_id": address_id, "payment_method": "cod"},
            headers={"Authorization": f"Bearer {cust_token}"}
        )
        assert order_resp.status_code in [200, 201], f"Order creation failed: {order_resp.text}"
        order = order_resp.json()
        order_id = order["id"]
        assert order["status"] == "confirmed"
        print(f"Created Order #{order_id} (Status: confirmed)")

        # 2. Admin: Ship Order
        ship_resp = admin_client.update_order_status(
            order_id,
            "shipped",
            token,
            "Handed to courier",
            pod_number="PYTEST-POD-001"
        )
        assert ship_resp.status_code == 200
        print(f"Order #{order_id} status updated to: shipped")

        # 3. Admin: Mark Delivered
        deliv_resp = admin_client.update_order_status(order_id, "delivered", token, "Package received")
        assert deliv_resp.status_code == 200
        print(f"Order #{order_id} status updated to: delivered. Full Lifecycle Success!")

    def test_inventory_management(self, admin_user, admin_client):
        """Test stock adjustments and low stock reporting."""
        token = admin_user["token"]
        
        # 1. Get inventory list
        inv_resp = admin_client.get_inventory(token)
        assert inv_resp.status_code == 200
        inventory = inv_resp.json().get("items", [])
        
        if not inventory:
            pytest.skip("No inventory items found to test adjustment")
            
        item = inventory[0]
        sku = item["sku"]
        initial_qty = item["quantity"]
        
        # 2. Adjust stock (+10)
        adj_resp = admin_client.adjust_inventory(sku, 10, token)
        assert adj_resp.status_code == 200
        data = adj_resp.json()
        expected_qty = max(0, data["previous_quantity"] + data["adjustment"])
        assert data["new_quantity"] == expected_qty
        print(f"Adjusted Inventory for SKU {sku}: {data['previous_quantity']} -> {data['new_quantity']}")
        
        # 3. Adjust stock (-5)
        adj_resp2 = admin_client.adjust_inventory(sku, -5, token)
        assert adj_resp2.status_code == 200
        data2 = adj_resp2.json()
        expected_qty = max(0, data2["previous_quantity"] + data2["adjustment"])
        assert data2["new_quantity"] == expected_qty
        print(f"Adjusted Inventory for SKU {sku}: {data['new_quantity']} -> {data2['new_quantity']}")

    def test_dashboard_analytics(self, admin_user, admin_client):
        """Verify dashboard overview stats."""
        token = admin_user["token"]
        
        response = admin_client.get_dashboard(token)
        assert response.status_code == 200
        data = response.json()
        
        assert "total_revenue" in data
        assert "total_orders" in data
        assert "inventory_alerts" in data
        
        print(f"Dashboard Analytics verified. Total Revenue: {data['total_revenue']}")
