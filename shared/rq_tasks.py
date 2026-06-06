"""Shared RQ task definitions for OTP delivery and notifications."""
import logging
from typing import Optional

logger = logging.getLogger(__name__)


def get_rq_queue(name: str = "default", redis_db: int = 0):
    """Get an RQ queue for the specified Redis DB."""
    import redis as redis_lib
    import os
    redis_url = os.environ.get("REDIS_URL", f"redis://redis:6379/{redis_db}")
    conn = redis_lib.Redis.from_url(
        redis_url, decode_responses=False,
        socket_connect_timeout=10, socket_timeout=30,
    )
    from rq import Queue
    return Queue(name, connection=conn)


def task_send_otp_email(email: str, otp_code: str, purpose: str = "verification"):
    """Send OTP via email. Runs in RQ worker."""
    logger.info(f"[RQ] Sending OTP email to {email} (purpose={purpose})")
    try:
        from service.email_service import email_service
    except ImportError as e:
        logger.error(f"[RQ] Cannot import email_service (wrong worker context?): {e}")
        return False
    try:
        success = email_service.send_otp_email(email, otp_code, purpose)
        if success:
            logger.info(f"[RQ] OTP email sent to {email}")
        else:
            logger.error(f"[RQ] OTP email failed for {email}")
        return success
    except Exception as e:
        logger.error(f"[RQ] OTP email exception for {email}: {e}")
        return False


def task_send_otp_sms(phone: str, otp_code: str, purpose: str = "verification"):
    """Send OTP via SMS (MSG91). Runs in RQ worker."""
    logger.info(f"[RQ] Sending OTP SMS to {phone} (purpose={purpose})")
    try:
        from service.sms_service import SmsService
    except ImportError as e:
        logger.error(f"[RQ] Cannot import SmsService (wrong worker context?): {e}")
        return False
    try:
        sms = SmsService()
        if not sms.api_key:
            logger.warning("[RQ] SMS service not configured")
            return False
        result = sms.send_otp(phone, otp_code, purpose)
        return isinstance(result, dict) and result.get("success")
    except Exception as e:
        logger.error(f"[RQ] OTP SMS exception for {phone}: {e}")
        return False


def task_send_otp_whatsapp(phone: str, otp_code: str, purpose: str = "verification"):
    """Send OTP via WhatsApp. Runs in RQ worker."""
    logger.info(f"[RQ] Sending OTP WhatsApp to {phone} (purpose={purpose})")
    try:
        from service.whatsapp_service import WhatsAppService
    except ImportError as e:
        logger.error(f"[RQ] Cannot import WhatsAppService (wrong worker context?): {e}")
        return False
    try:
        wa = WhatsAppService()
        if not wa.api_key or not wa.phone_number_id:
            logger.warning("[RQ] WhatsApp service not configured")
            return False
        result = wa.send_otp(phone, otp_code)
        return isinstance(result, dict) and result.get("success")
    except Exception as e:
        logger.error(f"[RQ] OTP WhatsApp exception for {phone}: {e}")
        return False


def task_send_order_confirmation(order_id: int, user_id: int):
    """Send order confirmation via email + WhatsApp."""
    logger.info(f"[RQ] Order confirmation for order={order_id} user={user_id}")
    try:
        import os, httpx
        commerce_url = os.environ.get("COMMERCE_SERVICE_URL", "http://commerce:5002")
        core_url = os.environ.get("CORE_SERVICE_URL", "http://core:5001")
        secret = os.environ.get("INTERNAL_SERVICE_SECRET", "")
        with httpx.Client(timeout=15.0) as client:
            resp = client.get(
                f"{commerce_url}/api/v1/internal/orders/{order_id}",
                headers={"X-Internal-Secret": secret},
            )
            if resp.status_code != 200:
                logger.error(f"[RQ] Failed to fetch order {order_id}: {resp.status_code}")
                return False
            order_data = resp.json()
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(
                f"{core_url}/api/v1/internal/notify/order-confirmation",
                json={"order": order_data, "user_id": user_id},
                headers={"X-Internal-Secret": secret},
            )
            return resp.status_code == 200
    except Exception as e:
        logger.error(f"[RQ] Order confirmation exception: {e}")
        return False


def task_send_order_shipped(order_id: int, user_id: int, tracking_number: str = ""):
    """Send order shipped notification."""
    logger.info(f"[RQ] Shipped notification for order={order_id} user={user_id}")
    try:
        import os, httpx
        core_url = os.environ.get("CORE_SERVICE_URL", "http://core:5001")
        secret = os.environ.get("INTERNAL_SERVICE_SECRET", "")
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(
                f"{core_url}/api/v1/internal/notify/order-shipped",
                json={"order_id": order_id, "user_id": user_id, "tracking_number": tracking_number},
                headers={"X-Internal-Secret": secret},
            )
            return resp.status_code == 200
    except Exception as e:
        logger.error(f"[RQ] Shipped notification exception: {e}")
        return False
