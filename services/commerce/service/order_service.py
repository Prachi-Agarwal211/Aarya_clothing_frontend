"""Order service for managing order operations."""

from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import desc, text
from sqlalchemy.exc import IntegrityError, OperationalError
from fastapi import HTTPException, status
from decimal import Decimal
from datetime import datetime
from time import monotonic
import logging
import uuid
import time as _time

from shared.time_utils import ist_naive, now_ist
from shared.storage.utils import get_r2_public_url

from core.config import settings
from core.redis_client import redis_client
from models.order import Order, OrderItem, OrderStatus
from models.pending_order import PendingOrder
from models.user import User
from models.product import Product
from models.inventory import Inventory
from models.product_variant import ProductVariant
from models.address import Address
from service.inventory_service import InventoryService
from service.cart_service import CartService
from service.customer_activity_logger import log_customer_activity
from service.email_outbox_service import EmailOutboxService
from schemas.order import OrderCreate, OrderUpdate

logger = logging.getLogger(__name__)


# ==================== Distributed Lock for Order Creation ====================

_ORDER_LOCK_PREFIX = "order_lock:"
_ORDER_LOCK_TTL = 15  # seconds
_ORDER_LOCK_RETRY_INTERVAL = 0.1  # 100ms
_ORDER_LOCK_TIMEOUT = 10.0  # max wait seconds


def _acquire_order_lock(lock_value: str, timeout: float = _ORDER_LOCK_TIMEOUT) -> Optional[str]:
    """
    Acquire a distributed Redis lock for order creation by payment_id.

    Uses SET NX EX to atomically create the lock with a TTL.
    Retries every 100ms until timeout (default 10s).

    Returns:
        Lock token (UUID string) if acquired, None if timed out.
    """
    if not lock_value:
        return None
    lock_token = str(uuid.uuid4())
    lock_key = f"{_ORDER_LOCK_PREFIX}{lock_value}"
    deadline = _time.monotonic() + timeout
    rc = getattr(redis_client, "client", None)
    if rc is None:
        return lock_token  # No Redis — degraded mode, allow through
    while _time.monotonic() < deadline:
        acquired = rc.set(lock_key, lock_token, nx=True, ex=_ORDER_LOCK_TTL)
        if acquired:
            return lock_token
        _time.sleep(_ORDER_LOCK_RETRY_INTERVAL)
    return None


def _release_order_lock(lock_value: str, lock_token: Optional[str]):
    """Release distributed order lock atomically via Lua script."""
    if not lock_token or not lock_value:
        return
    lock_key = f"{_ORDER_LOCK_PREFIX}{lock_value}"
    rc = getattr(redis_client, "client", None)
    if rc is None:
        return
    script = """
    if redis.call('GET', KEYS[1]) == ARGV[1] then
        return redis.call('DEL', KEYS[1])
    else
        return 0
    end
    """
    try:
        rc.eval(script, 1, lock_key, lock_token)
    except Exception as e:
        logger.warning(f"Order lock release failed for {lock_value}: {e}")


def _find_existing_order(
    db: Session,
    user_id: int,
    transaction_id: Optional[str] = None,
    razorpay_order_id: Optional[str] = None,
    pending_order_id: Optional[int] = None,
    qr_code_id: Optional[str] = None,
) -> Optional[Order]:
    """
    Idempotency check — find existing order by any of the known identifiers.

    Checks in order of specificity:
    1. transaction_id + user_id (most reliable — UniqueConstraint enforced)
    2. razorpay_order_id + user_id (webhook path may have different transaction_id)
    3. pending_order_id (recovery path)
    4. razorpay_payment_id + user_id (QR-based fallback, within 5 min window)

    This is called under a distributed Redis lock, so concurrent calls from
    the frontend and webhook paths cannot both miss.
    """
    from datetime import timedelta
    from datetime import timezone as dt_tz
    from sqlalchemy import or_

    try:
        conditions = []

        # 1. By transaction_id (pay_xxx — most common)
        if transaction_id:
            conditions.append(
                (Order.transaction_id == transaction_id)
                & (Order.user_id == user_id)
            )

        # 2. By razorpay_order_id (order_xxx — webhook path recovery)
        if razorpay_order_id:
            conditions.append(
                (Order.razorpay_order_id == razorpay_order_id)
                & (Order.user_id == user_id)
            )

        # 3. By pending_order_id (links order to the pending snapshot)
        if pending_order_id:
            conditions.append(Order.pending_order_id == pending_order_id)

        # If any conditions exist, try to find a match
        if conditions:
            combined = conditions[0]
            for c in conditions[1:]:
                combined = combined | c

            existing = (
                db.query(Order)
                .filter(combined)
                .with_for_update(skip_locked=True)
                .order_by(Order.created_at.desc())
                .first()
            )
            if existing:
                return existing

        # 4. QR fallback — check by razorpay_payment_id within 5 min
        if qr_code_id:
            qr_existing = (
                db.query(Order)
                .filter(
                    Order.razorpay_payment_id.isnot(None),
                    Order.razorpay_payment_id != "",
                    Order.user_id == user_id,
                )
                .order_by(Order.created_at.desc())
                .first()
            )
            if qr_existing:
                now_naive = now_ist().replace(tzinfo=None)
                age = now_naive - qr_existing.created_at
                if age <= timedelta(minutes=5):
                    return qr_existing

    except OperationalError:
        db.rollback()
    except Exception as e:
        logger.warning(f"_find_existing_order error: {e}")
        db.rollback()

    return None


def sync_invoice_sequence(db: Session) -> None:
    """
    Sync the invoice_number_seq PostgreSQL sequence to MAX(orders.id) + 1.

    This ensures that after data migrations, restores, or manual inserts,
    the sequence doesn't generate invoice numbers that collide with existing orders.
    Safe to call on every startup — idempotent (sets to MAX+1 only if sequence is lower).
    """
    try:
        max_id = db.execute(text("SELECT COALESCE(MAX(id), 0) FROM orders")).scalar()
        next_val = max_id + 1
        db.execute(text(f"SELECT setval('invoice_number_seq', {next_val}, false)"))
        db.commit()
        logger.info(
            f"✓ invoice_number_seq synced to {next_val} (MAX(orders.id)={max_id})"
        )
    except Exception as e:
        logger.warning(f"⚠ Could not sync invoice_number_seq: {e}")


# Order emails: Commerce → HTTP → Core (SMTP + templates live in Core only)
from service import core_notification_client as _core_notify

# Try to import payment service client
try:
    from shared.service_client import PaymentServiceClient, ServiceError

    PAYMENT_CLIENT_AVAILABLE = True
except ImportError:
    PAYMENT_CLIENT_AVAILABLE = False
    logger.warning(
        "Payment service client not available - payment integration disabled"
    )


class OrderService:
    """Service for order management operations."""

    def __init__(self, db: Session):
        """Initialize order service."""
        self.db = db
        self.inventory_service = InventoryService(db)
        self.cart_service = CartService(db)
        self.email_service = EmailOutboxService(db)

    def create_pending_order(
        self,
        user_id: int,
        cart_snapshot: List[Dict],
        shipping_address: str,
        total_amount: Decimal,
        subtotal: Decimal,
        address_id: Optional[int] = None,
        razorpay_order_id: Optional[str] = None,
        discount_applied: Decimal = Decimal(0),
        shipping_cost: Decimal = Decimal(0),
    ) -> PendingOrder:
        """Create a checkout snapshot."""
        from datetime import timedelta
        expires_at = now_ist() + timedelta(minutes=30)
        pending = PendingOrder(
            user_id=user_id,
            cart_snapshot=cart_snapshot,
            shipping_address=shipping_address,
            address_id=address_id,
            total_amount=total_amount,
            subtotal=subtotal,
            discount_applied=discount_applied,
            shipping_cost=shipping_cost,
            razorpay_order_id=razorpay_order_id,
            status="pending",
            expires_at=expires_at,
        )
        self.db.add(pending)
        self.db.commit()
        self.db.refresh(pending)
        return pending

    def _create_order_from_snapshot(
        self,
        user_id: int,
        cart_items: List[Dict],
        shipping_address: str,
        total_amount: Decimal,
        subtotal: Decimal,
        payment_method: str = "razorpay",
        transaction_id: Optional[str] = None,
        razorpay_order_id: Optional[str] = None,
        pending_order_id: Optional[int] = None,
        discount_applied: Decimal = Decimal(0),
        shipping_cost: Decimal = Decimal(0),
        order_notes: Optional[str] = None,
    ) -> Order:
        """Internal helper to build an Order object from a list of items."""
        order = Order(
            user_id=user_id,
            total_amount=total_amount,
            subtotal=subtotal,
            discount_applied=discount_applied,
            shipping_cost=shipping_cost,
            shipping_address=shipping_address,
            status=OrderStatus.CONFIRMED,
            payment_method=payment_method,
            transaction_id=transaction_id,
            razorpay_order_id=razorpay_order_id,
            pending_order_id=pending_order_id,
            order_notes=order_notes,
        )
        self.db.add(order)
        self.db.flush()

        # Add items
        for item in cart_items:
            # Re-verify variant exists (might have been deleted during payment)
            variant = (
                self.db.query(ProductVariant)
                .filter(ProductVariant.id == item["variant_id"])
                .first()
            )
            if not variant:
                logger.warning(
                    f"Variant {item['variant_id']} not found during order creation snapshot recovery"
                )
                continue

            order_item = OrderItem(
                order_id=order.id,
                product_id=item["product_id"],
                variant_id=item["variant_id"],
                sku=item["sku"],
                quantity=item["quantity"],
                unit_price=Decimal(str(item.get("unit_price", item.get("price", 0)))),
                line_total=Decimal(str(item.get("unit_price", item.get("price", 0)))) * item["quantity"],
                size=item.get("size", variant.size),
                color=item.get("color", variant.color),
                image_url=item.get("image_url", variant.resolved_image_url),
            )
            self.db.add(order_item)

            # Deduct stock via inventory service (uses SELECT FOR UPDATE + total_stock sync)
            # CRITICAL: Stock deduction failure must rollback the entire order —
            # allowing an order without stock deduction causes overselling.
            sku = item.get("sku")
            if sku:
                self.inventory_service.deduct_stock_for_order(sku=sku, quantity=item["quantity"])
            else:
                logger.warning("No SKU for order item — skipping stock deduction (recovery order)")

        self.db.commit()
        self.db.refresh(order)
        return order

    def create_order_from_pending_id(
        self,
        pending_id: int,
        transaction_id: str,
        payment_method: str = "razorpay",
    ) -> Order:
        """Create order from a pending order snapshot (webhook recovery).

        Uses distributed Redis lock on the payment_id to prevent race with
        the frontend order creation path (create_order). On IntegrityError
        from concurrent duplicate, falls back to finding the existing order.
        """
        # ── DISTRIBUTED LOCK ──
        lock_value = transaction_id
        lock_token = _acquire_order_lock(lock_value)
        if not lock_token:
            raise ValueError(f"Could not acquire lock for pending order {pending_id}")

        try:
            pending = self.db.query(PendingOrder).filter(PendingOrder.id == pending_id).first()
            if not pending:
                raise ValueError(f"Pending order {pending_id} not found")

            # Double check idempotency under lock
            existing = (
                self.db.query(Order)
                .filter(Order.pending_order_id == pending_id)
                .first()
            )
            if existing:
                logger.info(f"Order already exists for pending_id {pending_id}: {existing.id}")
                return existing

            # Also check by transaction_id (race from frontend path)
            existing_by_txn = (
                self.db.query(Order)
                .filter(
                    Order.transaction_id == transaction_id,
                    Order.user_id == pending.user_id,
                )
                .first()
            )
            if existing_by_txn:
                logger.info(
                    f"Order already exists for transaction {transaction_id} "
                    f"(pending_id={pending_id}): {existing_by_txn.id}"
                )
                # Link pending order to existing order
                pending.status = "order_created"
                pending.order_id = existing_by_txn.id
                pending.transaction_id = transaction_id
                pending.order_created_at = now_ist()
                self.db.commit()
                return existing_by_txn

            order = self._create_order_from_snapshot(
                user_id=pending.user_id,
                cart_items=pending.cart_snapshot,
                shipping_address=pending.shipping_address,
                total_amount=pending.total_amount,
                subtotal=pending.subtotal,
                payment_method=payment_method,
                transaction_id=transaction_id,
                razorpay_order_id=pending.razorpay_order_id,
                pending_order_id=pending.id,
                discount_applied=pending.discount_applied,
                shipping_cost=pending.shipping_cost,
                order_notes=pending.order_notes,
            )

            # Update pending status
            pending.status = "order_created"
            pending.order_id = order.id
            pending.transaction_id = transaction_id
            pending.order_created_at = now_ist()
            self.db.commit()

            return order

        except IntegrityError as ie:
            self.db.rollback()
            logger.warning(
                f"PENDING_ORDER_RACE_RECOVER: pending_id={pending_id} "
                f"transaction={transaction_id} {ie}"
            )
            ordered = (
                self.db.query(Order)
                .filter(
                    Order.transaction_id == transaction_id,
                )
                .first()
            )
            if ordered:
                return ordered
            raise ValueError(f"Duplicate order detected for pending_id {pending_id}, contact support")
        finally:
            _release_order_lock(lock_value, lock_token)

    def get_user_orders(
        self,
        user_id: int,
        skip: int = 0,
        limit: int = 50,
        status: Optional[OrderStatus] = None,
    ) -> List[Order]:
        """Get all orders for a user with pagination and eager loading."""
        query = (
            self.db.query(Order)
            .options(
                selectinload(Order.items).options(
                    joinedload(OrderItem.variant),
                    joinedload(OrderItem.product),  # Load product for image fallback
                )
            )
            .filter(Order.user_id == user_id)
        )
        if status:
            query = query.filter(Order.status == status)
        return query.order_by(desc(Order.created_at)).offset(skip).limit(limit).all()

    def get_order_by_id(
        self, order_id: int, user_id: Optional[int] = None
    ) -> Optional[Order]:
        """Get order by ID with eager loading to prevent N+1 queries."""
        query = (
            self.db.query(Order)
            .options(
                selectinload(Order.items).options(
                    joinedload(OrderItem.product), joinedload(OrderItem.variant)
                ),
                joinedload(Order.shipping_address_ref),
                joinedload(Order.billing_address_ref),
                selectinload(Order.tracking),
            )
            .filter(Order.id == order_id)
        )

        if user_id:
            query = query.filter(Order.user_id == user_id)

        return query.first()

    def register_payment(
        self,
        user_id: int,
        transaction_id: Optional[str] = None,
        razorpay_order_id: Optional[str] = None,
        payment_signature: Optional[str] = None,
        address_id: Optional[int] = None,
        order_notes: Optional[str] = None,
        pending_order_id: Optional[int] = None,
        qr_code_id: Optional[str] = None,
        skip_signature_verification: bool = False,
    ) -> Dict[str, Any]:
        """
        Register a successful payment and snapshot the cart for webhook order creation.

        This is the ONLY frontend-facing order creation entry point. It does NOT
        create the order — it verifies the payment signature, snapshots the cart
        as a pending_order, and returns. The actual order is created asynchronously
        by the Razorpay webhook handler (the single source of truth).

        The frontend should poll ``GET /api/v1/orders/by-payment/{transaction_id}``
        until the order appears.

        Supports two payment methods:
        1. **Standard Razorpay Checkout** (requires ``transaction_id``, ``razorpay_order_id``,
           and ``payment_signature`` for HMAC verification).
        2. **UPI QR Code** (uses ``qr_code_id`` instead — QR payments are verified via
           webhook polling, not HMAC signature, so signature verification is skipped).

        Args:
            transaction_id: Razorpay payment ID (pay_xxx) — optional for QR codes
            razorpay_order_id: Razorpay order ID (order_xxx) — optional for QR codes
            payment_signature: HMAC signature — optional for QR codes
            qr_code_id: Razorpay QR code ID (qr_xxx) — for UPI QR code payments
            skip_signature_verification: When True, skips signature verification.
                Used by admin recovery path and QR codes.

        Returns:
            Dict with status, payment_id, and pending_order_id.
        """
        is_qr = bool(qr_code_id)

        # 1. Validate inputs
        if not transaction_id and not is_qr:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Payment ID or QR code ID is required",
            )

        # QR codes skip signature verification (no HMAC — verified via webhook polling)
        effective_skip = skip_signature_verification or is_qr
        if not effective_skip:
            if not payment_signature or not razorpay_order_id:
                raise HTTPException(
                    status_code=status.HTTP_402_PAYMENT_REQUIRED,
                    detail="Payment signature and Razorpay order ID are required",
                )

        # 2. Resolve address
        final_shipping_address = None
        if address_id:
            address = (
                self.db.query(Address)
                .filter(Address.id == address_id, Address.user_id == user_id)
                .first()
            )
            if not address:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail="Address not found"
                )
            parts = [
                address.full_name,
                address.address_line1,
                address.address_line2,
                f"{address.city}, {address.state} - {address.postal_code}",
                f"Phone: {address.phone}",
            ]
            final_shipping_address = ", ".join([p for p in parts if p])
        if not final_shipping_address:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Shipping address is required",
            )

        # 3. Check if order already exists (webhook processed it before our call)
        existing = _find_existing_order(self.db, user_id, transaction_id, razorpay_order_id)
        if existing:
            logger.info(
                f"REGISTER_PAYMENT_ORDER_EXISTS: user={user_id} payment={transaction_id} order={existing.id}"
            )
            return {
                "status": "order_exists",
                "payment_id": transaction_id,
                "order_id": existing.id,
                "order": existing,
            }

        # 4. Verify Razorpay payment signature (skip if recovery/QR path already did this)
        if not effective_skip:
            logger.info(
                f"PAYMENT_VERIFY_START: user={user_id} payment_id={transaction_id} "
                f"razorpay_order_id={razorpay_order_id} sig_len={len(payment_signature) if payment_signature else 0}"
            )
            try:
                import httpx as _httpx
                import os as _os

                payment_service_url = _os.getenv(
                    "PAYMENT_SERVICE_URL", "http://payment:5003"
                )
                resp = _httpx.post(
                    f"{payment_service_url}/api/v1/payments/razorpay/verify-signature",
                    json={
                        "razorpay_order_id": razorpay_order_id,
                        "razorpay_payment_id": transaction_id,
                        "razorpay_signature": payment_signature,
                    },
                    timeout=5.0,
                )
                if resp.status_code != 200:
                    logger.error(
                        f"PAYMENT_VERIFY_FAILED: user={user_id} payment_id={transaction_id} "
                        f"status={resp.status_code} response={resp.text[:200]}"
                    )
                    raise HTTPException(
                        status_code=status.HTTP_402_PAYMENT_REQUIRED,
                        detail="Payment verification failed — signature invalid",
                    )
                logger.info(
                    f"✓ PAYMENT_VERIFIED: user={user_id} payment_id={transaction_id} "
                    f"order_id={razorpay_order_id}"
                )
            except HTTPException:
                raise
            except Exception as _e:
                logger.error(
                    f"PAYMENT_VERIFY_ERROR: user={user_id} payment_id={transaction_id} "
                    f"error={str(_e)}", exc_info=True
                )
                raise HTTPException(
                    status_code=status.HTTP_402_PAYMENT_REQUIRED,
                    detail="Payment verification unavailable — please contact support",
                )
        else:
            logger.info(
                f"PAYMENT_VERIFY_SKIPPED: user={user_id} payment_id={transaction_id} "
                f"— recovery path pre-verified payment"
            )


        # 5. Snapshot cart as pending_order (if not already created by payment service)
        cart = self.cart_service.get_cart(user_id)
        if not cart.get("items") or len(cart["items"]) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Cart is empty"
            )

        if pending_order_id:
            # Pending order was created by payment service during checkout initiation
            pending = self.db.query(PendingOrder).filter(
                PendingOrder.id == pending_order_id,
                PendingOrder.user_id == user_id,
            ).first()
            if not pending:
                logger.warning(f"Pending order {pending_order_id} not found — creating new snapshot")
                pending = None
        else:
            pending = None

        if not pending:
            pending = self.create_pending_order(
                user_id=user_id,
                cart_snapshot=cart.get("items", []),
                shipping_address=final_shipping_address,
                total_amount=Decimal(str(cart.get("total", 0))),
                subtotal=Decimal(str(cart.get("subtotal", 0))),
                address_id=address_id,
                razorpay_order_id=razorpay_order_id,
                discount_applied=Decimal(str(cart.get("discount_amount", 0))),
                shipping_cost=Decimal(str(cart.get("shipping", 0))),
            )
            pending_order_id = pending.id
            logger.info(f"REGISTER_PAYMENT_CREATED_PENDING: id={pending.id} user={user_id}")

        # 6. Mark pending order as payment_confirmed
        pending.status = "payment_confirmed"
        pending.transaction_id = transaction_id
        pending.razorpay_order_id = razorpay_order_id
        self.db.commit()

        # NOTE: Cart is NOT cleared here. The cart is cleared by the frontend
        # after the order is confirmed (CheckoutConfirmPage calls clearCart()).
        # This prevents data loss if the webhook fails — the pending_order
        # snapshot already has the cart data, and the cart remains as a backup.

        logger.info(
            f"✓ REGISTER_PAYMENT_SUCCESS: user={user_id} payment={transaction_id} "
            f"pending_id={pending_order_id}"
        )
        return {
            "status": "payment_registered",
            "payment_id": transaction_id,
            "pending_order_id": pending_order_id,
        }

    def find_order_by_payment(
        self,
        user_id: int,
        payment_id: str,
    ) -> Optional[Order]:
        """
        Find an order by payment identifier.

        Checks transaction_id, razorpay_payment_id, and razorpay_order_id
        to cover all identifier placements (standard + QR code payments).

        Called by the frontend polling endpoint after payment registration.
        """
        order = (
            self.db.query(Order)
            .filter(
                (Order.transaction_id == payment_id)
                | (Order.razorpay_payment_id == payment_id)
                | (Order.razorpay_order_id == payment_id)
            )
            .filter(Order.user_id == user_id)
            .first()
        )
        if order:
            return self.get_order_by_id(order.id)
        return None

    def create_order_from_pending_order(
        self,
        pending_order_data: Dict[str, Any],
        user_id: int,
        payment_id: str,
        razorpay_order_id: Optional[str] = None,
        payment_signature: Optional[str] = None,
    ) -> Order:
        """
        Create an order from a pending_order record (called by webhook handler).

        This is the critical recovery path: when payment succeeds but the frontend
        never called the normal order creation endpoint. The webhook handler calls
        this method to guarantee order creation.

        Uses distributed Redis lock on payment_id to prevent race with the
        frontend create_order() path. DB-level IntegrityError at commit time
        falls back to finding the existing order.

        Args:
            pending_order_data: Cart snapshot and order details from pending_orders table
            user_id: User who placed the order
            payment_id: Razorpay payment ID (pay_xxx)
            razorpay_order_id: Razorpay order ID (order_xxx)
            payment_signature: HMAC signature for verification

        Returns:
            Created Order object

        Raises:
            HTTPException: If validation fails
            ValueError: If order already exists for this payment
        """
        from sqlalchemy import text as _text

        # CRITICAL FIX: Handle NULL transaction_id - use payment_id/razorpay_order_id directly
        # This happens when payment service didn't set transaction_id before calling
        lookup_id = payment_id
        if not lookup_id and razorpay_order_id:
            lookup_id = razorpay_order_id
        if not lookup_id:
            raise HTTPException(status_code=400, detail="payment_id or razorpay_order_id is required")

        # ── DISTRIBUTED LOCK ──
        lock_value = payment_id or razorpay_order_id
        lock_token = _acquire_order_lock(lock_value)
        if not lock_token:
            # Lock timed out — try to find existing order
            dup = _find_existing_order(self.db, user_id, payment_id, razorpay_order_id)
            if dup:
                return dup
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Order is being processed from another payment notification.",
            )

        try:
            # Idempotency: Check if order already exists for this payment — WITH row lock to prevent races
            existing = (
                self.db.query(Order)
                .filter(Order.transaction_id == lookup_id, Order.user_id == user_id)
                .with_for_update(skip_locked=True)
                .first()
            )
            if existing:
                logger.info(
                    f"Order already exists for payment {lookup_id}, returning existing order {existing.id}"
                )
                return existing

            # Also check by razorpay_order_id
            if razorpay_order_id:
                existing_by_razorpay = (
                    self.db.query(Order)
                    .filter(
                        Order.razorpay_order_id == razorpay_order_id,
                        Order.user_id == user_id,
                    )
                    .with_for_update(skip_locked=True)
                    .first()
                )
                if existing_by_razorpay:
                    logger.info(
                        f"Order already exists for razorpay_order {razorpay_order_id}, returning {existing_by_razorpay.id}"
                    )
                    return existing_by_razorpay

            # Extract cart items from pending_order snapshot
            cart_items = pending_order_data.get(
                "cart_snapshot", pending_order_data.get("cart_items", [])
            )

            # Extract order data
            shipping_address = pending_order_data.get("shipping_address")

            subtotal = Decimal(str(pending_order_data.get("subtotal", 0)))
            shipping_cost = Decimal(str(pending_order_data.get("shipping_cost", 0)))
            gst_amount = Decimal(str(pending_order_data.get("gst_amount", 0)))
            cgst_amount = Decimal(str(pending_order_data.get("cgst_amount", 0)))
            sgst_amount = Decimal(str(pending_order_data.get("sgst_amount", 0)))
            igst_amount = Decimal(str(pending_order_data.get("igst_amount", 0)))
            total_amount = Decimal(str(pending_order_data.get("total_amount", 0)))
            order_notes = pending_order_data.get("order_notes", "")
            delivery_state = pending_order_data.get("delivery_state", "")
            customer_gstin = pending_order_data.get("customer_gstin")

            # RECOVERY PATH: If cart was already cleared, create a minimal order
            created_minimal = False
            if not cart_items:
                logger.warning(
                    f"RECOVERY_MINIMAL_ORDER: user={user_id} payment={payment_id} "
                    f"— no cart items available. Creating minimal order."
                )
                cart_items = [{
                    "product_id": None,
                    "name": "Order recovered from payment",
                    "price": float(total_amount),
                    "quantity": 1,
                    "unit_price": float(total_amount),
                    "sku": None,
                }]
                created_minimal = True

            if not shipping_address:
                shipping_address = "Address to be confirmed — contact customer support for delivery details"
                if not created_minimal:
                    order_notes = f"{order_notes} [ADDRESS MISSING — RECOVERY]".strip()

            # Generate invoice number
            year = now_ist().year
            seq_val = self.db.execute(
                _text("SELECT nextval('invoice_number_seq')")
            ).scalar()
            invoice_number = f"INV-{year}-{seq_val:06d}"

            # Create the order
            order = Order(
                user_id=user_id,
                transaction_id=payment_id,
                payment_method=pending_order_data.get("payment_method", "razorpay"),
                invoice_number=invoice_number,
                subtotal=subtotal,
                shipping_cost=shipping_cost,
                gst_amount=gst_amount,
                cgst_amount=cgst_amount,
                sgst_amount=sgst_amount,
                igst_amount=igst_amount,
                place_of_supply=delivery_state,
                customer_gstin=customer_gstin,
                total_amount=total_amount,
                status=OrderStatus.CONFIRMED,
                shipping_address=shipping_address,
                order_notes=f"{order_notes} [CREATED FROM WEBHOOK/RECOVERY]".strip()
                if order_notes
                else "[CREATED FROM WEBHOOK/RECOVERY]",
                razorpay_order_id=razorpay_order_id,
                razorpay_payment_id=payment_id,
            )

            self.db.add(order)
            self.db.flush()

            # Create order items from cart snapshot
            for item in cart_items:
                product_id = item.get("product_id")
                sku = item.get("sku")

                variant = None
                if sku:
                    variant = self.db.query(Inventory).filter(Inventory.sku == sku).first()

                if not variant:
                    self.db.rollback()
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Variant for SKU '{sku}' is no longer available.",
                    )

                if not product_id:
                    product_id = variant.product_id

                unit_price = Decimal(str(item.get("unit_price", item.get("price", 0))))
                qty = int(item.get("quantity", 1))
                raw_image = item.get("image_url") or item.get("image") or variant.resolved_image_url or variant.image_url
                full_image = get_r2_public_url(raw_image) if raw_image else None

                order_item = OrderItem(
                    order_id=order.id,
                    product_id=product_id,
                    variant_id=variant.id,
                    product_name=item.get("name", "Unknown Product"),
                    sku=sku,
                    size=item.get("size") or variant.size,
                    color=item.get("color") or variant.color,
                    color_hex=item.get("color_hex") or getattr(variant, 'color_hex', None),
                    image_url=full_image,
                    quantity=qty,
                    unit_price=unit_price,
                    line_total=unit_price * qty,
                )
                self.db.add(order_item)

                try:
                    self.inventory_service.deduct_stock_for_order(sku=sku, quantity=qty)
                except Exception as e:
                    self.db.rollback()
                    logger.error(f"Failed to deduct stock for {sku}: {e}")
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Failed to process stock for {item.get('name', sku)}.",
                    )

            try:
                self.db.commit()
                self.db.refresh(order)
            except IntegrityError as ie:
                self.db.rollback()
                logger.warning(f"WEBHOOK_ORDER_RACE_RECOVER: user={user_id} payment={payment_id} {ie}")
                dup = _find_existing_order(self.db, user_id, payment_id, razorpay_order_id)
                if dup:
                    return dup
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Order already exists for this payment.",
                )

            # Create payment transaction record (best-effort)
            try:
                self.db.execute(
                    _text("""
                        INSERT INTO payment_transactions (
                            order_id, user_id, amount, currency, payment_method,
                            razorpay_order_id, razorpay_payment_id, razorpay_signature,
                            status, created_at, completed_at, transaction_id
                        ) VALUES (
                            :order_id, :user_id, :amount, 'INR', 'razorpay',
                            :razorpay_order_id, :razorpay_payment_id, :signature,
                            'completed', NOW(), NOW(), :transaction_id
                        )
                        ON CONFLICT (transaction_id) DO NOTHING
                    """),
                    {
                        "order_id": order.id,
                        "user_id": user_id,
                        "amount": order.total_amount,
                        "razorpay_order_id": razorpay_order_id or "",
                        "razorpay_payment_id": payment_id,
                        "signature": payment_signature or "",
                        "transaction_id": payment_id,
                    },
                )
                self.db.commit()
            except Exception as e:
                logger.error(f"⚠ Payment transaction insert failed: {e}")

            # Enqueue order confirmation email (fire-and-forget)
            try:
                user = self.db.query(User).filter(User.id == user_id).first()
                if user and user.email:
                    self.email_service.enqueue_order_confirmation(order.id, user_id, order, user)
            except Exception as e:
                logger.error(f"Failed to enqueue email for order {order.id}: {e}")

            logger.info(f"✓ WEBHOOK ORDER CREATED: order_id={order.id} user={user_id} payment={payment_id}")
            return order

        except IntegrityError as ie:
            self.db.rollback()
            logger.warning(f"WEBHOOK_ORDER_RACE_RECOVER: user={user_id} payment={payment_id} {ie}")
            dup = _find_existing_order(self.db, user_id, payment_id, razorpay_order_id)
            if dup:
                return dup
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Order could not be placed due to a conflict.",
            )
        finally:
            _release_order_lock(lock_value, lock_token)

    def update_order_status(
        self,
        order_id: int,
        new_status: OrderStatus,
        tracking_number: Optional[str] = None,
        admin_notes: Optional[str] = None,
    ) -> Order:
        """
        Update order status with validation.

        Status transitions:
        PENDING → CONFIRMED, CANCELLED
        CONFIRMED → PROCESSING, CANCELLED
        PROCESSING → SHIPPED
        SHIPPED → DELIVERED
        DELIVERED → RETURNED
        CANCELLED → (terminal)
        """
        order = self.get_order_by_id(order_id)

        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Order not found"
            )

        # Validate status transition
        # Simple 4-state machine: CONFIRMED → SHIPPED → DELIVERED, CONFIRMED → CANCELLED
        valid_transitions = {
            OrderStatus.CONFIRMED: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
            OrderStatus.SHIPPED: [OrderStatus.DELIVERED],
            OrderStatus.DELIVERED: [],  # Terminal — returns handled by Returns module
            OrderStatus.CANCELLED: [],  # Terminal
            OrderStatus.REFUNDED: [],  # Terminal
        }

        if new_status not in valid_transitions.get(order.status, []):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot transition from {order.status.value} to {new_status.value}",
            )

        # Update status
        order.status = new_status

        # Setup timestamps
        now = ist_naive()

        # Determine tracking specific fields
        location = None
        notes = admin_notes
        if new_status == OrderStatus.SHIPPED:
            order.shipped_at = now
            if tracking_number:
                order.tracking_number = tracking_number
            location = "In Transit"
            if not notes:
                notes = (
                    f"Order shipped — POD number: {tracking_number}"
                    if tracking_number
                    else "Order shipped"
                )
        elif new_status == OrderStatus.DELIVERED:
            order.delivered_at = now
            if not notes:
                notes = "Order successfully delivered to customer"
        elif new_status == OrderStatus.CANCELLED:
            order.cancelled_at = now
            if admin_notes:
                order.cancellation_reason = admin_notes
            if not notes:
                notes = "Order was cancelled"

        # 1. Add historical tracking entry
        from models.order_tracking import OrderTracking

        tracking_entry = OrderTracking(
            order_id=order_id,
            status=new_status,
            location=location,
            notes=notes,
            # updated_by is not available in this function signature directly, but we can leave null
            # or pass it from the API layer if needed.
        )
        self.db.add(tracking_entry)

        self.db.commit()
        self.db.refresh(order)
        self.db.refresh(tracking_entry)

        # Publish order status event to Redis Pub/Sub for SSE consumers
        try:
            from core.redis_client import redis_client
            import json as _json

            event_payload = _json.dumps(
                {
                    "order_id": order_id,
                    "tracking_id": tracking_entry.id if tracking_entry else None,
                    "status": new_status.value,
                    "tracking_number": tracking_number,
                    "location": location,
                    "notes": notes,
                    "timestamp": now.isoformat(),
                }
            )
            # Pub/Sub channel per order — SSE endpoint subscribes to this
            redis_client.client.publish(f"order_updates:{order_id}", event_payload)
            # Also set a cache key as fallback for late-joining SSE clients
            redis_client.set_cache(
                f"order:event:{order_id}", _json.loads(event_payload), ttl=60
            )
        except Exception as pub_err:
            logger.warning(f"Failed to publish order status event: {pub_err}")

        # Enqueue status-change email (fire-and-forget outbox)
        try:
            user = self.db.query(User).filter(User.id == order.user_id).first()
            if user and user.email:
                if new_status == OrderStatus.SHIPPED:
                    self.email_service.enqueue_order_shipped(
                        order.id, order.user_id, order, user, tracking_number or ""
                    )
                elif new_status == OrderStatus.DELIVERED:
                    self.email_service.enqueue_order_delivered(
                        order.id, order.user_id, order, user
                    )
                elif new_status == OrderStatus.CANCELLED:
                    self.email_service.enqueue_order_cancelled(
                        order.id, order.user_id, order, user, admin_notes
                    )
            else:
                logger.warning(
                    f"No email for user {order.user_id}, skipping status email for order {order_id}"
                )
        except Exception as e:
            logger.error(f"Failed to enqueue status email for order {order_id}: {e}")
            # Non-critical - order already updated

        return order

    def bulk_update_order_status(
        self, order_ids: List[int], new_status: OrderStatus
    ) -> int:
        """
        Bulk update order status for multiple orders.

        Uses a single UPDATE query for efficiency, then publishes
        Redis SSE events for each updated order.

        Returns the number of updated orders.
        """
        if not order_ids:
            return 0

        updated = (
            self.db.query(Order)
            .filter(Order.id.in_(order_ids))
            .update({"status": new_status}, synchronize_session=False)
        )

        self.db.commit()

        # Determine tracking specific fields for bulk
        now = ist_naive()
        location = None
        notes = "Status updated via bulk action"
        if new_status == OrderStatus.SHIPPED:
            location = "In Transit"
            notes = "Order shipped (bulk)"
        elif new_status == OrderStatus.DELIVERED:
            notes = "Order delivered (bulk)"
        elif new_status == OrderStatus.CANCELLED:
            notes = "Order cancelled (bulk)"

        # Create OrderTracking entries in bulk
        from models.order_tracking import OrderTracking

        tracking_entries = [
            OrderTracking(
                order_id=oid, status=new_status, location=location, notes=notes
            )
            for oid in order_ids
        ]
        self.db.add_all(tracking_entries)
        self.db.commit()

        # Publish SSE events for each updated order
        try:
            from core.redis_client import redis_client
            import json as _json

            for entry in tracking_entries:
                oid = entry.order_id
                event_payload = _json.dumps(
                    {
                        "order_id": oid,
                        "tracking_id": entry.id,
                        "status": new_status.value,
                        "location": location,
                        "notes": notes,
                        "timestamp": now.isoformat(),
                    }
                )
                redis_client.client.publish(f"order_updates:{oid}", event_payload)
                redis_client.set_cache(
                    f"order:event:{oid}", _json.loads(event_payload), ttl=60
                )
        except Exception as pub_err:
            logger.warning(f"Failed to publish bulk order status events: {pub_err}")

        return updated

    def cancel_order(
        self, order_id: int, user_id: int, reason: Optional[str] = None
    ) -> Order:
        """
        Cancel order and release inventory.
        Only allowed for PENDING or CONFIRMED orders.
        """
        order = self.get_order_by_id(order_id, user_id=user_id)

        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Order not found"
            )

        # Check if cancellable — only CONFIRMED orders can be cancelled
        if order.status not in [OrderStatus.CONFIRMED]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot cancel order with status {order.status.value}",
            )

        # Release inventory back to stock
        failed_restores = []
        for item in order.items:
            if item.sku:
                # Add quantity back to inventory
                try:
                    self.inventory_service.adjust_stock(
                        item.sku, item.quantity, f"Order #{order_id} cancelled"
                    )
                except Exception as e:
                    failed_restores.append({"sku": item.sku, "error": str(e)})

        # Update order status
        order.status = OrderStatus.CANCELLED
        order.cancelled_at = ist_naive()
        order.cancellation_reason = reason or "Cancelled by user"

        self.db.commit()
        self.db.refresh(order)

        return order

    def get_all_orders(
        self, status: Optional[OrderStatus] = None, skip: int = 0, limit: int = 50
    ) -> List[Order]:
        """Get all orders with optional status filter (admin). Eager loads items + user info."""
        query = self.db.query(Order).options(selectinload(Order.items))

        if status:
            query = query.filter(Order.status == status)

        orders = query.order_by(desc(Order.created_at)).offset(skip).limit(limit).all()

        if not orders:
            return orders

        # Batch fetch all user IDs to avoid N+1 queries
        user_ids = list(set(order.user_id for order in orders if order.user_id))

        # Fetch all users in one query
        users = self.db.query(User).filter(User.id.in_(user_ids)).all()
        user_map = {user.id: user for user in users}

        # Enrich orders with customer info using pre-fetched data
        for order in orders:
            user = user_map.get(order.user_id)
            if user:
                if getattr(user, 'full_name', None):
                    order.customer_name = user.full_name
                else:
                    order.customer_name = user.username
                order.customer_email = user.email

        return orders

    # ==================== Payment Integration ====================

    async def initiate_payment(
        self, order_id: int, payment_method: str = "razorpay", auth_token: str = None
    ) -> Dict[str, Any]:
        """
        Initiate payment for an order via Payment service.

        Args:
            order_id: Order ID
            payment_method: Payment method (razorpay)
            auth_token: JWT token for authentication

        Returns:
            Payment details including payment gateway response
        """
        if not PAYMENT_CLIENT_AVAILABLE:
            logger.error(
                "Payment service client not available - cannot initiate payment"
            )
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Payment service unavailable",
            )

        order = self.get_order_by_id(order_id)
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Order not found"
            )

        if order.status != OrderStatus.CONFIRMED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot initiate payment for order with status {order.status.value}",
            )

        try:
            client = PaymentServiceClient()
            async with client:
                payment = await client.create_payment(
                    order_id=order_id,
                    amount=float(order.total_amount),
                    currency="INR",
                    payment_method=payment_method,
                    auth_token=auth_token,
                )

            logger.info(
                f"Payment initiated for order {order_id}: {payment.get('payment_id')}"
            )
            return payment

        except ServiceError as e:
            logger.error(f"Payment service error: {e}")
            raise HTTPException(
                status_code=e.status_code, detail=f"Payment service error: {e.message}"
            )

    async def verify_payment(
        self, order_id: int, payment_id: str, auth_token: str = None
    ) -> Dict[str, Any]:
        """
        Verify payment status and update order.

        Args:
            order_id: Order ID
            payment_id: Payment ID from gateway
            auth_token: JWT token for authentication

        Returns:
            Updated order and payment status
        """
        if not PAYMENT_CLIENT_AVAILABLE:
            logger.error("Payment service client not available - cannot verify payment")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Payment service unavailable",
            )

        order = self.get_order_by_id(order_id)
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Order not found"
            )

        try:
            client = PaymentServiceClient()
            async with client:
                payment = await client.verify_payment(payment_id, auth_token=auth_token)

            # If payment is captured, update order status
            if payment.get("status") == "captured":
                order.status = OrderStatus.CONFIRMED
                order.transaction_id = payment_id
                self.db.commit()
                self.db.refresh(order)
                logger.info(f"Order {order_id} confirmed after payment verification")

            return {
                "verified": payment.get("status") == "captured",
                "order_id": order_id,
                "payment_status": payment.get("status"),
                "order_status": order.status.value,
            }

        except ServiceError as e:
            logger.error(f"Payment verification error: {e}")
            raise HTTPException(
                status_code=e.status_code,
                detail=f"Payment verification failed: {e.message}",
            )

    async def process_refund(
        self,
        order_id: int,
        amount: Optional[float] = None,
        reason: str = None,
        auth_token: str = None,
    ) -> Dict[str, Any]:
        """
        Process refund for a cancelled/returned order.

        Args:
            order_id: Order ID
            amount: Refund amount (defaults to full order amount)
            reason: Refund reason
            auth_token: JWT token for authentication

        Returns:
            Refund details
        """
        if not PAYMENT_CLIENT_AVAILABLE:
            logger.error("Payment service client not available - cannot process refund")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Payment service unavailable",
            )

        order = self.get_order_by_id(order_id)
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Order not found"
            )

        if order.status not in [OrderStatus.CANCELLED, OrderStatus.RETURNED]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Refund only allowed for cancelled or returned orders",
            )

        if not order.transaction_id:
            logger.warning(
                f"Order {order_id} has no transaction ID - may be offline payment"
            )
            return {
                "refund_id": None,
                "order_id": order_id,
                "amount": amount or float(order.total_amount),
                "status": "not_applicable",
                "message": "No online payment found for this order",
            }

        try:
            client = PaymentServiceClient()
            async with client:
                refund = await client.refund_payment(
                    payment_id=order.transaction_id,
                    amount=amount,
                    reason=reason,
                    auth_token=auth_token,
                )

            # Update order status to refunded
            order.status = OrderStatus.REFUNDED
            self.db.commit()
            self.db.refresh(order)

            logger.info(f"Refund processed for order {order_id}")
            return refund

        except ServiceError as e:
            logger.error(f"Refund processing error: {e}")
            raise HTTPException(
                status_code=e.status_code,
                detail=f"Refund processing failed: {e.message}",
            )

    async def get_payment_status(
        self, order_id: int, auth_token: str = None
    ) -> Dict[str, Any]:
        """
        Get payment status for an order.

        Args:
            order_id: Order ID
            auth_token: JWT token for authentication

        Returns:
            Payment status details
        """
        if not PAYMENT_CLIENT_AVAILABLE:
            return {
                "order_id": order_id,
                "payment_status": "unknown",
                "message": "Payment service not available",
            }

        order = self.get_order_by_id(order_id)
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Order not found"
            )

        if not order.transaction_id:
            return {
                "order_id": order_id,
                "payment_status": "pending",
                "message": "No payment initiated for this order",
            }

        try:
            client = PaymentServiceClient()
            async with client:
                payment = await client.get_payment(
                    order.transaction_id, auth_token=auth_token
                )

            return {
                "order_id": order_id,
                "payment_id": order.transaction_id,
                "payment_status": payment.get("status"),
                "amount": payment.get("amount"),
                "payment_method": payment.get("payment_method"),
                "created_at": payment.get("created_at"),
            }

        except ServiceError as e:
            logger.error(f"Get payment status error: {e}")
            return {
                "order_id": order_id,
                "payment_status": "error",
                "message": str(e.message),
            }

    # ==================== Email Notifications (delegated to Core via HTTP) ====================

    def _send_order_confirmation_email(self, order: Order, user_id: int) -> bool:
        """Send order confirmation email to customer (Core SMTP)."""
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user or not user.email:
            logger.warning(f"No email found for user {user_id}")
            return False
        return _core_notify.notify_order_confirmation_email(order, user)

    def _send_order_shipped_email(
        self, order: Order, tracking_number: Optional[str] = None
    ) -> bool:
        """Send order shipped notification email."""
        if not tracking_number:
            return False
        user = self.db.query(User).filter(User.id == order.user_id).first()
        if not user or not user.email:
            return False
        return _core_notify.notify_order_shipped_email(order, user, tracking_number)

    def _send_order_delivered_email(self, order: Order) -> bool:
        """Send order delivered notification email."""
        user = self.db.query(User).filter(User.id == order.user_id).first()
        if not user or not user.email:
            return False
        return _core_notify.notify_order_delivered_email(order, user)

    def _send_order_cancelled_email(
        self, order: Order, reason: Optional[str] = None
    ) -> bool:
        """Send order cancelled notification email."""
        user = self.db.query(User).filter(User.id == order.user_id).first()
        if not user or not user.email:
            return False
        return _core_notify.notify_order_cancelled_email(order, user, reason)
