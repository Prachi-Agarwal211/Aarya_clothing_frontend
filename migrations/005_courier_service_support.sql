-- Migration: 005_courier_service_support.sql
-- Purpose: Add courier service fields to orders and order_tracking tables
-- Date: 2026-04-10

-- Add courier service fields to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_name VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_tracking_url VARCHAR(500);

-- Add comment for documentation
COMMENT ON COLUMN orders.courier_name IS 'Name of the courier/shipping provider (e.g., Delhivery, BlueDart)';
COMMENT ON COLUMN orders.courier_tracking_url IS 'Tracking URL for the courier service';

-- Update order_tracking table to include courier info for historical tracking
ALTER TABLE order_tracking ADD COLUMN IF NOT EXISTS courier_name VARCHAR(100);

COMMENT ON COLUMN order_tracking.courier_name IS 'Courier used for this status update';
