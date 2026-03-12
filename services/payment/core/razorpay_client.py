"""Razorpay client for payment processing."""
import hashlib
import hmac
import json
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
                    notes: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        """
        Create a Razorpay order.
        
        Args:
            amount: Amount in smallest currency unit (paise for INR)
            currency: Currency code (default: INR)
            receipt: Receipt ID
            notes: Additional notes
            
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
            
            order = self.client.order.create(data=order_data)
            return order
            
        except Exception as e:
            logger.error(f"Failed to create Razorpay order: {str(e)}")
            raise ValueError(f"Payment order creation failed: {str(e)}")
    
    def verify_payment(self, razorpay_order_id: str, 
                      razorpay_payment_id: str, 
                      razorpay_signature: str) -> bool:
        """
        Verify Razorpay payment signature.
        
        Args:
            razorpay_order_id: Razorpay order ID
            razorpay_payment_id: Razorpay payment ID
            razorpay_signature: Razorpay signature
            
        Returns:
            True if signature is valid, False otherwise
        """
        try:
            # Generate signature
            generated_signature = hmac.HMAC(
                settings.RAZORPAY_KEY_SECRET.encode('utf-8'),
                f"{razorpay_order_id}|{razorpay_payment_id}".encode('utf-8'),
                hashlib.sha256
            ).hexdigest()
            
            # Timing-safe comparison
            return hmac.compare_digest(generated_signature, razorpay_signature)
            
        except Exception as e:
            logger.error(f"Payment verification failed: {str(e)}")
            raise ValueError(f"Payment verification failed: {str(e)}")
    
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
