-- Migration: Add razorpay_qr_code_id column to payment_transactions
-- Date: 2026-04-05
-- Purpose: Support UPI QR code payments by storing Razorpay QR code IDs

-- Add the new column
ALTER TABLE payment_transactions
ADD COLUMN IF NOT EXISTS razorpay_qr_code_id VARCHAR(100) NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_payment_transactions_razorpay_qr_code_id
ON payment_transactions(razorpay_qr_code_id);

-- Add comment for documentation
COMMENT ON COLUMN payment_transactions.razorpay_qr_code_id IS 'Razorpay QR code ID for UPI QR payments';
