"""Order service for managing order operations."""
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import desc
from sqlalchemy.exc import IntegrityError, OperationalError
from fastapi import HTTPException, status
from decimal import Decimal
from datetime import datetime, timezone
import logging

from models.order import Order, OrderItem, OrderStatus
from models.product import Product
from models.inventory import Inventory
from models.address import Address
from models.user import User, UserProfile
from service.inventory_service import InventoryService
from service.cart_service import CartService
from service.promotion_service import PromotionService
from service.customer_activity_logger import log_customer_activity
from schemas.order import OrderCreate, OrderUpdate

logger = logging.getLogger(__name__)

# Order emails: Commerce → HTTP → Core (SMTP + templates live in Core only)
from service import core_notification_client as _core_notify

# Try to import payment service client
try:
    from shared.service_client import PaymentServiceClient, ServiceError
    PAYMENT_CLIENT_AVAILABLE = True
except ImportError:
    PAYMENT_CLIENT_AVAILABLE = False
    logger.warning("Payment service client not available - payment integration disabled")


class OrderService:
    """Service for order management operations."""
    
    def __init__(self, db: Session):
        """Initialize order service."""
        self.db = db
        self.inventory_service = InventoryService(db)
        self.cart_service = CartService(db)
        self.promotion_service = PromotionService(db)
    
    def get_user_orders(
        self,
        user_id: int,
        skip: int = 0,
        limit: int = 50,
        status: Optional[OrderStatus] = None
    ) -> List[Order]:
        """Get all orders for a user with pagination and eager loading."""
        query = self.db.query(Order).options(
            selectinload(Order.items).options(
                joinedload(OrderItem.inventory),
                joinedload(OrderItem.product)  # Load product for image fallback
            )
        ).filter(Order.user_id == user_id)
        if status:
            query = query.filter(Order.status == status)
        return query.order_by(desc(Order.created_at)).offset(skip).limit(limit).all()
    
    def get_order_by_id(self, order_id: int, user_id: Optional[int] = None) -> Optional[Order]:
        """Get order by ID with eager loading to prevent N+1 queries."""
        query = self.db.query(Order).options(
            selectinload(Order.items).options(
                joinedload(OrderItem.product),
                joinedload(OrderItem.inventory)
            ),
            joinedload(Order.shipping_address_ref),
            joinedload(Order.billing_address_ref),
            selectinload(Order.tracking)
        ).filter(Order.id == order_id)
        
        if user_id:
            query = query.filter(Order.user_id == user_id)
        
        return query.first()
    
    def create_order(
        self,
        user_id: int,
        shipping_address: Optional[str] = None,
        address_id: Optional[int] = None,
        promo_code: Optional[str] = None,
        order_notes: Optional[str] = None,
        transaction_id: Optional[str] = None,
        payment_method: str = "razorpay",
        payment_signature: Optional[str] = None,
        razorpay_order_id: Optional[str] = None,
        qr_code_id: Optional[str] = None
    ) -> Order:
        """
        Create order from user's cart.
        """
        # Resolve address
        final_shipping_address = shipping_address
        if address_id:
            address = self.db.query(Address).filter(
                Address.id == address_id,
                Address.user_id == user_id
            ).first()
            if not address:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Address not found"
                )
            
            # Construct address string
            parts = [
                address.full_name,
                address.address_line1,
                address.address_line2,
                f"{address.city}, {address.state} - {address.postal_code}",
                f"Phone: {address.phone}"
            ]
            final_shipping_address = ", ".join([p for p in parts if p])
            
        if not final_shipping_address:
             raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Shipping address is required"
            )

        # Get cart
        cart = self.cart_service.get_cart(user_id)
        
        if not cart.get("items") or len(cart["items"]) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cart is empty"
            )
        
        # Verify Razorpay payment before committing the order.
        # transaction_id = razorpay payment_id (pay_xxx)
        # razorpay_order_id = razorpay order_id (order_xxx)
        # payment_signature = HMAC signature from Razorpay handler
        # qr_code_id = for UPI QR payments (no signature needed, payment already completed)
        if payment_method == "razorpay":
            # For QR code payments, payment is already verified via QR status polling
            # No transaction_id or signature needed — just verify the QR code is paid
            if qr_code_id:
                logger.info(
                    f"PAYMENT_VERIFY_START (QR): user={user_id} "
                    f"qr_code_id={qr_code_id}"
                )
                try:
                    import httpx as _httpx
                    import os as _os
                    payment_service_url = _os.getenv("PAYMENT_SERVICE_URL", "http://payment:5003")
                    resp = _httpx.post(
                        f"{payment_service_url}/api/v1/payments/razorpay/qr-status/{qr_code_id}",
                        timeout=15.0,
                    )
                    if resp.status_code != 200:
                        raise HTTPException(
                            status_code=status.HTTP_402_PAYMENT_REQUIRED,
                            detail="QR payment verification failed"
                        )
                    qr_data = resp.json()
                    qr_status = qr_data.get("status", "")
                    # Razorpay returns "closed" for single-use paid QR codes
                    if qr_status == "closed":
                        qr_status = "paid"
                    if qr_status != "paid":
                        raise HTTPException(
                            status_code=status.HTTP_402_PAYMENT_REQUIRED,
                            detail=f"QR payment not completed. Status: {qr_data.get('status')}"
                        )
                    # Store the Razorpay payment_id from QR status for the transaction record
                    transaction_id = qr_data.get("payment_id") or transaction_id
                    logger.info(
                        f"✓ PAYMENT_VERIFIED (QR): user={user_id} payment_id={transaction_id} "
                        f"qr_code_id={qr_code_id}"
                    )
                except HTTPException:
                    raise
                except Exception as _e:
                    logger.error(
                        f"PAYMENT_VERIFY_ERROR (QR): user={user_id} qr_code_id={qr_code_id} "
                        f"error={str(_e)}",
                        exc_info=True
                    )
                    raise HTTPException(
                        status_code=status.HTTP_402_PAYMENT_REQUIRED,
                        detail="QR payment verification unavailable — cannot create order"
                    )
            else:
                # Standard Razorpay checkout — verify HMAC signature
                if not transaction_id:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Payment ID is required for Razorpay orders"
                    )
                if not payment_signature or not razorpay_order_id:
                    raise HTTPException(
                        status_code=status.HTTP_402_PAYMENT_REQUIRED,
                        detail="Payment signature and Razorpay order ID are required"
                    )

                logger.info(
                    f"PAYMENT_VERIFY_START: user={user_id} payment_id={transaction_id} "
                    f"razorpay_order_id={razorpay_order_id} sig_len={len(payment_signature) if payment_signature else 0}"
                )

                try:
                    import httpx as _httpx
                    import os as _os
                    payment_service_url = _os.getenv("PAYMENT_SERVICE_URL", "http://payment:5003")
                    verify_start = datetime.now(timezone.utc)

                    resp = _httpx.post(
                        f"{payment_service_url}/api/v1/payments/razorpay/verify-signature",
                        json={
                            "razorpay_order_id": razorpay_order_id,
                            "razorpay_payment_id": transaction_id,
                            "razorpay_signature": payment_signature,
                        },
                        timeout=30.0,  # Increased from 10.0 to 30.0 for reliability
                    )

                    verify_duration = (datetime.now(timezone.utc) - verify_start).total_seconds()
                    logger.info(
                        f"PAYMENT_VERIFY_RESPONSE: user={user_id} status={resp.status_code} "
                        f"duration={verify_duration}s response={resp.text[:200]}"
                    )

                    if resp.status_code != 200:
                        logger.error(
                            f"PAYMENT_VERIFY_FAILED: user={user_id} payment_id={transaction_id} "
                            f"status={resp.status_code} response={resp.text[:200]}"
                        )
                        raise HTTPException(
                            status_code=status.HTTP_402_PAYMENT_REQUIRED,
                            detail="Payment verification failed — signature invalid"
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
                        f"error={str(_e)}",
                        exc_info=True
                    )
                    raise HTTPException(
                        status_code=status.HTTP_402_PAYMENT_REQUIRED,
                        detail="Payment verification unavailable — cannot create order"
                    )
        
        # Compute stored_transaction_id BEFORE the idempotency check that uses it
        stored_transaction_id = transaction_id or razorpay_order_id

        # Check for existing order with same transaction_id (idempotency)
        # Row-level lock serializes concurrent duplicate requests for the same payment
        try:
            existing_order = self.db.query(Order).filter(
                Order.transaction_id == stored_transaction_id,
                Order.user_id == user_id
            ).with_for_update(nowait=True).first()
        except OperationalError:
            self.db.rollback()
            existing_order = self.db.query(Order).filter(
                Order.transaction_id == stored_transaction_id,
                Order.user_id == user_id
            ).first()

        if existing_order:
            logger.info(f"Duplicate order attempt detected for user {user_id} with transaction {stored_transaction_id}")
            # Return existing order instead of creating duplicate
            return self.get_order_by_id(existing_order.id)

        # Confirm all reservations are still valid
        try:
            self.cart_service.confirm_cart_for_checkout(user_id)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
        
        # Calculate subtotal from DB prices (never trust cached cart prices)
        # BATCH FIX: Fetch all products & inventories in 2 queries instead of 2*N
        product_ids = [ci["product_id"] for ci in cart["items"]]
        skus = [ci["sku"] for ci in cart["items"] if ci.get("sku")]
        products_map = {
            p.id: p for p in self.db.query(Product).filter(Product.id.in_(product_ids)).all()
        }
        inventory_map = {}
        if skus:
            inventory_map = {
                inv.sku: inv for inv in self.db.query(Inventory).filter(Inventory.sku.in_(skus)).all()
            }

        subtotal = Decimal(0)
        for cart_item in cart["items"]:
            db_inventory = inventory_map.get(cart_item.get("sku"))
            db_product = products_map.get(cart_item["product_id"])
            if not db_product:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Product '{cart_item.get('name', cart_item['product_id'])}' no longer exists"
                )
            authoritative_price = Decimal(str(
                db_inventory.effective_price if db_inventory else float(db_product.price)
            ))
            subtotal += authoritative_price * cart_item["quantity"]
        
        # Apply promotion if provided
        discount_applied = Decimal(0)
        if promo_code:
            validation = self.promotion_service.validate_promotion(
                code=promo_code,
                user_id=user_id,
                order_total=subtotal
            )
            
            if validation["valid"]:
                discount_applied = validation["discount_amount"]
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=validation["message"]
                )
        
        # Retrieve cart GST fields (calculated by CartService._recalculate_cart)
        gst_amount = Decimal(str(cart.get("gst_amount", 0) or 0))
        cgst_amount = Decimal(str(cart.get("cgst_amount", 0) or 0))
        sgst_amount = Decimal(str(cart.get("sgst_amount", 0) or 0))
        igst_amount = Decimal(str(cart.get("igst_amount", 0) or 0))
        delivery_state = cart.get("delivery_state") or ""
        customer_gstin = cart.get("customer_gstin") or None
        
        # Calculate totals including shipping from cart
        shipping_cost = Decimal(str(cart.get("shipping", 0) or 0))
        total_amount = subtotal - discount_applied + shipping_cost + gst_amount
        
        # Generate sequential invoice number: INV-YYYY-NNNNNN
        # Uses a DB sequence — no mid-transaction commit to avoid gaps
        from datetime import datetime as _dt
        from sqlalchemy import text as _text
        year = _dt.now().year

        seq_val = self.db.execute(_text("SELECT nextval('invoice_number_seq')")).scalar()
        invoice_number = f"INV-{year}-{seq_val:06d}"
        
        # All orders start as CONFIRMED immediately.
        # For Razorpay: payment is verified before reaching this point.
        initial_status = OrderStatus.CONFIRMED

        # Create order
        # transaction_id stores the Razorpay payment_id (pay_xxx) — the actual payment identifier.
        # razorpay_order_id (order_xxx) is used only for verification and not stored separately.
        # NOTE: stored_transaction_id was already computed above (before idempotency check).
        order = Order(
            user_id=user_id,
            transaction_id=stored_transaction_id,
            payment_method=payment_method,
            invoice_number=invoice_number,
            subtotal=subtotal,
            discount_applied=discount_applied,
            promo_code=promo_code,
            shipping_cost=shipping_cost,
            gst_amount=gst_amount,
            cgst_amount=cgst_amount,
            sgst_amount=sgst_amount,
            igst_amount=igst_amount,
            place_of_supply=delivery_state,
            customer_gstin=customer_gstin,
            total_amount=total_amount,
            status=initial_status,
            shipping_address=final_shipping_address,
            order_notes=order_notes,
            # Razorpay payment details
            razorpay_order_id=razorpay_order_id,
            razorpay_payment_id=transaction_id if payment_method == "razorpay" else None,
        )
        
        self.db.add(order)
        self.db.flush()  # Get order ID

        # Create order items — reuse already-fetched maps (no additional DB queries)
        for cart_item in cart["items"]:
            product = products_map.get(cart_item["product_id"])
            inventory = inventory_map.get(cart_item.get("sku"))

            order_item = OrderItem(
                order_id=order.id,
                product_id=cart_item["product_id"],
                inventory_id=inventory.id if inventory else None,
                product_name=cart_item["name"],
                sku=cart_item.get("sku"),
                size=inventory.size if inventory else None,
                color=inventory.color if inventory else None,
                hsn_code=cart_item.get("hsn_code") or (product.hsn_code if product else None),
                gst_rate=Decimal(str(cart_item["gst_rate"])) if cart_item.get("gst_rate") else (product.gst_rate if product else None),
                quantity=cart_item["quantity"],
                unit_price=Decimal(cart_item["price"]),
                price=Decimal(cart_item["price"]) * cart_item["quantity"]
            )

            self.db.add(order_item)

            # Atomically deduct stock (SELECT FOR UPDATE — prevents overselling)
            if cart_item.get("sku"):
                self.inventory_service.deduct_stock_for_order(
                    cart_item["sku"],
                    cart_item["quantity"]
                )
        
        # Record promotion usage (promotion row already validated above)
        if promo_code:
            prom = self.promotion_service.get_promotion_by_code(promo_code)
            if prom:
                self.promotion_service.record_usage(
                    promotion_id=prom.id,
                    user_id=user_id,
                    discount_amount=discount_applied,
                    order_id=order.id,
                )

        # Commit everything atomically: order, order_items, stock deductions.
        # IntegrityError: concurrent duplicate submit with same (user_id, transaction_id) —
        # return the other transaction's order (idempotent success).
        try:
            self.db.commit()
            self.db.refresh(order)
        except IntegrityError as ie:
            self.db.rollback()
            logger.warning(
                f"ORDER_CREATE_RACE_RECOVER: user={user_id} transaction={stored_transaction_id} {ie}"
            )
            dup = self.db.query(Order).filter(
                Order.transaction_id == stored_transaction_id,
                Order.user_id == user_id,
            ).first()
            if dup:
                return self.get_order_by_id(dup.id)
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Order could not be placed due to a conflict. Please check your orders or retry.",
            )

        # CRITICAL: Create payment transaction record for audit trail and webhook tracking
        # This ensures we have a complete payment history even if webhooks fail
        if payment_method == "razorpay" and transaction_id:
            try:
                from sqlalchemy import text as _text
                logger.info(
                    f"PAYMENT_TRANSACTION_CREATE: order={order.id} user={user_id} "
                    f"payment_id={transaction_id} order_id={razorpay_order_id}"
                )
                
                # Insert payment transaction record
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
                        "razorpay_payment_id": transaction_id,
                        "signature": payment_signature or "",
                        "transaction_id": transaction_id
                    }
                )
                self.db.commit()
                logger.info(
                    f"✓ PAYMENT_TRANSACTION_CREATED: order={order.id} "
                    f"transaction_id={transaction_id}"
                )
            except Exception as payment_err:
                # Log error but don't fail the order - payment transaction is secondary
                logger.error(
                    f"⚠ FAILED to create payment transaction for order {order.id}: {payment_err}"
                )
                # Don't rollback - order is already committed successfully

        # Cashfree removed — only Razorpay supported

        # For QR payments, the transaction was already created in the payment service
        # with order_id=NULL. Update it with the order_id and mark as completed.
        if qr_code_id:
            try:
                from sqlalchemy import text as _text
                logger.info(
                    f"PAYMENT_TRANSACTION_UPDATE (QR): order={order.id} user={user_id} "
                    f"qr_code_id={qr_code_id} transaction_id={transaction_id}"
                )

                self.db.execute(
                    _text("""
                        UPDATE payment_transactions
                        SET order_id = :order_id,
                            status = 'completed',
                            completed_at = NOW()
                        WHERE razorpay_qr_code_id = :qr_code_id
                          AND status = 'pending'
                    """),
                    {
                        "order_id": order.id,
                        "qr_code_id": qr_code_id,
                    }
                )
                self.db.commit()
                logger.info(
                    f"✓ PAYMENT_TRANSACTION_UPDATED (QR): order={order.id} "
                    f"qr_code_id={qr_code_id}"
                )
            except Exception as payment_err:
                logger.error(
                    f"⚠ FAILED to update QR payment transaction for order {order.id}: {payment_err}"
                )
                # Don't fail the order - transaction update is secondary

        # AFTER commit: Clear Redis cart (best effort, non-critical)
        # Order is already committed with reservations confirmed
        try:
            self.cart_service.clear_cart(user_id, release_reservations=False)
            logger.info(f"✓ Cart cleared for user {user_id} after order {order.id}")
        except Exception as cart_err:
            logger.error(f"⚠ FAILED to clear cart for user {user_id} after order {order.id}: {cart_err}")
            # Add note to order that cart clear failed (for debugging)
            if order.order_notes:
                order.order_notes += f" [Cart clear failed: {str(cart_err)}]"
            else:
                order.order_notes = f"Cart clear failed: {str(cart_err)}"
            self.db.commit()
            # Don't re-throw - order is already committed with reservations confirmed

        # Send order confirmation email (via Core internal API)
        try:
            self._send_order_confirmation_email(order, user_id)
        except Exception as e:
            logger.error(f"Failed to send order confirmation email for order {order.id}: {e}")

        return order
    
    def create_order_from_pending_order(
        self,
        pending_order_data: Dict[str, Any],
        user_id: int,
        payment_id: str,
        razorpay_order_id: Optional[str] = None,
        payment_signature: Optional[str] = None
    ) -> Order:
        """
        Create an order from a pending_order record (called by webhook handler).

        This is the critical recovery path: when payment succeeds but the frontend
        never called the normal order creation endpoint. The webhook handler calls
        this method to guarantee order creation.

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

        # Idempotency: Check if order already exists for this payment — WITH row lock to prevent races
        existing = self.db.query(Order).filter(
            Order.transaction_id == payment_id,
            Order.user_id == user_id
        ).with_for_update(nowait=True).first()
        if existing:
            logger.info(f"Order already exists for payment {payment_id}, returning existing order {existing.id}")
            return existing

        # Also check by razorpay_order_id
        if razorpay_order_id:
            existing_by_razorpay = self.db.query(Order).filter(
                Order.razorpay_order_id == razorpay_order_id,
                Order.user_id == user_id
            ).with_for_update(nowait=True).first()
            if existing_by_razorpay:
                logger.info(f"Order already exists for razorpay_order {razorpay_order_id}, returning {existing_by_razorpay.id}")
                return existing_by_razorpay

        # Extract cart items from pending_order snapshot
        cart_items = pending_order_data.get("cart_snapshot", pending_order_data.get("cart_items", []))

        # Extract order data
        shipping_address = pending_order_data.get("shipping_address")

        subtotal = Decimal(str(pending_order_data.get("subtotal", 0)))
        discount_applied = Decimal(str(pending_order_data.get("discount_applied", 0)))
        shipping_cost = Decimal(str(pending_order_data.get("shipping_cost", 0)))
        gst_amount = Decimal(str(pending_order_data.get("gst_amount", 0)))
        cgst_amount = Decimal(str(pending_order_data.get("cgst_amount", 0)))
        sgst_amount = Decimal(str(pending_order_data.get("sgst_amount", 0)))
        igst_amount = Decimal(str(pending_order_data.get("igst_amount", 0)))
        total_amount = Decimal(str(pending_order_data.get("total_amount", 0)))
        promo_code = pending_order_data.get("promo_code")
        order_notes = pending_order_data.get("order_notes", "")
        delivery_state = pending_order_data.get("delivery_state", "")
        customer_gstin = pending_order_data.get("customer_gstin")

        # RECOVERY PATH: If cart was already cleared, create a minimal order
        # This happens when payment succeeded but order creation failed and cart was cleared
        created_minimal = False
        if not cart_items:
            logger.warning(
                f"RECOVERY_MINIMAL_ORDER: user={user_id} payment={payment_id} "
                f"— no cart items available (cart was cleared). Creating minimal order."
            )
            cart_items = [{
                "product_id": None,
                "name": "Order recovered from payment",
                "price": float(total_amount),
                "quantity": 1,
                "unit_price": float(total_amount),
                "sku": None,
                "size": None,
                "color": None,
                "hsn_code": None,
                "gst_rate": None,
            }]
            created_minimal = True

        if not shipping_address:
            shipping_address = "Address to be confirmed — contact customer support for delivery details"
            if not created_minimal:
                order_notes = f"{order_notes} [ADDRESS MISSING — RECOVERY]".strip()

        # Generate invoice number — no setval/commit, just nextval like normal path
        year = datetime.now().year
        seq_val = self.db.execute(_text("SELECT nextval('invoice_number_seq')")).scalar()
        invoice_number = f"INV-{year}-{seq_val:06d}"

        # Create the order
        order = Order(
            user_id=user_id,
            transaction_id=payment_id,
            payment_method=pending_order_data.get("payment_method", "razorpay"),
            invoice_number=invoice_number,
            subtotal=subtotal,
            discount_applied=discount_applied,
            promo_code=promo_code,
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
            order_notes=f"{order_notes} [CREATED FROM WEBHOOK/RECOVERY]".strip() if order_notes else "[CREATED FROM WEBHOOK/RECOVERY]",
            razorpay_order_id=razorpay_order_id,
            razorpay_payment_id=payment_id,
        )

        self.db.add(order)
        self.db.flush()

        # Create order items from cart snapshot
        for item in cart_items:
            product_id = item.get("product_id")
            sku = item.get("sku")

            # Look up current product/inventory for HSN and GST rate
            product = self.db.query(Product).filter(Product.id == product_id).first() if product_id else None
            inventory = self.db.query(Inventory).filter(Inventory.sku == sku).first() if sku else None

            order_item = OrderItem(
                order_id=order.id,
                product_id=product_id,
                inventory_id=inventory.id if inventory else None,
                product_name=item.get("name", item.get("product_name", "Unknown Product")),
                sku=sku,
                size=item.get("size") or (inventory.size if inventory else None),
                color=item.get("color") or (inventory.color if inventory else None),
                hsn_code=item.get("hsn_code") or (product.hsn_code if product else None),
                gst_rate=Decimal(str(item.get("gst_rate"))) if item.get("gst_rate") else (product.gst_rate if product else None),
                quantity=item.get("quantity", 1),
                unit_price=Decimal(str(item.get("unit_price", item.get("price", 0)))),
                price=Decimal(str(item.get("unit_price", item.get("price", 0)))) * item.get("quantity", 1)
            )
            self.db.add(order_item)

            # Deduct stock if SKU is available
            if sku:
                try:
                    self.inventory_service.deduct_stock_for_order(sku, item.get("quantity", 1))
                except Exception as stock_err:
                    logger.warning(f"Stock deduction failed for SKU {sku}: {stock_err}")
                    # Don't fail the order — stock can be reconciled manually

        self.db.commit()
        self.db.refresh(order)

        # Create payment transaction record
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
                    "transaction_id": payment_id
                }
            )
            self.db.commit()
            logger.info(f"✓ PAYMENT_TRANSACTION_CREATED (webhook): order={order.id} payment={payment_id}")
        except Exception as e:
            logger.error(f"⚠ Failed to create payment transaction (webhook): {e}")

        # Send confirmation email (via Core internal API)
        try:
            self._send_order_confirmation_email(order, user_id)
        except Exception as e:
            logger.error(f"Failed to send webhook order confirmation email for order {order.id}: {e}")

        logger.info(f"✓ ORDER CREATED FROM WEBHOOK/RECOVERY: order_id={order.id} user={user_id} payment={payment_id}")
        return order

    def update_order_status(
        self,
        order_id: int,
        new_status: OrderStatus,
        tracking_number: Optional[str] = None,
        admin_notes: Optional[str] = None
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
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found"
            )
        
        # Validate status transition
        # Simple 4-state machine: CONFIRMED → SHIPPED → DELIVERED, CONFIRMED → CANCELLED
        valid_transitions = {
            OrderStatus.CONFIRMED: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
            OrderStatus.SHIPPED:   [OrderStatus.DELIVERED],
            OrderStatus.DELIVERED: [],  # Terminal — returns handled by Returns module
            OrderStatus.CANCELLED: [],  # Terminal
        }
        
        if new_status not in valid_transitions.get(order.status, []):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot transition from {order.status.value} to {new_status.value}"
            )
        
        # Update status
        order.status = new_status
        
        # Setup timestamps
        now = datetime.now(timezone.utc)
        
        # Determine tracking specific fields
        location = None
        notes = admin_notes
        if new_status == OrderStatus.SHIPPED:
            order.shipped_at = now
            if tracking_number:
                order.tracking_number = tracking_number
            location = "In Transit"
            if not notes:
                notes = f"Order shipped — POD number: {tracking_number}" if tracking_number else "Order shipped"
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
            
            event_payload = _json.dumps({
                "order_id": order_id,
                "tracking_id": tracking_entry.id if tracking_entry else None,
                "status": new_status.value,
                "tracking_number": tracking_number,
                "location": location,
                "notes": notes,
                "timestamp": now.isoformat(),
            })
            # Pub/Sub channel per order — SSE endpoint subscribes to this
            redis_client.client.publish(f"order_updates:{order_id}", event_payload)
            # Also set a cache key as fallback for late-joining SSE clients
            redis_client.set_cache(f"order:event:{order_id}", _json.loads(event_payload), ttl=60)
        except Exception as pub_err:
            logger.warning(f"Failed to publish order status event: {pub_err}")

        # Send email notification based on status (via Core internal API)
        try:
            if new_status == OrderStatus.SHIPPED:
                self._send_order_shipped_email(order, tracking_number)
            elif new_status == OrderStatus.DELIVERED:
                self._send_order_delivered_email(order)
            elif new_status == OrderStatus.CANCELLED:
                self._send_order_cancelled_email(order, admin_notes)
        except Exception as e:
            logger.error(f"Failed to send order status email for order {order_id}: {e}")

        return order
    
    def bulk_update_order_status(
        self,
        order_ids: List[int],
        new_status: OrderStatus
    ) -> int:
        """
        Bulk update order status for multiple orders.
        
        Uses a single UPDATE query for efficiency, then publishes
        Redis SSE events for each updated order.
        
        Returns the number of updated orders.
        """
        if not order_ids:
            return 0
        
        updated = self.db.query(Order).filter(
            Order.id.in_(order_ids)
        ).update(
            {"status": new_status},
            synchronize_session=False
        )
        
        self.db.commit()
        
        # Determine tracking specific fields for bulk
        now = datetime.now(timezone.utc)
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
                order_id=oid,
                status=new_status,
                location=location,
                notes=notes
            ) for oid in order_ids
        ]
        self.db.add_all(tracking_entries)
        self.db.commit()
        
        # Publish SSE events for each updated order
        try:
            from core.redis_client import redis_client
            import json as _json
            
            for entry in tracking_entries:
                oid = entry.order_id
                event_payload = _json.dumps({
                    "order_id": oid,
                    "tracking_id": entry.id,
                    "status": new_status.value,
                    "location": location,
                    "notes": notes,
                    "timestamp": now.isoformat(),
                })
                redis_client.client.publish(f"order_updates:{oid}", event_payload)
                redis_client.set_cache(f"order:event:{oid}", _json.loads(event_payload), ttl=60)
        except Exception as pub_err:
            logger.warning(f"Failed to publish bulk order status events: {pub_err}")
        
        return updated
    
    def cancel_order(self, order_id: int, user_id: int, reason: Optional[str] = None) -> Order:
        """
        Cancel order and release inventory.
        Only allowed for PENDING or CONFIRMED orders.
        """
        order = self.get_order_by_id(order_id, user_id=user_id)
        
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found"
            )
        
        # Check if cancellable — only CONFIRMED orders can be cancelled
        if order.status not in [OrderStatus.CONFIRMED]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot cancel order with status {order.status.value}"
            )
        
        # Release inventory back to stock
        failed_restores = []
        for item in order.items:
            if item.sku:
                # Add quantity back to inventory
                try:
                    self.inventory_service.adjust_stock(
                        item.sku,
                        item.quantity,
                        f"Order #{order_id} cancelled"
                    )
                except Exception as e:
                    failed_restores.append({"sku": item.sku, "error": str(e)})
        
        # Update order status
        order.status = OrderStatus.CANCELLED
        order.cancelled_at = datetime.now(timezone.utc)
        order.cancellation_reason = reason or "Cancelled by user"
        
        self.db.commit()
        self.db.refresh(order)
        
        return order
    
    def get_all_orders(
        self,
        status: Optional[OrderStatus] = None,
        skip: int = 0,
        limit: int = 50
    ) -> List[Order]:
        """Get all orders with optional status filter (admin). Eager loads items + user info."""
        query = self.db.query(Order).options(
            selectinload(Order.items)
        )

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

        # Fetch all user profiles in one query
        profiles = self.db.query(UserProfile).filter(UserProfile.user_id.in_(user_ids)).all()
        profile_map = {profile.user_id: profile for profile in profiles}

        # Enrich orders with customer info using pre-fetched data
        for order in orders:
            user = user_map.get(order.user_id)
            if user:
                profile = profile_map.get(user.id)
                if profile and profile.full_name:
                    order.customer_name = profile.full_name
                else:
                    order.customer_name = user.username
                order.customer_email = user.email

        return orders
    
    # ==================== Payment Integration ====================
    
    async def initiate_payment(
        self,
        order_id: int,
        payment_method: str = "razorpay",
        auth_token: str = None
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
            logger.error("Payment service client not available - cannot initiate payment")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Payment service unavailable"
            )
        
        order = self.get_order_by_id(order_id)
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found"
            )
        
        if order.status != OrderStatus.CONFIRMED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot initiate payment for order with status {order.status.value}"
            )
        
        try:
            client = PaymentServiceClient()
            async with client:
                payment = await client.create_payment(
                    order_id=order_id,
                    amount=float(order.total_amount),
                    currency="INR",
                    payment_method=payment_method,
                    auth_token=auth_token
                )
            
            logger.info(f"Payment initiated for order {order_id}: {payment.get('payment_id')}")
            return payment
            
        except ServiceError as e:
            logger.error(f"Payment service error: {e}")
            raise HTTPException(
                status_code=e.status_code,
                detail=f"Payment service error: {e.message}"
            )
    
    async def verify_payment(
        self,
        order_id: int,
        payment_id: str,
        auth_token: str = None
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
                detail="Payment service unavailable"
            )
        
        order = self.get_order_by_id(order_id)
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found"
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
                "order_status": order.status.value
            }
            
        except ServiceError as e:
            logger.error(f"Payment verification error: {e}")
            raise HTTPException(
                status_code=e.status_code,
                detail=f"Payment verification failed: {e.message}"
            )
    
    async def process_refund(
        self,
        order_id: int,
        amount: Optional[float] = None,
        reason: str = None,
        auth_token: str = None
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
                detail="Payment service unavailable"
            )
        
        order = self.get_order_by_id(order_id)
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found"
            )
        
        if order.status not in [OrderStatus.CANCELLED, OrderStatus.RETURNED]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Refund only allowed for cancelled or returned orders"
            )
        
        if not order.transaction_id:
            logger.warning(f"Order {order_id} has no transaction ID - may be offline payment")
            return {
                "refund_id": None,
                "order_id": order_id,
                "amount": amount or float(order.total_amount),
                "status": "not_applicable",
                "message": "No online payment found for this order"
            }
        
        try:
            client = PaymentServiceClient()
            async with client:
                refund = await client.refund_payment(
                    payment_id=order.transaction_id,
                    amount=amount,
                    reason=reason,
                    auth_token=auth_token
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
                detail=f"Refund processing failed: {e.message}"
            )
    
    async def get_payment_status(
        self,
        order_id: int,
        auth_token: str = None
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
                "message": "Payment service not available"
            }
        
        order = self.get_order_by_id(order_id)
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found"
            )
        
        if not order.transaction_id:
            return {
                "order_id": order_id,
                "payment_status": "pending",
                "message": "No payment initiated for this order"
            }
        
        try:
            client = PaymentServiceClient()
            async with client:
                payment = await client.get_payment(order.transaction_id, auth_token=auth_token)
            
            return {
                "order_id": order_id,
                "payment_id": order.transaction_id,
                "payment_status": payment.get("status"),
                "amount": payment.get("amount"),
                "payment_method": payment.get("payment_method"),
                "created_at": payment.get("created_at")
            }

        except ServiceError as e:
            logger.error(f"Get payment status error: {e}")
            return {
                "order_id": order_id,
                "payment_status": "error",
                "message": str(e.message)
            }

    # ==================== Email Notifications (delegated to Core via HTTP) ====================

    def _send_order_confirmation_email(self, order: Order, user_id: int) -> bool:
        """Send order confirmation email to customer (Core SMTP)."""
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user or not user.email:
            logger.warning(f"No email found for user {user_id}")
            return False
        return _core_notify.notify_order_confirmation_email(order, user)

    def _send_order_shipped_email(self, order: Order, tracking_number: Optional[str] = None) -> bool:
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

    def _send_order_cancelled_email(self, order: Order, reason: Optional[str] = None) -> bool:
        """Send order cancelled notification email."""
        user = self.db.query(User).filter(User.id == order.user_id).first()
        if not user or not user.email:
            return False
        return _core_notify.notify_order_cancelled_email(order, user, reason)
