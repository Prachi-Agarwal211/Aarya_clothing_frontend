-- =====================================================
-- Migration: Add Default Inventory to Existing Products
-- Date: 2026-03-20
-- Purpose: Fix critical bug where products were created without inventory records
-- Issue: Products created without variants had NO inventory record at all
-- Solution: Add default "One Size/Default" inventory to all products missing it
-- =====================================================

-- Start transaction for safety
BEGIN;

-- Step 1: Show how many products are missing inventory (diagnostic)
SELECT 
    'Products missing inventory BEFORE migration' AS status,
    COUNT(*) AS count
FROM products p
LEFT JOIN inventory i ON p.id = i.product_id
WHERE i.product_id IS NULL;

-- Step 2: Add default inventory for all products missing it
INSERT INTO inventory (product_id, sku, size, color, quantity, low_stock_threshold, created_at, updated_at)
SELECT 
    p.id AS product_id,
    'PRD-' || p.id || '-BASE' AS sku,
    'One Size' AS size,
    'Default' AS color,
    0 AS quantity,  -- Set to 0 for safety, admin can update later
    5 AS low_stock_threshold,
    NOW() AS created_at,
    NOW() AS updated_at
FROM products p
LEFT JOIN inventory i ON p.id = i.product_id
WHERE i.product_id IS NULL;

-- Step 3: Verify the fix - show how many were fixed
SELECT 
    'Fixed with default inventory' AS status,
    COUNT(*) AS count
FROM inventory i
WHERE i.sku LIKE 'PRD-%-BASE'
AND i.created_at > NOW() - INTERVAL '1 hour';

-- Step 4: Verify ALL products now have inventory
SELECT 
    'Products still missing inventory AFTER migration' AS status,
    COUNT(*) AS count
FROM products p
LEFT JOIN inventory i ON p.id = i.product_id
WHERE i.product_id IS NULL;

-- Step 5: Show summary of inventory distribution
SELECT 
    'Inventory Summary' AS report,
    COUNT(DISTINCT p.id) AS total_products,
    COUNT(DISTINCT i.product_id) AS products_with_inventory,
    COUNT(DISTINCT i.id) AS total_inventory_records,
    ROUND(AVG(i.quantity), 2) AS avg_quantity,
    SUM(i.quantity) AS total_stock
FROM products p
LEFT JOIN inventory i ON p.id = i.product_id;

-- Step 6: Show recently fixed products (for verification)
SELECT 
    p.id AS product_id,
    p.name AS product_name,
    i.sku,
    i.size,
    i.color,
    i.quantity,
    i.low_stock_threshold,
    i.created_at AS inventory_created_at
FROM products p
JOIN inventory i ON p.id = i.product_id
WHERE i.sku LIKE 'PRD-%-BASE'
AND i.created_at > NOW() - INTERVAL '1 hour'
ORDER BY p.id DESC
LIMIT 20;

-- Commit the transaction
COMMIT;

-- =====================================================
-- Post-Migration Verification Queries (run separately)
-- =====================================================

-- Verify no products are missing inventory:
-- SELECT COUNT(*) FROM products p LEFT JOIN inventory i ON p.id = i.product_id WHERE i.product_id IS NULL;
-- Expected: 0

-- Show inventory distribution:
-- SELECT 
--     CASE 
--         WHEN COUNT(i.id) = 0 THEN 'No Inventory'
--         WHEN COUNT(i.id) = 1 THEN 'Single Record'
--         ELSE 'Multiple Variants'
--     END AS inventory_type,
--     COUNT(*) AS product_count
-- FROM products p
-- LEFT JOIN inventory i ON p.id = i.product_id
-- GROUP BY inventory_type;
