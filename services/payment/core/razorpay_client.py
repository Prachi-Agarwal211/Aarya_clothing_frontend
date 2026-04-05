"""Razorpay client for payment processing."""
import hashlib
import hmac
import json
import requests
from typing import Dict, Any, Optional
from decimal import Decimal
import razorpay
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

from core.config import settings


class RazorpayClient:
    """Razorpay payment gateway client."""
    
    def __init__(self):
        """Initialize Razorpay client."""
        if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
            raise ValueError("Razorpay credentials not configured")
        
        self.client = razorpay.Client(
            auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
        )
    
    def create_order(self, amount: int, currency: str = "INR",
                    receipt: Optional[str] = None,
                    notes: Optional[Dict[str, str]] = None,
                    checkout_config_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Create a Razorpay order.
        
        Args:
            amount: Amount in smallest currency unit (paise for INR)
            currency: Currency code (default: INR)
            receipt: Receipt ID
            notes: Additional notes
            checkout_config_id: Razorpay Dashboard Payment Config ID (enables UPI etc.)
            
        Returns:
            Razorpay order response
        """
        try:
            order_data = {
                "amount": amount,
                "currency": currency,
                "payment_capture": 1,  # Auto-capture payment
            }
            
            if receipt:
                order_data["receipt"] = receipt
            
            if notes:
                order_data["notes"] = notes

            if checkout_config_id:
                order_data["checkout_config_id"] = checkout_config_id
                logger.info(f"Adding checkout_config_id to order: {checkout_config_id}")
            else:
                logger.warning("NO checkout_config_id provided - UPI may not show!")

            logger.info(f"Creating Razorpay order with data: {order_data.keys()}")
            order = self.client.order.create(data=order_data)
            logger.info(f"Razorpay order response: id={order.get('id')}, config={order.get('config')}")
            return order
            
        except Exception as e:
            logger.error(f"Failed to create Razorpay order: {str(e)}")
            raise ValueError(f"Payment order creation failed: {str(e)}")
    
    def verify_payment(self, razorpay_order_id: str,
                      razorpay_payment_id: str,
                      razorpay_signature: str) -> bool:
        """
        Verify Razorpay payment signature using direct HMAC-SHA256.

        Razorpay signs: HMAC_SHA256(secret, f"{order_id}|{payment_id}")
        We replicate this exactly — no SDK version dependency.

        Args:
            razorpay_order_id: Razorpay order ID
            razorpay_payment_id: Razorpay payment ID
            razorpay_signature: Hex-encoded HMAC signature from Razorpay

        Returns:
            True if signature is valid, False otherwise
        """
        try:
            logger.info(
                f"verify_payment: order={razorpay_order_id} "
                f"payment={razorpay_payment_id} "
                f"sig_prefix={razorpay_signature[:12] if razorpay_signature else 'EMPTY'}"
            )

            if not all([razorpay_order_id, razorpay_payment_id, razorpay_signature]):
                logger.warning("verify_payment called with missing fields")
                return False

            # Standard Razorpay HMAC: SHA-256 of "order_id|payment_id"
            message   = f"{razorpay_order_id}|{razorpay_payment_id}"
            generated = hmac.new(
                settings.RAZORPAY_KEY_SECRET.encode('utf-8'),
                message.encode('utf-8'),
                hashlib.sha256,
            ).hexdigest()

            is_valid = hmac.compare_digest(generated, razorpay_signature)

            if is_valid:
                logger.info(
                    f"✓ Payment signature valid: order={razorpay_order_id} "
                    f"payment={razorpay_payment_id}"
                )
            else:
                logger.error(
                    f"✗ Signature MISMATCH: order={razorpay_order_id} "
                    f"payment={razorpay_payment_id} | "
                    f"expected_prefix={generated[:16]} | "
                    f"received_prefix={razorpay_signature[:16]}"
                )

            return is_valid

        except Exception as e:
            logger.error(f"Payment verification exception: {e}")
            return False
    
    def fetch_payment(self, payment_id: str) -> Dict[str, Any]:
        """
        Fetch payment details from Razorpay.
        
        Args:
            payment_id: Razorpay payment ID
            
        Returns:
            Payment details
        """
        try:
            payment = self.client.payment.fetch(payment_id)
            return payment
            
        except Exception as e:
            logger.error(f"Failed to fetch payment: {str(e)}")
            raise ValueError(f"Payment fetch failed: {str(e)}")
    
    def fetch_order(self, order_id: str) -> Dict[str, Any]:
        """
        Fetch order details from Razorpay.
        
        Args:
            order_id: Razorpay order ID
            
        Returns:
            Order details
        """
        try:
            order = self.client.order.fetch(order_id)
            return order
            
        except Exception as e:
            logger.error(f"Failed to fetch order: {str(e)}")
            raise ValueError(f"Order fetch failed: {str(e)}")
    
    def refund_payment(self, payment_id: str, amount: Optional[int] = None) -> Dict[str, Any]:
        """
        Process a refund.
        
        Args:
            payment_id: Razorpay payment ID
            amount: Refund amount in paise (optional, full refund if not provided)
            
        Returns:
            Refund details
        """
        try:
            refund_data = {}
            if amount:
                refund_data["amount"] = amount
            
            refund = self.client.payment.refund(payment_id, refund_data)
            return refund
            
        except Exception as e:
            logger.error(f"Failed to process refund: {str(e)}")
            raise ValueError(f"Refund processing failed: {str(e)}")
    
    def capture_payment(self, payment_id: str, amount: int, currency: str = "INR") -> Dict[str, Any]:
        """
        Capture a payment.
        
        Args:
            payment_id: Razorpay payment ID
            amount: Amount to capture in paise
            currency: Currency code
            
        Returns:
            Capture response
        """
        try:
            capture = self.client.payment.capture(payment_id, amount, currency)
            return capture
            
        except Exception as e:
            logger.error(f"Failed to capture payment: {str(e)}")
            raise ValueError(f"Payment capture failed: {str(e)}")
    
    def get_payment_methods(self) -> Dict[str, Any]:
        """
        Get available payment methods.

        Returns:
            Available payment methods
        """
        try:
            methods = self.client.payment.method()
            return methods

        except Exception as e:
            logger.error(f"Failed to fetch payment methods: {str(e)}")
            raise ValueError(f"Payment methods fetch failed: {str(e)}")

    def create_qr_code(self, amount: int, description: str, close_by: int,
                      notes: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        """
        Create a UPI QR code for payment.

        Args:
            amount: Amount in smallest currency unit (paise for INR)
            description: Payment description
            close_by: Unix timestamp when QR code expires (max 30 minutes from now)
            notes: Additional notes

        Returns:
            QR code response with image_url
        """
        try:
            qr_data = {
                "type": "upi_qr",
                "name": description,
                "amount": amount,
                "close_by": close_by,
            }

            if notes:
                qr_data["notes"] = notes

            logger.info(f"Creating QR code with amount={amount}, description={description}")

            # Razorpay QR codes API is not in the official SDK, use direct HTTP call
            url = "https://api.razorpay.com/v1/payments/qr_codes"
            auth = (settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
            response = requests.post(url, json=qr_data, auth=auth, timeout=10)
            response.raise_for_status()
            qr_response = response.json()

            logger.info(f"QR code created: id={qr_response.get('id')}, image_url present={bool(qr_response.get('image_url'))}")
            return qr_response

        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to create QR code: {str(e)}")
            raise ValueError(f"QR code creation failed: {str(e)}")
        except Exception as e:
            logger.error(f"Failed to create QR code: {str(e)}")
            raise ValueError(f"QR code creation failed: {str(e)}")

    def fetch_qr_code(self, qr_code_id: str) -> Dict[str, Any]:
        """
        Fetch QR code details from Razorpay.

        Args:
            qr_code_id: QR code ID

        Returns:
            QR code details including payment status
        """
        try:
            url = f"https://api.razorpay.com/v1/payments/qr_codes/{qr_code_id}"
            auth = (settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
            response = requests.get(url, auth=auth, timeout=10)
            response.raise_for_status()
            qr_data = response.json()

            logger.info(f"QR code fetched: id={qr_data.get('id')}, status={qr_data.get('status')}")
            return qr_data

        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to fetch QR code: {str(e)}")
            raise ValueError(f"QR code fetch failed: {str(e)}")
        except Exception as e:
            logger.error(f"Failed to fetch QR code: {str(e)}")
            raise ValueError(f"QR code fetch failed: {str(e)}")
    
    def verify_webhook_signature(self, webhook_body: str, 
                                webhook_signature: str) -> bool:
        """
        Verify webhook signature.
        
        Args:
            webhook_body: Raw webhook request body
            webhook_signature: Webhook signature from header
            
        Returns:
            True if signature is valid, False otherwise
        """
        try:
            if not settings.RAZORPAY_WEBHOOK_SECRET:
                return False
            
            # Generate expected signature
            expected_signature = hmac.HMAC(
                settings.RAZORPAY_WEBHOOK_SECRET.encode('utf-8'),
                webhook_body.encode('utf-8'),
                hashlib.sha256
            ).hexdigest()
            
            # Timing-safe comparison
            return hmac.compare_digest(expected_signature, webhook_signature)
            
        except Exception as e:
            logger.error(f"Webhook signature verification failed: {str(e)}")
            raise ValueError(f"Webhook signature verification failed: {str(e)}")
    
    def parse_webhook_event(self, webhook_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Parse webhook event data.
        
        Args:
            webhook_data: Webhook event data
            
        Returns:
            Parsed event information
        """
        try:
            event_type = webhook_data.get("event", "")
            payload = webhook_data.get("payload", {})
            
            # Extract common information
            event_info = {
                "event_type": event_type,
                "event_id": webhook_data.get("id"),
                "created_at": webhook_data.get("created_at"),
                "payload": webhook_data
            }
            
            # Parse specific event types
            if event_type == "payment.captured":
                payment_entity = payload.get("payment", {})
                event_info.update({
                    "payment_id": payment_entity.get("id"),
                    "order_id": payment_entity.get("order_id"),
                    "amount": payment_entity.get("amount"),
                    "currency": payment_entity.get("currency"),
                    "status": payment_entity.get("status"),
                    "method": payment_entity.get("method"),
                    "email": payment_entity.get("email"),
                    "contact": payment_entity.get("contact")
                })
            
            elif event_type == "payment.failed":
                payment_entity = payload.get("payment", {})
                event_info.update({
                    "payment_id": payment_entity.get("id"),
                    "order_id": payment_entity.get("order_id"),
                    "amount": payment_entity.get("amount"),
                    "currency": payment_entity.get("currency"),
                    "status": payment_entity.get("status"),
                    "error_code": payment_entity.get("error_code"),
                    "error_description": payment_entity.get("error_description")
                })
            
            elif event_type == "refund.processed":
                refund_entity = payload.get("refund", {})
                event_info.update({
                    "refund_id": refund_entity.get("id"),
                    "payment_id": refund_entity.get("payment_id"),
                    "amount": refund_entity.get("amount"),
                    "currency": refund_entity.get("currency"),
                    "status": refund_entity.get("status")
                })
            
            return event_info
            
        except Exception as e:
            logger.error(f"Failed to parse webhook event: {str(e)}")
            raise ValueError(f"Webhook event parsing failed: {str(e)}")


# Global Razorpay client instance
razorpay_client = None

def get_razorpay_client() -> RazorpayClient:
    """Get or create Razorpay client instance."""
    global razorpay_client
    if razorpay_client is None:
        razorpay_client = RazorpayClient()
    return razorpay_client
