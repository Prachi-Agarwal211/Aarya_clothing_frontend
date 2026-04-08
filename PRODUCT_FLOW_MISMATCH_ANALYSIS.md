# Product Flow Mismatch Analysis Report

**Date:** 2026-04-08
**Project:** Aarya Clothing E-commerce
**Scope:** Complete product data flow from Admin → Database → API → Frontend Display

---

## Executive Summary

The product flow has **two separate backend services** handling products:

1. **Admin Service** (`services/admin/main.py`) — handles product creation, editing, and admin listing at `/api/v1/admin/products/*`
2. **Commerce Service** (`services/commerce/`) — handles customer-facing product listing, detail, and search at `/api/v1/products/*`

The architecture is **intentionally dual-service**: admin writes to the database, and the commerce service reads from the same database to serve customers. This is a valid pattern, but there are **several critical mismatches** between how data flows through each service and how the frontend consumes it.

---

## 1. Complete Product Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ ADMIN SIDE (Product Creation)                                       │
├─────────────────────────────────────────────────────────────────────┤
│ 1. Admin UI: /admin/products/create/page.js                         │
│    - Sends: { name, slug, base_price, mrp, category_id, ... }       │
│    - API call: POST /api/v1/admin/products (→ Admin Service)        │
│                                                                      │
│ 2. Admin Service: services/admin/main.py:4606                        │
│    - Accepts: ProductCreate schema (expects base_price as float)    │
│    - Creates: products row + default inventory record               │
│    - Returns: { id, name, slug, message } (MINIMAL response)        │
│                                                                      │
│ 3. Admin uploads images: POST /api/v1/admin/products/{id}/images    │
│    - Uploads to R2, stores relative path in product_images table    │
│    - Returns: { id, image_url (full R2 URL), alt_text, ... }        │
│                                                                      │
│ 4. Admin creates variants: POST /api/v1/admin/products/{id}/variants│
│    - Creates inventory rows with sku, size, color, quantity         │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ DATABASE (PostgreSQL)                                               │
├─────────────────────────────────────────────────────────────────────┤
│ products table:                                                     │
│   id, name, slug, description, short_description,                    │
│   base_price, mrp, hsn_code, gst_rate, is_taxable,                   │
│   category_id (FK → collections.id), brand,                          │
│   is_active, is_featured, is_new_arrival,                            │
│   average_rating, review_count,                                      │
│   meta_title, meta_description, tags,                                │
│   created_at, updated_at                                             │
│                                                                      │
│ product_images table:                                               │
│   id, product_id, image_url (RELATIVE PATH), alt_text,               │
│   display_order, is_primary                                          │
│                                                                      │
│ inventory table:                                                    │
│   id, product_id, sku, size, color, color_hex,                       │
│   quantity, reserved_quantity, low_stock_threshold,                  │
│   variant_price, cost_price, is_active                               │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ COMMERCE SERVICE (Customer-Facing)                                   │
├─────────────────────────────────────────────────────────────────────┤
│ 1. Product listing: GET /api/v1/products/browse                     │
│    - Enriches via _enrich_product() in routes/products.py:107       │
│    - Constructs full R2 URLs from relative paths                    │
│    - Returns enriched dict with all fields                          │
│                                                                      │
│ 2. Product detail: GET /api/v1/products/{id} or /slug/{slug}        │
│    - Same _enrich_product() enrichment                              │
│    - Returns full product with images, inventory, collection        │
│                                                                      │
│ 3. Meilisearch: GET /api/v1/products/search                          │
│    - Returns pre-indexed docs (may have different field set)        │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ FRONTEND (Customer Display)                                         │
├─────────────────────────────────────────────────────────────────────┤
│ 1. Products listing: /app/products/ProductsClient.js                 │
│    - Fetches: GET /api/v1/products/browse                           │
│    - Expects: { products: [...], total, ... }                       │
│    - Consumes: product.name, product.price, product.image_url,      │
│               product.primary_image, product.in_stock, etc.         │
│                                                                      │
│ 2. Product detail: /app/products/[id]/page.js                        │
│    - Fetches: GET /api/v1/products/{id} or /slug/{slug}             │
│    - Expects: { id, name, price, mrp, images: [...], ... }          │
│                                                                      │
│ 3. Homepage: /app/page.js → NewArrivals component                    │
│    - Fetches: GET /api/v1/landing/all (→ Core Service)              │
│    - Products come from landing config, not direct product API      │
│                                                                      │
│ 4. ProductCard component: /components/common/ProductCard.jsx         │
│    - Supports both old and new field names (backward compat)        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Identified Mismatches

### MISMATCH #1: Admin Create Response Missing Critical Fields
**Severity:** HIGH
**Type:** API Response Incompleteness

| Aspect | Details |
|--------|---------|
| **Location (Admin Service)** | `services/admin/main.py`, lines 4660-4668 |
| **Location (Admin Frontend)** | `frontend_new/app/admin/products/create/page.js`, lines 167-176 |
| **Issue** | After creating a product, the admin service returns only `{ id, name, slug, message }`. The frontend immediately tries to upload images using `result.id`, which works. However, the admin create page sends `base_price` while the commerce service's ProductCreate schema expects `price` (see Mismatch #2). The admin service correctly maps `base_price` → DB column, but the returned minimal response means the admin UI has no way to verify the product was created correctly (no price, no inventory, no images returned). |
| **Code Evidence** | Admin service line 4660: `return { "id": product_id, "name": data.name, "slug": slug, "message": "Product created" }` |

**Impact:** Admin cannot verify product creation details without a page refresh or navigating to the product list.

---

### MISMATCH #2: Commerce Service Schema Uses `price`, Admin Uses `base_price`
**Severity:** MEDIUM
**Type:** Schema Field Name Difference

| Aspect | Details |
|--------|---------|
| **Commerce Schema** | `services/commerce/schemas/product.py`, line 19: `price: Decimal` |
| **Admin Schema** | `services/admin/schemas/admin.py`, line 306: `base_price: float` |
| **Database Column** | `base_price` (in `services/commerce/models/product.py`, line 20) |
| **Admin Frontend Sends** | `base_price` (line 156 of `create/page.js`) |
| **Issue** | The commerce service ProductCreate schema uses `price` as the field name, which maps to `base_price` in the DB via the service layer (`product_service.py` line 217: `data['base_price'] = data.pop('price', 0.0)`). The admin service uses `base_price` directly. This is **not a breaking issue** because the two services have separate schemas and don't cross-call each other for creation. However, it creates confusion and inconsistency. |

**Impact:** Confusing for developers. If someone tries to create a product via the commerce API using `base_price`, it will fail validation (commerce expects `price`).

---

### MISMATCH #3: Admin Edit Modal Sends `base_price`, Commerce Update Schema Doesn't Accept It
**Severity:** MEDIUM-HIGH
**Type:** Field Name Mismatch in Update Flow

| Aspect | Details |
|--------|---------|
| **Location** | `frontend_new/app/admin/products/page.js`, line 290 |
| **Issue** | The EditProductModal in the admin product list sends `base_price: parseFloat(form.price)` when calling `productsApi.update()`. However, `productsApi.update()` in `adminApi.js` (line 197) routes to `PATCH /api/v1/admin/products/{id}`, which uses the admin service's ProductUpdate schema that **does** accept `base_price`. So this works for the admin service. **BUT** if any code path routes through the commerce service's update endpoint (`PUT /api/v1/products/{id}`), it uses `ProductUpdate` from `commerce/schemas/product.py` which has `price: Optional[Decimal]`, not `base_price`. |
| **Code Evidence** | Admin edit modal line 290: `base_price: parseFloat(form.price)` |

**Impact:** Works currently because admin uses admin service. But if the routing ever changes, this would break silently.

---

### MISMATCH #4: Admin Product List Response Missing `in_stock` Field
**Severity:** HIGH
**Type:** Missing Field in API Response

| Aspect | Details |
|--------|---------|
| **Location (Admin Service)** | `services/admin/main.py`, lines 4576-4601 |
| **Location (Admin Frontend)** | `frontend_new/app/admin/products/page.js` (product listing) |
| **Issue** | The admin product list endpoint returns `total_stock` (int) but does **not** return `in_stock` (boolean). The commerce service `_enrich_product()` in `routes/products.py` line 161 returns `"in_stock": (product.total_stock or 0) > 0`. The frontend ProductCard component and ProductsClient rely on `in_stock` for the "Out of Stock" display and "Add to Cart" button disable logic. While the admin page uses `total_stock` directly (via `stockBadge`), any component that expects `in_stock` from the admin list will get `undefined`. |
| **Code Evidence** | Admin service response (lines 4580-4600) includes `total_stock` but NOT `in_stock`. Commerce service `_enrich_product()` (line 161) includes `"in_stock": (product.total_stock or 0) > 0`. |

**Impact:** Admin product list works (uses `total_stock` directly), but inconsistency between admin and commerce responses could cause issues if components are shared.

---

### MISMATCH #5: Meilisearch Index Missing Critical Fields
**Severity:** HIGH
**Type:** Missing Fields in Search Index

| Aspect | Details |
|--------|---------|
| **Location** | `services/commerce/search/meilisearch_client.py`, lines 196-218 (`sync_all_products`) |
| **Issue** | The Meilisearch sync function does NOT include: `collection_id`, `collection_slug`, `brand`, `hsn_code`, `gst_rate`, `is_taxable`, `meta_title`, `meta_description`. Most critically, it stores `image_url` as a raw string from the database (relative path), while the commerce service's `_enrich_product()` constructs full R2 URLs. When Meilisearch results are returned to the frontend (via `/api/v1/products/search`), the `image_url` field contains a **relative path, not a full URL**. |
| **Code Evidence** | `meilisearch_client.py` line 213: `"image_url": r[14] or ""` — `r[14]` is the raw DB value (relative path). Compare with `routes/products.py` line 53 `_r2_url()` which constructs full URLs. |

**Impact:** Products returned via Meilisearch search will have broken images because `image_url` is a relative path like `products/abc123.jpg` instead of `https://pub-7846c786f7154610b57735df47899fa0.r2.dev/products/abc123.jpg`. The frontend ProductCard expects full URLs.

---

### MISMATCH #6: Meilisearch `_format_product` vs `sync_all_products` Field Inconsistency
**Severity:** MEDIUM
**Type:** Internal Data Format Inconsistency

| Aspect | Details |
|--------|---------|
| **Location** | `services/commerce/search/meilisearch_client.py` |
| **Issue** | `sync_all_products()` (line 196) stores `image_url` as raw DB path. `_format_product()` (line 247) does `p.get("image_url", "") or p.get("primary_image", "")`. But when products are indexed via `index_product()` from the route handlers (e.g., `routes/products.py` line 533), they receive the already-enriched product dict which has full R2 URLs. So **newly indexed products** have full URLs, but **bulk-synced products** have relative paths. |

**Impact:** Inconsistent image URL formats in Meilisearch depending on how products were indexed.

---

### MISMATCH #7: Admin Product Detail Response Uses Raw DB `inventory` Format
**Severity:** MEDIUM
**Type:** Response Format Difference

| Aspect | Details |
|--------|---------|
| **Location (Admin Service)** | `services/admin/main.py`, line 5165: `"inventory": [dict(inv._mapping) for inv in inventory]` |
| **Location (Commerce Service)** | `services/commerce/routes/products.py`, lines 72-104: `_enrich_inventory()` returns structured dicts with role-based filtering |
| **Issue** | The admin service returns raw inventory rows with all DB columns (snake_case: `product_id`, `low_stock_threshold`, `reserved_quantity`, etc.). The commerce service returns enriched inventory with computed fields like `available_quantity`, `is_low_stock`, `is_out_of_stock`. The admin frontend variant modal expects fields like `variant.quantity` and `variant.low_stock_threshold` which work with raw DB rows, but the commerce service returns `quantity` only for admin users. The field names are consistent but the commerce service adds computed properties that the admin doesn't provide. |

**Impact:** Admin variant management works but doesn't benefit from computed fields. Not breaking, but inconsistent.

---

### MISMATCH #8: Admin Product Create Doesn't Handle Variants from Form
**Severity:** MEDIUM-HIGH
**Type:** Missing Functionality / Data Flow Gap

| Aspect | Details |
|--------|---------|
| **Location (Admin Service)** | `services/admin/main.py`, lines 4654-4660 |
| **Location (Admin Frontend)** | `frontend_new/app/admin/products/create/page.js`, lines 176-188 |
| **Issue** | The admin create page collects variants (size/color/quantity combos) and attempts to create them via `productsApi.createVariant()` AFTER the product is created. This is a two-step process: (1) create product, (2) create variants. The admin service's `admin_create_product` (line 4654) only creates a default inventory record (`One Size`, `Default`). When the frontend then calls `createVariant` for each variant, the admin service creates additional inventory rows. However, the default "One Size/Default" inventory record remains, creating **duplicate inventory entries** — one default + one per variant. |
| **Code Evidence** | Admin service line 4654: creates default inventory with `size='One Size', color='Default'`. Frontend line 176-188: creates variant inventory for each size/color combo. |

**Impact:** Products with variants will have an extra "One Size/Default" inventory row that shouldn't exist. This causes the frontend to show "One Size" as an option alongside the actual variants, confusing customers.

---

### MISMATCH #9: Commerce Service ProductCreate Has `variants` but Admin Service Doesn't Support It
**Severity:** MEDIUM
**Type:** Feature Parity Gap

| Aspect | Details |
|--------|---------|
| **Location (Commerce)** | `services/commerce/schemas/product.py`, lines 31-36: `ProductCreate` has `variants: Optional[List[VariantCreate]]` |
| **Location (Commerce Service)** | `services/commerce/service/product_service.py`, lines 244-268: handles variant creation |
| **Location (Admin Service)** | `services/admin/main.py`, lines 4606-4668: `admin_create_product` does NOT accept `variants` |
| **Issue** | The commerce service supports creating a product with variants in a single API call (via `variants` field in ProductCreate). The admin service does not support this — it only creates a default inventory record. The admin frontend works around this by creating variants in separate API calls after product creation. |

**Impact:** Two-step process is less efficient and creates the orphaned default inventory issue (Mismatch #8).

---

### MISMATCH #10: Frontend Product Detail Page Expects `product.product` Wrapper
**Severity:** LOW-MEDIUM
**Type:** Response Parsing Ambiguity

| Aspect | Details |
|--------|---------|
| **Location** | `frontend_new/app/products/[id]/page.js`, line 105 |
| **Code** | `const product = productData.product || productData;` |
| **Issue** | The frontend handles both `{ product: {...} }` and `{...}` response shapes. The commerce service returns the product object directly (no wrapper). This defensive coding is fine, but it suggests at some point the API returned a wrapped response. If a future change wraps the response, it would work. Currently it's unnecessary but harmless. |

**Impact:** None currently. Defensive coding that doesn't hurt.

---

### MISMATCH #11: Admin Edit Modal Sends Data Commerce Service Doesn't Recognize
**Severity:** MEDIUM
**Type:** Field Name Mismatch

| Aspect | Details |
|--------|---------|
| **Location** | `frontend_new/app/admin/products/page.js`, lines 288-300 |
| **Issue** | The EditProductModal sends: `{ name, base_price, mrp, short_description, description, category_id, brand, is_active, is_featured, is_new_arrival }`. This goes to `PATCH /api/v1/admin/products/{id}` (admin service), which accepts these fields. **However**, the admin service's update endpoint (line 4677) only updates a limited set of fields: `name, slug, description, short_description, is_active, is_featured, is_new_arrival, base_price, mrp, category_id, meta_title, meta_description`. It does NOT update `brand` even though the frontend sends it. |
| **Code Evidence** | Admin service `admin_update_product` (line 4677) — `update_map` dict on lines 4687-4695 does NOT include `brand`. |

**Impact:** Changes to the `brand` field in the admin edit modal are silently ignored. The brand will never be updated.

---

### MISMATCH #12: Commerce `_enrich_product` Returns `category` and `collection_name` But Meilisearch Doesn't
**Severity:** LOW-MEDIUM
**Type:** Field Name Inconsistency Between APIs

| Aspect | Details |
|--------|---------|
| **Location (Commerce enrich)** | `services/commerce/routes/products.py`, lines 144-146 |
| **Location (Meilisearch)** | `services/commerce/search/meilisearch_client.py`, line 267 |
| **Issue** | The commerce `_enrich_product()` returns both `category` and `collection_name` (and `category_name`). The Meilisearch index only stores `category_name`. The Meilisearch search results return `category_name` but not `category` or `collection_name`. The frontend ProductCard uses `product.collection_name || product.category` — if products come from Meilisearch search, `collection_name` and `category` are undefined, and only `category_name` exists. |
| **Code Evidence** | ProductCard.jsx line 34: `const category = product.collection_name || product.category || '';` — this will be empty string for Meilisearch results. |

**Impact:** Products displayed via Meilisearch search results will show empty category/collection name on product cards.

---

### MISMATCH #13: `average_rating` vs `rating` Field Name
**Severity:** LOW
**Type:** Field Alias Inconsistency

| Aspect | Details |
|--------|---------|
| **Location (Commerce enrich)** | `services/commerce/routes/products.py`, line 159 |
| **Location (Admin list)** | `services/admin/main.py`, lines 4576-4601 |
| **Issue** | The commerce service returns both `"rating": float(product.average_rating)` and `"average_rating"` (from the model). The admin service product list does NOT return `rating` or `average_rating` at all. The frontend product detail page uses `product.rating` (line 389), which works for commerce service responses. The admin product list has no rating info. |

**Impact:** Admin product list doesn't show ratings. Frontend product detail works. Low severity since admin doesn't need ratings in the list view.

---

### MISMATCH #14: Image URL Construction Inconsistency Between Services
**Severity:** MEDIUM
**Type:** URL Construction Approach Difference

| Aspect | Details |
|--------|---------|
| **Commerce Service** | `services/commerce/routes/products.py`, line 53: `_r2_url()` — constructs URL using `settings.R2_PUBLIC_URL` |
| **Admin Service** | `services/admin/main.py`, line 3585: `_get_r2_public_url()` — same approach but separate implementation |
| **Issue** | Both services construct R2 URLs independently using their own `settings.R2_PUBLIC_URL`. If the R2 public URL is configured differently between the two services (different environment variables), image URLs will differ. Both services also handle the case where the image URL already starts with `http://` differently — commerce service (line 54) doesn't check, admin service (line 3588) does. |
| **Code Evidence** | Commerce `_r2_url` (routes/products.py:53-60) always prepends R2 base. Admin `_get_r2_public_url` (main.py:3585-3592) checks if URL already starts with `http://`. |

**Impact:** If an image URL is already a full URL, the commerce service will double-prefix it (e.g., `https://r2.dev/https://r2.dev/path`), while the admin service handles it correctly. This could cause broken images for any images that were stored as full URLs.

---

### MISMATCH #15: Frontend `ProductsClient` Parses Response as `data.items` or `data.products`
**Severity:** LOW
**Type:** Response Shape Ambiguity

| Aspect | Details |
|--------|---------|
| **Location** | `frontend_new/app/products/ProductsClient.js`, line 143 |
| **Code** | `const items = Array.isArray(data) ? data : (data?.items || data?.products || []);` |
| **Issue** | The `/api/v1/products/browse` endpoint returns `{ products: [...], total, page, total_pages, sort_by, filters }` (see `routes/products.py` line 422). The frontend handles this correctly via `data?.products`. However, the commerce service's main list endpoint (`GET /api/v1/products`) returns `{ items: [...], total, skip, limit, has_more }` (line 297). The frontend handles both shapes, but this defensive parsing suggests uncertainty about the API contract. |

**Impact:** Currently works. The ambiguity is handled gracefully.

---

## 3. Summary of All Issues

| # | Issue | Severity | Type |
|---|-------|----------|------|
| 1 | Admin create response missing critical fields | HIGH | API Response Incompleteness |
| 2 | Commerce schema uses `price`, Admin uses `base_price` | MEDIUM | Schema Field Name Difference |
| 3 | Admin edit sends `base_price` — commerce schema doesn't accept it | MEDIUM-HIGH | Field Name Mismatch |
| 4 | Admin product list missing `in_stock` field | HIGH | Missing Field |
| 5 | Meilisearch index stores relative image paths, not full URLs | HIGH | Broken Image URLs in Search |
| 6 | Meilisearch `_format_product` vs `sync_all_products` inconsistency | MEDIUM | Internal Format Inconsistency |
| 7 | Admin inventory response format differs from commerce | MEDIUM | Response Format Difference |
| 8 | Admin create leaves orphaned "One Size/Default" inventory when variants exist | MEDIUM-HIGH | Duplicate Inventory Entries |
| 9 | Commerce supports variant-in-product-create, Admin doesn't | MEDIUM | Feature Parity Gap |
| 10 | Frontend handles both wrapped and unwrapped product responses | LOW-MEDIUM | Response Parsing Ambiguity |
| 11 | Admin update silently ignores `brand` field | MEDIUM | Missing Field in Update |
| 12 | Meilisearch returns `category_name`, frontend expects `collection_name`/`category` | LOW-MEDIUM | Field Name Inconsistency |
| 13 | `average_rating` vs `rating` — admin list missing both | LOW | Field Alias Inconsistency |
| 14 | Image URL construction differs between services | MEDIUM | URL Construction Difference |
| 15 | Frontend parses multiple response shapes defensively | LOW | Response Shape Ambiguity |

---

## 4. Root Cause Analysis

The fundamental issues stem from:

### 4.1. Dual Service Architecture Without Shared Contracts
The admin service and commerce service share the same database but have **separate implementations** of product logic. They don't share:
- Pydantic schemas (each has its own `ProductCreate`, `ProductUpdate`)
- Response enrichment functions (each has its own URL construction and field mapping)
- Inventory handling logic

### 4.2. No API Contract Testing
There are no integration tests that verify:
- Admin create → Commerce read produces consistent data
- Meilisearch indexed data matches commerce-enriched data
- Field names are consistent across all API responses

### 4.3. Incremental Feature Addition
Fields like `brand`, `hsn_code`, `gst_rate` were added to the commerce model but not consistently propagated through the admin service endpoints.

---

## 5. Recommendations

### Priority 1: Critical (Fix Immediately)

**5.1. Fix Meilisearch Image URLs (Mismatch #5, #6)**
- In `meilisearch_client.py`, `sync_all_products()` should construct full R2 URLs instead of storing relative paths
- Add R2 URL construction: `f"{settings.R2_PUBLIC_URL}/{r[14].lstrip('/')}" if r[14] else ""`
- Ensure `_format_product()` always receives and outputs full URLs

**5.2. Fix Orphaned Default Inventory (Mismatch #8)**
- In `admin/main.py`, `admin_create_product`: when the frontend creates variants, skip creating the default "One Size/Default" inventory record
- Or: delete the default record when the first variant is created
- Alternative: check if variants are being created and conditionally skip the default

**5.3. Add `in_stock` to Admin Product List (Mismatch #4)**
- In `admin/main.py` line 4600, add: `"in_stock": int(r[16]) > 0`

### Priority 2: Important (Fix Soon)

**5.4. Add `brand` to Admin Update (Mismatch #11)**
- In `admin/main.py`, `admin_update_product`: add `brand` to the `update_map` dict
- Add line: `"brand": "brand",` to the map on line 4687

**5.5. Standardize Field Names Across Services (Mismatch #2, #3)**
- Choose ONE canonical field name: `base_price` (matches DB column)
- Update commerce service `ProductBase` schema to use `base_price` instead of `price` (with alias support for backward compat)
- Or: keep `price` in commerce schema but document that it maps to `base_price`

**5.6. Add `category`/`collection_name` to Meilisearch (Mismatch #12)**
- In `meilisearch_client.py`, `_format_product()`: add `"collection_name": p.get("category_name", "")` and `"category": p.get("category_name", "")`
- In `sync_all_products()`: add `collection_name` and `category` to the indexed document

**5.7. Fix Image URL Double-Prefixing (Mismatch #14)**
- In `commerce/routes/products.py`, `_r2_url()`: add check for already-full URLs
- Add: `if path.startswith("http://") or path.startswith("https://"): return path`

### Priority 3: Maintenance (Fix When Convenient)

**5.8. Add API Contract Tests**
- Create integration tests that verify: Admin Create → Commerce Read produces consistent data
- Test that all fields expected by the frontend are present in API responses
- Test Meilisearch indexed data matches direct DB query data

**5.9. Consolidate Response Enrichment**
- Move `_enrich_product()` and `_r2_url()` to a shared module that both services import
- This eliminates duplication and ensures consistent responses

**5.10. Add `rating`/`average_rating` to Admin Product List**
- In `admin/main.py` product list query, add rating fields to the SELECT
- Or: explicitly exclude ratings from admin list if not needed

---

## 6. What This Analysis Does NOT Cover

- Authentication/authorization flows (assumed working)
- Payment processing flow
- Order creation and management
- Cart functionality
- User profile management
- Docker/networking configuration
- Deployment and CI/CD pipeline
- Database migration state
- Performance benchmarks

---

## 7. Files Referenced

### Backend - Admin Service
- `services/admin/main.py` — Main admin service with all product routes
- `services/admin/schemas/admin.py` — Admin Pydantic schemas

### Backend - Commerce Service
- `services/commerce/models/product.py` — Product SQLAlchemy model
- `services/commerce/models/inventory.py` — Inventory SQLAlchemy model
- `services/commerce/schemas/product.py` — Commerce Pydantic schemas
- `services/commerce/schemas/inventory.py` — Inventory Pydantic schemas
- `services/commerce/routes/products.py` — Commerce product API routes
- `services/commerce/service/product_service.py` — Product service layer
- `services/commerce/search/meilisearch_client.py` — Meilisearch integration
- `services/commerce/service/r2_service.py` — R2 image storage

### Frontend
- `frontend_new/lib/customerApi.js` — Customer-facing API client
- `frontend_new/lib/adminApi.js` — Admin API client
- `frontend_new/lib/baseApi.js` — Base API client with URL helpers
- `frontend_new/app/products/page.js` — Products listing page
- `frontend_new/app/products/ProductsClient.js` — Products client component
- `frontend_new/app/products/[id]/page.js` — Product detail page
- `frontend_new/app/admin/products/page.js` — Admin product list
- `frontend_new/app/admin/products/create/page.js` — Admin product creation
- `frontend_new/components/common/ProductCard.jsx` — Product card component
- `frontend_new/components/landing/NewArrivals.jsx` — New arrivals section

---

*End of Report*
