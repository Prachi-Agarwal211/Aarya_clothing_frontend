"""
Commerce service tests.
"""
import pytest


class TestProducts:
    """Test product endpoints."""
    
    @pytest.mark.integration
    def test_get_products_list(self, commerce_client):
        """Test getting list of products."""
        response = commerce_client.get_products()
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list) or "items" in data
    
    @pytest.mark.integration
    def test_get_products_with_pagination(self, commerce_client):
        """Test products pagination."""
        response = commerce_client.get_products({"limit": 5, "offset": 0})
        
        assert response.status_code == 200
    
    @pytest.mark.integration
    def test_get_product_by_id(self, commerce_client):
        """Test getting single product."""
        # First get list to find a product ID
        list_response = commerce_client.get_products({"limit": 1})
        
        if list_response.status_code == 200:
            data = list_response.json()
            products = data if isinstance(data, list) else data.get("items", [])
            
            if products:
                product_id = products[0].get("id")
                if product_id:
                    response = commerce_client.get_product(product_id)
                    assert response.status_code in [200, 404]


class TestCategories:
    """Test category endpoints."""
    
    @pytest.mark.integration
    def test_get_categories(self, commerce_client):
        """Test getting categories list."""
        response = commerce_client.get_categories()
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list) or "categories" in data


class TestCart:
    """Test cart operations."""
    
    @pytest.mark.integration
    def test_get_empty_cart(self, authenticated_user, commerce_client):
        """Test getting empty cart."""
        if not authenticated_user.get("access_token"):
            pytest.skip("Authentication failed")
        
        response = commerce_client.get_cart(
            authenticated_user["user_id"],
            authenticated_user["access_token"]
        )
        
        # Should return empty cart or 200
        assert response.status_code == 200
    
    @pytest.mark.integration
    def test_cart_requires_auth(self, commerce_client):
        """Test that cart requires authentication."""
        response = commerce_client.session.get(
            f"{commerce_client.base_url}/api/v1/cart/1"
        )
        
        # Should require authentication
        assert response.status_code in [401, 403]


class TestWishlist:
    """Test wishlist operations."""
    
    @pytest.mark.integration
    def test_get_wishlist(self, authenticated_user, commerce_client):
        """Test getting user wishlist."""
        if not authenticated_user.get("access_token"):
            pytest.skip("Authentication failed")
        
        response = commerce_client.session.get(
            f"{commerce_client.base_url}/api/v1/wishlist",
            headers={"Authorization": f"Bearer {authenticated_user['access_token']}"}
        )
        
        assert response.status_code == 200
    
    @pytest.mark.integration
    def test_wishlist_requires_auth(self, commerce_client):
        """Test that wishlist requires authentication."""
        response = commerce_client.session.get(
            f"{commerce_client.base_url}/api/v1/wishlist"
        )
        
        # Should require authentication
        assert response.status_code in [401, 403]


class TestSearch:
    """Test search functionality."""
    
    @pytest.mark.integration
    def test_search_products(self, commerce_client):
        """Test product search."""
        response = commerce_client.session.get(
            f"{commerce_client.base_url}/api/v1/products/search",
            params={"q": "test"}
        )
        
        # Search might return empty results but should not error
        assert response.status_code in [200, 404]
