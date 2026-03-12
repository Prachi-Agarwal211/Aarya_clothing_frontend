"""
Cashfree Payment Gateway Client
Handles all Cashfree Payments API v3 operations.
Docs: https://docs.cashfree.com/docs/payment-gateway
"""

import hashlib
import hmac
import json
import logging
import requests
from typing import Dict, Any, Optional
from decimal import Decimal
import uuid
from datetime import datetime

from core.config import settings

logger = logging.getLogger(__name__)


class CashfreeClient:
    """Cashfree Payments Gateway Client (API v3)"""

    PROD_BASE = "https://api.cashfree.com/pg"
    SANDBOX_BASE = "https://sandbox.cashfree.com/pg"
    API_VERSION = "2023-08-01"

    def __init__(self):
        self.app_id = settings.CASHFREE_APP_ID
        self.secret_key = settings.CASHFREE_SECRET_KEY
        self.env = settings.CASHFREE_ENV  # PRODUCTION | SANDBOX
        self.base_url = self.PROD_BASE if self.env == "PRODUCTION" else self.SANDBOX_BASE
        self.headers = {
            "x-api-version": self.API_VERSION,
            "x-client-id": self.app_id,
            "x-client-secret": self.secret_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    # ── Orders ───────────────────────────────────────────────────────────────

    def create_order(
        self,
        order_id: str,
        amount: float,
        currency: str = "INR",
        customer_id: str = "",
        customer_email: str = "",
        customer_phone: str = "",
        customer_name: str = "",
        return_url: str = "",
        notify_url: str = "",
        order_meta: Optional[Dict] = None,
        order_tags: Optional[Dict] = None,
    ) -> Dict[str, Any]:
        """
        Create a Cashfree order.
        Returns: { cf_order_id, order_token, payment_session_id, order_status, ... }
        """
        payload: Dict[str, Any] = {
            "order_id": order_id,
            "order_amount": round(float(amount), 2),
            "order_currency": currency,
            "customer_details": {
                "customer_id": customer_id or f"cust_{order_id}",
                "customer_email": customer_email,
                "customer_phone": self._format_phone(customer_phone),
                "customer_name": customer_name or "Customer",
            },
            "order_meta": {
                "return_url": return_url or settings.PAYMENT_SUCCESS_URL + f"?order_id={order_id}",
                "notify_url": notify_url or settings.PAYMENT_NOTIFY_URL,
            },
        }

        if order_meta:
            payload["order_meta"].update(order_meta)
        if order_tags:
            payload["order_tags"] = order_tags

        try:
            resp = requests.post(
                f"{self.base_url}/orders",
                headers=self.headers,
                json=payload,
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
            logger.info(f"Cashfree order created: {data.get('cf_order_id')}")
            return {"success": True, **data}
        except requests.exceptions.HTTPError as e:
            error_body = {}
            try:
                error_body = e.response.json()
            except Exception:
                pass
            logger.error(f"Cashfree create_order HTTPError: {error_body}")
            return {"success": False, "error": error_body.get("message", str(e)), "details": error_body}
        except Exception as e:
            logger.error(f"Cashfree create_order error: {e}")
            return {"success": False, "error": str(e)}

    def get_order(self, order_id: str) -> Dict[str, Any]:
        """Fetch order details from Cashfree."""
        try:
            resp = requests.get(
                f"{self.base_url}/orders/{order_id}",
                headers=self.headers,
                timeout=15,
            )
            resp.raise_for_status()
            return {"success": True, **resp.json()}
        except Exception as e:
            logger.error(f"Cashfree get_order error: {e}")
            return {"success": False, "error": str(e)}

    # ── Payments ─────────────────────────────────────────────────────────────

    def get_payments_for_order(self, order_id: str) -> Dict[str, Any]:
        """Get all payments for an order."""
        try:
            resp = requests.get(
                f"{self.base_url}/orders/{order_id}/payments",
                headers=self.headers,
                timeout=15,
            )
            resp.raise_for_status()
            return {"success": True, "payments": resp.json()}
        except Exception as e:
            logger.error(f"Cashfree get_payments error: {e}")
            return {"success": False, "error": str(e)}

    def get_payment(self, order_id: str, cf_payment_id: str) -> Dict[str, Any]:
        """Get a specific payment."""
        try:
            resp = requests.get(
                f"{self.base_url}/orders/{order_id}/payments/{cf_payment_id}",
                headers=self.headers,
                timeout=15,
            )
            resp.raise_for_status()
            return {"success": True, **resp.json()}
        except Exception as e:
            logger.error(f"Cashfree get_payment error: {e}")
            return {"success": False, "error": str(e)}

    # ── Refunds ──────────────────────────────────────────────────────────────

    def create_refund(
        self,
        order_id: str,
        refund_amount: float,
        refund_id: Optional[str] = None,
        refund_note: str = "Customer request",
    ) -> Dict[str, Any]:
        """Create a refund for an order."""
        payload = {
            "refund_amount": round(float(refund_amount), 2),
            "refund_id": refund_id or f"refund_{order_id}_{uuid.uuid4().hex[:8]}",
            "refund_note": refund_note,
        }
        try:
            resp = requests.post(
                f"{self.base_url}/orders/{order_id}/refunds",
                headers=self.headers,
                json=payload,
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
            return {"success": True, **data}
        except requests.exceptions.HTTPError as e:
            error_body = {}
            try:
                error_body = e.response.json()
            except Exception:
                pass
            logger.error(f"Cashfree refund error: {error_body}")
            return {"success": False, "error": error_body.get("message", str(e))}
        except Exception as e:
            logger.error(f"Cashfree create_refund error: {e}")
            return {"success": False, "error": str(e)}

    def get_refund(self, order_id: str, refund_id: str) -> Dict[str, Any]:
        """Get refund status."""
        try:
            resp = requests.get(
                f"{self.base_url}/orders/{order_id}/refunds/{refund_id}",
                headers=self.headers,
                timeout=15,
            )
            resp.raise_for_status()
            return {"success": True, **resp.json()}
        except Exception as e:
            return {"success": False, "error": str(e)}

    # ── Webhook ──────────────────────────────────────────────────────────────

    def verify_webhook_signature(self, raw_body: str, timestamp: str, signature: str) -> bool:
        """
        Verify Cashfree webhook signature.
        Signature = HMAC-SHA256(timestamp + raw_body, secret_key)
        """
        try:
            message = timestamp + raw_body
            computed = hmac.new(
                self.secret_key.encode("utf-8"),
                message.encode("utf-8"),
                hashlib.sha256,
            ).hexdigest()  # hmac.new = hmac.HMAC factory
            return hmac.compare_digest(computed, signature)
        except Exception as e:
            logger.error(f"Webhook signature verification error: {e}")
            return False

    # ── Helpers ──────────────────────────────────────────────────────────────

    @staticmethod
    def _format_phone(phone: str) -> str:
        """Ensure phone is in Indian format for Cashfree (10 digits, no country code)."""
        import re
        digits = re.sub(r"\D", "", phone or "")
        # Strip +91 or 91 prefix
        if digits.startswith("91") and len(digits) == 12:
            digits = digits[2:]
        if len(digits) != 10:
            return "9999999999"  # safe fallback
        return digits

    @staticmethod
    def generate_order_id(prefix: str = "aarya") -> str:
        """Generate unique Cashfree-compatible order ID (max 50 chars, alphanumeric + _-)."""
        ts = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        uid = uuid.uuid4().hex[:8]
        return f"{prefix}_{ts}_{uid}"


# Global singleton
cashfree_client = CashfreeClient()
