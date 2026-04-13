"""Payment service for handling payment transactions."""
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List
from decimal import Decimal
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
import logging
import json

logger = logging.getLogger(__name__)
from sqlalchemy import and_, or_
import uuid

from core.config import settings
from core.razorpay_client import get_razorpay_client
from models.payment import PaymentTransaction, WebhookEvent
from schemas.payment import (
    PaymentRequest, PaymentResponse, PaymentStatus, PaymentMethod,
    RefundRequest, RefundResponse, RefundStatus, TransactionHistoryRequest
)


def _audit_payment_event(db: Session, event_type: str, success: bool, **kwargs):
    """Log a payment-order event to the payment_order_audit table.

    FIX: Does NOT commit — caller manages transaction lifecycle.
    This prevents partial commits that break the caller's transaction boundary.
    """
    try:
        from sqlalchemy import text
        
        def _serialize_if_needed(value):
            if isinstance(value, (dict, list, tuple)):
                return json.dumps(value, default=str)
            return value

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
        # FIX: Do NOT commit here — let caller manage transaction
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
            transaction_id = f"txn_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:8]}"
            
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
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to create payment transaction: {str(e)}")
            raise HTTPException(status_code=500, detail="Payment processing failed")
    
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
            razorpay_order = razorpay_client.create_order(
                amount=amount_paise,
                currency=request.currency,
                receipt=transaction.transaction_id,
                notes={
                    "order_id": str(request.order_id),
                    "user_id": str(request.user_id),
                    "transaction_id": transaction.transaction_id
                }
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
            raise HTTPException(status_code=500, detail="Payment processing failed")
    
    async def verify_payment(self, transaction_id: str, 
                     razorpay_payment_id: str,
                     razorpay_signature: str) -> PaymentResponse:
        """
        Verify and complete a payment transaction.
        
        Uses SELECT FOR UPDATE to lock the transaction row during verification,
        preventing double-capture from concurrent webhook + client verify calls.
        On success, confirms stock reservation via commerce service.
        On failure, releases the reservation.
        
        Args:
            transaction_id: Transaction ID
            razorpay_payment_id: Razorpay payment ID
            razorpay_signature: Razorpay signature
            
        Returns:
            Payment verification response
        """
        try:
            from sqlalchemy import text
            
            # Lock the transaction row to prevent concurrent verification
            transaction = self.db.query(PaymentTransaction).filter(
                PaymentTransaction.transaction_id == transaction_id
            ).with_for_update(nowait=True).first()
            
            if not transaction:
                raise ValueError("Transaction not found")
            
            if transaction.status != "pending":
                raise ValueError(f"Transaction already {transaction.status}")
            
            # Verify payment signature
            razorpay_client = get_razorpay_client()
            is_valid = razorpay_client.verify_payment(
                transaction.razorpay_order_id,
                razorpay_payment_id,
                razorpay_signature
            )
            
            if not is_valid:
                transaction.status = "failed"
                self.db.commit()
                
                # Release stock reservation on failed verification
                await self._notify_commerce_reservation(
                    transaction.order_id, action="release"
                )
                
                raise ValueError("Invalid payment signature")
            
            # Fetch payment details from Razorpay
            payment_details = razorpay_client.fetch_payment(razorpay_payment_id)
            
            # Update transaction — row is still locked
            transaction.razorpay_payment_id = razorpay_payment_id
            transaction.razorpay_signature = razorpay_signature
            transaction.status = "completed" if payment_details.get("status") == "captured" else "failed"
            transaction.gateway_response = payment_details
            transaction.completed_at = datetime.now(timezone.utc)
            
            self.db.commit()
            
            # Confirm or release stock reservation based on payment outcome
            if transaction.status == "completed":
                await self._notify_commerce_reservation(
                    transaction.order_id, action="confirm"
                )
            else:
                await self._notify_commerce_reservation(
                    transaction.order_id, action="release"
                )
            
            return PaymentResponse(
                success=transaction.status == "completed",
                transaction_id=transaction.transaction_id,
                status=PaymentStatus.COMPLETED if transaction.status == "completed" else PaymentStatus.FAILED,
                message="Payment verified successfully" if transaction.status == "completed" else "Payment verification failed",
                amount=transaction.amount,
                currency=transaction.currency,
                payment_method=PaymentMethod(transaction.payment_method),
                razorpay_payment_id=razorpay_payment_id,
                gateway_response=payment_details
            )
            
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            self.db.rollback()
            logger.error(f"Payment verification failed: {str(e)}")
            raise HTTPException(status_code=500, detail="Payment verification failed")
    
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
            import httpx
            commerce_url = f"http://commerce:5002/api/v1/internal/orders/{order_id}/reservation/{action}"
            internal_secret = getattr(settings, 'INTERNAL_SERVICE_SECRET', None)
            if not internal_secret:
                logger.error("INTERNAL_SERVICE_SECRET not configured - cannot notify commerce service")
                return
            async with httpx.AsyncClient(timeout=10.0) as client:
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
            raise HTTPException(status_code=500, detail="Failed to retrieve payment status")
    
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
            transaction.updated_at = datetime.now(timezone.utc)
            
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
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Refund failed: {str(e)}")
            raise HTTPException(status_code=500, detail="Refund processing failed")
    
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
            raise HTTPException(status_code=500, detail="Failed to retrieve transaction history")

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
            raise HTTPException(status_code=500, detail="Failed to count transaction history")
    
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
            raise HTTPException(status_code=500, detail="Failed to retrieve payment methods")
    
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

            # Idempotency check: Return true if event already processed
            if event_id:
                existing_event = self.db.query(WebhookEvent).filter(WebhookEvent.event_id == event_id).first()
                if existing_event:
                    logger.info(f"Webhook {event_id} already processed. Skipping.")
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
            elif event_info["event_type"] == "payment.failed":
                self._handle_payment_failed(event_info)
            elif event_info["event_type"] == "refund.processed":
                self._handle_refund_processed(event_info)

            # Mark webhook as processed
            webhook_event.processed = True
            webhook_event.processed_at = datetime.now(timezone.utc)
            self.db.commit()

            # AUDIT: Log webhook processed
            _audit_payment_event(
                self.db, event_type="webhook_processed", success=True,
                event_id=event_id,
                razorpay_payment_id=event_info.get("payment_id"),
            )

            return True

        except Exception as e:
            self.db.rollback()
            # AUDIT: Log webhook failure
            try:
                _audit_payment_event(
                    self.db, event_type="webhook_failed", success=False,
                    event_id=webhook_data.get("id"),
                    error_message=str(e),
                    response_data=webhook_data
                )
            except Exception:
                pass

            # Mark webhook as failed
            if 'webhook_event' in locals():
                webhook_event.processing_error = str(e)
                self.db.commit()
            raise Exception(f"Webhook processing failed: {str(e)}")
    
    def _handle_payment_captured(self, event_info: Dict[str, Any]):
        """Handle payment captured webhook event.

        CRITICAL: This method now creates the order in commerce service if it doesn't exist.
        This is the primary reliability mechanism that prevents silent payment failures.
        """
        try:
            payment_id = event_info.get("payment_id")
            razorpay_order_id = event_info.get("order_id")
            amount_paise = event_info.get("amount")
            qr_code_id = event_info.get("qr_code_id")

            # Serialize with client verify: lock the transaction row while applying capture.
            # FIX: Use nowait=True to fail fast if another webhook holds the lock (prevents timeout cascade).
            # Session uses autocommit=False (see payment database.SessionLocal) so FOR UPDATE applies.
            transaction = None
            if razorpay_order_id:
                transaction = (
                    self.db.query(PaymentTransaction)
                    .filter(PaymentTransaction.razorpay_order_id == razorpay_order_id)
                    .with_for_update(nowait=True)
                    .first()
                )
            if not transaction and payment_id:
                transaction = (
                    self.db.query(PaymentTransaction)
                    .filter(PaymentTransaction.razorpay_payment_id == payment_id)
                    .with_for_update(nowait=True)
                    .first()
                )

            # For QR code payments, payment_id may not be available initially
            if not transaction:
                if amount_paise:
                    amount_rupees = Decimal(str(amount_paise)) / Decimal('100')
                    query = self.db.query(PaymentTransaction).filter(
                        PaymentTransaction.status == "pending",
                        PaymentTransaction.payment_method == "upi_qr",
                        PaymentTransaction.amount == amount_rupees,
                    )
                    if qr_code_id:
                        query = query.filter(PaymentTransaction.razorpay_qr_code_id == qr_code_id)
                    transaction = (
                        query.with_for_update(nowait=True)
                        .order_by(PaymentTransaction.created_at.desc())
                        .first()
                    )

            if transaction and transaction.status != "pending":
                logger.info(
                    "[Webhook] payment.captured skipped — already %s for %s",
                    transaction.status,
                    transaction.transaction_id,
                )
                # Commit the webhook_event (added by caller) before returning.
                # The with_for_update() SELECT is rolled back by a new session,
                # but we must NOT roll back the webhook_event here.
                try:
                    self.db.commit()
                except Exception:
                    self.db.rollback()
                return

            if transaction and transaction.status == "pending":
                transaction.status = "completed"
                transaction.completed_at = datetime.now(timezone.utc)
                transaction.gateway_response = event_info
                if payment_id:
                    transaction.razorpay_payment_id = payment_id
                self.db.commit()

                # CRITICAL: Create order in commerce service via internal endpoint
                # This guarantees order creation even if the frontend checkout flow failed
                self._create_order_from_webhook(transaction, event_info)

        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to handle payment capture: {str(e)}")
            raise HTTPException(status_code=500, detail="Payment capture handling failed")

    def _create_order_from_webhook(self, transaction: PaymentTransaction, event_info: Dict[str, Any]):
        """Create order in commerce service when webhook confirms payment.

        This is the CRITICAL reliability path that prevents silent failures.
        When payment succeeds but the frontend never called the order creation endpoint,
        this method creates the order directly via the commerce service internal API.

        FIX: Fetches cart data from commerce service before creating order to ensure
        proper cart_snapshot and shipping_address are included.
        """
        try:
            import httpx
            import os

            commerce_url = os.getenv("COMMERCE_SERVICE_URL", "http://commerce:5002")
            internal_secret = os.getenv("INTERNAL_SERVICE_SECRET")

            if not internal_secret:
                logger.error("INTERNAL_SERVICE_SECRET not configured — cannot create order from webhook")
                return

            # FIX: Fetch cart from commerce service to get actual items + shipping address
            cart_snapshot = []
            shipping_address = ""
            try:
                with httpx.Client(timeout=15.0) as client:
                    cart_response = client.get(
                        f"{commerce_url}/api/v1/internal/cart/{transaction.user_id}",
                        headers={"X-Internal-Secret": internal_secret}
                    )
                    if cart_response.status_code == 200:
                        cart_data = cart_response.json()
                        cart_snapshot = cart_data.get("items", []) or cart_data.get("cart_snapshot", [])
                        shipping_address = cart_data.get("shipping_address", "") or ""
                        logger.info(
                            f"WEBHOOK_CART_FETCH: user={transaction.user_id} "
                            f"items={len(cart_snapshot)} shipping={'yes' if shipping_address else 'no'}"
                        )
                    else:
                        logger.warning(
                            f"WEBHOOK_CART_FETCH_FAILED: user={transaction.user_id} "
                            f"status={cart_response.status_code} — using empty cart"
                        )
            except Exception as e:
                logger.warning(f"WEBHOOK_CART_FETCH_ERROR: user={transaction.user_id} error={e} — using empty cart")

            # Build pending_order_data with fetched cart data
            pending_order_data = {
                "cart_snapshot": cart_snapshot,
                "shipping_address": shipping_address,
                "subtotal": float(transaction.amount),
                "total_amount": float(transaction.amount),
                "shipping_cost": 0,
                "gst_amount": 0,
                "cgst_amount": 0,
                "sgst_amount": 0,
                "igst_amount": 0,
                "discount_applied": 0,
                "promo_code": None,
                "order_notes": "Order created from payment webhook",
                "payment_method": transaction.payment_method,
            }

            # Fallback: If cart was empty/failed and we have data in gateway_response, use it
            if not cart_snapshot and transaction.gateway_response and isinstance(transaction.gateway_response, dict):
                if "cart_snapshot" in transaction.gateway_response:
                    pending_order_data["cart_snapshot"] = transaction.gateway_response["cart_snapshot"]
                if "shipping_address" in transaction.gateway_response:
                    pending_order_data["shipping_address"] = transaction.gateway_response["shipping_address"]

            payload = {
                "user_id": transaction.user_id,
                "payment_id": transaction.razorpay_payment_id or event_info.get("payment_id"),
                "razorpay_order_id": transaction.razorpay_order_id or event_info.get("order_id"),
                "payment_signature": transaction.razorpay_signature or "",
                "amount": float(transaction.amount),
                "pending_order_data": pending_order_data,
            }

            logger.info(
                f"WEBHOOK_ORDER_CREATE: calling commerce internal endpoint "
                f"user={transaction.user_id} payment={payload['payment_id']}"
            )

            with httpx.Client(timeout=30.0) as client:
                response = client.post(
                    f"{commerce_url}/api/v1/orders/internal/orders/create-from-payment",
                    json=payload,
                    headers={"X-Internal-Secret": internal_secret}
                )

                if response.status_code == 200:
                    result = response.json()
                    order_id = result.get("order_id")
                    logger.info(
                        f"✓ WEBHOOK_ORDER_CREATED: order_id={order_id} "
                        f"payment_id={payload['payment_id']}"
                    )
                    # Update transaction with order_id
                    transaction.order_id = order_id
                    self.db.commit()

                    # AUDIT: Log successful order creation from webhook
                    _audit_payment_event(
                        self.db, event_type="order_created_from_webhook", success=True,
                        razorpay_payment_id=payload['payment_id'],
                        razorpay_order_id=payload.get('razorpay_order_id'),
                        user_id=transaction.user_id,
                        order_id=order_id,
                        transaction_id=transaction.transaction_id,
                        amount=float(transaction.amount),
                        response_data=result
                    )
                else:
                    logger.error(
                        f"✗ WEBHOOK_ORDER_CREATE_FAILED: status={response.status_code} "
                        f"body={response.text[:500]} payment_id={payload['payment_id']}"
                    )
                    # AUDIT: Log failed order creation
                    _audit_payment_event(
                        self.db, event_type="order_creation_failed", success=False,
                        razorpay_payment_id=payload['payment_id'],
                        user_id=transaction.user_id,
                        error_message=f"Commerce service returned {response.status_code}",
                        error_details={"status": response.status_code, "body": response.text[:1000]},
                    )
                    # Don't raise — transaction is already marked completed
                    # The recovery job will handle this case

        except httpx.TimeoutException:
            logger.error(
                f"✗ WEBHOOK_ORDER_CREATE_TIMEOUT: commerce service did not respond "
                f"payment_id={transaction.razorpay_payment_id}"
            )
            _audit_payment_event(
                self.db, event_type="order_creation_timeout", success=False,
                razorpay_payment_id=transaction.razorpay_payment_id,
                user_id=transaction.user_id,
                error_message="Commerce service timeout",
            )
        except Exception as e:
            logger.error(
                f"✗ WEBHOOK_ORDER_CREATE_ERROR: {str(e)} "
                f"payment_id={transaction.razorpay_payment_id}",
                exc_info=True
            )
            _audit_payment_event(
                self.db, event_type="order_creation_error", success=False,
                razorpay_payment_id=transaction.razorpay_payment_id,
                user_id=transaction.user_id,
                error_message=str(e),
            )
            # Don't raise — transaction is already completed
            # Recovery job will handle order creation
    
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
                self.db.commit()
                
        except Exception as e:
            logger.error(f"Failed to handle payment failed: {str(e)}")
            raise HTTPException(status_code=500, detail="Payment failure handling failed")
    
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
                self.db.commit()

        except Exception as e:
            logger.error(f"Failed to handle refund processed: {str(e)}")
            raise HTTPException(status_code=500, detail="Refund processing handling failed")

    def process_cashfree_webhook(self, webhook_data: Dict[str, Any]) -> bool:
        """
        Process webhook event from Cashfree.
        
        Args:
            webhook_data: Webhook event data
            
        Returns:
            True if processed successfully
        """
        try:
            event_id = webhook_data.get("order_id") or webhook_data.get("id")
            
            # Idempotency check
            if event_id:
                existing_event = self.db.query(WebhookEvent).filter(
                    WebhookEvent.event_id == event_id
                ).first()
                if existing_event:
                    logger.info(f"Cashfree webhook {event_id} already processed. Skipping.")
                    return True
            
            # Log webhook event
            webhook_event = WebhookEvent(
                gateway="cashfree",
                event_type=webhook_data.get("event", "") or webhook_data.get("order_status", ""),
                event_id=event_id,
                payload=webhook_data,
                processed=False
            )
            
            self.db.add(webhook_event)
            self.db.flush()
            
            # Process based on order status
            order_status = webhook_data.get("order_status", "")
            
            if order_status in ["PAID", "CAPTURED"]:
                self._handle_cashfree_payment_captured(webhook_data)
            elif order_status in ["FAILED", "CANCELLED"]:
                self._handle_cashfree_payment_failed(webhook_data)
            
            # Mark webhook as processed
            webhook_event.processed = True
            webhook_event.processed_at = datetime.now(timezone.utc)
            self.db.commit()
            
            return True
            
        except Exception as e:
            self.db.rollback()
            if 'webhook_event' in locals():
                webhook_event.processing_error = str(e)
                self.db.commit()
            logger.error(f"Cashfree webhook processing failed: {e}")
            raise Exception(f"Cashfree webhook processing failed: {str(e)}")
    
    def _handle_cashfree_payment_captured(self, webhook_data: Dict[str, Any]):
        """Handle Cashfree payment captured webhook event."""
        try:
            order_id = webhook_data.get("order_id")
            
            # Find transaction by Cashfree order ID
            transaction = self.db.query(PaymentTransaction).filter(
                PaymentTransaction.cashfree_order_id == order_id
            ).first()
            
            if transaction and transaction.status == "pending":
                transaction.status = "completed"
                transaction.completed_at = datetime.now(timezone.utc)
                transaction.gateway_response = webhook_data
                self.db.commit()
                logger.info(f"✓ Cashfree payment captured: order={order_id}")
                
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to handle Cashfree payment captured: {e}")
    
    def _handle_cashfree_payment_failed(self, webhook_data: Dict[str, Any]):
        """Handle Cashfree payment failed webhook event."""
        try:
            order_id = webhook_data.get("order_id")
            
            # Find transaction by Cashfree order ID
            transaction = self.db.query(PaymentTransaction).filter(
                PaymentTransaction.cashfree_order_id == order_id
            ).first()
            
            if transaction and transaction.status == "pending":
                transaction.status = "failed"
                transaction.gateway_response = webhook_data
                self.db.commit()
                logger.warning(f"✗ Cashfree payment failed: order={order_id}")
                
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to handle Cashfree payment failed: {e}")
