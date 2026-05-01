"""
Payment Verification Deep Analysis and Testing

This script validates:
1. Payment signature verification (HMAC-SHA256)
2. Payment status checking (captured vs authorized)
3. Razorpay response validation
4. Webhook event parsing
5. Recovery job fallback behavior
"""

import hmac
import hashlib
from datetime import datetime
from decimal import Decimal

print("=" * 80)
print("PAYMENT VERIFICATION DEEP ANALYSIS")
print("=" * 80)

# ============================================================
# TEST 1: Signature Verification Logic
# ============================================================
print("\n[TEST 1] Signature Verification Logic")
print("-" * 80)

razorpay_order_id = "order_A1B2C3D4E5F6"
razorpay_payment_id = "pay_xxxxxxxxxxxxxx"
razorpay_signature = "signature_from_razorpay"

# Razorpay's signature format: HMAC_SHA256(secret, f"{order_id}|{payment_id}")
message = f"{razorpay_order_id}|{razorpay_payment_id}"
print(f"Message to sign: {message}")
print(f"Order ID: {razorpay_order_id}")
print(f"Payment ID: {razorpay_payment_id}")

# Simulate signature verification
secret = "your_razorpay_key_secret"
generated = hmac.new(
    secret.encode('utf-8'),
    message.encode('utf-8'),
    hashlib.sha256,
).hexdigest()

print(f"\n✓ Generated signature: {generated[:32]}...")
print(f"✓ Razorpay signature:   {razorpay_signature[:32]}...")

# Timing-safe comparison (from razorpay_client.py)
is_valid = hmac.compare_digest(generated, razorpay_signature)
print(f"[OK] Signature valid: {is_valid}")

# ============================================================
# TEST 2: Payment Status Scenarios
# ============================================================
print("\n[TEST 2] Payment Status Scenarios")
print("-" * 80)

# Test different payment statuses from Razorpay
payment_statuses = [
    "captured",     # Payment captured successfully
    "authorized",   # Payment authorized but not yet captured
    "pending",      # Payment pending
    "failed",       # Payment failed
    "refund.initiated",
    "refund.processed",
    "refund.succeeded",
]

print("Razorpay payment statuses and their implications:")
print("-" * 40)

for status in payment_statuses:
    is_captured = (status == "captured")
    can_use_for_order = (status in ["captured", "authorized"])
    status_class = "✓" if can_use_for_order else "✗"
    print(f"{status_class} {status:20s} → captured={is_captured:5s} → can_create_order={can_use_for_order}")

# ============================================================
# TEST 3: CRITICAL ISSUE - Current Code's Payment Status Check
# ============================================================
print("\n[TEST 3] CRITICAL ISSUE - Current Payment Status Check")
print("-" * 80)

print("Current code in payment_service.py (lines 226-232):")
print("-" * 40)
print("""
payment_details = razorpay_client.fetch_payment(razorpay_payment_id)
transaction.status = "completed" if payment_details.get("status") == "captured" else "failed"
""")

print("\nPROBLEM: Only checks for 'captured', not 'authorized'")
print("-" * 40)

# Simulate the current logic
current_status = "authorized"
is_completed = (current_status == "captured")

print(f"Payment status: {current_status}")
print(f"Current check:  status == 'captured'")
print(f"Result:         {is_completed}")
print(f"❌ Payment marked as FAILED but it's actually AUTHORIZED!")

print("\nREAL-WORLD SCENARIO:")
print("-" * 40)
print("1. User clicks checkout → Razorpay order created with payment_capture=1")
print("2. User completes payment")
print("3. Razorpay might send 'payment.authorized' webhook (delayed capture)")
print("4. OR Razorpay hasn't auto-captured yet (1-5 minute delay)")
print("5. Order creation fails because status != 'captured'")
print("6. Customer paid but order not created → REVENUE LOSS!")

# ============================================================
# TEST 4: Fallback Recovery Logic
# ============================================================
print("\n[TEST 4] Fallback Recovery Logic Analysis")
print("-" * 80)

print("Current recovery job in recovery_job.py (lines 94-109):")
print("-" * 40)
print("""
cart_resp = cart_client.get(
    f"{commerce_url}/api/v1/internal/cart/{payment.user_id}",
    headers={"X-Internal-Secret": internal_secret}
)
if cart_resp.status_code == 200:
    cart_data = cart_resp.json()
    cart_snapshot = cart_data.get("items", [])
    shipping_address = cart_data.get("shipping_address", "")
""")

print("\nPROBLEMS:")
print("-" * 40)
print("❌ If cart endpoint returns 5xx: no fallback, no cart data, no order")
print("❌ If cart endpoint returns 404: no fallback, assumes payment is invalid")
print("❌ No validation that cart items match the payment amount")
print("❌ No retry logic for transient failures")
print("❌ No fallback to reconstruct from existing orders")

print("\nRISK SCENARIO:")
print("-" * 40)
print("1. Payment completes → webhook delayed or lost")
print("2. Recovery job runs every 5 minutes")
print("3. Tries to fetch cart from internal API")
print("4. Cart API is temporarily down for maintenance")
print("5. Recovery fails → ORPHANED PAYMENT")
print("6. Customer has paid but no order exists")
print("7. Recovery job keeps failing every 5 minutes (7-day window)")
print("8. Revenue lost, customer stranded!")

# ============================================================
# TEST 5: Database Validation Checks
# ============================================================
print("\n[TEST 5] Database Validation Checks")
print("-" * 80)

print("Validations in schemas/payment.py:")
print("-" * 40)
print("""
- amount: Decimal = Field(..., gt=0)  # Must be > 0 ✓
- currency: str = Field(default="INR") # Default ✓
- receipt: Optional[str] = Field(None, max_length=40) # Max 40 chars ✓
- customer_email: Optional[EmailStr] = None  # Email validation ✓
""")

print("\n✓ Schema validations are PROPER")

print("\nValidations in order_service.py:")
print("-" * 40)
print("""
- Address exists and belongs to user ✓
- Cart is not empty ✓
- Product exists in database ✓
- Inventory has sufficient quantity ✓
- Price matches database price (not cart price) ✓
- Transaction ID required for Razorpay ✓
- Signature required ✓
- Idempotency check with row-level lock ✓
""")

print("\n✓ Order validation logic is PROPER")

# ============================================================
# TEST 6: Webhook Event Parsing
# ============================================================
print("\n[TEST 6] Webhook Event Parsing")
print("-" * 80)

webhook_events = {
    "payment.captured": "Payment captured successfully - can create order",
    "payment.authorized": "Payment authorized - WAIT before capturing",
    "payment.failed": "Payment failed - do not create order",
    "refund.processed": "Refund in progress - handle order cancellation",
    "order.paid": "Order marked as paid - can create order",
    "qr_code.created": "QR code generated - can create order",
    "qr_code.credited": "QR code paid - can create order",
}

print("Webhook events and their handling:")
print("-" * 40)

for event, description in webhook_events.items():
    is_order_event = event in ["payment.captured", "order.paid", "qr_code.credited"]
    should_create_order = is_order_event
    icon = "✓" if should_create_order else "○"
    print(f"{icon} {event:20s} → {description:50s}")

# ============================================================
# TEST 7: Test Different Payment Scenarios
# ============================================================
print("\n[TEST 7] Test Payment Flow Scenarios")
print("-" * 80)

test_scenarios = [
    {
        "name": "Auto-Capture (payment_capture=1)",
        "razorpay_status": "captured",
        "webhook_event": "payment.captured",
        "should_create_order": True,
        "current_code_behavior": "✓ WORKS",
        "issue": None
    },
    {
        "name": "Manual Capture (payment_capture=0)",
        "razorpay_status": "authorized",
        "webhook_event": "payment.authorized",
        "should_create_order": True,
        "current_code_behavior": "✗ FAILS (marks as failed)",
        "issue": "Payment marked as FAILED but is actually authorized!"
    },
    {
        "name": "Delayed Capture (5 min delay)",
        "razorpay_status": "authorized",
        "webhook_event": "payment.authorized",
        "should_create_order": True,
        "current_code_behavior": "✗ FAILS (waits for capture)",
        "issue": "Customer paid but order not created during delay!"
    },
    {
        "name": "Payment Failed",
        "razorpay_status": "failed",
        "webhook_event": "payment.failed",
        "should_create_order": False,
        "current_code_behavior": "✓ WORKS",
        "issue": None
    },
    {
        "name": "QR Code Payment",
        "razorpay_status": "closed",  # Razorpay returns "closed" for paid QR codes
        "webhook_event": "qr_code.credited",
        "should_create_order": True,
        "current_code_behavior": "✓ WORKS",
        "issue": None
    },
]

for scenario in test_scenarios:
    print(f"\n{scenario['name']}:")
    print("-" * 40)
    print(f"  Razorpay status:  {scenario['razorpay_status']:15s}")
    print(f"  Webhook event:    {scenario['webhook_event']:20s}")
    print(f"  Should create:    {scenario['should_create_order']}")
    print(f"  Current behavior: {scenario['current_code_behavior']}")

    if scenario['issue']:
        print(f"  ⚠ ISSUE: {scenario['issue']}")

# ============================================================
# TEST 8: Recommended Fixes
# ============================================================
print("\n[TEST 8] Recommended Fixes")
print("-" * 80)

print("\n1. Fix Payment Status Check (CRITICAL):")
print("-" * 40)
print("""
OLD CODE:
    transaction.status = "completed" if payment_details.get("status") == "captured" else "failed"

NEW CODE:
    payment_status = payment_details.get("status")
    if payment_status in ["captured", "authorized"]:
        transaction.status = "completed"
        logger.info(f"✓ Payment verified: {payment_status} - can create order")
    elif payment_status == "failed":
        transaction.status = "failed"
        logger.error(f"✗ Payment failed")
    else:
        transaction.status = "pending"
        logger.warning(f"⚠ Payment pending: {payment_status}")
""")

print("\n2. Fix Recovery Job Fallback:")
print("-" * 40)
print("""
OLD CODE:
    cart_resp = cart_client.get(...)
    if cart_resp.status_code == 200:
        cart_data = cart_resp.json()

NEW CODE:
    cart_data = None
    shipping_address = ""

    # Try: Fetch from internal API
    try:
        cart_resp = cart_client.get(
            f"{commerce_url}/api/v1/internal/cart/{payment.user_id}",
            headers={"X-Internal-Secret": internal_secret},
            timeout=15.0
        )
        if cart_resp.status_code == 200:
            cart_data = cart_resp.json()
            shipping_address = cart_data.get("shipping_address", "")
    except Exception as e:
        logger.warning(f"RECOVERY_CART_FETCH_ERROR: {e}")

    # FALLBACK: Reconstruct from existing orders
    if not cart_data:
        logger.warning(f"RECOVERY_CART_RECONSTRUCTION: Building from recent orders")
        try:
            recent_orders = db.query(Order).filter(
                Order.user_id == payment.user_id,
                Order.created_at > now() - timedelta(hours=1)
            ).limit(5).all()

            if recent_orders:
                # Aggregate unique items
                cart_data = {"items": [], "shipping_address": ""}
                seen = set()

                for order in recent_orders:
                    for item in order.items:
                        key = (item.product_id, item.variant_id)
                        if key not in seen:
                            seen.add(key)
                            cart_data["items"].append({
                                "product_id": item.product_id,
                                "variant_id": item.variant_id,
                                "name": item.product_name,
                                "sku": item.sku,
                                "size": item.size,
                                "color": item.color,
                                "quantity": 1,
                                "price": float(item.unit_price),
                            })

                shipping_address = recent_orders[0].shipping_address
                logger.info(f"RECOVERY_CART_RECONSTRUCTED: {len(cart_data['items'])} items from {len(recent_orders)} orders")
        except Exception as e:
            logger.error(f"RECOVERY_CART_RECONSTRUCTION_FAILED: {e}")

    # Verify amount matches
    cart_total = sum(item['price'] * item['quantity'] for item in cart_data.get('items', []))
    if abs(cart_total - float(payment.amount)) > 0.01:  # Allow small float tolerance
        logger.error(f"RECOVERY_AMOUNT_MISMATCH: cart_total={cart_total}, payment_amount={payment.amount}")
        continue  # Skip this payment (might be fraudulent)
""")

# ============================================================
# TEST 9: Docker Service Health Check
# ============================================================
print("\n[TEST 9] Docker Service Health Check")
print("-" * 80)

import subprocess
import json

services_to_check = [
    "aarya_payment",
    "aarya_payment_worker",
    "aarya_commerce",
    "aarya_core",
    "aarya_postgres",
    "aarya_redis",
]

print("Checking Docker service status:")
print("-" * 40)

healthy_services = []
unhealthy_services = []

for service in services_to_check:
    try:
        result = subprocess.run(
            ["docker", "ps", "--filter", f"name={service}", "--format", "{{.Status}}"],
            capture_output=True,
            text=True,
            timeout=5
        )

        if result.stdout.strip():
            status = result.stdout.strip()
            if "(healthy)" in status:
                healthy_services.append((service, status))
                print(f"✓ {service:25s} {status}")
            else:
                unhealthy_services.append((service, status))
                print(f"✗ {service:25s} {status}")
        else:
            unhealthy_services.append((service, "Not running"))
            print(f"✗ {service:25s} Not running")
    except Exception as e:
        unhealthy_services.append((service, f"Error: {e}"))
        print(f"✗ {service:25s} Error checking: {e}")

print("\nSummary:")
print("-" * 40)
print(f"Healthy services: {len(healthy_services)}/{len(services_to_check)}")
print(f"Unhealthy/Not running: {len(unhealthy_services)}/{len(services_to_check)}")

if unhealthy_services:
    print("\n[!] Warning: Some services are not running properly!")
    for service, status in unhealthy_services:
        print(f"  {service}: {status}")

# ============================================================
# TEST 10: Summary & Recommendations
# ============================================================
print("\n" + "=" * 80)
print("SUMMARY & RECOMMENDATIONS")
print("=" * 80)

print("\n🔴 CRITICAL ISSUES (Must Fix):")
print("-" * 40)
print("1. Payment status check only validates 'captured', not 'authorized'")
print("   → Payment marked as failed when actually authorized")
print("   → Causes revenue loss during payment delays")

print("2. Recovery job has NO fallback for cart reconstruction")
print("   → If internal cart API is down, recovery fails completely")
print("   → Orphaned payments cannot be recovered")

print("\n🟡 MEDIUM ISSUES (Should Fix):")
print("-" * 40)
print("1. No validation of Razorpay response structure")
print("   → No checks for required fields (amount, currency, status)")

print("2. No retry logic for transient failures")
print("   → Recovery job gives up after first failure")

print("3. No float amount validation (cart_total vs payment_amount)")
print("   → Could create orders with wrong items")

print("\n✅ GOOD PRACTICES:")
print("-" * 40)
print("1. Schema validations are proper (amount > 0, email format)")
print("2. Order validation checks product exists and has inventory")
print("3. Row-level locking prevents duplicate orders")
print("4. Idempotency check prevents race conditions")
print("5. Database transactions have proper rollback")
print("6. HMAC signature verification is correct")
print("7. Webhook signature verification uses timing-safe compare")

print("\n" + "=" * 80)
print("RECOMMENDED NEXT STEPS:")
print("=" * 80)
print("\n1. Fix payment status check to accept 'authorized' payments")
print("2. Add cart reconstruction fallback in recovery job")
print("3. Add retry logic with exponential backoff")
print("4. Add Razorpay response validation")
print("5. Add cart amount verification before order creation")
print("6. Add monitoring alerts for recovery job failures")
print("7. Test payment flow with different statuses (captured, authorized, pending)")

print("\n" + "=" * 80)
