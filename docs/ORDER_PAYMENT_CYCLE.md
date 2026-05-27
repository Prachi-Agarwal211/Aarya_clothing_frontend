# Aarya Clothing — Order & Payment Cycle

> **Last Updated:** May 21, 2026
> **Scope:** Full lifecycle from checkout → payment → order creation → webhook recovery, including known bugs and race conditions

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Data Models](#2-data-models)
3. [Frontend Checkout Flow](#3-frontend-checkout-flow)
4. [Backend Order & Payment Cycle](#4-backend-order--payment-cycle)
5. [Payment Gateway Integration (Razorpay)](#5-payment-gateway-integration-razorpay)
6. [Webhook Recovery & Race Conditions](#6-webhook-recovery--race-conditions)
7. [Invoice Generation](#7-invoice-generation)
8. [Known Issues & Messy Areas](#8-known-issues--messy-areas)
9. [The Duplicate Order Bug — Root Cause Analysis](#9-the-duplicate-order-bug--root-cause-analysis)
10. [Implemented Fixes — Distributed Locks + Race Condition Defenses](#10-implemented-fixes--distributed-locks--race-condition-defenses)
11. [Architecture Modernization — Single-Path Order Creation](#11-architecture-modernization--single-path-order-creation)
12. [Remaining Issues (Out of Scope)](#12-remaining-issues-out-of-scope)

---

## 1. Architecture Overview

### Services Involved

| Service | Role | Key Files |
|---------|------|-----------|
| **commerce** | Order management, cart, products, pending orders | `service/order_service.py`, `routes/orders.py`, `routes/customer_orders.py`, `routes/internal.py` |
| **payment** | Razorpay integration, transactions, webhooks, QR codes | `service/payment_service.py`, `main.py` |
| **frontend** | Next.js checkout UI | `app/checkout/payment/page.js`, `app/checkout/confirm/page.js` |

### Communication Pattern

```
Frontend (Next.js)
    │
    ├── POST /payment/create-order ─────────→ Payment Service
    │                                            │
    │                                   POST /internal/prepare ──→ Commerce (PendingOrder)
    │                                            │
    │                                   Razorpay API (create order)
    │                                            │
    ├── POST /orders (register_payment) ────→ Commerce (202 ACCEPTED)
    │   (verifies signature, snapshots cart, returns immediately)
    │   └── POST /verify-signature ────→ Payment Service
    │
    ├── GET /orders/by-payment/{id} ────────→ Commerce (poll every 2s)
    │   (returns order once webhook creates it, or {found: false})
    │
    ├── Razorpay Redirect ──→ Payment /redirect-callback ──→ Frontend /confirm
    │
    └── Razorpay Webhook ───→ Payment /webhooks/razorpay  ★ SINGLE SOURCE OF TRUTH
                │
                └── POST /internal/create-from-payment ──→ Commerce (creates order)
```

**Key architectural change:** The Razorpay webhook is now the **single source of truth** for order creation. The frontend `POST /orders` endpoint only registers the payment (verifies signature + snapshots cart) and returns HTTP 202 Accepted. The frontend then polls `GET /orders/by-payment/{payment_id}` until the webhook creates the order. This eliminates the TOCTOU race condition entirely.

---

## 2. Data Models

### PendingOrder (commerce DB — `pending_orders` table)

Created BEFORE payment to snapshot the cart. Prevents data loss if cart is cleared before order creation.

```python
class PendingOrder(Base):
    __tablename__ = "pending_orders"
    user_id           # FK to users
    cart_snapshot     # JSONB — full cart at time of checkout initiation
    shipping_address  # Text — address snapshot
    razorpay_order_id # order_xxx (set during create-order)
    total_amount, subtotal, discount_applied, shipping_cost
    status            # 'pending' → 'order_created'
    order_id          # FK to orders (set after successful order creation)
    expires_at        # 30 min TTL
```

**Key fact:** Created in `create_pending_order()`. Status becomes `'order_created'` after order is created.

### Order (commerce DB — `orders` table)

```python
class Order(Base):
    __tablename__ = "orders"
    user_id
    transaction_id        # pay_xxx or txn_xxx (links to PaymentTransaction)
    razorpay_order_id     # order_xxx
    razorpay_payment_id   # pay_xxx
    invoice_number        # INV-2026-000001
    subtotal, total_amount, shipping_cost, gst breakdown
    status                # CONFIRMED, SHIPPED, DELIVERED, CANCELLED
    shipping_address      # Text snapshot
    pending_order_id      # Links back to PendingOrder
    invoice_pdf_url       # R2 URL after PDF generation
    
    __table_args__ = UniqueConstraint('transaction_id', 'user_id')
```

**🚨 CRITICAL:** Orders are created with `status = CONFIRMED` immediately — there is NO pending/preliminary order status. This means if an order is created at all, it shows as confirmed.

### PaymentTransaction (payment DB — `payment_transactions` table)

```python
class PaymentTransaction(Base):
    __tablename__ = "payment_transactions"
    order_id              # FK to orders (may be NULL at creation time!)
    user_id
    amount, currency
    payment_method        # 'razorpay' or 'upi_qr'
    razorpay_order_id     # order_xxx
    razorpay_payment_id   # pay_xxx
    razorpay_signature    # HMAC signature
    razorpay_qr_code_id   # QR code ID
    transaction_id        # txn_YYYYMMDDHHMMSS_XXXXXXXX (unique!)
    status                # pending → completed / failed / refunded
    gateway_response      # JSON — full Razorpay response
```

---

## 3. Frontend Checkout Flow

### Step-by-Step: Standard Razorpay Checkout

**File:** `app/checkout/payment/page.js`

```
1. User clicks "Pay ₹X Securely"
   → handleDirectPayment()

2. Validate stock → cartApi.validateStock()
   POST /api/v1/cart/validate-stock

3. Create Razorpay order → paymentApi.createRazorpayOrder()
   POST /api/v1/payments/razorpay/create-order
   Body: { amount, currency, receipt, cart_snapshot, shipping_address, notes }

   ↓↓↓ BACKEND (create_razorpay_order in payment/main.py) ↓↓↓
   
   a. Creates PaymentTransaction (status: pending)
      gateway_response stores: { cart_snapshot, shipping_address, created_during }
   
   b. Calls POST /api/v1/orders/internal/orders/prepare
      → Creates PendingOrder in commerce DB
      → Stores pending_order_id in gateway_response
   
   c. Calls Razorpay API: client.create_order()
      → Updates Razorpay order notes with pending_order_id for webhook recovery
      
   d. Returns { id: "order_xxx", amount, currency }
   
4. Build hidden HTML form → POST to https://api.razorpay.com/v1/checkout/embedded
   Fields: key_id, order_id, amount, currency, callback_url, cancel_url, redirect=true
   
5. Browser navigates to Razorpay → user pays
```

### Step-by-Step: After Payment (NEW architecture)

**File:** `app/checkout/confirm/page.js`

```
1. Razorpay redirects browser to /redirect-callback
   → Payment service verifies HMAC signature
   → Redirects to /checkout/confirm?payment_id=pay_xxx&razorpay_order_id=order_xxx&razorpay_signature=xyz

2. Frontend reads URL params → stores in sessionStorage IMMEDIATELY (useEffect with []) 
   Keys: payment_id, razorpay_order_id, payment_signature, qr_code_id

3. After auth check → registerAndPoll()

4. Build payload from sessionStorage:
   { address_id, payment_method, transaction_id, razorpay_order_id,
     razorpay_signature, pending_order_id, qr_code_id }

5. POST /api/v1/orders → customer_orders.py register_payment()
   Returns HTTP 202 Accepted immediately

   ↓↓↓ BACKEND (order_service.register_payment) ↓↓↓
   
   a. PAYMENT VERIFICATION:
      POST /verify-signature (HMAC check)
   
   b. IDEMPOTENCY CHECK via _find_existing_order():
      Checks by transaction_id, razorpay_order_id, pending_order_id
      If order exists → return it immediately (200 with order)
   
   c. SNAPSHOT CART as PendingOrder (if not already created)
   
   d. Mark pending as 'payment_confirmed'
   
   e. Clear Redis cart (release stock reservations)
   
   f. Return { status: 'payment_registered', payment_id, pending_order_id }

6. Frontend starts POLLING GET /api/v1/orders/by-payment/{payment_id}
   Every 2 seconds, max 60 seconds timeout

7. Razorpay WEBHOOK fires → Payment /webhooks/razorpay
   → POST /internal/create-from-payment → Commerce
   → Creates order via create_order_from_pending_id() or create_order_from_pending_order()

8. Poll succeeds → order found → show confirmation page
```

### UPI QR Code Flow

```
1. User clicks "Generate QR Code"
   → handleQrPayment()

2. Validate stock → same as standard

3. POST /api/v1/payments/razorpay/create-qr-code
   → Creates PaymentTransaction (status: pending, payment_method: upi_qr)
   → Prepares PendingOrder via /internal/orders/prepare
   → Creates Razorpay QR code → returns { qr_code_id, image_url }

4. Display QR code → start polling every 3s → POST /qr-status/{code}

5. When status = "paid" → redirect to /checkout/confirm?qr_code_id=xxx

6. confirm/page.js creates order with qr_code_id
   → Backend verifies QR status via Razorpay API
   → Creates order
```

---

## 4. Backend Order & Payment Cycle

### 4.1 Order Creation (`create_order` in order_service.py)

This is the PRIMARY path — called by the frontend after successful payment.

```
create_order(user_id, shipping_address, address_id, order_notes,
             transaction_id, payment_method, payment_signature,
             razorpay_order_id, qr_code_id, paym

## 10. Complete Fix Log — Round 1: Race Condition + Distributed Locks

### ✅ Distributed Redis Locks (All 3 Creation Paths)

Added `_acquire_order_lock()` and `_release_order_lock()` helper functions using Redis SET NX EX with Lua-script-based safe release.

- **`register_payment()`** — acquires lock on `order_lock:{payment_id}` before idempotency check. Falls back to `_find_existing_order()` if lock times out.
- **`create_order_from_pending_id()`** — webhook recovery by pending_order_id, lock released in `finally` block.
- **`create_order_from_pending_order()`** — webhook recovery by snapshot data, lock released in `finally` block.
- **`internal.py` create-from-payment** — secondary lock on `order:lock:{payment_id}` prevents duplicate webhook processing. Async retry loop with `asyncio.sleep()`. Lock released in all exit paths.

All methods have duplicate handling: if lock can't be acquired → `_find_existing_order()`. If `IntegrityError` fires → rollback → `_find_existing_order()`.

### ✅ Expanded Idempotency Checks (`_find_existing_order()`)

Checks by **4 dimensions**: `(transaction_id, user_id)`, `(razorpay_order_id, user_id)`, `pending_order_id`, `razorpay_payment_id` (5-min window).

### ✅ Payment Service Cleanup

- `_preserve_checkout_meta()` helper replaces 3 copy-pasted `_checkout_meta` preservation blocks.
- `_link_payment_to_order()` helper replaces 2 raw SQL `UPDATE orders` blocks with HTTP POST to commerce `/link-payment-details` endpoint.

### ✅ Syntax Bug Fix

Removed bare `try:` with no `except/finally` that would crash on any exception.

---

## 11. Complete Fix Log — Round 2: Single-Path Architecture + Recovery Cleanup

### ✅ Frontend → Register + Poll (Single Path)

- `POST /api/v1/orders` now calls `register_payment()` — verifies signature, snapshots cart as pending_order, returns HTTP 202 Accepted. Does **NOT** create the order.
- `GET /api/v1/orders/by-payment/{payment_id}` polling endpoint added. Polls every 2s, 60s timeout.
- Frontend confirm page refactored: `registerAndPoll()` replaces `createOrderAndRedirect()`.
- `customerApi.js` — added `registerPayment()` and `getByPayment()`. Removed `ordersApi.create()` call.
- Webhook remains the **single source of truth** for order creation.

### ✅ `orders.py recover-from-payment` Cleanup

- **3 verification paths collapsed into 1** `_verify_payment_captured()` helper: Payment Service API → direct Razorpay API fallback.
- **`from time import sleep` removed** — was blocking the event loop in `async def`. Replaced with `await asyncio.sleep()`.
- **Zero-amount minimal order removed** — cart-empty recovery now returns HTTP 202 instead of creating a trash order.
- Uses `find_order_by_payment()` + `register_payment(skip_signature_verification=True)` instead of direct DB queries.

### ✅ Cross-Service SQL Migration

- **`payment_service.py`** — 2 raw SQL `UPDATE orders ...` statements replaced with HTTP POST to `POST /api/v1/internal/orders/{order_id}/link-payment-details`.
- **`internal.py`** — Added `/link-payment-details` endpoint that updates `order.transaction_id`, `order.razorpay_payment_id`, `order.razorpay_order_id`, `order.payment_method`.

---

## 12. Still Open (Minor / Low Risk)

1. **`_handle_qr_code_event` in payment_service.py** — has a raw SQL `SELECT id FROM orders` read. Read-only, low risk.
2. **SessionStorage fragility** — params stored in sessionStorage can be lost on tab close.
3. **No test coverage** — no unit tests for the lock behavior, poll flow, or recovery strategies.
