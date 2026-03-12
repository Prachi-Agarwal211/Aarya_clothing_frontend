"""OTP Service for verification."""
import secrets
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session

from core.config import settings
from core.redis_client import redis_client
from models.otp import OTP
from service.email_service import email_service


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
        """Send OTP via email or WhatsApp."""
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
        
        # Check resend cooldown
        otp_key = self._get_otp_key(otp_type, email, phone)
        existing_otp = redis_client.get_otp(otp_key)
        
        if existing_otp:
            raise ValueError(f"Please wait {settings.OTP_RESEND_COOLDOWN_MINUTES} minute(s) before requesting again")
        
        # Generate OTP
        otp_code = self._generate_otp()
        
        # Store OTP in Redis (with short expiry)
        redis_client.set_otp(otp_key, otp_code, expires_in=settings.OTP_EXPIRY_MINUTES * 60)
        
        # Send OTP based on type
        if email and otp_type == "EMAIL":
            email_service.send_otp_email(
                to_email=email,
                otp_code=otp_code,
                purpose=purpose or "verification"
            )
            delivery_target = email
        elif phone and otp_type == "WHATSAPP":
            # Import here to avoid circular import
            from core.config import settings
            
            if not settings.whatsapp_enabled:
                raise ValueError("WhatsApp OTP is not configured. Please contact support.")
            
            from service.whatsapp_service import whatsapp_service
            
            if whatsapp_service is None:
                raise ValueError("WhatsApp service is not available")
            
            result = whatsapp_service.send_otp(
                phone_number=phone,
                otp_code=otp_code,
                purpose=purpose or "verification"
            )
            
            if not result.get("success"):
                raise ValueError(f"Failed to send WhatsApp OTP: {result.get('error', 'Unknown error')}")
            
            delivery_target = phone
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
        """Verify OTP code."""
        email = request.email
        phone = request.phone
        otp_code = request.otp_code
        otp_type = request.otp_type
        purpose = request.purpose
        
        if not email and not phone:
            raise ValueError("Email or phone number is required")
        
        # Get OTP key
        otp_key = self._get_otp_key(otp_type, email, phone)
        
        # Get stored OTP
        stored_otp = redis_client.get_otp(otp_key)
        
        if not stored_otp:
            return {
                "success": False,
                "message": "OTP has expired or not found",
                "verified": False
            }
        
        # Check attempts
        attempts = redis_client.increment_otp_attempts(otp_key)
        
        if attempts > settings.OTP_MAX_ATTEMPTS:
            redis_client.delete_otp(otp_key)
            redis_client.clear_otp_attempts(otp_key)
            return {
                "success": False,
                "message": "Too many attempts. Please request a new OTP.",
                "verified": False
            }
        
        # Verify OTP
        if stored_otp == otp_code:
            # Clear OTP and attempts
            redis_client.delete_otp(otp_key)
            redis_client.clear_otp_attempts(otp_key)
            
            return {
                "success": True,
                "message": "OTP verified successfully",
                "verified": True
            }
        
        remaining_attempts = settings.OTP_MAX_ATTEMPTS - attempts
        
        return {
            "success": False,
            "message": f"Invalid OTP. {remaining_attempts} attempt(s) remaining.",
            "verified": False
        }
    
    def resend_otp(self, request) -> dict:
        """Resend OTP (with rate limiting)."""
        return self.send_otp(request)
    
    def validate_otp(self, email: str = None, phone: str = None, otp_type: str = "email_verification") -> bool:
        """Check if OTP is valid (for internal use)."""
        otp_key = self._get_otp_key(otp_type, email, phone)
        stored_otp = redis_client.get_otp(otp_key)
        return stored_otp is not None
