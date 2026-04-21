"""WhatsApp messaging — MSG91 (BSP) or direct Meta Cloud API."""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, List, Optional

import httpx

from core.config import settings

logger = logging.getLogger(__name__)


class WhatsAppService:
    """Send WhatsApp template and session messages via MSG91 or Meta Graph API."""

    def __init__(self) -> None:
        self.provider = settings.resolve_whatsapp_provider()
        self.access_token: Optional[str] = None
        self.phone_number_id: Optional[str] = None
        self.api_version = settings.WHATSAPP_API_VERSION
        self.base_url: Optional[str] = None

        self._msg91_auth_key: Optional[str] = None
        self._msg91_integrated: Optional[str] = None
        self._msg91_namespace: Optional[str] = None

        if not settings.whatsapp_enabled:
            logger.info(
                "[WhatsApp] Not configured. MSG91: set MSG91_AUTH_KEY, MSG91_WHATSAPP_INTEGRATED_NUMBER, "
                "MSG91_WHATSAPP_NAMESPACE. Meta: set WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID."
            )
            return

        if self.provider == "msg91":
            self._msg91_auth_key = settings.MSG91_AUTH_KEY
            self._msg91_integrated = self._normalize_integrated_number(
                settings.MSG91_WHATSAPP_INTEGRATED_NUMBER or ""
            )
            self._msg91_namespace = (settings.MSG91_WHATSAPP_NAMESPACE or "").strip()
            self.phone_number_id = self._msg91_integrated
            logger.info("[WhatsApp] MSG91 provider initialized (integrated_number=%s)", self._msg91_integrated)
            return

        self.access_token = settings.WHATSAPP_ACCESS_TOKEN
        self.phone_number_id = settings.WHATSAPP_PHONE_NUMBER_ID
        self.base_url = (
            f"https://graph.facebook.com/{self.api_version}/{self.phone_number_id}/messages"
        )
        logger.info("[WhatsApp] Meta Cloud API initialized")

    @property
    def ready(self) -> bool:
        return settings.whatsapp_enabled

    @staticmethod
    def _normalize_integrated_number(num: str) -> str:
        return re.sub(r"\D", "", str(num).strip())

    def _format_phone_number(self, phone: str) -> str:
        phone = str(phone).strip()
        phone = re.sub(r"\D", "", phone)
        if len(phone) == 10:
            return f"91{phone}"
        return phone

    @staticmethod
    def _meta_params_to_msg91_components(
        parameters: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        components: Dict[str, Any] = {}
        for i, p in enumerate(parameters):
            text_val = p.get("text", "") if isinstance(p, dict) else str(p)
            components[f"body_{i + 1}"] = {"type": "text", "value": str(text_val)}
        return components

    def _send_msg91_template(
        self,
        to_phone: str,
        template_name: str,
        parameters: List[Dict[str, Any]],
        language_code: str,
    ) -> Dict[str, Any]:
        if not (
            self._msg91_auth_key
            and self._msg91_integrated
            and self._msg91_namespace
        ):
            return {"success": False, "error": "not_configured"}

        to_digits = self._format_phone_number(to_phone)
        payload = {
            "integrated_number": self._msg91_integrated,
            "content_type": "template",
            "payload": {
                "messaging_product": "whatsapp",
                "type": "template",
                "template": {
                    "name": template_name,
                    "language": {
                        "code": language_code,
                        "policy": "deterministic",
                    },
                    "namespace": self._msg91_namespace,
                    "to_and_components": [
                        {
                            "to": [to_digits],
                            "components": self._meta_params_to_msg91_components(parameters),
                        }
                    ],
                },
            },
        }
        headers = {
            "authkey": self._msg91_auth_key,
            "Content-Type": "application/json",
        }
        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(
                    settings.MSG91_WHATSAPP_BULK_URL,
                    json=payload,
                    headers=headers,
                )
                text = response.text
                if response.status_code not in (200, 201, 202):
                    logger.error("[WhatsApp][MSG91] HTTP %s: %s", response.status_code, text)
                    return {"success": False, "error": f"HTTP {response.status_code}", "body": text}

                try:
                    data = response.json()
                except json.JSONDecodeError:
                    logger.info("[WhatsApp][MSG91] Sent (non-JSON body): %s", text[:200])
                    return {"success": True, "raw": text}

                if isinstance(data, dict):
                    # Full body for ops — MSG91 often returns HTTP 200 + queued; real success/fail is in dashboard / webhooks.
                    logger.info("[WhatsApp][MSG91] raw_response=%s", json.dumps(data, default=str)[:4000])
                    if data.get("hasError") is True:
                        logger.error("[WhatsApp][MSG91] hasError=true: %s", data)
                        return {
                            "success": False,
                            "error": data.get("errors") or data.get("data") or "hasError",
                            "response": data,
                        }
                    err = data.get("errors") or data.get("error")
                    if err:
                        logger.error("[WhatsApp][MSG91] API error: %s", data)
                        return {"success": False, "error": str(err), "response": data}
                    req_id = data.get("requestId") or data.get("request_id")
                    if req_id:
                        logger.info(
                            "[WhatsApp][MSG91] Queued request_id=%s — check MSG91 WhatsApp delivery reports; "
                            "HTTP 200 does not mean the message reached the handset.",
                            req_id,
                        )
                    else:
                        logger.warning(
                            "[WhatsApp][MSG91] No request_id in response — verify template namespace/name in "
                            "Meta / MSG91 (namespace must match WhatsApp Manager exactly)."
                        )
                    return {"success": True, "response": data}

                return {"success": True, "response": data}
        except Exception as e:
            logger.error("[WhatsApp][MSG91] Exception: %s", e)
            return {"success": False, "error": str(e)}

    def _send_meta_template(
        self,
        to_phone: str,
        template_name: str,
        parameters: List[Dict[str, Any]],
        language_code: str,
    ) -> Dict[str, Any]:
        if not self.access_token or not self.phone_number_id or not self.base_url:
            return {"success": False, "error": "not_configured"}

        formatted_phone = self._format_phone_number(to_phone)
        payload = {
            "messaging_product": "whatsapp",
            "to": formatted_phone,
            "type": "template",
            "template": {
                "name": template_name,
                "language": {"code": language_code},
                "components": [{"type": "body", "parameters": parameters}],
            },
        }
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }
        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(
                    self.base_url,
                    json=payload,
                    headers=headers,
                )
                try:
                    result = response.json()
                except json.JSONDecodeError:
                    result = {}

                if response.status_code not in (200, 201, 202):
                    err = result.get("error") if isinstance(result, dict) else None
                    if isinstance(err, dict):
                        msg = err.get("message") or response.text
                        logger.error(
                            "[WhatsApp][Meta] HTTP %s: %s (code=%s subcode=%s)",
                            response.status_code,
                            msg,
                            err.get("code"),
                            err.get("error_subcode"),
                        )
                        return {
                            "success": False,
                            "error": msg,
                            "meta_error": err,
                        }
                    logger.error("[WhatsApp][Meta] HTTP %s: %s", response.status_code, response.text[:2000])
                    return {
                        "success": False,
                        "error": f"HTTP {response.status_code}",
                        "body": response.text[:2000],
                    }

                if "messages" in result:
                    message_id = result["messages"][0].get("id")
                    logger.info("[WhatsApp][Meta] Sent to %s id=%s", formatted_phone, message_id)
                    return {"success": True, "message_id": message_id}
                if isinstance(result, dict) and result.get("error"):
                    err = result["error"]
                    logger.error("[WhatsApp][Meta] API error: %s", err)
                    return {
                        "success": False,
                        "error": err.get("message", "unknown"),
                        "meta_error": err,
                    }
                logger.error("[WhatsApp][Meta] Unexpected response: %s", result)
                return {"success": False, "error": "unexpected_response", "raw": result}
        except Exception as e:
            logger.error("[WhatsApp][Meta] Exception: %s", e)
            return {"success": False, "error": str(e)}

    def send_template_message(
        self,
        to_phone: str,
        template_name: str,
        parameters: List[Dict[str, Any]],
        language_code: Optional[str] = None,
    ) -> Dict[str, Any]:
        lang = language_code or settings.WHATSAPP_TEMPLATE_LANGUAGE_CODE
        if not settings.whatsapp_enabled:
            logger.warning("[WhatsApp] Service not configured, skipping message")
            return {"success": False, "error": "not_configured"}

        if self.provider == "msg91":
            return self._send_msg91_template(to_phone, template_name, parameters, lang)
        return self._send_meta_template(to_phone, template_name, parameters, lang)

    def send_session_text(self, to_phone: str, body: str) -> Dict[str, Any]:
        """Free-form text within 24h session (Meta Graph API or MSG91 text endpoint)."""
        if not settings.whatsapp_enabled:
            return {"success": False, "error": "not_configured"}
        formatted = self._format_phone_number(to_phone)
        if self.provider == "msg91":
            return self._send_msg91_session_text(formatted, body)
        return self._send_meta_session_text(formatted, body)

    def _send_meta_session_text(self, formatted_phone: str, body: str) -> Dict[str, Any]:
        if not self.access_token or not self.base_url:
            return {"success": False, "error": "not_configured"}
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": formatted_phone,
            "type": "text",
            "text": {"body": body},
        }
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }
        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(self.base_url, json=payload, headers=headers)
                if response.status_code in (200, 201, 202):
                    logger.info("[WhatsApp][Meta] Session text sent to %s", formatted_phone)
                    return {"success": True}
                logger.error("[WhatsApp][Meta] Session text failed: %s %s", response.status_code, response.text)
                return {"success": False, "error": f"HTTP {response.status_code}"}
        except Exception as e:
            logger.error("[WhatsApp][Meta] Session text exception: %s", e)
            return {"success": False, "error": str(e)}

    def _send_msg91_session_text(self, formatted_phone: str, body: str) -> Dict[str, Any]:
        if not (self._msg91_auth_key and self._msg91_integrated):
            return {"success": False, "error": "not_configured"}
        payload = {
            "integrated_number": self._msg91_integrated,
            "content_type": "text",
            "payload": {
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": formatted_phone,
                "type": "text",
                "text": {"preview_url": False, "body": body},
            },
        }
        headers = {
            "authkey": self._msg91_auth_key,
            "Content-Type": "application/json",
        }
        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(
                    settings.MSG91_WHATSAPP_TEXT_URL,
                    json=payload,
                    headers=headers,
                )
                if response.status_code in (200, 201, 202):
                    logger.info("[WhatsApp][MSG91] Session text sent to %s", formatted_phone)
                    return {"success": True}
                logger.warning(
                    "[WhatsApp][MSG91] Session text HTTP %s: %s — inbound auto-reply may need API path update in MSG91 docs.",
                    response.status_code,
                    response.text[:500],
                )
                return {"success": False, "error": f"HTTP {response.status_code}"}
        except Exception as e:
            logger.error("[WhatsApp][MSG91] Session text exception: %s", e)
            return {"success": False, "error": str(e)}

    def send_otp(self, phone: str, otp_code: str) -> Dict[str, Any]:
        return self.send_template_message(
            to_phone=phone,
            template_name=settings.WHATSAPP_TEMPLATE_OTP,
            parameters=[{"type": "text", "text": otp_code}],
        )

    def send_order_confirmation(
        self, phone: str, customer_name: str, order_number: str, total_amount: str
    ) -> Dict[str, Any]:
        return self.send_template_message(
            to_phone=phone,
            template_name=settings.WHATSAPP_TEMPLATE_ORDER_CONFIRMED,
            parameters=[
                {"type": "text", "text": customer_name},
                {"type": "text", "text": order_number},
                {"type": "text", "text": total_amount},
            ],
        )

    def send_order_shipped(
        self, phone: str, customer_name: str, order_number: str, tracking_url: str
    ) -> Dict[str, Any]:
        return self.send_template_message(
            to_phone=phone,
            template_name=settings.WHATSAPP_TEMPLATE_ORDER_SHIPPED,
            parameters=[
                {"type": "text", "text": customer_name},
                {"type": "text", "text": order_number},
                {"type": "text", "text": tracking_url},
            ],
        )


whatsapp_service = WhatsAppService()
