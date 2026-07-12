# Cross-User Payment Identity — Root Cause & Hardening

> Updated: 2026-07-12  
> Severity: **CRITICAL** (wrong customer can receive another customer’s paid order)

---

## Confirmed production incidents

| Payment ID | Contaminated users | Order | Pattern |
|------------|-------------------|-------|---------|
| `pay_Sv54hFkAcmUX9i` | 2152 ↔ 500 | #394 → user 500 | Same `pay_xxx` on 3 payment_transactions |
| `pay_Sugy7L3owmppAa` | 439 ↔ 2370 | #372 → user 2370 | Same pattern |

Many other `pay_xxx` IDs appear on **2 rows for the same user** (QR + Razorpay dual-path) — same-user duplicate is noisy but not cross-user.

---

## Architecture root causes

### 1. Amount-based transaction matching (primary)

Webhook handlers (`payment.captured`, `payment.authorized`, `qr_code.credited`) fell back to:

```sql
WHERE amount = :₹ AND payment_method = 'upi_qr' AND status = 'pending'
ORDER BY created_at DESC LIMIT 1
```

When two customers checkout the **same popular price** (₹475, ₹700, etc.) within the same window, the wrong `PaymentTransaction` row received the real `pay_xxx`. Order creation then used that row’s `user_id` and cart → **money from A, order for B**.

### 2. Empty `razorpay_order_id` idempotency (historical)

Matching `OR razorpay_order_id = ''` collapsed many QR webhooks onto one early order.

### 3. Recovery “user + amount → pending”

If a user had **multiple** open pendings at the same amount, recovery could attach payment to the wrong cart. Tightened to **exactly one** pending + time window.

### 4. `_find_existing_order` QR fallback

Matched *any* recent order with a payment_id for the user within 5 minutes — not the specific QR. Fixed to require `transaction_id` / `razorpay_payment_id == qr_code_id`.

---

## Hardening (deployed)

| Layer | Guard |
|-------|--------|
| Payment webhook | Match only by `razorpay_order_id` / `razorpay_payment_id` / `razorpay_qr_code_id` |
| Payment webhook | **No amount fallback** |
| Payment webhook | Notes `user_id` must match txn.user_id if present |
| Payment webhook | `_safe_bind_payment_id` refuses attaching `pay_xxx` already owned by another user |
| Commerce create-from-payment | Idempotency returns only if `order.user_id == request user_id`; else **409** |
| Commerce create-from-payment | Pending must belong to request user |
| `create_order_from_pending_id` | `expected_user_id` + refuse if payment already on another user’s order |
| Recovery worker | Amount→pending only if **unique** pending for user+amount and ±6h |
| Data cleanup | Detached `pay_xxx` from wrong-user txn rows (411, 480) |

---

## Identity contract (going forward)

```
PaymentTransaction.user_id  ──must equal──►  PendingOrder.user_id  ──must equal──►  Order.user_id
         ▲                                         ▲
         │                                         │
   notes.user_id                         notes.pending_order_id
   (Razorpay order / QR)
```

**Allowed match keys (ranked):**

1. `razorpay_order_id` (standard checkout)  
2. `razorpay_qr_code_id` (UPI QR)  
3. `razorpay_payment_id` (after bind, unique preferred)  
4. `pending_order_id` (explicit)  

**Forbidden:** amount-only, amount+status without unique gateway id, empty string IDs.

---

## Ops notes for the two known bad orders

- Order **#394** (user 500) may have been fulfilled with payment that was also stamped on user 2152’s QR txn. Detached payment_id from user 2152’s txn; **do not auto-reassign order**. Manual review / refund if customer complaint.  
- Order **#372** (user 2370) similar vs user 439.

Flag support tickets mentioning “I paid but got wrong order / someone else’s items” against these payment IDs.

---

## Tests to add (recommended)

1. Two concurrent QR checkouts same amount, different users → each webhook binds only by `qr_code_id`.  
2. Attempt bind of existing `pay_xxx` from user A onto user B’s txn → refused.  
3. create-from-payment with pending belonging to other user → 409.  
4. Recovery with 2 open pendings same amount → skip, no order.
