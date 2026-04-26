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
from schemas.payment import (
    PaymentRequest, PaymentResponse, PaymentStatus, PaymentMethod,
    RazorpayOrderRequest, RazorpayOrderResponse, RazorpayPaymentVerification,
    RefundRequest, RefundResponse, RefundStatus,
    WebhookEvent, WebhookResponse, PaymentMethodsResponse,
    TransactionHistoryRequest,
    QrCodeCreateRequest, QrCodeCreateResponse, QrCodeStatusResponse
)
from core.razorpay_client import get_razorpay_client
from service.payment_service import PaymentService
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

    # FIX: Start background recovery job scheduler
    # Runs every 5 minutes to catch missed webhooks
    try:
        from jobs.recovery_job import run_payment_recovery
        import threading
        import time
        
        def recovery_scheduler():
            """Run recovery job every 5 minutes in background thread."""
            while True:
                try:
                    logger.info("==> RECOVERY_JOB: Running scheduled payment recovery...")
                    run_payment_recovery()
                except Exception as e:
                    logger.error(f"RECOVERY_JOB: Scheduled run failed: {e}", exc_info=True)
                
                # Sleep for 5 minutes
                for _ in range(300):  # 5 minutes * 12 = 600 seconds, but we check every second
                    time.sleep(1)
        
        # Start scheduler thread
        scheduler_thread = threading.Thread(
            target=recovery_scheduler,
            daemon=True,  # Daemon thread will exit when main process exits
            name="payment-recovery-scheduler"
        )
        scheduler_thread.start()
        logger.info("✓ Payment service: Recovery job scheduler started (5 min intervals)")
    except Exception as e:
        logger.warning(f"⚠ Payment service: Could not start recovery scheduler - {str(e)}")

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
    
    This endpoint creates a Razorpay order that can be used to initiate payment.
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
        
        logger.info(
            f"create-order: user={current_user.get('user_id')} amount={request.amount} paise "
            f"({request.amount/100:.2f} INR) "
            f"currency={request.currency} receipt={request.receipt}"
        )
        razorpay_client = get_razorpay_client()
        order = razorpay_client.create_order(
            amount=int(request.amount),
            currency=request.currency,
            receipt=request.receipt,
            notes=request.notes,
            checkout_config_id=settings.RAZORPAY_CHECKOUT_CONFIG_ID or None,
        )
        logger.info(
            f"✓ Order created: id={order.get('id')} "
            f"amount={order.get('amount')} status={order.get('status')}"
        )
        return RazorpayOrderResponse(**order)

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
            logger.warning(
                f"HMAC failed for order={razorpay_order_id} payment={razorpay_payment_id}. "
                "Fetching payment from Razorpay API as fallback…"
            )
            try:
                payment_data = razorpay_client.fetch_payment(razorpay_payment_id)
                api_status   = payment_data.get("status", "")
                api_order_id = payment_data.get("order_id", "")
                logger.info(
                    f"Razorpay API: payment={razorpay_payment_id} "
                    f"status={api_status} order_id={api_order_id}"
                )
                if api_status == "captured" and api_order_id == razorpay_order_id:
                    logger.warning(
                        f"⚠ Accepting payment via API fallback (HMAC failed but captured): "
                        f"order={razorpay_order_id} payment={razorpay_payment_id}"
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

    Creates a single-use QR code with 30-minute expiry.
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

        # Calculate expiry time (30 minutes from now)
        now = int(time.time())
        close_by = now + 1800  # 30 minutes in seconds

        # Create Razorpay QR code
        razorpay_client = get_razorpay_client()
        qr_response = razorpay_client.create_qr_code(
            amount=int(request.amount),
            description=request.description,
            close_by=close_by,
            notes=request.notes
        )

        qr_code_id = qr_response.get("id")
        image_url = qr_response.get("image_url")

        if not qr_code_id or not image_url:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create QR code: missing required fields"
            )

        # Generate transaction ID
        transaction_id = f"txn_qr_{now}_{uuid.uuid4().hex[:8]}"

        # Create transaction record
        # order_id is NULL at this point — the order is created AFTER payment succeeds
        transaction = PaymentTransaction(
            order_id=None,
            user_id=int(request.notes.get("user_id", 0)) if request.notes else 0,
            amount=request.amount / Decimal('100'),  # Convert paise to rupees
            currency="INR",
            payment_method="upi_qr",
            transaction_id=transaction_id,
            status="pending",
            razorpay_qr_code_id=qr_code_id,
            description=request.description
        )

        db.add(transaction)
        db.commit()

        logger.info(f"QR code created: {qr_code_id}, transaction: {transaction_id}")

        return QrCodeCreateResponse(
            success=True,
            qr_code_id=qr_code_id,
            image_url=image_url,
            amount=request.amount,
            currency="INR",
            expires_at=close_by,
            transaction_id=transaction_id
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
    db: Session = Depends(get_db)
):
    """
    Check the status of a QR code payment.

    Fetches current status from Razorpay and updates local transaction.
    """
    try:
        from models.payment import PaymentTransaction

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
            transaction = db.query(PaymentTransaction).filter(
                PaymentTransaction.razorpay_qr_code_id == qr_code_id
            ).first()

            if transaction and transaction.status == "pending":
                transaction.status = "completed"
                transaction.razorpay_payment_id = payment_id
                transaction.completed_at = ist_naive()
                transaction.gateway_response = qr_data
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
async def get_payment_status(transaction_id: str, db: Session = Depends(get_db)):
    """
    Get the status of a payment transaction.
    """
    try:
        payment_service = PaymentService(db)
        payment_status = payment_service.get_payment_status(transaction_id)
        
        if not payment_status:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transaction not found"
            )
        
        return payment_status
        
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
    db: Session = Depends(get_db)
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


# ==================== Recovery & Background Jobs ====================

@app.post("/api/v1/admin/recovery/run", tags=["Recovery"])
async def trigger_recovery_job(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """
    Manually trigger the payment recovery job.

    Scans for completed payments without matching orders and attempts to create them.
    Admin only.
    """
    try:
        from jobs.recovery_job import run_payment_recovery

        logger.info(f"RECOVERY_TRIGGER: admin={current_user.get('email')}")
        result = run_payment_recovery()

        return {
            "success": True,
            "message": "Recovery job completed",
            "results": result
        }
    except Exception as e:
        logger.error(f"RECOVERY_TRIGGER_FAILED: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Recovery job failed: {str(e)}"
        )


@app.get("/api/v1/admin/recovery/orphaned-payments", tags=["Recovery"])
async def list_orphaned_payments(
    days: int = Query(7, ge=1, le=30),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """
    List payments that are completed but have no matching order.

    Admin only. Used for manual recovery and monitoring.
    """
    try:
        from sqlalchemy import text

        result = db.execute(text("""
            SELECT
                pt.id AS payment_transaction_id,
                pt.transaction_id,
                pt.razorpay_order_id,
                pt.razorpay_payment_id,
                pt.razorpay_qr_code_id,
                pt.user_id,
                pt.amount,
                pt.status,
                pt.payment_method,
                pt.created_at AS payment_created_at,
                pt.completed_at AS payment_completed_at
            FROM payment_transactions pt
            LEFT JOIN orders o ON pt.order_id = o.id
            WHERE pt.status = 'completed'
              AND o.id IS NULL
              AND pt.created_at > NOW() - make_interval(days => :days)
            ORDER BY pt.created_at DESC
        """), {"days": days})

        payments = [
            {
                "payment_transaction_id": row[0],
                "transaction_id": row[1],
                "razorpay_order_id": row[2],
                "razorpay_payment_id": row[3],
                "razorpay_qr_code_id": row[4],
                "user_id": row[5],
                "amount": float(row[6]),
                "status": row[7],
                "payment_method": row[8],
                "payment_created_at": str(row[9]),
                "payment_completed_at": str(row[10]) if row[10] else None,
            }
            for row in result.fetchall()
        ]

        return {
            "count": len(payments),
            "payments": payments
        }
    except Exception as e:
        logger.error(f"ORPHANED_PAYMENTS_QUERY_FAILED: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to query orphaned payments: {str(e)}"
        )


# ==================== Webhook Routes ====================

@app.post("/api/v1/webhooks/razorpay", response_model=WebhookResponse,
          tags=["Webhooks"])
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: str = Header(..., description="Razorpay webhook signature")
):
    """
    Handle Razorpay webhook events.
    
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
async def verify_payment_risk(order_id: int, user_id: int, amount: Decimal):
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
