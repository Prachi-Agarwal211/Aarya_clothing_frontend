"""
WhatsApp webhook — Meta Cloud API and/or MSG91 (BSP).

Meta: GET hub.challenge verification; POST with X-Hub-Signature-256 and entry[] payload.
MSG91: POST only; JSON with customerNumber, text, direction, eventName, etc.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse, PlainTextResponse
from sqlalchemy.orm import Session

from core.config import settings
from database.database import get_db
from service.whatsapp_service import whatsapp_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/whatsapp", tags=["WhatsApp"])


# =============================================================================
# GET — Meta subscription verification (MSG91 does not use this handshake)
# =============================================================================


@router.get("/webhook", status_code=status.HTTP_200_OK)
async def verify_webhook(request: Request):
    """
    Meta sends GET ?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
    Response must be the raw challenge string (text/plain), not JSON.
    """
    mode = request.query_params.get("hub.mode")
    token = request.query_params.get("hub.verify_token")
    challenge = request.query_params.get("hub.challenge")
    verify = settings.WHATSAPP_WEBHOOK_VERIFY_TOKEN

    if mode == "subscribe" and challenge is not None:
        if token == verify:
            logger.info("[WhatsApp Webhook] Meta verification successful")
            return PlainTextResponse(content=challenge, status_code=200)
        logger.warning("[WhatsApp Webhook] Meta verification failed (token mismatch)")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Webhook verification failed")

    return {
        "status": "ok",
        "hint": "Meta webhook verification uses hub.mode=subscribe. MSG91 delivers events via POST only.",
    }


# =============================================================================
# POST — Meta or MSG91
# =============================================================================


@router.post("/webhook", status_code=status.HTTP_200_OK)
async def whatsapp_webhook_handler(request: Request, db: Session = Depends(get_db)):
    body_bytes = await request.body()
    if not body_bytes:
        raise HTTPException(status_code=400, detail="Empty body")

    try:
        data = json.loads(body_bytes.decode("utf-8"))
    except json.JSONDecodeError as e:
        logger.error("[WhatsApp Webhook] Invalid JSON: %s", e)
        raise HTTPException(status_code=400, detail="Invalid JSON")

    if isinstance(data, dict) and "entry" in data:
        if not _verify_meta_webhook_signature(
            body_bytes, request.headers.get("X-Hub-Signature-256")
        ):
            logger.error("[WhatsApp Webhook] Invalid Meta signature")
            raise HTTPException(status_code=401, detail="Invalid signature")
        await _handle_meta_webhook_payload(data, db)
    else:
        if settings.MSG91_WHATSAPP_WEBHOOK_SECRET:
            hdr = request.headers.get("X-MSG91-Webhook-Token")
            if hdr != settings.MSG91_WHATSAPP_WEBHOOK_SECRET:
                raise HTTPException(status_code=401, detail="Invalid webhook token")
        await _handle_msg91_webhook_payload(data if isinstance(data, dict) else {}, db)

    return JSONResponse(content={"success": True}, status_code=200)


def _verify_meta_webhook_signature(body_bytes: bytes, signature_header: Optional[str]) -> bool:
    app_secret = settings.WHATSAPP_APP_SECRET
    if not app_secret:
        logger.warning("[WhatsApp Webhook] WHATSAPP_APP_SECRET unset — skipping Meta signature check")
        return True
    if not signature_header:
        return False
    expected = (
        "sha256="
        + hmac.new(app_secret.encode("utf-8"), body_bytes, hashlib.sha256).hexdigest()
    )
    return hmac.compare_digest(signature_header, expected)


async def _handle_meta_webhook_payload(body: Dict[str, Any], db: Session) -> None:
    logger.info("[WhatsApp Webhook][Meta] event keys=%s", list(body.keys()))
    for entry in body.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            field = change.get("field")

            if field == "messages" and "statuses" in value:
                await _process_message_status(value, db)
            elif field == "messages":
                await _process_incoming_message(value, db)
            elif field == "message_template_status_update":
                await _process_template_status(value, db)
            else:
                logger.debug("[WhatsApp Webhook][Meta] unknown field=%s", field)


async def _handle_msg91_webhook_payload(data: Dict[str, Any], db: Session) -> None:
    """MSG91 Webhook (New) — delivery reports, inbound text, template events.

    Outbound delivery/failure usually has direction \"1\" and eventName like delivered/failed/read.
    Full JSON is logged so you can grep docker logs without relying on MSG91 UI alone.
    """
    try:
        payload_preview = json.dumps(data, default=str)[:4500]
    except Exception:
        payload_preview = str(data)[:4500]
    logger.info("[WhatsApp Webhook][MSG91] raw_payload=%s", payload_preview)

    direction = str(data.get("direction", ""))
    event_name = str(data.get("eventName") or "")
    reason = data.get("reason") or ""

    # Outbound pipeline (API sends) — delivery / failed / read / sent
    if direction == "1":
        if reason or "fail" in event_name.lower():
            logger.warning(
                "[WhatsApp Webhook][MSG91] OUTBOUND_FAIL_OR_REASON event=%s customer=%s reason=%s requestId=%s template=%s",
                event_name,
                data.get("customerNumber"),
                reason,
                data.get("requestId"),
                data.get("templateName"),
            )
        else:
            logger.info(
                "[WhatsApp Webhook][MSG91] outbound event=%s customer=%s template=%s requestId=%s",
                event_name,
                data.get("customerNumber"),
                data.get("templateName"),
                data.get("requestId"),
            )
        return

    text_content = _msg91_extract_user_text(data)
    if not text_content:
        logger.info(
            "[WhatsApp Webhook][MSG91] no inbound text to auto-reply (may be status-only or non-text); direction=%s event=%s",
            direction,
            event_name,
        )
        return

    from_phone = data.get("customerNumber")
    if not from_phone:
        return

    logger.info(
        "[WhatsApp Webhook][MSG91] inbound from=%s text=%s",
        from_phone,
        text_content[:80],
    )
    await _run_incoming_text_auto_reply(str(from_phone), text_content)


def _msg91_extract_user_text(data: Dict[str, Any]) -> Optional[str]:
    t = (data.get("text") or "").strip()
    if t:
        return t
    raw = data.get("messages")
    if not raw or not isinstance(raw, str):
        return None
    try:
        arr = json.loads(raw)
        if isinstance(arr, list) and arr:
            m0 = arr[0]
            if isinstance(m0, dict) and m0.get("type") == "text":
                body = m0.get("text") or {}
                return (body.get("body") or "").strip() or None
    except json.JSONDecodeError:
        pass
    return None


# =============================================================================
# Meta: incoming message handlers (same shape as before)
# =============================================================================


async def _process_incoming_message(value: Dict[str, Any], db: Session) -> None:
    for message in value.get("messages", []):
        await _process_single_message(message, db)


async def _process_single_message(message: Dict[str, Any], db: Session) -> None:
    from_phone = message.get("from")
    msg_type = message.get("type")
    text_content = _extract_message_text(message, msg_type)
    if not text_content or not from_phone:
        logger.info("[WhatsApp Message][Meta] unsupported or empty: type=%s", msg_type)
        return
    await _run_incoming_text_auto_reply(str(from_phone), text_content)


async def _run_incoming_text_auto_reply(from_phone: str, text_content: str) -> None:
    text_lower = text_content.lower().strip()

    if text_lower in {"hi", "hello", "hey"}:
        await _send_quick_reply(
            from_phone, "Hello! Welcome to Aarya Clothing. How can we help you today?"
        )
    elif text_lower in {"help", "support", "help me"}:
        await _send_quick_reply(
            from_phone,
            "Sure! Please let us know what you need help with. You can also visit https://aaryaclothing.in for more information.",
        )
    elif text_lower in {"order", "orders", "my order"}:
        await _send_quick_reply(
            from_phone,
            "To check your order status, please provide your order number. Or visit: https://aaryaclothing.in/orders",
        )
    else:
        logger.info(
            "[WhatsApp Message] needs human response — from=%s text=%s",
            from_phone,
            text_content[:200],
        )


async def _process_message_status(value: Dict[str, Any], db: Session) -> None:
    for st in value.get("statuses", []):
        logger.info(
            "[WhatsApp Status][Meta] id=%s to=%s status=%s",
            st.get("id"),
            st.get("recipient_id"),
            st.get("status"),
        )


async def _process_template_status(value: Dict[str, Any], db: Session) -> None:
    tid = value.get("id")
    st = value.get("status")
    if st == "APPROVED":
        logger.info("[WhatsApp Template][Meta] %s approved", tid)
    elif st == "REJECTED":
        logger.error(
            "[WhatsApp Template][Meta] %s rejected: %s",
            tid,
            value.get("rejection_reason"),
        )


def _extract_message_text(message: Dict[str, Any], msg_type: str) -> Optional[str]:
    if msg_type == "text":
        return message.get("text", {}).get("body")
    if msg_type == "interactive":
        interactive = message.get("interactive", {})
        br = interactive.get("button_reply", {})
        lr = interactive.get("list_reply", {})
        if br:
            return br.get("title")
        if lr:
            return lr.get("title")
        return None
    if msg_type == "button":
        return message.get("button", {}).get("text")
    if msg_type == "reaction":
        reaction = message.get("reaction", {})
        return f"Reacted with: {reaction.get('emoji')}"
    if msg_type in {"image", "document", "audio", "video", "sticker", "location"}:
        return f"[{msg_type.capitalize()} received]"
    return None


async def _send_quick_reply(phone: str, text: str) -> None:
    if not whatsapp_service or not whatsapp_service.ready:
        logger.warning("[WhatsApp] Service not configured for auto-reply")
        return
    result = whatsapp_service.send_session_text(phone, text)
    if not result.get("success"):
        logger.error("[WhatsApp Auto-Reply] failed: %s", result)


@router.get("/health", status_code=status.HTTP_200_OK)
async def webhook_health():
    provider = settings.resolve_whatsapp_provider()
    return {
        "status": "healthy" if settings.whatsapp_enabled else "not_configured",
        "provider": provider,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "phone_number_id": whatsapp_service.phone_number_id if whatsapp_service else None,
        "api_version": whatsapp_service.api_version if whatsapp_service else None,
    }
