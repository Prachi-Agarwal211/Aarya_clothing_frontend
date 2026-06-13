"""Payment service for handling payment transactions."""
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List

from shared.time_utils import ist_naive
from decimal import Decimal
from sqlalchemy.orm import Session
import logging
import json
import os
import uuid
import httpx
import threading

logger = logging.getLogger(__name__)
from sqlalchemy import and_, or_

# ── Shared HTTP clients for service-to-service calls ──
# Reuses TCP connections across requests (HTTP keepalive). Avoids the
# overhead of creating a new connection pool per call (which matters when
# the webhook handler fires 500+ times in rapid succession).
#
# THREAD-SAFETY: httpx.Client is NOT thread-safe. Uvicorn workers handle
# concurrent requests via asyncio, so we use thread-local storage for
# the sync client to ensure each thread gets its own instance.
_http_async_client: httpx.AsyncClient | None = None
_http_thread_local = threading.local()


def _get_http_client() -> httpx.Client:
    """Get or create a thread-local synchronous HTTP client.

    Uses threading.local() so each thread (uvicorn worker thread) gets
    its own httpx.Client instance, avoiding thread-safety issues.
    """
    client = getattr(_http_thread_local, 'client', None)
    if client is None or client.is_closed:
        client = httpx.Client(
            timeout=httpx.Timeout(30.0, connect=5.0),
            limits=httpx.Limits(
                max_connections=50,
                max_keepalive_connections=20,
                keepalive_expiry=30,
            ),
        )
        _http_thread_local.client = client
    return client


def _get_http_async_client() -> httpx.AsyncClient:
    """Get or create a shared async HTTP client.

    httpx.AsyncClient is async-safe, so a single shared instance is fine.
    Timeout is 30s to match sync client (order creation can take 30s+).
    """
    global _http_async_client
    if _http_async_client is None or _http_async_client.is_closed:
        _http_async_client = httpx.AsyncClient(
            timeout=httpx.Timeout(30.0, connect=5.0),
            limits=httpx.Limits(
                max_connections=50,
                max_keepalive_connections=20,
                keepalive_expiry=30,
            ),
        )
    return _http_async_client

from core.config import settings
from core.razorpay_client import get_razorpay_client
from models.payment import PaymentTransaction, WebhookEvent
from schemas.payment import (
    PaymentRequest, PaymentResponse, PaymentStatus, PaymentMethod,
    RefundRequest, RefundResponse, RefundStatus, TransactionHistoryRequest
)
from exception_handler import (
    InvalidSignatureError, TransactionNotFoundError, OrderCreationError,
    PaymentGatewayException, TransactionException, WebhookException,
    DatabaseException,
)


# ==================== Payment-Audit & Checkout-Metadata Helpers ====================


def _preserve_checkout_meta(transaction, new_gateway_response):
    """
    Preserve critical checkout metadata (pending_order_id, cart_snapshot, shipping_address)
    before overwriting gateway_response with a webhook event.

    Webhook events (payment.captured, etc.) don't contain cart snapshot data that was
    set during checkout initiation. This helper extracts that metadata from the old
    gateway_response and re-attaches it under '_checkout_meta' so it survives the
    round-trip through multiple webhook handlers.

    Called from: _handle_payment_captured, _handle_payment_authorized, _handle_order_paid
    """
    preserved_keys = ["pending_order_id", "cart_snapshot", "shipping_address", "created_during"]
    meta = {}
    if isinstance(transaction.gateway_response, dict):
        for key in preserved_keys:
            if key in transaction.gateway_response:
                meta[key] = transaction.gateway_response[key]
        # Recurse into existing _checkout_meta (multiple handler passes)
        existing = transaction.gateway_response.get("_checkout_meta", {})
        if isinstance(existing, dict):
            for key in preserved_keys:
                if key in existing and key not in meta:
                    meta[key] = existing[key]
    transaction.gateway_response = new_gateway_response
    if meta:
        transaction.gateway_response["_checkout_meta"] = meta



def _audit_payment_event(db: Session, event_type: str, success: bool, **kwargs):
    """Log a payment-order event to the payment_order_audit table.

    Uses a separate SAVEPOINT so the INSERT survives caller rollbacks.
    The savepoint is rolled back after use to avoid cluttering the outer transaction.
    """
    try:
        from sqlalchemy import text

        def _serialize_if_needed(value):
            if isinstance(value, (dict, list, tuple)):
                return json.dumps(value, default=str)
            return value

        # Create a savepoint — the audit INSERT will survive a subsequent
        # db.rollback() of the outer transaction.
        savepoint = db.begin_nested()
        try:
            db.execute(text("""
                INSERT INTO payment_order_audit (
                    event_type, event_id, razorpay_order_id, razorpay_payment_id,
                    razorpay_signature, qr_code_id, payment_method, user_id, order_id,
                    pending_order_id, transaction_id, amount, currency, cart_items,
                    shipping_address, success, error_message, error_details, response_data
                ) VALUES (
                    :event_type, :event_id, :razorpay_order_id, :razorpay_payment_id,
                    :razorpay_signature, :qr_code_id, :payment_method, :user_id, :order_id,
                    :pending_order_id, :transaction_id, :amount, :currency, :cart_items,
                    :shipping_address, :success, :error_message, :error_details, :response_data
                )
            """), {
                "event_type": event_type,
                "event_id": kwargs.get("event_id"),
                "razorpay_order_id": kwargs.get("razorpay_order_id"),
                "razorpay_payment_id": kwargs.get("razorpay_payment_id"),
                "razorpay_signature": kwargs.get("razorpay_signature"),
                "qr_code_id": kwargs.get("qr_code_id"),
                "payment_method": kwargs.get("payment_method"),
                "user_id": kwargs.get("user_id"),
                "order_id": kwargs.get("order_id"),
                "pending_order_id": kwargs.get("pending_order_id"),
                "transaction_id": kwargs.get("transaction_id"),
                "amount": kwargs.get("amount"),
                "currency": kwargs.get("currency", "INR"),
                "cart_items": _serialize_if_needed(kwargs.get("cart_items")),
                "shipping_address": kwargs.get("shipping_address"),
                "success": success,
                "error_message": kwargs.get("error_message"),
                "error_details": _serialize_if_needed(kwargs.get("error_details")),
                "response_data": _serialize_if_needed(kwargs.get("response_data")),
            })
            savepoint.commit()  # Commit the savepoint — audit survives outer rollback
        except Exception:
            savepoint.rollback()  # Clean up savepoint on failure
            raise
    except Exception as e:
        logger.error(f"Failed to write audit log: {e}")
        # Don't raise — audit logging should never break the main flow


class PaymentService:
    """Service for handling payment operations."""
    
    def __init__(self, db: Session):
        """Initialize payment service."""
        self.db = db
    
    def create_payment_transaction(self, request: PaymentRequest) -> PaymentResponse:
        """
        Create a new payment transaction.
        
        Args:
            request: Payment request data
            
        Returns:
            Payment response with transaction details
        """
        try:
            # Generate unique transaction ID
            transaction_id = f"txn_{ist_naive().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:8]}"
            
            # Create transaction record
            transaction = PaymentTransaction(
                order_id=request.order_id,
                user_id=request.user_id,
                amount=request.amount,
                currency=request.currency,
                payment_method=request.payment_method.value,
                transaction_id=transaction_id,
                status="pending",
                customer_email=request.customer_email,
                customer_phone=request.customer_phone,
                description=request.description
            )
            
            self.db.add(transaction)
            self.db.flush()
            
            # Process based on payment method
            if request.payment_method == PaymentMethod.RAZORPAY:
                return self._process_razorpay_payment(transaction, request)
            else:
                raise ValueError(f"Payment method {request.payment_method} not supported")
                
        except ValueError as e:
            self.db.rollback()
            raise TransactionException(str(e))
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to create payment transaction: {str(e)}")
            raise PaymentGatewayException("Payment processing failed")
    
    def _process_razorpay_payment(self, transaction: PaymentTransaction, 
                                 request: PaymentRequest) -> PaymentResponse:
        """Process Razorpay payment."""
        try:
            # Convert amount to paise (Razorpay uses smallest currency unit)
            # Use Decimal for precise calculation to avoid floating point errors
            amount_decimal = Decimal(str(request.amount))
            amount_paise = int((amount_decimal * Decimal('100')).quantize(Decimal('1')))
            
            # Create Razorpay order
            razorpay_client = get_razorpay_client()
            
            notes = {
                "order_id": str(request.order_id),
                "user_id": str(request.user_id),
                "transaction_id": transaction.transaction_id
            }

            # If we have a cart snapshot, prepare a pending order in commerce
            if request.cart_snapshot and request.shipping_address:
                try:
                    commerce_url = os.environ.get("COMMERCE_SERVICE_URL", "http://commerce:5002")
                    internal_secret = os.environ.get("INTERNAL_SERVICE_SECRET")
                    
                    prepare_resp = _get_http_client().post(
                        f"{commerce_url}/api/v1/orders/internal/orders/prepare",
                        json={
                            "user_id": request.user_id,
                            "cart_snapshot": request.cart_snapshot,
                            "shipping_address": request.shipping_address,
                            "total_amount": float(request.amount),
                            "subtotal": float(request.notes.get("subtotal", request.amount)) if request.notes else float(request.amount),
                            "discount_applied": float(request.notes.get("discount_applied", 0)) if request.notes else 0,
                            "shipping_cost": float(request.notes.get("shipping_cost", 0)) if request.notes else 0,
                        },
                        headers={"X-Internal-Secret": internal_secret},
                    )
                    if prepare_resp.status_code == 200:
                        pending_data = prepare_resp.json()
                        pending_id = pending_data.get("pending_order_id")
                        notes["pending_order_id"] = str(pending_id)
                        transaction.gateway_response = {"pending_order_id": pending_id}
                        logger.info(f"✓ PENDING_ORDER_PREPARED: id={pending_id} for user={request.user_id}")
                except Exception as e:
                    logger.warning(f"⚠ Failed to prepare pending order: {e}")

            razorpay_order = razorpay_client.create_order(
                amount=amount_paise,
                currency=request.currency,
                receipt=transaction.transaction_id,
                notes=notes
            )
            
            # Update transaction with Razorpay order ID
            transaction.razorpay_order_id = razorpay_order["id"]
            transaction.gateway_response = razorpay_order
            self.db.commit()
            
            return PaymentResponse(
                success=True,
                transaction_id=transaction.transaction_id,
                status=PaymentStatus.PENDING,
                message="Payment order created successfully",
                amount=request.amount,
                currency=request.currency,
                payment_method=request.payment_method,
                razorpay_order_id=razorpay_order["id"],
                gateway_response=razorpay_order
            )
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to process Razorpay payment: {str(e)}")
            raise PaymentGatewayException("Payment processing failed")
    
    async def verify_payment(self, transaction_id: str, 
                     razorpay_payment_id: str,
                     razorpay_signature: str) -> PaymentResponse:
        """
        Verify and complete a payment transaction.

        ARCHITECTURE: Network I/O is performed OUTSIDE the database row lock.
        1. Verify HMAC signature (local computation, no lock)
        2. Fetch payment details from Razorpay API (network, no lock)
        3. Acquire row lock (brief, for status update only)
        4. Notify commerce service (network, after lock released)

        This prevents the database connection pool from being exhausted when
        external APIs experience latency.

        Args:
            transaction_id: Transaction ID
            razorpay_payment_id: Razorpay payment ID
            razorpay_signature: Razorpay signature

        Returns:
            Payment verification response
        """
        # ── Step 1: Find transaction (NO LOCK — read only) ──
        transaction = self.db.query(PaymentTransaction).filter(
            PaymentTransaction.transaction_id == transaction_id
        ).first()

        if not transaction:
            raise TransactionNotFoundError(transaction_id)

        # ── Webhook-first race condition ──
        if transaction.status == "completed":
            logger.info(
                f"VERIFY_ALREADY_COMPLETED: txn={transaction_id} "
                f"payment={razorpay_payment_id} — webhook processed first, returning success"
            )
            return PaymentResponse(
                success=True,
                transaction_id=transaction.transaction_id,
                status=PaymentStatus.COMPLETED,
                message="Payment already verified",
                amount=transaction.amount,
                currency=transaction.currency,
                payment_method=PaymentMethod(transaction.payment_method),
                razorpay_payment_id=transaction.razorpay_payment_id,
                gateway_response=transaction.gateway_response or {},
            )

        if transaction.status != "pending":
            raise TransactionException(f"Transaction already {transaction.status}")

        # ── Step 2: Verify signature (LOCAL HMAC — no network, no lock) ──
        razorpay_client = get_razorpay_client()
        is_valid = razorpay_client.verify_payment(
            transaction.razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        )

        if not is_valid:
            # Brief lock to update failed status
            txn_locked = self.db.query(PaymentTransaction).filter(
                PaymentTransaction.transaction_id == transaction_id
            ).with_for_update(skip_locked=True).first()
            if txn_locked and txn_locked.status == "pending":
                txn_locked.status = "failed"
                self.db.commit()
            await self._notify_commerce_reservation(
                transaction.order_id, action="release"
            )
            raise InvalidSignatureError()

        # ── Step 3: Fetch payment from Razorpay API (NETWORK I/O — NO LOCK) ──
        try:
            payment_details = razorpay_client.fetch_payment(razorpay_payment_id)
        except Exception as e:
            logger.error(f"Failed to fetch payment details from Razorpay: {e}")
            raise PaymentGatewayException(f"Failed to fetch payment: {str(e)}")

        # ── Step 4: Acquire row lock (brief write only) ──
        txn_locked = self.db.query(PaymentTransaction).filter(
            PaymentTransaction.transaction_id == transaction_id
        ).with_for_update(skip_locked=True).first()

        if not txn_locked:
            raise TransactionNotFoundError(transaction_id)

        # Double-check status — webhook may have completed it while we were fetching
        if txn_locked.status == "completed":
            self.db.rollback()  # Release lock
            logger.info(
                f"VERIFY_ALREADY_COMPLETED (after fetch): txn={transaction_id} "
                f"payment={razorpay_payment_id}"
            )
            return PaymentResponse(
                success=True,
                transaction_id=txn_locked.transaction_id,
                status=PaymentStatus.COMPLETED,
                message="Payment already verified",
                amount=txn_locked.amount,
                currency=txn_locked.currency,
                payment_method=PaymentMethod(txn_locked.payment_method),
                razorpay_payment_id=txn_locked.razorpay_payment_id,
                gateway_response=txn_locked.gateway_response or {},
            )

        if txn_locked.status != "pending":
            self.db.rollback()
            raise TransactionException(f"Transaction already {txn_locked.status}")

        # Update transaction — lock held briefly for this write
        txn_locked.razorpay_payment_id = razorpay_payment_id
        txn_locked.razorpay_signature = razorpay_signature
        # Accept both 'captured' AND 'authorized' as successful payments.
        # UPI collect (embedded checkout) sends 'authorized' first, then 'captured'.
        # Rejecting 'authorized' caused money to be taken but orders never created.
        payment_status = payment_details.get("status", "")
        txn_locked.status = "completed" if payment_status in ("captured", "authorized") else "failed"
        txn_locked.gateway_response = payment_details
        txn_locked.completed_at = ist_naive()

        self.db.commit()  # Lock released after commit

        # ── Step 5: Notify commerce (OUTSIDE lock) ──
        if txn_locked.status == "completed":
            await self._notify_commerce_reservation(
                txn_locked.order_id, action="confirm"
            )
        else:
            await self._notify_commerce_reservation(
                txn_locked.order_id, action="release"
            )

        return PaymentResponse(
            success=txn_locked.status == "completed",
            transaction_id=txn_locked.transaction_id,
            status=PaymentStatus.COMPLETED if txn_locked.status == "completed" else PaymentStatus.FAILED,
            message="Payment verified successfully" if txn_locked.status == "completed" else "Payment verification failed",
            amount=txn_locked.amount,
            currency=txn_locked.currency,
            payment_method=PaymentMethod(txn_locked.payment_method),
            razorpay_payment_id=razorpay_payment_id,
            gateway_response=payment_details
        )
    
    async def _notify_commerce_reservation(self, order_id: int, action: str = "confirm"):
        """
        Notify commerce service to confirm or release stock reservation.
        
        This is an internal service-to-service call using async HTTP client
        to avoid blocking the event loop. Includes internal auth secret.
        
        Args:
            order_id: Order ID whose reservation to act on
            action: 'confirm' or 'release'
        """
        try:
            commerce_url = f"http://commerce:5002/api/v1/internal/orders/{order_id}/reservation/{action}"
            internal_secret = getattr(settings, 'INTERNAL_SERVICE_SECRET', None)
            if not internal_secret:
                logger.error("INTERNAL_SERVICE_SECRET not configured - cannot notify commerce service")
                return
            client = _get_http_async_client()
            response = await client.post(
                commerce_url,
                headers={"X-Internal-Secret": internal_secret}
            )
            if response.status_code != 200:
                logger.warning(f"Commerce reservation {action} for order {order_id} returned {response.status_code}")
        except Exception as e:
            logger.error(f"Failed to {action} reservation for order {order_id}: {e}")
            # Don't raise — payment verification should succeed even if this fails
            # The cleanup job will handle orphaned reservations
    
    def get_payment_status(self, transaction_id: str) -> Optional[Dict[str, Any]]:
        """
        Get payment transaction status.
        
        Args:
            transaction_id: Transaction ID
            
        Returns:
            Transaction status details
        """
        try:
            transaction = self.db.query(PaymentTransaction).filter(
                PaymentTransaction.transaction_id == transaction_id
            ).first()
            
            if not transaction:
                return None
            
            return {
                "transaction_id": transaction.transaction_id,
                "order_id": transaction.order_id,
                "user_id": transaction.user_id,
                "amount": float(transaction.amount),
                "currency": transaction.currency,
                "status": transaction.status,
                "payment_method": transaction.payment_method,
                "created_at": transaction.created_at,
                "updated_at": transaction.updated_at,
                "completed_at": transaction.completed_at,
                "razorpay_order_id": transaction.razorpay_order_id,
                "razorpay_payment_id": transaction.razorpay_payment_id,
                "refund_amount": float(transaction.refund_amount) if transaction.refund_amount else None,
                "refund_id": transaction.refund_id,
                "refund_status": transaction.refund_status,
                "refund_reason": transaction.refund_reason
            }
            
        except Exception as e:
            logger.error(f"Failed to get payment status: {str(e)}")
            raise TransactionException("Failed to retrieve payment status")
    
    def refund_payment(self, request: RefundRequest) -> RefundResponse:
        """
        Process a refund for a transaction.
        
        Args:
            request: Refund request
            
        Returns:
            Refund response
        """
        try:
            # Get transaction
            transaction = self.db.query(PaymentTransaction).filter(
                PaymentTransaction.transaction_id == request.transaction_id
            ).first()
            
            if not transaction:
                raise ValueError("Transaction not found")
            
            if transaction.status != "completed":
                raise ValueError("Cannot refund incomplete transaction")
            
            if transaction.refund_status == "completed":
                raise ValueError("Transaction already refunded")
            
            # Determine refund amount
            refund_amount = request.amount if request.amount else transaction.amount
            
            # Process refund with Razorpay
            # Use Decimal for precise calculation to avoid floating point errors
            razorpay_client = get_razorpay_client()
            refund_decimal = Decimal(str(refund_amount))
            refund_paise = int((refund_decimal * Decimal('100')).quantize(Decimal('1')))
            refund_details = razorpay_client.refund_payment(
                transaction.razorpay_payment_id,
                refund_paise
            )
            
            # Update transaction
            transaction.refund_amount = refund_amount
            transaction.refund_id = refund_details["id"]
            transaction.refund_status = refund_details["status"]
            transaction.refund_reason = request.reason
            transaction.status = "refunded"
            transaction.updated_at = ist_naive()
            
            self.db.commit()
            
            return RefundResponse(
                success=True,
                refund_id=refund_details["id"],
                transaction_id=transaction.transaction_id,
                refund_amount=refund_amount,
                status=RefundStatus.COMPLETED if refund_details["status"] == "processed" else RefundStatus.PROCESSING,
                message="Refund processed successfully",
                gateway_response=refund_details
            )
            
        except ValueError as e:
            self.db.rollback()
            raise TransactionException(str(e))
        except Exception as e:
            self.db.rollback()
            logger.error(f"Refund failed: {str(e)}")
            raise PaymentGatewayException("Refund processing failed")
    
    def get_transaction_history(self, request: TransactionHistoryRequest) -> List[Dict[str, Any]]:
        """
        Get transaction history with filters.
        
        Args:
            request: Transaction history request
            
        Returns:
            List of transactions
        """
        try:
            query = self.db.query(PaymentTransaction)
            
            # Apply filters
            if request.user_id:
                query = query.filter(PaymentTransaction.user_id == request.user_id)
            
            if request.order_id:
                query = query.filter(PaymentTransaction.order_id == request.order_id)
            
            if request.status:
                query = query.filter(PaymentTransaction.status == request.status.value)
            
            if request.payment_method:
                query = query.filter(PaymentTransaction.payment_method == request.payment_method.value)
            
            if request.from_date:
                query = query.filter(PaymentTransaction.created_at >= request.from_date)
            
            if request.to_date:
                query = query.filter(PaymentTransaction.created_at <= request.to_date)
            
            # Apply pagination
            transactions = query.order_by(
                PaymentTransaction.created_at.desc()
            ).offset(request.skip).limit(request.limit).all()
            
            return [
                {
                    "transaction_id": t.transaction_id,
                    "order_id": t.order_id,
                    "user_id": t.user_id,
                    "amount": float(t.amount),
                    "currency": t.currency,
                    "status": t.status,
                    "payment_method": t.payment_method,
                    "created_at": t.created_at,
                    "completed_at": t.completed_at,
                    "refund_amount": float(t.refund_amount) if t.refund_amount else None,
                    "refund_status": t.refund_status
                }
                for t in transactions
            ]
            
        except Exception as e:
            logger.error(f"Failed to get transaction history: {str(e)}")
            raise DatabaseException("Failed to retrieve transaction history")

    def count_transaction_history(self, request: TransactionHistoryRequest) -> int:
        """Count total transactions matching the current history filters."""
        try:
            query = self.db.query(PaymentTransaction)

            if request.user_id:
                query = query.filter(PaymentTransaction.user_id == request.user_id)

            if request.order_id:
                query = query.filter(PaymentTransaction.order_id == request.order_id)

            if request.status:
                query = query.filter(PaymentTransaction.status == request.status.value)

            if request.payment_method:
                query = query.filter(PaymentTransaction.payment_method == request.payment_method.value)

            if request.from_date:
                query = query.filter(PaymentTransaction.created_at >= request.from_date)

            if request.to_date:
                query = query.filter(PaymentTransaction.created_at <= request.to_date)

            return query.count()
        except Exception as e:
            logger.error(f"Failed to count transaction history: {str(e)}")
            raise DatabaseException("Failed to count transaction history")
    
    def get_available_payment_methods(self) -> List[Dict[str, Any]]:
        """
        Get available payment methods.
        
        Returns:
            List of available payment methods
        """
        try:
            methods = [
                {
                    "name": "razorpay",
                    "display_name": "Razorpay",
                    "is_active": True,
                    "supported_currencies": ["INR"],
                    "min_amount": Decimal("1.00"),
                    "max_amount": Decimal("100000.00")
                }
            ]
            
            return methods
            
        except Exception as e:
            logger.error(f"Failed to get payment methods: {str(e)}")
            raise DatabaseException("Failed to retrieve payment methods")
    
    def process_webhook_event(self, webhook_data: Dict[str, Any]) -> bool:
        """
        Process webhook event from Razorpay.

        Args:
            webhook_data: Webhook event data

        Returns:
            True if processed successfully
        """
        try:
            event_id = webhook_data.get("id")
            event_type = webhook_data.get("event", "")

            # Fast-path dedup: Redis check avoids DB round-trip for rapid retries.
            # Razorpay retries failed webhooks 3x at 2s intervals.
            if event_id:
                dedup_key = f"webhook:processed:{event_id}"
                try:
                    from core.redis_client import redis_client as _redis
                    if _redis and _redis.get_cache(dedup_key, namespace=""):
                        logger.info(f"Webhook {event_id} already processed (Redis dedup). Skipping.")
                        return True
                    # Mark as processing (30s window — enough for one processing cycle)
                    _redis.set_cache(dedup_key, "1", ttl=30, namespace="")
                except Exception:
                    pass  # Redis unavailable — fall through to DB check

                # DB-level idempotency check (definitive)
                existing_event = self.db.query(WebhookEvent).filter(WebhookEvent.event_id == event_id).first()
                if existing_event:
                    logger.info(f"Webhook {event_id} already processed. Skipping.")
                    # Mark in Redis for future fast-path
                    try:
                        _redis.set_cache(dedup_key, "done", ttl=86400, namespace="")
                    except Exception:
                        pass
                    return True

            # Log webhook event
            webhook_event = WebhookEvent(
                gateway="razorpay",
                event_type=event_type,
                event_id=event_id,
                payload=webhook_data,
                processed=False
            )

            self.db.add(webhook_event)
            self.db.flush()

            # AUDIT: Log webhook received
            _audit_payment_event(
                self.db, event_type="webhook_received", success=True,
                event_id=event_id,
                razorpay_payment_id=webhook_data.get("payload", {}).get("payment", {}).get("id"),
                razorpay_order_id=webhook_data.get("payload", {}).get("payment", {}).get("order_id"),
                response_data=webhook_data
            )

            # Parse event
            razorpay_client = get_razorpay_client()
            event_info = razorpay_client.parse_webhook_event(webhook_data)

            # Process based on event type
            if event_info["event_type"] == "payment.captured":
                self._handle_payment_captured(event_info)
            elif event_info["event_type"] == "payment.authorized":
                self._handle_payment_authorized(event_info)
            elif event_info["event_type"] == "payment.failed":
                self._handle_payment_failed(event_info)
            elif event_info["event_type"] == "order.paid":
                self._handle_order_paid(event_info)
            elif event_info["event_type"] in ["qr_code.created", "qr_code.credited"]:
                self._handle_qr_code_event(event_info)
            elif event_info["event_type"] == "refund.processed":
                self._handle_refund_processed(event_info)

            # Mark webhook as processed
            webhook_event.processed = True
            webhook_event.processed_at = ist_naive()
            self.db.commit()

            # AUDIT: Log webhook processed
            _audit_payment_event(
                self.db, event_type="webhook_processed", success=True,
                event_id=event_id,
                razorpay_payment_id=event_info.get("payment_id"),
            )

            return True

        except Exception as e:
            # AUDIT: Log webhook failure BEFORE rollback — the session is still valid here.
            try:
                _audit_payment_event(
                    self.db, event_type="webhook_failed", success=False,
                    event_id=webhook_data.get("id"),
                    error_message=str(e),
                    response_data=webhook_data
                )
            except Exception:
                pass

            # Now rollback — audit is already written (or failed silently)
            self.db.rollback()

            raise WebhookException(f"Webhook processing failed: {str(e)}")
    
    def _handle_payment_captured(self, event_info: Dict[str, Any]):
        """Handle payment captured webhook event.

        CRITICAL: This is the primary reliability mechanism — creates the order in
        commerce service if it doesn't exist yet.

        ARCHITECTURE: Network I/O (HTTP to commerce) is performed OUTSIDE the
        database row lock to prevent blocking other webhooks.

        Flow:
        1. Find transaction WITHOUT lock (read-only)
        2. Check if order already exists (no lock needed)
        3. If order exists → done (idempotent)
        4. If not → brief lock for status update, commit (releases lock), then HTTP call

        Transaction-finding strategy (in order of reliability):
        1. By razorpay_order_id (most reliable — set at checkout initiation)
        2. By razorpay_payment_id (set after payment completes)
        3. By QR code + amount matching (QR payments where no ID was set)
        """
        try:
            payment_id = event_info.get("payment_id")
            razorpay_order_id = event_info.get("order_id")
            amount_paise = event_info.get("amount")
            qr_code_id = event_info.get("qr_code_id")
            method = event_info.get("method", "")

            # ── Step 1: Find transaction WITHOUT lock (read-only) ──
            # We avoid with_for_update here so we don't hold the lock during
            # any subsequent network I/O. A brief FOR UPDATE is used later
            # only for the status update.
            transaction = None
            if razorpay_order_id:
                transaction = (
                    self.db.query(PaymentTransaction)
                    .filter(PaymentTransaction.razorpay_order_id == razorpay_order_id)
                    .first()
                )

            if not transaction and payment_id:
                transaction = (
                    self.db.query(PaymentTransaction)
                    .filter(PaymentTransaction.razorpay_payment_id == payment_id)
                    .first()
                )

            if not transaction and amount_paise and method == "upi_qr":
                amount_rupees = Decimal(str(amount_paise)) / Decimal('100')
                query = self.db.query(PaymentTransaction).filter(
                    PaymentTransaction.payment_method == "upi_qr",
                    PaymentTransaction.amount == amount_rupees,
                )
                if qr_code_id:
                    query = query.filter(PaymentTransaction.razorpay_qr_code_id == qr_code_id)
                user_id_from_notes = (
                    event_info.get("user_id")
                    or (event_info.get("payload", {}).get("payment", {}).get("entity", {}).get("notes", {}).get("user_id"))
                )
                if user_id_from_notes:
                    query = query.filter(PaymentTransaction.user_id == int(user_id_from_notes))
                transaction = (
                    query.order_by(PaymentTransaction.created_at.desc())
                    .first()
                )

            if not transaction:
                # ── No transaction found — on-the-fly recovery ──
                self._handle_captured_no_transaction(event_info, payment_id, razorpay_order_id, amount_paise, method)
                return

            # ── Step 2: Check if order already exists (no lock needed) ──
            if self._order_exists(transaction):
                logger.info(
                    f"WEBHOOK_ORDER_CHECK: Order exists for txn={transaction.transaction_id} "
                    f"user={transaction.user_id}"
                )
                return

            # ── Step 3: Update transaction status with brief lock, then commit ──
            # Acquire lock ONLY for the status write — this is held for milliseconds.
            txn_locked = (
                self.db.query(PaymentTransaction)
                .filter(PaymentTransaction.id == transaction.id)
                .with_for_update(skip_locked=True)
                .first()
            )
            if not txn_locked:
                logger.warning(f"WEBHOOK: Could not lock transaction {transaction.id} — skip_locked")
                return

            # Double-check: webhook or frontend may have completed it while we fetched
            if txn_locked.status == "completed":
                self.db.rollback()  # Release lock
                if not self._order_exists(transaction):
                    # Status is completed but order doesn't exist — still create it
                    self._create_order_from_webhook(transaction, event_info)
                return

            # Update metadata and status under lock
            if payment_id and not txn_locked.razorpay_payment_id:
                txn_locked.razorpay_payment_id = payment_id
            if razorpay_order_id and not txn_locked.razorpay_order_id:
                txn_locked.razorpay_order_id = razorpay_order_id

            _preserve_checkout_meta(txn_locked, event_info)

            status = event_info.get("status", "captured")
            if status in ["captured", "authorized", "completed"] and txn_locked.status != "completed":
                txn_locked.status = "completed"
                if not txn_locked.completed_at:
                    txn_locked.completed_at = ist_naive()
            elif status in ["failed", "rejected"] and txn_locked.status != "failed":
                txn_locked.status = "failed"

            self.db.commit()  # Lock released after commit

            logger.info(
                f"WEBHOOK_ORDER_CHECK: No order for txn={transaction.transaction_id} "
                f"user={transaction.user_id} — creating from webhook"
            )

            # ── Step 4: Create order OUTSIDE lock (HTTP to commerce, 30s timeout) ──
            try:
                self._create_order_from_webhook(transaction, event_info)
            except OrderCreationError:
                raise
            except Exception as create_err:
                logger.error(f"WEBHOOK_ORDER_CREATE_OUTSIDE_LOCK: {create_err}", exc_info=True)
                raise OrderCreationError(str(create_err))

            # Link payment details to order (best-effort)
            if transaction.order_id:
                self._link_payment_to_order(
                    order_id=transaction.order_id,
                    transaction_id=transaction.transaction_id,
                    razorpay_payment_id=transaction.razorpay_payment_id or event_info.get("payment_id"),
                    razorpay_order_id=transaction.razorpay_order_id or event_info.get("order_id"),
                    payment_method=transaction.payment_method,
                )

        except Exception as e:
            self.db.rollback()
            logger.error(f"WEBHOOK_CAPTURE_FAILED: {str(e)}", exc_info=True)
            raise WebhookException("Payment capture handling failed")

    def _handle_captured_no_transaction(self, event_info, payment_id, razorpay_order_id, amount_paise, method):
        """Handle payment.captured when no transaction record exists — on-the-fly recovery."""
        # FIX: Added 'upi_qr' to method list — QR payments can arrive without a
        # transaction record if the create-qr API call failed to save the transaction.
        if not (payment_id and method in ["upi", "card", "netbanking", "upi_qr"]):
            logger.error(f"WEBHOOK_NO_TRANSACTION: payment_id={payment_id} method={method} — cannot recover")
            return

        logger.warning(
            f"WEBHOOK_NO_TRANSACTION: payment_id={payment_id} order_id={razorpay_order_id} "
            f"method={method} — attempting recovery from webhook data"
        )
        notes = event_info.get("notes", {})
        if isinstance(notes, str):
            try:
                notes = json.loads(notes)
            except Exception:
                notes = {}

        user_id = notes.get("user_id") or event_info.get("user_id")
        if not user_id:
            logger.error(f"WEBHOOK_RECOVER_NO_USER_ID: payment_id={payment_id}")
            return

        user_id = int(user_id)
        from sqlalchemy import text as _text
        user = self.db.execute(
            _text("SELECT id FROM users WHERE id = :user_id"),
            {"user_id": user_id},
        ).fetchone()

        if not user:
            logger.error(f"WEBHOOK_RECOVER_NO_USER: payment_id={payment_id} user_id={user_id}")
            return

        amount_rupees = Decimal(str(amount_paise)) / Decimal('100') if amount_paise else Decimal('0')
        transaction = PaymentTransaction(
            user_id=user_id,
            amount=amount_rupees,
            currency="INR",
            payment_method=method,
            transaction_id=payment_id,
            razorpay_payment_id=payment_id,
            razorpay_order_id=razorpay_order_id,
            status="completed",
            completed_at=ist_naive(),
            gateway_response=event_info,
        )
        self.db.add(transaction)
        self.db.flush()
        logger.info(f"WEBHOOK_RECOVERED_TRANSACTION: txn_id={payment_id} user_id={user_id}")
        self._create_order_from_webhook(transaction, event_info)

    def _handle_payment_authorized(self, event_info: Dict[str, Any]):
        """Handle payment authorized webhook — update transaction AND create order immediately.

        CRITICAL FIX: Embedded checkout (UPI collect) sends 'authorized' webhook FIRST,
        then 'captured' webhook. We must create the order NOW, not wait for 'captured'
        (which may fail or arrive out of order).

        ARCHITECTURE: Same as _handle_payment_captured — find WITHOUT lock,
        brief lock for status update, commit (releases lock), then HTTP call.
        """
        try:
            payment_id = event_info.get("payment_id")
            razorpay_order_id = event_info.get("order_id")
            amount_paise = event_info.get("amount")
            qr_code_id = event_info.get("qr_code_id")
            method = event_info.get("method", "")

            # ── Step 1: Find transaction WITHOUT lock ──
            transaction = None
            if razorpay_order_id:
                transaction = (
                    self.db.query(PaymentTransaction)
                    .filter(PaymentTransaction.razorpay_order_id == razorpay_order_id)
                    .first()
                )
            if not transaction and payment_id:
                transaction = (
                    self.db.query(PaymentTransaction)
                    .filter(PaymentTransaction.razorpay_payment_id == payment_id)
                    .first()
                )
            if not transaction and amount_paise:
                amount_rupees = Decimal(str(amount_paise)) / Decimal('100')
                query = self.db.query(PaymentTransaction).filter(
                    PaymentTransaction.status == "pending",
                    PaymentTransaction.payment_method == "upi_qr",
                    PaymentTransaction.amount == amount_rupees,
                )
                if qr_code_id:
                    query = query.filter(PaymentTransaction.razorpay_qr_code_id == qr_code_id)
                transaction = query.order_by(PaymentTransaction.created_at.desc()).first()

            if not transaction:
                logger.warning(f"WEBHOOK: No transaction found for authorized payment {payment_id}")
                self._recover_transaction_from_razorpay(event_info)
                return

            # ── Step 2: Brief lock for status update, commit (releases lock) ──
            txn_locked = (
                self.db.query(PaymentTransaction)
                .filter(PaymentTransaction.id == transaction.id)
                .with_for_update(skip_locked=True)
                .first()
            )
            if not txn_locked:
                return

            if payment_id and not txn_locked.razorpay_payment_id:
                txn_locked.razorpay_payment_id = payment_id
            if razorpay_order_id and not txn_locked.razorpay_order_id:
                txn_locked.razorpay_order_id = razorpay_order_id
            _preserve_checkout_meta(txn_locked, event_info)
            if txn_locked.status == "pending":
                txn_locked.status = "authorized"
            self.db.commit()  # Lock released

            logger.info(f"WEBHOOK: Payment authorized: {payment_id} txn={txn_locked.transaction_id}")

            # ── Step 3: Create order OUTSIDE lock ──
            # FIX: Added 'wallet' to method list — wallet payments send 'authorized' first,
            # then 'captured'. Without this, wallet payments could be authorized but
            # never create an order if the 'captured' webhook is missed.
            if method in ["upi", "card", "netbanking", "wallet"] and not self._order_exists(transaction):
                logger.info(f"WEBHOOK: Creating order from authorized event for txn={txn_locked.transaction_id} method={method}")
                self._create_order_from_webhook(transaction, event_info)
        except Exception as e:
            self.db.rollback()
            logger.error(f"WEBHOOK_AUTHORIZED_FAILED: {str(e)}")

    def _handle_order_paid(self, event_info: Dict[str, Any]):
        """Handle order.paid webhook — link order to payment AND create order as safety net.

        SAFETY NET: If payment.captured was missed or failed to process,
        this handler ensures the order is still created. This prevents
        the rare scenario where a customer paid but no order was ever created.
        """
        try:
            payment_id = event_info.get("payment_id")
            razorpay_order_id = event_info.get("order_id")
            status = event_info.get("status", "paid")

            # Find existing transaction and update with order info
            transaction = None
            if payment_id:
                transaction = (
                    self.db.query(PaymentTransaction)
                    .filter(PaymentTransaction.razorpay_payment_id == payment_id)
                    .with_for_update(skip_locked=True)
                    .first()
                )
            if not transaction and razorpay_order_id:
                transaction = (
                    self.db.query(PaymentTransaction)
                    .filter(PaymentTransaction.razorpay_order_id == razorpay_order_id)
                    .with_for_update(skip_locked=True)
                    .first()
                )

            if transaction:
                if razorpay_order_id and not transaction.razorpay_order_id:
                    transaction.razorpay_order_id = razorpay_order_id
                _preserve_checkout_meta(transaction, event_info)
                if transaction.status == "pending":
                    transaction.status = "completed"
                    transaction.completed_at = ist_naive()
                elif transaction.status != "completed":
                    transaction.status = "completed"
                    transaction.completed_at = ist_naive()
                self.db.commit()  # Commit status update

                # SAFETY NET: If no order exists yet, create it now
                # This handles the rare case where payment.captured was missed
                if not self._order_exists(transaction):
                    logger.info(
                        f"WEBHOOK_ORDER_PAID_SAFETY: No order for payment={payment_id} "
                        f"— creating from order.paid event"
                    )
                    self._create_order_from_webhook(transaction, event_info)

            logger.info(f"WEBHOOK: Order paid: {razorpay_order_id} payment={payment_id}")
        except Exception as e:
            self.db.rollback()
            logger.error(f"WEBHOOK_ORDER_PAID_FAILED: {str(e)}")

    def _handle_qr_code_event(self, event_info: Dict[str, Any]):
        """Handle QR code created/credited webhook events.

        ARCHITECTURE: Same as _handle_payment_captured — find WITHOUT lock,
        brief lock for status update, commit (releases lock), then HTTP call.
        """
        try:
            qr_code_id = event_info.get("qr_code_id")
            payment_id = event_info.get("payment_id")
            amount_paise = event_info.get("amount")

            if event_info["event_type"] == "qr_code.created":
                # QR code created — just store the qr_code_id
                if qr_code_id:
                    transaction = (
                        self.db.query(PaymentTransaction)
                        .filter(PaymentTransaction.razorpay_qr_code_id == qr_code_id)
                        .first()
                    )
                    if transaction:
                        txn_locked = (
                            self.db.query(PaymentTransaction)
                            .filter(PaymentTransaction.id == transaction.id)
                            .with_for_update(skip_locked=True)
                            .first()
                        )
                        if txn_locked:
                            if not txn_locked.razorpay_qr_code_id:
                                txn_locked.razorpay_qr_code_id = qr_code_id
                            txn_locked.gateway_response = event_info
                            self.db.commit()
                        logger.info(f"WEBHOOK: QR created: {qr_code_id}")

            elif event_info["event_type"] == "qr_code.credited":
                # QR code credited — payment received (equivalent to payment.captured)
                # ── Step 1: Find WITHOUT lock ──
                transaction = None
                if qr_code_id:
                    transaction = (
                        self.db.query(PaymentTransaction)
                        .filter(PaymentTransaction.razorpay_qr_code_id == qr_code_id)
                        .first()
                    )
                if not transaction and payment_id:
                    transaction = (
                        self.db.query(PaymentTransaction)
                        .filter(PaymentTransaction.razorpay_payment_id == payment_id)
                        .first()
                    )
                if not transaction and payment_id and amount_paise:
                    amount_rupees = Decimal(str(amount_paise)) / Decimal('100')
                    transaction = (
                        self.db.query(PaymentTransaction)
                        .filter(
                            PaymentTransaction.status == "pending",
                            PaymentTransaction.payment_method == "upi_qr",
                            PaymentTransaction.amount == amount_rupees,
                        )
                        .order_by(PaymentTransaction.created_at.desc())
                        .first()
                    )

                if not transaction:
                    return

                # ── Step 2: Brief lock for status update, commit (releases lock) ──
                txn_locked = (
                    self.db.query(PaymentTransaction)
                    .filter(PaymentTransaction.id == transaction.id)
                    .with_for_update(skip_locked=True)
                    .first()
                )
                if not txn_locked:
                    return

                if payment_id and not txn_locked.razorpay_payment_id:
                    txn_locked.razorpay_payment_id = payment_id
                txn_locked.gateway_response = event_info
                if txn_locked.status != "completed":
                    txn_locked.status = "completed"
                    txn_locked.completed_at = ist_naive()
                self.db.commit()  # Lock released

                # ── Step 3: Create order OUTSIDE lock ──
                if not self._order_exists(transaction):
                    self._create_order_from_webhook(transaction, event_info)

                logger.info(f"WEBHOOK: QR credited: {qr_code_id} payment={payment_id}")
        except Exception as e:
            self.db.rollback()
            logger.error(f"WEBHOOK_QR_FAILED: {str(e)}")

    def _create_order_from_webhook(self, transaction: PaymentTransaction, event_info: Dict[str, Any]):
        """Create order in commerce service when webhook confirms payment.

        This is the CRITICAL reliability path that prevents silent failures.
        We prioritize the pending_order_id snapshot created during checkout initiation.
        
        FIX: Added idempotency check using razorpay_payment_id to prevent race conditions
        when webhook is called multiple times for the same payment.
        """
        try:
            commerce_url = os.getenv("COMMERCE_SERVICE_URL", "http://commerce:5002")
            internal_secret = os.getenv("INTERNAL_SERVICE_SECRET")

            if not internal_secret:
                logger.error("INTERNAL_SERVICE_SECRET not configured — cannot create order from webhook")
                return

            # CRITICAL FIX: Set transaction_id BEFORE calling commerce for idempotency
            # transaction.transaction_id may be NULL but razorpay_payment_id is always set
            # This ensures commerce service can check for existing order properly
            if not transaction.transaction_id and transaction.razorpay_payment_id:
                transaction.transaction_id = transaction.razorpay_payment_id
                self.db.flush()
                logger.info(f"WEBHOOK: Set transaction_id={transaction.transaction_id} for idempotency")

            # CRITICAL FIX: Check if order already exists before calling commerce
            # This prevents race condition when webhook is called multiple times
            if self._order_exists(transaction):
                order_id = transaction.order_id
                logger.warning(f"WEBHOOK: Order already exists for payment {transaction.razorpay_payment_id}, skipping creation")
                return
            notes = event_info.get("notes", {})
            pending_order_id = notes.get("pending_order_id")

            # Fallback to transaction metadata
            if not pending_order_id and transaction.gateway_response and isinstance(transaction.gateway_response, dict):
                # Check _checkout_meta first (preserved from original gateway_response)
                checkout_meta = transaction.gateway_response.get("_checkout_meta", {})
                if isinstance(checkout_meta, dict):
                    pending_order_id = checkout_meta.get("pending_order_id")
                    if not pending_order_id:
                        # Check nested _checkout_meta (2nd handler preservation)
                        nested_meta = checkout_meta.get("_checkout_meta", {})
                        if isinstance(nested_meta, dict):
                            pending_order_id = nested_meta.get("pending_order_id")
                if not pending_order_id:
                    pending_order_id = transaction.gateway_response.get("pending_order_id")

            # Fallback: If no pending_order_id, try to use snapshot from transaction first (most accurate)
            pending_order_data = {}
            if not pending_order_id and transaction.gateway_response and isinstance(transaction.gateway_response, dict):
                # Check _checkout_meta first (preserved from original gateway_response)
                checkout_meta = transaction.gateway_response.get("_checkout_meta", {})
                if isinstance(checkout_meta, dict):
                    if checkout_meta.get("shipping_address"):
                        checkout_source = checkout_meta
                    else:
                        # Nested _checkout_meta — happens when 2 webhook handlers overwrote
                        nested_meta = checkout_meta.get("_checkout_meta", {})
                        if isinstance(nested_meta, dict) and nested_meta.get("shipping_address"):
                            checkout_source = nested_meta
                        else:
                            checkout_source = transaction.gateway_response
                else:
                    checkout_source = transaction.gateway_response
                if checkout_source.get("shipping_address"):
                    pending_order_data = {
                        "shipping_address": checkout_source.get("shipping_address"),
                        "cart_snapshot": checkout_source.get("cart_snapshot", []),
                        "subtotal": float(transaction.amount),
                        "total_amount": float(transaction.amount),
                        "shipping_cost": 0,
                        "gst_amount": 0,
                        "cgst_amount": 0,
                        "sgst_amount": 0,
                        "igst_amount": 0,
                    }
                    logger.info(f"WEBHOOK: Recovered address from transaction metadata for user {transaction.user_id}")

            # Fallback: If still no address, try to fetch current cart (legacy/failsafe)
            if not pending_order_id and not pending_order_data.get("shipping_address"):
                try:
                    client = _get_http_client()
                    cart_response = client.get(
                        f"{commerce_url}/api/v1/internal/cart/{transaction.user_id}",
                        headers={"X-Internal-Secret": internal_secret}
                    )
                    if cart_response.status_code == 200:
                        cart_data = cart_response.json()
                        pending_order_data = {
                            "cart_snapshot": cart_data.get("items", []),
                            "shipping_address": cart_data.get("shipping_address", ""),
                            "subtotal": float(transaction.amount),
                            "total_amount": float(transaction.amount),
                            "shipping_cost": 0,
                            "gst_amount": 0,
                            "cgst_amount": 0,
                            "sgst_amount": 0,
                            "igst_amount": 0,
                        }
                except Exception as e:
                    logger.warning(f"WEBHOOK_CART_FETCH_ERROR: {e}")

            payload = {
                "user_id": transaction.user_id,
                "payment_id": transaction.razorpay_payment_id or event_info.get("payment_id"),
                "razorpay_order_id": transaction.razorpay_order_id or event_info.get("order_id"),
                "payment_signature": transaction.razorpay_signature or "",
                "amount": float(transaction.amount),
                "pending_order_id": pending_order_id,
                "pending_order_data": pending_order_data,
                "payment_method": transaction.payment_method,
            }

            logger.info(
                f"WEBHOOK_ORDER_CREATE: user={transaction.user_id} payment={payload['payment_id']} pending_id={pending_order_id}"
            )

            client = _get_http_client()
            response = client.post(
                f"{commerce_url}/api/v1/orders/internal/orders/create-from-payment",
                json=payload,
                headers={"X-Internal-Secret": internal_secret}
            )

            if response.status_code == 200:
                result = response.json()
                order_id = result.get("order_id")
                transaction.order_id = order_id
                self.db.flush()
                logger.info(f"✓ WEBHOOK_ORDER_CREATED: order_id={order_id}")
                
                # AUDIT: Log successful order creation from webhook
                _audit_payment_event(
                    self.db, event_type="order_created_from_webhook", success=True,
                    razorpay_payment_id=payload['payment_id'],
                    razorpay_order_id=payload.get('razorpay_order_id'),
                    user_id=transaction.user_id,
                    order_id=order_id,
                    transaction_id=transaction.transaction_id,
                    amount=float(transaction.amount),
                    pending_order_id=pending_order_id,
                    response_data=result
                )
            else:
                logger.error(f"✗ WEBHOOK_ORDER_CREATE_FAILED: {response.text[:500]}")
                # AUDIT: Log failed order creation
                _audit_payment_event(
                    self.db, event_type="order_creation_failed", success=False,
                    razorpay_payment_id=payload['payment_id'],
                    user_id=transaction.user_id,
                    error_message=f"Commerce service returned {response.status_code}",
                    error_details={"status": response.status_code, "body": response.text[:1000]},
                )
                # RAISE so webhook endpoint returns 500 → Razorpay retries
                raise OrderCreationError(
                    f"Commerce service returned {response.status_code}: {response.text[:500]}"
                )
        except OrderCreationError:
            raise
        except Exception as e:
            logger.error(f"✗ WEBHOOK_ORDER_CREATE_ERROR: {str(e)}", exc_info=True)
            _audit_payment_event(
                self.db, event_type="order_creation_error", success=False,
                razorpay_payment_id=transaction.razorpay_payment_id,
                user_id=transaction.user_id,
                error_message=str(e),
            )
            raise OrderCreationError(str(e))
    
    def _handle_payment_failed(self, event_info: Dict[str, Any]):
        """Handle payment failed webhook event."""
        try:
            # Find transaction by Razorpay payment ID
            transaction = self.db.query(PaymentTransaction).filter(
                PaymentTransaction.razorpay_payment_id == event_info.get("payment_id")
            ).first()
            
            if transaction and transaction.status == "pending":
                transaction.status = "failed"
                transaction.gateway_response = event_info
                self.db.flush()
                
        except Exception as e:
            logger.error(f"Failed to handle payment failed: {str(e)}")
            raise WebhookException("Payment failure handling failed")
    
    def _order_exists(self, transaction: PaymentTransaction) -> bool:
        """Check if an order already exists for this transaction.

        Checks multiple possible identifiers to prevent duplicate order creation
        when webhooks arrive before the transaction_id is fully populated.
        """
        try:
            from sqlalchemy import text as _text

            # Try multiple identifiers in a single query
            payment_id = transaction.razorpay_payment_id
            order_id = transaction.razorpay_order_id
            txn_id = transaction.transaction_id

            conditions = []
            params = {}
            if txn_id:
                conditions.append("transaction_id = :txn_id")
                params["txn_id"] = txn_id
            if payment_id:
                conditions.append("razorpay_payment_id = :payment_id")
                params["payment_id"] = payment_id
            if order_id:
                conditions.append("razorpay_order_id = :order_id")
                params["order_id"] = order_id

            if not conditions:
                return False

            sql = f"SELECT 1 FROM orders WHERE {' OR '.join(conditions)} LIMIT 1"
            result = self.db.execute(_text(sql), params).first()
            return result is not None
        except Exception:
            return False

    def _recover_transaction_from_razorpay(self, event_info: Dict[str, Any]) -> None:
        """Recover a missing transaction from Razorpay API (webhook failed to find it)."""
        try:
            from core.razorpay_client import get_razorpay_client
            from shared.time_utils import ist_naive, now_ist
            import os

            payment_id = event_info.get("payment_id")
            if not payment_id:
                return

            razorpay_client = get_razorpay_client()
            payment = razorpay_client.fetch_payment(payment_id)
            if not payment:
                return

            # Try to extract user_id from notes
            notes = payment.get("notes", {})
            user_id = notes.get("user_id")
            if not user_id:
                return

            # Create transaction from Razorpay data
            transaction = PaymentTransaction(
                user_id=int(user_id),
                amount=Decimal(str(payment.get("amount", 0))) / Decimal('100'),
                currency=payment.get("currency", "INR"),
                payment_method=payment.get("method", "razorpay"),
                razorpay_payment_id=payment_id,
                razorpay_order_id=payment.get("order_id"),
                status="completed" if payment.get("status") == "captured" else "authorized",
                completed_at=now_ist() if payment.get("status") == "captured" else None,
                gateway_response={**payment, "recovered": True},
            )
            self.db.add(transaction)
            self.db.flush()
            logger.info(f"✓ RECOVERED transaction from Razorpay: txn={transaction.transaction_id}")
        except Exception as e:
            logger.error(f"✗ Failed to recover transaction: {e}")

    def _link_payment_to_order(
        self,
        order_id: int,
        transaction_id: Optional[str] = None,
        razorpay_payment_id: Optional[str] = None,
        razorpay_order_id: Optional[str] = None,
        payment_method: Optional[str] = None,
    ) -> bool:
        """
        Link payment transaction details to an order via the commerce service.

        Replaces raw SQL ``UPDATE orders`` from the payment service, respecting
        the cross-service boundary. Uses the commerce internal API instead of
        directly modifying the orders table.

        CRITICAL: Does NOT send internal transaction_id to avoid overwriting
        the order's transaction_id which was already set to the Razorpay
        payment_id during order creation. Overwriting it would break the
        frontend polling endpoint (GET /api/v1/orders/by-payment/{payment_id}).

        Args:
            order_id: Commerce order ID
            transaction_id: Internal payment transaction ID (NOT sent to commerce)
            razorpay_payment_id: Razorpay payment ID
            razorpay_order_id: Razorpay order ID
            payment_method: Payment method (e.g., "razorpay")

        Returns:
            True if successful, False otherwise (best-effort)
        """
        if not order_id:
            return False
        try:
            commerce_url = os.environ.get("COMMERCE_SERVICE_URL", "http://commerce:5002")
            internal_secret = os.environ.get("INTERNAL_SERVICE_SECRET")
            if not internal_secret:
                logger.error("INTERNAL_SERVICE_SECRET not configured — cannot link payment to order")
                return False

            payload = {}
            # FIX: Do NOT send internal transaction_id to commerce.
            # The order's transaction_id is already set to the Razorpay payment_id
            # during order creation. Sending the internal txn_id would overwrite it,
            # breaking frontend polling (find_order_by_payment checks transaction_id).
            # if transaction_id:
            #     payload["transaction_id"] = transaction_id
            if razorpay_payment_id:
                payload["razorpay_payment_id"] = razorpay_payment_id
            if razorpay_order_id:
                payload["razorpay_order_id"] = razorpay_order_id
            if payment_method:
                payload["payment_method"] = payment_method

            # If nothing to update, skip the HTTP call
            if not payload:
                return True

            client = _get_http_client()
            response = client.post(
                f"{commerce_url}/api/v1/internal/orders/{order_id}/link-payment-details",
                json=payload,
                headers={"X-Internal-Secret": internal_secret},
            )
            if response.status_code == 200:
                logger.info(
                    f"ORDER_LINKED_PAYMENT: order_id={order_id} "
                    f"payment={razorpay_payment_id} razorpay_order={razorpay_order_id}"
                )
                return True
            else:
                logger.error(
                    f"ORDER_LINK_PAYMENT_FAILED: order_id={order_id} "
                    f"status={response.status_code} response={response.text[:500]}"
                )
                return False
        except Exception as e:
            logger.error(f"ORDER_LINK_PAYMENT_ERROR: order_id={order_id} error={e}")
            return False

    def _handle_refund_processed(self, event_info: Dict[str, Any]):
        """Handle refund processed webhook event."""
        try:
            # Find transaction by refund ID
            transaction = self.db.query(PaymentTransaction).filter(
                PaymentTransaction.refund_id == event_info.get("refund_id")
            ).first()

            if transaction:
                transaction.refund_status = "completed"
                transaction.gateway_response = event_info
                self.db.flush()

        except Exception as e:
            logger.error(f"Failed to handle refund processed: {str(e)}")
            raise WebhookException("Refund processing handling failed")

