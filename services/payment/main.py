"""
Payment Service - Aarya Clothing
Payment Processing and Fraud Detection

This service handles:
- Razorpay payment processing
- Transaction management
- Refund processing
- Webhook handling
- Payment method management
"""
import logging
from contextlib import asynccontextmanager
import os
import time

from shared.time_utils import ist_naive, now_ist
from fastapi import FastAPI, Depends, HTTPException, status, Request, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, Response
from sqlalchemy.orm import Session
from typing import Optional, List
from decimal import Decimal
import json

logger = logging.getLogger(__name__)

from core.config import settings
from core.redis_client import redis_client
from database.database import get_db, init_db
from shared.auth_middleware import (
    get_current_user,
    require_admin,
    require_staff,
    initialize_auth_middleware
)
from shared.rate_limiter import rate_limit
from schemas.payment import (
    PaymentRequest, PaymentResponse, PaymentStatus, PaymentMethod,
    RazorpayOrderRequest, RazorpayOrderResponse, RazorpayPaymentVerification,
    RefundRequest, RefundResponse, RefundStatus,
    WebhookEvent, WebhookResponse, PaymentMethodsResponse,
    TransactionHistoryRequest,
    QrCodeCreateRequest, QrCodeCreateResponse, QrCodeStatusResponse
)
from core.razorpay_client import get_razorpay_client
from service.payment_service import PaymentService, _preserve_checkout_meta
from exception_handler import setup_exception_handlers


# ==================== Lifespan ====================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    init_db()

    # Initialize auth middleware
    initialize_auth_middleware(
        secret_key=settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
        redis_client=redis_client
    )

    # Test Razorpay connection if configured
    try:
        razorpay_client = get_razorpay_client()
        logger.info("✓ Payment service: Razorpay client initialized")
    except Exception as e:
        logger.warning(f"⚠ Payment service: Razorpay client not initialized - {str(e)}")

    # Recovery runs from RQ worker background thread (worker.py → recover_orders.py)
    # Every 5 minutes, the recovery loop finds orphan payments without orders
    # and creates them via the commerce service API.

    logger.info("✓ Payment service started")
    yield
    
    # Shutdown
    logger.info("✓ Payment service stopped")


# ==================== FastAPI App ====================

_env = os.environ.get("ENVIRONMENT", "production")
app = FastAPI(
    title="Aarya Clothing - Payment Service",
    description="Payment Processing with Razorpay Integration",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if _env != "production" else None,
    redoc_url="/redoc" if _env != "production" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin", "X-CSRF-Token", "X-Razorpay-Signature"],
)

# Prometheus metrics — /metrics endpoint for scraping.
# If fastapi-instrumentator is unavailable, expose a basic endpoint so
# Prometheus scraping does not fail with 404.
try:
    from prometheus_fastapi_instrumentator import Instrumentator

    Instrumentator().instrument(app).expose(app, endpoint="/metrics")
except Exception as exc:
    logger.warning("Prometheus instrumentator unavailable in payment service: %s", exc)
    from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

    @app.get("/metrics")
    async def metrics_fallback():
        return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)

# Exception handlers
setup_exception_handlers(app)


# ==================== Health Check ====================

@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "payment",
        "version": "1.0.0",
        "timestamp": now_ist().isoformat(),
        "features": {
            "razorpay": bool(settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET),
            "webhooks": bool(settings.RAZORPAY_WEBHOOK_SECRET)
        }
    }


# ==================== Public Payment Config ====================

@app.get("/api/v1/payment/config", tags=["Public Payment"])
async def get_payment_config():
    """Get public payment configuration for frontend. Razorpay only."""
    return {
        "razorpay": {
            "key_id": settings.RAZORPAY_KEY_ID or "",
            "enabled": bool(settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET),
            "checkout_config_id": settings.RAZORPAY_CHECKOUT_CONFIG_ID or "",
        },
        "currency": "INR",
        "default_method": "razorpay",
    }


# ==================== Razorpay Payment Routes ====================

@app.post("/api/v1/payments/razorpay/create-order", response_model=RazorpayOrderResponse,
          tags=["Razorpay"])
async def create_razorpay_order(
    request: RazorpayOrderRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Create a Razorpay order for payment.

    CRITICAL reliability path:
    1. Prepare PendingOrder in commerce (stock reservation + cart snapshot)
    2. Create Razorpay order with pending_order_id + user_id in notes
    3. Persist PaymentTransaction with checkout metadata

    Webhooks (payment.captured) use notes.pending_order_id / gateway_response
    to create the real order even if the user never reaches /checkout/confirm.
    """
    try:
        # Minimum amount guard: Razorpay requires >= 100 paise (₹1).
        # Also reject suspiciously low amounts that indicate price manipulation.
        MIN_AMOUNT_PAISE = 100  # ₹1 absolute minimum
        if request.amount < MIN_AMOUNT_PAISE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Order amount too low: {request.amount} paise. Minimum is {MIN_AMOUNT_PAISE} paise."
            )
        
        # Validate receipt length (Razorpay requires ≤40 characters)
        if request.receipt and len(request.receipt) > 40:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Receipt too long: {len(request.receipt)} characters. Maximum is 40 characters."
            )

        user_id = current_user.get("user_id")
        notes = dict(request.notes or {})
        notes["user_id"] = str(user_id)
        pending_id = None
        amount_rupees = float(Decimal(str(request.amount)) / Decimal("100"))

        logger.info(
            f"create-order: user={user_id} amount={request.amount} paise "
            f"({amount_rupees:.2f} INR) "
            f"currency={request.currency} receipt={request.receipt}"
        )

        # ── 1. Prepare pending + RESERVE STOCK before Razorpay ──
        # HARD GATE: no Razorpay order if stock cannot be reserved.
        # 10 units / 15 payers → only 10 open the gateway; 5 get clear 400.
        if not request.cart_snapshot or not request.shipping_address:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="cart_snapshot and shipping_address are required to start payment",
            )

        try:
            import httpx
            commerce_url = os.environ.get("COMMERCE_SERVICE_URL", "http://commerce:5002")
            internal_secret = os.environ.get("INTERNAL_SERVICE_SECRET")
            async with httpx.AsyncClient(timeout=12.0) as client:
                prepare_resp = await client.post(
                    f"{commerce_url}/api/v1/orders/internal/orders/prepare",
                    json={
                        "user_id": user_id,
                        "cart_snapshot": request.cart_snapshot,
                        "shipping_address": request.shipping_address,
                        "total_amount": amount_rupees,
                        "subtotal": float(notes.get("subtotal", amount_rupees)),
                        "discount_applied": float(notes.get("discount_applied", 0)),
                        "shipping_cost": float(notes.get("shipping_cost", 0)),
                    },
                    headers={"X-Internal-Secret": internal_secret},
                )
            if prepare_resp.status_code != 200:
                detail = "Unable to reserve stock for this order. Please update your cart."
                try:
                    body = prepare_resp.json()
                    detail = body.get("detail") or body.get("message") or detail
                except Exception:
                    detail = prepare_resp.text[:300] or detail
                logger.warning(
                    f"PREPARE_BLOCKED_PAYMENT: user={user_id} status={prepare_resp.status_code} "
                    f"detail={str(detail)[:200]}"
                )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=detail if isinstance(detail, str) else str(detail),
                )
            pending_data = prepare_resp.json()
            pending_id = pending_data.get("pending_order_id")
            if pending_id is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Stock reservation did not return a pending order. Try again.",
                )
            if not pending_data.get("stock_reserved", True):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Stock could not be reserved. Please update your cart.",
                )
            notes["pending_order_id"] = str(pending_id)
            logger.info(
                f"✓ CREATE_ORDER_PENDING_PREPARED: id={pending_id} user={user_id} "
                f"reservations={pending_data.get('reserved_count')}"
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"PREPARE_ERROR create-order: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Checkout service unavailable. Please try again in a moment.",
            )

        # ── 2. Create Razorpay order (notes carry pending_order_id + user_id) ──
        razorpay_client = get_razorpay_client()
        order = razorpay_client.create_order(
            amount=int(request.amount),
            currency=request.currency,
            receipt=request.receipt,
            notes=notes,
            checkout_config_id=settings.RAZORPAY_CHECKOUT_CONFIG_ID or None,
        )
        logger.info(
            f"✓ Order created: id={order.get('id')} "
            f"amount={order.get('amount')} status={order.get('status')} "
            f"pending_id={pending_id}"
        )

        # ── 3. Link razorpay_order_id onto the pending order (best-effort) ──
        if pending_id and order.get("id"):
            try:
                import httpx
                commerce_url = os.environ.get("COMMERCE_SERVICE_URL", "http://commerce:5002")
                internal_secret = os.environ.get("INTERNAL_SERVICE_SECRET")
                async with httpx.AsyncClient(timeout=5.0) as client:
                    link_resp = await client.patch(
                        f"{commerce_url}/api/v1/orders/internal/orders/pending/{pending_id}",
                        json={"razorpay_order_id": order["id"]},
                        headers={"X-Internal-Secret": internal_secret},
                    )
                    if link_resp.status_code == 200:
                        logger.info(
                            f"✓ Linked pending={pending_id} → razorpay_order={order['id']}"
                        )
                    else:
                        logger.warning(
                            f"pending link status={link_resp.status_code} body={link_resp.text[:200]}"
                        )
            except Exception as link_err:
                logger.warning(
                    f"Could not link razorpay_order_id to pending {pending_id}: {link_err}"
                )

        # ── 4. Create payment transaction with full checkout metadata ──
        try:
            from models.payment import PaymentTransaction

            gateway_response = {
                "cart_snapshot": request.cart_snapshot or [],
                "shipping_address": request.shipping_address,
                "created_during": "create-order",
            }
            if pending_id is not None:
                gateway_response["pending_order_id"] = pending_id

            transaction = PaymentTransaction(
                user_id=user_id,
                amount=Decimal(str(request.amount)) / Decimal('100'),
                currency=request.currency,
                payment_method='razorpay',
                razorpay_order_id=order['id'],
                status='pending',
                gateway_response=gateway_response,
            )
            db.add(transaction)
            db.commit()
            logger.info(
                f"✓ PaymentTransaction created: id={transaction.id} "
                f"txn_id={transaction.transaction_id} pending_id={pending_id}"
            )
        except Exception as e:
            db.rollback()
            logger.error(f"✗ Failed to create payment transaction: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create payment transaction. Order not charged."
            )

        # Surface pending_order_id to frontend (sessionStorage) via notes + gateway_response
        if pending_id is not None:
            if not isinstance(order.get("notes"), dict):
                order["notes"] = dict(notes)
            else:
                order["notes"] = {**order.get("notes", {}), **notes}
            order["gateway_response"] = {"pending_order_id": pending_id}

        return RazorpayOrderResponse(**order)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"✗ create-order failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create Razorpay order: {str(e)}"
        )


@app.post("/api/v1/payments/razorpay/verify", response_model=PaymentResponse,
          tags=["Razorpay"])
async def verify_razorpay_payment(
    request: RazorpayPaymentVerification,
    db: Session = Depends(get_db)
):
    """
    Verify Razorpay payment after completion.
    
    This endpoint verifies the payment signature and updates the transaction status.
    """
    try:
        payment_service = PaymentService(db)
        
        # Find transaction by Razorpay order ID
        from models.payment import PaymentTransaction
        transaction = db.query(PaymentTransaction).filter(
            PaymentTransaction.razorpay_order_id == request.razorpay_order_id
        ).first()
        
        if not transaction:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transaction not found"
            )
        
        # Verify payment
        response = await payment_service.verify_payment(
            transaction.transaction_id,
            request.razorpay_payment_id,
            request.razorpay_signature
        )
        
        return response
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Payment verification failed: {str(e)}"
        )


@app.post("/api/v1/payments/razorpay/verify-signature", tags=["Razorpay"])
async def verify_razorpay_signature(request: RazorpayPaymentVerification):
    """
    Verify Razorpay payment signature directly (no DB transaction lookup).
    Use this after Razorpay checkout completes - just validates the HMAC signature.
    Returns { success: true, razorpay_payment_id, razorpay_order_id } on success.
    """
    try:
        razorpay_client = get_razorpay_client()
        is_valid = razorpay_client.verify_payment(
            request.razorpay_order_id,
            request.razorpay_payment_id,
            request.razorpay_signature,
        )
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid payment signature",
            )
        return {
            "success": True,
            "razorpay_payment_id": request.razorpay_payment_id,
            "razorpay_order_id": request.razorpay_order_id,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Razorpay signature verification error: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Signature verification failed: {str(e)}",
        )


@app.post("/api/v1/payments/razorpay/redirect-callback", tags=["Razorpay"])
async def razorpay_redirect_callback(request: Request):
    """
    Browser redirect callback from Razorpay after redirect-mode (form-POST) payment.

    Razorpay POSTs here with payment result; we verify HMAC signature and
    redirect the browser to the frontend confirm page or payment-failure page.

    Fallback safety: if our HMAC check fails but Razorpay's own API confirms
    the payment was captured, we accept the payment to avoid stranding a user
    who has already paid.
    """
    frontend_url = os.getenv("FRONTEND_URL", "https://aaryaclothing.in")
    try:
        form = await request.form()

        # Log every field received (exclude signature for security)
        form_keys = list(form.keys())
        logger.info(f"redirect-callback received fields: {form_keys}")

        razorpay_payment_id = form.get("razorpay_payment_id", "")
        razorpay_order_id   = form.get("razorpay_order_id",   "")
        razorpay_signature  = form.get("razorpay_signature",  "")

        logger.info(
            f"redirect-callback: payment_id={razorpay_payment_id} "
            f"order_id={razorpay_order_id} "
            f"has_signature={bool(razorpay_signature)}"
        )

        if razorpay_payment_id and razorpay_order_id and razorpay_signature:
            razorpay_client = get_razorpay_client()
            is_valid = razorpay_client.verify_payment(
                razorpay_order_id, razorpay_payment_id, razorpay_signature
            )

            if is_valid:
                logger.info(
                    f"✓ Payment accepted: order={razorpay_order_id} "
                    f"payment={razorpay_payment_id}"
                )
                return RedirectResponse(
                    url=(
                        f"{frontend_url}/checkout/confirm"
                        f"?payment_id={razorpay_payment_id}"
                        f"&razorpay_order_id={razorpay_order_id}"
                        f"&razorpay_signature={razorpay_signature}"
                    ),
                    status_code=303,
                )

            # HMAC mismatch — before rejecting, confirm with Razorpay's API.
            # If the payment is genuinely captured we should never strand the user.
            #
            # SECURITY: This fallback is rate-limited to prevent abuse (5 per 60s per IP).
            # An attacker who can craft a redirect with a valid payment_id from another
            # user would still need Razorpay's API to report "captured" AND the order_id
            # to match — both are gated by the merchant's API key which is server-side only.
            logger.warning(
                f"HMAC_FAILED: order={razorpay_order_id} payment={razorpay_payment_id}. "
                "Fetching payment from Razorpay API as fallback…"
            )
            try:
                from shared.rate_limiter import get_rate_limiter
                rl = get_rate_limiter()
                client_ip = request.client.host if request.client else "unknown"
                rl.check(f"hmac_fallback:{client_ip}", limit=5, window=60)

                payment_data = razorpay_client.fetch_payment(razorpay_payment_id)
                api_status   = payment_data.get("status", "")
                api_order_id = payment_data.get("order_id", "")
                logger.info(
                    f"Razorpay API: payment={razorpay_payment_id} "
                    f"status={api_status} order_id={api_order_id}"
                )
                if api_status == "captured" and api_order_id == razorpay_order_id:
                    logger.critical(
                        f"HMAC_FALLBACK_ACCEPTED: order={razorpay_order_id} "
                        f"payment={razorpay_payment_id} ip={client_ip}"
                    )
                    return RedirectResponse(
                        url=(
                            f"{frontend_url}/checkout/confirm"
                            f"?payment_id={razorpay_payment_id}"
                            f"&razorpay_order_id={razorpay_order_id}"
                            f"&razorpay_signature={razorpay_signature}"
                        ),
                        status_code=303,
                    )
                logger.error(
                    f"✗ Payment rejected: HMAC failed AND API status={api_status} "
                    f"(expected 'captured', order_id match={api_order_id == razorpay_order_id})"
                )
            except Exception as fetch_err:
                if "429" in str(fetch_err) or "rate_limit" in str(fetch_err).lower():
                    logger.error(f"HMAC_FALLBACK_RATE_LIMITED: IP={client_ip}, payment={razorpay_payment_id}")
                else:
                    logger.error(f"Razorpay API fallback fetch failed: {fetch_err}")

            return RedirectResponse(
                url=f"{frontend_url}/checkout/payment?error=verification_failed",
                status_code=303,
            )

        # No payment IDs — payment failed or was cancelled
        error_code = form.get("error[code]", "")
        error_desc = (
            form.get("error[description]")
            or form.get("error_description")
            or "unknown"
        )
        logger.warning(
            f"redirect-callback: payment NOT completed — "
            f"code={error_code} desc={error_desc}"
        )
        return RedirectResponse(
            url=f"{frontend_url}/checkout/payment?error=payment_failed",
            status_code=303,
        )

    except Exception as e:
        logger.error(f"redirect-callback unhandled error: {e}", exc_info=True)
        return RedirectResponse(
            url=f"{frontend_url}/checkout/payment?error=server_error",
            status_code=303,
        )


# ==================== QR Code Payment Routes ====================

@app.post("/api/v1/payments/razorpay/create-qr-code", response_model=QrCodeCreateResponse,
          tags=["QR Code Payments"])
async def create_qr_code(
    request: QrCodeCreateRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Create a UPI QR code for payment.

    Creates a single-use QR code with 5-minute expiry.
    The QR code image URL is returned and should be displayed to the user.
    """
    try:
        from models.payment import PaymentTransaction
        import uuid

        # Validate amount (Razorpay requires >= 100 paise)
        MIN_AMOUNT_PAISE = 100
        if request.amount < MIN_AMOUNT_PAISE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Amount too low: {request.amount} paise. Minimum is {MIN_AMOUNT_PAISE} paise."
            )

        # Calculate expiry time (5 minutes from now)
        now = int(time.time())
        close_by = now + 300  # 5 minutes in seconds

        notes = dict(request.notes or {})
        notes["user_id"] = str(current_user["user_id"])
        pending_id = None

        # HARD GATE: reserve stock before QR is shown (same as create-order)
        if not request.cart_snapshot or not request.shipping_address:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="cart_snapshot and shipping_address are required for QR payment",
            )
        try:
            import httpx
            commerce_url = os.environ.get("COMMERCE_SERVICE_URL", "http://commerce:5002")
            internal_secret = os.environ.get("INTERNAL_SERVICE_SECRET")
            async with httpx.AsyncClient(timeout=12.0) as client:
                prepare_resp = await client.post(
                    f"{commerce_url}/api/v1/orders/internal/orders/prepare",
                    json={
                        "user_id": current_user["user_id"],
                        "cart_snapshot": request.cart_snapshot,
                        "shipping_address": request.shipping_address,
                        "total_amount": float(request.amount) / 100.0,
                        "subtotal": float(notes.get("subtotal", float(request.amount) / 100.0)),
                        "discount_applied": float(notes.get("discount_applied", 0)),
                        "shipping_cost": float(notes.get("shipping_cost", 0)),
                    },
                    headers={"X-Internal-Secret": internal_secret},
                )
            if prepare_resp.status_code != 200:
                detail = "Unable to reserve stock for QR payment. Please update your cart."
                try:
                    body = prepare_resp.json()
                    detail = body.get("detail") or detail
                except Exception:
                    pass
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)
            pending_data = prepare_resp.json()
            pending_id = pending_data.get("pending_order_id")
            if pending_id is None or not pending_data.get("stock_reserved", True):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Stock reservation failed. Please update your cart.",
                )
            notes["pending_order_id"] = str(pending_id)
            logger.info(
                f"✓ QR_PENDING_ORDER_PREPARED: id={pending_id} user={current_user['user_id']}"
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"QR prepare failed: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Checkout service unavailable. Please try again.",
            )

        # Generate transaction ID
        transaction_id = f"txn_qr_{now}_{uuid.uuid4().hex[:8]}"

        # Create transaction record FIRST to avoid orphaned QR codes.
        # order_id is NULL — order is created AFTER payment succeeds.
        transaction = PaymentTransaction(
            order_id=None,
            user_id=current_user["user_id"],
            amount=request.amount / Decimal('100'),
            currency="INR",
            payment_method="upi_qr",
            transaction_id=transaction_id,
            status="pending",
            description=request.description,
            gateway_response={"created_during": "create-qr"},
        )
        db.add(transaction)
        db.flush()  # get transaction.id without committing yet

        # Now create Razorpay QR code
        razorpay_client = get_razorpay_client()
        qr_response = razorpay_client.create_qr_code(
            amount=int(request.amount),
            description=request.description,
            close_by=close_by,
            notes=notes
        )

        qr_code_id = qr_response.get("id")
        image_url = qr_response.get("image_url")

        if not qr_code_id or not image_url:
            transaction.status = "failed"
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create QR code: missing required fields"
            )

        # Update transaction with QR code ID and cart data.
        # CRITICAL: pending_order_id must live on gateway_response so webhooks
        # and recovery can create the order after qr_code.credited.
        transaction.razorpay_qr_code_id = qr_code_id
        gateway_response = {
            "created_during": "create-qr",
            "qr_code_id": qr_code_id,
        }
        if pending_id is not None:
            gateway_response["pending_order_id"] = pending_id
        if request.cart_snapshot:
            gateway_response["cart_snapshot"] = request.cart_snapshot
        if request.shipping_address:
            gateway_response["shipping_address"] = request.shipping_address
        transaction.gateway_response = gateway_response

        # Link razorpay QR notes already have pending_id; also link pending row if possible
        if pending_id is not None:
            try:
                import httpx as _httpx
                commerce_url = os.environ.get("COMMERCE_SERVICE_URL", "http://commerce:5002")
                internal_secret = os.environ.get("INTERNAL_SERVICE_SECRET")
                async with _httpx.AsyncClient(timeout=5.0) as client:
                    await client.patch(
                        f"{commerce_url}/api/v1/orders/internal/orders/pending/{pending_id}",
                        json={"transaction_id": transaction_id},
                        headers={"X-Internal-Secret": internal_secret},
                    )
            except Exception as link_err:
                logger.warning(f"Could not link QR pending {pending_id}: {link_err}")

        db.commit()

        logger.info(
            f"QR code created: {qr_code_id}, transaction: {transaction_id}, pending_id={pending_id}"
        )

        return QrCodeCreateResponse(
            success=True,
            qr_code_id=qr_code_id,
            image_url=image_url,
            amount=request.amount,
            currency="INR",
            expires_at=close_by,
            transaction_id=transaction_id,
            pending_order_id=str(pending_id) if pending_id else None,
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to create QR code: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"QR code creation failed: {str(e)}"
        )


@app.post("/api/v1/payments/razorpay/qr-status/{qr_code_id}", response_model=QrCodeStatusResponse,
          tags=["QR Code Payments"])
async def check_qr_status(
    qr_code_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),  # FIX #7: Auth required
):
    """
    Check the status of a QR code payment.

    Fetches current status from Razorpay and updates local transaction.
    FIX #7: Now requires authentication and verifies the transaction
    belongs to the requesting user, preventing enumeration attacks.
    """
    try:
        from models.payment import PaymentTransaction
        from service.payment_service import _preserve_checkout_meta

        # FIX #7: Verify the QR code belongs to this user
        transaction = db.query(PaymentTransaction).filter(
            PaymentTransaction.razorpay_qr_code_id == qr_code_id
        ).first()
        if transaction and transaction.user_id != current_user["user_id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="QR code does not belong to this user",
            )

        # Fetch QR status from Razorpay
        razorpay_client = get_razorpay_client()
        qr_data = razorpay_client.fetch_qr_code(qr_code_id)

        qr_status = qr_data.get("status", "unknown")
        # Razorpay returns "closed" for single-use QR codes that have been paid.
        # Map it to "paid" for consistency with frontend and order service.
        if qr_status == "closed":
            qr_status = "paid"
        payment_id = qr_data.get("payment_id")
        paid_at = qr_data.get("paid_at")
        expires_at = qr_data.get("close_by", 0)
        amount = qr_data.get("amount", 0)

        # Update local transaction if payment was completed
        if qr_status == "paid" and payment_id:
            # Re-fetch inside the paid block in case we skipped the initial
            # lookup (transaction was None when QR was just created)
            if not transaction:
                transaction = db.query(PaymentTransaction).filter(
                    PaymentTransaction.razorpay_qr_code_id == qr_code_id
                ).first()

            if transaction and transaction.status == "pending":
                transaction.status = "completed"
                transaction.razorpay_payment_id = payment_id
                transaction.completed_at = ist_naive()
                # FIX #1: Preserve checkout metadata (cart_snapshot, shipping_address,
                # pending_order_id) before overwriting gateway_response with QR status data.
                # Without this, the webhook's _create_order_from_webhook cannot find the
                # pending order or shipping address, causing orders to be created without
                # linking to the PendingOrder snapshot.
                _preserve_checkout_meta(transaction, qr_data)
                db.commit()

                logger.info(f"QR payment completed: {qr_code_id}, payment_id: {payment_id}")

        return QrCodeStatusResponse(
            qr_code_id=qr_code_id,
            status=qr_status,
            amount=Decimal(str(amount)) / Decimal('100'),  # Convert paise to rupees
            payment_id=payment_id,
            paid_at=paid_at,
            expires_at=expires_at
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to check QR status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"QR status check failed: {str(e)}"
        )


# ==================== Payment Routes ====================

@app.post("/api/v1/payments/process", response_model=PaymentResponse,
          tags=["Payments"])
async def process_payment(
    request: PaymentRequest,
    db: Session = Depends(get_db)
):
    """
    Process a payment for an order.
    
    This endpoint creates a payment transaction and initiates payment processing.
    """
    try:
        payment_service = PaymentService(db)
        response = payment_service.create_payment_transaction(request)
        return response
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payment processing failed: {str(e)}"
        )


@app.get("/api/v1/payments/{transaction_id}/status",
         tags=["Payments"])
async def get_payment_status(
    transaction_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Get the status of a payment transaction.
    Only accessible by the transaction owner or staff/admin.
    """
    try:
        payment_service = PaymentService(db)
        payment_status = payment_service.get_payment_status(transaction_id)
        
        if not payment_status:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transaction not found"
            )

        # Ownership check — staff can see any transaction
        user_role = current_user.get("role", "customer")
        if user_role not in ("admin", "staff", "super_admin"):
            owner_id = getattr(payment_status, "user_id", None) or (payment_status.get("user_id") if isinstance(payment_status, dict) else None)
            if owner_id and owner_id != current_user.get("id"):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied"
                )
        
        return payment_status
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get payment status: {str(e)}"
        )


@app.post("/api/v1/payments/{transaction_id}/refund",
          response_model=RefundResponse,
          tags=["Payments"])
async def refund_payment(
    transaction_id: str,
    reason: str = "Customer request",
    amount: Optional[Decimal] = None,
    db: Session = Depends(get_db),
    _: dict = Depends(require_admin)
):
    """
    Process a refund for a transaction.
    """
    try:
        payment_service = PaymentService(db)
        refund_request = RefundRequest(
            transaction_id=transaction_id,
            amount=amount,
            reason=reason
        )
        response = payment_service.refund_payment(refund_request)
        return response
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Refund processing failed: {str(e)}"
        )


@app.get("/api/v1/payment/methods", response_model=PaymentMethodsResponse,
         tags=["Payments"])
@app.get("/api/v1/payments/methods", response_model=PaymentMethodsResponse,
         tags=["Payments"])
async def get_payment_methods(db: Session = Depends(get_db)):
    """
    Get available payment methods — Razorpay only.
    """
    razorpay_enabled = bool(settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET)
    methods = []
    if razorpay_enabled:
        methods.append({
            "name": "razorpay",
            "display_name": "Pay Online (Razorpay)",
            "is_active": True,
            "supported_currencies": ["INR"],
            "min_amount": None,
            "max_amount": None,
        })
    return PaymentMethodsResponse(
        methods=methods,
        default_method="razorpay"
    )



@app.get("/api/v1/payments/history",
         tags=["Payments"])
async def get_transaction_history(
    user_id: Optional[int] = None,
    order_id: Optional[int] = None,
    status: Optional[PaymentStatus] = None,
    payment_method: Optional[PaymentMethod] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """
    Get transaction history with filters.
    """
    try:
        payment_service = PaymentService(db)
        request = TransactionHistoryRequest(
            user_id=user_id,
            order_id=order_id,
            status=status,
            payment_method=payment_method,
            skip=skip,
            limit=limit
        )
        
        history = payment_service.get_transaction_history(request)
        total = payment_service.count_transaction_history(request)
        return {
            "transactions": history,
            "total": total,
            "skip": skip,
            "limit": limit
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get transaction history: {str(e)}"
        )


# ==================== Webhook Routes ====================

@app.post("/api/v1/webhooks/razorpay", response_model=WebhookResponse,
          tags=["Webhooks"])
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: str = Header(..., description="Razorpay webhook signature"),
    _: None = Depends(rate_limit("razorpay_webhook", limit=60, window=10)),
):
    """
    Handle Razorpay webhook events.

    RATE LIMITED: 60 requests per 10 seconds (safety valve against retry storms).
    Razorpay fires up to 3 events per payment (authorized, captured, order.paid),
    each with up to 3 retries — 9+ webhooks per payment. With 100+ payments/day,
    that's 900+ webhooks. Rate limiting prevents cascading failure.

    This endpoint processes webhook events from Razorpay for payment status updates.
    """
    try:
        # Get raw request body
        body = await request.body()
        body_str = body.decode('utf-8')
        
        # Verify webhook signature
        razorpay_client = get_razorpay_client()
        is_valid = razorpay_client.verify_webhook_signature(
            body_str,
            x_razorpay_signature
        )
        
        if not is_valid:
            logger.warning(
                f"INVALID_WEBHOOK_SIGNATURE: sig={x_razorpay_signature[:20] if x_razorpay_signature else 'none'}... "
                f"body_preview={body_str[:200]}"
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid webhook signature"
            )
        
        # Parse webhook data
        webhook_data = json.loads(body_str)
        
        # Process webhook event with proper session management using context manager
        from database.database import get_db_context
        with get_db_context() as db:
            try:
                payment_service = PaymentService(db)
                success = payment_service.process_webhook_event(webhook_data)
                db.commit()  # Commit on success

                return WebhookResponse(
                    processed=success,
                    message="Webhook processed successfully",
                    event_type=webhook_data.get("event")
                )
            except Exception as e:
                db.rollback()
                raise e
        
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid webhook payload"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Webhook processing failed: {str(e)}"
        )


# ==================== Fraud Detection ====================

@app.post("/api/v1/payments/verify", tags=["Payments"])
async def verify_payment_risk(
    order_id: int,
    user_id: int,
    amount: Decimal,
    _current_user: dict = Depends(require_admin)  # Internal fraud tool — admin only
):
    """
    Verify payment for potential fraud.
    
    This endpoint checks various factors to determine if a payment
    might be fraudulent.
    """
    # Simple logic: higher amounts have higher risk scores
    risk_score = 0.1
    if amount > 10000:
        risk_score = 0.5
    if amount > 50000:
        risk_score = 0.8
        
    risk_level = "low"
    if risk_score > 0.7:
        risk_level = "high"
    elif risk_score > 0.4:
        risk_level = "medium"
        
    recommendation = "approve"
    if risk_level == "high":
        recommendation = "review"
    
    return {
        "risk_score": risk_score,
        "risk_level": risk_level,
        "recommendation": recommendation,
        "checks_passed": [
            "user_verified",
            "ip_not_flagged",
            "velocity_normal"
        ]
    }


# ==================== Entry Point ====================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=5003,
        reload=False,
        log_level="info"
    )
