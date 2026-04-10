-- =====================================================
-- Migration: Remove Fake "One Size/Default" Inventory
-- Date: 2026-04-08
-- Purpose: Clean up bogus inventory records created by the old auto-creation bug
-- Issue: Products were getting fake "One Size/Default" inventory records even when
--        real variants (S, M, L, etc.) were specified by the admin.
-- Strategy: Only remove "One Size/Default" records for products that have REAL variants.
--           Products with ONLY "One Size/Default" are flagged but NOT deleted (admin must fix).
-- =====================================================

BEGIN;

-- Step 1: Diagnostic — show how many "One Size/Default" records exist
SELECT
    'One Size/Default records BEFORE cleanup' AS status,
    COUNT(*) AS count
FROM inventory
WHERE size = 'One Size' AND color = 'Default';

-- Step 2: Show products that have BOTH "One Size/Default" AND real variants
-- These are the ones we will clean up
SELECT
    p.id AS product_id,
    p.name AS product_name,
    COUNT(i.id) AS total_inventory_records,
    COUNT(CASE WHEN i.size = 'One Size' AND i.color = 'Default' THEN 1 END) AS fake_records,
    COUNT(CASE WHEN NOT (i.size = 'One Size' AND i.color = 'Default') THEN 1 END) AS real_records
FROM products p
JOIN inventory i ON p.id = i.product_id
GROUP BY p.id, p.name
HAVING COUNT(CASE WHEN i.size = 'One Size' AND i.color = 'Default' THEN 1 END) > 0
   AND COUNT(CASE WHEN NOT (i.size = 'One Size' AND i.color = 'Default') THEN 1 END) > 0
ORDER BY p.id;

-- Step 3: DELETE "One Size/Default" records ONLY for products that have real variants
-- This is safe because the real variants remain
DELETE FROM inventory
WHERE size = 'One Size'
  AND color = 'Default'
  AND product_id IN (
      -- Only delete for products that have at least one REAL variant
      SELECT DISTINCT product_id
      FROM inventory
      WHERE NOT (size = 'One Size' AND color = 'Default')
  );

-- Step 4: Show what was deleted
SELECT
    'One Size/Default records AFTER cleanup' AS status,
    COUNT(*) AS remaining_count
FROM inventory
WHERE size = 'One Size' AND color = 'Default';

-- Step 5: Flag products that ONLY have "One Size/Default" (no real variants)
-- These products are effectively invisible to customers and need admin attention
SELECT
    p.id AS product_id,
    p.name AS product_name,
    p.slug,
    i.sku,
    i.quantity,
    i.created_at AS inventory_created_at,
    'ACTION REQUIRED: Add real variants via admin panel' AS recommendation
FROM products p
JOIN inventory i ON p.id = i.product_id
WHERE i.size = 'One Size' AND i.color = 'Default'
  AND NOT EXISTS (
      SELECT 1 FROM inventory i2
      WHERE i2.product_id = p.id
        AND NOT (i2.size = 'One Size' AND i2.color = 'Default')
  )
ORDER BY p.id;

-- Step 6: Final summary
SELECT
    'Cleanup Summary' AS report,
    COUNT(DISTINCT i.product_id) AS products_with_real_variants_only,
    COUNT(DISTINCT CASE WHEN i.size = 'One Size' AND i.color = 'Default' THEN p.id END) AS products_still_with_fake_only,
    COUNT(DISTINCT i.id) AS total_inventory_records_remaining
FROM products p
LEFT JOIN inventory i ON p.id = i.product_id;

COMMIT;

-- =====================================================
-- Post-Migration Verification (run separately)
-- =====================================================

-- 1. Verify no "One Size/Default" records exist for products with real variants:
-- SELECT COUNT(*) FROM inventory i1
-- WHERE i1.size = 'One Size' AND i1.color = 'Default'
-- AND EXISTS (
--     SELECT 1 FROM inventory i2
--     WHERE i2.product_id = i1.product_id
--     AND NOT (i2.size = 'One Size' AND i2.color = 'Default')
-- );
-- Expected: 0

-- 2. Show products that still need admin attention (only have "One Size/Default"):
-- SELECT p.id, p.name, p.slug FROM products p
-- JOIN inventory i ON p.id = i.product_id
-- WHERE i.size = 'One Size' AND i.color = 'Default'
-- AND NOT EXISTS (
--     SELECT 1 FROM inventory i2 WHERE i2.product_id = p.id
--     AND NOT (i2.size = 'One Size' AND i2.color = 'Default')
-- );
