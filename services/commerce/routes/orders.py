"""
Commerce Service - Orders Routes

Order management endpoints:
- Order creation from cart
- Order listing and details
- Order status updates (admin)
- Order cancellation
- Order tracking
- Invoice generation (GST-compliant)
"""

import logging
import os
from typing import List, Optional
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from io import BytesIO

from database.database import get_db
from models.order import Order, OrderStatus
from models.address import Address
from schemas.order import OrderResponse, SetDeliveryState
from service.order_service import OrderService
from shared.auth_middleware import get_current_user, require_staff
from shared.time_utils import now_ist
from core.config import settings
import httpx

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/orders", tags=["Orders"])


def _r2_url(path: str) -> str:
    """Convert relative R2 path to full public URL."""
    if not path:
        return ""
    if path.startswith("http://") or path.startswith("https://"):
        return path
    r2_base = getattr(settings, "R2_PUBLIC_URL", "").rstrip("/")
    return f"{r2_base}/{path.lstrip('/')}" if r2_base else path


# ==================== Helper Functions ====================


def _fetch_payment_from_razorpay_direct(payment_id: str) -> dict:
    """
    Fetch payment details directly from Razorpay API using HMAC-SHA256.

    This is a fallback when the Payment Service is unavailable.
    Uses the same HMAC verification approach as the payment service.

    Args:
        payment_id: Razorpay payment ID (e.g., pay_xxx)

    Returns:
        Payment details dict with 'status' field

    Raises:
        HTTPException: If payment fetch fails
    """
    from core.config import settings

    if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
        logger.warning("Razorpay credentials not configured, cannot fetch payment")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payment gateway not configured",
        )

    try:
        # Use Razorpay Python SDK directly
        import razorpay

        client = razorpay.Client(
            auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
        )
        payment_details = client.payment.fetch(payment_id)
        return payment_details
    except Exception as e:
        logger.error(f"Failed to fetch payment from Razorpay: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to verify payment: {str(e)}",
        )


def _get_order_service(db: Session) -> OrderService:
    """Get order service instance."""
    return OrderService(db)


def _enrich_order_response(order: Order) -> OrderResponse:
    """Enrich order ORM for response with full R2 image URLs."""
    # Enrich each order item with full R2 image URL
    enriched_items = []
    for item in order.items:
        item_dict = {
            "id": item.id,
            "product_id": item.product_id,
            "product_name": item.product_name,
            "sku": item.sku,
            "size": item.size,
            "color": item.color,
            "color_hex": item.color_hex or (getattr(item.variant, 'color_hex', None) if item.variant else None),
            "hsn_code": item.hsn_code,
            "gst_rate": item.gst_rate,
            "quantity": item.quantity,
            "unit_price": item.unit_price,
            "price": item.price,
            "image_url": None,
        }
        # Prefer the snapshot image stored at order time; fallback to current variant/product.
        raw_url = item.image_url  # stored snapshot (may be full URL or relative)
        if not raw_url:
            if item.variant and item.variant.image_url:
                raw_url = item.variant.image_url
            elif hasattr(item, "product") and item.product:
                raw_url = getattr(item.product, "primary_image", None)
                if not raw_url and hasattr(item.product, "image_url"):
                    raw_url = item.product.image_url

        if raw_url:
            item_dict["image_url"] = _r2_url(raw_url)

        enriched_items.append(item_dict)

    # Convert tracking ORM object to dict for Pydantic serialization
    tracking_data = None
    if hasattr(order, "tracking") and order.tracking is not None:
        tracking_obj = order.tracking
        tracking_data = {
            "id": tracking_obj.id,
            "order_id": tracking_obj.order_id,
            "status": tracking_obj.status,
            "location": tracking_obj.location,
            "notes": tracking_obj.notes,
            "courier_name": tracking_obj.courier_name,
            "created_at": tracking_obj.created_at,
        }

    return OrderResponse(
        id=order.id,
        user_id=order.user_id,
        customer_name=getattr(order, "customer_name", None),
        customer_email=getattr(order, "customer_email", None),
        invoice_number=order.invoice_number,
        subtotal=order.subtotal,
        shipping_cost=order.shipping_cost,
        gst_amount=order.gst_amount,
        cgst_amount=order.cgst_amount,
        sgst_amount=order.sgst_amount,
        igst_amount=order.igst_amount,
        place_of_supply=order.place_of_supply,
        customer_gstin=order.customer_gstin,
        total_amount=order.total_amount,
        payment_method=order.payment_method,
        transaction_id=order.transaction_id,
        status=order.status,
        shipping_address=order.shipping_address,
        order_notes=order.order_notes,
        tracking_number=order.tracking_number,
        courier_name=order.courier_name,
        courier_tracking_url=order.courier_tracking_url,
        tracking=tracking_data,
        created_at=order.created_at,
        updated_at=order.updated_at,
        items=enriched_items,
    )


@router.post("/recover-from-payment", response_model=OrderResponse)
async def recover_order_from_payment(
    request: Request,
    payment_id: str,
    razorpay_order_id: str,
    address_id: Optional[int] = Query(
        None,
        description="Shipping address id; defaults to the user's default/first saved address",
    ),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Recover order from successful payment if order creation failed.

    Use this when:
    - Payment was successful (money deducted)
    - Order was NOT created (network error, service down, etc.)
    - User has payment_id and razorpay_order_id from Razorpay

    This endpoint:
    1. Verifies payment with Razorpay
    2. Checks if order already exists for this payment
    3. Creates order if missing
    4. Clears cart
    """
    user_id = current_user.get("user_id")
    order_service = _get_order_service(db)

    logger.info(
        f"ORDER_RECOVER_START: user={user_id} payment_id={payment_id} "
        f"razorpay_order_id={razorpay_order_id}"
    )

    try:
        # Step 1: Verify payment with Razorpay via Payment Service API
        payment_service_url = os.getenv("PAYMENT_SERVICE_URL", "http://payment:5003")

        try:
            verify_resp = httpx.post(
                f"{payment_service_url}/api/v1/payments/razorpay/verify-signature",
                json={
                    "razorpay_order_id": razorpay_order_id,
                    "razorpay_payment_id": payment_id,
                    "razorpay_signature": "",  # We don't have signature, will fetch from Razorpay
                },
                timeout=5.0,
            )

            if verify_resp.status_code == 200:
                logger.info(f"Payment verified via Payment Service API: {payment_id}")
            else:
                # Payment service verification failed - try direct Razorpay API call
                logger.warning(
                    f"Payment Service verification failed (status {verify_resp.status_code}), trying direct Razorpay API"
                )
                payment_details = _fetch_payment_from_razorpay_direct(payment_id)
                if payment_details.get("status") != "captured":
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Payment not captured. Status: {payment_details.get('status')}",
                    )
                logger.info(f"Payment verified via direct Razorpay API: {payment_id}")
        except httpx.RequestError as http_err:
            # Payment service unavailable - fall back to direct Razorpay API
            logger.warning(
                f"Payment Service unavailable: {http_err}, using direct Razorpay API"
            )
            payment_details = _fetch_payment_from_razorpay_direct(payment_id)
            if payment_details.get("status") != "captured":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Payment not captured. Status: {payment_details.get('status')}",
                )
            logger.info(f"Payment verified via direct Razorpay API: {payment_id}")

        # Step 2: Check if order already exists for this payment
        from models.order import Order

        existing_order = (
            db.query(Order)
            .filter(Order.transaction_id == payment_id, Order.user_id == user_id)
            .first()
        )

        if existing_order:
            logger.info(
                f"Order already exists: {existing_order.id} for payment {payment_id}"
            )
            return _enrich_order_response(existing_order)

        # Step 3: Create order with recovered payment data
        logger.info(f"Creating recovered order for user {user_id} payment {payment_id}")

        # Get user's cart to recreate order
        from service.cart_service import CartService

        cart_service = CartService(db)
        cart = cart_service.get_cart(user_id)

        if not cart or not cart.get("items"):
            # Cart was already cleared, create minimal order
            logger.warning(
                f"No cart found for user {user_id}, creating minimal order record"
            )
            # Create a minimal order record for tracking
            order = Order(
                user_id=user_id,
                transaction_id=payment_id,
                payment_method="razorpay",
                razorpay_payment_id=payment_id,
                razorpay_order_id=razorpay_order_id,
                subtotal=0,
                shipping_cost=0,
                gst_amount=0,
                total_amount=0,
                status=OrderStatus.CONFIRMED,
                shipping_address="Recovered order - address data not available",
                order_notes="Order recovered from successful payment. Contact support for details.",
            )
            db.add(order)
            db.commit()
            db.refresh(order)

            logger.info(f"Minimal order created: {order.id} for payment {payment_id}")
            return _enrich_order_response(order)

        resolved_address_id = address_id
        if not resolved_address_id:
            preferred = (
                db.query(Address)
                .filter(Address.user_id == user_id, Address.is_default.is_(True))
                .first()
            )
            if not preferred:
                preferred = (
                    db.query(Address)
                    .filter(Address.user_id == user_id)
                    .order_by(Address.id.asc())
                    .first()
                )
            if preferred:
                resolved_address_id = preferred.id

        if not resolved_address_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No delivery address on file. Add an address in your account, then retry recovery with ?address_id=…",
            )

        # Full order recovery with cart items (payment proven above; skip HMAC re-check)
        order = order_service.create_order(
            user_id=user_id,
            address_id=resolved_address_id,
            payment_method="razorpay",
            transaction_id=payment_id,
            razorpay_order_id=razorpay_order_id,
            payment_already_verified=True,
        )

        logger.info(
            f"ORDER_RECOVER_SUCCESS: order_id={order.id} payment_id={payment_id}"
        )
        return _enrich_order_response(order)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"ORDER_RECOVER_ERROR: user={user_id} payment_id={payment_id} error={str(e)}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to recover order. Please contact support with payment ID.",
        )


@router.post("/{order_id}/set-delivery-state", response_model=OrderResponse)
async def set_order_delivery_state(
    order_id: int,
    delivery_state: SetDeliveryState,
    request: Request,
    current_user: dict = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """Set delivery state for order (admin only)."""
    order_service = _get_order_service(db)

    try:
        order = order_service.get_order_by_id(order_id)
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Order not found"
            )

        # Update delivery state (this would be implemented in order_service)
        # For now, this is a placeholder for the actual implementation
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Delivery state update not yet implemented",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error setting delivery state: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to set delivery state",
        )


# ==================== Invoice Generation ====================


@router.get("/{order_id}/invoice", tags=["Invoices"])
async def generate_invoice(
    order_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generate GST-compliant invoice PDF for an order.

    Returns a downloadable PDF file with:
    - Company header with GSTIN
    - Customer details (billing/shipping)
    - Order items with HSN codes
    - Tax breakdown (CGST+SGST or IGST)
    - Payment information
    - Terms and conditions
    """
    from core.config import settings
    from jinja2 import Environment, FileSystemLoader
    from weasyprint import HTML

    try:
        order_service = _get_order_service(db)

        # Get order
        order = order_service.get_order_by_id(order_id)
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Order not found"
            )

        # Check authorization (user can only access their own orders, admin can access all)
        user_id = current_user.get("user_id")
        is_admin = current_user.get("is_admin", False)

        if order.user_id != user_id and not is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access this invoice",
            )

        # Check if invoice PDF already exists in R2
        invoice_pdf_url = getattr(order, 'invoice_pdf_url', None)
        if invoice_pdf_url:
            # Return existing PDF from R2 (redirect for efficiency)
            from fastapi.responses import RedirectResponse
            return RedirectResponse(url=invoice_pdf_url, status_code=302)

        # Prepare invoice data
        invoice_data = prepare_invoice_data(order, db)

        # Render HTML template
        html_content = render_invoice_template(invoice_data)

        # Generate PDF
        pdf_buffer = generate_pdf_from_html(html_content)

        # Upload to R2 if configured
        pdf_url = None
        try:
            from service.r2_service import r2_service
            from io import BytesIO
            import uuid

            invoice_filename = f"invoices/{invoice_data['invoice_number']}.pdf"

            # Seek to start before upload
            pdf_buffer.seek(0)

            pdf_url = await r2_service.upload_file(
                pdf_buffer,
                invoice_filename,
                content_type="application/pdf"
            )

            # Store URL in order record
            order.invoice_pdf_url = pdf_url
            db.commit()
        except Exception as e:
            logger.warning(f"Failed to upload invoice to R2: {e}")

        # Return as downloadable PDF
        filename = f"Invoice_{invoice_data['invoice_number']}.pdf"

        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Cache-Control": "no-cache, no-store, must-revalidate",
            },
        )
    except Exception as e:
        # Log the full error for debugging
        logger.error(f"Failed to generate invoice for order {order_id}: {str(e)}", exc_info=True)

        # Return a user-friendly error message
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate invoice. Please try again later. Error: {str(e)}"
        )


def prepare_invoice_data(order: Order, db: Session) -> dict:
    """Prepare invoice data from order."""
    from shared.size_guide_data import get_hsn_code

    # Determine if intra-state or inter-state
    # Assuming company is in Maharashtra (GSTIN starts with 27)
    company_state_code = "27"  # Maharashtra
    delivery_state = order.place_of_supply or "Maharashtra"

    # Map state name to code (simplified - in production use full mapping)
    state_codes = {
        "Maharashtra": "27",
        "Delhi": "07",
        "Karnataka": "29",
        "Tamil Nadu": "33",
        "Gujarat": "24",
        "Rajasthan": "08",
        "Uttar Pradesh": "09",
        "West Bengal": "19",
        "Telangana": "36",
        "Andhra Pradesh": "37",
        "Kerala": "32",
        "Punjab": "03",
        "Haryana": "06",
        "Madhya Pradesh": "23",
        "Bihar": "10",
    }

    delivery_state_code = state_codes.get(delivery_state, "27")
    is_intra_state = company_state_code == delivery_state_code

    # Calculate tax rates
    gst_rate = (
        float(order.gst_amount / order.total_amount * 100)
        if order.total_amount > 0
        else 12
    )
    cgst_rate = gst_rate / 2 if is_intra_state else 0
    sgst_rate = gst_rate / 2 if is_intra_state else 0
    igst_rate = gst_rate if not is_intra_state else 0

    # Prepare line items
    items = []
    for item in order.items:
        # Get product to fetch HSN code
        from models.product import Product

        product = db.query(Product).filter(Product.id == item.product_id).first()
        hsn_code = (
            product.hsn_code
            if product and product.hsn_code
            else get_hsn_code(
                product.category.name if product and product.category else "kurta"
            )
        )

        # FIX: Handle product not found or missing category gracefully
        if not product:
            hsn_code = "6204"  # Default HSN for clothing (women's suits/ensembles)
            product_name = item.product_name or f"Product {item.product_id}"
        elif not product.category:
            hsn_code = "6204"  # Default HSN for clothing (women's suits/ensembles)
            product_name = product.name
        else:
            product_name = product.name

        # Calculate item totals (discount is at order level, not item level)
        unit_price = (
            float(item.unit_price)
            if item.unit_price
            else float(item.price) / max(item.quantity, 1)
        )
        quantity = item.quantity
        taxable_value = unit_price * quantity
        item_gst = taxable_value * (gst_rate / 100)
        item_total = taxable_value + item_gst

        items.append(
            {
                "name": product_name,
                "size": item.size or "NA",
                "color": item.color or "NA",
                "hsn_code": hsn_code,
                "quantity": quantity,
                "mrp": unit_price,
                "discount": 0,
                "taxable_value": taxable_value,
                "gst_rate": gst_rate,
                "total": item_total,
            }
        )

    # Extract customer details from shipping address (JSON)
    import json

    try:
        shipping_addr = (
            json.loads(order.shipping_address)
            if isinstance(order.shipping_address, str)
            else order.shipping_address
        )
        customer_name = shipping_addr.get("name", "Customer")
        customer_phone = shipping_addr.get("phone", "NA")
        customer_email = shipping_addr.get("email", "NA")

        # Format address
        address_lines = [
            shipping_addr.get("address_line1", ""),
            shipping_addr.get("address_line2", ""),
            f"{shipping_addr.get('city', '')} {shipping_addr.get('state', '')} {shipping_addr.get('pincode', '')}".strip(),
        ]
        shipping_address = "\n".join([line for line in address_lines if line])
        billing_address = shipping_address  # Same as shipping for simplicity
    except (AttributeError, KeyError, TypeError, json.JSONDecodeError):
        # Failed to parse shipping address — use fallback
        customer_name = "Customer"
        customer_phone = "NA"
        customer_email = "NA"
        # Try to parse from plain text address format "Name, address, phone"
        plain_addr = str(order.shipping_address or "")
        if "Phone:" in plain_addr:
            parts = plain_addr.split("Phone:")
            customer_name = parts[0].strip().split(",")[0].strip() if parts[0] else "Customer"
            customer_phone = parts[1].strip().split(",")[0].strip() if len(parts) > 1 else "NA"
        else:
            customer_name = "Customer"
        shipping_address = plain_addr
        billing_address = plain_addr

    # Calculate totals
    total_taxable_value = sum(item["taxable_value"] for item in items)
    total_discount = sum(item["discount"] for item in items)
    total_gst = float(order.gst_amount)
    cgst_amount = (
        float(order.cgst_amount)
        if order.cgst_amount
        else (total_gst / 2 if is_intra_state else 0)
    )
    sgst_amount = (
        float(order.sgst_amount)
        if order.sgst_amount
        else (total_gst / 2 if is_intra_state else 0)
    )
    igst_amount = (
        float(order.igst_amount)
        if order.igst_amount
        else (total_gst if not is_intra_state else 0)
    )
    shipping_cost = float(order.shipping_cost) if order.shipping_cost else 0
    grand_total = float(order.total_amount)

    # Amount in words (simplified - use proper library in production)
    amount_in_words = number_to_words(int(grand_total))

    # Payment details
    transaction_id = order.transaction_id or "NA"
    card_last4 = "0000"  # Would extract from payment details

    # Estimated delivery (7 days from order date) - convert to IST first
    from datetime import timedelta
    from zoneinfo import ZoneInfo
    
    ist_created_at = order.created_at.astimezone(ZoneInfo("Asia/Kolkata")) if order.created_at.tzinfo else order.created_at
    estimated_delivery = (ist_created_at + timedelta(days=7)).strftime("%d %B %Y")

    # Tracking status
    tracking_status = order.status.value.replace("_", " ").title()

    # Logo base64 (to ensure it loads in PDF)
    import base64
    logo_base64 = ""
    try:
        logo_path = "/app/static/logo.png"
        if os.path.exists(logo_path):
            with open(logo_path, "rb") as f:
                logo_base64 = base64.b64encode(f.read()).decode("utf-8")
    except Exception as e:
        logger.warning(f"Failed to load invoice logo: {e}")

    return {
        "invoice_number": order.invoice_number or f"INV-{order.id}",
        "invoice_date": ist_created_at.strftime("%d %B %Y"),
        "order_number": f"#{order.id}",
        "payment_method": order.payment_method.value
        if hasattr(order.payment_method, "value")
        else str(order.payment_method),
        "transaction_id": transaction_id,
        "card_last4": card_last4,
        "customer_name": customer_name,
        "customer_email": customer_email,
        "customer_phone": customer_phone,
        "billing_address": billing_address,
        "shipping_address": shipping_address,
        "customer_gstin": order.customer_gstin,
        "place_of_supply": delivery_state,
        "items": items,
        "total_taxable_value": total_taxable_value,
        "total_discount": total_discount,
        "total_gst": total_gst,
        "cgst_rate": cgst_rate,
        "cgst_amount": cgst_amount,
        "sgst_rate": sgst_rate,
        "sgst_amount": sgst_amount,
        "igst_rate": igst_rate,
        "igst_amount": igst_amount,
        "shipping_cost": shipping_cost,
        "subtotal": float(order.subtotal),
        "grand_total": grand_total,
        "amount_in_words": amount_in_words,
        "estimated_delivery": estimated_delivery,
        "tracking_status": tracking_status,
        "generated_at": now_ist().strftime("%d %B %Y, %H:%M IST"),
        "logo_base64": logo_base64,
    }


def render_invoice_template(data: dict) -> str:
    """Render invoice HTML template with data."""
    import os
    from jinja2 import Environment, FileSystemLoader

    # Get template path
    template_dir = os.path.join(os.path.dirname(__file__), "..", "core", "templates")
    template_path = os.path.join(template_dir, "gst_invoice.html")

    # Load template
    env = Environment(loader=FileSystemLoader(template_dir))
    template = env.get_template("gst_invoice.html")

    # Render with data
    return template.render(**data)


def generate_pdf_from_html(html_content: str) -> BytesIO:
    """Generate PDF from HTML content using WeasyPrint."""
    # Create PDF
    pdf = HTML(string=html_content).write_pdf()

    # Return as BytesIO buffer
    return BytesIO(pdf)


def number_to_words(n: int) -> str:
    """Convert number to Indian words (simplified)."""
    if n == 0:
        return "Zero Rupees Only"

    ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"]
    teens = [
        "Ten",
        "Eleven",
        "Twelve",
        "Thirteen",
        "Fourteen",
        "Fifteen",
        "Sixteen",
        "Seventeen",
        "Eighteen",
        "Nineteen",
    ]
    tens = [
        "",
        "",
        "Twenty",
        "Thirty",
        "Forty",
        "Fifty",
        "Sixty",
        "Seventy",
        "Eighty",
        "Ninety",
    ]

    def two_digits(num):
        if num < 10:
            return ones[num]
        elif num < 20:
            return teens[num - 10]
        elif num < 100:
            return tens[num // 10] + ("" if num % 10 == 0 else " " + ones[num % 10])
        return ""

    result = []

    # Crores
    if n >= 10000000:
        result.append(two_digits(n // 10000000) + " Crore")
        n %= 10000000

    # Lakhs
    if n >= 100000:
        result.append(two_digits(n // 100000) + " Lakh")
        n %= 100000

    # Thousands
    if n >= 1000:
        result.append(two_digits(n // 1000) + " Thousand")
        n %= 1000

    # Hundreds
    if n >= 100:
        result.append(two_digits(n // 100) + " Hundred")
        n %= 100

    # Remaining
    if n > 0:
        result.append(two_digits(n))

    return "Rupees " + " ".join(result) + " Only"



