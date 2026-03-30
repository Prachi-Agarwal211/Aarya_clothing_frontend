# Aarya Clothing — Full Codebase Audit Report
**Date:** 2026 | **Auditor:** Cascade AI  
**Scope:** Frontend (Next.js), Backend (FastAPI × 4 services), AI, Payments, Nginx, Docker, Database

---

## Executive Summary

The codebase has had several critical bugs fixed in prior sessions (Razorpay flow, cart concurrency, staff management, SSE). However **deep-code bugs remain** that silently break core features: the entire AI subsystem, Cashfree payment overcharging, a race condition in order creation, and embedding generation. These are documented below with exact file + line references and the minimal fix required.

Severity scale: **P0 = service broken / data loss** | **P1 = significant failure** | **P2 = quality / minor breakage** | **P3 = cleanup / polish**

---

## P0 — Critical Bugs (Break Core Functionality)

---

### P0-1 · AI Chat Completely Broken When GROQ_API_KEY Is Set

**Files:** `services/admin/service/ai_service.py:275-298`, `services/admin/core/ai_key_rotation.py:123`

**Root cause:** `_get_api_key()` calls the multi-provider rotation service first. If `GROQ_API_KEY` is set, the rotation returns a Groq key (`gsk_...`). Immediately after, **both** `customer_chat()` and `admin_chat()` call:

```python
api_key = _get_api_key()       # returns Groq key if Groq is configured
genai.configure(api_key=api_key)  # passes Groq key to Google's SDK → auth error
model = genai.GenerativeModel(...)
```

Google's `genai` SDK rejects any non-Google key. The exception message (`"API key not valid"`) does **not** match the `"quota" / "rate" / "429"` check, so Groq fallback is never tried. Result: every chat request silently returns the generic `"I'm having a little trouble right now 🌸"` error.

**Compounding factor:** `ai_key_rotation.py:123` defaults Gemini to DISABLED:
```python
if gemini_key and os.environ.get("AI_GEMINI_ENABLED", "false").lower() == "true":
```
So Gemini is never added to the rotation pool unless `AI_GEMINI_ENABLED=true` is explicitly set.

**Fix (2 changes):**

1. In `ai_service.py`, rename the generic `_get_api_key()` to `_get_gemini_key()` that only returns Gemini keys:
```python
def _get_gemini_key() -> str:
    keys = _get_api_keys()  # reads GEMINI_API_KEY env vars only
    if not keys:
        raise ValueError("No GEMINI_API_KEY configured.")
    global _KEY_ROTATION_INDEX
    key = keys[_KEY_ROTATION_INDEX % len(keys)]
    _KEY_ROTATION_INDEX = (_KEY_ROTATION_INDEX + 1) % len(keys)
    return key
```

2. Replace all `_get_api_key()` calls inside `customer_chat()`, `admin_chat()`, and `_generate_embedding()` with `_get_gemini_key()`.

3. Keep the rotation service for the Groq fallback path (`_customer_chat_groq_fallback`) which uses OpenAI-compat API correctly.

---

### P0-2 · Admin Service Fails to Start (Deprecated `gemini-pro` Model)

**File:** `services/admin/main.py:156`

```python
model = genai.GenerativeModel('gemini-pro')   # ← deprecated April 2024
model.generate_content("test")
```

`gemini-pro` is no longer available; calls return 404. The startup validation either crashes the lifespan or succeeds silently (if the exception is swallowed) while leaving a misleading "validated" log. Either way, AI is non-functional.

**Fix:** Replace with current model:
```python
model = genai.GenerativeModel('gemini-2.0-flash-lite')
```

---

### P0-3 · Cashfree Payment 100× Overcharge

**File:** `frontend_new/app/checkout/payment/page.js:314`

```python
orderData = await paymentApi.createCashfreeOrder({
    amount: Math.round((cart.total || 0) * 100),  # ← WRONG: Cashfree takes RUPEES
```

Razorpay takes **paise** (₹ × 100). Cashfree v3 API takes **rupees**. For a ₹500 cart, this sends `50000` to Cashfree, creating a ₹50,000 order. This is a financial P0.

**Fix:**
```js
amount: cart.total || 0,   // Cashfree: rupees, not paise
```

---

### P0-4 · `_get_api_key()` Leaks DB Connection on Every AI Message

**File:** `services/admin/service/ai_service.py:278-287`

```python
with next(get_db_context()) as db:
    provider = get_available_provider(db)
```

`next(generator)` pulls one value from the generator but never closes it. The `finally: db.close()` inside `get_db_context()` is **never executed**. Every AI message leaks one PostgreSQL connection. Under moderate load this exhausts the connection pool.

**Fix:** Use a proper context manager:
```python
from contextlib import closing
db_gen = get_db_context()
db = next(db_gen)
try:
    provider = get_available_provider(db)
    if provider:
        return provider.api_key
finally:
    try:
        next(db_gen)  # triggers finally in generator
    except StopIteration:
        pass
```
Or simpler: extract the Gemini key directly from `os.environ` without a DB call (since the rotation service is only needed for OpenAI-compat providers).

---

### P0-5 · Duplicate Order Creation Race Condition

**File:** `frontend_new/app/checkout/confirm/page.js` (around `isCreating` guard)

```js
const [isCreating, setIsCreating] = useState(false);
// ...
if (isCreating) return;     // ← DOES NOT WORK — React setState is async
setIsCreating(true);
// POST /api/v1/orders
```

If the confirm page is quickly re-rendered (React StrictMode, double navigation, or user double-tapping), `isCreating` from the previous render is still `false` when the guard is checked. Two simultaneous order creation requests fire.

**Fix:** Use a `ref` for the mutex:
```js
const isCreatingRef = useRef(false);
// ...
if (isCreatingRef.current) return;
isCreatingRef.current = true;
try {
    // create order
} finally {
    isCreatingRef.current = false;
}
```

---

### P0-6 · Embedding Generation Always Fails When Gemini Is Disabled

**File:** `services/admin/service/ai_service.py:690-692, 1482-1484, 2191`

`generate_product_embeddings_batch()` and the `semantic_search_products` tool all call:
```python
api_key = _get_api_key()          # returns Groq key
_generate_embedding(text, api_key)  # calls genai.embed_content() → Google API only
```

`genai.embed_content()` requires a **Google** API key. With a Groq key, all embedding generation fails silently (`vec = None`). Semantic search returns the `"Embedding generation failed"` error for every query.

**Fix:** Same as P0-1 — use `_get_gemini_key()` specifically for embedding calls, not the general rotation.

---

## P1 — High Severity (Significant Failures)

---

### P1-1 · `add_to_cart` AI Tool Bypasses Inventory Reservation

**File:** `services/admin/service/ai_service.py:904-913`

The customer-facing AI `add_to_cart` tool does a raw SQL INSERT:
```python
db.execute(text("""
    INSERT INTO cart_items (cart_id, product_id, quantity, price, size, color)
    VALUES (:cid, :pid, :qty, :price, :size, :color)
    ON CONFLICT ... DO UPDATE SET quantity = cart_items.quantity + :qty
"""), ...)
```

This bypasses the `CartConcurrencyManager` entirely:
- No `inventory.reserved_quantity` increment
- No `StockReservation` row created
- No race-condition protection
- No stock availability check

Customer can AI-add items to cart that are out of stock, and the cart will show them — until checkout validation fails.

**Fix:** Use the existing cart service endpoint instead of raw SQL. Call `CartService(db).add_item(user_id, product_id, quantity, size, color)` or make an internal HTTP call to `POST /api/v1/cart/items`.

---

### P1-2 · `apply_coupon` AI Tool Returns Wrong `description` Field

**File:** `services/admin/service/ai_service.py:928-974`

```python
coupon = db.execute(text("""
    SELECT code, description, discount_type, discount_value, minimum_order,
           description, valid_until        -- index: 0   1            2              3                4
    FROM promotions ...
"""), ...)

min_order = float(coupon[4] or 0)   # correct — minimum_order
...
return json.dumps({
    "description": coupon[4],    # ← BUG: returns minimum_order (float), not description
```

`coupon[4]` is `minimum_order` (a number). The description text is at index `1`. The AI then reads the float as the coupon description.

**Fix:**
```python
"description": coupon[1],   # index 1 = description column
```

---

### P1-3 · `set_real_ip_from 0.0.0.0/0` — IP Spoofing Vulnerability

**File:** `docker/nginx/nginx.conf:152`

```nginx
set_real_ip_from 0.0.0.0/0;   # trusts ALL IPs for X-Forwarded-For
```

This allows any client to send `X-Forwarded-For: 1.2.3.4` and appear as any IP. Rate limiting is then trivially bypassed (change the header, infinite requests). In production behind a known load balancer / CDN, only that IP range should be trusted.

**Fix:** Replace with your actual CDN/load-balancer CIDR (e.g., Cloudflare ranges, or just the Docker subnet):
```nginx
set_real_ip_from 172.16.0.0/12;   # Docker internal
set_real_ip_from 10.0.0.0/8;
# Add Cloudflare CIDRs if using CF
```

---

### P1-4 · AI Session Query Has Broken SQL Binding

**File:** `services/admin/main.py:2443`

```python
where = "WHERE s.created_at >= NOW() - INTERVAL ':days days'"
params: dict = {"days": days}
```

SQLAlchemy will substitute `:days` with the integer value inside the single-quoted string literal. PostgreSQL receives `INTERVAL '30 days'` which is valid, **but** the binding is fragile — SQLAlchemy may quote the integer as a string, producing `INTERVAL ''30' days'` (syntax error on some drivers). Should use an f-string:

**Fix:**
```python
where = f"WHERE s.created_at >= NOW() - INTERVAL '{int(days)} days'"
# Remove 'days' from params dict
```

---

### P1-5 · Admin Dashboard AI Tool `get_revenue_summary` — Missing JOIN Path

**File:** `services/admin/service/ai_service.py:1380-1390`

```sql
FROM order_items oi
JOIN inventory i ON i.id = oi.inventory_id   -- requires order_items.inventory_id column
JOIN products p ON p.id = i.product_id
```

The `inventory_id` FK was added to `order_items` in a prior session migration, but if this migration wasn't applied on the running database, this JOIN silently returns 0 results (or errors). The route has no fallback.

**Action:** Verify `order_items.inventory_id` exists in production DB. If not, add the migration or rewrite the JOIN:
```sql
FROM order_items oi
JOIN products p ON p.id = oi.product_id  -- direct FK always exists
```

---

### P1-6 · AI Key Rotation `_rotation_instance` Uses Stale DB Session

**File:** `services/admin/core/ai_key_rotation.py:295-309`

```python
_rotation_instance: Optional[AIKeyRotation] = None

def get_rotation(db: Session) -> AIKeyRotation:
    global _rotation_instance
    if _rotation_instance is None:
        _rotation_instance = AIKeyRotation(db)   # stores the db reference
    return _rotation_instance
```

`AIKeyRotation.__init__` stores `self.db = db`. After the first request, the instance is reused but `db` is a closed/expired session from a previous request. Any DB access inside rotation (Redis fallback path) will fail.

**Fix:** The `db` reference should not be stored on the instance. `AIKeyRotation` only uses Redis for rate limiting — remove `self.db` and the `db` parameter entirely.

---

### P1-7 · Order Confirmation Page Shows ₹0 Total

**File:** `frontend_new/app/checkout/confirm/page.js`

The `OrderResponse` schema returns `total_amount`, but the confirm page likely renders `order.total` which is `undefined` → shows ₹0. Verify the exact field name used in JSX and align with `order.total_amount`.

---

### P1-8 · Email Order Notifications Silently Disabled

**File:** `services/commerce/service/order_service.py:23-28`

```python
try:
    from core.email_service import email_service
    EMAIL_SERVICE_AVAILABLE = True
except ImportError:
    EMAIL_SERVICE_AVAILABLE = False
    logger.warning("Email service not available...")
```

If the email service import fails for any reason (missing env vars, misconfigured SMTP), `EMAIL_SERVICE_AVAILABLE = False` is set and order confirmation emails are silently skipped for all orders. No error is surfaced to the admin.

**Fix:** Add a startup health check that verifies email connectivity and alerts loudly (not just a warning) if SMTP is misconfigured.

---

### P1-9 · FastAPI `/docs` and `/redoc` Exposed in Production

**Files:** All 4 FastAPI services

By default FastAPI enables Swagger UI at `/docs` and ReDoc at `/redoc`. These expose full API schemas, internal endpoint paths, and request/response formats in production.

**Fix:** Disable in production:
```python
app = FastAPI(
    docs_url=None if settings.ENVIRONMENT == "production" else "/docs",
    redoc_url=None if settings.ENVIRONMENT == "production" else "/redoc",
)
```

---

### P1-10 · Cashfree SDK Fallback Uses Wrong Checkout URL

**File:** `frontend_new/app/checkout/payment/page.js:365`

```js
const cashfreeUrl = `https://checkout.cashfree.com/v2?session_id=${orderData.session_id}`;
```

Cashfree v3 does not use `checkout.cashfree.com/v2`. The correct hosted checkout for v3 is accessed through the SDK, not a direct URL. This fallback URL will fail for all users who hit it (SDK load error, ad-blocker, etc.).

**Fix:** Remove the SDK fallback redirect. Show an error message instead and suggest using Razorpay.

---

## P2 — Medium Severity (Quality / Minor Breakage)

---

### P2-1 · SSE Streaming Is Fake (Full Latency Before First Character)

**File:** `services/admin/main.py:2379-2399`

```python
async def event_generator():
    result = await loop.run_in_executor(None, lambda: customer_chat(...))  # full response first
    reply = result.get("reply", "")
    for i in range(0, len(reply), CHUNK_SIZE):
        chunk = reply[i:i + CHUNK_SIZE]
        yield f"data: {json.dumps({'chunk': chunk})}\n\n"
        await asyncio.sleep(0.008)
```

The full Gemini response is computed **before** any streaming begins. The user sees a spinner for the entire LLM latency (1-3 seconds), then the text types out 3 chars at a time. This is not true streaming.

**Improvement:** Use Gemini's native streaming API (`chat.send_message(..., stream=True)`) and yield each `response.text` chunk as it arrives. This requires the Gemini Python SDK's streaming support and restructuring the tool-call loop, but produces much better UX.

---

### P2-2 · Customer Chat Fetches Purchase History on Every Message

**File:** `services/admin/service/ai_service.py:1857-1876`

```python
history_data = json.loads(_execute_customer_tool(db, "get_customer_purchase_history", ...))
```

This DB query runs for **every single message** in any session, even the 10th message in a conversation where the history is already injected. This adds a DB round-trip per message.

**Fix:** Cache the purchase history in the session metadata or only inject it on the first message (`len(history) == 0`).

---

### P2-3 · `unused import` in `payment/page.js`

**File:** `frontend_new/app/checkout/payment/page.js:11`

```js
import { initializeCashfree, loadCashfreeSDK } from '@/lib/cashfree';
```

`loadCashfreeSDK` is never called directly (only through `initializeCashfree`). Minor cleanup.

---

### P2-4 · `unused import` in `ai/page.js`

**File:** `frontend_new/app/ai/page.js`

```js
import { aiApi } from '@/lib/adminApi';
```

The AI page uses raw `fetch()` to call `/api/v1/ai/customer/chat/stream`. `aiApi` is never called. The import can be removed.

---

### P2-5 · Service Worker Unregistered on Every Page Load

**File:** `frontend_new/app/layout.js:148-174`

```js
navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for(let registration of registrations) {
        registration.unregister();  // unregisters ALL SWs on every page load
    }
})
```

This runs on **every page load** in production. Every user unregisters the service worker, then re-registers it, then the new SW activates. This defeats all PWA caching benefits and causes unnecessary network requests.

**Fix:** Only unregister specific old cache names, or use a versioned cache bust mechanism. If you want no service worker at all, remove both the unregister and register logic entirely.

---

### P2-6 · `products.tags` Has No Full-Text Search Index

**File:** `services/admin/service/ai_service.py:1134-1135`

```python
conditions.append("(p.name ILIKE :style OR p.description ILIKE :style OR p.tags ILIKE :style)")
```

Three `ILIKE` scans on large text columns on every AI product recommendation query. With 1000+ products, this becomes slow.

**Fix:** Add PostgreSQL GIN full-text index:
```sql
CREATE INDEX idx_products_search ON products USING gin(
    to_tsvector('english', coalesce(name,'') || ' ' || coalesce(description,'') || ' ' || coalesce(tags,''))
);
```

---

### P2-7 · No pgvector HNSW Index for Semantic Search

**File:** Database schema

```sql
-- Current: IVFFlat or no index → O(n) exact scan
-- 1000+ products → ~30ms per search, 10000+ → ~300ms
```

**Fix:**
```sql
CREATE INDEX idx_products_embedding ON products
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

---

### P2-8 · Admin AI Dashboard Tools Blocked by Unseeded Permissions

**File:** `services/admin/routes/ai_dashboard_staff.py:91`

```python
if not has_permission(db, user["sub"], "ai_dashboard", "view"):
    raise HTTPException(status_code=403, detail="Insufficient permissions")
```

The `permission_presets` table was created in a prior migration, but no default rows were seeded for `"ai_dashboard" → "view"` permission. Super admins always receive `403 Forbidden` from these endpoints.

**Fix:** Either seed default permissions on startup, or bypass the `has_permission()` check for `super_admin` role (which already implies all permissions):
```python
if user.get("role") != "super_admin" and not has_permission(...):
    raise HTTPException(403, ...)
```

---

### P2-9 · Duplicate `PaymentService` Import in `payment/main.py`

**File:** `services/payment/main.py:29, 44`

```python
from service.payment_service import PaymentService   # line 29
from service.payment_service import PaymentService   # line 44 (duplicate)
```

---

### P2-10 · `dns-prefetch` Points to Non-Existent `.com` Domain

**File:** `frontend_new/app/layout.js:61`

```html
<link rel="dns-prefetch" href="https://api.aaryaclothing.com" />
```

The actual domain is `aaryaclothing.in`. If `aaryaclothing.com` is not registered, this DNS prefetch either wastes time or resolves to a wrong server.

**Fix:**
```html
<link rel="dns-prefetch" href="https://aaryaclothing.in" />
```

---

### P2-11 · Admin AI Chat Has No Streaming Endpoint

**File:** `services/admin/main.py:2408`

`POST /api/v1/ai/admin/chat` returns full JSON synchronously. Admin users wait 2-5 seconds with no feedback for complex queries (tool calls + follow-up). Only customer chat has SSE.

**Fix:** Add `/api/v1/ai/admin/chat/stream` with the same pattern as the customer stream endpoint.

---

### P2-12 · Cart Redis TTL vs. Stock Reservation TTL Mismatch

**Architecture**

- Cart in Redis: 7-day TTL
- `StockReservation`: 15-minute expiry

A user adds an item to cart, doesn't checkout for 20 minutes. The `StockReservation` expires but the cart item remains. When they add the same item again, a new reservation is attempted, but `reserved_quantity` in the DB may have been decremented already (if the expiry job ran), causing a double reservation or allowing over-reservation.

**Fix:** Ensure the reservation expiry job also adjusts `reserved_quantity` in inventory when it clears expired reservations.

---

### P2-13 · `get_db_context()` Called Inside Synchronous `_get_api_key()`

**File:** `services/admin/service/ai_service.py:278-287`

`get_db_context()` returns a synchronous generator. Calling it inside a sync function and wrapping it with `with next(...)` is an anti-pattern that's hard to reason about (see P0-4). Additionally, opening a new DB session inside every call to a utility function adds overhead for a simple Redis-backed operation (the rotation service only needs Redis, not Postgres).

**Fix:** Pass `db: Session` explicitly into functions that need it instead of creating sessions internally, OR separate the embedding and key-rotation logic so `_get_api_key()` only reads environment variables.

---

## P3 — Low Severity (Cleanup / Polish)

---

### P3-1 · Dead Code: `setCookie` / `removeCookie` in `baseApi.js`

**File:** `frontend_new/lib/baseApi.js:18-37`

Auth tokens are HttpOnly cookies set by the backend. The client-side `setCookie()` and `removeCookie()` functions can never touch HttpOnly cookies and serve no purpose.

---

### P3-2 · `getStoredTokens`, `setStoredTokens`, `getAccessToken` Are Stubs

**File:** `frontend_new/lib/baseApi.js:39-86`

These functions all return `null` or do nothing. They're vestigial from a prior token-in-localStorage approach. Safe to remove or at minimum annotate clearly.

---

### P3-3 · `baseApi.js` Hardcoded Dev-Port Detection

**File:** `frontend_new/lib/baseApi.js:370-375`

```js
if (origin.includes(':6004')) {
    return 'http://localhost:6005';
}
```

This port detection only works in the specific local-Docker dev setup. In production `NEXT_PUBLIC_API_URL` should be authoritative. The port fallback will never match in production, so it's harmless but confusing.

---

### P3-4 · `cashfree.js` Has Unused Exports

**File:** `frontend_new/lib/cashfree.js`

`resetCashfreeLoader()` and `isCashfreeLoaded()` are exported but never imported anywhere in the codebase.

---

### P3-5 · `/favicon.ico` Is a 302 Redirect to `/logo.png`

**File:** `docker/nginx/nginx.conf:207-210`

```nginx
location = /favicon.ico {
    return 302 /logo.png;
}
```

This causes two HTTP requests for every page load (browsers always fetch `/favicon.ico`). The logo is a PNG, not an ICO. Serve the logo directly as the favicon or add a proper `.ico` file.

---

### P3-6 · Missing `robots.txt` and `sitemap.xml`

No `robots.txt` or `sitemap.xml` are generated. Search engines will crawl checkout, payment, and admin pages unless instructed not to.

**Fix:** Add `/public/robots.txt`:
```
User-agent: *
Disallow: /checkout/
Disallow: /admin/
Disallow: /profile/
Allow: /
Sitemap: https://aaryaclothing.in/sitemap.xml
```
And implement a `/sitemap.xml` route in Next.js using the `sitemap()` API route.

---

### P3-7 · `SilkBackground` WebGL Context Leak Risk

**File:** `frontend_new/components/SilkBackground.js`

WebGL contexts must be explicitly released via `gl.getExtension('WEBGL_lose_context').loseContext()` on component unmount. If this cleanup is not done, browsers silently clamp total WebGL contexts per page (usually 8-16). With `SilkBackground` in the root layout it should only mount once, but any future error causing remount could leak.

---

### P3-8 · All Services Expose Health Endpoints Without Scraping Authentication

**Files:** All services `/health`

`/health` endpoints expose internal state (feature flags, configuration details). In production these should either be network-restricted or return minimal information.

---

### P3-9 · Phone Number Placeholder in Schema Data

**File:** `frontend_new/app/layout.js:75`

```json
"telephone": "+91-98765-43210"
```

This is a placeholder phone number in the JSON-LD Organization schema served to all users and indexed by Google. Replace with the actual business phone.

---

### P3-10 · `COOKIE_HTTPONLY` Env Var Not in `.env.example`

**File:** `.env.example`

Previous sessions confirmed `COOKIE_HTTPONLY=true` is used in production `.env`. This critical security setting is missing from the example template, so new deployments may launch without HttpOnly cookies.

**Fix:** Add to `.env.example`:
```
COOKIE_HTTPONLY=true
COOKIE_SECURE=true    # enforce HTTPS-only cookies in production
```

---

## Architecture Gaps (Not Bugs — Missing Features for Production)

---

### A1 · No Webhook-Based Order Status Updates (Razorpay)

`payment/main.py` has a `/api/v1/webhooks/razorpay` endpoint but order status is not automatically updated when Razorpay fires `payment.captured` events. If the redirect-callback fails (user closes browser), orders are never confirmed.

**Fix:** The webhook handler should update order status to `confirmed` on `payment.captured` events, independently of the frontend redirect flow.

---

### A2 · No Background Job for Expired Stock Reservations

`StockReservation` rows with `status=PENDING` expire after 15 minutes, but there is no background task that scans for expired reservations and decrements `inventory.reserved_quantity`. Stock stays "reserved" indefinitely unless manually cleared.

**Fix:** Add an APScheduler or Celery periodic task (or a PostgreSQL `pg_cron` trigger) to clear expired reservations and restore `reserved_quantity`.

---

### A3 · No Return/Refund Automation

The `/api/v1/returns/` route exists but the refund flow is entirely manual — admin must process the Razorpay refund via dashboard. There is no automated `refund_payment()` call on return approval.

---

### A4 · No Product Embedding Auto-Regeneration on Price/Name Updates

When a product is updated (name, description, category), its embedding becomes stale. The semantic search will return incorrect similarity scores. There is no trigger or background job to regenerate embeddings on product updates.

**Fix:** Add a post-save hook or background task call in the `PATCH /api/v1/admin/products/{id}` endpoint to queue an embedding regeneration.

---

### A5 · No CSRF Token on State-Mutating Endpoints

All state-mutating requests rely solely on HttpOnly cookie auth. While `SameSite=Lax` cookies partially protect against CSRF, `Lax` allows top-level navigation POSTs (e.g., form submissions from other domains). A `SameSite=Strict` cookie or explicit CSRF token would fully close this vector.

---

### A6 · Redis Has No Persistence Configuration

**File:** `docker/redis/redis.conf`

If Redis restarts, all carts (7-day TTL in Redis) are lost. Users lose their carts on every Redis restart/deploy.

**Fix:** Enable AOF persistence:
```
appendonly yes
appendfsync everysec
```

---

### A7 · No CDN for Product Images Beyond R2 Public URL

Product images use a direct Cloudflare R2 public URL. There is no image optimization layer (Next.js `<Image>` with `domains` configured) beyond what Next.js does. Large product images are served at full resolution to mobile devices.

**Fix:** Ensure `next.config.js` has the R2 domain in `images.domains` (or `remotePatterns`) and verify `<Image>` usage with `width`/`height` props on all product image components.

---

## Summary Prioritisation Table

| ID | Severity | Area | Issue | Status |
|----|----------|------|-------|--------|
| P0-1 | 🔴 P0 | AI | All AI chat broken (key mismatch with `genai`) | **Fix required** |
| P0-2 | 🔴 P0 | AI | Admin service startup fails (deprecated `gemini-pro`) | **Fix required** |
| P0-3 | 🔴 P0 | Payment | Cashfree 100× overcharge (paise vs rupees) | **Fix required** |
| P0-4 | 🔴 P0 | AI/DB | DB connection leak on every AI message | **Fix required** |
| P0-5 | 🔴 P0 | Frontend | Order creation race condition (`useState` guard) | **Fix required** |
| P0-6 | 🔴 P0 | AI | Product embedding generation always fails | **Fix required** |
| P1-1 | 🟠 P1 | AI | `add_to_cart` AI tool bypasses inventory | Fix recommended |
| P1-2 | 🟠 P1 | AI | `apply_coupon` tool returns wrong description | Fix recommended |
| P1-3 | 🟠 P1 | Security | IP spoofing via `set_real_ip_from 0.0.0.0/0` | Fix recommended |
| P1-4 | 🟠 P1 | Backend | Broken SQL INTERVAL binding in session query | Fix recommended |
| P1-5 | 🟠 P1 | AI | `get_revenue_summary` JOIN depends on migration | Verify & fix |
| P1-6 | 🟠 P1 | AI | Rotation instance stores stale DB session | Fix recommended |
| P1-7 | 🟠 P1 | Frontend | Confirm page shows ₹0 order total | Fix recommended |
| P1-8 | 🟠 P1 | Backend | Email notifications silently disabled | Fix recommended |
| P1-9 | 🟠 P1 | Security | Swagger/ReDoc public in production | Fix recommended |
| P1-10 | 🟠 P1 | Frontend | Cashfree SDK fallback uses wrong URL | Fix recommended |
| P2-1 | 🟡 P2 | AI | Fake SSE streaming (full latency first) | Improve |
| P2-2 | 🟡 P2 | AI | Purchase history query on every message | Optimise |
| P2-5 | 🟡 P2 | Frontend | Service worker unregistered every load | Fix |
| P2-6 | 🟡 P2 | DB | Missing full-text index on products | Add index |
| P2-7 | 🟡 P2 | DB | Missing HNSW index for vector search | Add index |
| P2-8 | 🟡 P2 | Admin | AI dashboard always 403 (unseeded permissions) | Seed or bypass |
| A1 | 🔵 Arch | Payment | No webhook-based order auto-confirmation | Add webhook handler |
| A2 | 🔵 Arch | Stock | No background job for expired reservations | Add cron job |
| A5 | 🔵 Arch | Security | No CSRF token (SameSite=Lax only) | Harden |
| A6 | 🔵 Arch | Infra | Redis no AOF persistence (carts lost on restart) | Enable AOF |

---

## Recommended Fix Order

**Sprint 1 (Ship-blocker fixes — all P0s):**
1. Fix `_get_api_key()` → `_get_gemini_key()` (P0-1, P0-6)
2. Fix startup model `gemini-pro` → `gemini-2.0-flash-lite` (P0-2)
3. Fix Cashfree amount: remove `* 100` (P0-3)
4. Fix `_get_api_key()` DB connection leak (P0-4)
5. Fix `isCreating` race condition → `useRef` (P0-5)

**Sprint 2 (High-impact P1s):**
6. Fix `add_to_cart` AI tool to use CartService (P1-1)
7. Fix `apply_coupon` description field index (P1-2)
8. Fix `set_real_ip_from` in nginx (P1-3)
9. Verify `order_items.inventory_id` migration applied (P1-5)
10. Disable Swagger in production (P1-9)
11. Seed permissions for AI dashboard (P2-8)

**Sprint 3 (Quality improvements):**
12. Add pgvector HNSW index (P2-7)
13. Add products full-text GIN index (P2-6)
14. Fix service worker lifecycle (P2-5)
15. Enable Redis AOF persistence (A6)
16. Add Razorpay webhook handler for auto-confirm (A1)
17. Add expired reservation cleanup job (A2)
