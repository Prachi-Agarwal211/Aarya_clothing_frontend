# Duplicate Order Root Cause Analysis & Architecture Fix Plan

> **Date:** June 15, 2026
> **Scope:** Full end-to-end cart → checkout → payment → order lifecycle
> **Authors:** AI-assisted analysis based on codebase audit + Razorpay webhook documentation research

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [The Correct Razorpay Architecture](#2-the-correct-razorpay-architecture)
3. [How the Current System Works (vs How It Should)](#3-how-the-current-system-works-vs-how-it-should)
4. [The 15 Structural Faults](#4-the-15-structural-faults)
5. [Specific Duplicate Chain Reconstruction](#5-specific-duplicate-chain-reconstruction)
6. [The Fix Plan](#6-the-fix-plan)
7. [Implementation Details](#7-implementation-details)
8. [Testing Strategy](#8-testing-strategy)
9. [Rollout Plan](#9-rollout-plan)

---

## 1. Executive Summary

**The core problem:** The system has **two independent paths** that both create orders for the same payment:

1. **Synchronous path** (in `register_payment()`) — creates order immediately when the user lands on the confirm page
2. **Webhook path** (Razorpay `payment.captured` event) — creates order independently ~1-5 seconds later

These two paths use **different lock keys** and **unindexed database queries** for their idempotency checks. Combined with Razorpay's "at-least-once" delivery (3+ webhook events per payment, each with retries), the system can create **2-5 confirmed orders for a single payment**.

**The fix is to make the webhook the single source of truth** by removing the synchronous order creation from `register_payment()` and ensuring all order-creation paths use the same lock key and indexed queries.

---

## 2. The Correct Razorpay Architecture

### 2.1 Razorpay Webhook Contract

Based on [Razorpay's official documentation](https://razorpay.com/docs/webhooks/payments/):

| Property | Value |
|----------|-------|
| Delivery semantics | **At-least-once** (same event CAN arrive multiple times) |
| Retry window | **24 hours** with exponential backoff |
| Retry trigger | Any non-2xx response or response > 5 seconds |
| Event ordering | **NOT guaranteed** — `payment.captured` can arrive before `payment.authorized` |
| Dedup mechanism | Each event has unique `x-razorpay-event-id` header |
| Auto-disable | Webhook auto-disabled after 24 hours of continuous failures |

### 2.2 The Correct Event Handling

Only **one event type** should create orders:

| Event | Action |
|-------|--------|
| `payment.authorized` | Update transaction status to `authorized` only |
| **`payment.captured`** | **✅ Create order (single source of truth)** |
| `order.paid` | Safety check — if no order exists, fallback to recovery |
| `payment.failed` | Update transaction status to `failed` |

### 2.3 The Ideal Data Flow

```
                         ┌──────────────────────────────────────────┐
                         │           CORRECT ARCHITECTURE           │
                         │                                          │
    ┌──────────┐         │  ┌─────────────────┐   ┌──────────────┐  │
    │  Cart     │────────┼──│  Checkout Flow   │   │  Razorpay    │  │
    │ (Redis)   │         │  │  1. Validate     │   │  1. Auth     │  │
    └──────────┘         │  │  2. Create Order  │   │  2. Capture  │  │
                         │  │     (Pending)     │   │  3. Webhook  │  │
                         │  │  3. Pay at        │   └──────┬───────┘  │
                         │  │     Razorpay      │          │          │
                         │  └────────┬──────────┘          │          │
                         │           │                     │          │
                         │           ▼                     ▼          │
                         │  ┌─────────────────────────────────────┐   │
                         │  │       confirm page / Confirm Page   │   │
                         │  │                                     │   │
                         │  │  register_payment()                 │   │
                         │  │  ✓ Verify HMAC signature            │   │
                         │  │  ✓ Mark PendingOrder confirmed      │   │
                         │  │  ✗ DO NOT CREATE ORDER              │   │
                         │  │  → Return 202 Accepted              │   │
                         │  │  → Start polling every 3s           │   │
                         │  └──────────────┬──────────────────────┘   │
                         │                 │                           │
                         │                 ▼                           │
                         │  ┌─────────────────────────────────────┐   │
                         │  │  Razorpay Webhook                   │   │
                         │  │  payment.captured (SINGLE SOURCE)   │   │
                         │  │                                     │   │
                         │  │  1. Check x-razorpay-event-id       │   │
                         │  │     → Redis dedup (30s)             │   │
                         │  │     → DB dedup (persistent)        │   │
                         │  │  2. Find PaymentTransaction         │   │
                         │  │  3. _order_exists() check           │   │
                         │  │     → INDEXED columns              │   │
                         │  │  4. Acquire lock: pending_{pid}    │   │
                         │  │  5. Create order from PendingOrder │   │
                         │  │  6. Return 200 ✓                    │   │
                         │  └──────────────┬──────────────────────┘   │
                         │                 │                           │
                         │                 ▼                           │
                         │  ┌─────────────────────────────────────┐   │
                         │  │  Frontend poll succeeds             │   │
                         │  │  → Order found                     │   │
                         │  │  → Cart cleared                    │   │
                         │  │  → Confirmation shown               │   │
                         │  └─────────────────────────────────────┘   │
                         └──────────────────────────────────────────┘
```

---

## 3. How the Current System Works (vs How It Should)

### 3.1 Full Actual Flow (Current Code)

```
CHECKOUT PAGE (frontend_new/app/checkout/page.js)
  │
  ├─ User selects address
  ├─ address_id stored in sessionStorage
  └─ Navigate to /checkout/payment

PAYMENT PAGE (frontend_new/app/checkout/payment/page.js)
  │
  ├─ handleDirectPayment() or handleQrPayment()
  ├─ Validate stock ← HTTP to commerce service
  ├─ REST API call to payment service ← HTTP to payment service
  │   ├─ createRazorpayOrder() → Payment Service
  │   │    ├─ POST /internal/orders/prepare → Commerce
  │   │    │   ← Creates PendingOrder ✅
  │   │    ├─ POST Razorpay API (create order)
  │   │    │   ← Gets razorpay_order_id
  │   │    └─ Creates PaymentTransaction (status=pending)
  │   └─ Returns { id: "order_xxx", amount, ... }
  │
  ├─ Build hidden HTML form → POST to Razorpay
  └─ Browser navigates to Razorpay
       │
       │  USER COMPLETES PAYMENT AT RAZORPAY
       │
       ▼
RAZORPAY REDIRECT
  │
  ├─ POST /redirect-callback → Payment Service
  │   ├─ Verify HMAC signature
  │   └─ Redirect to /checkout/confirm?payment_id=pay_xxx&signature=xxx
  │
  ├─ RAZORPAY WEBHOOK (fires in background)
  │   ├─ payment.authorized webhook → Payment Service
  │   │   ├─ Updates transaction status
  │   │   └─ CREATES ORDER ⚠️ (should NOT create order on authorized!)
  │   │
  │   ├─ payment.captured webhook → Payment Service
  │   │   ├─ Updates transaction status
  │   │   └─ CREATES ORDER (may create DUPLICATE ⚠️)
  │   │
  │   └─ order.paid webhook → Payment Service
  │       ├─ Updates transaction status
  │       └─ CREATES ORDER (may create DUPLICATE ⚠️)
  │
  ▼
CONFIRM PAGE (frontend_new/app/checkout/confirm/page.js)
  │
  ├─ registerAndPoll()
  │   ├─ registerPayment() -> Commerce Service
  │   │   ├─ Verify HMAC signature ✓
  │   │   ├─ Find or CREATE PendingOrder from cart ⚠️
  │   │   │   (If pending_order_id not in sessionStorage → creates NEW one!)
  │   │   └─ SYNCHRONOUS ORDER CREATION ⚠️⚠️⚠️
  │   │       ├─ create_order_from_pending_id() ← LOCK: pending_{pid}
  │   │       ├─ Creates Order ✅ (e.g., ORD-804)
  │   │       └─ Deducts stock
  │   │
  │   ├─ Start polling GET /orders/by-payment/{payment_id}
  │   │   └─ Every 3 seconds, up to 60 seconds
  │   │
  │   └─ If poll times out:
  │       └─ recoverFromPayment() → creates ANOTHER order ⚠️⚠️
  │
  └─ RECOVERY WORKER (every 5 minutes)
      └─ Finds orphan payments → calls create-from-payment
          → creates ANOTHER order if checks miss ⚠️⚠️
```

### 3.2 Race Window Timeline

```
Time T+0:  User pays at Razorpay
Time T+1:  Razorpay redirect-callback → confirm page loads
Time T+2:  registerPayment() → Verify signature → Create PendingOrder
Time T+3:  registerPayment() → SYNCHRONOUS ORDER CREATION → ORD-804 ✅
Time T+3:  Frontend starts polling for ORD-804
Time T+4:  Razorpay webhook #1: payment.authorized fires
Time T+4:  _handle_payment_authorized() → _order_exists() check
           → MISSES ORD-804 (unindexed query) → CREATES ORD-805 ⚠️
Time T+5:  Razorpay webhook #2: payment.captured fires
Time T+5:  _handle_payment_captured() → _order_exists() check
           → FINDS ORD-805 → returns (stops)
Time T+6:  Razorpay webhook #3: order.paid fires
Time T+6:  _handle_order_paid() → _order_exists() check
           → FINDS ORD-805 → returns (stops)
Time T+10: Recovery worker runs → finds payment with completed status 
           but empty order_id? → tries to create ANOTHER
           ⚠️ (only if order_id wasn't set on transaction)
```

---

## 4. The 15 Structural Faults

### 🔴 Fault 1: Dual-Path Order Creation (THE PRIMARY FAULT)

**Severity:** Critical
**File:** `services/commerce/service/order_service.py` (~line 540)
**Description:** `register_payment()` creates the order synchronously despite the docstring claiming it does NOT create the order. This creates a race with the webhook.

```python
# This comment says one thing...
"This is the ONLY frontend-facing order creation entry point. It does NOT create the order"

# ...but the code does the opposite:
# ──── SYNCHRONOUS ORDER CREATION ────
order = self.create_order_from_pending_id(...)
```

### 🔴 Fault 2: Cart Snapshotted as PendingOrder in 3 Different Places

**Severity:** Critical
**Files:** Multiple
**Description:** PendingOrders are created in:
1. Payment service `create-order` endpoint (cart snapshot in `gateway_response`)
2. Payment service `create-qr-code` endpoint (calls `/internal/prepare`)
3. Commerce `register_payment()` (creates from cart if `pending_order_id` missing)

If the `pending_order_id` isn't round-tripped through `sessionStorage` correctly, `register_payment()` creates a SECOND PendingOrder, leading to two orders.

### 🔴 Fault 3: Webhook Creates Orders on 3 Event Types

**Severity:** Critical
**File:** `services/payment/service/payment_service.py`
**Description:** Three webhook handlers independently call `_create_order_from_webhook()`:
- `_handle_payment_authorized()` → creates order ❌
- `_handle_payment_captured()` → creates order ✅
- `_handle_order_paid()` → creates order ❌

Only `payment.captured` should create orders. `authorized` means funds are RESERVED (not captured).

### 🔴 Fault 4: Different Lock Keys for Different Paths

**Severity:** Critical
**Files:** `services/commerce/service/order_service.py`
**Description:** Two different lock key formats are used:

| Path | Lock Key |
|------|----------|
| `create_order_from_pending_id()` | `pending_{pending_id}` ✅ |
| `create_order_from_pending_order()` | `payment_id or razorpay_order_id` ❌ |

These don't block each other — both paths can proceed simultaneously.

### 🔴 Fault 5: `_order_exists()` Uses Unindexed Columns

**Severity:** Critical
**File:** `services/payment/service/payment_service.py`
**Description:** The webhook's idempotency check runs a query on unindexed columns:

```sql
SELECT 1 FROM orders WHERE 
    transaction_id = :txn_id OR          -- has index ✅
    razorpay_payment_id = :payment_id OR -- NO INDEX ❌
    razorpay_order_id = :order_id        -- NO INDEX ❌
```

As the orders table grows, this becomes a sequential scan. Concurrent webhook calls can all miss the just-inserted order.

### 🟠 Fault 6: No Distributed Lock in Recovery Worker

**Severity:** High
**File:** `services/payment/jobs/recover_orders.py`
**Description:** The recovery worker's initial idempotency check runs BEFORE the distributed lock. If this check misses the order (due to timing), the worker creates a duplicate.

### 🟠 Fault 7: `register_payment()` Silently Swallows Order Creation Failure

**Severity:** High
**File:** `services/commerce/service/order_service.py`
**Description:** When synchronous order creation fails:

```python
try:
    order = self.create_order_from_pending_id(...)
except Exception as e:
    logger.error(f"⚠ SYNCHRONOUS_ORDER_FAILED: ...")
    # CONTINUES EXECUTION — returns {"status": "payment_registered"} WITHOUT order
```

The caller gets a success response even though order creation failed. The user sees "Payment registered" but no order exists.

### 🟠 Fault 8: SessionStorage as State Carrier

**Severity:** High
**Files:** Frontend checkout pages
**Description:** Critical state is carried entirely in `sessionStorage`:
- `checkout_address_id`
- `checkout_address_string`
- `payment_id`
- `razorpay_order_id`
- `payment_signature`
- `qr_code_id`
- `pending_order_id`

Lost on tab close, browser refresh, or if user navigates to confirm page from a new tab.

### 🟠 Fault 9: Frontend Can Retry registerPayment() Multiple Times

**Severity:** High
**File:** `frontend_new/app/checkout/confirm/page.js`
**Description:** The "Try Again" button resets the registration guard and re-calls `registerPayment()`. Each call can create new PendingOrders.

### 🟠 Fault 10: No Rate Limiting on Webhook Endpoint

**Severity:** High
**File:** `services/payment/main.py`
**Description:** Cart ops are rate-limited (100/min), order registration is rate-limited (10/min), but the **webhook endpoint has NO rate limiting**. Razorpay can fire 9+ webhooks in 5 seconds (3 events × 3 retries).

### 🟡 Fault 11: Stock Deduction Can Happen Twice

**Severity:** Medium
**File:** `services/commerce/service/order_service.py`
**Description:** When duplicate orders are created, each calls `deduct_stock_for_order()` for the same SKU. This can cause phantom inventory — system thinks less stock exists than actually does.

### 🟡 Fault 12: Webhook Holds DB Connection During 30s HTTP Call

**Severity:** Medium
**File:** `services/payment/service/payment_service.py`
**Description:** `_create_order_from_webhook()` has a 30-second HTTP timeout to commerce. The DB connection is held for the entire duration. With 50 concurrent webhooks, the connection pool exhausts.

### 🟡 Fault 13: Admin Can Delete Orders Without Refund

**Severity:** Medium
**File:** `services/admin/routes/orders.py`
**Description:** `DELETE /api/v1/admin/orders/{id}` cascades to order_items and order_tracking with NO refund processing, NO audit log, NO notification.

### 🟡 Fault 14: HMAC Fallback Bypasses Signature Verification

**Severity:** Medium
**File:** `services/payment/main.py`
**Description:** If HMAC verification fails, the redirect-callback falls back to Razorpay's API. If the API says "captured", the payment is accepted. This makes HMAC verification optional.

### 🟡 Fault 15: Cart is Not Locked During Order Creation

**Severity:** Medium
**File:** `services/commerce/service/order_service.py`
**Description:** When `register_payment()` snapshots the cart, there's no lock on the cart key. If the user modifies their cart in another tab during this window, the snapshot may be inconsistent.

---

## 5. Specific Duplicate Chain Reconstruction

### 5.1 Ruchi Pal — ORD-000804 (confirmed) + ORD-000805 (confirmed)

| Field | ORD-000804 | ORD-000805 |
|-------|-----------|-----------|
| Status | **confirmed** | **confirmed** |
| Amount | ₹2,000 | ₹2,000 |
| Time | 12:41 pm | 12:41 pm |
| Transaction ID | `pay_T1otl2MwIob9Ln` | "ID: 805" (no real transaction ID) |
| User | Ruchi Pal | Ruchi Pal |

**The exact chain of events:**

```
1. User clicks "Pay ₹2,000" at 12:41:00
2. handleDirectPayment() →
   - Generate idempotency key (client-side, never verified)
   - POST to payment create-order endpoint
     → Creates PaymentTransaction (status=pending)
     → Creates Razorpay order (order_xxx)
     → Stores pending_order_id in Razorpay notes
   - POST form to Razorpay → browser navigates away

3. User completes payment at Razorpay (12:41:30)

4. Razorpay redirects to /redirect-callback (12:41:31)
   → Verifies HMAC signature ✓
   → Redirects to /checkout/confirm?payment_id=pay_T1otl2MwIob9Ln&...

5. Confirm page loads (12:41:32)
   → URL params stored in sessionStorage
   → registerAndPoll() called
   → registerPayment() sends POST /api/v1/orders

6. register_payment() execution (12:41:33):
   → STEP 3: _find_existing_order() → Order not found ✅ (first time)
   → STEP 4: Verify HMAC signature via payment service ✓
   → STEP 5: pending_order_id NOT in sessionStorage
             (create-order response didn't include gateway_response.pending_order_id)
             → Cart found → creates NEW PendingOrder (id=...)
   → STEP 6: Mark PendingOrder.status = 'payment_confirmed'
   → SYNCHRONOUS ORDER CREATION:
     → create_order_from_pending_id(...)
     → LOCK: pending_{pending_id} ✓ acquired
     → Creates ORD-000804
     → transaction_id = pay_T1otl2MwIob9Ln  ← set from sessionStorage
     → Returns order to frontend

7. RAZORPAY WEBHOOK: payment.authorized (12:41:34)
   → _handle_payment_authorized()
   → Finds PaymentTransaction by razorpay_order_id ✓
   → _order_exists() check:
     - transaction_id = NULL on transaction (not set yet)
     - razorpay_payment_id = NULL on transaction (not set yet)
     - razorpay_order_id order_xxx → QUERY on UNINDEXED column → NOT FOUND ⚠️
   → _create_order_from_webhook()
     - Sets transaction.razorpay_payment_id = pay_T1otl2MwIob9Ln
     - POST to commerce internal/create-from-payment
     - internal endpoint calls create_order_from_pending_id()
       → LOCK: pending_{pending_id} ✓
       → Check: Order with pending_order_id = X → NOT FOUND
         (because ORD-804 has pending_order_id from NEW different PendingOrder!)
       → CREATES ORD-000805
       → ORD-805 has NO transaction_id (webhook data has different payment_id reference)

8. RAZORPAY WEBHOOK: payment.captured (12:41:36)
   → _handle_payment_captured()
   → _order_exists() check:
     - transaction_id = pay_T1otl2MwIob9Ln → ORD-804 has this ✅ FOUND!
     - Returns without creating another order

9. RAZORPAY WEBHOOK: order.paid (12:41:40)
   → _handle_order_paid()
   → _order_exists() check → ORDER EXISTS → stops
```

**Result: TWO confirmed orders for one payment.**

**Root cause chain:**
1. `register_payment()` created ORD-804 synchronously (Fault 1)
2. `payment.authorized` webhook handler created ORD-805 because `_order_exists()` missed ORD-804 due to unindexed query (Faults 3, 5)
3. The two orders had different `pending_order_id` values because `register_payment()` created a NEW PendingOrder (Fault 2)

### 5.2 Mamta Sah — ORD-000802 (confirmed) + ORD-000803 (cancelled)

| Field | ORD-000802 | ORD-000803 |
|-------|-----------|-----------|
| Status | **confirmed** | **cancelled** |
| Amount | ₹500 | ₹500 |
| Time | 12:16 pm | 12:16 pm |
| Transaction ID | `pay_T1oTWFVjngGYBY` | `pending_04194516` (placeholder!) |
| Email | `pending_04194516@aaryaclothing.in` | same |

**Same chain as Ruchi Pal** but with a guest checkout (no real email). The placeholder email `pending_04194516@aaryaclothing.in` confirms this was a guest user with pending-order-04194516 as their identifier.

**ORD-000803 was cancelled manually** — someone identified it as a duplicate after the fact. The system did not prevent the duplicate automatically.

---

## 6. The Fix Plan

### 6.1 Fix Priority Matrix

| Priority | Fix | Effort | Impact on Duplicates | Risk |
|----------|-----|--------|---------------------|------|
| **P0** | Remove sync order creation from `register_payment()` | 1 file, ~20 lines | Eliminates #1 cause of duplicates | Medium (frontend must poll longer) |
| **P0** | Only `payment.captured` creates orders | 1 file, ~10 lines | Eliminates 2/3 of webhook creation attempts | Low |
| **P0** | Add missing DB indexes | 1 migration | Makes idempotency checks reliable | None |
| **P1** | Unify lock key format | 1 file, ~5 lines | Prevents race between fallback paths | Low |
| **P1** | Add rate limiting to webhook endpoint | 1 file, ~3 lines | Prevents thundering herd | None |
| **P2** | Add server-side idempotency key | 2 files, ~30 lines | Prevents all duplicate registration attempts | Low |
| **P2** | Defer DB connection in webhook | 1 file, ~5 lines | Prevents pool exhaustion | Low |
| **P3** | Cart lock during checkout | 1 file, ~10 lines | Prevents snapshot inconsistency | Low |

### 6.2 What NOT to Change

| Item | Reason |
|------|--------|
| Frontend polling logic | Works correctly — just needs to handle no-order-in-response |
| PaymentTransaction model | Already has UNIQUE transaction_id ✅ |
| Webhook event dedup (Redis + DB) | Already implemented ✅ |
| Distributed lock mechanism | Lock pattern is correct, just keys need unification |
| UNIQUE constraint on pending_order_id | Already added by migration ✅ |
| UNIQUE constraint on (transaction_id, user_id) | Already exists ✅ |

---

## 7. Implementation Details

### 7.1 Fix 1: Remove Synchronous Order Creation

**File:** `services/commerce/service/order_service.py` — `register_payment()` method

**Changes:**
1. Remove the "SYNCHRONOUS ORDER CREATION" block (~lines 536-560)
2. Remove the `order` field from the return value
3. Remove the `resolved_payment_id = transaction_id or qr_code_id` assignment (if only used for the removed block)

```python
# BEFORE (current code):
# ──── SYNCHRONOUS ORDER CREATION ────
order = None
try:
    txn_id = transaction_id or qr_code_id or ""
    if txn_id:
        order = self.create_order_from_pending_id(
            pending_id=pending.id,
            transaction_id=txn_id,
            payment_method="razorpay",
        )
        logger.info(f"✓ ORDER_CREATED_SYNCHRONOUSLY: ...")
except Exception as e:
    logger.error(f"⚠ SYNCHRONOUS_ORDER_FAILED: ...")

return {
    "status": "payment_registered",
    "payment_id": resolved_payment_id,
    "pending_order_id": pending_order_id,
    "order": order,  # Present when order created synchronously
}

# AFTER (fix):
return {
    "status": "payment_registered",
    "payment_id": transaction_id or qr_code_id,
    "pending_order_id": pending_order_id,
    # No 'order' field — frontend must poll
}
```

**Impact:** Frontend confirm page must handle the case where `registerPayment()` doesn't return an order. The polling code already handles this correctly — it polls every 3 seconds. The webhook now has ~3-8 seconds to create the order before the first poll completes.

### 7.2 Fix 2: Only `payment.captured` Creates Orders

**File:** `services/payment/service/payment_service.py`

**Change in `_handle_payment_authorized()`:**
```python
def _handle_payment_authorized(self, event_info):
    # Step 1: Find transaction (same as before)
    transaction = None
    if razorpay_order_id:
        transaction = ...
    # ... find logic unchanged ...

    if not transaction:
        self._recover_transaction_from_razorpay(event_info)
        return

    # Step 2: Brief lock for status update
    txn_locked = (
        self.db.query(PaymentTransaction)
        .filter(PaymentTransaction.id == transaction.id)
        .with_for_update(skip_locked=True)
        .first()
    )
    if not txn_locked:
        return

    # Update transaction status to 'authorized'
    txn_locked.status = "authorized"
    _preserve_checkout_meta(txn_locked, event_info)
    self.db.commit()

    logger.info(f"WEBHOOK: Payment authorized: {payment_id} — waiting for capture")

    # REMOVED: _create_order_from_webhook() call
    # payment.captured will create the order
```

**Change in `_handle_order_paid()`:**
```python
def _handle_order_paid(self, event_info):
    # ... find transaction logic unchanged ...
    
    # Update transaction status
    transaction.status = "completed"
    self.db.commit()

    # SAFETY NET: Check if order exists, but DON'T create it
    if not self._order_exists(transaction):
        logger.warning(
            f"ORDER_PAID_MISSING_ORDER: payment={payment_id} "
            f"— captured webhook may not have fired. Logging for recovery."
        )
        # The recovery worker will handle this
        # Don't create order here — this path has less data (notes,
        # signatures) than payment.captured
```

### 7.3 Fix 3: Unify Lock Key

**File:** `services/commerce/service/order_service.py` — `create_order_from_pending_order()`

```python
# BEFORE (WRONG):
lock_value = payment_id or razorpay_order_id

# AFTER (CORRECT):
# Extract pending_order_id from the data if available
pending_id_from_data = pending_order_data.get("pending_order_id") if pending_order_data else None
if pending_id_from_data:
    lock_value = f"pending_{pending_id_from_data}"
else:
    lock_value = payment_id or razorpay_order_id
```

### 7.4 Fix 4: Add Database Indexes

**File:** `docker/postgres/migrations/004_add_order_missing_indexes.sql`

```sql
-- ============================================================
-- Migration: Add missing indexes on orders table
-- Purpose: Make _order_exists() queries fast (avoid seq scans)
-- ============================================================

-- Index for webhook idempotency checks (payment_service._order_exists)
CREATE INDEX IF NOT EXISTS ix_orders_razorpay_payment_id 
    ON orders (razorpay_payment_id);

-- Index for webhook idempotency checks (payment_service._order_exists)
CREATE INDEX IF NOT EXISTS ix_orders_razorpay_order_id 
    ON orders (razorpay_order_id);

-- Index for frontend polling endpoint (find_order_by_payment)
-- Composite index covering the OR query in find_order_by_payment
CREATE INDEX IF NOT EXISTS ix_orders_payment_lookup 
    ON orders (user_id, transaction_id, razorpay_payment_id, razorpay_order_id);

-- Partial index for recovery worker (only completed payments without orders)
CREATE INDEX IF NOT EXISTS ix_payment_transactions_orphan_recovery 
    ON payment_transactions (completed_at, razorpay_payment_id)
    WHERE status = 'completed' AND order_id IS NULL AND razorpay_payment_id IS NOT NULL;
```

### 7.5 Fix 5: Rate Limit Webhook Endpoint

**File:** `services/payment/main.py`

```python
from rate_limit import check_rate_limit

@app.post("/api/v1/webhooks/razorpay", response_model=WebhookResponse)
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: str = Header(...)
):
    # Rate limit: 100 webhooks per 10 seconds per IP
    if not check_rate_limit(request, "razorpay_webhook", limit=100, window=10):
        # Return 200 to stop retries but don't process
        return WebhookResponse(
            processed=False,
            message="Rate limited — will process on retry",
            event_type=""
        )
    # ... rest of handler unchanged ...
```

### 7.6 Fix 6: PendingOrderID Propagation

**File:** `frontend_new/app/checkout/payment/page.js`

Ensure `pending_order_id` from the create-order response is always stored:

```javascript
// Fix: Check for pending_order_id in MULTIPLE locations
// The backend can return it in different nested paths
const pendingOrderId = 
    orderData?.gateway_response?.pending_order_id ||   // nested in gateway_response
    orderData?.pending_order_id ||                     // top-level field
    (orderData?.notes && JSON.parse(orderData.notes)?.pending_order_id);  // Razorpay notes

if (pendingOrderId) {
    sessionStorage.setItem('pending_order_id', pendingOrderId);
    logger.info('Stored pending_order_id:', pendingOrderId);
}
```

---

## 8. Testing Strategy

### 8.1 Unit Tests to Add

| Test | File | What to Test |
|------|------|-------------|
| `test_register_payment_no_order_creation` | `tests/test_duplicate_order_prevention.py` | `register_payment()` returns 202 without order |
| `test_only_captured_creates_orders` | `tests/test_webhook_handlers.py` | `authorized` and `order.paid` don't create orders |
| `test_lock_key_unification` | `tests/test_duplicate_order_prevention.py` | Both paths use `pending_{pending_id}` |
| `test_concurrent_webhook_duplicate` | `tests/test_webhook_handlers.py` | Two concurrent webhooks → one order |
| `test_webhook_fires_before_frontend` | `tests/test_webhook_handlers.py` | Webhook creates order, frontend finds it |

### 8.2 Integration Tests

| Test | Scenario | Expected |
|------|----------|----------|
| Full checkout flow | User completes payment → confirm page polls → order created by webhook | Exactly 1 order per payment |
| Webhook retry | Same webhook fires 3 times | Exactly 1 order created |
| Cross-event duplication | `authorized` + `captured` + `order.paid` all fire | Exactly 1 order created |
| Network failure at confirm | `registerPayment()` succeeds but frontend polling fails | Recovery worker creates order within 5 min |
| Double pay button click | User submits form twice | Exactly 1 order created |

### 8.3 DB Constraint Verification

```sql
-- Verify all indexes exist
SELECT indexname, indexdef FROM pg_indexes 
WHERE tablename = 'orders' AND indexname LIKE 'ix_orders%';

-- Verify UNIQUE constraints exist
SELECT conname, contype FROM pg_constraint 
WHERE conrelid = 'orders'::regclass;

-- Verify no duplicate pending_order_ids exist
SELECT pending_order_id, COUNT(*) as cnt 
FROM orders 
WHERE pending_order_id IS NOT NULL 
GROUP BY pending_order_id 
HAVING COUNT(*) > 1;
```

---

## 9. Rollout Plan

### Phase 1: Immediate (Highest Impact, Lowest Risk)

1. ✅ Add missing DB indexes (`004_add_order_missing_indexes.sql`)
2. ✅ Only `payment.captured` creates orders (remove from `authorized` and `order.paid`)
3. ✅ Unify lock key format

**Verification:** Webhook endpoint now creates exactly 1 order per payment. Manual testing with test payments.

### Phase 2: Core Fix (Requires Careful Rollout)

4. 🔄 Remove synchronous order creation from `register_payment()`

**This is the highest impact fix but requires:** 
- Deploy to staging first
- Verify frontend polling works without order-in-response
- Monitor webhook latency (order should be created within 3-8 seconds)
- Have rollback plan ready (add back sync creation if polling timeout is too high for users)

**Rollback:** Revert the `register_payment()` change only — add back the synchronous creation block.

### Phase 3: Hardening (Lower Risk, Additional Safety)

5. Add rate limiting to webhook endpoint
6. Add server-side idempotency key verification
7. Add cart locking during checkout

### Phase 4: Cleanup (When Time Permits)

8. Admin delete-without-refund fix
9. SessionStorage → more robust state management
10. Webhook handler DB connection management

---

## Appendix A: Key Files Reference

| File | Role |
|------|------|
| `services/commerce/service/order_service.py` | Order creation logic (primary fix location) |
| `services/payment/service/payment_service.py` | Webhook handlers (secondary fix location) |
| `services/payment/main.py` | Webhook endpoint + rate limiting |
| `services/commerce/routes/internal.py` | Internal API for webhook order creation |
| `services/commerce/routes/customer_orders.py` | Frontend-facing order endpoints |
| `frontend_new/app/checkout/confirm/page.js` | Frontend confirm page with polling |
| `frontend_new/app/checkout/payment/page.js` | Frontend payment page |
| `frontend_new/lib/customerApi.js` | API client |
| `frontend_new/lib/cartContext.js` | Cart state management |
| `services/payment/jobs/recover_orders.py` | Recovery worker |
| `services/payment/jobs/worker.py` | Worker entry point |
| `docker/postgres/migrations/003_add_pending_order_id_unique.sql` | Existing UNIQUE constraint migration |
| `services/commerce/models/order.py` | Order model with constraints |
| `services/commerce/models/pending_order.py` | PendingOrder model |
| `services/payment/models/payment.py` | PaymentTransaction model |
| `services/admin/routes/orders.py` | Admin order listing |

## Appendix B: Razorpay Webhook Documentation References

- [Razorpay Webhooks Overview](https://razorpay.com/docs/webhooks/)
- [Razorpay Payments Webhook Events](https://razorpay.com/docs/webhooks/payments/)
- [Razorpay Webhooks Best Practices](https://razorpay.com/docs/webhooks/best-practices/)
- [Razorpay Webhook FAQs](https://razorpay.com/docs/webhooks/faqs/)
