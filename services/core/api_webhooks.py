"""
Fast2SMS Webhook Endpoints — Delivery Status Tracking

Receives real-time delivery status callbacks from Fast2SMS for:
- SMS DLT route (dlr_callback): delivered, failed, pending
- WhatsApp (whatsapp_callback): sent, delivered, read, failed

These webhooks help diagnose why messages are stuck in "Pending" by providing
carrier-level delivery status and failure reasons.

Fast2SMS webhook docs:
- SMS: https://www.fast2sms.com/help/dlt-webhook
- WhatsApp: https://www.fast2sms.com/help/whatsapp-webhook

Usage: Configure your Fast2SMS dashboard webhook URLs to:
  SMS:      https://your-domain/api/v1/webhooks/fast2sms/sms-dlt
  WhatsApp: https://your-domain/api/v1/webhooks/fast2sms/whatsapp
"""
import hmac
import json
import logging
import os
from typing import Optional

from fastapi import APIRouter, Request, Header
from shared.time_utils import now_ist

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks/fast2sms", tags=["Webhooks — Fast2SMS Delivery"])


# ==================== Helpers ====================

def _verify_signature(payload: bytes, signature: Optional[str]) -> bool:
    """Verify Fast2SMS webhook signature. Returns True if valid or if no secret configured."""
    secret = os.getenv("FAST2SMS_WEBHOOK_SECRET", "")
    if not secret:
        return True
    if not signature:
        logger.warning("[Webhook] Missing signature header")
        return False
    expected = hmac.new(secret.encode(), payload, "sha256").hexdigest()
    return hmac.compare_digest(signature, expected)


def _store_report(prefix: str, request_id: str, mobile: str, data: dict) -> None:
    """Store delivery report in Redis for lookup and dashboard."""
    try:
        from core.redis_client import redis_client

        # Store individual report by request_id:mobile (24h TTL)
        key = f"webhook:{prefix}:{request_id}:{mobile}"
        redis_client.set_cache(key, data, ttl=86400)

        # Add to recent reports list (last 1000, for dashboard)
        redis_client.client.lpush(f"webhook:{prefix}:recent", json.dumps(data))
        redis_client.client.ltrim(f"webhook:{prefix}:recent", 0, 999)

        # Also index by request_id for O(1) lookup (sorted set by timestamp)
        score = data.get("received_at", "")
        redis_client.client.zadd(f"webhook:{prefix}:by_request_id", {key: 0})
    except Exception as e:
        logger.warning(f"[Webhook] Failed to store report: {e}")


def _lookup_by_request_id(prefix: str, request_id: str) -> list:
    """Find all delivery reports for a given request_id using sorted set index."""
    try:
        from core.redis_client import redis_client

        index_key = f"webhook:{prefix}:by_request_id"
        # Get all keys that contain the request_id
        all_keys = redis_client.client.zrange(index_key, 0, -1)
        reports = []
        for raw_key in all_keys:
            key = raw_key.decode() if isinstance(raw_key, bytes) else str(raw_key)
            if request_id in key:
                raw = redis_client.client.get(key)
                if raw:
                    reports.append(json.loads(raw) if isinstance(raw, bytes) else json.loads(str(raw)))
        return reports
    except Exception:
        return []


# ==================== SMS DLT Webhook ====================

@router.post("/sms-dlt")
async def sms_dlt_webhook(
    request: Request,
    x_signature: Optional[str] = Header(None, alias="X-Signature"),
):
    """SMS DLT delivery status webhook from Fast2SMS.

    Called by Fast2SMS when delivery status changes for DLT-routed SMS.
    Provides carrier-level feedback: Delivered, Failed (with reason), or Pending.
    """
    try:
        body = await request.body()
        payload = await request.json()
    except Exception as e:
        logger.error(f"[Webhook:SMS-DLT] Failed to parse payload: {e}")
        return {"status": "error", "message": "Invalid JSON"}

    # Verify signature if configured
    if not _verify_signature(body, x_signature):
        logger.warning("[Webhook:SMS-DLT] Invalid signature")
        return {"status": "error", "message": "Invalid signature"}

    reports = payload.get("sms_reports", [])
    logger.info(f"[Webhook:SMS-DLT] Received {len(reports)} report(s)")

    for report in reports:
        request_id = report.get("request_id", "unknown")
        route = report.get("route", "unknown")

        for ds in report.get("delivery_status", []):
            status = ds.get("status", "unknown")
            mobile = str(ds.get("mobile", "unknown"))
            description = ds.get("status_description", "")

            log_level = logging.INFO if status == "Delivered" else logging.WARNING
            logger.log(
                log_level,
                f"[Webhook:SMS-DLT] id={request_id} mobile={mobile} "
                f"status={status} desc={description} route={route}",
            )

            _store_report("sms_dlt", request_id, mobile, {
                "request_id": request_id,
                "mobile": mobile,
                "status": status,
                "status_description": description,
                "route": route,
                "amount_debited": ds.get("amount_debited", "0"),
                "received_at": now_ist().isoformat(),
            })

    return {"status": "ok"}


# ==================== WhatsApp Webhook ====================

@router.post("/whatsapp")
async def whatsapp_webhook(
    request: Request,
    x_signature: Optional[str] = Header(None, alias="X-Signature"),
):
    """WhatsApp delivery status webhook from Fast2SMS.

    Handles status_update (sent/delivered/failed) and incoming_message events.
    """
    try:
        body = await request.body()
        payload = await request.json()
    except Exception as e:
        logger.error(f"[Webhook:WhatsApp] Failed to parse payload: {e}")
        return {"status": "error", "message": "Invalid JSON"}

    if not _verify_signature(body, x_signature):
        logger.warning("[Webhook:WhatsApp] Invalid signature")
        return {"status": "error", "message": "Invalid signature"}

    reports = payload.get("whatsapp_reports", [])
    logger.info(f"[Webhook:WhatsApp] Received {len(reports)} report(s)")

    for report in reports:
        event_type = report.get("type", "unknown")

        if event_type == "status_update":
            status = report.get("status", "unknown")
            mobile = str(report.get("mobile") or report.get("recipient_id", "unknown"))
            fast2sms_id = report.get("fast2sms_request_id", "unknown")
            description = report.get("status_description", "")

            log_level = logging.INFO if status in ("delivered", "read") else logging.WARNING
            logger.log(
                log_level,
                f"[Webhook:WhatsApp] id={fast2sms_id} mobile={mobile} "
                f"status={status} desc={description}",
            )

            _store_report("whatsapp", fast2sms_id, mobile, {
                "type": "status_update",
                "fast2sms_request_id": fast2sms_id,
                "mobile": mobile,
                "status": status,
                "status_description": description,
                "amount_debited": report.get("amount_debited", "0"),
                "errors": report.get("errors"),
                "received_at": now_ist().isoformat(),
            })

        elif event_type == "incoming_message":
            logger.info(
                f"[Webhook:WhatsApp] incoming from={report.get('from')} "
                f"body={report.get('body', '')[:100]}"
            )
        else:
            logger.warning(f"[Webhook:WhatsApp] Unknown event type: {event_type}")

    return {"status": "ok"}


# ==================== Status Dashboard (Debug) ====================

@router.get("/status")
async def webhook_status():
    """Quick check: webhook health + last delivery reports."""
    try:
        from core.redis_client import redis_client

        sms_count = redis_client.client.llen("webhook:sms_dlt:recent") or 0
        wa_count = redis_client.client.llen("webhook:whatsapp:recent") or 0

        def _last(key):
            raw = redis_client.client.lindex(key, 0)
            if raw:
                return json.loads(raw) if isinstance(raw, bytes) else json.loads(str(raw))
            return None

        return {
            "status": "ok",
            "sms_reports_count": sms_count,
            "whatsapp_reports_count": wa_count,
            "last_sms": _last("webhook:sms_dlt:recent"),
            "last_whatsapp": _last("webhook:whatsapp:recent"),
        }
    except Exception as e:
        return {"status": "ok", "note": f"Redis unavailable: {e}"}


@router.get("/status/{request_id}")
async def webhook_lookup(request_id: str):
    """Look up delivery status for a specific Fast2SMS request ID."""
    sms = _lookup_by_request_id("sms_dlt", request_id)
    wa = _lookup_by_request_id("whatsapp", request_id)
    return {
        "request_id": request_id,
        "sms_reports": sms,
        "whatsapp_reports": wa,
        "total": len(sms) + len(wa),
    }
