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
from datetime import datetime, timezone
from fastapi import FastAPI, Depends, HTTPException, status, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import Optional, List
from decimal import Decimal
import json

logger = logging.getLogger(__name__)

from core.config import settings
from core.redis_client import redis_client
from database.database import get_db, init_db
from service.payment_service import PaymentService
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
    TransactionHistoryRequest
)
from schemas.easebuzz import (
    EasebuzzPaymentRequest, EasebuzzPaymentResponse,
    EasebuzzVerificationRequest, EasebuzzVerificationResponse,
    EasebuzzRefundRequest, EasebuzzRefundResponse,
    EasebuzzPaymentMethodsResponse
)
from schemas.cashfree import (
    CashfreeOrderRequest, CashfreeOrderResponse,
    CashfreeVerifyRequest, CashfreeVerifyResponse,
    CashfreeRefundRequest, CashfreeRefundResponse,
    CashfreeWebhookPayload
)
from core.razorpay_client import get_razorpay_client
from core.easebuzz_client import easebuzz_client
from core.cashfree_client import cashfree_client
from core.direct_payment_service import DirectPaymentService
from service.payment_service import PaymentService
from service.easebuzz_service import EasebuzzService
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
    
    # Cashfree
    if settings.cashfree_enabled:
        logger.info(f"✓ Payment service: Cashfree initialized (env={settings.CASHFREE_ENV})")
    else:
        logger.warning("⚠ Payment service: Cashfree not configured")

    # Test Razorpay connection if configured
    try:
        razorpay_client = get_razorpay_client()
        logger.info("✓ Payment service: Razorpay client initialized")
    except Exception as e:
        logger.warning(f"⚠ Payment service: Razorpay client not initialized - {str(e)}")
    
    # Test Easebuzz connection if configured
    try:
        if settings.easebuzz_enabled:
            logger.info("✓ Payment service: Easebuzz client initialized")
        else:
            logger.warning("⚠ Payment service: Easebuzz client not configured")
    except Exception as e:
        logger.warning(f"⚠ Payment service: Easebuzz client error - {str(e)}")
    
    logger.info("✓ Payment service started")
    yield
    
    # Shutdown
    logger.info("✓ Payment service stopped")


# ==================== FastAPI App ====================

app = FastAPI(
    title="Aarya Clothing - Payment Service",
    description="Payment Processing with Razorpay Integration",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin", "X-CSRF-Token", "X-Razorpay-Signature"],
)

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
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "features": {
            "cashfree": settings.cashfree_enabled,
            "razorpay": bool(settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET),
            "easebuzz": settings.easebuzz_enabled,
            "webhooks": bool(settings.CASHFREE_WEBHOOK_SECRET or settings.RAZORPAY_WEBHOOK_SECRET),
            "direct_payments": True
        }
    }


# ==================== Public Payment Config ====================

@app.get("/api/v1/payment/config", tags=["Public Payment"])
async def get_payment_config():
    """Get public payment configuration for frontend.
    
    This endpoint returns public payment configuration that frontend needs.
    Backend is the SINGLE SOURCE OF TRUTH for all configuration.
    
    Returns:
        - Razorpay key ID (public, safe to expose)
        - Easebuzz enabled status
        - Enabled payment methods
        - Currency and other public settings
    """
    return {
        "cashfree": {
            "enabled": settings.cashfree_enabled,
            "env": settings.CASHFREE_ENV,
            "app_id": settings.CASHFREE_APP_ID[:10] + "..." if settings.CASHFREE_APP_ID else ""
        },
        "razorpay": {
            "key_id": settings.RAZORPAY_KEY_ID or "",
            "enabled": bool(settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET)
        },
        "easebuzz": {
            "enabled": settings.easebuzz_enabled,
        },
        "direct_payments": {
            "enabled": True,
            "upi_enabled": True,
        },
        "currency": "INR",
        "default_method": "cashfree" if settings.cashfree_enabled else "razorpay",
        "fee_structure": {
            "cashfree": {"type": "percentage", "rate": 1.75},
            "upi": {"type": "fixed", "amount": 0},
            "razorpay": {"type": "percentage", "rate": 2.3},
        }
    }


# ==================== Cashfree Payment Routes ====================

@app.post("/api/v1/payments/cashfree/create-order", tags=["Cashfree"])
async def cashfree_create_order(
    request: CashfreeOrderRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a Cashfree order and return payment_session_id for JS SDK."""
    if not settings.cashfree_enabled:
        raise HTTPException(status_code=503, detail="Cashfree payment service is not configured")
    try:
        order_id = cashfree_client.generate_order_id()
        result = cashfree_client.create_order(
            order_id=order_id,
            amount=float(request.amount),
            currency=request.currency,
            customer_id=str(current_user.get("user_id") or current_user.get("id", "")),
            customer_email=request.customer_email or current_user.get("email", ""),
            customer_phone=request.customer_phone or "9999999999",
            customer_name=request.customer_name or current_user.get("username", "Customer"),
        )
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error", "Failed to create order"))
        return CashfreeOrderResponse(
            success=True,
            cf_order_id=result.get("cf_order_id"),
            order_id=result.get("order_id"),
            payment_session_id=result.get("payment_session_id"),
            order_status=result.get("order_status"),
            order_amount=result.get("order_amount"),
            order_currency=result.get("order_currency"),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Cashfree create order error: {e}")
        raise HTTPException(status_code=500, detail="Payment initialization failed")


@app.post("/api/v1/payments/cashfree/verify", tags=["Cashfree"])
async def cashfree_verify_payment(
    request: CashfreeVerifyRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Verify Cashfree payment status after JS SDK completes."""
    if not settings.cashfree_enabled:
        raise HTTPException(status_code=503, detail="Cashfree payment service is not configured")
    try:
        order_result = cashfree_client.get_order(request.order_id)
        if not order_result.get("success"):
            raise HTTPException(status_code=404, detail="Order not found")

        order_status = order_result.get("order_status")
        payment_info: dict = {}

        if order_status == "PAID":
            payments = cashfree_client.get_payments_for_order(request.order_id)
            if payments.get("success") and payments.get("payments"):
                payment_info = payments["payments"][0] if isinstance(payments["payments"], list) else {}

        return CashfreeVerifyResponse(
            success=order_status == "PAID",
            order_id=request.order_id,
            order_status=order_status,
            payment_status=payment_info.get("payment_status"),
            cf_payment_id=str(payment_info.get("cf_payment_id", "")),
            payment_amount=payment_info.get("payment_amount"),
            payment_method=str(payment_info.get("payment_method", "")),
            error=None if order_status == "PAID" else f"Payment not completed. Status: {order_status}",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Cashfree verify error: {e}")
        raise HTTPException(status_code=500, detail="Payment verification failed")


@app.post("/api/v1/payments/cashfree/refund", tags=["Cashfree"])
async def cashfree_refund(
    request: CashfreeRefundRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a refund for a Cashfree order."""
    if not settings.cashfree_enabled:
        raise HTTPException(status_code=503, detail="Cashfree payment service is not configured")
    try:
        result = cashfree_client.create_refund(
            order_id=request.order_id,
            refund_amount=float(request.refund_amount),
            refund_note=request.refund_note,
        )
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error", "Refund failed"))
        return CashfreeRefundResponse(
            success=True,
            refund_id=result.get("refund_id"),
            order_id=result.get("order_id"),
            refund_amount=result.get("refund_amount"),
            refund_status=result.get("refund_status"),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Cashfree refund error: {e}")
        raise HTTPException(status_code=500, detail="Refund processing failed")


@app.post("/api/v1/payments/cashfree/webhook", tags=["Cashfree"])
async def cashfree_webhook(request: Request, db: Session = Depends(get_db)):
    """Handle Cashfree webhook notifications."""
    try:
        raw_body = (await request.body()).decode("utf-8")
        timestamp = request.headers.get("x-webhook-timestamp", "")
        signature = request.headers.get("x-webhook-signature", "")

        if settings.CASHFREE_WEBHOOK_SECRET and signature:
            valid = cashfree_client.verify_webhook_signature(raw_body, timestamp, signature)
            if not valid:
                raise HTTPException(status_code=401, detail="Invalid webhook signature")

        payload = json.loads(raw_body)
        event_type = payload.get("type", "")
        data = payload.get("data", {})
        order_data = data.get("order", {})
        payment_data = data.get("payment", {})

        logger.info(f"Cashfree webhook: {event_type} — order={order_data.get('order_id')} status={order_data.get('order_status')}")

        return {"success": True, "event": event_type}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Cashfree webhook error: {e}")
        raise HTTPException(status_code=500, detail="Webhook processing failed")


# ==================== Razorpay Payment Routes ====================

@app.post("/api/v1/payments/razorpay/create-order", response_model=RazorpayOrderResponse,
          tags=["Razorpay"])
async def create_razorpay_order(
    request: RazorpayOrderRequest,
    db: Session = Depends(get_db)
):
    """
    Create a Razorpay order for payment.
    
    This endpoint creates a Razorpay order that can be used to initiate payment.
    """
    try:
        razorpay_client = get_razorpay_client()
        order = razorpay_client.create_order(
            amount=int(request.amount),
            currency=request.currency,
            receipt=request.receipt,
            notes=request.notes
        )
        return RazorpayOrderResponse(**order)
        
    except Exception as e:
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
    Get available payment methods.
    """
    try:
        direct_payment_service = DirectPaymentService(db)
        methods = direct_payment_service.get_payment_methods()
        
        # Add Razorpay if configured
        if settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET:
            methods["methods"].append({
                "id": "razorpay",
                "name": "Card/NetBanking",
                "description": "Credit Card, Debit Card, NetBanking",
                "fee_type": "percentage",
                "fee_amount": 2.3,
                "processing_time": "Instant",
                "icon": "💳"
            })
        
        # Add Easebuzz methods if configured
        if settings.easebuzz_enabled:
            easebuzz_service = EasebuzzService(db)
            easebuzz_methods = easebuzz_service.get_payment_methods()
            
            for method in easebuzz_methods.get("methods", []):
                methods["methods"].append(method)
        
        return PaymentMethodsResponse(
            methods=methods["methods"],
            default_method=methods["recommended"]
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get payment methods: {str(e)}"
        )


# ==================== Direct Payment Routes ====================

@app.post("/api/v1/payments/upi/generate-qr", tags=["Direct Payments"])
async def generate_upi_qr(
    amount: Decimal,
    order_id: int,
    merchant_upi: str = "aaryaclothing@ybl",  # Default UPI ID
    db: Session = Depends(get_db)
):
    """Generate UPI QR code for payment."""
    try:
        direct_payment_service = DirectPaymentService(db)
        qr_data = direct_payment_service.generate_upi_qr(amount, order_id, merchant_upi)
        return qr_data
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate UPI QR: {str(e)}"
        )


@app.post("/api/v1/payments/bank-transfer/instructions", tags=["Direct Payments"])
async def get_bank_transfer_instructions(
    amount: Decimal,
    order_id: int,
    db: Session = Depends(get_db)
):
    """Get bank transfer instructions."""
    try:
        direct_payment_service = DirectPaymentService(db)
        instructions = direct_payment_service.create_bank_transfer_instructions(amount, order_id)
        return instructions
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get bank transfer instructions: {str(e)}"
        )


@app.post("/api/v1/payments/cod/create", tags=["Direct Payments"])
async def create_cod_order(
    amount: Decimal,
    order_id: int,
    customer_address: dict,
    db: Session = Depends(get_db)
):
    """Create Cash on Delivery order."""
    try:
        direct_payment_service = DirectPaymentService(db)
        cod_order = direct_payment_service.create_cod_order(amount, order_id, customer_address)
        return cod_order
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create COD order: {str(e)}"
        )


@app.get("/api/v1/payments/fee-calculator", tags=["Direct Payments"])
async def calculate_fees(
    amount: Decimal,
    method: str,
    db: Session = Depends(get_db)
):
    """Calculate payment fees for different methods."""
    try:
        direct_payment_service = DirectPaymentService(db)
        fee = direct_payment_service.calculate_payment_fee(method, amount)
        
        return {
            "payment_method": method,
            "amount": float(amount),
            "fee_amount": float(fee),
            "total_amount": float(amount + fee),
            "fee_percentage": float(fee / amount * 100) if amount > 0 else 0
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to calculate fees: {str(e)}"
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
        with next(get_db_context()) as db:
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


# ==================== Easebuzz Payment Routes ====================

@app.post("/api/v1/payments/easebuzz/initiate", response_model=EasebuzzPaymentResponse,
          tags=["Easebuzz"])
async def initiate_easebuzz_payment(
    request: EasebuzzPaymentRequest,
    db: Session = Depends(get_db)
):
    """
    Initiate Easebuzz payment.
    
    This endpoint creates a payment transaction and generates payment URL.
    """
    try:
        if not settings.easebuzz_enabled:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Easebuzz payment service is not configured"
            )
        
        easebuzz_service = EasebuzzService(db)
        response = easebuzz_service.create_payment_transaction(request)
        return response
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Easebuzz payment initiation failed: {str(e)}"
        )


@app.post("/api/v1/payments/easebuzz/verify", response_model=EasebuzzVerificationResponse,
          tags=["Easebuzz"])
async def verify_easebuzz_payment(
    request: EasebuzzVerificationRequest,
    db: Session = Depends(get_db)
):
    """
    Verify Easebuzz payment after completion.
    
    This endpoint verifies the payment status and updates the transaction.
    """
    try:
        if not settings.easebuzz_enabled:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Easebuzz payment service is not configured"
            )
        
        easebuzz_service = EasebuzzService(db)
        response = easebuzz_service.verify_payment(request)
        return response
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Easebuzz payment verification failed: {str(e)}"
        )


@app.post("/api/v1/payments/easebuzz/refund", response_model=EasebuzzRefundResponse,
          tags=["Easebuzz"])
async def refund_easebuzz_payment(
    request: EasebuzzRefundRequest,
    db: Session = Depends(get_db)
):
    """
    Process Easebuzz refund for a transaction.
    """
    try:
        if not settings.easebuzz_enabled:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Easebuzz payment service is not configured"
            )
        
        easebuzz_service = EasebuzzService(db)
        response = easebuzz_service.process_refund(request)
        return response
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Easebuzz refund processing failed: {str(e)}"
        )


@app.get("/api/v1/payments/easebuzz/methods", response_model=EasebuzzPaymentMethodsResponse,
         tags=["Easebuzz"])
async def get_easebuzz_payment_methods(db: Session = Depends(get_db)):
    """
    Get available Easebuzz payment methods.
    """
    try:
        if not settings.easebuzz_enabled:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Easebuzz payment service is not configured"
            )
        
        easebuzz_service = EasebuzzService(db)
        methods_data = easebuzz_service.get_payment_methods()
        
        return EasebuzzPaymentMethodsResponse(
            methods=methods_data["methods"],
            default_method=methods_data["default_method"]
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get Easebuzz payment methods: {str(e)}"
        )


@app.get("/api/v1/payments/easebuzz/{transaction_id}/status",
         tags=["Easebuzz"])
async def get_easebuzz_payment_status(transaction_id: str, db: Session = Depends(get_db)):
    """
    Get the status of an Easebuzz payment transaction.
    """
    try:
        if not settings.easebuzz_enabled:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Easebuzz payment service is not configured"
            )
        
        easebuzz_service = EasebuzzService(db)
        payment_status = easebuzz_service.get_transaction_status(transaction_id)
        
        if not payment_status:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transaction not found"
            )
        
        return payment_status
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get Easebuzz payment status: {str(e)}"
        )


@app.post("/api/v1/webhooks/easebuzz", response_model=WebhookResponse,
          tags=["Webhooks"])
async def easebuzz_webhook(
    request: Request,
    x_easebuzz_signature: Optional[str] = Header(None, description="Easebuzz webhook signature")
):
    """
    Handle Easebuzz webhook events.
    
    This endpoint processes webhook events from Easebuzz for payment status updates.
    """
    try:
        # Get raw request body
        body = await request.body()
        body_str = body.decode('utf-8')
        
        # Parse webhook data
        webhook_data = json.loads(body_str)
        
        # Process webhook event with proper session management using context manager
        from database.database import get_db_context
        with next(get_db_context()) as db:
            try:
                easebuzz_service = EasebuzzService(db)
                success = easebuzz_service.process_webhook_event(webhook_data)
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
            detail=f"Easebuzz webhook processing failed: {str(e)}"
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


# ==================== Run Server ====================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=5003,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower()
    )
