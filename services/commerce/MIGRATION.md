# Database Migration: rename compare_at_price to mrp

**IMPORTANT:** This migration requires downtime or careful execution.

## Changes

### Table: products
- Rename column `compare_at_price` to `mrp`
- Add column `discount_percentage` (computed property, no migration needed)

### Table: inventory
- Add column `price` (Numeric(10, 2), nullable)
- Add column `description` (Text, nullable)
- Add column `weight` (Numeric(10, 3), nullable)
- Add column `barcode` (String(100), nullable)

## Manual Migration (PostgreSQL)

```sql
-- Rename compare_at_price to mrp
ALTER TABLE products RENAME COLUMN compare_at_price TO mrp;

-- Add inventory variant columns
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS weight NUMERIC(10, 3);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS barcode VARCHAR(100);
```

## Rollback (if needed)

```sql
-- Rename mrp back to compare_at_price
ALTER TABLE products RENAME COLUMN mrp TO compare_at_price;

-- Drop inventory columns (careful - data will be lost!)
ALTER TABLE inventory DROP COLUMN IF EXISTS price;
ALTER TABLE inventory DROP COLUMN IF EXISTS description;
ALTER TABLE inventory DROP COLUMN IF EXISTS weight;
ALTER TABLE inventory DROP COLUMN IF EXISTS barcode;
```

## Frontend Updates Required

Update any code using `compare_at_price` to use `mrp`:
```javascript
// Before
product.compare_at_price

// After
product.mrp
```

Also update discount percentage calculation:
```javascript
// Before
const discount = product.compare_at_price - product.price;

// After  
const discount = product.mrp - product.price;
const discountPercentage = product.mrp > product.price 
  ? Math.round((product.mrp - product.price) / product.mrp * 100) 
  : 0;
```

## Verification

After migration, verify:
1. `mrp` column exists in products table
2. New inventory columns exist
3. Products still load correctly
4. Discount calculations work
