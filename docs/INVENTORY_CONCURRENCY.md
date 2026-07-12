# Inventory concurrency — 10 units, 15 buyers

## Desired outcome

| Group | What should happen |
|-------|--------------------|
| First **10** who start payment | Stock reserved → Razorpay/QR opens → pay → order confirmed |
| Next **5** | **400 before payment** — “only N left” — **no charge** |

Never: all 15 pay and 5 discover failure only after money left the bank.

---

## Correct sequence

```
1. POST /checkout/validate  (optional FE)  → FOR UPDATE check + optional pre-reserve
2. POST payment create-order / create-qr
      → commerce prepare:
           FOR UPDATE inventory row
           if available_quantity < qty → 400
           reserved_quantity += qty
           StockReservation PENDING (TTL 30m)
           PendingOrder + reservation_ids
      → ONLY THEN open Razorpay / show QR
3. Webhook payment.captured
      → create order from pending
      → confirm_reservation (qty down, reserved down)
4. On expire/fail/cancel
      → release_reservation (reserved down only)
```

`available_quantity = quantity - reserved_quantity` (property on ProductVariant).

---

## Bugs fixed (2026-07-12)

1. **prepare returned `success: true` even when reserve failed** → customers 11–15 could still pay.  
   Now: reserve failure → release partials → cancel pending → **HTTP 400**.
2. **payment create-order ignored prepare failure** and still created Razorpay order.  
   Now: prepare non-200 / no pending_id → **no gateway order**.
3. **QR path same hard gate**.
4. **confirm_reservation** refuses if on-hand `quantity < reserved qty` (data drift safety).

---

## Remaining risks (accepted / ops)

| Risk | Mitigation |
|------|------------|
| Reservation TTL (30m) expires while user is mid-Razorpay | Expire job releases stock; late pay may fail order create → refund path |
| Paid without reservation (legacy) | `deduct_stock_for_order` FOR UPDATE; fail → no order → recover/refund UI |
| Stale `reserved_quantity` | expire-reservations job + admin reconcile |
| Double reserve same user | prepare reuses PENDING reservation for user+sku |

---

## Ops checklist under flash sales

1. Ensure `expire-reservations` cron hits commerce every few minutes.  
2. Monitor logs: `PREPARE_STOCK_RESERVED` vs `PREPARE_BLOCKED_PAYMENT`.  
3. Low stock threshold alerts on `available_quantity`.  
4. Never disable prepare to “speed up” checkout.
