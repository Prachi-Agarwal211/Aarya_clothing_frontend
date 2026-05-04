"""Fast2SMS SMS Service for Aarya Clothing."""

import logging
import re
from typing import Dict, Any, Optional

import httpx

from core.config import settings

logger = logging.getLogger(__name__)


class SMSService:
    """Service for sending SMS via Fast2SMS."""

    def __init__(self):
        """Initialize Fast2SMS SMS client."""
        if not settings.FAST2SMS_API_KEY:
            logger.info("SMS service is not configured. Set FAST2SMS_API_KEY.")
            self.api_key = None
            return

        self.api_key = settings.FAST2SMS_API_KEY
        self.base_url = "https://www.fast2sms.com/dev/bulkV2"
        self.route = settings.FAST2SMS_SMS_ROUTE
        self.sender_id = settings.FAST2SMS_SMS_SENDER_ID
        self.flash = settings.FAST2SMS_SMS_FLASH
        logger.info("Fast2SMS SMS service initialized successfully")

    def _format_phone_number(self, phone: str) -> str:
        """Format phone number - remove non-digits, handle country code."""
        phone = str(phone).strip()
        phone = re.sub(r'\D', '', phone)
        return phone

    def send_sms(
        self,
        to_phone: str,
        message_template_id: str,
        variables_values: str,
        flash: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Send SMS using Fast2SMS.

        Args:
            to_phone: Recipient phone number
            message_template_id: Fast2SMS message template ID (e.g., "214721" for OTP)
            variables_values: Pipe-separated values for template variables
            flash: "1" for flash SMS, "0" for normal (defaults to config)
        """
        if not self.api_key:
            logger.warning("[SMS] FAST2SMS_API_KEY not configured")
            return {"success": False, "error": "Fast2SMS API Key is missing."}

        formatted_phone = self._format_phone_number(to_phone)

        params = {
            "authorization": self.api_key,
            "route": self.route,
            "sender_id": self.sender_id,
            "message": message_template_id,
            "variables_values": variables_values,
            "flash": flash if flash is not None else self.flash,
            "numbers": formatted_phone,
        }

        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.get(self.base_url, params=params)

                if response.status_code != 200:
                    error_msg = response.text
                    logger.error(f"[SMS] HTTP {response.status_code}: {error_msg}")
                    return {"success": False, "error": f"Fast2SMS API Error ({response.status_code}): {error_msg}"}

                result = response.json()

                if result.get("return") is True:
                    message_id = result.get("request_id", "")
                    logger.info(f"[SMS] Message sent to {formatted_phone} (ID: {message_id})")
                    return {"success": True, "message_id": message_id}
                else:
                    error_msg = result.get("message", "Unknown error")
                    logger.error(f"[SMS] API error: {error_msg}")
                    return {"success": False, "error": error_msg}

        except httpx.ConnectError:
            logger.error("[SMS] Connection error to Fast2SMS API")
            return {"success": False, "error": "Could not connect to Fast2SMS API."}
        except Exception as e:
            logger.error(f"[SMS] Exception sending to {formatted_phone}: {str(e)}")
            return {"success": False, "error": f"Internal error sending SMS: {str(e)}"}

    def send_otp(self, phone: str, otp_code: str, purpose: str = "verification") -> Dict[str, Any]:
        """Send OTP via SMS using Fast2SMS template."""
        return self.send_sms(
            to_phone=phone,
            message_template_id=settings.FAST2SMS_SMS_TEMPLATE_OTP,
            variables_values=otp_code,
        )


# Module-level instance for easy import
sms_service = SMSService()
