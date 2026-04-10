-- Migration 004: Customer Activity Logging & Order Reconciliation Safeguards
-- Adds comprehensive customer activity tracking, order reconciliation checks,
-- and background job safety mechanisms.

-- ============================================
-- CUSTOMER ACTIVITY LOGS TABLE
-- Tracks all customer actions for audit and admin visibility
-- ============================================
CREATE TABLE IF NOT EXISTS customer_activity_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    activity_type VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50),
    resource_id INTEGER,
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_activity_user ON customer_activity_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_activity_type ON customer_activity_logs(activity_type);
CREATE INDEX IF NOT EXISTS idx_customer_activity_resource ON customer_activity_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_customer_activity_created ON customer_activity_logs(created_at DESC);

-- Activity type constraint
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_customer_activity_type') THEN
        ALTER TABLE customer_activity_logs ADD CONSTRAINT chk_customer_activity_type
            CHECK (activity_type IN (
                'order_view', 'order_cancel', 'order_reorder', 'order_invoice_download',
                'order_print', 'order_detail_view', 'cart_add', 'cart_remove',
                'wishlist_add', 'wishlist_remove', 'review_create', 'review_edit',
                'address_add', 'address_edit', 'address_delete', 'profile_update',
                'password_change', 'login', 'logout', 'signup'
            ));
    END IF;
END $$;


-- ============================================
-- ORDER RECONCILIATION VIEW
-- Detects mismatches between orders and payments
-- ============================================

-- View 1: Orders with no matching payment (potential false orders)
CREATE OR REPLACE VIEW v_orders_without_payment AS
SELECT
    o.id AS order_id,
    o.user_id,
    o.invoice_number,
    o.total_amount,
    o.status,
    o.transaction_id,
    o.razorpay_order_id,
    o.razorpay_payment_id,
    o.created_at,
    u.email AS customer_email,
    u.username AS customer_username,
    CASE
        WHEN o.status = 'cancelled' THEN 'CANCELLED - No payment expected'
        WHEN o.transaction_id IS NULL AND o.razorpay_payment_id IS NULL THEN 'NO PAYMENT RECORD'
        ELSE 'PAYMENT MISMATCH'
    END AS reconciliation_status
FROM orders o
JOIN users u ON o.user_id = u.id
LEFT JOIN payment_transactions pt ON (
    pt.order_id = o.id
    OR pt.razorpay_payment_id = o.razorpay_payment_id
    OR pt.transaction_id = o.transaction_id
)
WHERE pt.id IS NULL
  AND o.status != 'cancelled'
  AND o.created_at > NOW() - INTERVAL '30 days'
ORDER BY o.created_at DESC;


-- View 2: Payments with no matching order (orphaned payments - already exists but improved)
CREATE OR REPLACE VIEW v_orphaned_payments_enhanced AS
SELECT
    pt.id AS payment_transaction_id,
    pt.transaction_id,
    pt.razorpay_order_id,
    pt.razorpay_payment_id,
    pt.razorpay_qr_code_id,
    pt.user_id,
    pt.amount,
    pt.status,
    pt.payment_method,
    pt.created_at AS payment_created_at,
    u.email AS customer_email,
    u.username AS customer_username,
    CASE
        WHEN pt.status = 'completed' THEN 'CRITICAL: Payment completed but no order'
        WHEN pt.status = 'pending' THEN 'WARNING: Payment pending, may expire'
        ELSE 'INFO: Payment in ' || pt.status || ' state'
    END AS reconciliation_status
FROM payment_transactions pt
LEFT JOIN orders o ON (
    o.id = pt.order_id
    OR o.transaction_id = pt.transaction_id
    OR o.razorpay_payment_id = pt.razorpay_payment_id
)
JOIN users u ON pt.user_id = u.id
WHERE o.id IS NULL
  AND pt.created_at > NOW() - INTERVAL '7 days'
ORDER BY pt.created_at DESC;


-- View 3: Amount mismatch detection
CREATE OR REPLACE VIEW v_payment_amount_mismatches AS
SELECT
    o.id AS order_id,
    o.invoice_number,
    o.total_amount AS order_total,
    pt.amount AS payment_amount,
    o.total_amount - pt.amount AS difference,
    o.user_id,
    o.status,
    pt.payment_method,
    pt.razorpay_payment_id,
    o.created_at,
    u.email AS customer_email
FROM orders o
JOIN payment_transactions pt ON (
    pt.order_id = o.id
    OR pt.transaction_id = o.transaction_id
    OR pt.razorpay_payment_id = o.razorpay_payment_id
)
JOIN users u ON o.user_id = u.id
WHERE o.total_amount != pt.amount
  AND o.status != 'cancelled'
  AND ABS(o.total_amount - pt.amount) > 0.01
ORDER BY o.created_at DESC;


-- ============================================
-- ORDER RECONCILIATION FUNCTION
-- Can be called manually or by scheduled job
-- ============================================
CREATE OR REPLACE FUNCTION run_order_reconciliation()
RETURNS TABLE(
    issue_type TEXT,
    issue_count INTEGER,
    details TEXT
) AS $$
DECLARE
    orphaned_payments_count INTEGER;
    orders_no_payment_count INTEGER;
    amount_mismatches_count INTEGER;
BEGIN
    -- Count orphaned payments
    SELECT COUNT(*) INTO orphaned_payments_count
    FROM payment_transactions pt
    LEFT JOIN orders o ON o.id = pt.order_id OR o.transaction_id = pt.transaction_id
    WHERE pt.status = 'completed' AND o.id IS NULL
      AND pt.created_at > NOW() - INTERVAL '7 days';

    -- Count orders without payment
    SELECT COUNT(*) INTO orders_no_payment_count
    FROM orders o
    LEFT JOIN payment_transactions pt ON pt.order_id = o.id
    WHERE o.status NOT IN ('cancelled')
      AND o.transaction_id IS NULL
      AND pt.id IS NULL
      AND o.created_at > NOW() - INTERVAL '30 days';

    -- Count amount mismatches
    SELECT COUNT(*) INTO amount_mismatches_count
    FROM orders o
    JOIN payment_transactions pt ON pt.order_id = o.id
    WHERE o.total_amount != pt.amount
      AND ABS(o.total_amount - pt.amount) > 0.01
      AND o.status != 'cancelled';

    RETURN QUERY SELECT
        'orphaned_payments',
        orphaned_payments_count,
        'Completed payments with no matching order'::TEXT;

    RETURN QUERY SELECT
        'orders_without_payment',
        orders_no_payment_count,
        'Orders with no payment record (potential false orders)'::TEXT;

    RETURN QUERY SELECT
        'amount_mismatches',
        amount_mismatches_count,
        'Orders where payment amount differs from order total'::TEXT;
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- ORDER STATUS TRANSITION SAFEGUARDS
-- Prevents invalid state changes
-- ============================================

-- Function to validate order status transitions
CREATE OR REPLACE FUNCTION validate_order_status_transition()
RETURNS TRIGGER AS $$
BEGIN
    -- Only allow valid transitions
    IF OLD.status = 'confirmed' AND NEW.status NOT IN ('confirmed', 'shipped', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid transition from confirmed to %', NEW.status;
    ELSIF OLD.status = 'shipped' AND NEW.status NOT IN ('shipped', 'delivered') THEN
        RAISE EXCEPTION 'Invalid transition from shipped to %', NEW.status;
    ELSIF OLD.status = 'delivered' THEN
        RAISE EXCEPTION 'Cannot change status from delivered (terminal state)';
    ELSIF OLD.status = 'cancelled' THEN
        RAISE EXCEPTION 'Cannot change status from cancelled (terminal state)';
    END IF;

    -- Log status change to customer activity
    INSERT INTO customer_activity_logs (user_id, activity_type, resource_type, resource_id, details)
    VALUES (
        NEW.user_id,
        'order_status_change',
        'order',
        NEW.id,
        jsonb_build_object(
            'old_status', OLD.status,
            'new_status', NEW.status,
            'changed_by', COALESCE(NEW.updated_by::text, 'system'),
            'invoice_number', NEW.invoice_number
        )
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to orders table
DROP TRIGGER IF EXISTS trigger_validate_order_status ON orders;
CREATE TRIGGER trigger_validate_order_status
    BEFORE UPDATE OF status ON orders
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION validate_order_status_transition();


-- ============================================
-- BACKGROUND JOB ORDER CREATION SAFEGUARD
-- Prevents creating orders that were legitimately cancelled
-- ============================================

-- Add updated_by column to orders if not exists (for tracking who changed status)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Function to check if order should NOT be created by recovery job
CREATE OR REPLACE FUNCTION should_skip_recovery_order(
    p_user_id INTEGER,
    p_payment_id VARCHAR,
    OUT should_skip BOOLEAN,
    OUT reason TEXT
) AS $$
DECLARE
    existing_order RECORD;
BEGIN
    should_skip := FALSE;
    reason := '';

    -- Check if user already has an order with this payment
    SELECT * INTO existing_order
    FROM orders
    WHERE user_id = p_user_id
      AND (transaction_id = p_payment_id OR razorpay_payment_id = p_payment_id)
    LIMIT 1;

    IF FOUND THEN
        should_skip := TRUE;
        reason := 'Order already exists: ' || existing_order.id || ' (status: ' || existing_order.status || ')';
        RETURN;
    END IF;

    -- Check if payment was refunded (order was cancelled legitimately)
    SELECT * INTO existing_order
    FROM payment_transactions
    WHERE (razorpay_payment_id = p_payment_id OR transaction_id = p_payment_id)
      AND status = 'refunded'
    LIMIT 1;

    IF FOUND THEN
        should_skip := TRUE;
        reason := 'Payment was refunded - order should not be recreated';
        RETURN;
    END IF;

    -- Check if payment is still pending (not completed yet)
    SELECT * INTO existing_order
    FROM payment_transactions
    WHERE (razorpay_payment_id = p_payment_id OR transaction_id = p_payment_id)
      AND status = 'pending'
    LIMIT 1;

    IF FOUND THEN
        should_skip := TRUE;
        reason := 'Payment still pending - wait for completion';
        RETURN;
    END IF;

    -- Check if payment is failed
    SELECT * INTO existing_order
    FROM payment_transactions
    WHERE (razorpay_payment_id = p_payment_id OR transaction_id = p_payment_id)
      AND status IN ('failed', 'cancelled')
    LIMIT 1;

    IF FOUND THEN
        should_skip := TRUE;
        reason := 'Payment failed/cancelled - should not create order';
        RETURN;
    END IF;
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Order items: faster joins with product data
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

-- Payment transactions: faster reconciliation
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_lookup ON payment_transactions(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status_lookup ON payment_transactions(status, order_id) WHERE status = 'completed' AND order_id IS NULL;

-- Orders: faster customer order history
CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders(user_id, created_at DESC);


-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON TABLE customer_activity_logs IS 'Tracks all customer actions for audit trail and admin visibility';
COMMENT ON VIEW v_orders_without_payment IS 'Detects potential false orders (orders created without payment)';
COMMENT ON VIEW v_orphaned_payments_enhanced IS 'Detects completed payments with no matching order';
COMMENT ON VIEW v_payment_amount_mismatches IS 'Detects orders where payment amount differs from order total';
COMMENT ON FUNCTION run_order_reconciliation() IS 'Runs reconciliation checks and returns summary of issues';
COMMENT ON FUNCTION validate_order_status_transition() IS 'Prevents invalid order status transitions';
COMMENT ON FUNCTION should_skip_recovery_order() IS 'Checks if recovery job should skip creating an order';
