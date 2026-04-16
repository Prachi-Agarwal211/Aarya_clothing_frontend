"""OTP Service for verification."""
import secrets
import logging
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session

from core.config import settings
from core.redis_client import redis_client
from models.otp import OTP
from service.email_service import email_service

logger = logging.getLogger(__name__)


class OTPService:
    """OTP service for email and phone verification."""
    
    def __init__(self, db: Session):
        """Initialize OTP service."""
        self.db = db
    
    def _generate_otp(self) -> str:
        """Generate a cryptographically secure random OTP code."""
        return ''.join([str(secrets.randbelow(10)) for _ in range(settings.OTP_CODE_LENGTH)])
    
    def _get_otp_key(self, otp_type: str, email: str = None, phone: str = None) -> str:
        """Generate a unique key for OTP storage."""
        identifier = email or phone
        return f"{otp_type}:{identifier}"
    
    def send_otp(self, request) -> dict:
        """Send OTP via email or SMS."""
        email = request.email
        phone = request.phone
        otp_type = request.otp_type
        purpose = request.purpose
        
        if not email and not phone:
            raise ValueError("Email or phone number is required")
        
        # Check rate limit
        rate_limit = redis_client.check_rate_limit(
            f"otp_send:{email or phone}",
            limit=settings.OTP_MAX_RESEND_PER_HOUR,
            window=3600
        )
        
        if not rate_limit["allowed"]:
            raise ValueError("Too many OTP requests. Please try again later.")
        
        # Check resend cooldown using a separate short-lived key
        otp_key = self._get_otp_key(otp_type, email, phone)
        cooldown_key = f"otp_cooldown:{otp_key}"
        cooldown_active = redis_client.get_cache(cooldown_key)
        
        if cooldown_active:
            cooldown_seconds = int(settings.OTP_RESEND_COOLDOWN_MINUTES * 60)
            raise ValueError(f"Please wait {cooldown_seconds} second(s) before requesting a new code.")
        
        # Generate OTP
        otp_code = self._generate_otp()

        # Delete any existing OTP (resend replaces the previous code)
        redis_client.delete_otp(otp_key)

        # Store OTP in Redis with full expiry
        redis_client.store_otp(otp_key, otp_code, expires_in=settings.OTP_EXPIRY_MINUTES * 60)

        # Set short-lived cooldown key to prevent rapid resends
        redis_client.set_cache(cooldown_key, "1", ttl=int(settings.OTP_RESEND_COOLDOWN_MINUTES * 60))
        
        # Send OTP based on type
        if email and otp_type == "EMAIL":
            try:
                from service.email_queue import try_enqueue_otp_email

                purpose_str = purpose or "verification"
                if try_enqueue_otp_email(email, otp_code, purpose_str):
                    delivery_target = email
                else:
                    ok = email_service.send_otp_email(
                        to_email=email,
                        otp_code=otp_code,
                        purpose=purpose_str,
                    )
                    if not ok:
                        redis_client.delete_otp(otp_key)
                        raise ValueError("Failed to send OTP via email")
                    delivery_target = email
            except ValueError:
                raise
            except Exception as e:
                logger.error(f"[OTP Service] Failed to send email OTP to {email}: {str(e)}")
                redis_client.delete_otp(otp_key)
                raise ValueError(f"Failed to send OTP via email: {str(e)}")
        elif phone and (otp_type == "SMS" or otp_type == "WHATSAPP"):
            # Try WhatsApp First (if enabled)
            from service.whatsapp_service import whatsapp_service
            if whatsapp_service and whatsapp_service.access_token:
                try:
                    res = whatsapp_service.send_otp(phone, otp_code)
                    if res.get("success"):
                        return {
                            "success": True,
                            "message": f"OTP sent successfully via WhatsApp to {phone}",
                            "expires_in": settings.OTP_EXPIRY_MINUTES * 60,
                            "email": email,
                            "phone": phone,
                            "otp_type": "WHATSAPP"
                        }
                except Exception as e:
                    logger.error(f"[OTP Service] WhatsApp OTP failed: {e}")
                    # Fall through to SMS if WhatsApp fails

            # Fallback to SMS
            if not getattr(settings, 'sms_enabled', False):
                # Delete the stored OTP since delivery failed
                redis_client.delete_otp(otp_key)
                raise ValueError("WhatsApp/SMS OTP is not configured. Please use email instead or contact support.")

            from service.sms_service import sms_service
            
            if sms_service is None:
                # Delete the stored OTP since delivery failed
                redis_client.delete_otp(otp_key)
                raise ValueError("SMS service is not available. Please use email instead.")

            try:
                result = sms_service.send_otp(
                    phone_number=phone,
                    otp_code=otp_code,
                    purpose=purpose or "verification"
                )

                if not result.get("success"):
                    # Delete the stored OTP since delivery failed
                    redis_client.delete_otp(otp_key)
                    error_msg = result.get('error', 'Unknown error')
                    logger.error(f"[OTP Service] SMS OTP delivery failed to {phone}: {error_msg}")
                    raise ValueError(f"Failed to send SMS OTP: {error_msg}")

                delivery_target = phone
            except Exception as e:
                # Delete the stored OTP since delivery failed
                redis_client.delete_otp(otp_key)
                logger.error(f"[OTP Service] SMS service exception for {phone}: {str(e)}")
                raise ValueError(f"Failed to send SMS OTP: {str(e)}")
        else:
            raise ValueError(f"Invalid OTP type '{otp_type}' or missing email/phone")
        
        return {
            "success": True,
            "message": f"OTP sent successfully to {delivery_target}",
            "expires_in": settings.OTP_EXPIRY_MINUTES * 60,
            "email": email,
            "phone": phone,
            "otp_type": otp_type
        }
    
    def verify_otp(self, request) -> dict:
        """
        Verify OTP code.

        Fix #10: Added server-side expiry validation with specific error codes.
        Fix RACE: Uses atomic read-and-delete via Lua script to prevent double-use.
        Returns specific error code for expired OTP so frontend can show appropriate message.
        """
        email = request.email
        phone = request.phone
        otp_code = request.otp_code
        otp_type = request.otp_type
        purpose = request.purpose

        if not email and not phone:
            raise ValueError("Email or phone number is required")

        # Get OTP key
        otp_key = self._get_otp_key(otp_type, email, phone)

        # FIX: Check attempts FIRST before consuming the OTP
        attempts_result = redis_client.increment_otp_attempts(otp_key)
        if isinstance(attempts_result, dict):
            attempts = attempts_result.get("attempts", 1)
        else:
            attempts = int(attempts_result)

        if attempts > settings.OTP_MAX_ATTEMPTS:
            return {
                "success": False,
                "message": "Too many attempts. Please request a new OTP.",
                "verified": False,
                "error_code": "LOCKED"
            }

        # ATOMIC read-and-delete via Lua script — prevents double-use race condition
        stored_otp = redis_client.get_and_delete_otp(otp_key)

        # Server-side expiry validation
        if not stored_otp:
            return {
                "success": False,
                "message": "OTP has expired or not found",
                "verified": False,
                "error_code": "EXPIRED"
            }

        # Verify OTP
        if stored_otp == otp_code:
            return {
                "success": True,
                "message": "OTP verified successfully",
                "verified": True,
                "error_code": None
            }

        remaining_attempts = settings.OTP_MAX_ATTEMPTS - attempts

        return {
            "success": False,
            "message": f"Invalid OTP. {remaining_attempts} attempt(s) remaining.",
            "verified": False,
            "error_code": "INVALID"
        }
    
    def resend_otp(self, request) -> dict:
        """Resend OTP (with rate limiting)."""
        return self.send_otp(request)
    
    def validate_otp(self, email: str = None, phone: str = None, otp_type: str = "email_verification") -> bool:
        """Check if OTP is valid (for internal use)."""
        otp_key = self._get_otp_key(otp_type, email, phone)
        stored_otp = redis_client.get_otp(otp_key)
        return stored_otp is not None
