"""WhatsApp OTP Service for Aarya Clothing."""
import logging
import requests
import re
from typing import Dict, Any, Optional
from core.config import settings

logger = logging.getLogger(__name__)


class WhatsAppService:
    """Service for sending OTPs via WhatsApp Business API."""
    
    def __init__(self):
        """Initialize WhatsApp service with Meta Cloud API."""
        if not settings.whatsapp_enabled:
            raise ValueError(
                "WhatsApp service is not configured. "
                "Please set WHATSAPP_BUSINESS_ACCOUNT_ID, WHATSAPP_PHONE_NUMBER_ID, "
                "and WHATSAPP_ACCESS_TOKEN in environment variables."
            )
        
        self.base_url = (
            f"https://graph.facebook.com/{settings.WHATSAPP_API_VERSION}/"
            f"{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"
        )
        self.headers = {
            "Authorization": f"Bearer {settings.WHATSAPP_ACCESS_TOKEN}",
            "Content-Type": "application/json"
        }
    
    def _format_phone_number(self, phone: str) -> str:
        """
        Format phone number to E.164 format.
        
        E.164 format: +[country code][number]
        Example: +12345678900
        """
        # Remove all non-digit characters except +
        phone = re.sub(r'[^\d+]', '', phone)
        
        # Ensure it starts with +
        if not phone.startswith('+'):
            if len(phone) == 10:
                phone = f"+91{phone}"  # Indian 10-digit number
            elif len(phone) == 12 and phone.startswith("91"):
                phone = f"+{phone}"   # Already has 91 country code
            else:
                phone = f"+{phone}"
        
        return phone
    
    def send_otp(
        self,
        phone_number: str,
        otp_code: str,
        purpose: str = "verification"
    ) -> Dict[str, Any]:
        """
        Send OTP via WhatsApp.
        
        Args:
            phone_number: Recipient's phone number
            otp_code: 6-digit OTP code
            purpose: Purpose of OTP (verification, password_reset, etc.)
        
        Returns:
            API response dict
        
        Raises:
            requests.HTTPError: If API call fails
            ValueError: If phone number is invalid
        """
        try:
            # Format phone number
            formatted_phone = self._format_phone_number(phone_number)
            
            # Compose message
            if purpose == "password_reset":
                message = (
                    f"Your Aarya Clothing password reset code is: *{otp_code}*\n\n"
                    f"Valid for {settings.OTP_EXPIRY_MINUTES} minutes.\n"
                    f"Do not share this code with anyone."
                )
            else:
                message = (
                    f"Your Aarya Clothing verification code is: *{otp_code}*\n\n"
                    f"Valid for {settings.OTP_EXPIRY_MINUTES} minutes.\n"
                    f"Do not share this code with anyone."
                )
            
            # Prepare API payload
            payload = {
                "messaging_product": "whatsapp",
                "to": formatted_phone,
                "type": "text",
                "text": {
                    "body": message
                }
            }
            
            # Send request
            response = requests.post(
                self.base_url,
                headers=self.headers,
                json=payload,
                timeout=30
            )
            
            # Raise for HTTP errors
            response.raise_for_status()
            
            result = response.json()
            
            # Check if message was sent successfully
            if result.get("messages"):
                return {
                    "success": True,
                    "message_id": result["messages"][0]["id"],
                    "phone": formatted_phone
                }
            else:
                return {
                    "success": False,
                    "error": "No message ID returned from WhatsApp API"
                }
        
        except requests.exceptions.RequestException as e:
            logger.error(f"[WhatsApp API Error] {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
        except Exception as e:
            logger.error(f"[WhatsApp Service Error] {str(e)}")
            return {
                "success": False,
                "error": f"Failed to send WhatsApp OTP: {str(e)}"
            }
    
    def send_template_message(
        self,
        phone_number: str,
        template_name: str,
        language_code: str = "en",
        template_params: Optional[list] = None
    ) -> Dict[str, Any]:
        """
        Send a WhatsApp template message (for approved templates).
        
        This is useful if you have pre-approved message templates
        for OTP delivery on WhatsApp Business.
        
        Args:
            phone_number: Recipient's phone number
            template_name: Name of approved template
            language_code: Language code (e.g., 'en', 'es', 'hi')
            template_params: List of parameters to fill template placeholders
        
        Returns:
            API response dict
        """
        try:
            formatted_phone = self._format_phone_number(phone_number)
            
            payload = {
                "messaging_product": "whatsapp",
                "to": formatted_phone,
                "type": "template",
                "template": {
                    "name": template_name,
                    "language": {
                        "code": language_code
                    }
                }
            }
            
            # Add template parameters if provided
            if template_params:
                payload["template"]["components"] = [
                    {
                        "type": "body",
                        "parameters": [
                            {"type": "text", "text": param}
                            for param in template_params
                        ]
                    }
                ]
            
            response = requests.post(
                self.base_url,
                headers=self.headers,
                json=payload,
                timeout=30
            )
            
            response.raise_for_status()
            result = response.json()
            
            if result.get("messages"):
                return {
                    "success": True,
                    "message_id": result["messages"][0]["id"],
                    "phone": formatted_phone
                }
            else:
                return {
                    "success": False,
                    "error": "No message ID returned from WhatsApp API"
                }
        
        except Exception as e:
            logger.error(f"[WhatsApp Template Error] {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }


# Create singleton instance (will raise error if not configured)
try:
    whatsapp_service = WhatsAppService() if settings.whatsapp_enabled else None
except Exception as e:
    logger.warning(f"[WhatsApp Service] Not initialized: {str(e)}")
    whatsapp_service = None
