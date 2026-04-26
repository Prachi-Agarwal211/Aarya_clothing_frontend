-- ============================================================================
-- COMPLETE FIX: CREATE ALL 4 MISSING ORDERS FROM RAZORPAY
-- Run: docker exec -i aarya_postgres psql -U postgres -d aarya_clothing < fix_all_missing_orders.sql
-- ============================================================================

BEGIN;

-- Get invoice numbers first
DO $$
DECLARE
    inv1 INTEGER;
    inv2 INTEGER;
    inv3 INTEGER;
    inv4 INTEGER;
BEGIN
    SELECT nextval('invoice_number_seq') INTO inv1;
    SELECT nextval('invoice_number_seq') INTO inv2;
    SELECT nextval('invoice_number_seq') INTO inv3;
    SELECT nextval('invoice_number_seq') INTO inv4;
    RAISE NOTICE 'Using invoice numbers: INV-2026-%, INV-2026-%, INV-2026-%, INV-2026-%',
        inv1, inv2, inv3, inv4;
END $$;

-- ============================================================================
-- 1. pay_SgdIqy1r4eioT9 - User 472 (twinkle.dsdg@gmail.com), ₹650, UPI
--    COMPLETELY MISSING from both payment_transactions and orders
-- ============================================================================

-- Create PaymentTransaction
INSERT INTO payment_transactions (
    user_id, amount, currency, payment_method,
    transaction_id, razorpay_payment_id, order_id, status,
    completed_at, created_at, gateway_response
) VALUES (
    472, 650.00, 'INR', 'upi',
    'pay_SgdIqy1r4eioT9', 'pay_SgdIqy1r4eioT9', NULL, 'completed',
    '2026-04-22 18:12:23+00', '2026-04-22 18:12:23+00',
    json_build_object(
        'email', 'twinkle.dsdg@gmail.com',
        'contact', '+919898244423',
        'rrn', '611223194752',
        'recovered', true,
        'recovery_date', to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
    )
) RETURNING id AS pt1_id;

-- Get the ID we just created
WITH insert_result AS (
    INSERT INTO orders (
        user_id, transaction_id, razorpay_payment_id, invoice_number,
        subtotal, total_amount, shipping_cost, gst_amount, discount_applied,
        payment_method, status, order_notes, shipping_address,
        created_at, updated_at
    ) VALUES (
        472, 'pay_SgdIqy1r4eioT9', 'pay_SgdIqy1r4eioT9',
        (SELECT 'INV-2026-' || LPAD(nextval('invoice_number_seq')::text, 6, '0')),
        650.00, 650.00, 0, 0, 0,
        'upi', 'confirmed',
        '[RECOVERED] Razorpay pay_SgdIqy1r4eioT9 - ₹650 - VPA: twinkle.dsdg@okaxis',
        'Address to be confirmed - Recovered payment pay_SgdIqy1r4eioT9',
        '2026-04-22 18:12:23+00', '2026-04-22 18:12:23+00'
    ) RETURNING id
)
UPDATE payment_transactions 
SET order_id = (SELECT id FROM insert_result)
WHERE razorpay_payment_id = 'pay_SgdIqy1r4eioT9';

-- Create OrderItem
INSERT INTO order_items (
    order_id, product_name, sku, quantity, unit_price, price, size, color
) VALUES (
    (SELECT id FROM orders WHERE razorpay_payment_id = 'pay_SgdIqy1r4eioT9'),
    'Aarya Clothing Purchase - Recovered',
    'RECOVERED-SgdIqy1', 1, 650.00, 650.00, 'One Size', 'Not Specified'
);

-- ============================================================================
-- 2. pay_SfIEipDZTECtRo - User 1319 (maheshwarianjali201@gmail.com), ₹850, UPI
--    COMPLETELY MISSING from both payment_transactions and orders
-- ============================================================================

-- Create PaymentTransaction
INSERT INTO payment_transactions (
    user_id, amount, currency, payment_method,
    transaction_id, razorpay_payment_id, order_id, status,
    completed_at, created_at, gateway_response
) VALUES (
    1319, 850.00, 'INR', 'upi',
    'pay_SfIEipDZTECtRo', 'pay_SfIEipDZTECtRo', NULL, 'completed',
    '2026-04-19 09:26:58+00', '2026-04-19 09:26:58+00',
    json_build_object(
        'email', 'maheshwarianjali201@gmail.com',
        'contact', '+918777061192',
        'rrn', '610914966914',
        'recovered', true,
        'recovery_date', to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
    )
) RETURNING id AS pt2_id;

-- Create Order and link
WITH insert_result AS (
    INSERT INTO orders (
        user_id, transaction_id, razorpay_payment_id, invoice_number,
        subtotal, total_amount, shipping_cost, gst_amount, discount_applied,
        payment_method, status, order_notes, shipping_address,
        created_at, updated_at
    ) VALUES (
        1319, 'pay_SfIEipDZTECtRo', 'pay_SfIEipDZTECtRo',
        (SELECT 'INV-2026-' || LPAD(nextval('invoice_number_seq')::text, 6, '0')),
        850.00, 850.00, 0, 0, 0,
        'upi', 'confirmed',
        '[RECOVERED] Razorpay pay_SfIEipDZTECtRo - ₹850 - VPA: 8777061192@kotak',
        'Address to be confirmed - Recovered payment pay_SfIEipDZTECtRo',
        '2026-04-19 09:26:58+00', '2026-04-19 09:26:58+00'
    ) RETURNING id
)
UPDATE payment_transactions 
SET order_id = (SELECT id FROM insert_result)
WHERE razorpay_payment_id = 'pay_SfIEipDZTECtRo';

-- Create OrderItem
INSERT INTO order_items (
    order_id, product_name, sku, quantity, unit_price, price, size, color
) VALUES (
    (SELECT id FROM orders WHERE razorpay_payment_id = 'pay_SfIEipDZTECtRo'),
    'Aarya Clothing Purchase - Recovered',
    'RECOVERED-SfIEipD', 1, 850.00, 850.00, 'One Size', 'Not Specified'
);

-- ============================================================================
-- 3. pay_SgtEexkhic41Ot - User 1177, ₹550, QR UPI
--    EXISTS in payment_transactions (PT #108), NO order
-- ============================================================================

-- Create Order
WITH insert_result AS (
    INSERT INTO orders (
        user_id, transaction_id, razorpay_payment_id, invoice_number,
        subtotal, total_amount, shipping_cost, gst_amount, discount_applied,
        payment_method, status, order_notes, shipping_address,
        created_at, updated_at
    ) VALUES (
        1177, 'txn_qr_1776937589_42aa5e59', 'pay_SgtEexkhic41Ot',
        (SELECT 'INV-2026-' || LPAD(nextval('invoice_number_seq')::text, 6, '0')),
        550.00, 550.00, 0, 0, 0,
        'upi_qr', 'confirmed',
        '[RECOVERED] QR Payment pay_SgtEexkhic41Ot - ₹550',
        'Address to be confirmed - Recovered QR payment',
        '2026-04-23 04:16:31+00', '2026-04-23 04:16:31+00'
    ) RETURNING id
)
UPDATE payment_transactions 
SET order_id = (SELECT id FROM insert_result)
WHERE id = 108;

-- Create OrderItem
INSERT INTO order_items (
    order_id, product_name, sku, quantity, unit_price, price, size, color
) VALUES (
    (SELECT id FROM orders WHERE razorpay_payment_id = 'pay_SgtEexkhic41Ot'),
    'Aarya Clothing Purchase - Recovered',
    'RECOVERED-SgtEexk', 1, 550.00, 550.00, 'One Size', 'Not Specified'
);

-- ============================================================================
-- 4. pay_SgqDRBynweIvDK - User 69, ₹799, Card
--    EXISTS in payment_transactions (PT #39), NO order
-- ============================================================================

-- Create Order
WITH insert_result AS (
    INSERT INTO orders (
        user_id, transaction_id, razorpay_payment_id, invoice_number,
        subtotal, total_amount, shipping_cost, gst_amount, discount_applied,
        payment_method, status, order_notes, shipping_address,
        created_at, updated_at
    ) VALUES (
        69, 'txn_qr_1775554666_ba937fd1', 'pay_SgqDRBynweIvDK',
        (SELECT 'INV-2026-' || LPAD(nextval('invoice_number_seq')::text, 6, '0')),
        799.00, 799.00, 0, 0, 0,
        'card', 'confirmed',
        '[RECOVERED] Card Payment pay_SgqDRBynweIvDK - ₹799',
        'Address to be confirmed - Recovered card payment',
        '2026-04-07 10:07:47+00', '2026-04-07 10:07:47+00'
    ) RETURNING id
)
UPDATE payment_transactions 
SET order_id = (SELECT id FROM insert_result)
WHERE id = 39;

-- Create OrderItem
INSERT INTO order_items (
    order_id, product_name, sku, quantity, unit_price, price, size, color
) VALUES (
    (SELECT id FROM orders WHERE razorpay_payment_id = 'pay_SgqDRBynweIvDK'),
    'Aarya Clothing Purchase - Recovered',
    'RECOVERED-SgqDRBy', 1, 799.00, 799.00, 'One Size', 'Not Specified'
);

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 'VERIFICATION RESULTS:' as "";
SELECT 
    'Orphaned completed payments: ' || 
    (SELECT COUNT(*) FROM payment_transactions WHERE status = 'completed' AND order_id IS NULL) || 
    ' (should be 0)' as result_1;

SELECT 
    'Total orders: ' || 
    (SELECT COUNT(*) FROM orders) || 
    ' (should be 39)' as result_2;

SELECT 
    'pay_SgdIqy1r4eioT9: PT#' || pt.id || ' -> Order#' || o.id as status_1
FROM payment_transactions pt 
LEFT JOIN orders o ON pt.order_id = o.id 
WHERE pt.razorpay_payment_id = 'pay_SgdIqy1r4eioT9';

SELECT 
    'pay_SfIEipDZTECtRo: PT#' || pt.id || ' -> Order#' || o.id as status_2
FROM payment_transactions pt 
LEFT JOIN orders o ON pt.order_id = o.id 
WHERE pt.razorpay_payment_id = 'pay_SfIEipDZTECtRo';

SELECT 
    'pay_SgtEexkhic41Ot: PT#' || pt.id || ' -> Order#' || o.id as status_3
FROM payment_transactions pt 
LEFT JOIN orders o ON pt.order_id = o.id 
WHERE pt.razorpay_payment_id = 'pay_SgtEexkhic41Ot';

SELECT 
    'pay_SgqDRBynweIvDK: PT#' || pt.id || ' -> Order#' || o.id as status_4
FROM payment_transactions pt 
LEFT JOIN orders o ON pt.order_id = o.id 
WHERE pt.razorpay_payment_id = 'pay_SgqDRBynweIvDK';
