"""Cashfree payment service for Aarya Clothing."""
import hashlib
import base64
import hmac
import json
import httpx
import logging
from typing import Dict, Any, Optional
from datetime import datetime

from core.config import settings

logger = logging.getLogger(__name__)


class CashfreeService:
    """Cashfree payment gateway service."""

    def __init__(self):
        """Initialize Cashfree service."""
        self.app_id = settings.CASHFREE_APP_ID
        self.secret_key = settings.CASHFREE_SECRET_KEY
        self.base_url = settings.cashfree_base_url
        self.enabled = settings.cashfree_enabled

    def _get_headers(self) -> Dict[str, str]:
        """Get authentication headers for Cashfree API."""
        if not self.enabled:
            raise ValueError("Cashfree is not configured")

        # Cashfree uses x-api-version, x-client-id and x-client-secret for authentication
        return {
            "Content-Type": "application/json",
            "x-api-version": "2025-01-01",
            "x-client-id": self.app_id,
            "x-client-secret": self.secret_key,
        }

    async def create_order(
        self,
        order_id: str,
        amount: float,
        currency: str = "INR",
        customer_name: str = "",
        customer_email: str = "",
        customer_phone: str = "",
    ) -> Dict[str, Any]:
        """
        Create a Cashfree order/session.

        Args:
            order_id: Your unique order ID
            amount: Order amount in INR
            currency: Currency code (default: INR)
            customer_name: Customer name
            customer_email: Customer email
            customer_phone: Customer phone

        Returns:
            Cashfree order response with payment_session_id
        """
        if not self.enabled:
            raise ValueError("Cashfree is not configured")

        # Cashfree API endpoint is /pg/orders (NOT /orders)
        url = f"{self.base_url}/pg/orders"

        payload = {
            "order_id": order_id,
            "order_amount": amount,
            "order_currency": currency,
            "customer_details": {
                "customer_id": order_id,
                "customer_name": customer_name or "Customer",
                "customer_phone": customer_phone or "9999999999",
                "customer_email": customer_email or "customer@example.com",
            },
            "order_meta": {
                "return_url": f"{settings.PAYMENT_SUCCESS_URL}?order_id={{order_id}}",
                "notify_url": f"{settings.PAYMENT_NOTIFY_URL}/cashfree",
            },
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    url,
                    json=payload,
                    headers=self._get_headers(),
                )
                response.raise_for_status()
                order_data = response.json()

                logger.info(f"Cashfree order created: {order_data.get('order_id')}")
                return order_data

        except httpx.HTTPError as e:
            logger.error(f"Cashfree order creation failed: {e}")
            raise ValueError(f"Failed to create Cashfree order: {str(e)}")

    async def verify_order(self, order_id: str) -> Dict[str, Any]:
        """
        Verify Cashfree order status.

        Args:
            order_id: Order ID to verify

        Returns:
            Order status and details
        """
        if not self.enabled:
            raise ValueError("Cashfree is not configured")

        url = f"{self.base_url}/orders/{order_id}"

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    url,
                    headers=self._get_headers(),
                )
                response.raise_for_status()
                order_data = response.json()

                return order_data

        except httpx.HTTPError as e:
            logger.error(f"Cashfree order verification failed: {e}")
            raise ValueError(f"Failed to verify Cashfree order: {str(e)}")

    def verify_signature(
        self,
        order_id: str,
        order_amount: str,
        reference_id: str,
        signature: str,
    ) -> bool:
        """
        Verify Cashfree payment signature.

        Args:
            order_id: Order ID
            order_amount: Order amount
            reference_id: Cashfree reference ID
            signature: Signature from Cashfree

        Returns:
            True if signature is valid
        """
        if not self.enabled:
            return False

        try:
            # Create the signature string
            signature_string = f"{order_id}{order_amount}{reference_id}"

            # Generate HMAC SHA256 signature
            expected_signature = hmac.new(
                self.secret_key.encode('utf-8'),
                signature_string.encode('utf-8'),
                hashlib.sha256,
            ).hexdigest()

            # Compare signatures
            is_valid = hmac.compare_digest(expected_signature, signature)

            if is_valid:
                logger.info(f"Cashfree signature verified for order: {order_id}")
            else:
                logger.error(f"Cashfree signature mismatch for order: {order_id}")

            return is_valid

        except Exception as e:
            logger.error(f"Cashfree signature verification failed: {e}")
            return False

    def verify_webhook_signature(
        self,
        body_str: str,
        webhook_signature: str,
    ) -> bool:
        """
        Verify Cashfree webhook signature.
        
        Cashfree sends webhook signature in x-cashfree-signature header.
        The signature is HMAC-SHA256 of the raw request body.
        
        Args:
            body_str: Raw request body as string
            webhook_signature: Signature from x-cashfree-signature header
            
        Returns:
            True if signature is valid
        """
        if not self.enabled:
            return False
        
        try:
            # Generate HMAC SHA256 signature of the raw body
            expected_signature = hmac.new(
                self.secret_key.encode('utf-8'),
                body_str.encode('utf-8'),
                hashlib.sha256,
            ).hexdigest()
            
            # Compare signatures
            is_valid = hmac.compare_digest(expected_signature, webhook_signature)
            
            if is_valid:
                logger.info("Cashfree webhook signature verified")
            else:
                logger.error("Cashfree webhook signature mismatch")
            
            return is_valid
            
        except Exception as e:
            logger.error(f"Cashfree webhook signature verification failed: {e}")
            return False

    async def get_payment_methods(self) -> Dict[str, Any]:
        """
        Get available payment methods from Cashfree.

        Returns:
            List of available payment methods
        """
        if not self.enabled:
            return {"methods": [], "enabled": False}

        # Cashfree supports these payment methods by default
        return {
            "enabled": True,
            "methods": [
                {
                    "name": "UPI",
                    "display_name": "UPI",
                    "is_active": True,
                    "supported_currencies": ["INR"],
                },
                {
                    "name": "CARD",
                    "display_name": "Credit/Debit Card",
                    "is_active": True,
                    "supported_currencies": ["INR"],
                },
                {
                    "name": "NETBANKING",
                    "display_name": "Net Banking",
                    "is_active": True,
                    "supported_currencies": ["INR"],
                },
                {
                    "name": "WALLET",
                    "display_name": "Wallets",
                    "is_active": True,
                    "supported_currencies": ["INR"],
                },
                {
                    "name": "EMI",
                    "display_name": "EMI",
                    "is_active": False,  # Requires additional setup
                    "supported_currencies": ["INR"],
                },
            ],
        }


# Global Cashfree service instance
cashfree_service = CashfreeService()


def get_cashfree_service() -> CashfreeService:
    """Get Cashfree service instance."""
    return cashfree_service
