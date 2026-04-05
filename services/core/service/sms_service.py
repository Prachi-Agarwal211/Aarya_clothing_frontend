"""Twilio SMS Service for Aarya Clothing."""

import logging
import re
from typing import Dict, Any, Optional

try:
    from twilio.rest import Client as TwilioClient
    HAS_TWILIO = True
except ImportError:
    HAS_TWILIO = False

from core.config import settings

logger = logging.getLogger(__name__)


class SMSService:
    """Service for sending OTPs via Twilio SMS."""

    def __init__(self):
        """Initialize Twilio SMS client."""
        if not settings.sms_enabled:
            logger.info("SMS service is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER.")
            self.client = None
            self.from_number = None
            return

        if not HAS_TWILIO:
            logger.warning("Twilio package not installed. Install with: pip install twilio")
            self.client = None
            self.from_number = None
            return

        try:
            self.client = TwilioClient(
                settings.TWILIO_ACCOUNT_SID,
                settings.TWILIO_AUTH_TOKEN
            )
            self.from_number = settings.TWILIO_PHONE_NUMBER
            logger.info(f"Twilio SMS service initialized with {self.from_number}")
        except Exception as e:
            logger.error(f"Failed to initialize Twilio SMS service: {e}")
            self.client = None
            self.from_number = None

    def _format_phone_number(self, phone: str) -> str:
        """Format phone number for Twilio API."""
        phone = phone.strip()
        # If 10-digit Indian number, add +91
        if re.match(r'^\d{10}$', phone):
            return f"+91{phone}"
        # If starts with 91 and 12 digits, add +
        if re.match(r'^91\d{10}$', phone):
            return f"+{phone}"
        # Already has + prefix
        if phone.startswith('+'):
            return phone
        # Return as-is
        return phone

    def send_otp(self, phone_number: str, otp_code: str, purpose: str = "verification") -> Dict[str, Any]:
        """
        Send OTP via Twilio SMS.

        Args:
            phone_number: Recipient phone number
            otp_code: 6-digit OTP code
            purpose: "verification" or "password_reset"

        Returns:
            Dict with success status and message SID
        """
        if not self.client or not self.from_number:
            raise ValueError("SMS service is not configured. Please use email verification instead or contact support.")

        formatted_phone = self._format_phone_number(phone_number)

        if purpose == "password_reset":
            message_body = (
                f"Your Aarya Clothing password reset code is: {otp_code}\n\n"
                f"Valid for {settings.OTP_EXPIRY_MINUTES} minutes.\n"
                f"Do not share this code with anyone."
            )
        else:
            message_body = (
                f"Your Aarya Clothing verification code is: {otp_code}\n\n"
                f"Valid for {settings.OTP_EXPIRY_MINUTES} minutes.\n"
                f"Do not share this code with anyone."
            )

        try:
            message = self.client.messages.create(
                body=message_body,
                from_=self.from_number,
                to=formatted_phone
            )

            if not message.sid:
                logger.error(f"[SMS] No message SID returned for {formatted_phone}")
                return {"success": False, "error": "No message SID returned from Twilio"}

            logger.info(f"[SMS] OTP sent to {formatted_phone} (SID: {message.sid}, purpose: {purpose})")
            return {
                "success": True,
                "message_id": message.sid,
                "phone": formatted_phone,
                "message": "OTP sent successfully via SMS"
            }

        except Exception as e:
            error_msg = str(e)
            logger.error(f"[SMS Error] Failed to send SMS to {formatted_phone}: {error_msg}")

            if "AccountSuspended" in error_msg:
                raise ValueError("SMS service is temporarily unavailable. Please use email verification instead.")
            if "not found" in error_msg.lower() or "invalid" in error_msg.lower():
                raise ValueError("Invalid phone number. Please check and try again.")

            raise ValueError(f"Failed to send SMS OTP: {error_msg}")


# Singleton instance
try:
    sms_service = SMSService()
except Exception as e:
    logger.warning(f"[SMS Service] Not initialized: {e}")
    sms_service = None
