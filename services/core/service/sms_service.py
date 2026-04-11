"""MSG91 SMS Service for Aarya Clothing."""

import logging
import re
from typing import Dict, Any, Optional

import httpx

from core.config import settings

logger = logging.getLogger(__name__)

# MSG91 API endpoints
MSG91_SEND_OTP_URL = "https://control.msg91.com/api/v5/otp"
MSG91_SEND_SMS_URL = "https://api.msg91.com/api/v5/flows"


class SMSService:
    """Service for sending OTPs via MSG91 SMS."""

    def __init__(self):
        """Initialize MSG91 SMS client."""
        if not settings.sms_enabled:
            logger.info("SMS service is not configured. Set MSG91_AUTH_KEY, MSG91_TEMPLATE_ID, and MSG91_SENDER_ID.")
            self.auth_key = None
            self.template_id = None
            self.sender_id = None
            return

        self.auth_key = settings.MSG91_AUTH_KEY
        self.template_id = settings.MSG91_TEMPLATE_ID
        self.sender_id = settings.MSG91_SENDER_ID
        logger.info("MSG91 SMS service initialized successfully")

    def _format_phone_number(self, phone: str) -> str:
        """Format phone number for MSG91 API (international format without +)."""
        phone = phone.strip()
        # If 10-digit Indian number, add 91
        if re.match(r'^\d{10}$', phone):
            return f"91{phone}"
        # If starts with +91, remove the +
        if phone.startswith('+91'):
            return phone[1:]  # Remove the +
        # If starts with +, remove it
        if phone.startswith('+'):
            return phone[1:]
        # Return as-is
        return phone

    def send_otp(self, phone_number: str, otp_code: str, purpose: str = "verification") -> Dict[str, Any]:
        """
        Send OTP via MSG91 SMS.

        Args:
            phone_number: Recipient phone number
            otp_code: 6-digit OTP code (MSG91 can also generate its own)
            purpose: "verification" or "password_reset"

        Returns:
            Dict with success status and message ID
        """
        if not self.auth_key or not self.template_id or not self.sender_id:
            raise ValueError("SMS service is not configured. Please use email verification instead or contact support.")

        formatted_phone = self._format_phone_number(phone_number)

        # MSG91 OTP API expects the OTP to be sent as part of the request
        # The template should have a variable like ##OTP## that gets replaced
        payload = {
            "template_id": self.template_id,
            "short_url_requests": [
                {
                    "mobiles": formatted_phone,
                    "OTP": otp_code
                }
            ]
        }

        headers = {
            "authkey": self.auth_key,
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(
                    MSG91_SEND_OTP_URL,
                    json=payload,
                    headers=headers
                )

                if response.status_code != 200:
                    logger.error(f"[MSG91] HTTP {response.status_code}: {response.text}")
                    return {"success": False, "error": f"MSG91 API returned status {response.status_code}"}

                result = response.json()

                # MSG91 returns {"type": "success", "message": "..."} on success
                if result.get("type") == "success":
                    message_id = result.get("request_id", "unknown")
                    logger.info(f"[MSG91] OTP sent to {formatted_phone} (Request ID: {message_id}, purpose: {purpose})")
                    return {
                        "success": True,
                        "message_id": message_id,
                        "phone": formatted_phone,
                        "message": "OTP sent successfully via SMS"
                    }
                else:
                    error_msg = result.get("message", "Unknown error from MSG91")
                    logger.error(f"[MSG91] Failed for {formatted_phone}: {error_msg}")
                    return {"success": False, "error": error_msg}

        except httpx.TimeoutException:
            logger.error(f"[MSG91] Timeout sending OTP to {formatted_phone}")
            raise ValueError("SMS service timed out. Please try again or use email verification.")
        except httpx.RequestError as e:
            logger.error(f"[MSG91] Request error for {formatted_phone}: {str(e)}")
            raise ValueError(f"Failed to send SMS OTP: {str(e)}")
        except Exception as e:
            error_msg = str(e)
            logger.error(f"[MSG91 Error] Failed to send SMS to {formatted_phone}: {error_msg}")
            raise ValueError(f"Failed to send SMS OTP: {error_msg}")

    def send_order_flow_sms(
        self,
        phone_number: str,
        *,
        order_number: str,
        summary_line: str,
        link: str = "",
    ) -> Dict[str, Any]:
        """
        Transactional order update via MSG91 Flow API (separate DLT template from OTP).
        Configure MSG91_ORDER_FLOW_TEMPLATE_ID and match ##var## placeholders in the console.
        """
        if not phone_number or not str(phone_number).strip():
            return {"success": False, "error": "no_phone"}
        tid = getattr(settings, "MSG91_ORDER_FLOW_TEMPLATE_ID", None)
        if not self.auth_key or not tid:
            logger.info(
                "[MSG91] Order SMS skipped: MSG91_ORDER_FLOW_TEMPLATE_ID not set or SMS disabled"
            )
            return {"success": False, "error": "order_flow_template_not_configured"}

        formatted_phone = self._format_phone_number(phone_number)
        payload = {
            "template_id": tid,
            "short_url": "0",
            "realTimeResponse": "1",
            "recipients": [
                {
                    "mobiles": formatted_phone,
                    "var1": order_number[:80],
                    "var2": (summary_line or "")[:160],
                    "var3": (link or "")[:500],
                }
            ],
        }
        headers = {
            "authkey": self.auth_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        try:
            with httpx.Client(timeout=30.0) as client:
                r = client.post(MSG91_SEND_SMS_URL, json=payload, headers=headers)
                if r.status_code != 200:
                    logger.error(f"[MSG91 Flow] HTTP {r.status_code}: {r.text}")
                    return {"success": False, "error": f"HTTP {r.status_code}"}
                result = r.json()
                if result.get("type") == "success" or result.get("message", "").lower() == "success":
                    return {"success": True, "message_id": result.get("request_id", "ok")}
                err = result.get("message", str(result))
                logger.error(f"[MSG91 Flow] Failed: {err}")
                return {"success": False, "error": err}
        except Exception as e:
            logger.error(f"[MSG91 Flow] Exception: {e}")
            return {"success": False, "error": str(e)}


# Singleton instance
try:
    sms_service = SMSService()
except Exception as e:
    logger.warning(f"[SMS Service] Not initialized: {e}")
    sms_service = None
