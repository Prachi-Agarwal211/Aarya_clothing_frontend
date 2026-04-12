"""
Enhanced Coupon Service with abuse prevention and comprehensive validation.
Implements rate limiting, user tracking, and fraud detection.
"""
import logging
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Optional, Dict, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from fastapi import HTTPException, status, Request
import re

from models.promotion import Promotion, PromotionUsage, DiscountType, UserType
from models.order import Order

logger = logging.getLogger(__name__)


# Disposable email domains to block
DISPOSABLE_EMAIL_DOMAINS = {
    'tempmail.com', 'throwaway.com', 'guerrillamail.com', 'mailinator.com',
    '10minutemail.com', 'fakeinbox.com', 'trashmail.com', 'temp-mail.org',
    'getnada.com', 'maildrop.cc', 'sharklasers.com', 'grr.la', 'guerrillamail.info',
    'spam4.me', 'mailnesia.com', 'yopmail.com', 'cool.fr.nf', 'jetable.org',
}

# Rate limiting configuration
RATE_LIMIT_CONFIG = {
    "max_attempts": 5,           # Max validation attempts per window
    "window_minutes": 15,        # Time window for rate limiting
    "block_duration_hours": 24,  # How long to block after exceeding limit
}


class CouponValidationError(Exception):
    """Custom exception for coupon validation errors."""
    def __init__(self, message: str, code: str = "INVALID_COUPON"):
        self.message = message
        self.code = code
        super().__init__(self.message)


class CouponService:
    """
    Enhanced coupon service with comprehensive validation and abuse prevention.
    
    Features:
    - One coupon per order enforcement
    - Per-user usage tracking
    - Rate limiting on validation attempts
    - Disposable email blocking
    - Suspicious pattern detection
    - Minimum order value validation
    - Maximum discount caps
    - Validity period checks
    - User type restrictions (new vs existing)
    - Category restrictions
    """
    
    def __init__(self, db: Session, redis_client=None):
        """
        Initialize coupon service.
        
        Args:
            db: Database session
            redis_client: Redis client for rate limiting
        """
        self.db = db
        self.redis = redis_client
    
    def _get_rate_limit_key(self, identifier: str) -> str:
        """Generate rate limit cache key."""
        return f"coupon:rate_limit:{identifier}"
    
    def _get_blocked_key(self, identifier: str) -> str:
        """Generate blocked user cache key."""
        return f"coupon:blocked:{identifier}"
    
    def check_rate_limit(self, identifier: str) -> Tuple[bool, int]:
        """
        Check if identifier has exceeded rate limit.
        
        Args:
            identifier: User ID, IP, or email for rate limiting
            
        Returns:
            Tuple of (is_allowed, remaining_attempts)
        """
        if not self.redis:
            return True, RATE_LIMIT_CONFIG["max_attempts"]
        
        try:
            key = self._get_rate_limit_key(identifier)
            attempts = self.redis.get(key)
            
            if attempts is None:
                # First attempt, set counter
                self.redis.setex(
                    key,
                    RATE_LIMIT_CONFIG["window_minutes"] * 60,
                    1
                )
                return True, RATE_LIMIT_CONFIG["max_attempts"] - 1
            
            attempts = int(attempts)
            
            if attempts >= RATE_LIMIT_CONFIG["max_attempts"]:
                # Check if blocked
                blocked_key = self._get_blocked_key(identifier)
                if self.redis.get(blocked_key):
                    return False, 0
                
                # Block the identifier
                self.redis.setex(
                    blocked_key,
                    RATE_LIMIT_CONFIG["block_duration_hours"] * 3600,
                    "blocked"
                )
                return False, 0
            
            # Increment counter
            self.redis.incr(key)
            remaining = RATE_LIMIT_CONFIG["max_attempts"] - attempts - 1
            return True, remaining
            
        except Exception as e:
            logger.error(f"Rate limit check error: {e}")
            return True, RATE_LIMIT_CONFIG["max_attempts"]
    
    def is_disposable_email(self, email: str) -> bool:
        """Check if email is from a disposable provider."""
        if not email:
            return False
        
        email = email.lower().strip()
        domain = email.split('@')[-1] if '@' in email else ''
        
        return domain in DISPOSABLE_EMAIL_DOMAINS
    
    def detect_suspicious_pattern(self, user_id: int, email: str, ip_address: str = None) -> bool:
        """
        Detect suspicious coupon usage patterns.
        
        Checks for:
        - Multiple accounts from same IP
        - Rapid successive coupon attempts
        - Unusual usage patterns
        
        Returns:
            True if suspicious pattern detected
        """
        if not self.redis:
            return False
        
        try:
            # Check IP-based usage
            if ip_address:
                ip_key = f"coupon:ip:{ip_address}"
                ip_usage_count = self.redis.get(ip_key)
                
                if ip_usage_count and int(ip_usage_count) > 10:
                    logger.warning(f"Suspicious IP activity detected: {ip_address}")
                    return True
                
                # Track IP usage
                self.redis.incr(ip_key)
                self.redis.expire(ip_key, 3600)  # 1 hour window
            
            # Check for rapid email changes
            if email:
                email_hash = hash(email) % 10000
                email_key = f"coupon:email:{email_hash}"
                email_attempts = self.redis.get(email_key)
                
                if email_attempts and int(email_attempts) > 5:
                    logger.warning(f"Multiple coupon attempts for email: {email}")
                    return True
                
                self.redis.incr(email_key)
                self.redis.expire(email_key, 1800)  # 30 minutes
            
            return False
            
        except Exception as e:
            logger.error(f"Suspicious pattern detection error: {e}")
            return False
    
    def get_user_coupon_usage(self, user_id: int, promotion_id: int = None) -> Dict:
        """
        Get coupon usage statistics for a user.
        
        Args:
            user_id: User ID
            promotion_id: Optional specific promotion ID
            
        Returns:
            Dict with usage statistics
        """
        query = self.db.query(PromotionUsage).filter(
            PromotionUsage.user_id == user_id
        )
        
        if promotion_id:
            query = query.filter(PromotionUsage.promotion_id == promotion_id)
        
        usage_records = query.all()
        
        total_discount = sum(
            float(record.discount_amount) for record in usage_records
        )
        
        return {
            "total_uses": len(usage_records),
            "total_discount": total_discount,
            "last_used": max(
                (record.used_at for record in usage_records),
                default=None
            ),
            "by_promotion": {}
        }
    
    def has_user_used_coupon(self, user_id: int, promotion: Promotion) -> bool:
        """Check if user has already used this coupon."""
        usage_count = self.db.query(PromotionUsage).filter(
            PromotionUsage.user_id == user_id,
            PromotionUsage.promotion_id == promotion.id
        ).count()
        
        return usage_count >= promotion.max_uses_per_user
    
    def is_new_user(self, user_id: int) -> bool:
        """Check if user is a new customer (first order)."""
        order_count = self.db.query(Order).filter(
            Order.user_id == user_id,
            Order.status != 'cancelled'
        ).count()
        
        return order_count == 0
    
    def validate_coupon(
        self,
        promo_code: str,
        user_id: int,
        order_total: Decimal,
        user_email: str = None,
        user_ip: str = None,
        category_ids: List[int] = None,
        product_ids: List[int] = None,
        is_new_user_only: bool = None  # Override from promotion settings
    ) -> Tuple[Optional[Promotion], Decimal, Dict]:
        """
        Comprehensive coupon validation.
        
        Args:
            promo_code: Coupon code to validate
            user_id: User ID
            order_total: Order subtotal
            user_email: User's email for disposable check
            user_ip: User's IP for rate limiting
            category_ids: Category IDs in cart (for category restrictions)
            product_ids: Product IDs in cart (for product restrictions)
            is_new_user_only: Override for new user restriction
            
        Returns:
            Tuple of (Promotion or None, discount_amount, metadata)
        """
        metadata = {
            "valid": False,
            "errors": [],
            "warnings": [],
            "rate_limit_remaining": None,
        }
        
        # Rate limiting check
        rate_limit_id = str(user_id)  # Per-customer only, not per-IP
        is_allowed, remaining = self.check_rate_limit(rate_limit_id)
        metadata["rate_limit_remaining"] = remaining
        
        if not is_allowed:
            raise CouponValidationError(
                "Too many coupon validation attempts. Please try again later.",
                "RATE_LIMIT_EXCEEDED"
            )
        
        # Disposable email check
        if user_email and self.is_disposable_email(user_email):
            metadata["errors"].append("Disposable email addresses are not allowed")
            raise CouponValidationError(
                "This email provider is not supported for coupon usage",
                "DISPOSABLE_EMAIL"
            )
        
        # Suspicious pattern detection
        if self.detect_suspicious_pattern(user_id, user_email, user_ip):
            metadata["warnings"].append("Suspicious activity detected")
            logger.warning(f"Suspicious coupon validation: user={user_id}, email={user_email}, ip={user_ip}")
        
        # Get promotion
        promotion = self.db.query(Promotion).filter(
            Promotion.code == promo_code.upper().strip(),
            Promotion.is_active == True
        ).first()
        
        if not promotion:
            metadata["errors"].append("Invalid coupon code")
            return None, Decimal(0), metadata
        
        # Check validity period
        now = datetime.now(timezone.utc)
        if promotion.valid_from and now < promotion.valid_from:
            metadata["errors"].append(f"Coupon is not yet valid. Starts from {promotion.valid_from}")
            return None, Decimal(0), metadata
        
        if promotion.valid_until and now > promotion.valid_until:
            metadata["errors"].append("Coupon has expired")
            return None, Decimal(0), metadata
        
        # Check global usage limit
        if promotion.max_uses and promotion.used_count >= promotion.max_uses:
            metadata["errors"].append("Coupon usage limit reached")
            return None, Decimal(0), metadata
        
        # Check per-user usage limit
        if self.has_user_used_coupon(user_id, promotion):
            metadata["errors"].append("You have already used this coupon")
            return None, Decimal(0), metadata
        
        # Check new user restriction
        user_is_new = self.is_new_user(user_id)
        if promotion.user_type_restriction == UserType.NEW and not user_is_new:
            metadata["errors"].append("This coupon is only for new customers")
            return None, Decimal(0), metadata
        
        if promotion.user_type_restriction == UserType.EXISTING and user_is_new:
            metadata["errors"].append("This coupon is only for existing customers")
            return None, Decimal(0), metadata
        
        # Check minimum order value
        if order_total < promotion.min_order_value:
            metadata["errors"].append(
                f"Minimum order value of ₹{promotion.min_order_value} required"
            )
            return None, Decimal(0), metadata
        
        # Check category restrictions
        if category_ids:
            # Check excluded categories
            excluded = promotion.get_excluded_category_ids()
            if excluded:
                for cat_id in category_ids:
                    if cat_id in excluded:
                        metadata["errors"].append("Coupon cannot be applied to items in this category")
                        return None, Decimal(0), metadata
            
            # Check applicable categories (if specified, cart must contain at least one)
            applicable = promotion.get_applicable_category_ids()
            if applicable:
                if not any(cat_id in applicable for cat_id in category_ids):
                    metadata["errors"].append("Coupon is only valid for specific categories")
                    return None, Decimal(0), metadata
        
        # Check product restrictions
        if product_ids:
            # Check excluded products
            excluded = promotion.get_excluded_product_ids()
            if excluded:
                for prod_id in product_ids:
                    if prod_id in excluded:
                        metadata["errors"].append("Coupon cannot be applied to this product")
                        return None, Decimal(0), metadata
            
            # Check applicable products (if specified, cart must contain at least one)
            applicable = promotion.get_applicable_product_ids()
            if applicable:
                if not any(prod_id in applicable for prod_id in product_ids):
                    metadata["errors"].append("Coupon is only valid for specific products")
                    return None, Decimal(0), metadata
        
        # Calculate discount
        discount = Decimal(str(promotion.calculate_discount(float(order_total))))
        
        if discount <= 0:
            metadata["errors"].append("Coupon cannot be applied to this order")
            return None, Decimal(0), metadata
        
        # All checks passed
        metadata["valid"] = True
        metadata["promotion"] = {
            "id": promotion.id,
            "code": promotion.code,
            "discount_type": promotion.discount_type.value,
            "discount_value": float(promotion.discount_value),
            "max_discount": float(promotion.max_discount_amount) if promotion.max_discount_amount else None,
            "min_order_value": float(promotion.min_order_value),
            "user_type_restriction": promotion.user_type_restriction.value,
        }
        
        return promotion, discount, metadata
    
    def record_coupon_usage(
        self,
        promotion: Promotion,
        user_id: int,
        order_id: int,
        discount_amount: Decimal
    ) -> PromotionUsage:
        """
        Record coupon usage after successful order.
        
        Args:
            promotion: Promotion used
            user_id: User ID
            order_id: Order ID
            discount_amount: Discount amount applied
            
        Returns:
            PromotionUsage record
        """
        usage = PromotionUsage(
            promotion_id=promotion.id,
            user_id=user_id,
            order_id=order_id,
            discount_amount=discount_amount
        )
        
        self.db.add(usage)
        
        # Increment global usage count
        promotion.used_count += 1
        
        self.db.commit()
        self.db.refresh(usage)
        
        logger.info(f"Coupon usage recorded: {promotion.code} used by user {user_id} for order {order_id}")
        
        return usage
    
    def get_valid_coupons_for_user(self, user_id: int, order_total: Decimal = None) -> List[Promotion]:
        """
        Get all valid coupons a user can use.
        
        Args:
            user_id: User ID
            order_total: Optional order total to filter by minimum
            
        Returns:
            List of valid promotions
        """
        now = datetime.now(timezone.utc)
        
        # Get all active promotions
        query = self.db.query(Promotion).filter(
            Promotion.is_active == True,
            Promotion.valid_from <= now,
            and_(
                Promotion.valid_until.is_(None),
                Promotion.valid_until >= now
            )
        )
        
        # Filter by usage limits
        promotions = query.all()
        
        valid_promotions = []
        for promo in promotions:
            # Check global limit
            if promo.max_uses and promo.used_count >= promo.max_uses:
                continue
            
            # Check per-user limit
            if self.has_user_used_coupon(user_id, promo):
                continue
            
            # Check minimum order value
            if order_total and order_total < promo.min_order_value:
                continue
            
            valid_promotions.append(promo)
        
        return valid_promotions


def validate_coupon_middleware(db: Session, redis_client=None):
    """
    Create a coupon validation middleware/dependency.
    
    Usage:
        coupon_service = validate_coupon_middleware(db, redis_client)
        promotion, discount, metadata = coupon_service.validate_coupon(...)
    """
    return CouponService(db, redis_client)
