-- ============================================================================
-- Migration 003: Payment-to-Order Reliability System
-- Date: April 10, 2026
-- Purpose: Eliminate silent payment failures, guarantee order creation
-- ============================================================================

-- ============================================================================
-- 1. PENDING_ORDERS TABLE
-- Created BEFORE payment initiation. Holds cart snapshot so we can recreate
-- the order if payment succeeds but order creation fails.
-- ============================================================================

CREATE TABLE IF NOT EXISTS pending_orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    payment_intent_id UUID NOT NULL DEFAULT gen_random_uuid(),
    
    -- Payment details (populated after Razorpay order creation)
    razorpay_order_id VARCHAR(100),
    razorpay_payment_id VARCHAR(100),
    qr_code_id VARCHAR(100),
    payment_method VARCHAR(50) DEFAULT 'razorpay',
    
    -- Cart snapshot (authoritative — used to recreate order if needed)
    cart_snapshot JSONB NOT NULL,  -- [{product_id, variant_id, sku, quantity, unit_price, name, size, color, image_url}]
    
    -- Order details
    shipping_address TEXT NOT NULL,
    address_id INTEGER,
    promo_code VARCHAR(50),
    order_notes TEXT,
    subtotal NUMERIC(10,2) NOT NULL,
    discount_applied NUMERIC(10,2) DEFAULT 0,
    shipping_cost NUMERIC(10,2) DEFAULT 0,
    gst_amount NUMERIC(10,2) DEFAULT 0,
    cgst_amount NUMERIC(10,2) DEFAULT 0,
    sgst_amount NUMERIC(10,2) DEFAULT 0,
    igst_amount NUMERIC(10,2) DEFAULT 0,
    total_amount NUMERIC(10,2) NOT NULL,
    delivery_state VARCHAR(50),
    customer_gstin VARCHAR(15),
    
    -- Status tracking
    status VARCHAR(30) DEFAULT 'pending',  -- pending, payment_initiated, payment_succeeded, order_created, expired, failed
    order_id INTEGER,  -- Populated when order is successfully created
    transaction_id VARCHAR(255),  -- Links to payment_transactions
    
    -- Timing
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,  -- Pending orders expire after 30 minutes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    payment_completed_at TIMESTAMP WITH TIME ZONE,
    order_created_at TIMESTAMP WITH TIME ZONE,
    
    -- Error tracking
    error_message TEXT,
    error_details JSONB,
    retry_count INTEGER DEFAULT 0
);

-- Indexes for pending_orders
CREATE INDEX IF NOT EXISTS idx_pending_orders_user ON pending_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_orders_payment_intent ON pending_orders(payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_pending_orders_razorpay_order ON pending_orders(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_pending_orders_razorpay_payment ON pending_orders(razorpay_payment_id);
CREATE INDEX IF NOT EXISTS idx_pending_orders_status ON pending_orders(status);
CREATE INDEX IF NOT EXISTS idx_pending_orders_expires ON pending_orders(expires_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_pending_orders_order_id ON pending_orders(order_id) WHERE order_id IS NOT NULL;

COMMENT ON TABLE pending_orders IS 'Payment intent records created before payment. Used to guarantee order creation even if checkout flow fails.';

-- ============================================================================
-- 2. BACKGROUND_JOBS TABLE
-- Tracks all background job executions (retries, recovery, reconciliation).
-- ============================================================================

CREATE TABLE IF NOT EXISTS background_jobs (
    id SERIAL PRIMARY KEY,
    job_type VARCHAR(50) NOT NULL,  -- order_creation_retry, payment_recovery, webhook_retry, order_reconciliation
    job_id VARCHAR(100) NOT NULL,  -- RQ job ID or unique identifier
    
    -- Job payload
    payload JSONB NOT NULL,
    
    -- Status tracking
    status VARCHAR(30) DEFAULT 'pending',  -- pending, running, completed, failed, retrying
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    
    -- Timing
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    
    -- Results
    result JSONB,
    error_message TEXT,
    error_traceback TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for background_jobs
CREATE INDEX IF NOT EXISTS idx_background_jobs_type ON background_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_background_jobs_status ON background_jobs(status);
CREATE INDEX IF NOT EXISTS idx_background_jobs_scheduled ON background_jobs(scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_background_jobs_retry ON background_jobs(next_retry_at) WHERE status = 'retrying';
CREATE UNIQUE INDEX IF NOT EXISTS idx_background_jobs_job_id ON background_jobs(job_id);

COMMENT ON TABLE background_jobs IS 'Background job tracking for retries, recovery, and reconciliation tasks.';

-- ============================================================================
-- 3. PAYMENT_ORDER_AUDIT TABLE
-- Comprehensive audit log for every payment→order attempt.
-- ============================================================================

CREATE TABLE IF NOT EXISTS payment_order_audit (
    id SERIAL PRIMARY KEY,
    
    -- Event identification
    event_type VARCHAR(50) NOT NULL,  -- payment_initiated, payment_succeeded, payment_failed, order_created, order_creation_failed, webhook_received, webhook_processed, recovery_attempted
    event_id VARCHAR(100),  -- Razorpay event ID or webhook ID
    
    -- Payment details
    razorpay_order_id VARCHAR(100),
    razorpay_payment_id VARCHAR(100),
    razorpay_signature VARCHAR(500),
    qr_code_id VARCHAR(100),
    payment_method VARCHAR(50),
    
    -- Order details
    user_id INTEGER,
    order_id INTEGER,
    pending_order_id INTEGER,
    transaction_id VARCHAR(255),
    amount NUMERIC(10,2),
    currency VARCHAR(10) DEFAULT 'INR',
    
    -- Context
    cart_items JSONB,  -- What was in the cart
    shipping_address TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    
    -- Result
    success BOOLEAN NOT NULL,
    error_message TEXT,
    error_details JSONB,
    response_data JSONB,  -- API responses, webhook payloads, etc.
    
    -- Timing
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for payment_order_audit
CREATE INDEX IF NOT EXISTS idx_payment_order_audit_event ON payment_order_audit(event_type);
CREATE INDEX IF NOT EXISTS idx_payment_order_audit_user ON payment_order_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_order_audit_payment ON payment_order_audit(razorpay_payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_order_audit_order ON payment_order_audit(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_order_audit_success ON payment_order_audit(success);
CREATE INDEX IF NOT EXISTS idx_payment_order_audit_created ON payment_order_audit(created_at);

COMMENT ON TABLE payment_order_audit IS 'Comprehensive audit log for every payment-to-order event. Used for debugging, recovery, and compliance.';

-- ============================================================================
-- 4. ENHANCEMENTS TO EXISTING TABLES
-- ============================================================================

-- Add payment_intent_id to payment_transactions (links to pending_orders)
ALTER TABLE payment_transactions
ADD COLUMN IF NOT EXISTS payment_intent_id UUID;

CREATE INDEX IF NOT EXISTS idx_payment_transactions_intent ON payment_transactions(payment_intent_id);

-- Add index on webhook_events for recovery queries
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed_created ON webhook_events(processed, created_at);

-- Add index on payment_transactions for recovery queries
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status_created ON payment_transactions(status, created_at);

-- ============================================================================
-- 5. VIEWS FOR MONITORING
-- ============================================================================

-- View: Payments without matching orders (orphaned payments)
CREATE OR REPLACE VIEW v_orphaned_payments AS
SELECT
    pt.id AS payment_transaction_id,
    pt.transaction_id,
    pt.razorpay_order_id,
    pt.razorpay_payment_id,
    pt.razorpay_qr_code_id,
    pt.user_id,
    pt.amount,
    pt.status,
    pt.created_at AS payment_created_at,
    pt.completed_at AS payment_completed_at,
    o.id AS order_id,
    o.created_at AS order_created_at,
    CASE
        WHEN o.id IS NULL THEN 'NO_ORDER'
        WHEN o.id IS NOT NULL THEN 'ORDER_EXISTS'
    END AS reconciliation_status
FROM payment_transactions pt
LEFT JOIN orders o ON pt.order_id = o.id
WHERE pt.status = 'completed'
  AND o.id IS NULL
  AND pt.created_at > NOW() - INTERVAL '7 days'
ORDER BY pt.created_at DESC;

COMMENT ON VIEW v_orphaned_payments IS 'Identifies completed payments that have no matching order — these need recovery.';

-- View: Pending orders needing attention
CREATE OR REPLACE VIEW v_pending_orders_attention AS
SELECT
    po.id,
    po.user_id,
    po.payment_intent_id,
    po.razorpay_order_id,
    po.razorpay_payment_id,
    po.status,
    po.total_amount,
    po.order_id,
    po.retry_count,
    po.error_message,
    po.expires_at,
    po.created_at,
    CASE
        WHEN po.status = 'pending' AND po.expires_at < NOW() THEN 'EXPIRED'
        WHEN po.status = 'payment_succeeded' AND po.order_id IS NULL THEN 'NEEDS_ORDER_CREATION'
        WHEN po.status = 'order_creation_failed' AND po.retry_count < 3 THEN 'RETRY_AVAILABLE'
        WHEN po.status = 'order_creation_failed' AND po.retry_count >= 3 THEN 'MAX_RETRIES_EXCEEDED'
        ELSE 'OK'
    END AS attention_status
FROM pending_orders po
WHERE po.status NOT IN ('order_created', 'expired')
  AND po.created_at > NOW() - INTERVAL '7 days'
ORDER BY po.created_at DESC;

COMMENT ON VIEW v_pending_orders_attention IS 'Shows pending orders that need manual or automated attention.';

-- ============================================================================
-- 6. TRIGGER FOR updated_at
-- ============================================================================

CREATE OR REPLACE TRIGGER trg_pending_orders_updated_at
    BEFORE UPDATE ON pending_orders
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_background_jobs_updated_at
    BEFORE UPDATE ON background_jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verify tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('pending_orders', 'background_jobs', 'payment_order_audit')
ORDER BY table_name;
