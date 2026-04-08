# Customer Detail Page Analysis

**Date:** 2026-04-08
**Scope:** Admin customer detail page — order history with product images and variant details

---

## 1. Current Customer Detail Page Structure

### File: `frontend_new/components/admin/customers/CustomerDetailModal.jsx`

The customer detail page is implemented as a **modal dialog** (not a dedicated page route). It is triggered from the customers list page (`frontend_new/app/admin/customers/page.js`, line 445) when a user clicks a customer name.

### What It Currently Shows:

| Section | Data Source | Displayed? |
|---------|-------------|------------|
| Profile header (name, username, avatar initials) | `usersApi.get(customerId)` → `/api/v1/admin/users/{id}` | Yes |
| Email (with copy button) | Same API | Yes |
| Phone (with copy button) | Same API | Yes |
| Active/Inactive status badge | Same API | Yes |
| Email verified badge | Same API | Yes |
| Total Orders stat | `customer.order_count` from API | Yes |
| Total Spent stat | `customer.total_spent` from API | Yes |
| Last Order date stat | `customer.last_order_date` from API | Yes |
| Member Since / Last Updated | `customer.created_at` / `customer.updated_at` | Yes |
| **Recent Orders (max 5)** | `ordersApi.list({ user_id: customerId, limit: 5 })` | Yes — **but limited and shallow** |

### What the Recent Orders Section Shows (per order):
- Order number (`order_number` or `id`)
- Order date (`created_at`)
- Total amount (`total_amount`)
- Status badge (`status`)

### What It Does NOT Show:
- **Product names** in each order
- **Product images** for ordered items
- **Size/variant details** (size, color, SKU) for each ordered item
- **Quantity** of each item
- **Unit price** per item
- **Shipping address**
- **Payment method**
- **Order notes**
- **More than 5 orders** (hardcoded `limit: 5`)
- **No "View All Orders" inline** — it links away to `/admin/orders?user_id=${customerId}`

---

## 2. API Response Structure for Customer Detail

### Endpoint: `GET /api/v1/admin/users/{user_id}` (Admin Service)

**File:** `services/admin/main.py` (lines 4306–4355)

**Response schema (`UserListItem`):** `services/admin/schemas/admin.py` (lines 181–194)

```json
{
  "id": 1,
  "email": "customer@example.com",
  "username": "customer1",
  "full_name": "Jane Doe",
  "phone": "+91-9876543210",
  "role": "customer",
  "is_active": true,
  "created_at": "2025-01-15T10:30:00Z",
  "order_count": 5,
  "total_spent": 12500.00
}
```

**GAP:** This endpoint does NOT include `last_order_date` or `updated_at` fields despite the frontend trying to use them. The frontend will see `undefined` for these.

### Endpoint: `GET /api/v1/orders` (Commerce Service) — used by `ordersApi.list({ user_id: ... })`

**File:** `services/commerce/routes/orders.py` (lines 182–224)

**CRITICAL GAP:** This endpoint uses `get_current_user` middleware — it fetches `user_id` from the **authenticated user's token**, NOT from query parameters. When the admin frontend calls `ordersApi.list({ user_id: customerId })`, the `user_id` param is **ignored**. The endpoint returns the **admin user's own orders** (which are likely zero), not the customer's orders.

The `ordersApi.list` in `adminApi.js` routes to `/api/v1/admin/orders` (not `/api/v1/orders`), but the `CustomerDetailModal` imports from `@/lib/adminApi` and uses `ordersApi.list`. Let me re-check:

Looking at `CustomerDetailModal.jsx` line 19:
```js
import { usersApi, ordersApi } from '@/lib/adminApi';
```

And `adminApi.js` line 40-50:
```js
export const ordersApi = {
  list: (params = {}) => {
    const { page, limit = 20, ...rest } = params;
    return adminClient.get('/api/v1/admin/orders', {
      ...rest,
      limit,
      skip: (normalizedPage - 1) * limit,
    });
  },
```

So the modal calls `GET /api/v1/admin/orders?user_id=X&limit=5`.

**But the admin orders endpoint** (`services/admin/main.py` line 1711) does **NOT** support `user_id` as a filter parameter. Its signature is:
```python
async def list_all_orders(status, search, skip, limit, db, current_user)
```

It only filters by `status` and `search` — there is no `user_id` parameter.

**Result:** The orders shown in the customer detail modal are **all orders in the system** (first 5), not the specific customer's orders. This is a **silent data bug**.

### Response from `/api/v1/admin/orders`:
```json
{
  "orders": [
    {
      "id": 1,
      "user_id": 5,
      "total_amount": 2500.00,
      "status": "confirmed",
      "created_at": "2025-03-01T10:00:00Z",
      "customer_email": "customer@example.com",
      "customer_name": "Jane Doe",
      "customer_phone": "+91-9876543210",
      "order_number": "ORD-000001",
      "order_notes": null,
      "tracking_number": null,
      "invoice_number": null,
      "shipping_address": "..."
    }
  ],
  "total": 100,
  "skip": 0,
  "limit": 5
}
```

**GAP:** No `items` (order items with products) are included in this response.

### Endpoint: `GET /api/v1/admin/orders/{order_id}` (Admin Service)

**File:** `services/admin/main.py` (lines 1788–1843)

This endpoint **DOES** include order items:
```json
{
  "order": { ... },
  "items": [
    {
      "id": 1,
      "order_id": 1,
      "product_id": 10,
      "product_name": "Silk Kurta",
      "sku": "SKU-001",
      "size": "M",
      "color": "Red",
      "quantity": 2,
      "unit_price": 1200.00,
      "price": 2400.00
    }
  ],
  "tracking": [ ... ],
  "customer": { "id": 5, "full_name": "Jane Doe", "email": "...", "phone": "..." }
}
```

**GAP:** No `image_url` field in the items response. The raw DB query does a `LEFT JOIN products p ON p.id = oi.product_id` but only selects `p.name as product_name`. It does not join `inventory` or `products` for image URLs.

---

## 3. Database Relationships

```
users (shared/Core service)
  ├── id, email, username, role, is_active, created_at
  │
  └── user_profiles
        ├── user_id (FK → users.id)
        ├── full_name, phone

orders (Commerce service)
  ├── id
  ├── user_id (FK → users.id, nullable for guest orders)
  ├── total_amount, status, created_at, ...
  │
  └── order_items (FK → orders.id, cascade delete)
        ├── id
        ├── order_id
        ├── product_id (integer, snapshot — NOT a live FK)
        ├── product_name (text snapshot)
        ├── sku (text snapshot)
        ├── size (text snapshot)
        ├── color (text snapshot)
        ├── quantity
        ├── unit_price
        ├── price (total = unit_price * quantity)
        ├── inventory_id (FK → inventory.id, nullable)
        │
        └── [property] image_url → checks inventory.image_url, then product.image_url

inventory (Commerce service)
  ├── id
  ├── product_id (FK → products.id)
  ├── sku, size, color, color_hex
  ├── quantity, reserved_quantity
  ├── image_url (variant-specific image)
  └── product (relationship → Product)

products (Commerce service)
  ├── id
  ├── name, slug, base_price
  ├── category_id, collection_id
  └── images (relationship → ProductImage)

product_images
  ├── id
  ├── product_id (FK → products.id)
  ├── image_url
  ├── is_primary
  └── alt_text
```

### Key Observations:

1. **OrderItem has a property `image_url`** (in `models/order.py` line ~156) that resolves from `inventory.image_url` or `product.image_url`. However, the admin orders endpoint uses **raw SQL** and does NOT use the ORM property — it returns raw dict rows. The `image_url` property is never serialized.

2. **OrderItem stores `inventory_id`** as a foreign key. This means the variant's image URL is accessible via `OrderItem.inventory.image_url`.

3. **OrderItem stores `product_id`** as an integer snapshot (not a live FK). The `product` relationship is `viewonly=True`.

4. **The chain exists:** `Customer → Orders → OrderItems → Inventory → image_url` AND `OrderItems → Product → images`. The data is there; it just isn't being fetched.

---

## 4. What's Missing — Gap Analysis

### Gap 1: Orders are not filtered by customer (CRITICAL BUG)

**Location:** `CustomerDetailModal.jsx` line 38
```js
ordersApi.list({ user_id: customerId, limit: 5 })
```
**Problem:** The admin orders endpoint (`/api/v1/admin/orders`) does not accept `user_id` as a query parameter. It returns ALL orders, not the customer's orders.

**Impact:** The "Recent Orders" section shows random orders, not this customer's orders.

### Gap 2: No order items in the list response

**Location:** `services/admin/main.py` line 1711 (`list_all_orders`)
**Problem:** The orders list endpoint returns order headers only — no `items` array. To get items, you must call `GET /api/v1/admin/orders/{order_id}` for each order individually.

**Impact:** Even if Gap 1 were fixed, the frontend would only see order totals — no product names, sizes, images, or quantities.

### Gap 3: No image URLs in order item response

**Location:** `services/admin/main.py` line 1788 (`get_order`)
**Problem:** The SQL query joins `products` for `product_name` but does not select any image-related columns. The `OrderItem` ORM model has an `image_url` property, but raw SQL bypasses it.

**Impact:** Product images cannot be displayed for order items.

### Gap 4: Missing `last_order_date` and `updated_at` in user detail response

**Location:** `services/admin/main.py` line 4306 (`get_user`)
**Problem:** The SQL query does not select `u.updated_at` or compute `last_order_date`. The frontend references these fields (CustomerDetailModal lines 184, 195) but they will be `undefined`.

**Impact:** "Last Updated" and "Last Order" stats show incorrect data.

### Gap 5: Orders are hardcoded to limit 5 with no pagination

**Location:** `CustomerDetailModal.jsx` line 38
**Problem:** `limit: 5` is hardcoded. There's no "load more" or pagination for the recent orders section.

**Impact:** Customers with more than 5 orders only see the most recent 5.

### Gap 6: No dedicated customer detail page route

**Location:** `frontend_new/app/admin/customers/` — no `[id]/page.js` exists
**Problem:** Customer details are shown in a modal, not a dedicated page. This limits how much information can be displayed and makes bookmarking/sharing impossible.

**Impact:** UX is constrained by modal size; no direct URL to a customer's profile.

---

## 5. Recommended Implementation Approach

### Phase 1: Fix Critical Bugs (Required)

**Step 1A: Add `user_id` filter to admin orders endpoint**

File: `services/admin/main.py`, `list_all_orders` function (line ~1711)

Add `user_id: Optional[int] = Query(None)` parameter and add a WHERE clause:
```python
if user_id:
    where_clauses.append("o.user_id = :user_id")
    params["user_id"] = user_id
```

This fixes Gap 1 — the single most critical bug.

**Step 1B: Add missing fields to user detail response**

File: `services/admin/main.py`, `get_user` function (line ~4306)

Add `u.updated_at` to the SELECT, and compute `last_order_date` via a subquery or LEFT JOIN. Also update the `UserListItem` schema in `services/admin/schemas/admin.py` to include these fields.

### Phase 2: Enrich Orders with Items and Images (Required for the feature)

**Option A — N+1 approach (simplest, acceptable for detail modal with 5 orders):**

In `CustomerDetailModal.jsx`, after fetching the 5 orders, call `ordersApi.get(order.id)` for each order to get full details including items. Then merge items into the order objects.

- Pros: No backend changes needed beyond Gap 1 fix
- Cons: 6 API calls (1 list + 5 details) instead of 1

**Option B — Single enriched endpoint (recommended):**

Create a new endpoint: `GET /api/v1/admin/customers/{customer_id}/orders` in the Admin Service that:
1. Queries orders for the specific customer
2. LEFT JOINs order_items and inventory
3. Returns orders with items including `image_url`

File: New route in `services/admin/main.py`

SQL would look like:
```sql
SELECT o.*, 
       oi.id as item_id, oi.product_name, oi.sku, oi.size, oi.color, 
       oi.quantity, oi.unit_price, oi.price,
       inv.image_url as variant_image_url
FROM orders o
LEFT JOIN order_items oi ON oi.order_id = o.id
LEFT JOIN inventory inv ON inv.id = oi.inventory_id
WHERE o.user_id = :customer_id
ORDER BY o.created_at DESC
LIMIT :limit
```

This is a single query that returns everything the frontend needs.

### Phase 3: Frontend Updates (Required for the feature)

File: `frontend_new/components/admin/customers/CustomerDetailModal.jsx`

1. **Update orders fetch** to use the corrected endpoint (with `user_id` filter)
2. **For each order item**, display:
   - Product image (`item.variant_image_url` or fallback to product primary image)
   - Product name (`item.product_name`)
   - Size (`item.size`)
   - Color (`item.color`)
   - Quantity (`item.quantity`)
   - Price (`item.price`)
3. **Add pagination or "Load More"** for orders beyond 5
4. **Fix `last_order_date` and `updated_at`** display (or remove if backend won't provide them)

### What We're NOT Building (YAGNI):

- **No dedicated customer detail page route** — the modal is sufficient for now. Converting to a page adds routing, layout, and navigation complexity without proven need.
- **No customer edit functionality** — not requested.
- **No order editing from customer detail** — admins can navigate to the orders page for that.
- **No real-time order updates** — polling/websockets are overkill for this use case.
- **No product image gallery per order** — showing the variant image per item is sufficient.

---

## 6. File Locations Summary

| File | Purpose |
|------|---------|
| `frontend_new/components/admin/customers/CustomerDetailModal.jsx` | Frontend modal component — needs order items and images display |
| `frontend_new/app/admin/customers/page.js` | Customer list page — triggers the modal |
| `frontend_new/lib/adminApi.js` | API client — `ordersApi.list` and `usersApi.get` |
| `services/admin/main.py` | Admin service — `list_all_orders` (line 1711), `get_order` (line 1788), `get_user` (line 4306) |
| `services/admin/schemas/admin.py` | `UserListItem` schema (line 181) — missing fields |
| `services/commerce/models/order.py` | `Order` and `OrderItem` models — `image_url` property on OrderItem |
| `services/commerce/models/inventory.py` | `Inventory` model — `image_url` field |
| `services/commerce/service/admin_customer_service.py` | `AdminCustomerService` — has `get_customer_orders()` method but is NOT wired to any route |
| `services/commerce/routes/orders.py` | Commerce orders routes — `get_my_orders` (line 182), `_enrich_order_response` (line 85) |
| `services/commerce/schemas/order.py` | `OrderItemResponse` schema — already has `image_url` field |

---

## 7. Implementation Priority

| Priority | Task | Complexity | Effort |
|----------|------|------------|--------|
| **P0** | Add `user_id` filter to admin orders endpoint | Simple | 10 min |
| **P0** | Fix `get_user` to return `updated_at` and `last_order_date` | Simple | 15 min |
| **P1** | Create `/api/v1/admin/customers/{id}/orders` endpoint with items + images | Moderate | 45 min |
| **P1** | Update CustomerDetailModal to display order items with images | Moderate | 60 min |
| **P2** | Add pagination / "Load More" for orders | Simple | 30 min |

**Total estimated effort:** ~2.5 hours for full implementation.
