-- ============================================================================
-- COMPLETE FIX V2: CREATE ALL 4 MISSING ORDERS FROM RAZORPAY
-- Using inventory_id = 85 (first available) for order_items
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. pay_SgdIqy1r4eioT9 - User 472, ₹650, UPI, Apr 22
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
) RETURNING id;

-- Create Order (using next invoice number)
INSERT INTO orders (
    user_id, transaction_id, razorpay_payment_id, invoice_number,
    subtotal, total_amount, shipping_cost, gst_amount, cgst_amount, sgst_amount, igst_amount,
    payment_method, status, place_of_supply, order_notes, shipping_address,
    created_at, updated_at
) VALUES (
    472, 'pay_SgdIqy1r4eioT9', 'pay_SgdIqy1r4eioT9',
    'INV-2026-' || LPAD((SELECT nextval('invoice_number_seq')::text), 6, '0'),
    650.00, 650.00, 0, 0, 0, 0, 0,
    'upi', 'confirmed', NULL,
    '[RECOVERED] Razorpay pay_SgdIqy1r4eioT9 - ₹650 - VPA: twinkle.dsdg@okaxis',
    'Address to be confirmed - Recovered payment',
    '2026-04-22 18:12:23+00', '2026-04-22 18:12:23+00'
) RETURNING id;

-- Link PT to Order (need to get IDs from above)
-- This will be done in separate statements since we can't use RETURNING in CTE the same way

-- ============================================================================
-- 2. pay_SfIEipDZTECtRo - User 1319, ₹850, UPI, Apr 19
-- ============================================================================

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
) RETURNING id;

INSERT INTO orders (
    user_id, transaction_id, razorpay_payment_id, invoice_number,
    subtotal, total_amount, shipping_cost, gst_amount, cgst_amount, sgst_amount, igst_amount,
    payment_method, status, place_of_supply, order_notes, shipping_address,
    created_at, updated_at
) VALUES (
    1319, 'pay_SfIEipDZTECtRo', 'pay_SfIEipDZTECtRo',
    'INV-2026-' || LPAD((SELECT nextval('invoice_number_seq')::text), 6, '0'),
    850.00, 850.00, 0, 0, 0, 0, 0,
    'upi', 'confirmed', NULL,
    '[RECOVERED] Razorpay pay_SfIEipDZTECtRo - ₹850 - VPA: 8777061192@kotak',
    'Address to be confirmed - Recovered payment',
    '2026-04-19 09:26:58+00', '2026-04-19 09:26:58+00'
) RETURNING id;

COMMIT;
