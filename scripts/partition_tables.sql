-- =========================================================================
-- ADVANCED DATABASE PARTITIONING & ANALYTICS VIEWS
-- Run this securely through psql or a migration framework like Alembic
-- =========================================================================

-- 1. MATERIALIZED VIEW FOR FAST STAFF DASHBOARD ANALYTICS
-- This avoids heavy joins on every dashboard page load by pre-calculating the aggregates natively.
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_dashboard_stats AS
SELECT 
    COUNT(o.id) as total_orders,
    COALESCE(SUM(o.total_amount), 0) as total_revenue,
    COUNT(CASE WHEN o.status = 'pending' THEN 1 END) as pending_orders,
    COUNT(CASE WHEN o.status = 'processing' THEN 1 END) as processing_orders,
    COUNT(CASE WHEN o.status = 'shipped' THEN 1 END) as shipped_orders,
    COUNT(CASE WHEN o.status = 'delivered' THEN 1 END) as delivered_orders
FROM orders o
WHERE o.created_at >= date_trunc('month', CURRENT_DATE);

-- Ensure fast refreshes in the future
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_dashboard_stats ON mv_dashboard_stats (total_orders);


-- 2. PARTITIONING STRATEGY (Future-Proofing for massive scale)
-- NOTE: PostgreSQL requires table recreation to apply RANGE partitioning to an existing table.
-- The following outlines how `order_tracking` should be re-architected when the table exceeds 10M rows.

/* 
-- Draft schema for future order_tracking partitioning by month:

CREATE TABLE order_tracking_partitioned (
    id SERIAL,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL,
    location VARCHAR(255),
    notes TEXT,
    updated_by INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
) PARTITION BY RANGE (created_at);

-- Create table partitions for standard operating months natively
CREATE TABLE order_tracking_y2026m01 PARTITION OF order_tracking_partitioned
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE order_tracking_y2026m02 PARTITION OF order_tracking_partitioned
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE order_tracking_y2026m03 PARTITION OF order_tracking_partitioned
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

-- Default partition for anomalous dates
CREATE TABLE order_tracking_default PARTITION OF order_tracking_partitioned DEFAULT;

-- To seamlessly migrate:
-- 1. INSERT INTO order_tracking_partitioned SELECT * FROM order_tracking;
-- 2. ALTER TABLE order_tracking RENAME TO order_tracking_old;
-- 3. ALTER TABLE order_tracking_partitioned RENAME TO order_tracking;
-- 4. DROP TABLE order_tracking_old;
*/
