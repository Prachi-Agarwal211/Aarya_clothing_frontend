# Orders Display Issue - Root Cause Analysis

**Date:** 2026-04-08  
**Severity:** CRITICAL — Zero orders visible in admin panel (8 orders existed in DB)

---

## Root Cause

The `GET /api/v1/admin/orders` endpoint in `services/admin/main.py` was returning **500 Internal Server Error** for every request due to **non-existent column references** in the SQL query that fetches order items.

### The Broken Query (lines 1773-1783)

```sql
SELECT oi.order_id, oi.id as item_id, oi.product_id, oi.product_name,
       oi.size, oi.quantity, oi.unit_price, oi.total_price,    -- ❌ total_price doesn't exist
       oi.image_url, p.name as product_name_from_catalog       -- ❌ image_url doesn't exist
FROM order_items oi
LEFT JOIN products p ON p.id = oi.product_id
WHERE oi.order_id IN (...)
```

### Actual `order_items` Table Schema

| Column | Type |
|--------|------|
| id | integer |
| order_id | integer |
| inventory_id | integer |
| product_id | integer |
| product_name | varchar(255) |
| sku | varchar(100) |
| size | varchar(50) |
| color | varchar(50) |
| hsn_code | varchar(10) |
| gst_rate | numeric(5,2) |
| quantity | integer |
| unit_price | numeric(10,2) |
| **price** | numeric(10,2) | ← This is the total price, NOT `total_price` |
| created_at | timestamp |

### Two Column Mismatches

1. **`oi.total_price`** → Should be **`oi.price`**
   - The column is named `price`, not `total_price`
   - This is the line item total (unit_price × quantity)

2. **`oi.image_url`** → Does not exist in `order_items` table
   - No image column exists on order_items
   - Product images are stored in a separate `product_images` table
   - The frontend already handles missing images gracefully (shows placeholder icon)

---

## Evidence

### Admin Service Logs (before fix)
```
2026-04-08 18:37:11,910 - core.exception_handler - ERROR - Database error: 
(psycopg2.errors.UndefinedColumn) column oi.total_price does not exist
[SQL: SELECT oi.order_id, oi.id as item_id, oi.product_id, oi.product_name,
       oi.size, oi.quantity, oi.unit_price, oi.total_price,
       oi.image_url, p.name as product_name_from_catalog
FROM order_items oi ...]
INFO: 172.18.0.10:38718 - "GET /api/v1/admin/orders?user_id=337&limit=5&skip=0 HTTP/1.1" 500 Internal Server Error
```

### Database Verification
```sql
SELECT COUNT(*) FROM orders;  -- Returns: 8 orders exist
```

Orders were in the database, but the API crashed before returning them.

---

## The Fix

Changed the order items query from:
```python
SELECT oi.order_id, oi.id as item_id, oi.product_id, oi.product_name,
       oi.size, oi.quantity, oi.unit_price, oi.total_price,
       oi.image_url, p.name as product_name_from_catalog
```

To:
```python
SELECT oi.order_id, oi.id as item_id, oi.product_id, oi.product_name,
       oi.size, oi.quantity, oi.unit_price, oi.price,
       p.name as product_name_from_catalog
```

And the response mapping from:
```python
"product_name": item_row[3] or item_row[9] or "Unknown Product",
"image_url": item_row[8],
```

To:
```python
"product_name": item_row[3] or item_row[8] or "Unknown Product",
"image_url": None,
```

### What Changed
| Field | Before | After |
|-------|--------|-------|
| `oi.total_price` | ❌ Column doesn't exist | `oi.price` (correct column) |
| `oi.image_url` | ❌ Column doesn't exist | `None` (frontend handles this) |
| `product_name_from_catalog` index | `item_row[9]` | `item_row[8]` (shifted due to fewer columns) |

---

## What We're NOT Building

1. **No `total_price` column migration** — The `price` column already serves this purpose. Adding a duplicate column would be over-engineering.
2. **No `image_url` column on order_items** — Product images are properly managed in the `product_images` table. Adding images to order_items would denormalize the schema unnecessarily.
3. **No complex JOIN to product_images** — The frontend already gracefully handles missing `image_url` by showing a placeholder ShoppingBag icon. A JOIN for images would add query complexity for zero user-visible benefit.

---

## Files Changed

- `services/admin/main.py` — Line 1773-1798 (order items batch query in `list_all_orders`)

---

## Verification Steps

1. ✅ Admin service rebuilt and restarted successfully
2. ✅ No SQL errors in startup logs
3. ✅ **API returns all 8 orders**: `Total: 8, Orders returned: 8`
4. ✅ No errors in admin service logs
5. ✅ Customer detail modal should now show order items (the `user_id` filter also works correctly)

---

## How This Happened

The `list_all_orders` endpoint was rewritten to use direct DB queries instead of httpx proxy (likely during a refactor). The new SQL query was written assuming column names that matched the response schema (`total_price`, `image_url`) rather than the actual database schema (`price`, no image column). This is a classic case of writing SQL based on "what makes sense" rather than checking the actual table structure first.

### Prevention

Before writing any raw SQL query, always run `\d table_name` in psql to verify column names exist. Never assume column names match your desired output schema.
