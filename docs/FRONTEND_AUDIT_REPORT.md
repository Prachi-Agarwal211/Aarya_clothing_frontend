# Frontend Audit Report — Aarya Clothing
> Full codebase audit: layout, routing, mobile/desktop responsiveness, components

---

## 🔴 P0 — CRITICAL (crashes / broken user flows)

---

### 1. **LAYOUT CLASSES MISSING SYSTEM-WIDE — Every major page is broken**
**Files affected:** `cart/page.js`, `collections/[slug]/page.js`, `collections/page.js`, `products/page.js`, `products/[id]/page.js`, `search/page.js`, `profile/layout.js`, `checkout/layout.js`, `checkout/confirm/page.js`, `ai/page.js`, etc.

**Bug:** The CSS utility classes `page-wrapper`, `header-spacing`, `page-content`, and `pb-bottom-nav` are used on nearly every page but are **defined nowhere** — not in `globals.css`, not in `tailwind.config.js`, not in any `.css` file.

Confirmed via `grep` across entire `frontend_new/` directory — zero results.

```jsx
// Used across all pages:
<div className="relative z-10 page-wrapper">
  <div className="page-content">
    <div className="container mx-auto px-4 sm:px-6 md:px-8 header-spacing">
      ...
    </div>
  </div>
</div>
// And:
<div className="... pb-bottom-nav lg:pb-8">
```

**Impact:**
- `header-spacing` → No top padding below the fixed header → page content sits hidden behind the header on load
- `page-wrapper` / `page-content` → No visual difference (treated as unknown classes, silently ignored)
- `pb-bottom-nav` → No bottom padding for mobile bottom nav → last content hidden behind bottom navigation

**Fix:** Add the missing utility definitions in `globals.css`:
```css
/* Header spacing — accounts for fixed header (≈ 64-72px height) */
.header-spacing { padding-top: 5rem; }      /* 80px */
@media (min-width: 768px) {
  .header-spacing { padding-top: 5.5rem; }  /* 88px */
}

/* Bottom nav clearance on mobile */
.pb-bottom-nav { padding-bottom: 5rem; }    /* 80px (64px nav + 16px gap) */
@media (min-width: 1024px) {
  .pb-bottom-nav { padding-bottom: 2rem; }
}

/* Wrappers — semantic only */
.page-wrapper {}
.page-content {}
```

---

### 2. **`collections/[slug]/page.js` — `router` is not defined (ReferenceError)**
**File:** `frontend_new/app/collections/[slug]/page.js:226`

**Bug:** The "Back to Collections" button calls `router.back()` but `useRouter` is never imported or instantiated in this file. Clicking the button throws `ReferenceError: router is not defined` and crashes the React tree.

```jsx
// Line 226 — crashes on click
<button onClick={() => router.back()}>
  <ArrowLeft className="w-4 h-4" />
  Back to Collections
</button>
```

The file only imports `useParams`, not `useRouter`:
```jsx
import { useParams } from 'next/navigation'; // ← no useRouter
```

**Fix:** Add `useRouter` to the import and instantiate it:
```jsx
import { useParams, useRouter } from 'next/navigation';
// ...
const router = useRouter();
```

---

### 3. **`checkout/payment/page.js` — Cashfree 100× overcharge bug**
**File:** `frontend_new/app/checkout/payment/page.js:314`

**Bug:** Cashfree order creation sends `amount * 100` (converting to paise), but the Cashfree API expects amount **in rupees**, not paise. A ₹500 order is charged as ₹50,000.

```jsx
orderData = await paymentApi.createCashfreeOrder({
  amount: Math.round((cart.total || 0) * 100), // ← BUG: *100 is wrong for Cashfree
  currency: 'INR',
});
```

**Fix:**
```jsx
amount: cart.total || 0,  // Cashfree expects rupees, not paise
```

---

### 4. **`checkout/confirm/page.js` — Invoice item total shows unit price, not line total**
**File:** `frontend_new/app/checkout/confirm/page.js:336`

**Bug:** In the order invoice table, the rightmost column (intended to be line total) renders `item.price` instead of `item.price * item.quantity`. A quantity-3 item shows the unit price, not `3 × price`.

```jsx
// Line 336
<p className="text-[#F2C29A] text-sm font-semibold">{formatCurrency(item.price)}</p>
// Should be:
<p className="text-[#F2C29A] text-sm font-semibold">{formatCurrency((item.unit_price || item.price) * item.quantity)}</p>
```

---

### 5. **`ProductCard.jsx` — NEW badge and SALE badge overlap each other**
**File:** `frontend_new/components/common/ProductCard.jsx:119-135`

**Bug:** Both the "NEW" badge and the "% OFF" discount badge are positioned at `absolute top-4 left-4 z-20`. When a product is both new and on sale, one badge renders on top of the other.

```jsx
// Both at same position:
{isNew && (
  <div className="absolute top-4 left-4 z-20">
    <span>NEW</span>
  </div>
)}
{originalPrice && originalPrice > price && (
  <div className="absolute top-4 left-4 z-20">  {/* ← same position! */}
    <span>% OFF</span>
  </div>
)}
```

**Fix:** Move sale badge to `top-4 right-4` (or use different vertical stacking):
```jsx
<div className="absolute top-4 right-4 z-20">  {/* sale badge */}
```

---

## 🟠 P1 — HIGH (significant UX / functional issues)

---

### 6. **`EnhancedHeader.jsx` — Search auto-navigates on every keystroke**
**File:** `frontend_new/components/landing/EnhancedHeader.jsx:126-130`

**Bug:** The search input auto-navigates to `/search?q=...` after every 300ms debounce, even while the user is still typing. A user typing "kurta" causes 5 separate navigations. This is disruptive on slower devices and causes scroll jumps.

```jsx
useEffect(() => {
  if (debouncedSearchQuery.trim()) {
    router.push(`/search?q=${encodeURIComponent(debouncedSearchQuery.trim())}`);
  }
}, [debouncedSearchQuery, router]);
```

**Fix:** Only navigate on explicit Enter key or search icon click. Remove the debounce-triggered auto-navigation effect. The `onKeyDown` handler already handles Enter — just remove the `useEffect` above.

---

### 7. **`EnhancedHeader.jsx` — Mobile menu has no search input**
**File:** `frontend_new/components/landing/EnhancedHeader.jsx:391-488`

**Bug:** The mobile overlay menu (hamburger) shows navigation links and action icons but has no search input. Mobile users cannot search products from the header — they must navigate to `/search` manually or use the header search on desktop.

The desktop search input exists at lines 292-310 inside `hidden md:flex`, but there is no equivalent in the mobile menu overlay.

**Fix:** Add a search input inside the mobile nav overlay, above the nav links.

---

### 8. **`Footer.jsx` — Newsletter subscribe is completely non-functional**
**File:** `frontend_new/components/landing/Footer.jsx:119-137`

**Bug:** The email input has no `value` state and no `onChange`. The Subscribe button has no `onClick`. Nothing happens when the user clicks Subscribe.

```jsx
<input
  type="email"
  placeholder="Enter your email"
  // ← no value, no onChange
/>
<Button variant="luxury" size="sm" className="w-full ...">
  Subscribe  {/* ← no onClick */}
</Button>
```

**Fix:** Wire up state and a handler, or remove the section if newsletter is not implemented.

---

### 9. **`Footer.jsx` — Social media links are dead (`href="#"`)**
**File:** `frontend_new/components/landing/Footer.jsx:47-55`

```jsx
<a href="#">  {/* Instagram — placeholder only */}
<a href="#">  {/* Facebook */}
<a href="#">  {/* Twitter/X */}
```

Clicking any social icon just scrolls to the top of the page. **Fix:** Replace with real URLs or remove the icons.

---

### 10. **`cart/page.js` — Product links use numeric ID, not slug**
**File:** `frontend_new/app/cart/page.js:132,151`

```jsx
<Link href={`/products/${item.product_id}`}>
```

Product items in the cart link to `/products/42` (numeric). The product page then performs a slug redirect (`router.replace('/products/slug-name')`), causing a visible double navigation. **Fix:** Store and use `item.product_slug` in the cart context, or check if `item.slug` is available and prefer it.

---

### 11. **`collections/[slug]/page.js` — Add-to-cart missing auth check**
**File:** `frontend_new/app/collections/[slug]/page.js:62-72`

```jsx
const handleAddToCart = async (productData) => {
  try {
    await addItem(productData.id, ...);
    // ← no isAuthenticated check, no redirect to login
```

The `ProductCard` component correctly checks `isAuthenticated` and redirects to `/auth/login`. This collection page's handler does not. Unauthenticated users get a generic error toast instead of a login redirect. **Fix:** Add auth check matching `ProductCard.jsx` lines 62-68.

---

### 12. **`products/page.js` — Quick-add doesn't check auth**
**File:** `frontend_new/app/products/page.js:44-57`

Same issue: `handleQuickAdd` does not check `isAuthenticated`. Guest users get a silent failure or error toast. **Fix:** Add auth check with login redirect before calling `addItem`.

---

### 13. **`CartDrawer.jsx` — Stock errors silently swallowed for customers**
**File:** `frontend_new/components/cart/CartDrawer.jsx:59-80`

When `updateQuantity` fails (stock exceeded), the catch block only shows errors to admin/staff. Regular customers receive zero feedback when their quantity increase fails:

```jsx
} catch (err) {
  if (isAdminUser) {
    // show error
  }
  // ← customer gets nothing
}
```

**Fix:** Show a user-friendly toast (e.g. "Maximum stock reached") to all users, not just admins.

---

### 14. **`CustomerChatWidget.jsx` — API calls fire on admin pages**
**File:** `frontend_new/components/chat/CustomerChatWidget.jsx:44-76`

The `loadExistingRoom` `useEffect` (lines 44-71) runs unconditionally and makes API calls to load chat rooms. The `return null` early guard for admin/staff pages (line 73-76) is after the hooks, so the API calls still fire on every admin page render.

**Fix:** Move the admin/staff page guard to before the `useEffect` dependencies, or add an early return in the `useEffect` callback:
```jsx
useEffect(() => {
  if (!user || pathname?.startsWith('/admin') || pathname?.startsWith('/staff')) return;
  loadExistingRoom();
}, [user, pathname]);
```

---

### 15. **`EnhancedHeader.jsx` — `aria-current="page"` hardcoded on "New Arrivals"**
**File:** `frontend_new/components/landing/EnhancedHeader.jsx:235`

```jsx
aria-current={link.name === 'New Arrivals' ? 'page' : undefined}
```

Screen readers always announce "New Arrivals" as the current page, regardless of the actual route. **Fix:** Use `pathname === link.href` or `pathname.includes(link.anchor)` to compute `aria-current`.

---

## 🟡 P2 — MEDIUM (layout, visual, UX polish)

---

### 16. **`globals.css` — Aggressive `text-shadow` on ALL gold-colored elements**
**File:** `frontend_new/app/globals.css:333-339`

```css
.text-\[\#F2C29A\] {
  text-shadow: 
    0 1px 3px rgba(0, 0, 0, 0.9),
    0 2px 6px rgba(0, 0, 0, 0.6),
    0 0 20px rgba(242, 194, 154, 0.25),
    0 0 40px rgba(242, 194, 154, 0.1);
}
```

This applies an intense shadow to **every** element with `text-[#F2C29A]` — including tiny 10px badge labels, cart count badges, and price tags. On high-DPI mobile screens this causes blurry, illegible small text. **Fix:** Scope this rule to headings only (e.g. `.heading-gold`), not a blanket class override.

---

### 17. **`BottomNavigation.jsx` — Active icon `fill-current opacity-20` nearly invisible**
**File:** `frontend_new/components/common/BottomNavigation.jsx:75`

```jsx
<item.icon className={cn("w-6 h-6", item.isActive && "fill-current opacity-20")} />
```

Active nav icons have `opacity-20` fill — 80% transparent. The active state is barely distinguishable. **Fix:** Remove `opacity-20` or use `opacity-60` for a visible but subdued fill effect.

---

### 18. **`app/page.js` — Entire landing page is not SSR'd (LCP + SEO impact)**
**File:** `frontend_new/app/page.js:186-188`

```jsx
if (!isClient) return null;
```

The entire home page renders nothing on the server. The intro video logic requires `sessionStorage`, but the SSR null-return hurts Core Web Vitals (LCP > 4s on first load) and prevents search engines from indexing landing content.

**Fix:** Server-render the loading spinner or a static above-the-fold layout, and only gate the video check client-side.

---

### 19. **`app/page.js` — Double loading skeleton on NewArrivals**
**File:** `frontend_new/app/page.js:15-24, 233-240`

`NewArrivals` is wrapped in both:
1. `dynamic(() => import(...))` with its own skeleton loader
2. `<LazyLoad>` wrapper with another skeleton

On render, users see two sequential loading states for the same section. **Fix:** Use only one loading strategy — either `dynamic` with skeleton OR `LazyLoad`, not both.

---

### 20. **`checkout/page.js` — `continuing` loading state is dead code**
**File:** `frontend_new/app/checkout/page.js:31,357`

`const [continuing, setContinuing] = useState(false)` is declared and used for `disabled={... || continuing}`, but `setContinuing(true)` is never called in `handleContinue`. The button never shows a loading/disabled state after click.

---

### 21. **`profile/layout.js` — Mobile tab strip no scroll hint**
**File:** `frontend_new/app/profile/layout.js:102-122`

The horizontal tab strip on mobile uses `overflow-x-auto` but has no fade gradient on the right edge to hint that more tabs exist off-screen. Users with narrow phones (< 360px) cannot easily discover the Returns/Settings tabs.

**Fix:** Add `after:content-[''] after:absolute after:right-0 after:top-0 after:h-full after:w-8 after:bg-gradient-to-l after:from-[#050203]` to the strip container.

---

### 22. **`checkout/confirm/page.js` — Missing error UI for `error` state**
**File:** `frontend_new/app/checkout/confirm/page.js:217-391`

When `error` is set (payment/stock failure), the component renders the success layout but with no visible error message shown in it — `error` state is set but never rendered in the JSX return (there's no `{error && ...}` block in the success JSX). The user sees the order confirmed layout even on error.

**Fix:** Add an error display block at the top of the return when `error` is truthy.

---

### 23. **`collections/[slug]/page.js` — Filter toolbar overflows on small screens**
**File:** `frontend_new/app/collections/[slug]/page.js:275-341`

The toolbar row contains: search input + price range dropdown + max price input + sort dropdown + clear button + result count — all in one `flex flex-wrap` row. On screens ≤ 375px (common Android phones), these wrap into 3+ rows, consuming significant vertical space before the product grid.

**Fix:** On mobile, collapse filters behind a `SlidersHorizontal` button (the icon is already imported at line 11 but unused on this page).

---

## 📱 MOBILE-SPECIFIC ISSUES

---

### 24. **`products/[id]/page.js` — Mobile sticky add-to-cart bar uses non-standard CSS**
**File:** `frontend_new/app/products/[id]/page.js:734`

```jsx
className="fixed bottom-nav-offset inset-x-0 ..."
style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}
```

`bottom-nav-offset` doesn't exist as a Tailwind class, but the inline `style` overrides it correctly. The class is dead weight. The `calc(4rem + ...)` correctly accounts for the 64px bottom nav + safe area on notched devices. This is fine functionally but the dead class adds confusion.

---

### 25. **`collections/page.js` — Grid bottom padding insufficient for iPhone home bar**
**File:** `frontend_new/app/collections/page.js:73`

```jsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-20">
```

`pb-20` = 80px. iPhone 14/15 Pro has a 34px home indicator. Bottom nav (64px) + home indicator (34px) = 98px needed. `pb-20` (80px) is 18px short — last card is clipped.

**Fix:** Use `pb-28` (112px) or the `pb-bottom-nav` class once defined.

---

### 26. **`products/[id]/page.js` — Thumbnail gallery no scroll snap**
**File:** `frontend_new/app/products/[id]/page.js:401-421`

The thumbnail strip uses `overflow-x-auto pb-2` but has no `snap-x snap-mandatory`. On iOS, momentum scrolling can land between thumbnails. **Fix:** Add `snap-x snap-mandatory` to the container and `snap-start` to each button.

---

### 27. **`profile/layout.js` — `pb-24` too large for content area on mobile**
**File:** `frontend_new/app/profile/layout.js:190`

```jsx
<div className="md:col-span-3 pb-24 md:pb-8">
```

`pb-24` = 96px. The BottomNavigation is only 64px + safe area. 96px leaves an unnecessary 32px empty gap at the bottom of all profile pages on mobile.

---

## 🗺️ ROUTING ISSUES

---

### 28. **Footer links may 404 — pages not confirmed to exist**
**File:** `frontend_new/components/landing/Footer.jsx:93-104, 161-164`

Footer links to: `/contact`, `/shipping`, `/returns`, `/faq`, `/terms`, `/privacy`. These are not visible in the workspace layout under `frontend_new/app/`. If any of these pages are missing, footer links 404.

**Verify:** Confirm each route exists and has a `page.js`.

---

### 29. **`BottomNavigation.jsx` — Inconsistent cart behavior vs header**
**File:** `frontend_new/components/common/BottomNavigation.jsx:38-42`

- Header cart icon → opens `CartDrawer` (slide-in panel)
- Bottom nav "Cart" → navigates to `/cart` (full page)

On mobile, tapping the cart icon in the header opens a drawer; tapping cart in the bottom nav goes to a different full page. This is inconsistent and can confuse users.

**Fix:** Bottom nav cart should call `toggleCart()` to open the drawer (matching header behavior), OR always navigate to `/cart` in both places — pick one.

---

### 30. **`products/[id]/page.js` — No scroll-to-top on product-to-product navigation**
**File:** `frontend_new/app/products/[id]/page.js:106-108`

```jsx
useEffect(() => {
  fetchProduct();
}, [productId]);
```

When navigating from one product to another (e.g., via related products), the page doesn't scroll to top. Users land mid-page with new product content loading in the same scroll position.

**Fix:** Add `window.scrollTo(0, 0)` inside the `useEffect` before `fetchProduct()`.

---

## ⚡ PERFORMANCE ISSUES

---

### 31. **`ProductCard.jsx` — All new-arrival images loaded with `priority`**
**File:** `frontend_new/components/common/ProductCard.jsx:157`

```jsx
<Image priority={isNew} ... />
```

All "new arrival" products (potentially 10-20 items on the landing page carousel) get `priority={true}`, which preloads them simultaneously. This starves bandwidth for the hero image (the actual LCP element).

**Fix:** Only the first 1-2 visible cards should have `priority={true}`. Pass an `index` prop and use `priority={index < 2}`.

---

### 32. **`next.config.js` — Custom image loader is single point of failure**
**File:** `frontend_new/next.config.js:27-28`

```js
loader: 'custom',
loaderFile: './imageLoader.ts',
```

All image rendering relies on `imageLoader.ts`. If this file has a bug or returns an invalid URL, **every image on the site breaks** simultaneously. Verify this file exists and handles edge cases (missing URLs, malformed paths).

---

### 33. **`app/page.js` — `getLandingAll()` has no timeout**
**File:** `frontend_new/app/page.js:112`

```jsx
const response = await getLandingAll();
```

No timeout or `AbortController` on the landing data fetch. If the backend is slow, users see the spinner indefinitely. **Fix:** Add a 5-10s timeout with `AbortController`.

---

## 🔧 COMPONENT-LEVEL BUGS

---

### 34. **`ai/page.js` — Imports `aiApi` from `adminApi` (wrong module)**
**File:** `frontend_new/app/ai/page.js:11`

```jsx
import { aiApi } from '@/lib/adminApi';
```

The customer-facing AI chat page imports from `adminApi`. If admin API adds auth guards in the future, this page will silently break for customers. Should import from a customer-specific API module.

---

### 35. **`products/[id]/page.js` — Quantity selector hidden from all customers**
**File:** `frontend_new/app/products/[id]/page.js:517-540`

```jsx
{isAdminUser && (
  <div>
    {/* Quantity controls */}
  </div>
)}
```

Regular customers cannot set quantity before adding to cart. They must add the item once and then change quantity in the cart. This is an intentional limitation but significantly degrades UX compared to standard e-commerce patterns.

---

### 36. **`checkout/page.js` — `name` field unused in address form**
**File:** `frontend_new/app/checkout/page.js:33,228-235`

The form includes both `name` (address label, e.g. "Home") and `full_name` (person's name). The `name` field label says "Address Name" but it's not validated as required. If submitted empty, address displays without a label in the selection list.

---

### 37. **`profile/orders/page.js` — Order STATUS_CONFIG missing `pending` and `processing` states**
**File:** `frontend_new/app/profile/orders/page.js:14-19`

```jsx
const STATUS_CONFIG = {
  confirmed: { ... },
  shipped: { ... },
  delivered: { ... },
  cancelled: { ... },
  // ← no 'pending', no 'processing', no 'return_requested'
};
```

Orders with other statuses (e.g., `pending`, `processing`, `return_requested`) render undefined config, likely causing a JavaScript error or blank status badge.

---

## 📋 SUMMARY TABLE

| # | File | Severity | Issue |
|---|------|----------|-------|
| 1 | `globals.css` | 🔴 P0 | `page-wrapper`, `header-spacing`, `page-content`, `pb-bottom-nav` undefined — header overlaps content site-wide |
| 2 | `collections/[slug]/page.js:226` | 🔴 P0 | `router` is not defined — ReferenceError on Back button |
| 3 | `checkout/payment/page.js:314` | 🔴 P0 | Cashfree `amount * 100` → 100x overcharge |
| 4 | `checkout/confirm/page.js:336` | 🔴 P0 | Invoice shows unit price instead of line total |
| 5 | `ProductCard.jsx:119-135` | 🔴 P0 | NEW + SALE badges overlap at same position |
| 6 | `EnhancedHeader.jsx:126-130` | 🟠 P1 | Search auto-navigates on every keystroke |
| 7 | `EnhancedHeader.jsx` mobile menu | 🟠 P1 | No search input in mobile hamburger menu |
| 8 | `Footer.jsx` newsletter | 🟠 P1 | Subscribe button does nothing |
| 9 | `Footer.jsx` social links | 🟠 P1 | All `href="#"` — dead links |
| 10 | `cart/page.js:132,151` | 🟠 P1 | Product links use numeric ID, not slug |
| 11 | `collections/[slug]/page.js:62` | 🟠 P1 | Add-to-cart no auth check → no login redirect for guests |
| 12 | `products/page.js:44` | 🟠 P1 | Quick-add no auth check |
| 13 | `CartDrawer.jsx:59-80` | 🟠 P1 | Stock errors silently ignored for customers |
| 14 | `CustomerChatWidget.jsx:44-76` | 🟠 P1 | API calls fire on admin pages despite null return |
| 15 | `EnhancedHeader.jsx:235` | 🟠 P1 | `aria-current="page"` hardcoded on New Arrivals |
| 16 | `globals.css:333` | 🟡 P2 | Text-shadow on ALL gold text, blurs small labels |
| 17 | `BottomNavigation.jsx:75` | 🟡 P2 | Active icon `opacity-20` fill — nearly invisible |
| 18 | `app/page.js:186-188` | 🟡 P2 | No SSR on landing page → poor LCP |
| 19 | `app/page.js:15-23,233` | 🟡 P2 | Double loading skeleton on NewArrivals |
| 20 | `checkout/page.js:31,357` | 🟡 P2 | Continue button loading state dead code |
| 21 | `profile/layout.js:102` | 🟡 P2 | Mobile tab strip no scroll hint |
| 22 | `checkout/confirm/page.js` | 🟡 P2 | `error` state set but not rendered in success layout |
| 23 | `collections/[slug]/page.js:275` | 🟡 P2 | Filter toolbar overflows on ≤375px screens |
| 24 | `products/[id]/page.js:734` | 📱 Mobile | Sticky bar uses undefined `bottom-nav-offset` class |
| 25 | `collections/page.js:73` | 📱 Mobile | `pb-20` insufficient for iPhone home bar |
| 26 | `products/[id]/page.js:401` | 📱 Mobile | Thumbnail gallery missing scroll snap |
| 27 | `profile/layout.js:190` | 📱 Mobile | `pb-24` excessive bottom padding on mobile |
| 28 | `Footer.jsx:93-104` | 🗺️ Routing | Footer links may 404 (contact/faq/terms/privacy/shipping) |
| 29 | `BottomNavigation.jsx:38` | 🗺️ Routing | Cart behavior inconsistent (drawer vs full page) |
| 30 | `products/[id]/page.js:106` | 🗺️ Routing | No scroll-to-top on product-to-product navigation |
| 31 | `ProductCard.jsx:157` | ⚡ Perf | All new-arrival images `priority={true}` |
| 32 | `next.config.js:27` | ⚡ Perf | Custom image loader is single point of failure |
| 33 | `app/page.js:112` | ⚡ Perf | `getLandingAll()` no fetch timeout |
| 34 | `ai/page.js:11` | 🔧 Component | Customer AI page imports from adminApi |
| 35 | `products/[id]/page.js:517` | 🔧 Component | Quantity selector hidden from customers (admin only) |
| 36 | `checkout/page.js:33` | 🔧 Component | Address `name` field not validated |
| 37 | `profile/orders/page.js:14` | 🔧 Component | STATUS_CONFIG missing `pending`/`processing` states |

---

## 🛠️ PRIORITY FIX ORDER

**Fix immediately (P0 — site is functionally broken without these):**
1. Add missing CSS utility classes to `globals.css` (affects every page)
2. Add `useRouter` to `collections/[slug]/page.js`
3. Fix Cashfree `amount * 100` bug in `checkout/payment/page.js`
4. Fix invoice line total in `checkout/confirm/page.js`
5. Fix ProductCard badge positioning overlap

**Fix soon (P1 — significant UX issues):**
6. Remove header search auto-navigation
7. Add search to mobile menu
8. Fix or remove non-functional newsletter subscribe
9. Fix social media links
10. Add auth checks to collection/products quick-add handlers
11. Show stock errors to customers in CartDrawer
12. Move CustomerChatWidget API guard to prevent admin-page calls

---
*Report generated: Full read audit of `frontend_new/` — all pages, components, CSS, config*
