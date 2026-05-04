"""Fast2SMS WhatsApp API Service for Aarya Clothing."""

import logging
import re
from typing import Dict, Any, List, Optional

import httpx

from core.config import settings

logger = logging.getLogger(__name__)


class WhatsAppService:
    """Service for sending WhatsApp messages via Fast2SMS."""

    def __init__(self):
        """Initialize Fast2SMS WhatsApp client."""
        if not settings.whatsapp_enabled:
            logger.info("WhatsApp service is not configured. Set FAST2SMS_API_KEY and FAST2SMS_PHONE_NUMBER_ID.")
            self.api_key = None
            self.phone_number_id = None
            return

        self.api_key = settings.FAST2SMS_API_KEY
        self.phone_number_id = settings.FAST2SMS_PHONE_NUMBER_ID
        self.base_url = "https://www.fast2sms.com/dev/whatsapp"
        logger.info("Fast2SMS WhatsApp service initialized successfully")

    def _format_phone_number(self, phone: str) -> str:
        """Format phone number - remove non-digits, ensure country code."""
        phone = str(phone).strip()
        phone = re.sub(r'\D', '', phone)
        return phone

    def send_template_message(
        self,
        to_phone: str,
        template_message_id: str,
        variables_values: str,
    ) -> Dict[str, Any]:
        """
        Send a WhatsApp message using a Fast2SMS Approved Template.

        Args:
            to_phone: Recipient phone number
            template_message_id: Fast2SMS message_id (e.g., "19572" for auth_otp)
            variables_values: Pipe-separated values for template variables (e.g., "123456" or "John|2024-01-01|Update text")
        """
        if not self.api_key:
            logger.warning("[WhatsApp] FAST2SMS_API_KEY not configured")
            return {"success": False, "error": "Fast2SMS API Key is missing."}

        if not self.phone_number_id:
            logger.warning("[WhatsApp] FAST2SMS_PHONE_NUMBER_ID not configured")
            return {"success": False, "error": "Fast2SMS Phone Number ID is missing."}

        formatted_phone = self._format_phone_number(to_phone)

        url = (
            f"{self.base_url}"
            f"?authorization={self.api_key}"
            f"&message_id={template_message_id}"
            f"&phone_number_id={self.phone_number_id}"
            f"&numbers={formatted_phone}"
            f"&variables_values={variables_values}"
        )

        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.get(url)

                if response.status_code not in (200, 201, 202):
                    error_msg = response.text
                    logger.error(f"[WhatsApp] HTTP {response.status_code}: {error_msg}")
                    return {"success": False, "error": f"Fast2SMS API Error ({response.status_code}): {error_msg}"}

                result = response.json()

                if result.get("return") is True:
                    message_id = result.get("request_id", "")
                    logger.info(f"[WhatsApp] Message sent to {formatted_phone} (ID: {message_id})")
                    return {"success": True, "message_id": message_id}
                else:
                    error_msg = result.get("message", "Unknown error")
                    logger.error(f"[WhatsApp] API error: {error_msg}")
                    return {"success": False, "error": error_msg}

        except httpx.ConnectError:
            logger.error("[WhatsApp] Connection error to Fast2SMS API")
            return {"success": False, "error": "Could not connect to Fast2SMS API. Please check your internet connection."}
        except Exception as e:
            logger.error(f"[WhatsApp] Exception sending to {formatted_phone}: {str(e)}")
            return {"success": False, "error": f"Internal error sending WhatsApp: {str(e)}"}

    def send_otp(self, phone: str, otp_code: str) -> Dict[str, Any]:
        """Send OTP via WhatsApp using Fast2SMS auth_otp template (message_id: 19572)."""
        # Template 19572 (auth_otp) has 1 variable: Var1 = OTP code
        return self.send_template_message(
            to_phone=phone,
            template_message_id=settings.FAST2SMS_TEMPLATE_AUTH_OTP,
            variables_values=otp_code,
        )

    def send_order_confirmation(self, phone: str, customer_name: str, order_number: str, total_amount: str) -> Dict[str, Any]:
        """Send order confirmation via WhatsApp."""
        # Reuse update_regarding_case template (19573) with 3 variables
        return self.send_template_message(
            to_phone=phone,
            template_message_id=settings.FAST2SMS_TEMPLATE_UPDATE_CASE,
            variables_values=f"{customer_name}|Order {order_number}|Your order total is ₹{total_amount}",
        )

    def send_order_shipped(self, phone: str, customer_name: str, order_number: str, tracking_url: str) -> Dict[str, Any]:
        """Send shipping notification via WhatsApp."""
        return self.send_template_message(
            to_phone=phone,
            template_message_id=settings.FAST2SMS_TEMPLATE_UPDATE_CASE,
            variables_values=f"{customer_name}|Order {order_number}|Shipped! Track: {tracking_url}",
        )


# Singleton instance
whatsapp_service = WhatsAppService()
