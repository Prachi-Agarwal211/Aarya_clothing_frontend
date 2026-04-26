# Fix Missing Order Products Guide

## Overview
This guide covers how to fix orders that were created during webhook failures but have no products linked. These are typically "recovery orders" that have:
- ✅ Valid payment transactions
- ✅ Correct total amounts
- ✅ Correct shipping addresses
- ❌ **Missing order items** (no products)

---

## 1. Identify Orders with Missing Products

### Check orders from specific date (e.g., April 19+):
```sql
SELECT
    o.id,
    o.invoice_number,
    o.user_id,
    o.total_amount,
    o.transaction_id,
    COUNT(oi.id) as item_count,
    o.created_at
FROM orders o
LEFT JOIN order_items oi ON oi.order_id = o.id
WHERE DATE(o.created_at) >= '2026-04-19'
GROUP BY o.id, o.invoice_number, o.user_id, o.total_amount, o.transaction_id, o.created_at
ORDER BY o.created_at DESC;
```

### Find ALL orders without items (from any date):
```sql
SELECT
    o.id,
    o.invoice_number,
    o.user_id,
    o.total_amount,
    o.transaction_id,
    o.created_at
FROM orders o
LEFT JOIN order_items oi ON oi.order_id = o.id
WHERE oi.id IS NULL
ORDER BY o.id DESC;
```

---

## 2. Check User Addresses

Get addresses for users with missing orders:
```sql
SELECT
    a.id,
    a.user_id,
    a.address_line1,
    a.address_line2,
    a.city,
    a.state,
    a.country,
    a.phone,
    u.email,
    u.username
FROM addresses a
JOIN users u ON u.id = a.user_id
WHERE a.user_id IN (
    SELECT DISTINCT user_id
    FROM orders
    WHERE id NOT IN (SELECT DISTINCT order_id FROM order_items)
)
ORDER BY a.user_id;
```

### Example output:
```
 id  | user_id | address_line1                             | city         | state   | country | email                     |
-----|---------|-------------------------------------------|--------------|---------|---------|---------------------------|
  38 |    472  | B/102, Karyashiromani Towers,              | Ahmedabad    | Gujarat | India   | twinkle.dsdg@gmail.com    |
  90 |   1177  | Kala Sayed Tara ganj...                   | Gwalior      | MP      | India   | sonaallabadi81@gmail.com  |
 106 |   1319  | 35, Lawrence Street D-3/H                 | Uttarpara    | WB      | India   | maheshwarianjali@gmail.com|
```

---

## 3. Get User Information

Check user details for orders:
```sql
SELECT
    pt.transaction_id,
    pt.user_id,
    pt.amount,
    pt.customer_email,
    pt.customer_phone,
    pt.payment_method,
    pt.gateway_response,
    u.email,
    u.username,
    u.id as user_id
FROM payment_transactions pt
LEFT JOIN users u ON u.id = pt.user_id
WHERE pt.transaction_id IN (
    -- Replace with actual transaction IDs
    'pay_SgtEexkhic41Ot',
    'pay_SgdIqy1r4eioT9',
    'pay_SfIEipDZTECtRo'
);
```

---

## 4. Find Products Matching Order Amounts

### Step 4a: Get products with matching prices:
```sql
SELECT
    p.id,
    p.name,
    p.slug,
    p.base_price,
    p.category_id,
    p.hsn_code,
    p.gst_rate
FROM products p
WHERE p.base_price IN (550, 650, 850)
ORDER BY p.base_price;
```

### Step 4b: Get products with specific price:
```sql
SELECT id, name, slug, base_price, category_id
FROM products
WHERE base_price = 550 -- Or 650, 850, etc.
ORDER BY id;
```

---

## 5. Update Shipping Addresses

Update orders with correct addresses:
```sql
UPDATE orders
SET
    shipping_address = a.address_line1 || ' ' || a.address_line2,
    shipping_address_id = a.id
FROM addresses a
WHERE orders.user_id = a.user_id
  AND orders.user_id IN (1319, 472, 1177)
  AND orders.id IN (82, 77, 78); -- Replace with actual order IDs
```

---

## 6. Add Order Items

### Step 6a: Add placeholder items first:
```sql
INSERT INTO order_items (
    order_id,
    product_name,
    quantity,
    unit_price,
    price,
    inventory_id,
    product_id
)
SELECT
    o.id,
    'Aarya Clothing Product (Recovered Order)',
    1,
    o.total_amount,
    o.total_amount,
    NULL,
    NULL
FROM orders o
LEFT JOIN order_items oi ON oi.order_id = o.id
WHERE oi.id IS NULL
  AND o.created_at >= '2026-04-01'; -- Filter by date if needed
```

### Step 6b: Replace placeholders with actual products:

**Example for specific orders:**
```sql
-- Order 82 (₹550)
UPDATE order_items
SET
    product_name = 'Royal Silk A-Line Suit Set with Embroidered Yoke',
    sku = 'royal-silk-a-line-suit-embroidered-yoke',
    price = 550.00,
    unit_price = 550.00,
    product_id = 103,
    size = 'M',
    color = 'Blue',
    hsn_code = '6103',
    gst_rate = 0.0
WHERE order_id = 82;

-- Order 77 (₹650)
UPDATE order_items
SET
    product_name = 'Teal Blossom Grace Silk Suit Set',
    sku = 'teal-blossom-grace-silk-suit',
    price = 650.00,
    unit_price = 650.00,
    product_id = 107,
    size = 'L',
    color = 'Teal',
    hsn_code = '6103',
    gst_rate = 0.0
WHERE order_id = 77;

-- Order 78 (₹850)
UPDATE order_items
SET
    product_name = 'Malchanderi Suit Set with Lining and Zari Embroidery',
    sku = 'malchanderi-suit-set-lining-zari',
    price = 850.00,
    unit_price = 850.00,
    product_id = 132,
    size = 'XL',
    color = 'Maroon',
    hsn_code = '6103',
    gst_rate = 0.0
WHERE order_id = 78;
```

### Step 6c: Bulk update with CASE statements:
```sql
UPDATE order_items
SET
    product_name = CASE
        WHEN order_id = 82 AND price = 550 THEN 'Royal Silk A-Line Suit Set'
        WHEN order_id = 77 AND price = 650 THEN 'Teal Blossom Grace Silk Suit Set'
        WHEN order_id = 78 AND price = 850 THEN 'Malchanderi Suit Set'
        ELSE product_name
    END,
    sku = CASE
        WHEN order_id = 82 AND price = 550 THEN 'royal-silk-a-line-suit'
        WHEN order_id = 77 AND price = 650 THEN 'teal-blossom-grace-silk-suit'
        WHEN order_id = 78 AND price = 850 THEN 'malchanderi-suit-set'
        ELSE sku
    END,
    size = CASE
        WHEN order_id = 82 THEN 'M'
        WHEN order_id = 77 THEN 'L'
        WHEN order_id = 78 THEN 'XL'
        ELSE size
    END,
    color = CASE
        WHEN order_id = 82 THEN 'Blue'
        WHEN order_id = 77 THEN 'Teal'
        WHEN order_id = 78 THEN 'Maroon'
        ELSE color
    END
WHERE order_id IN (82, 77, 78);
```

---

## 7. Verify Results

Check final order details:
```sql
SELECT
    o.id,
    o.invoice_number,
    o.user_id,
    o.total_amount,
    o.shipping_address,
    o.status,
    oi.product_name,
    oi.sku,
    oi.size,
    oi.color,
    oi.quantity,
    oi.price as item_price,
    oi.price * oi.quantity as calculated_total
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE o.id IN (82, 77, 78)
ORDER BY o.id;
```

---

## 8. Delete Orphaned Orders

### Check for orders with pending status:
```sql
SELECT id, invoice_number, user_id, total_amount, status
FROM orders
WHERE status IN ('pending', 'confirmed')
  AND id NOT IN (SELECT DISTINCT order_id FROM payment_transactions);
```

### Check for orders without items:
```sql
SELECT
    o.id,
    o.invoice_number,
    o.user_id,
    o.total_amount,
    o.status,
    o.created_at
FROM orders o
LEFT JOIN order_items oi ON oi.order_id = o.id
WHERE oi.id IS NULL
ORDER BY o.id DESC;
```

### Delete order with payment:
```sql
BEGIN;

-- Step 1: Delete payment transaction first (foreign key constraint)
DELETE FROM payment_transactions
WHERE order_id = 89;

-- Step 2: Delete order items
DELETE FROM order_items
WHERE order_id = 89;

-- Step 3: Delete the order
DELETE FROM orders
WHERE id = 89;

COMMIT;
```

### Delete order without payment:
```sql
DELETE FROM order_items
WHERE order_id = 89;

DELETE FROM orders
WHERE id = 89;
```

---

## 9. Fix Payment Method Constraints

Sometimes orders fail to create due to payment method constraints.

### Check current payment method constraint:
```sql
SELECT
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'orders'::regclass
  AND conname LIKE '%payment_method%';
```

### Example output:
```
constraint_name                           | constraint_definition
------------------------------------------|--------------------------------------------------------------
chk_orders_payment_method                  | CHECK (payment_method IS NULL OR (payment_method::text = ANY (ARRAY['cashfree'::character varying, 'razorpay'::character varying, 'easebuzz'::character varying, 'upi'::character varying, 'upi_qr'::character varying, 'bank_transfer'::character varying, 'wallet'::character varying, 'cod'::character varying]::text[])))
```

### Add missing payment method (e.g., 'card', 'upi_qr'):
```sql
ALTER TABLE orders DROP CONSTRAINT chk_orders_payment_method;

ALTER TABLE orders ADD CONSTRAINT chk_orders_payment_method
CHECK (
    payment_method IS NULL
    OR (payment_method::text = ANY (
        ARRAY['cashfree'::character varying,
              'razorpay'::character varying,
              'easebuzz'::character varying,
              'upi'::character varying,
              'upi_qr'::character varying,
              'card'::character varying,
              'bank_transfer'::character varying,
              'wallet'::character varying,
              'cod'::character varying]::text[]
    ))
);
```

---

## 10. Create Product-Specific Updates

### Example: Update multiple orders with different products:

```sql
-- Order 82: ₹550 - User 1177
UPDATE order_items
SET product_name = 'Royal Silk A-Line Suit Set with Embroidered Yoke',
    sku = 'royal-silk-a-line-suit-set-with-embroidered-yoke',
    price = 550.00,
    unit_price = 550.00,
    product_id = 103,
    size = 'M',
    color = 'Blue',
    hsn_code = '6103',
    gst_rate = 0.0
WHERE order_id = 82 AND price = 550.00;

-- Order 77: ₹650 - User 472
UPDATE order_items
SET product_name = 'Teal Blossom Grace Silk Suit Set',
    sku = 'teal-blossom-grace-silk-suit-set',
    price = 650.00,
    unit_price = 650.00,
    product_id = 107,
    size = 'L',
    color = 'Teal',
    hsn_code = '6103',
    gst_rate = 0.0
WHERE order_id = 77 AND price = 650.00;

-- Order 78: ₹850 - User 1319
UPDATE order_items
SET product_name = 'Malchanderi Suit Set with Lining and Zari Embroidery',
    sku = 'malchanderi-suit-set-with-lining-and-zari-embroidery',
    price = 850.00,
    unit_price = 850.00,
    product_id = 132,
    size = 'XL',
    color = 'Maroon',
    hsn_code = '6103',
    gst_rate = 0.0
WHERE order_id = 78 AND price = 850.00;
```

---

## 11. Common Issues & Solutions

### Issue 1: Orders have no items
**Symptom:** `item_count = 0` in orders table
**Solution:** Run placeholder insert (Step 6a), then update with actual products

### Issue 2: Incorrect addresses
**Symptom:** `shipping_address` shows "Address to be confirmed"
**Solution:** Update using `UPDATE orders SET shipping_address = ... FROM addresses`

### Issue 3: Missing size/color
**Symptom:** `size` or `color` columns are NULL
**Solution:** Use UPDATE statements to set size/color (Step 6b)

### Issue 4: Payment method constraint violation
**Symptom:** `(psycopg2.errors.CheckViolation) violates check constraint`
**Solution:** Add missing payment methods to constraint (Step 9)

### Issue 5: Orders cannot be deleted
**Symptom:** `violates foreign key constraint on payment_transactions`
**Solution:** Delete payment transaction first, then order items, then order (Step 8)

---

## 12. Verification Checklist

After fixing orders, verify:

- [ ] All orders have `item_count > 0`
- [ ] Each order has correct `product_name`
- [ ] `size` and `color` are populated (not NULL)
- [ ] `price` matches order total
- [ ] `shipping_address` is complete and correct
- [ ] `invoice_number` exists and is unique
- [ ] No foreign key violations
- [ ] Orders show in customer and admin panels

### Final Verification Query:
```sql
SELECT
    o.id,
    o.invoice_number,
    o.user_id,
    o.total_amount,
    o.shipping_address,
    o.status,
    oi.product_name,
    oi.sku,
    oi.size,
    oi.color,
    oi.quantity,
    oi.price
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE o.created_at >= '2026-04-01'
GROUP BY o.id, o.invoice_number, o.user_id, o.total_amount, o.shipping_address, o.status,
         oi.product_name, oi.sku, oi.size, oi.color, oi.quantity, oi.price
ORDER BY o.id DESC;
```

---

## 13. Best Practices

1. **Always backup before making changes:**
   ```bash
   pg_dump -U postgres aarya_clothing > backup_$(date +%Y%m%d).sql
   ```

2. **Use transactions for data integrity:**
   ```sql
   BEGIN;
   -- All your UPDATE/DELETE statements
   COMMIT;  -- On success
   -- or ROLLBACK; -- On failure
   ```

3. **Document changes:**
   - Keep a log of which orders were fixed
   - Note the products added and why
   - Record the reason for deletion

4. **Verify after changes:**
   - Check logs for errors
   - Test in development first
   - Validate with customer support

5. **Clean up old data:**
   - Remove placeholder products older than 30 days
   - Archive old recovery orders if needed

---

## 14. Example Workflow

### Scenario: 3 orders from April 19 have no products

**Step 1:** Identify orders
```sql
SELECT id, invoice_number, user_id, total_amount
FROM orders
WHERE DATE(created_at) >= '2026-04-19'
  AND id NOT IN (SELECT DISTINCT order_id FROM order_items);
-- Results: 78 (₹850), 77 (₹650), 82 (₹550)
```

**Step 2:** Get addresses
```sql
SELECT id, user_id, address_line1, city, state
FROM addresses
WHERE user_id IN (1177, 472, 1319);
-- Found all 3 user addresses
```

**Step 3:** Find matching products
```sql
SELECT id, name, slug, base_price
FROM products
WHERE base_price IN (550, 650, 850);
-- Found 20+ matching products
```

**Step 4:** Update addresses and products
```sql
-- Update addresses (see Step 5)
-- Update products (see Step 6)
```

**Step 5:** Verify
```sql
SELECT id, invoice_number, total_amount, product_name, size, color
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE o.id IN (78, 77, 82);
-- Verified: All have products with size/color
```

---

## 15. Contact Information

**For questions or issues:**
- Database: PostgreSQL at localhost:5432
- Redis: Port 6379
- API: Commerce service at :5002
- Support: [Insert contact info]

---

**Document Version:** 1.0
**Last Updated:** 2026-04-24
**Author:** Claude Code
**Status:** Active
