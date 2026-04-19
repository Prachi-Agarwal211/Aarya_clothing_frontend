"""OTP Service for Aarya Clothing Core Platform."""

import secrets
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from models import VerificationToken
from core.redis_client import redis_client

logger = logging.getLogger(__name__)


class OTPService:
    """Service for OTP generation, verification, and management."""

    def __init__(self, db: Optional[Session]):
        """Initialize OTP service with database session."""
        self.db = db
        self.logger = logging.getLogger(f"{__name__}.OTPService")

    # ==================== OTP Generation ====================

    def generate_otp(self, length: int = 6) -> str:
        """Generate a random OTP code."""
        # Generate numeric OTP for better UX
        otp = ''.join(secrets.choice('0123456789') for _ in range(length))
        return otp

    def create_verification_token(
        self,
        user_id: int,
        token_type: str = 'email_verification',
        expires_in: int = 3600,
        delivery_method: str = 'EMAIL'
    ) -> Dict[str, Any]:
        """Create a verification token for OTP."""
        try:
            # Generate OTP code
            otp_code = self.generate_otp()
            
            # Calculate expiry time
            expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
            
            # Create verification token record
            verification_token = VerificationToken(
                user_id=user_id,
                token=otp_code,
                token_type=token_type,
                expires_at=expires_at,
                delivery_method=delivery_method,
                verified_at=None
            )
            
            self.db.add(verification_token)
            self.db.commit()
            self.db.refresh(verification_token)
            
            # Also store in Redis for rate limiting and quick lookup
            if redis_client:
                redis_key = f"otp:{user_id}:{token_type}"
                redis_client.setex(
                    redis_key,
                    expires_in,
                    str(verification_token.id)
                )
            
            return {
                'success': True,
                'otp_code': otp_code,
                'token_id': verification_token.id,
                'expires_at': expires_at.isoformat(),
                'delivery_method': delivery_method
            }

        except IntegrityError as e:
            self.db.rollback()
            logger.error(f"Integrity error creating verification token: {e}")
            return {'success': False, 'error': 'Database integrity error'}
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error creating verification token: {e}")
            return {'success': False, 'error': 'Failed to create verification token'}

    # ==================== OTP Verification ====================

    def verify_otp(
        self,
        user_id: int,
        otp_code: str,
        token_type: str = 'email_verification'
    ) -> Dict[str, Any]:
        """Verify an OTP code."""
        try:
            # First check Redis for rate limiting
            if redis_client:
                redis_key = f"otp:{user_id}:{token_type}"
                token_id = redis_client.get(redis_key)
                
                if not token_id:
                    return {'success': False, 'error': 'OTP expired or not found'}
            
            # Query the verification token
            verification_token = (
                self.db.query(VerificationToken)
                .filter(
                    VerificationToken.user_id == user_id,
                    VerificationToken.token == otp_code,
                    VerificationToken.token_type == token_type,
                    VerificationToken.verified_at == None  # Not already verified
                )
                .first()
            )
            
            if not verification_token:
                return {'success': False, 'error': 'Invalid OTP code'}
            
            # Check if OTP is expired
            if verification_token.expires_at < datetime.now(timezone.utc):
                return {'success': False, 'error': 'OTP has expired'}
            
            # Mark token as verified
            verification_token.verified_at = datetime.now(timezone.utc)
            self.db.commit()
            
            # Invalidate Redis entry
            if redis_client and verification_token.id:
                redis_key = f"otp:{user_id}:{token_type}"
                redis_client.delete(redis_key)
            
            return {
                'success': True,
                'user_id': user_id,
                'verified_at': verification_token.verified_at.isoformat()
            }

        except Exception as e:
            logger.error(f"Error verifying OTP: {e}")
            return {'success': False, 'error': 'Failed to verify OTP'}

    # ==================== OTP Management ====================

    def resend_otp(
        self,
        user_id: int,
        token_type: str = 'email_verification',
        delivery_method: str = 'EMAIL'
    ) -> Dict[str, Any]:
        """Resend OTP with rate limiting."""
        try:
            # Check Redis for rate limiting (max 3 attempts per hour)
            if redis_client:
                rate_limit_key = f"otp_resend:{user_id}:{token_type}"
                attempt_count = redis_client.get(rate_limit_key)
                
                if attempt_count and int(attempt_count) >= 3:
                    return {'success': False, 'error': 'Too many attempts. Try again later.'}
                
                # Increment attempt count (expires in 1 hour)
                redis_client.incr(rate_limit_key)
                redis_client.expire(rate_limit_key, 3600)
            
            # Invalidate old token
            old_token = (
                self.db.query(VerificationToken)
                .filter(
                    VerificationToken.user_id == user_id,
                    VerificationToken.token_type == token_type
                )
                .first()
            )
            
            if old_token:
                old_token.verified_at = datetime.now(timezone.utc)
                self.db.commit()
            
            # Create new OTP
            result = self.create_verification_token(
                user_id=user_id,
                token_type=token_type,
                delivery_method=delivery_method
            )
            
            return result

        except Exception as e:
            logger.error(f"Error resending OTP: {e}")
            return {'success': False, 'error': 'Failed to resend OTP'}

    def invalidate_otp(
        self,
        user_id: int,
        token_type: str = 'email_verification'
    ) -> bool:
        """Invalidate all OTPs for a user."""
        try:
            # Mark all tokens as verified (invalidating them)
            self.db.query(VerificationToken)
                .filter(
                    VerificationToken.user_id == user_id,
                    VerificationToken.token_type == token_type,
                    VerificationToken.verified_at == None
                )
                .update(
                    {VerificationToken.verified_at: datetime.now(timezone.utc)},
                    synchronize_session=False
                )
            
            self.db.commit()
            
            # Invalidate Redis entries
            if redis_client:
                redis_key = f"otp:{user_id}:{token_type}"
                redis_client.delete(redis_key)
            
            return True
        except Exception as e:
            logger.error(f"Error invalidating OTP: {e}")
            self.db.rollback()
            return False

    # ==================== Utility Methods ====================

    def get_verification_token(
        self,
        token_id: int
    ) -> Optional[VerificationToken]:
        """Get verification token by ID."""
        return (
            self.db.query(VerificationToken)
            .filter(VerificationToken.id == token_id)
            .first()
        )

    def get_active_verification_tokens(
        self,
        user_id: int,
        token_type: str
    ) -> list:
        """Get all active verification tokens for a user."""
        return (
            self.db.query(VerificationToken)
            .filter(
                VerificationToken.user_id == user_id,
                VerificationToken.token_type == token_type,
                VerificationToken.verified_at == None,
                VerificationToken.expires_at > datetime.now(timezone.utc)
            )
            .all()
        )

    def cleanup_expired_tokens(self) -> int:
        """Cleanup expired verification tokens."""
        try:
            result = (
                self.db.query(VerificationToken)
                .filter(
                    VerificationToken.expires_at < datetime.now(timezone.utc),
                    VerificationToken.verified_at == None
                )
                .delete(synchronize_session=False)
            )
            
            self.db.commit()
            return result
        except Exception as e:
            logger.error(f"Error cleaning up expired tokens: {e}")
            self.db.rollback()
            return 0

    # ==================== Health Check ====================

    def health_check(self) -> Dict[str, Any]:
        """Check OTP service health."""
        redis_status = 'connected' if redis_client else 'not_configured'
        
        return {
            'status': 'healthy',
            'service': 'otp',
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'database_connected': self.db is not None,
            'redis_status': redis_status
        }


# Singleton instance for easy access
otp_service = OTPService(db=None)