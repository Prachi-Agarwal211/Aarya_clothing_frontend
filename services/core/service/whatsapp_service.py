"""Meta WhatsApp Cloud API Service for Aarya Clothing."""

import logging
import re
from typing import Dict, Any, List, Optional

import httpx

from core.config import settings

logger = logging.getLogger(__name__)


class WhatsAppService:
    """Service for sending WhatsApp messages via Meta Cloud API."""

    def __init__(self):
        """Initialize Meta WhatsApp client."""
        if not settings.whatsapp_enabled:
            logger.info("WhatsApp service is not configured. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID.")
            self.access_token = None
            self.phone_number_id = None
            return

        self.access_token = settings.WHATSAPP_ACCESS_TOKEN
        self.phone_number_id = settings.WHATSAPP_PHONE_NUMBER_ID
        self.api_version = settings.WHATSAPP_API_VERSION
        self.base_url = f"https://graph.facebook.com/{self.api_version}/{self.phone_number_id}/messages"
        logger.info("Meta WhatsApp service initialized successfully")

    def _format_phone_number(self, phone: str) -> str:
        """Format phone number for Meta API (must include country code, no +)."""
        phone = str(phone).strip()
        # Remove any non-digit characters
        phone = re.sub(r'\D', '', phone)
        
        # If 10-digit Indian number, add 91
        if len(phone) == 10:
            return f"91{phone}"
        
        return phone

    def send_template_message(
        self,
        to_phone: str,
        template_name: str,
        parameters: List[Dict[str, Any]],
        language_code: str = "en",
        button_parameters: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Send a WhatsApp message using a Meta Approved Template.
        """
        if not self.access_token:
            logger.warning("[WhatsApp] WHATSAPP_ACCESS_TOKEN not configured")
            return {"success": False, "error": "WhatsApp Access Token is missing."}
            
        if not self.phone_number_id:
            logger.warning("[WhatsApp] WHATSAPP_PHONE_NUMBER_ID not configured")
            return {"success": False, "error": "WhatsApp Phone Number ID is missing."}

        formatted_phone = self._format_phone_number(to_phone)
        
        components = [
            {
                "type": "body",
                "parameters": parameters
            }
        ]
        
        if button_parameters:
            components.append({
                "type": "button",
                "sub_type": "url",
                "index": 0,
                "parameters": button_parameters
            })

        payload = {
            "messaging_product": "whatsapp",
            "to": formatted_phone,
            "type": "template",
            "template": {
                "name": template_name,
                "language": {
                    "code": language_code
                },
                "components": components
            }
        }

        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }

        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(
                    self.base_url,
                    json=payload,
                    headers=headers
                )

                if response.status_code not in (200, 201, 202):
                    error_data = {}
                    try:
                        error_data = response.json()
                    except:
                        pass
                    
                    print(f"FULL ERROR RESPONSE: {response.text}")
                    error_msg = error_data.get("error", {}).get("message", response.text)
                    logger.error(f"[WhatsApp] HTTP {response.status_code}: {error_msg}")
                    
                    if response.status_code == 401:
                        return {"success": False, "error": "Invalid or expired WhatsApp Access Token."}
                    
                    return {"success": False, "error": f"WhatsApp API Error ({response.status_code}): {error_msg}"}

                result = response.json()
                
                if "messages" in result:
                    message_id = result["messages"][0].get("id")
                    logger.info(f"[WhatsApp] Message sent to {formatted_phone} (ID: {message_id})")
                    return {"success": True, "message_id": message_id}
                else:
                    logger.error(f"[WhatsApp] Unexpected response format: {result}")
                    return {"success": False, "error": "Unexpected response format from WhatsApp API."}

        except httpx.ConnectError:
            logger.error(f"[WhatsApp] Connection error to Meta API")
            return {"success": False, "error": "Could not connect to WhatsApp API. Please check your internet connection."}
        except Exception as e:
            logger.error(f"[WhatsApp] Exception sending to {formatted_phone}: {str(e)}")
            return {"success": False, "error": f"Internal error sending WhatsApp: {str(e)}"}

    # --- Convenience Methods ---

    def send_otp(self, phone: str, otp_code: str) -> Dict[str, Any]:
        """Send OTP via WhatsApp."""
        # Meta Authentication templates with a 'Copy Code' button
        # usually expect the same parameter for both the body and the button.
        # Component index 0 is body, component index 1 is usually the button.
        
        formatted_phone = self._format_phone_number(phone)
        
        payload = {
            "messaging_product": "whatsapp",
            "to": formatted_phone,
            "type": "template",
            "template": {
                "name": settings.WHATSAPP_TEMPLATE_OTP,
                "language": {
                    "code": "en"
                },
                "components": [
                    {
                        "type": "body",
                        "parameters": [
                            {"type": "text", "text": otp_code}
                        ]
                    },
                    {
                        "type": "button",
                        "sub_type": "url",
                        "index": 0,
                        "parameters": [
                            {"type": "text", "text": otp_code}
                        ]
                    }
                ]
            }
        }

        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }

        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(self.base_url, json=payload, headers=headers)
                if response.status_code in (200, 201, 202):
                    res_data = response.json()
                    return {"success": True, "message_id": res_data["messages"][0].get("id")}
                
                logger.error(f"[WhatsApp OTP] Error {response.status_code}: {response.text}")
                return {"success": False, "error": f"Meta API Error: {response.status_code}"}
        except Exception as e:
            logger.error(f"[WhatsApp OTP] Exception: {str(e)}")
            return {"success": False, "error": str(e)}

    def send_order_confirmation(self, phone: str, customer_name: str, order_number: str, total_amount: str) -> Dict[str, Any]:
        """Send order confirmation via WhatsApp."""
        return self.send_template_message(
            to_phone=phone,
            template_name=settings.WHATSAPP_TEMPLATE_ORDER_CONFIRMED,
            parameters=[
                {"type": "text", "text": customer_name},
                {"type": "text", "text": order_number},
                {"type": "text", "text": total_amount}
            ]
        )

    def send_order_shipped(self, phone: str, customer_name: str, order_number: str, tracking_url: str) -> Dict[str, Any]:
        """Send shipping notification via WhatsApp."""
        return self.send_template_message(
            to_phone=phone,
            template_name=settings.WHATSAPP_TEMPLATE_ORDER_SHIPPED,
            parameters=[
                {"type": "text", "text": customer_name},
                {"type": "text", "text": order_number},
                {"type": "text", "text": tracking_url}
            ]
        )


# Singleton instance
whatsapp_service = WhatsAppService()
