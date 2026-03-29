"""
Health check tests for all services.
"""
import pytest


class TestServiceHealth:
    """Test health endpoints for all services."""
    
    @pytest.mark.unit
    def test_core_health(self, core_client):
        """Test Core service health endpoint."""
        response = core_client.health()
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy" or "healthy" in data.get("message", "").lower()
    
    @pytest.mark.unit
    def test_commerce_health(self, commerce_client):
        """Test Commerce service health endpoint."""
        response = commerce_client.health()
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy" or "healthy" in data.get("message", "").lower()
    
    @pytest.mark.unit
    def test_payment_health(self, payment_client):
        """Test Payment service health endpoint."""
        response = payment_client.health()
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy" or "healthy" in data.get("message", "").lower()
    
    @pytest.mark.unit
    def test_admin_health(self, admin_client):
        """Test Admin service health endpoint."""
        response = admin_client.health()
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy" or "healthy" in data.get("message", "").lower()
