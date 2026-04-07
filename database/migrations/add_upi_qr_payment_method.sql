-- Migration: Add 'upi_qr' to payment_transactions payment_method check constraint
-- Date: 2026-04-06
-- Purpose: Support UPI QR code payments via Razorpay

-- 1. Drop the old constraint
ALTER TABLE payment_transactions DROP CONSTRAINT IF EXISTS chk_payment_transactions_payment_method;

-- 2. Add new constraint with upi_qr included
ALTER TABLE payment_transactions ADD CONSTRAINT chk_payment_transactions_payment_method
CHECK (payment_method IS NULL OR (payment_method::text = ANY (ARRAY[
  'cashfree'::character varying,
  'razorpay'::character varying,
  'easebuzz'::character varying,
  'upi'::character varying,
  'upi_qr'::character varying,
  'bank_transfer'::character varying,
  'wallet'::character varying,
  'cod'::character varying
]::text[])));

-- 3. Allow NULL order_id for QR payments (order created AFTER payment succeeds)
ALTER TABLE payment_transactions ALTER COLUMN order_id DROP NOT NULL;
